import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addSetLog, completeSession } from "../../src/api/sessions";
import { buildWorkoutName } from "../../src/utils/workoutMeta";

interface LoggedSet {
  id: number;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WorkoutSessionScreen() {
  const { sessionId, programName, dayName, exercisesData, existingSetLogsData } = useLocalSearchParams<{
    sessionId: string;
    programName: string;
    dayName: string;
    exercisesData: string;
    existingSetLogsData?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericSessionId = Number(sessionId);

  const exercises = exercisesData ? JSON.parse(exercisesData) : [];

  const [inputs, setInputs] = useState<Record<number, { reps: string; weightKg: string }>>({});
  const [loggedSets, setLoggedSets] = useState<Record<number, LoggedSet[]>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [justLogged, setJustLogged] = useState<Record<number, boolean>>({});
  const [lastLoggedExerciseId, setLastLoggedExerciseId] = useState<number | null>(null);
  const [finishError, setFinishError] = useState("");
  const [finishArmed, setFinishArmed] = useState(false);

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
    onSuccess: () => {
      clearRestTimer();
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

  const totalLoggedSets = Object.values(loggedSets).reduce((sum, arr) => sum + arr.length, 0);

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

  const activeRestExercise = exercises.find((pde: any) => pde.exercise.id === activeRestExerciseId);

  return (
    <View style={{ flex: 1 }}>
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
                <Text style={{ fontSize: 12, color: "#999", marginBottom: 2 }}>
                  Suggested: {pde.sets} × {pde.repRangeLow}-{pde.repRangeHigh} reps
                </Text>
                <Text style={{ fontWeight: "700", fontSize: 17 }}>{pde.exercise.nameFa}</Text>
                <Text style={{ color: "#666", fontSize: 13, marginTop: 2 }}>
                  Target: {pde.sets} x {pde.repRangeLow}-{pde.repRangeHigh} · Rest: {pde.restSeconds}s
                </Text>
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
