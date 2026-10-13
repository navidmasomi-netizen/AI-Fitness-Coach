import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet, I18nManager } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { getProgramById } from "../../src/api/programs";
import { activateProgram } from "../../src/api/userPrograms";
import { RunpuyButton, RunpuyCard, RunpuyText } from "../../src/design-system/components";
import { useRunpuyTheme } from "../../src/design-system/theme-context";
import { layout, spacing } from "../../src/design-system/tokens";
import { getPositiveRouteId } from "../../src/utils/routeParams";

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const programId = getPositiveRouteId(id);

  if (programId === null) return <InvalidProgramRoute />;

  return <ProgramDetailContent programId={programId} />;
}

function InvalidProgramRoute() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scrollView}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)");
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <RunpuyText tone="secondary" variant="body">
            {I18nManager.isRTL ? "Back \u2192" : "\u2190 Back"}
          </RunpuyText>
        </Pressable>
        <View style={styles.invalidRoute}>
          <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
            This program link is invalid. Return to Home and select a program again.
          </RunpuyText>
          <RunpuyButton
            label="Go Back"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/(tabs)");
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgramDetailContent({ programId }: { programId: number }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: program, isLoading, isError, error } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => getProgramById(programId),
  });

  const activateMutation = useMutation({
    mutationFn: () => activateProgram(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myProgram"] });
      router.replace("/(tabs)");
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
            {I18nManager.isRTL ? "Back \u2192" : "\u2190 Back"}
          </RunpuyText>
        </Pressable>

        {isLoading && (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading program">
            <ActivityIndicator color={theme.colors.actionPrimary} />
          </View>
        )}
        {isError && (
          <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
            Error: {(error as Error)?.message}
          </RunpuyText>
        )}

        {program && (
          <View style={styles.programContent}>
            <RunpuyCard style={styles.programCard}>
              <RunpuyText accessibilityRole="header" variant="heading">
                {program.name}
              </RunpuyText>
              <RunpuyText variant="body">
                Goal: {program.goal}
              </RunpuyText>
              <RunpuyText tone="secondary" variant="body">
                Split: {program.splitFamily}
              </RunpuyText>
            </RunpuyCard>

            <RunpuyButton
              label="Activate Program"
              loading={activateMutation.isPending}
              onPress={() => activateMutation.mutate()}
            />
            {activateMutation.isPending && (
              <RunpuyText accessibilityLiveRegion="polite" tone="secondary" variant="caption">
                Activating...
              </RunpuyText>
            )}
            {activateMutation.isError && (
              <RunpuyText accessibilityLiveRegion="polite" variant="body" style={styles.errorText}>
                {(activateMutation.error as Error)?.message}
              </RunpuyText>
            )}

            {program.days
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((day) => (
                <RunpuyCard key={day.id} style={styles.dayCard}>
                  <RunpuyText variant="title">
                    {day.name}
                  </RunpuyText>
                  {day.exercises
                    .sort((a, b) => a.order - b.order)
                    .map((pde) => (
                      <View key={pde.id} style={styles.exercise}>
                        <RunpuyText script="persianArabic" variant="body">
                          {pde.exercise.nameFa}
                        </RunpuyText>
                        <RunpuyText tone="secondary" variant="caption">
                          {pde.sets} sets x {pde.repRangeLow}-{pde.repRangeHigh} reps · rest {pde.restSeconds}s
                        </RunpuyText>
                      </View>
                    ))}
                </RunpuyCard>
              ))}
          </View>
        )}
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
  programContent: {
    gap: spacing.lg,
  },
  programCard: {
    gap: spacing.sm,
  },
  dayCard: {
    gap: spacing.md,
  },
  exercise: {
    gap: spacing.xs,
  },
  errorText: {
    color: theme.colors.textPrimary,
  },
  invalidRoute: {
    gap: spacing.md,
  },
});
