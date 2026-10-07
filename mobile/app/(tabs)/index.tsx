import { View, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/authStore";
import { ApiError } from "../../src/api/client";
import { getPrograms, getRegenerationRecommendation, regenerateProgram } from "../../src/api/programs";
import { getMyProgram } from "../../src/api/userPrograms";
import { startFromActiveProgram, getActiveSession, getMyCompletedSessions } from "../../src/api/sessions";
import { getSessionProgressions } from "../../src/api/progressions";
import { getLastSetForExercise, getTrend } from "../../src/utils/compareSets";
import { buildWorkoutName, estimateMinutes } from "../../src/utils/workoutMeta";
import { Program } from "../../src/types/program";
import { RegenerationInsightCard } from "../../src/components/RegenerationInsightCard";
import {
  RunpuyButton,
  RunpuyCard,
  RunpuyStatusChip,
  RunpuyText,
} from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { layout, radii, spacing } from "../../src/design-system/tokens";

function buildLastSessionSignal(recommendations: { recommendationType: string }[] | undefined): string | null {
  if (!recommendations || recommendations.length === 0) return null;
  const evaluable = recommendations.filter(
    (r: any) => r.reason !== "No sets were logged for this exercise; cannot evaluate progression."
  );
  if (evaluable.length === 0) return null;
  const increases = evaluable.filter((r) => r.recommendationType === "increase").length;
  const maintains = evaluable.filter((r) => r.recommendationType === "maintain").length;
  const deloads = evaluable.filter((r) => r.recommendationType === "deload").length;

  const parts: string[] = [];
  if (increases > 0) parts.push(`+${increases} increase${increases > 1 ? "s" : ""}`);
  if (maintains > 0) parts.push(`${maintains} maintain`);
  if (deloads > 0) parts.push(`${deloads} deload`);
  if (parts.length === 0) return null;
  return `Last session: ${parts.join(" / ")}`;
}

function getRegenerationErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }

  if (error.status === 401) {
    return null;
  }

  if (error.status === 404) {
    return "No active program.";
  }

  if (error.status === 409) {
    if (error.message === "Finish your active workout before regenerating your program.") {
      return "Finish your current workout before regenerating.";
    }

    if (error.message === "Program regeneration is already in progress. Please try again.") {
      return "Program already regenerated.";
    }
  }

  if (error.status === 422) {
    return "Unable to build a suitable program.";
  }

  return "Something went wrong. Please try again.";
}

