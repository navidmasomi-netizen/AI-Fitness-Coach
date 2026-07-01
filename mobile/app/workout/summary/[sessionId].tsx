import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "../../../src/api/sessions";
import { getSessionProgressions } from "../../../src/api/progressions";
import { ProgressionRecommendation, RecommendationType } from "../../../src/types/progression";
import { getMyCompletedSessions } from "../../../src/api/sessions";
import { useAuthStore } from "../../../src/store/authStore";
import { getLastSetForExercise, getTrend, trendArrow, comparisonText, findPreviousSession } from "../../../src/utils/compareSets";
import { buildWorkoutName } from "../../../src/utils/workoutMeta";

function recommendationColor(type: RecommendationType) {
  if (type === "increase") return { bg: "#e8f5e9", text: "#2e7d32", label: "Increase" };
  if (type === "deload") return { bg: "#ffebee", text: "#c62828", label: "Deload" };
  return { bg: "#f5f5f5", text: "#555", label: "Maintain" };
}

function contextLine(rec: ProgressionRecommendation): string | null {
  if (rec.recommendationType === "increase" && rec.previousWeightKg !== null && rec.recommendedWeightKg !== null) {
    return `Last session: ${rec.previousWeightKg}kg → Now: ${rec.recommendedWeightKg}kg`;
  }
  if (rec.recommendationType === "maintain" && rec.consecutiveFailures > 0) {
    return `This is attempt #${rec.consecutiveFailures + 1} at this weight`;
  }
  if (rec.recommendationType === "deload" && rec.previousWeightKg !== null && rec.recommendedWeightKg !== null) {
    return `Reduced from ${rec.previousWeightKg}kg after 2 sessions without progress`;
  }
  return null;
}

const REINFORCEMENT_MESSAGES = [
  "Great work — next session is ready.",
  "You're progressing consistently.",
  "Solid session. Your next workout is already set up.",
];

function buildReinforcement(sessionId: number): string {
  return REINFORCEMENT_MESSAGES[sessionId % REINFORCEMENT_MESSAGES.length];
}

function buildInsight(recommendations: ProgressionRecommendation[]): string {
  const evaluable = recommendations.filter((r) => r.reason !== "No sets were logged for this exercise; cannot evaluate progression.");
  if (evaluable.length === 0) {
    return "No progress data yet — log sets to start tracking.";
  }
  const increases = evaluable.filter((r) => r.recommendationType === "increase").length;
  const deloads = evaluable.filter((r) => r.recommendationType === "deload").length;
  const maintains = evaluable.filter((r) => r.recommendationType === "maintain").length;

  if (increases > 0 && deloads === 0) {
    return `You increased weight in ${increases} exercise${increases > 1 ? "s" : ""} today.`;
  }
  if (deloads > 0) {
    return `${deloads} exercise${deloads > 1 ? "s" : ""} needed a deload — that's normal, keep going.`;
  }
  if (maintains > 0 && increases === 0) {
    return `${maintains} exercise${maintains > 1 ? "s" : ""} need${maintains === 1 ? "s" : ""} another attempt before progression.`;
  }
  return "No progress this session — consistency matters.";
}

