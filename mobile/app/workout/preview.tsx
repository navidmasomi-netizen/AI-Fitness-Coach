import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startFromActiveProgram } from "../../src/api/sessions";
import { RunpuyButton, RunpuyCard, RunpuyText } from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { layout, spacing } from "../../src/design-system/tokens";

export default function WorkoutPreviewScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const { dayName, workoutName, exerciseNames } = useLocalSearchParams<{
    dayName: string;
    workoutName: string;
    exerciseNames: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const names: string[] = exerciseNames ? JSON.parse(exerciseNames) : [];

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
            {`\u2190 Back`}
          </RunpuyText>
        </Pressable>

        <View style={styles.header}>
          <RunpuyText accessibilityRole="header" variant="heading">
            Today's Workout
          </RunpuyText>
          <RunpuyText tone="secondary" variant="body">
            {dayName} — {workoutName}
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
    alignSelf: "flex-start",
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
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionArea: {
    gap: spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
  },
});
