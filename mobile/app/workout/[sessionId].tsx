import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../src/api/client";
import { addSetLog, completeSession, getActiveSession } from "../../src/api/sessions";
import { applyReplacementSelection, getReplacementRecommendations } from "../../src/api/replacements";
import { buildWorkoutName } from "../../src/utils/workoutMeta";
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
import { RunpuyButton, RunpuyCard, RunpuyText } from "../../src/design-system/components";
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
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              maxHeight: "85%",
              backgroundColor: "white",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 26,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "700" }}>Replace Exercise</Text>
                {discoveryState.exercise && (
                  <Text style={{ color: "#666", marginTop: 4 }}>
                    {getExerciseDisplayName(discoveryState.exercise.exercise)}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={closeReplacementDiscovery}
                accessibilityLabel="Close replacement discovery"
                disabled={isApplyPending}
              >
                <Text style={{ fontSize: 16, color: "#666" }}>Close</Text>
              </Pressable>
            </View>

            {discoveryState.status === "COLLECTING_CONTEXT" && (
              <ScrollView>
                <Text style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
                  Why do you want to replace this exercise?
                </Text>
                {REPLACEMENT_DISCOVERY_REASON_OPTIONS.map((option) => {
                  const selected = discoveryState.intentType === option.intentType;
                  return (
                    <Pressable
                      key={option.intentType}
                      accessibilityRole="button"
                      accessibilityLabel={`Replacement reason: ${option.label}`}
                      onPress={() => setDiscoveryIntentType(option.intentType)}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? "#2196f3" : "#d7d7d7",
                        backgroundColor: selected ? "#e3f2fd" : "white",
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontWeight: "600", marginBottom: 4 }}>{option.label}</Text>
                      <Text style={{ color: "#666", fontSize: 13 }}>{option.helperText}</Text>
                    </Pressable>
                  );
                })}

                {discoveryState.intentType === "NO_EQUIPMENT" && (
                  <View
                    style={{
                      marginTop: 8,
                      marginBottom: 12,
                      padding: 14,
                      borderRadius: 10,
                      backgroundColor: "#f7f8fa",
                      borderWidth: 1,
                      borderColor: "#eceff3",
                    }}
                  >
                    <Text style={{ fontWeight: "600", marginBottom: 6 }}>Available equipment right now</Text>
                    <Text style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>
                      Select only what is actually available in this session. Bodyweight is handled automatically.
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {REPLACEMENT_DISCOVERY_EQUIPMENT_OPTIONS.map((option) => {
                        const selected = discoveryState.availableEquipment.includes(option.value);
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            accessibilityLabel={`Toggle available equipment ${option.label}`}
                            onPress={() => toggleDiscoveryEquipment(option.value)}
                            style={{
                              borderWidth: 1,
                              borderColor: selected ? "#2196f3" : "#d7d7d7",
                              backgroundColor: selected ? "#e3f2fd" : "white",
                              borderRadius: 999,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                            }}
                          >
                            <Text style={{ color: selected ? "#1565c0" : "#444" }}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={loadReplacementRecommendations}
                  disabled={!discoveryState.intentType || isApplyPending}
                  style={{
                    marginTop: 8,
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: discoveryState.intentType && !isApplyPending ? "#2196f3" : "#bbdefb",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Find replacements</Text>
                </Pressable>
              </ScrollView>
            )}

            {discoveryState.status === "LOADING_RECOMMENDATIONS" && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="large" />
                <Text style={{ color: "#666", marginTop: 12 }}>Loading replacement suggestions...</Text>
              </View>
            )}

            {discoveryState.status === "ERROR" && (
              <View>
                <View
                  style={{
                    backgroundColor: "#ffebee",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ color: "#b71c1c", fontWeight: "600", marginBottom: 6 }}>Couldn&apos;t load replacements</Text>
                  <Text style={{ color: "#b71c1c" }}>
                    {discoveryState.errorMessage || "Something went wrong while loading replacements."}
                  </Text>
                </View>
                <Pressable
                  onPress={reopenReplacementContext}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#2196f3",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Try again</Text>
                </Pressable>
                <Pressable
                  onPress={closeReplacementDiscovery}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#eceff3",
                  }}
                >
                  <Text style={{ color: "#333", fontWeight: "700" }}>Dismiss</Text>
                </Pressable>
              </View>
            )}

            {discoveryState.status === "NO_REPLACEMENT" && (
              <ScrollView>
                <View
                  style={{
                    backgroundColor: "#f5f5f5",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontWeight: "600", marginBottom: 6 }}>No replacement available</Text>
                  <Text style={{ color: "#555" }}>{getNoReplacementMessage()}</Text>
                </View>

                {discoveryState.recommendations?.contextRejectedCandidates.length ? (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontWeight: "600", marginBottom: 8 }}>Not available right now</Text>
                    {discoveryState.recommendations.contextRejectedCandidates.map((candidate) => (
                      <View
                        key={candidate.exerciseId}
                        style={{
                          borderWidth: 1,
                          borderColor: "#eceff3",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontWeight: "600" }}>{candidate.nameFa}</Text>
                        <Text style={{ color: "#666", marginTop: 4 }}>
                          {getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable
                  onPress={reopenReplacementContext}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#2196f3",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Change options</Text>
                </Pressable>
                <Pressable
                  onPress={closeReplacementDiscovery}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#eceff3",
                  }}
                >
                  <Text style={{ color: "#333", fontWeight: "700" }}>Done</Text>
                </Pressable>
              </ScrollView>
            )}

            {discoveryState.status === "RESULTS" && discoveryState.recommendations && (
              <ScrollView>
                {discoveryState.applyErrorMessage && (
                  <View
                    style={{
                      backgroundColor: "#ffebee",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ color: "#b71c1c", fontWeight: "600", marginBottom: 6 }}>
                      Couldn&apos;t apply replacement
                    </Text>
                    <Text style={{ color: "#b71c1c" }}>{discoveryState.applyErrorMessage}</Text>
                  </View>
                )}

                {shouldShowReplacementWarning && (
                  <View
                    style={{
                      backgroundColor: "#fff8e1",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ fontWeight: "600", marginBottom: 6, color: "#7a5a00" }}>
                      Replacement warning
                    </Text>
                    <Text style={{ color: "#7a5a00" }}>{getReplacementWarningMessage()}</Text>
                  </View>
                )}

                {recommendedReplacement && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontWeight: "700", marginBottom: 8 }}>Recommended</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select recommended replacement ${recommendedReplacement.nameFa}`}
                      onPress={() => selectReplacementCandidate(recommendedReplacement.exerciseId)}
                      disabled={isApplyPending}
                      style={{
                        borderWidth: 2,
                        borderColor:
                          discoveryState.selectedCandidateExerciseId === recommendedReplacement.exerciseId
                            ? "#2196f3"
                            : "#d7d7d7",
                        borderRadius: 12,
                        padding: 14,
                        backgroundColor:
                          discoveryState.selectedCandidateExerciseId === recommendedReplacement.exerciseId
                            ? "#e3f2fd"
                            : "white",
                      }}
                    >
                      <Text style={{ fontWeight: "700", fontSize: 16 }}>{recommendedReplacement.nameFa}</Text>
                      <Text style={{ color: "#666", marginTop: 4 }}>
                        {getCandidateEquipmentLabel(recommendedReplacement.equipmentAvailabilityStatus)}
                      </Text>
                      {recommendedReplacement.reasonCodes.includes("REPLACEMENT_INTEGRITY_WARNING") && (
                        <Text style={{ color: "#7a5a00", marginTop: 6 }}>{getReplacementWarningMessage()}</Text>
                      )}
                      {discoveryState.selectedCandidateExerciseId === recommendedReplacement.exerciseId && (
                        <Text style={{ color: "#1565c0", marginTop: 8, fontWeight: "600" }}>
                          Selected locally only. Your workout has not changed.
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {discoveryState.recommendations.alternatives.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontWeight: "700", marginBottom: 8 }}>Alternatives</Text>
                    {discoveryState.recommendations.alternatives.map((candidate) => (
                      <Pressable
                        key={candidate.exerciseId}
                        accessibilityRole="button"
                        accessibilityLabel={`Select replacement alternative ${candidate.nameFa}`}
                        onPress={() => selectReplacementCandidate(candidate.exerciseId)}
                        disabled={isApplyPending}
                        style={{
                          borderWidth: 1,
                          borderColor:
                            discoveryState.selectedCandidateExerciseId === candidate.exerciseId
                              ? "#2196f3"
                              : "#d7d7d7",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 8,
                          backgroundColor:
                            discoveryState.selectedCandidateExerciseId === candidate.exerciseId
                              ? "#e3f2fd"
                              : "white",
                        }}
                      >
                        <Text style={{ fontWeight: "600" }}>{candidate.nameFa}</Text>
                        <Text style={{ color: "#666", marginTop: 4 }}>
                          {getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                        </Text>
                        {discoveryState.selectedCandidateExerciseId === candidate.exerciseId && (
                          <Text style={{ color: "#1565c0", marginTop: 8, fontWeight: "600" }}>
                            Selected locally only. Your workout has not changed.
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}

                {discoveryState.recommendations.contextRejectedCandidates.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontWeight: "700", marginBottom: 8 }}>Not available right now</Text>
                    {discoveryState.recommendations.contextRejectedCandidates.map((candidate) => (
                      <View
                        key={candidate.exerciseId}
                        style={{
                          borderWidth: 1,
                          borderColor: "#eceff3",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 8,
                          backgroundColor: "#fafafa",
                        }}
                      >
                        <Text style={{ fontWeight: "600" }}>{candidate.nameFa}</Text>
                        <Text style={{ color: "#666", marginTop: 4 }}>
                          {getCandidateEquipmentLabel(candidate.equipmentAvailabilityStatus)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={{ color: "#666", marginBottom: 14 }}>
                  Your workout only changes after you apply the selected replacement.
                </Text>

                <Pressable
                  onPress={applySelectedReplacement}
                  disabled={!discoveryState.selectedCandidateExerciseId || isApplyPending}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor:
                      discoveryState.selectedCandidateExerciseId && !isApplyPending ? "#2e7d32" : "#a5d6a7",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {isApplyPending ? "Applying replacement..." : "Apply selected replacement"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={reopenReplacementContext}
                  disabled={isApplyPending}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#2196f3",
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Change options</Text>
                </Pressable>
                <Pressable
                  onPress={closeReplacementDiscovery}
                  disabled={isApplyPending}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: "#eceff3",
                  }}
                >
                  <Text style={{ color: "#333", fontWeight: "700" }}>Done</Text>
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
            <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
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
            <View style={{ backgroundColor: "#e8f5e9", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: "#2e7d32", fontWeight: "600" }}>{replacementSuccessMessage}</Text>
            </View>
          )}
          {!activeReplacementTargetAvailable && (
            <View style={{ backgroundColor: "#fff3e0", borderRadius: 8, padding: 12 }}>
              <Text style={{ color: "#7a5a00" }}>{getReplacementUnavailableMessage()}</Text>
            </View>
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
                    <RunpuyText theme={darkTheme} variant="title">
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
                  <Text style={{ color: "#999", fontSize: 12, marginTop: 6 }}>
                    Replacement suggestions are unavailable for this exercise in the current session view.
                  </Text>
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
});
