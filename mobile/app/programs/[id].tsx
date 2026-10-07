import { View, ScrollView, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { getProgramById } from "../../src/api/programs";
import { activateProgram } from "../../src/api/userPrograms";
import { RunpuyButton, RunpuyCard, RunpuyText } from "../../src/design-system/components";
import { darkTheme } from "../../src/design-system/themes";
import { layout, spacing } from "../../src/design-system/tokens";

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const programId = Number(id);

  const { data: program, isLoading, isError, error } = useQuery({
    queryKey: ["program", programId],
    queryFn: () => getProgramById(programId),
    enabled: !Number.isNaN(programId),
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
          <RunpuyText theme={darkTheme} tone="secondary" variant="body">
            {`\u2190 Back`}
          </RunpuyText>
        </Pressable>

        {isLoading && (
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading program">
            <ActivityIndicator color={darkTheme.colors.actionPrimary} />
          </View>
        )}
        {isError && (
          <RunpuyText accessibilityLiveRegion="polite" theme={darkTheme} variant="body" style={styles.errorText}>
            Error: {(error as Error)?.message}
          </RunpuyText>
        )}

        {program && (
          <View style={styles.programContent}>
            <RunpuyCard theme={darkTheme} style={styles.programCard}>
              <RunpuyText accessibilityRole="header" theme={darkTheme} variant="heading">
                {program.name}
              </RunpuyText>
              <RunpuyText theme={darkTheme} variant="body">
                Goal: {program.goal}
              </RunpuyText>
              <RunpuyText theme={darkTheme} tone="secondary" variant="body">
                Split: {program.splitFamily}
              </RunpuyText>
            </RunpuyCard>

            <RunpuyButton
              label="Activate Program"
              loading={activateMutation.isPending}
              onPress={() => activateMutation.mutate()}
              theme={darkTheme}
            />
            {activateMutation.isPending && (
              <RunpuyText accessibilityLiveRegion="polite" theme={darkTheme} tone="secondary" variant="caption">
                Activating...
              </RunpuyText>
            )}
            {activateMutation.isError && (
              <RunpuyText accessibilityLiveRegion="polite" theme={darkTheme} variant="body" style={styles.errorText}>
                {(activateMutation.error as Error)?.message}
              </RunpuyText>
            )}

            {program.days
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((day) => (
                <RunpuyCard key={day.id} theme={darkTheme} style={styles.dayCard}>
                  <RunpuyText theme={darkTheme} variant="title">
                    {day.name}
                  </RunpuyText>
                  {day.exercises
                    .sort((a, b) => a.order - b.order)
                    .map((pde) => (
                      <View key={pde.id} style={styles.exercise}>
                        <RunpuyText script="persianArabic" theme={darkTheme} variant="body">
                          {pde.exercise.nameFa}
                        </RunpuyText>
                        <RunpuyText theme={darkTheme} tone="secondary" variant="caption">
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: darkTheme.colors.canvas,
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
    color: darkTheme.colors.error,
  },
});
