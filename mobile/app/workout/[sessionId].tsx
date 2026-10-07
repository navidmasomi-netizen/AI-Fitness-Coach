import { useState, useEffect, useMemo, useRef } from "react";
import { View, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../src/api/client";
import { addSetLog, completeSession, getActiveSession } from "../../src/api/sessions";
import { applyReplacementSelection, getReplacementRecommendations } from "../../src/api/replacements";
import { buildWorkoutName } from "../../src/utils/workoutMeta";
import { runpuyFontFamilies } from "../../src/design-system/fonts";
import type { ProgramDayExercise } from "../../src/types/program";
import type {
  CatalogEquipment,
  ReplacementCandidateSummary,
  ReplacementIntentType,
  ReplacementRecommendationResponse,
  WorkoutSessionExerciseTarget,
} from "../../src/types/replacement";
import {
  REPLACEMENT_DISCOVERY_EQUIPMENT_OPTIONS,
  REPLACEMENT_DISCOVERY_REASON_OPTIONS,
  buildReplacementContextInput,
  groupLoggedSetsByExercise,
  getNoReplacementMessage,
  getReplacementUnavailableMessage,
  getReplacementWarningMessage,
  isAppliedReplacementAuthoritative,
  mergeWorkoutExercisesWithTargets,
  type ReplacementDiscoveryStatus,
} from "../../src/utils/replacementDiscovery";
import {
  createReplacementFlowId,
  logReplacementMobileEvent,
} from "../../src/utils/replacementObservability";
import {
  RunpuyButton,
  RunpuyCard,
  RunpuySelectableCard,
  RunpuyStatusChip,
  RunpuyText,
} from "../../src/design-system/components";
import { darkTheme } from "../../src/design-system/themes";
import { layout, radii, spacing } from "../../src/design-system/tokens";

interface LoggedSet {
  id: number;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

interface ActiveWorkoutSnapshot {
  session: {
    id: number;
    setLogs?: Array<{
      id: number;
      exerciseId: number;
      setNumber: number;
      reps: number;
      weightKg: number | null;
    }>;
    exerciseTargets?: WorkoutSessionExerciseTarget[];
  };
  program: unknown;
  programDay: unknown;
  exercises: unknown[];
}

type WorkoutExerciseWithTarget = ProgramDayExercise & { targetId: number | null };

interface ReplacementDiscoveryState {
  status: ReplacementDiscoveryStatus;
  exercise: WorkoutExerciseWithTarget | null;
  flowId: string | null;
  intentType: ReplacementIntentType | null;
  availableEquipment: CatalogEquipment[];
  recommendations: ReplacementRecommendationResponse | null;
  selectedCandidateExerciseId: number | null;
  errorMessage: string | null;
  applyErrorMessage: string | null;
}

const INITIAL_DISCOVERY_STATE: ReplacementDiscoveryState = {
  status: "IDLE",
  exercise: null,
  flowId: null,
  intentType: null,
  availableEquipment: [],
  recommendations: null,
  selectedCandidateExerciseId: null,
  errorMessage: null,
  applyErrorMessage: null,
};

function getExerciseDisplayName(exercise: { nameFa: string; nameEn: string | null }) {
  return exercise.nameFa || exercise.nameEn || `Exercise ${exercise}`;
}

function getTargetExerciseDisplayName(exercise: WorkoutSessionExerciseTarget["exercise"]) {
  if (exercise?.nameFa || exercise?.nameEn) {
    return exercise.nameFa || exercise.nameEn || "Exercise";
  }

  return "Exercise";
}

function getCandidateEquipmentLabel(status: ReplacementCandidateSummary["equipmentAvailabilityStatus"]) {
  if (status === "AVAILABLE") return "Equipment available";
  if (status === "UNAVAILABLE") return "Not available with current equipment";
  if (status === "METADATA_UNAVAILABLE") return "Equipment details unavailable";
  return "Equipment not checked";
}

function getApplyReplacementErrorMessage() {
  return "Could not apply this replacement. Your workout has not changed.";
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WorkoutSessionScreen() {
  const {
    sessionId,
    programName,
    dayName,
    exercisesData,
    exerciseTargetsData,
    existingSetLogsData,
  } = useLocalSearchParams<{
    sessionId: string;
    programName: string;
    dayName: string;
    exercisesData: string;
    exerciseTargetsData?: string;
    existingSetLogsData?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericSessionId = Number(sessionId);

  const baseExercises = useMemo<ProgramDayExercise[]>(
    () => (exercisesData ? JSON.parse(exercisesData) : []),
    [exercisesData]
  );
  const routeExerciseTargets = useMemo<WorkoutSessionExerciseTarget[]>(
    () => (exerciseTargetsData ? JSON.parse(exerciseTargetsData) : []),
    [exerciseTargetsData]
  );
  const cachedExerciseTargets =
    queryClient.getQueryData<WorkoutSessionExerciseTarget[]>(["sessionExerciseTargets", numericSessionId]) ?? [];
  const [workoutExerciseTargets, setWorkoutExerciseTargets] = useState<WorkoutSessionExerciseTarget[]>(
    routeExerciseTargets.length > 0 ? routeExerciseTargets : cachedExerciseTargets
  );
  const exercises = useMemo<WorkoutExerciseWithTarget[]>(
    () => mergeWorkoutExercisesWithTargets(baseExercises, workoutExerciseTargets),
    [baseExercises, workoutExerciseTargets]
  );

  const [inputs, setInputs] = useState<Record<number, { reps: string; weightKg: string }>>({});
  const [loggedSets, setLoggedSets] = useState<Record<number, LoggedSet[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [justLogged, setJustLogged] = useState<Record<number, boolean>>({});
  const [lastLoggedExerciseId, setLastLoggedExerciseId] = useState<number | null>(null);
  const [finishError, setFinishError] = useState("");
  const [finishArmed, setFinishArmed] = useState(false);
  const [discoveryState, setDiscoveryState] = useState<ReplacementDiscoveryState>(INITIAL_DISCOVERY_STATE);
  const [replacementSuccessMessage, setReplacementSuccessMessage] = useState<string | null>(null);

  // --- Rest timer state ---
  const [activeRestExerciseId, setActiveRestExerciseId] = useState<number | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [isRestRunning, setIsRestRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discoveryRequestVersionRef = useRef(0);

  useEffect(() => {
    if (isRestRunning) {
      intervalRef.current = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsRestRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRestRunning]);

  const clearRestTimer = () => {
    setIsRestRunning(false);
    setRestSecondsRemaining(0);
    setActiveRestExerciseId(null);
  };

  const startRestTimer = (exerciseId: number, restSeconds: number) => {
    setActiveRestExerciseId(exerciseId);
    setRestSecondsRemaining(restSeconds > 0 ? restSeconds : 60);
    setIsRestRunning(true);
  };

  useEffect(() => {
    if (routeExerciseTargets.length > 0) {
      queryClient.setQueryData(["sessionExerciseTargets", numericSessionId], routeExerciseTargets);
    }
  }, [numericSessionId, queryClient, routeExerciseTargets]);

  useEffect(() => {
    if (routeExerciseTargets.length > 0) {
      setWorkoutExerciseTargets(routeExerciseTargets);
      return;
    }

    if (cachedExerciseTargets.length > 0) {
      setWorkoutExerciseTargets(cachedExerciseTargets);
    }
  }, [cachedExerciseTargets, routeExerciseTargets]);

  useEffect(() => {
    if (!existingSetLogsData) return;
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(existingSetLogsData);
    } catch {
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    setLoggedSets(groupLoggedSetsByExercise(parsed));
  }, []);

  const logSetMutation = useMutation({
    mutationFn: (vars: { exerciseId: number; setNumber: number; reps: number; weightKg?: number }) =>
      addSetLog(numericSessionId, vars),
  });

  const finishMutation = useMutation({
    mutationFn: () => completeSession(numericSessionId),
    onSuccess: (data) => {
      clearRestTimer();
      queryClient.setQueryData(["freshCompletionResult", numericSessionId], data);
      queryClient.invalidateQueries({ queryKey: ["completedSessions"] });
      queryClient.invalidateQueries({ queryKey: ["myProgram"] });
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      queryClient.invalidateQueries({ queryKey: ["regenerationRecommendation"] });
      router.replace(`/workout/summary/${sessionId}`);
    },
    onError: (err: any) => {
      setFinishError(err.message || "Failed to finish workout");
      setFinishArmed(false);
    },
  });

  const replacementMutation = useMutation({
    mutationFn: (params: {
      targetId: number;
      flowId: string | null;
      intentType: ReplacementIntentType;
      availableEquipment: CatalogEquipment[];
    }) =>
      getReplacementRecommendations({
        sessionId: numericSessionId,
        targetId: params.targetId,
        context: buildReplacementContextInput(params.intentType, params.availableEquipment),
        flowId: params.flowId,
      }),
  });

  const synchronizeWorkoutFromSnapshot = (snapshot: ActiveWorkoutSnapshot) => {
    const updatedTargets = snapshot.session.exerciseTargets ?? [];
    const updatedSetLogs = snapshot.session.setLogs ?? [];

    queryClient.setQueryData(["sessionExerciseTargets", numericSessionId], updatedTargets);
    queryClient.setQueryData(["activeSession"], snapshot);

    setWorkoutExerciseTargets(updatedTargets);
    setLoggedSets(groupLoggedSetsByExercise(updatedSetLogs));
    setErrors({});
  };

  const recoverAuthoritativeApplyState = async (params: {
    targetId: number;
    replacementExerciseId: number;
  }) => {
    const activeSession = await getActiveSession();

    if (!activeSession || activeSession.session.id !== numericSessionId) {
      return {
        recovered: false as const,
      };
    }

    synchronizeWorkoutFromSnapshot(activeSession);

    const recovered = isAppliedReplacementAuthoritative(
      activeSession.session.exerciseTargets ?? [],
      params.targetId,
      params.replacementExerciseId
    );

    return {
      recovered,
      replacementExercise:
        activeSession.session.exerciseTargets?.find((target) => target.id === params.targetId)?.exercise ?? null,
    };
  };

  const applyReplacementMutation = useMutation({
    mutationFn: (params: { targetId: number; replacementExerciseId: number; flowId: string | null }) =>
      applyReplacementSelection({
        sessionId: numericSessionId,
        targetId: params.targetId,
        replacementExerciseId: params.replacementExerciseId,
        flowId: params.flowId,
      }),
    onSuccess: (data, variables) => {
      const previousExercise = discoveryState.exercise?.exercise ?? null;
      const responseSnapshot = {
        session: data.session,
        program: data.program,
        programDay: data.programDay,
        exercises: data.exercises,
      };
      const replacementExercise =
        data.session.exerciseTargets?.find((target) => target.id === data.appliedReplacement.targetId)?.exercise ?? null;

      synchronizeWorkoutFromSnapshot(responseSnapshot);
      logReplacementMobileEvent("replacement.apply.completed", {
        flowId: variables.flowId,
        sessionId: numericSessionId,
        targetId: data.appliedReplacement.targetId,
        replacementExerciseId: data.appliedReplacement.replacementExerciseId,
        recovered: false,
      });

      replacementMutation.reset();
      setDiscoveryState(INITIAL_DISCOVERY_STATE);
      setReplacementSuccessMessage(
        previousExercise && replacementExercise
          ? `${getExerciseDisplayName(previousExercise)} replaced with ${getExerciseDisplayName(replacementExercise)}.`
          : "Exercise replaced successfully."
      );
    },
    onError: async (error, variables) => {
      try {
        const recoveredState = await recoverAuthoritativeApplyState(variables);

        if (recoveredState.recovered) {
          const previousExercise = discoveryState.exercise?.exercise ?? null;

          replacementMutation.reset();
          setDiscoveryState(INITIAL_DISCOVERY_STATE);
          logReplacementMobileEvent("replacement.apply.completed", {
            flowId: variables.flowId,
            sessionId: numericSessionId,
            targetId: variables.targetId,
            replacementExerciseId: variables.replacementExerciseId,
            recovered: true,
          });
          setReplacementSuccessMessage(
            previousExercise && recoveredState.replacementExercise
              ? `${getExerciseDisplayName(previousExercise)} replaced with ${getTargetExerciseDisplayName(recoveredState.replacementExercise)}.`
              : "Exercise replaced successfully."
          );
          return;
        }
      } catch {
        queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      }

      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
      logReplacementMobileEvent("replacement.apply.failed", {
        flowId: variables.flowId,
        sessionId: numericSessionId,
        targetId: variables.targetId,
        replacementExerciseId: variables.replacementExerciseId,
        failureCategory:
          error instanceof ApiError && error.status === 409
            ? "conflict"
            : error instanceof ApiError && (error.status === 401 || error.status === 403)
              ? "authorization"
              : error instanceof ApiError && error.status > 0 && error.status < 500
                ? "validation"
                : "unexpected",
        recovered: false,
      });

      setDiscoveryState((previous) => ({
        ...previous,
        applyErrorMessage:
          error instanceof ApiError && error.code === "REPLACEMENT_ALREADY_APPLIED"
            ? "This replacement was already applied. Refresh the workout state before trying again."
            : getApplyReplacementErrorMessage(),
      }));
    },
  });

  const totalLoggedSets = Object.values(loggedSets).reduce((sum, arr) => sum + arr.length, 0);
  const activeReplacementTargetAvailable = exercises.some((exercise) => exercise.targetId !== null);

  const getInput = (exerciseId: number) => inputs[exerciseId] || { reps: "", weightKg: "" };

  const setInput = (exerciseId: number, field: "reps" | "weightKg", value: string) => {
    setInputs((prev) => ({
      ...prev,
      [exerciseId]: { ...getInput(exerciseId), [field]: value },
    }));
  };

  const validate = (repsStr: string, weightStr: string, isBodyweight: boolean): string | null => {
    if (repsStr.trim() === "") return "Reps is required";
    const reps = Number(repsStr);
    if (!Number.isInteger(reps) || reps <= 0) return "Reps must be a positive whole number";

    if (!isBodyweight && weightStr.trim() === "") {
      return "Weight is required for this exercise";
    }

    if (weightStr.trim() !== "") {
      const weight = Number(weightStr);
      if (Number.isNaN(weight) || weight < 0) return "Weight must be a non-negative number";
    }
    return null;
  };

  const isInputValid = (exerciseId: number, isBodyweight: boolean) => {
    const { reps, weightKg } = getInput(exerciseId);
    return validate(reps, weightKg, isBodyweight) === null;
  };

  const onLogSet = async (exerciseId: number, restSeconds: number, isBodyweight: boolean) => {
    const { reps: repsStr, weightKg: weightStr } = getInput(exerciseId);
    const validationError = validate(repsStr, weightStr, isBodyweight);
    if (validationError) {
      setErrors((prev) => ({ ...prev, [exerciseId]: validationError }));
      return;
    }
    setErrors((prev) => ({ ...prev, [exerciseId]: "" }));

    const existing = loggedSets[exerciseId] || [];
    const nextSetNumber = existing.length + 1;
    const reps = Number(repsStr);
    const weightKg = weightStr.trim() === "" ? undefined : Number(weightStr);

    try {
      const created = await logSetMutation.mutateAsync({
        exerciseId,
        setNumber: nextSetNumber,
        reps,
        weightKg,
      });
      setLoggedSets((prev) => ({
        ...prev,
        [exerciseId]: [
          ...existing,
          { id: created.id, setNumber: created.setNumber, reps: created.reps, weightKg: created.weightKg },
        ],
      }));
      setInputs((prev) => ({ ...prev, [exerciseId]: { reps: "", weightKg: "" } }));
      setLastLoggedExerciseId(exerciseId);

      setJustLogged((prev) => ({ ...prev, [exerciseId]: true }));
      setTimeout(() => {
        setJustLogged((prev) => ({ ...prev, [exerciseId]: false }));
      }, 1500);

      startRestTimer(exerciseId, restSeconds);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [exerciseId]: err.message || "Failed to log set" }));
    }
  };

  const onFinishPress = () => {
    if (totalLoggedSets === 0) {
      setFinishError("Log at least one set before finishing the workout");
      return;
    }
    setFinishError("");
    if (!finishArmed) {
      setFinishArmed(true);
      return;
    }
    finishMutation.mutate();
  };

  const openReplacementDiscovery = (exercise: WorkoutExerciseWithTarget) => {
    if (exercise.targetId === null) {
      return;
    }

    const flowId = createReplacementFlowId(numericSessionId, exercise.targetId);
    discoveryRequestVersionRef.current += 1;
    replacementMutation.reset();
    applyReplacementMutation.reset();

    setDiscoveryState({
      status: "COLLECTING_CONTEXT",
      exercise,
      flowId,
      intentType: "PREFER_VARIATION",
      availableEquipment: [],
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
      applyErrorMessage: null,
    });
  };

  const closeReplacementDiscovery = () => {
    discoveryRequestVersionRef.current += 1;
    replacementMutation.reset();
    applyReplacementMutation.reset();
    setDiscoveryState(INITIAL_DISCOVERY_STATE);
  };

  const setDiscoveryIntentType = (intentType: ReplacementIntentType) => {
    setDiscoveryState((previous) => ({
      ...previous,
      intentType,
      availableEquipment: intentType === "NO_EQUIPMENT" ? previous.availableEquipment : [],
    }));
  };

  const toggleDiscoveryEquipment = (equipment: CatalogEquipment) => {
    setDiscoveryState((previous) => ({
      ...previous,
      availableEquipment: previous.availableEquipment.includes(equipment)
        ? previous.availableEquipment.filter((value) => value !== equipment)
        : [...previous.availableEquipment, equipment],
    }));
  };

  const loadReplacementRecommendations = () => {
    if (!discoveryState.exercise || discoveryState.exercise.targetId === null || !discoveryState.intentType) {
      return;
    }

    logReplacementMobileEvent("replacement.discovery.started", {
      flowId: discoveryState.flowId,
      sessionId: numericSessionId,
      targetId: discoveryState.exercise.targetId,
      replacementIntentType: discoveryState.intentType,
      hasEquipmentContext: discoveryState.intentType === "NO_EQUIPMENT",
    });

    const requestVersion = discoveryRequestVersionRef.current + 1;
    discoveryRequestVersionRef.current = requestVersion;

    setDiscoveryState((previous) => ({
      ...previous,
      status: "LOADING_RECOMMENDATIONS",
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
    }));

    replacementMutation.mutate(
      {
        targetId: discoveryState.exercise.targetId,
        flowId: discoveryState.flowId,
        intentType: discoveryState.intentType,
        availableEquipment:
          discoveryState.intentType === "NO_EQUIPMENT" ? discoveryState.availableEquipment : [],
      },
      {
        onSuccess: (data, variables) => {
          if (requestVersion !== discoveryRequestVersionRef.current) {
            return;
          }

          logReplacementMobileEvent("replacement.discovery.completed", {
            flowId: variables.flowId,
            sessionId: numericSessionId,
            targetId: variables.targetId,
            contextualDecisionStatus: data.contextualDecisionStatus,
            recommendedExerciseId: data.recommendedReplacement?.exerciseId ?? null,
            alternativeCount: data.alternatives.length,
            contextRejectedCount: data.contextRejectedCandidates.length,
          });

          setDiscoveryState((previous) => ({
            ...previous,
            status:
              data.contextualDecisionStatus === "NO_CONTEXTUAL_REPLACEMENT" ? "NO_REPLACEMENT" : "RESULTS",
            recommendations: data,
            selectedCandidateExerciseId: data.recommendedReplacement?.exerciseId ?? null,
            errorMessage: null,
            applyErrorMessage: null,
          }));
        },
        onError: (error: any, variables) => {
          if (requestVersion !== discoveryRequestVersionRef.current) {
            return;
          }

          logReplacementMobileEvent("replacement.discovery.failed", {
            flowId: variables.flowId,
            sessionId: numericSessionId,
            targetId: variables.targetId,
            failureCategory:
              error instanceof ApiError && (error.status === 401 || error.status === 403)
                ? "authorization"
                : error instanceof ApiError && error.status > 0 && error.status < 500
                  ? "validation"
                  : "unexpected",
          });

          setDiscoveryState((previous) => ({
            ...previous,
            status: "ERROR",
            errorMessage: error.message || "Failed to load replacement suggestions",
            applyErrorMessage: null,
          }));
        },
      }
    );
  };

  const reopenReplacementContext = () => {
    setDiscoveryState((previous) => ({
      ...previous,
      status: "COLLECTING_CONTEXT",
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
      applyErrorMessage: null,
    }));
  };

  const selectReplacementCandidate = (exerciseId: number) => {
    if (applyReplacementMutation.isPending) {
      return;
    }

    setDiscoveryState((previous) => ({
      ...previous,
      selectedCandidateExerciseId: exerciseId,
      applyErrorMessage: null,
    }));
  };

  const applySelectedReplacement = () => {
    if (
      applyReplacementMutation.isPending ||
      !discoveryState.exercise ||
      discoveryState.exercise.targetId === null ||
      !discoveryState.selectedCandidateExerciseId
    ) {
      return;
    }

    logReplacementMobileEvent("replacement.apply.started", {
      flowId: discoveryState.flowId,
      sessionId: numericSessionId,
      targetId: discoveryState.exercise.targetId,
      replacementExerciseId: discoveryState.selectedCandidateExerciseId,
    });

    applyReplacementMutation.mutate({
      targetId: discoveryState.exercise.targetId,
      replacementExerciseId: discoveryState.selectedCandidateExerciseId,
      flowId: discoveryState.flowId,
    });
  };

  const activeRestExercise = exercises.find((pde: any) => pde.exercise.id === activeRestExerciseId);
  const recommendedReplacement = discoveryState.recommendations?.recommendedReplacement ?? null;
  const shouldShowReplacementWarning =
    discoveryState.recommendations?.contextualDecisionStatus === "RECOMMENDED_WITH_WARNING";
  const isApplyPending = applyReplacementMutation.isPending;

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <Modal
        visible={discoveryState.status !== "IDLE"}
        transparent
        animationType="slide"
        onRequestClose={closeReplacementDiscovery}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <RunpuyText accessibilityRole="header" theme={darkTheme} variant="title">
                  Replace Exercise
                </RunpuyText>
                {discoveryState.exercise && (
                  <RunpuyText script="persianArabic" theme={darkTheme} tone="secondary" variant="body">
                    {getExerciseDisplayName(discoveryState.exercise.exercise)}
                  </RunpuyText>
                )}
              </View>
              <Pressable
                onPress={closeReplacementDiscovery}
                accessibilityRole="button"
                accessibilityLabel="Close replacement discovery"
                accessibilityState={{ disabled: isApplyPending }}
                disabled={isApplyPending}
                style={styles.modalCloseButton}
              >
                <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                  Close
                </RunpuyText>
              </Pressable>
            </View>

            {discoveryState.status === "COLLECTING_CONTEXT" && (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                  Why do you want to replace this exercise?
                </RunpuyText>
                {REPLACEMENT_DISCOVERY_REASON_OPTIONS.map((option) => {
                  const selected = discoveryState.intentType === option.intentType;
                  return (
                    <RunpuySelectableCard
                      key={option.intentType}
                      accessibilityLabel={`Replacement reason: ${option.label}`}
                      description={option.helperText}
                      label={option.label}
                      onPress={() => setDiscoveryIntentType(option.intentType)}
                      selected={selected}
                      selectionRole="radio"
                      theme={darkTheme}
                    />
                  );
                })}

                {discoveryState.intentType === "NO_EQUIPMENT" && (
                  <RunpuyCard theme={darkTheme} style={styles.equipmentSection}>
                    <RunpuyText theme={darkTheme} variant="title">
                      Available equipment right now
                    </RunpuyText>
                    <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                      Select only what is actually available in this session. Bodyweight is handled automatically.
                    </RunpuyText>
                    {REPLACEMENT_DISCOVERY_EQUIPMENT_OPTIONS.map((option) => {
                      const selected = discoveryState.availableEquipment.includes(option.value);
                      return (
                        <RunpuySelectableCard
                          key={option.value}
                          accessibilityLabel={`Toggle available equipment ${option.label}`}
                          label={option.label}
                          onPress={() => toggleDiscoveryEquipment(option.value)}
                          selected={selected}
                          selectionRole="checkbox"
                          theme={darkTheme}
                        />
                      );
                    })}
                  </RunpuyCard>
                )}

                <RunpuyButton
                  disabled={!discoveryState.intentType || isApplyPending}
                  label="Find replacements"
                  onPress={loadReplacementRecommendations}
                  theme={darkTheme}
                />
              </ScrollView>
            )}

            {discoveryState.status === "LOADING_RECOMMENDATIONS" && (
              <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading replacement suggestions" style={styles.loadingState}>
                <ActivityIndicator color={darkTheme.colors.actionPrimary} size="large" />
                <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                  Loading replacement suggestions...
                </RunpuyText>
              </View>
            )}

            {discoveryState.status === "ERROR" && (
              <View style={styles.modalActionStack}>
                <RunpuyCard theme={darkTheme} style={styles.errorSurface}>
                  <RunpuyText theme={darkTheme} variant="title" style={styles.errorText}>
                    Couldn&apos;t load replacements
                  </RunpuyText>
                  <RunpuyText theme={darkTheme} variant="body" style={styles.errorText}>
                    {discoveryState.errorMessage || "Something went wrong while loading replacements."}
                  </RunpuyText>
                </RunpuyCard>
                <RunpuyButton label="Try again" onPress={reopenReplacementContext} theme={darkTheme} />
                <Pressable
                  onPress={closeReplacementDiscovery}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss replacement discovery"
                  style={styles.secondaryAction}
                >
                  <RunpuyText theme={darkTheme} variant="body">
                    Dismiss
                  </RunpuyText>
                </Pressable>
              </View>
            )}

            {discoveryState.status === "NO_REPLACEMENT" && (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                <RunpuyCard theme={darkTheme} style={styles.noReplacementSurface}>
                  <RunpuyText theme={darkTheme} variant="title">
                    No replacement available
                  </RunpuyText>
                  <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                    {getNoReplacementMessage()}
                  </RunpuyText>
                </RunpuyCard>

                {discoveryState.recommendations?.contextRejectedCandidates.length ? (
                  <View style={styles.candidateSection}>
                    <RunpuyText theme={darkTheme} variant="title">
                      Not available right now
                    </RunpuyText>
                    {discoveryState.recommendations.contextRejectedCandidates.map((candidate) => (
                      <RunpuyCard key={candidate.exerciseId} theme={darkTheme} style={styles.candidateCard}>
                        <RunpuyText script="persianArabic" theme={darkTheme} variant="body">
                          {candidate.nameFa}
                        </RunpuyText>
                        <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                          {getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                        </RunpuyText>
                      </RunpuyCard>
                    ))}
                  </View>
                ) : null}

                <RunpuyButton label="Change options" onPress={reopenReplacementContext} theme={darkTheme} />
                <Pressable
                  onPress={closeReplacementDiscovery}
                  accessibilityRole="button"
                  accessibilityLabel="Done with replacement discovery"
                  style={styles.secondaryAction}
                >
                  <RunpuyText theme={darkTheme} variant="body">
                    Done
                  </RunpuyText>
                </Pressable>
              </ScrollView>
            )}

            {discoveryState.status === "RESULTS" && discoveryState.recommendations && (
              <ScrollView contentContainerStyle={styles.modalScrollContent}>
                {discoveryState.applyErrorMessage && (
                  <RunpuyCard theme={darkTheme} style={styles.errorSurface}>
                    <RunpuyText theme={darkTheme} variant="title" style={styles.errorText}>
                      Couldn&apos;t apply replacement
                    </RunpuyText>
                    <RunpuyText theme={darkTheme} variant="body" style={styles.errorText}>
                      {discoveryState.applyErrorMessage}
                    </RunpuyText>
                  </RunpuyCard>
                )}

                {shouldShowReplacementWarning && (
                  <RunpuyCard theme={darkTheme} style={styles.warningSurface}>
                    <RunpuyText theme={darkTheme} variant="title" style={styles.warningText}>
                      Replacement warning
                    </RunpuyText>
                    <RunpuyText theme={darkTheme} variant="body" style={styles.warningText}>
                      {getReplacementWarningMessage()}
                    </RunpuyText>
                  </RunpuyCard>
                )}

                {recommendedReplacement && (
                  <View style={styles.candidateSection}>
                    <RunpuyText theme={darkTheme} variant="title">
                      Recommended
                    </RunpuyText>
                    <RunpuySelectableCard
                      accessibilityLabel={`Select recommended replacement ${recommendedReplacement.nameFa}`}
                      description={getCandidateEquipmentLabel(recommendedReplacement.equipmentAvailabilityStatus)}
                      disabled={isApplyPending}
                      label={recommendedReplacement.nameFa}
                      onPress={() => selectReplacementCandidate(recommendedReplacement.exerciseId)}
                      selected={discoveryState.selectedCandidateExerciseId === recommendedReplacement.exerciseId}
                      script="persianArabic"
                      selectionRole="radio"
                      theme={darkTheme}
                    />
                    {recommendedReplacement.reasonCodes.includes("REPLACEMENT_INTEGRITY_WARNING") && (
                      <RunpuyText theme={darkTheme} variant="caption" style={styles.warningText}>
                        {getReplacementWarningMessage()}
                      </RunpuyText>
                    )}
                    {discoveryState.selectedCandidateExerciseId === recommendedReplacement.exerciseId && (
                      <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                        Selected locally only. Your workout has not changed.
                      </RunpuyText>
                    )}
                  </View>
                )}

                {discoveryState.recommendations.alternatives.length > 0 && (
                  <View style={styles.candidateSection}>
                    <RunpuyText theme={darkTheme} variant="title">
                      Alternatives
                    </RunpuyText>
                    {discoveryState.recommendations.alternatives.map((candidate) => (
                      <View key={candidate.exerciseId} style={styles.candidateSelection}>
                        <RunpuySelectableCard
                          accessibilityLabel={`Select replacement alternative ${candidate.nameFa}`}
                          description={getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                          disabled={isApplyPending}
                          label={candidate.nameFa}
                          onPress={() => selectReplacementCandidate(candidate.exerciseId)}
                          selected={discoveryState.selectedCandidateExerciseId === candidate.exerciseId}
                          script="persianArabic"
                          selectionRole="radio"
                          theme={darkTheme}
                        />
                        {discoveryState.selectedCandidateExerciseId === candidate.exerciseId && (
                          <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                            Selected locally only. Your workout has not changed.
                          </RunpuyText>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {discoveryState.recommendations.contextRejectedCandidates.length > 0 && (
                  <View style={styles.candidateSection}>
                    <RunpuyText theme={darkTheme} variant="title">
                      Not available right now
                    </RunpuyText>
                    {discoveryState.recommendations.contextRejectedCandidates.map((candidate) => (
                      <RunpuyCard key={candidate.exerciseId} theme={darkTheme} style={styles.candidateCard}>
                        <RunpuyText script="persianArabic" theme={darkTheme} variant="body">
                          {candidate.nameFa}
                        </RunpuyText>
                        <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                          {getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                        </RunpuyText>
                      </RunpuyCard>
                    ))}
                  </View>
                )}

                <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                  Your workout only changes after you apply the selected replacement.
                </RunpuyText>

                <RunpuyButton
                  accessibilityState={{ busy: isApplyPending }}
                  disabled={!discoveryState.selectedCandidateExerciseId || isApplyPending}
                  label={isApplyPending ? "Applying replacement..." : "Apply selected replacement"}
                  onPress={applySelectedReplacement}
                  theme={darkTheme}
                />
                <RunpuyButton
                  disabled={isApplyPending}
                  label="Change options"
                  onPress={reopenReplacementContext}
                  theme={darkTheme}
                />
                <Pressable
                  onPress={closeReplacementDiscovery}
                  accessibilityRole="button"
                  accessibilityLabel="Done with replacement discovery"
                  accessibilityState={{ disabled: isApplyPending }}
                  disabled={isApplyPending}
                  style={styles.secondaryAction}
                >
                  <RunpuyText theme={darkTheme} variant="body">
                    Done
                  </RunpuyText>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Fixed-position rest timer bar */}
      {activeRestExerciseId !== null && (
        <View style={styles.restTimer}>
          <View>
            <RunpuyText script="persianArabic" theme={darkTheme} tone="secondary" variant="caption">
              Resting · {activeRestExercise?.exercise?.nameFa}
            </RunpuyText>
            <RunpuyText theme={darkTheme} variant="heading">
              {restSecondsRemaining > 0 ? formatTime(restSecondsRemaining) : "Rest complete!"}
            </RunpuyText>
          </View>
          <View style={styles.restActions}>
            {restSecondsRemaining > 0 && (
              <Pressable
                onPress={() => setIsRestRunning((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={isRestRunning ? "Pause rest timer" : "Start rest timer"}
                style={styles.restPrimaryAction}
              >
                <RunpuyText theme={darkTheme} variant="caption" style={styles.restPrimaryActionText}>
                  {isRestRunning ? "Pause" : "Start"}
                </RunpuyText>
              </Pressable>
            )}
            <Pressable
              onPress={clearRestTimer}
              accessibilityRole="button"
              accessibilityLabel="Skip rest timer"
              style={styles.restSecondaryAction}
            >
              <RunpuyText theme={darkTheme} variant="caption">
                Skip
              </RunpuyText>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, activeRestExerciseId !== null && styles.contentWithRestTimer]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <RunpuyText theme={darkTheme} tone="secondary" variant="body">
            {`\u2190 Back`}
          </RunpuyText>
        </Pressable>

        {/* Session header */}
        <View style={styles.sessionHeader}>
          <RunpuyText accessibilityRole="header" theme={darkTheme} variant="heading">
            {dayName} {`\u2014`} {buildWorkoutName(exercises)}
          </RunpuyText>
          <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
            {programName}
          </RunpuyText>
          {replacementSuccessMessage && (
            <RunpuyStatusChip label={replacementSuccessMessage} status="success" theme={darkTheme} />
          )}
          {!activeReplacementTargetAvailable && (
            <RunpuyStatusChip label={getReplacementUnavailableMessage()} status="warning" theme={darkTheme} />
          )}
        </View>

        {totalLoggedSets === 0 && (
          <RunpuyCard theme={darkTheme} style={styles.zeroLogPrompt}>
            <RunpuyText theme={darkTheme} tone="secondary" variant="body">
              Start by logging your first set
            </RunpuyText>
          </RunpuyCard>
        )}

        {exercises.map((pde: any) => {
          const exerciseId = pde.exercise.id;
          const input = getInput(exerciseId);
          const sets = loggedSets[exerciseId] || [];
          const error = errors[exerciseId];
          const isLast = lastLoggedExerciseId === exerciseId;
          const showLoggedFeedback = !!justLogged[exerciseId];
          const isBodyweight = pde.exercise.equipment === "bodyweight";
          const validForLog = isInputValid(exerciseId, isBodyweight);

          return (
            <RunpuyCard
              key={pde.id}
              theme={darkTheme}
              style={[styles.exerciseCard, isLast && styles.lastLoggedExerciseCard]}
            >
              {/* Exercise header */}
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderRow}>
                  <View style={styles.exerciseDetails}>
                    <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                      Suggested: {pde.sets} × {pde.repRangeLow}-{pde.repRangeHigh} reps
                    </RunpuyText>
                    <RunpuyText script="persianArabic" theme={darkTheme} variant="title">
                      {pde.exercise.nameFa}
                    </RunpuyText>
                    <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                      Target: {pde.sets} x {pde.repRangeLow}-{pde.repRangeHigh} · Rest: {pde.restSeconds}s
                    </RunpuyText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Replace ${pde.exercise.nameFa}`}
                    onPress={() => openReplacementDiscovery(pde)}
                    disabled={pde.targetId === null}
                    accessibilityState={{ disabled: pde.targetId === null }}
                    style={styles.replaceButton}
                  >
                    <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                      Replace
                    </RunpuyText>
                  </Pressable>
                </View>
                {pde.targetId === null && (
                  <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
                    Replacement suggestions are unavailable for this exercise in the current session view.
                  </RunpuyText>
                )}
              </View>

              {/* Logged sets — visually distinct */}
              {sets.length > 0 && (
                <View style={styles.loggedSets}>
                  {sets.map((s) => (
                    <RunpuyText key={s.id} theme={darkTheme} tone="secondary" variant="caption">
                      Set {s.setNumber} — {s.reps} reps{s.weightKg !== null ? ` @ ${s.weightKg}kg` : ""}
                    </RunpuyText>
                  ))}
                </View>
              )}

              {/* Input row */}
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="Weight (kg)"
                  placeholderTextColor={darkTheme.colors.textSecondary}
                  keyboardType="numeric"
                  value={input.weightKg}
                  onChangeText={(v) => setInput(exerciseId, "weightKg", v)}
                  accessibilityLabel={`Weight in kilograms for ${pde.exercise.nameFa}`}
                  style={[styles.input, styles.weightInput]}
                />
                <TextInput
                  placeholder="Reps"
                  placeholderTextColor={darkTheme.colors.textSecondary}
                  keyboardType="numeric"
                  value={input.reps}
                  onChangeText={(v) => setInput(exerciseId, "reps", v)}
                  accessibilityLabel={`Reps for ${pde.exercise.nameFa}`}
                  style={[styles.input, styles.repsInput]}
                />
                <RunpuyButton
                  onPress={() => onLogSet(exerciseId, pde.restSeconds, isBodyweight)}
                  disabled={logSetMutation.isPending || !validForLog}
                  accessibilityState={{ busy: logSetMutation.isPending }}
                  label="Log Set"
                  theme={darkTheme}
                />
              </View>

              {showLoggedFeedback && (
                <RunpuyText theme={darkTheme} variant="caption" style={styles.successText}>
                  {"\u2713"} Logged
                </RunpuyText>
              )}
              {error ? (
                <RunpuyText accessibilityLiveRegion="polite" theme={darkTheme} variant="caption" style={styles.errorText}>
                  {error}
                </RunpuyText>
              ) : null}
            </RunpuyCard>
          );
        })}

        <View style={styles.finishSection}>
          <RunpuyButton
            onPress={onFinishPress}
            disabled={finishMutation.isPending}
            accessibilityState={{ busy: finishMutation.isPending }}
            label={
              finishMutation.isPending ? "Finishing..." : finishArmed ? "Tap again to confirm" : "Finish Workout"
            }
            theme={darkTheme}
          />
          {finishError ? (
            <RunpuyText accessibilityLiveRegion="polite" theme={darkTheme} variant="body" style={styles.errorText}>
              {finishError}
            </RunpuyText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: darkTheme.colors.canvas,
    flex: 1,
  },
  restTimer: {
    alignItems: "center",
    backgroundColor: darkTheme.colors.card,
    borderBottomColor: darkTheme.colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    paddingBottom: spacing.md,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.md,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  restActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  restPrimaryAction: {
    alignItems: "center",
    backgroundColor: darkTheme.colors.actionPrimary,
    borderRadius: radii.control,
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  restPrimaryActionText: {
    color: darkTheme.colors.actionPrimaryText,
  },
  restSecondaryAction: {
    alignItems: "center",
    borderColor: darkTheme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: 40,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.lg,
  },
  contentWithRestTimer: {
    paddingTop: 96,
  },
  backButton: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
  },
  sessionHeader: {
    gap: spacing.xs,
  },
  zeroLogPrompt: {
    padding: spacing.md,
  },
  exerciseCard: {
    gap: spacing.md,
  },
  lastLoggedExerciseCard: {
    borderColor: darkTheme.colors.focus,
    borderWidth: 2,
  },
  exerciseHeader: {
    gap: spacing.sm,
  },
  exerciseHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  exerciseDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  replaceButton: {
    alignItems: "center",
    borderColor: darkTheme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  loggedSets: {
    borderColor: darkTheme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    borderColor: darkTheme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    color: darkTheme.colors.textPrimary,
    fontFamily: runpuyFontFamilies.latin.body,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  weightInput: {
    width: 100,
  },
  repsInput: {
    width: 70,
  },
  successText: {
    color: darkTheme.colors.success,
  },
  errorText: {
    color: darkTheme.colors.error,
  },
  finishSection: {
    borderTopColor: darkTheme.colors.borderSubtle,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: darkTheme.colors.canvas,
    borderColor: darkTheme.colors.borderSubtle,
    borderTopLeftRadius: radii.insight,
    borderTopRightRadius: radii.insight,
    borderWidth: 1,
    gap: spacing.md,
    maxHeight: "85%",
    paddingBottom: spacing['2xl'],
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.xl,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  modalHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  modalCloseButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  modalScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  equipmentSection: {
    gap: spacing.sm,
  },
  loadingState: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  modalActionStack: {
    gap: spacing.sm,
  },
  secondaryAction: {
    alignItems: "center",
    borderColor: darkTheme.colors.borderSubtle,
    borderRadius: radii.button,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  errorSurface: {
    borderColor: darkTheme.colors.error,
    gap: spacing.sm,
  },
  noReplacementSurface: {
    gap: spacing.sm,
  },
  warningSurface: {
    borderColor: darkTheme.colors.warning,
    gap: spacing.sm,
  },
  warningText: {
    color: darkTheme.colors.warning,
  },
  candidateSection: {
    gap: spacing.sm,
  },
  candidateCard: {
    gap: spacing.xs,
  },
  candidateSelection: {
    gap: spacing.xs,
  },
});