export default function HomeScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const { data: programs, isLoading, isError, error } = useQuery({
    queryKey: ["programs"],
    queryFn: getPrograms,
  });

  const { data: myProgram, isLoading: isMyProgramLoading } = useQuery({
    queryKey: ["myProgram"],
    queryFn: getMyProgram,
  });

  const { data: regenerationRecommendation, isLoading: isRegenerationLoading } = useQuery({
    queryKey: ["regenerationRecommendation"],
    queryFn: getRegenerationRecommendation,
    staleTime: 60 * 60 * 1000,
  });

  const { data: activeSession, isLoading: isActiveSessionLoading } = useQuery({
    queryKey: ["activeSession"],
    queryFn: getActiveSession,
  });

  const { data: completedSessions } = useQuery({
    queryKey: ["completedSessions"],
    queryFn: () => getMyCompletedSessions(user!.id),
    enabled: !!user,
  });

  const lastCompletedSessionId = completedSessions && completedSessions.length > 0 ? completedSessions[0].id : null;

  const { data: lastSessionProgressions } = useQuery({
    queryKey: ["lastSessionProgressions", lastCompletedSessionId],
    queryFn: () => getSessionProgressions(lastCompletedSessionId as number),
    enabled: !!lastCompletedSessionId,
  });

  const lastSessionSignal = buildLastSessionSignal(lastSessionProgressions);

  const lastWorkoutTrendLine = (() => {
    if (!completedSessions || completedSessions.length < 2) return null;
    const latest = completedSessions[0];
    const previous = completedSessions[1];
    const exerciseIds = new Set((latest.setLogs || []).map((s) => s.exerciseId));
    let improved = 0;
    let dropped = 0;
    for (const exId of exerciseIds) {
      const currentLast = getLastSetForExercise(latest, exId);
      const previousLast = getLastSetForExercise(previous, exId);
      if (!currentLast || !previousLast) continue;
      const trend = getTrend(currentLast, previousLast);
      if (trend === "up") improved += 1;
      if (trend === "down") dropped += 1;
    }
    if (improved === 0 && dropped === 0) return null;
    if (improved >= dropped) return `Last workout: \u2191 ${improved} exercise${improved !== 1 ? "s" : ""} improved`;
    return `Last workout: \u2193 ${dropped} exercise${dropped !== 1 ? "s" : ""} dropped`;
  })();

  const startWorkoutMutation = useMutation({
    mutationFn: startFromActiveProgram,
    onSuccess: (data) => {
      queryClient.setQueryData(["sessionExerciseTargets", data.session.id], data.session.exerciseTargets ?? []);
      router.push({
        pathname: "/workout/[sessionId]",
        params: {
          sessionId: String(data.session.id),
          programName: data.program.name,
          dayName: data.programDay.name,
          exercisesData: JSON.stringify(data.exercises),
          exerciseTargetsData: JSON.stringify(data.session.exerciseTargets ?? []),
          existingSetLogsData: JSON.stringify(data.session.setLogs || []),
        },
      });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: regenerateProgram,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["programs"] }),
        queryClient.invalidateQueries({ queryKey: ["myProgram"] }),
        queryClient.invalidateQueries({ queryKey: ["regenerationRecommendation"] }),
        queryClient.invalidateQueries({ queryKey: ["activeSession"] }),
      ]);
    },
    onError: (error) => {
      const message = getRegenerationErrorMessage(error);
      if (!message) return;
      Alert.alert("Regeneration Failed", message);
    },
  });

  const onResume = () => {
    if (!activeSession) return;
    const cachedExerciseTargets =
      queryClient.getQueryData(["sessionExerciseTargets", activeSession.session.id]) ?? [];
    router.push({
      pathname: "/workout/[sessionId]",
      params: {
        sessionId: String(activeSession.session.id),
        programName: activeSession.program.name,
        dayName: activeSession.programDay.name,
        exercisesData: JSON.stringify(activeSession.exercises),
        exerciseTargetsData: JSON.stringify(cachedExerciseTargets),
        existingSetLogsData: JSON.stringify(activeSession.session.setLogs || []),
      },
    });
  };

  const onLogout = async () => {
    await logout();
    queryClient.clear();
    router.replace("/(auth)/login");
  };

  const onConfirmRegenerate = () => {
    if (regenerateMutation.isPending) return;

    Alert.alert(
      "Regenerate Program?",
      "Your current workouts and history will be preserved.\n\nA new AI program will replace your active program.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => {
            if (regenerateMutation.isPending) return;
            regenerateMutation.mutate();
          },
        },
      ]
    );
  };

  const renderProgram = ({ item }: { item: Program }) => {
    const totalExercises = item.days.reduce((sum, day) => sum + day.exercises.length, 0);
    const isActive = myProgram?.programId === item.id;
    return (
      <Pressable
        onPress={() => router.push(`/programs/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
        accessibilityHint="View program details"
        accessibilityState={{ selected: isActive }}
        style={styles.programPressable}
      >
        <RunpuyCard style={isActive ? styles.activeProgramCard : styles.programCard}>
          {isActive ? <RunpuyStatusChip label="ACTIVE" status="success" /> : null}
          <RunpuyText variant="title">
            {item.name}
          </RunpuyText>
          <RunpuyText variant="body">
            Goal: {item.goal}
          </RunpuyText>
          <RunpuyText variant="body">
            Split: {item.splitFamily}
          </RunpuyText>
          <RunpuyText variant="body">
            Days: {item.days.length}
          </RunpuyText>
          <RunpuyText variant="body">
            Total exercises: {totalExercises}
          </RunpuyText>
        </RunpuyCard>
      </Pressable>
    );
  };

  const currentDay = myProgram?.program.days.find(
    (d) => d.dayIndex === myProgram.currentDayIndex
  );

  const nextDayCue = (() => {
    if (!myProgram) return null;
    const totalDays = myProgram.program.days.length;
    if (totalDays === 0) return null;
    const nextIndex = (myProgram.currentDayIndex + 1) % totalDays;
    const nextDay = myProgram.program.days.find((d) => d.dayIndex === nextIndex);
    if (!nextDay) return null;
    return `Next session: ${nextDay.name}`;
  })();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.content}>
        <RunpuyText accessibilityRole="header" variant="title" style={styles.accountText}>
          {user ? `Logged in as ${user.email}` : "No user"}
        </RunpuyText>
        <View style={styles.accountActions}>
          <Pressable
            onPress={onLogout}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            style={styles.secondaryAction}
          >
            <RunpuyText variant="body">
              Logout
            </RunpuyText>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(onboarding)/intro")}
            accessibilityRole="button"
            accessibilityLabel="How this works"
            style={styles.secondaryAction}
          >
            <RunpuyText variant="caption" style={styles.introActionText}>
              How this works
            </RunpuyText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <RunpuyText accessibilityRole="header" variant="title" style={styles.sectionTitle}>
            Active Program
          </RunpuyText>
          {isMyProgramLoading && (
            <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading active program">
              <ActivityIndicator color={theme.colors.actionPrimary} />
            </View>
          )}
          {!isMyProgramLoading && !myProgram && (
            <RunpuyText tone="secondary" variant="body">
              No active program yet
            </RunpuyText>
          )}
          {myProgram && (
            <RunpuyCard style={styles.activeProgramSurface}>
              {currentDay && (() => {
                const workoutName = buildWorkoutName(currentDay.exercises);
                const minutes = estimateMinutes(currentDay.exercises);
                const exerciseCount = currentDay.exercises.length;
                return (
                  <View>
                    <RunpuyText variant="heading">
                      Today: {workoutName}
                    </RunpuyText>
                    <RunpuyText tone="secondary" variant="caption" style={styles.workoutMeta}>
                      {exerciseCount} exercises • ~{minutes} min
                    </RunpuyText>
                  </View>
                );
              })()}

              {isActiveSessionLoading && (
                <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading active workout" style={styles.loadingRow}>
                  <ActivityIndicator color={theme.colors.actionPrimary} />
                </View>
              )}

              {!isActiveSessionLoading && activeSession && (
                <RunpuyButton
                  label="Resume Workout"
                  onPress={onResume}
                  style={styles.primaryAction}
                />
              )}

              {!isActiveSessionLoading && !activeSession && currentDay && (
                <RunpuyButton
                  label="Start Workout"
                  onPress={() =>
                    router.push({
                      pathname: "/workout/preview",
                      params: {
                        dayName: currentDay.name,
                        workoutName: buildWorkoutName(currentDay.exercises),
                        exerciseNames: JSON.stringify(currentDay.exercises.map((e) => e.exercise.nameFa)),
                      },
                    })
                  }
                  style={styles.primaryAction}
                />
              )}
              {startWorkoutMutation.isError && (
                <RunpuyText accessibilityLiveRegion="polite" variant="caption" style={styles.errorText}>
                  {(startWorkoutMutation.error as Error)?.message}
                </RunpuyText>
              )}

              <View style={styles.signals}>
                {!activeSession && nextDayCue && (
                  <RunpuyText tone="secondary" variant="caption">
                    {nextDayCue}
                  </RunpuyText>
                )}
                {lastSessionSignal && (
                  <RunpuyText tone="secondary" variant="caption">
                    {lastSessionSignal}
                  </RunpuyText>
                )}
                {lastWorkoutTrendLine && (
                  <RunpuyText tone="secondary" variant="caption">
                    {lastWorkoutTrendLine}
                  </RunpuyText>
                )}
              </View>
            </RunpuyCard>
          )}
        </View>

        <RegenerationInsightCard
          recommendation={regenerationRecommendation}
          isLoading={isRegenerationLoading}
          onRegenerate={onConfirmRegenerate}
          isRegenerating={regenerateMutation.isPending}
        />

        <RunpuyText accessibilityRole="header" variant="heading" style={styles.programsHeading}>
          Programs
        </RunpuyText>

        {isLoading && (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading programs">
            <ActivityIndicator color={theme.colors.actionPrimary} />
          </View>
        )}
        {isError && (
          <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
            Error loading programs: {(error as Error)?.message}
          </RunpuyText>
        )}

        {programs && (
          <FlatList
            data={programs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderProgram}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>["theme"]) => ({
  safeArea: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.lg,
  },
  accountText: {
    marginBottom: spacing.xs,
  },
  accountActions: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  secondaryAction: {
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    borderColor: theme.colors.borderSubtle,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: "center" as const,
    minHeight: layout.minimumTouchTarget,
    paddingHorizontal: spacing.md,
  },
  introActionText: {
    color: theme.colors.actionPrimary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  activeProgramSurface: {
    gap: spacing.md,
  },
  workoutMeta: {
    marginTop: spacing.xs,
  },
  loadingRow: {
    marginTop: spacing.md,
  },
  primaryAction: {
    marginTop: spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    marginTop: spacing.sm,
  },
  signals: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  programsHeading: {
    marginBottom: spacing.md,
  },
  programPressable: {
    marginBottom: spacing.md,
    minHeight: layout.minimumTouchTarget,
  },
  programCard: {
    gap: spacing.xs,
  },
  activeProgramCard: {
    borderColor: theme.colors.success,
    borderWidth: 2,
    gap: spacing.xs,
  },
} as const);
