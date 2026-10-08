import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../src/store/authStore";
import { getMyCompletedSessions } from "../../src/api/sessions";
import { WorkoutSession } from "../../src/types/session";
import { RunpuyCard, RunpuyText } from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { layout, spacing } from "../../src/design-system/tokens";

export default function HistoryScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: sessions, isLoading, isError, error } = useQuery({
    queryKey: ["completedSessions"],
    queryFn: () => getMyCompletedSessions(user!.id),
    enabled: !!user,
  });

  const renderSession = ({ item }: { item: WorkoutSession & { program?: any; programDay?: any } }) => {
    const totalSets = item.setLogs?.length || 0;
    const uniqueExercises = new Set((item.setLogs || []).map((s: any) => s.exerciseId)).size;

    return (
      <Pressable
        onPress={() => router.push(`/workout/summary/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`View workout summary for ${item.program?.name || "Unknown Program"}`}
        accessibilityHint="Open workout summary"
        style={styles.sessionPressable}
      >
        <RunpuyCard style={styles.sessionCard}>
          <RunpuyText variant="title">
            {item.program?.name || "Unknown Program"}
          </RunpuyText>
          <RunpuyText variant="body">
            {item.programDay?.name || ""}
          </RunpuyText>
          <RunpuyText tone="secondary" variant="caption">
            {item.completedAt ? new Date(item.completedAt).toLocaleString() : ""}
          </RunpuyText>
          <RunpuyText variant="body">
            Total sets: {totalSets}
          </RunpuyText>
          <RunpuyText variant="body">
            Exercises logged: {uniqueExercises}
          </RunpuyText>
        </RunpuyCard>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.content}>
        <RunpuyText accessibilityRole="header" variant="heading" style={styles.title}>
          Workout History
        </RunpuyText>

        {isLoading && (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading workout history">
            <ActivityIndicator color={theme.colors.actionPrimary} />
          </View>
        )}
        {isError && (
          <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
            {(error as Error)?.message}
          </RunpuyText>
        )}
        {sessions && sessions.length === 0 && (
          <RunpuyText tone="secondary" variant="body">
            No completed workouts yet
          </RunpuyText>
        )}

        {sessions && sessions.length > 0 && (
          <FlatList
            data={sessions}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderSession}
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
  title: {
    marginBottom: spacing.lg,
  },
  sessionPressable: {
    marginBottom: spacing.md,
    minHeight: layout.minimumTouchTarget,
  },
  sessionCard: {
    gap: spacing.xs,
  },
  errorText: {
    color: theme.colors.textPrimary,
  },
} as const);