export default function WorkoutSummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const numericSessionId = Number(sessionId);
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sessionSummary", numericSessionId],
    queryFn: () => getSession(numericSessionId),
    enabled: !Number.isNaN(numericSessionId),
  });

  const {
    data: progressions,
    isLoading: isProgressionsLoading,
    isError: isProgressionsError,
  } = useQuery({
    queryKey: ["sessionProgressions", numericSessionId],
    queryFn: () => getSessionProgressions(numericSessionId),
    enabled: !Number.isNaN(numericSessionId),
  });

  const { data: completedSessions } = useQuery({
    queryKey: ["completedSessions"],
    queryFn: () => getMyCompletedSessions(user!.id),
    enabled: !!user,
  });

  const previousSession = findPreviousSession(completedSessions, numericSessionId);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "red" }}>{(error as Error)?.message || "Failed to load summary"}</Text>
      </View>
    );
  }

  const { session, program, programDay } = data;
  const setLogs = session.setLogs || [];

  const byExercise: Record<number, { name: string; sets: typeof setLogs }> = {};
  for (const log of setLogs) {
    const exId = log.exerciseId;
    if (!byExercise[exId]) {
      byExercise[exId] = { name: log.exercise?.nameFa || `Exercise ${exId}`, sets: [] };
    }
    byExercise[exId].sets.push(log);
  }

  const totalExercisesLogged = Object.keys(byExercise).length;
  const totalSets = setLogs.length;

  return (
    <ScrollView style={{ flex: 1, padding: 20, paddingTop: 60 }}>
      <Pressable onPress={() => router.replace("/(tabs)")} style={{ marginBottom: 16 }}>
        <Text>{`\u2190 Home`}</Text>
      </Pressable>

      <Text style={{ fontSize: 22, fontWeight: "bold" }}>Workout Summary</Text>
      <Text style={{ fontSize: 15, color: "#555" }}>
        {programDay?.name || ""} {programDay ? `\u2014` : ""} {buildWorkoutName(
          Object.values(byExercise).length > 0
            ? setLogs
                .filter((log, idx, arr) => arr.findIndex((l) => l.exerciseId === log.exerciseId) === idx)
                .map((log) => ({ exercise: log.exercise }))
            : []
        )}
      </Text>
      <Text style={{ fontSize: 12, color: "#999" }}>Session #{session.id}</Text>
      <Text>Status: {session.status}</Text>
      {session.completedAt && <Text>Completed at: {new Date(session.completedAt).toLocaleString()}</Text>}
      {program && <Text>Program: {program.name}</Text>}
      {programDay && <Text>Day: {programDay.name}</Text>}

      {/* Progress insight — deterministic one-liner */}
      {!isProgressionsLoading && !isProgressionsError && progressions && (
        <View style={{ backgroundColor: "#eef6ff", borderRadius: 8, padding: 12, marginTop: 14 }}>
          <Text style={{ fontSize: 13, color: "#1565c0" }}>{buildInsight(progressions)}</Text>
        </View>
      )}

      {/* Completion reinforcement + soft urgency — local, no backend, no streak wording */}
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontSize: 13, color: "#2e7d32" }}>{buildReinforcement(numericSessionId)}</Text>
        <Text style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Try to train again within 48 hours.</Text>
      </View>

      <View style={{ marginTop: 16, marginBottom: 16 }}>
        <Text style={{ fontWeight: "bold" }}>Total exercises logged: {totalExercisesLogged}</Text>
        <Text style={{ fontWeight: "bold" }}>Total sets: {totalSets}</Text>
      </View>

      {Object.entries(byExercise).map(([exId, group]) => (
        <View key={exId} style={{ marginBottom: 16, borderTopWidth: 1, paddingTop: 10 }}>
          <Text style={{ fontWeight: "600", fontSize: 16 }}>{group.name}</Text>
          {group.sets.map((s) => (
            <Text key={s.id}>
              Set {s.setNumber}: {s.reps} reps{s.weightKg !== null ? ` @ ${s.weightKg}kg` : ""}
            </Text>
          ))}
        </View>
      ))}

      {/* Progression recommendations — secondary section, below workout data */}
      <View style={{ marginTop: 28, borderTopWidth: 2, borderTopColor: "#eee", paddingTop: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 10, color: "#444" }}>
          Next Session Recommendations
        </Text>

        {isProgressionsLoading && <Text style={{ fontSize: 13, color: "#999" }}>Loading recommendations...</Text>}
        {isProgressionsError && (
          <Text style={{ fontSize: 13, color: "#c62828" }}>Could not load recommendations.</Text>
        )}
        {!isProgressionsLoading && !isProgressionsError && (!progressions || progressions.length === 0) && (
          <Text style={{ fontSize: 13, color: "#999" }}>No recommendations yet</Text>
        )}

        {progressions && progressions.length > 0 && progressions.map((rec) => {
          const colors = recommendationColor(rec.recommendationType);
          const context = contextLine(rec);
          return (
            <View
              key={rec.id}
              style={{
                backgroundColor: colors.bg,
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600" }}>{rec.exercise.nameFa}</Text>
                <Text style={{ color: colors.text, fontWeight: "bold", fontSize: 12 }}>{colors.label}</Text>
              </View>
              {rec.previousWeightKg !== null && rec.recommendedWeightKg !== null && (
                <Text style={{ fontSize: 13, marginTop: 4 }}>
                  {rec.previousWeightKg}kg → {rec.recommendedWeightKg}kg
                </Text>
              )}
              {rec.recommendedTargetLow !== null && rec.recommendedTargetHigh !== null && (
                <Text style={{ fontSize: 13 }}>
                  Target: {rec.recommendedTargetLow}-{rec.recommendedTargetHigh}
                </Text>
              )}
              {context && <Text style={{ fontSize: 12, color: colors.text, marginTop: 4, fontStyle: "italic" }}>{context}</Text>}
              {(() => {
                const currentLastSet = getLastSetForExercise(session, rec.exerciseId);
                const previousLastSet = getLastSetForExercise(previousSession, rec.exerciseId);
                if (!currentLastSet || !previousLastSet) return null;
                const trend = getTrend(currentLastSet, previousLastSet);
                return (
                  <Text style={{ fontSize: 12, color: "#444", marginTop: 4 }}>
                    {trendArrow(trend)} {comparisonText(currentLastSet, previousLastSet)}
                  </Text>
                );
              })()}
              <Text style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{rec.reason}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
