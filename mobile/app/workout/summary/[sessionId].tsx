import { View, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CompleteSessionResponse, getSession } from "../../../src/api/sessions";
import { getSessionProgressions } from "../../../src/api/progressions";
import { ProgressionRecommendation, RecommendationType } from "../../../src/types/progression";
import { getMyCompletedSessions } from "../../../src/api/sessions";
import { useAuthStore } from "../../../src/store/authStore";
import { getLastSetForExercise, getTrend, trendArrow, comparisonText, findPreviousSession } from "../../../src/utils/compareSets";
import { buildWorkoutName } from "../../../src/utils/workoutMeta";
import {
  layout,
  RunpuyCard,
  RunpuyStatusChip,
  RunpuyText,
  spacing,
  type RunpuyStatus,
} from "../../../src/design-system";
import { useRunpuyTheme } from "../../../src/design-system/theme-context";

function recommendationColor(type: RecommendationType): { label: string; status: RunpuyStatus } {
  if (type === "increase") return { label: "Increase", status: "success" };
  if (type === "deload") return { label: "Deload", status: "error" };
  return { label: "Maintain", status: "neutral" };
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
  const { theme } = useRunpuyTheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericSessionId = Number(sessionId);
  const user = useAuthStore((s) => s.user);
  const freshCompletionResult =
    queryClient.getQueryData<CompleteSessionResponse>(["freshCompletionResult", numericSessionId]) ?? null;

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
  const displayedProgressions = freshCompletionResult?.progressionRecommendations ?? progressions ?? [];

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
          <ActivityIndicator accessibilityLabel="Loading workout summary" color={theme.colors.actionPrimary} />
          <RunpuyText tone="secondary" variant="body">
            Loading workout summary
          </RunpuyText>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: layout.pageMargin }}>
          <RunpuyText accessibilityRole="alert" variant="body" style={{ color: theme.colors.error }}>
            {(error as Error)?.message || "Failed to load summary"}
          </RunpuyText>
        </View>
      </SafeAreaView>
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
  const workoutNameExercises: Parameters<typeof buildWorkoutName>[0] =
    Object.values(byExercise).length > 0
      ? setLogs.reduce<Parameters<typeof buildWorkoutName>[0]>((accumulator, log, index, array) => {
          if (array.findIndex((entry) => entry.exerciseId === log.exerciseId) !== index) {
            return accumulator;
          }

          if (!log.exercise) {
            return accumulator;
          }

          accumulator.push({ exercise: log.exercise });
          return accumulator;
        }, [])
      : [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: layout.pageMargin, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg }}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityLabel="Return to Home"
          accessibilityRole="button"
          onPress={() => router.replace("/(tabs)")}
          style={{ alignSelf: "flex-start", justifyContent: "center", minHeight: layout.minimumTouchTarget }}
        >
          <RunpuyText variant="body">{`\u2190 Home`}</RunpuyText>
        </Pressable>

        <View style={{ gap: spacing.xs }}>
          <RunpuyText accessibilityRole="header" variant="heading">
            Workout Summary
          </RunpuyText>
          <RunpuyText tone="secondary" variant="body">
            {programDay?.name || ""} {programDay ? `\u2014` : ""} {buildWorkoutName(workoutNameExercises)}
          </RunpuyText>
          <RunpuyText tone="secondary" variant="caption">
            Session #{session.id}
          </RunpuyText>
        </View>

        <RunpuyCard style={{ gap: spacing.xs }}>
          <RunpuyText variant="body">Status: {session.status}</RunpuyText>
          {session.completedAt && (
            <RunpuyText tone="secondary" variant="caption">
              Completed at: {new Date(session.completedAt).toLocaleString()}
            </RunpuyText>
          )}
          {program && <RunpuyText tone="secondary" variant="caption">Program: {program.name}</RunpuyText>}
          {programDay && <RunpuyText tone="secondary" variant="caption">Day: {programDay.name}</RunpuyText>}
        </RunpuyCard>

        {!isProgressionsLoading && !isProgressionsError && displayedProgressions.length > 0 && (
          <RunpuyCard>
            <RunpuyText variant="body">
              {buildInsight(displayedProgressions)}
            </RunpuyText>
          </RunpuyCard>
        )}

        <RunpuyCard style={{ gap: spacing.xs }}>
          <RunpuyText variant="body">
            {buildReinforcement(numericSessionId)}
          </RunpuyText>
          <RunpuyText tone="secondary" variant="caption">
            Try to train again within 48 hours.
          </RunpuyText>
        </RunpuyCard>

        <RunpuyCard style={{ gap: spacing.xs }}>
          <RunpuyText variant="body">Total exercises logged: {totalExercisesLogged}</RunpuyText>
          <RunpuyText variant="body">Total sets: {totalSets}</RunpuyText>
        </RunpuyCard>

        {Object.entries(byExercise).map(([exId, group]) => (
          <RunpuyCard key={exId} style={{ gap: spacing.xs }}>
            <RunpuyText script="persianArabic" variant="title">{group.name}</RunpuyText>
            {group.sets.map((s) => (
              <RunpuyText key={s.id} tone="secondary" variant="body">
                Set {s.setNumber}: {s.reps} reps{s.weightKg !== null ? ` @ ${s.weightKg}kg` : ""}
              </RunpuyText>
            ))}
          </RunpuyCard>
        ))}

        <View style={{ gap: spacing.md }}>
          <RunpuyText variant="title">Next Session Recommendations</RunpuyText>

          {isProgressionsLoading && (
            <RunpuyText accessibilityRole="progressbar" tone="secondary" variant="caption">
              Loading recommendations...
            </RunpuyText>
          )}
          {isProgressionsError && (
            <RunpuyText accessibilityRole="alert" variant="caption" style={{ color: theme.colors.error }}>
              Could not load recommendations.
            </RunpuyText>
          )}
          {!isProgressionsLoading && !isProgressionsError && displayedProgressions.length === 0 && (
            <RunpuyText tone="secondary" variant="caption">
              No recommendations yet
            </RunpuyText>
          )}

          {displayedProgressions.map((rec) => {
            const colors = recommendationColor(rec.recommendationType);
            const context = contextLine(rec);
            const explanationText =
              rec.explanation && typeof rec.explanation.userSummary === "string" && rec.explanation.userSummary.length > 0
                ? rec.explanation.userSummary
                : null;
            return (
              <RunpuyCard key={rec.id} style={{ gap: spacing.xs }}>
                <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" }}>
                  <RunpuyText script="persianArabic" variant="title" style={{ flex: 1 }}>
                    {rec.exercise.nameFa}
                  </RunpuyText>
                  <RunpuyStatusChip label={colors.label} status={colors.status} />
                </View>
                {rec.previousWeightKg !== null && rec.recommendedWeightKg !== null && (
                  <RunpuyText variant="body">
                    {rec.previousWeightKg}kg → {rec.recommendedWeightKg}kg
                  </RunpuyText>
                )}
                {rec.recommendedTargetLow !== null && rec.recommendedTargetHigh !== null && (
                  <RunpuyText variant="body">
                    Target: {rec.recommendedTargetLow}-{rec.recommendedTargetHigh}
                  </RunpuyText>
                )}
                {context && <RunpuyText tone="secondary" variant="caption">{context}</RunpuyText>}
                {(() => {
                  const currentLastSet = getLastSetForExercise(session, rec.exerciseId);
                  const previousLastSet = getLastSetForExercise(previousSession, rec.exerciseId);
                  if (!currentLastSet || !previousLastSet) return null;
                  const trend = getTrend(currentLastSet, previousLastSet);
                  return (
                    <RunpuyText tone="secondary" variant="caption">
                      {trendArrow(trend)} {comparisonText(currentLastSet, previousLastSet)}
                    </RunpuyText>
                  );
                })()}
                {explanationText ? (
                  <RunpuyText tone="secondary" variant="caption">{explanationText}</RunpuyText>
                ) : (
                  <RunpuyText tone="secondary" variant="caption">{rec.reason}</RunpuyText>
                )}
              </RunpuyCard>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
