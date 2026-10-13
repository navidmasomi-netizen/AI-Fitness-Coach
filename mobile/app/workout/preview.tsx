import { View, Pressable, ScrollView, StyleSheet, I18nManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startFromActiveProgram } from "../../src/api/sessions";
import { RunpuyButton, RunpuyCard, RunpuyText } from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { layout, spacing } from "../../src/design-system/tokens";
import { getRequiredRouteString, parseRequiredRouteArray } from "../../src/utils/routeParams";

export default function WorkoutPreviewScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const { dayName, workoutName, exerciseNames } = useLocalSearchParams<{
    dayName?: string | string[];
    workoutName?: string | string[];
    exerciseNames?: string | string[];
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const validDayName = getRequiredRouteString(dayName);
  const validWorkoutName = getRequiredRouteString(workoutName);
  const names = parseRequiredRouteArray(exerciseNames, (value): value is string => typeof value === "string");
  const isValidRoute = !!validDayName && !!validWorkoutName && !!names && names.length > 0;

  const startMutation = useMutation({
    mutationFn: startFromActiveProgram,
    onSuccess: (data) => {
      queryClient.setQueryData(["sessionExerciseTargets", data.session.id], data.session.exerciseTargets ?? []);
      router.replace({
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

  const returnToHome = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  if (!isValidRoute) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.invalidRoute}>
          <RunpuyText accessibilityRole="header" variant="heading">
            Workout preview unavailable
          </RunpuyText>
          <RunpuyText accessibilityLiveRegion="polite" tone="secondary" variant="body">
            This workout link is incomplete or invalid. Return to Home and start the workout again.
          </RunpuyText>
          <RunpuyButton label="Go Back" onPress={returnToHome} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scrollView}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <RunpuyText tone="secondary" variant="body">
            {I18nManager.isRTL ? "Back \u2192" : "\u2190 Back"}
          </RunpuyText>
        </Pressable>

        <View style={styles.header}>
          <RunpuyText accessibilityRole="header" variant="heading">
            Today's Workout
          </RunpuyText>
          <RunpuyText tone="secondary" variant="body">
            {validDayName} — {validWorkoutName}
          </RunpuyText>
        </View>

        <View style={styles.exercises}>
          {names.map((name, i) => (
            <RunpuyCard key={i} style={styles.exerciseCard}>
              <RunpuyText tone="secondary" variant="caption">
                {i + 1}.
              </RunpuyText>
              <RunpuyText script="persianArabic" variant="body">
                {name}
              </RunpuyText>
            </RunpuyCard>
          ))}
        </View>

        <View style={styles.actionArea}>
          <RunpuyButton
            label="Start Session"
            loading={startMutation.isPending}
            onPress={() => startMutation.mutate()}
          />
          {startMutation.isPending && (
            <RunpuyText accessibilityLiveRegion="polite" tone="secondary" variant="caption">
              Starting...
            </RunpuyText>
          )}
          {startMutation.isError && (
            <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
              {(startMutation.error as Error)?.message}
            </RunpuyText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>["theme"]) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: layout.pageMargin,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.lg,
  },
  backButton: {
    alignSelf: I18nManager.isRTL ? "flex-end" : "flex-start",
    justifyContent: "center",
    minHeight: layout.minimumTouchTarget,
  },
  header: {
    gap: spacing.xs,
  },
  exercises: {
    gap: spacing.sm,
  },
  exerciseCard: {
    flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
    gap: spacing.sm,
  },
  actionArea: {
    gap: spacing.sm,
  },
  errorText: {
    color: theme.colors.textPrimary,
  },
  invalidRoute: {
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: layout.pageMargin,
  },
});
