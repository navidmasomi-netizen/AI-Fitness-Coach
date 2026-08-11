import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSetLog, completeSession } from "../../src/api/sessions";
import { getReplacementRecommendations } from "../../src/api/replacements";
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
  getNoReplacementMessage,
  getReplacementUnavailableMessage,
  getReplacementWarningMessage,
  mergeWorkoutExercisesWithTargets,
  type ReplacementDiscoveryStatus,
} from "../../src/utils/replacementDiscovery";

interface LoggedSet {
  id: number;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

type WorkoutExerciseWithTarget = ProgramDayExercise & { targetId: number | null };

interface ReplacementDiscoveryState {
  status: ReplacementDiscoveryStatus;
  exercise: WorkoutExerciseWithTarget | null;
  intentType: ReplacementIntentType | null;
  availableEquipment: CatalogEquipment[];
  recommendations: ReplacementRecommendationResponse | null;
  selectedCandidateExerciseId: number | null;
  errorMessage: string | null;
}

const INITIAL_DISCOVERY_STATE: ReplacementDiscoveryState = {
  status: "IDLE",
  exercise: null,
  intentType: null,
  availableEquipment: [],
  recommendations: null,
  selectedCandidateExerciseId: null,
  errorMessage: null,
};

function getExerciseDisplayName(exercise: { nameFa: string; nameEn: string | null }) {
  return exercise.nameFa || exercise.nameEn || `Exercise ${exercise}`;
}

function getCandidateEquipmentLabel(status: ReplacementCandidateSummary["equipmentAvailabilityStatus"]) {
  if (status === "AVAILABLE") return "Equipment available";
  if (status === "UNAVAILABLE") return "Not available with current equipment";
  if (status === "METADATA_UNAVAILABLE") return "Equipment details unavailable";
  return "Equipment not checked";
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
  const exercises = useMemo<WorkoutExerciseWithTarget[]>(
    () => mergeWorkoutExercisesWithTargets(baseExercises, routeExerciseTargets.length > 0 ? routeExerciseTargets : cachedExerciseTargets),
    [baseExercises, cachedExerciseTargets, routeExerciseTargets]
  );

  const [inputs, setInputs] = useState<Record<number, { reps: string; weightKg: string }>>({});
  const [loggedSets, setLoggedSets] = useState<Record<number, LoggedSet[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [justLogged, setJustLogged] = useState<Record<number, boolean>>({});
  const [lastLoggedExerciseId, setLastLoggedExerciseId] = useState<number | null>(null);
  const [finishError, setFinishError] = useState("");
  const [finishArmed, setFinishArmed] = useState(false);
  const [discoveryState, setDiscoveryState] = useState<ReplacementDiscoveryState>(INITIAL_DISCOVERY_STATE);

  // --- Rest timer state ---
  const [activeRestExerciseId, setActiveRestExerciseId] = useState<number | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [isRestRunning, setIsRestRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!existingSetLogsData) return;
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(existingSetLogsData);
    } catch {
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const grouped: Record<number, LoggedSet[]> = {};
    for (const log of parsed) {
      const exId = log.exerciseId;
      if (!grouped[exId]) grouped[exId] = [];
      grouped[exId].push({ id: log.id, setNumber: log.setNumber, reps: log.reps, weightKg: log.weightKg });
    }
    for (const exId of Object.keys(grouped)) {
      grouped[Number(exId)].sort((a, b) => a.setNumber - b.setNumber);
    }
    setLoggedSets(grouped);
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
      intentType: ReplacementIntentType;
      availableEquipment: CatalogEquipment[];
    }) =>
      getReplacementRecommendations({
        sessionId: numericSessionId,
        targetId: params.targetId,
        context: buildReplacementContextInput(params.intentType, params.availableEquipment),
      }),
    onSuccess: (data) => {
      setDiscoveryState((previous) => ({
        ...previous,
        status:
          data.contextualDecisionStatus === "NO_CONTEXTUAL_REPLACEMENT" ? "NO_REPLACEMENT" : "RESULTS",
        recommendations: data,
        selectedCandidateExerciseId: data.recommendedReplacement?.exerciseId ?? null,
        errorMessage: null,
      }));
    },
    onError: (error: any) => {
      setDiscoveryState((previous) => ({
        ...previous,
        status: "ERROR",
        errorMessage: error.message || "Failed to load replacement suggestions",
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

    setDiscoveryState({
      status: "COLLECTING_CONTEXT",
      exercise,
      intentType: "PREFER_VARIATION",
      availableEquipment: [],
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
    });
  };

  const closeReplacementDiscovery = () => {
    replacementMutation.reset();
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

    setDiscoveryState((previous) => ({
      ...previous,
      status: "LOADING_RECOMMENDATIONS",
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
    }));

    replacementMutation.mutate({
      targetId: discoveryState.exercise.targetId,
      intentType: discoveryState.intentType,
      availableEquipment:
        discoveryState.intentType === "NO_EQUIPMENT" ? discoveryState.availableEquipment : [],
    });
  };

  const reopenReplacementContext = () => {
    setDiscoveryState((previous) => ({
      ...previous,
      status: "COLLECTING_CONTEXT",
      recommendations: null,
      selectedCandidateExerciseId: null,
      errorMessage: null,
    }));
  };

  const selectReplacementCandidate = (exerciseId: number) => {
    setDiscoveryState((previous) => ({
      ...previous,
      selectedCandidateExerciseId: exerciseId,
    }));
  };

  const activeRestExercise = exercises.find((pde: any) => pde.exercise.id === activeRestExerciseId);
  const recommendedReplacement = discoveryState.recommendations?.recommendedReplacement ?? null;
  const shouldShowReplacementWarning =
    discoveryState.recommendations?.contextualDecisionStatus === "RECOMMENDED_WITH_WARNING";

  return (
    <View style={{ flex: 1 }}>
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
              <Pressable onPress={closeReplacementDiscovery} accessibilityLabel="Close replacement discovery">
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
                  disabled={!discoveryState.intentType}
                  style={{
                    marginTop: 8,
                    paddingVertical: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    backgroundColor: discoveryState.intentType ? "#2196f3" : "#bbdefb",
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
                  Recommendations do not change your workout until a future apply step exists.
                </Text>

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
          </View>
        </View>
      </Modal>

      {/* Fixed-position rest timer bar */}
      {activeRestExerciseId !== null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            backgroundColor: "#fff3e0",
            paddingTop: 50,
            paddingBottom: 12,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: "#ffcc80",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 12, color: "#7a5a00" }}>Resting · {activeRestExercise?.exercise?.nameFa}</Text>
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>
              {restSecondsRemaining > 0 ? formatTime(restSecondsRemaining) : "Rest complete!"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {restSecondsRemaining > 0 && (
              <Pressable
                onPress={() => setIsRestRunning((prev) => !prev)}
                style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#2196f3", borderRadius: 6 }}
              >
                <Text style={{ color: "white", fontSize: 13 }}>{isRestRunning ? "Pause" : "Start"}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={clearRestTimer}
              style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#9e9e9e", borderRadius: 6 }}
            >
              <Text style={{ color: "white", fontSize: 13 }}>Skip</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: activeRestExerciseId !== null ? 110 : 60,
          paddingBottom: 40,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text>{`\u2190 Back`}</Text>
        </Pressable>

        {/* Session header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: "bold" }}>
            {dayName} {`\u2014`} {buildWorkoutName(exercises)}
          </Text>
          <Text style={{ fontSize: 13, color: "#999", marginBottom: 16 }}>{programName}</Text>
          {!activeReplacementTargetAvailable && (
            <View style={{ backgroundColor: "#fff3e0", borderRadius: 8, padding: 12 }}>
              <Text style={{ color: "#7a5a00" }}>{getReplacementUnavailableMessage()}</Text>
            </View>
          )}
        </View>

        {totalLoggedSets === 0 && (
          <View style={{ backgroundColor: "#e3f2fd", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <Text style={{ color: "#1565c0" }}>Start by logging your first set</Text>
          </View>
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
            <View
              key={pde.id}
              style={{
                marginBottom: 20,
                padding: 14,
                borderRadius: 10,
                borderWidth: isLast ? 2 : 1,
                borderColor: isLast ? "#2196f3" : "#ddd",
                backgroundColor: "#fff",
              }}
            >
              {/* Exercise header */}
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#999", marginBottom: 2 }}>
                      Suggested: {pde.sets} × {pde.repRangeLow}-{pde.repRangeHigh} reps
                    </Text>
                    <Text style={{ fontWeight: "700", fontSize: 17 }}>{pde.exercise.nameFa}</Text>
                    <Text style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                      Target: {pde.sets} x {pde.repRangeLow}-{pde.repRangeHigh} · Rest: {pde.restSeconds}s
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Replace ${pde.exercise.nameFa}`}
                    onPress={() => openReplacementDiscovery(pde)}
                    disabled={pde.targetId === null}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: pde.targetId === null ? "#eceff3" : "#e3f2fd",
                    }}
                  >
                    <Text style={{ color: pde.targetId === null ? "#7b8794" : "#1565c0", fontWeight: "600" }}>
                      Replace
                    </Text>
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
                <View style={{ backgroundColor: "#f1f8e9", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  {sets.map((s) => (
                    <Text key={s.id} style={{ color: "#33691e", fontSize: 14 }}>
                      Set {s.setNumber} — {s.reps} reps{s.weightKg !== null ? ` @ ${s.weightKg}kg` : ""}
                    </Text>
                  ))}
                </View>
              )}

              {/* Input row */}
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TextInput
                  placeholder="Weight (kg)"
                  keyboardType="numeric"
                  value={input.weightKg}
                  onChangeText={(v) => setInput(exerciseId, "weightKg", v)}
                  style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, width: 100 }}
                />
                <TextInput
                  placeholder="Reps"
                  keyboardType="numeric"
                  value={input.reps}
                  onChangeText={(v) => setInput(exerciseId, "reps", v)}
                  style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, width: 70 }}
                />
                <Pressable
                  onPress={() => onLogSet(exerciseId, pde.restSeconds, isBodyweight)}
                  disabled={logSetMutation.isPending || !validForLog}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: !validForLog ? "#bbdefb" : "#2196f3",
                    borderRadius: 6,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "600" }}>Log Set</Text>
                </Pressable>
              </View>

              {showLoggedFeedback && (
                <Text style={{ color: "#2e7d32", marginTop: 6, fontSize: 13 }}>{"\u2713"} Logged</Text>
              )}
              {error ? <Text style={{ color: "#c62828", marginTop: 6, fontSize: 13 }}>{error}</Text> : null}
            </View>
          );
        })}

        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 20 }}>
          <Pressable
            onPress={onFinishPress}
            disabled={finishMutation.isPending}
            style={{
              padding: 16,
              backgroundColor: finishArmed ? "#2e7d32" : "#4caf50",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
              {finishMutation.isPending
                ? "Finishing..."
                : finishArmed
                ? "Tap again to confirm"
                : "Finish Workout"}
            </Text>
          </Pressable>
          {finishError ? <Text style={{ color: "#c62828", marginTop: 8 }}>{finishError}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}
