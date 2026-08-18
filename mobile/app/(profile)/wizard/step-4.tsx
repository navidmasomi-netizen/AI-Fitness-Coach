import { useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepFourHero = require("../../../assets/images/onboarding/onboarding-step-4-duration-hero.png");

const SESSION_DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;
type DurationOption = (typeof SESSION_DURATION_OPTIONS)[number];

const DURATION_SUMMARIES: Record<DurationOption, { title: string; description: string }> = {
  30: {
    title: "30 minutes per session",
    description: "Short and focused. Every rep counts — we'll keep it efficient.",
  },
  45: {
    title: "45 minutes per session",
    description: "A solid block. Enough time for a complete, quality session.",
  },
  60: {
    title: "60 minutes per session",
    description: "A balanced training window with room for focused, quality work.",
  },
  75: {
    title: "75 minutes per session",
    description: "Room to warm up, work hard, and cool down properly.",
  },
  90: {
    title: "90 minutes per session",
    description: "High-commitment training. We'll use every minute intentionally.",
  },
};

export default function WizardStepFourScreen() {
  const currentStep = 4;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const sessionDurationMin = useWizardDraftStore((s) => s.sessionDurationMin);
  const setSessionDurationMin = useWizardDraftStore((s) => s.setSessionDurationMin);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (sessionDurationMin === null) return;
    const didSave = await saveStep({ sessionDurationMin }, 4);
    if (didSave) {
      router.push("/(profile)/wizard/step-5");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const selectedSummary =
    sessionDurationMin !== null
      ? (DURATION_SUMMARIES[sessionDurationMin as DurationOption] ?? null)
      : null;

  return (
    <View style={styles.root}>
      <ImageBackground source={stepFourHero} resizeMode="cover" style={styles.background} accessible={false}>
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.leftReadabilityShade} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.topContent}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressCopy}>
                    <Text style={styles.stepLabel}>Step {currentStep} of {totalSteps}</Text>
                    <View
                      accessibilityLabel={"Progress: step " + currentStep + " of " + totalSteps}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
                      style={styles.progressTrack}
                    >
                      <View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>
                  </View>

                  <View style={styles.overflowContainer}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="More onboarding options"
                      accessibilityState={{ expanded: isOverflowOpen }}
                      hitSlop={10}
                      onPress={() => setIsOverflowOpen((current) => !current)}
                      style={styles.overflowButton}
                    >
                      <Feather name="more-horizontal" size={22} color={colors.textSecondary} />
                    </Pressable>
                    {isOverflowOpen ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Log out"
                        onPress={onLogout}
                        style={styles.logoutAction}
                      >
                        <Text style={styles.logoutActionText}>Log out</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.questionBlock}>
                  <Text style={styles.chapterLabel}>TRAINING SETUP</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    How long should{"\n"}
                    <Text style={styles.questionAccent}>each session be?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    Choose the time that fits your schedule{"\n"}and helps you stay consistent.
                  </Text>
                </View>

                <View style={styles.durationSection}>
                  <View accessibilityRole="radiogroup" style={styles.durationRow}>
                    {SESSION_DURATION_OPTIONS.map((option) => {
                      const isSelected = sessionDurationMin === option;
                      return (
                        <Pressable
                          key={option}
                          accessibilityRole="radio"
                          accessibilityLabel={`${option} minutes`}
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => setSessionDurationMin(option)}
                          style={({ pressed }) => [
                            styles.durationChip,
                            isSelected && styles.durationChipSelected,
                            pressed && styles.durationChipPressed,
                          ]}
                        >
                          <View style={styles.chipTopRow}>
                            {isSelected ? (
                              <View style={styles.chipCheck}>
                                <Ionicons name="checkmark" size={10} color={colors.textPrimary} />
                              </View>
                            ) : null}
                          </View>
                          <Text style={[styles.chipNumber, isSelected && styles.chipNumberSelected]}>
                            {option}
                          </Text>
                          <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                            MIN
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedSummary !== null ? (
                    <View accessibilityRole="text" style={styles.selectionSummary}>
                      <Feather name="clock" size={21} color={colors.accent} />
                      <View style={styles.summaryCopy}>
                        <Text style={styles.summaryTitle}>{selectedSummary.title}</Text>
                        <Text style={styles.summaryDescription}>{selectedSummary.description}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.bottomContent}>
                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the session frequency question"
                    hitSlop={8}
                    onPress={() => router.back()}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: sessionDurationMin === null || isSaving, busy: isSaving }}
                    disabled={sessionDurationMin === null || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (sessionDurationMin === null || isSaving) && styles.continueButtonDisabled,
                      pressed && sessionDurationMin !== null && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.continueLabel,
                        (sessionDurationMin === null || isSaving) && styles.continueLabelDisabled,
                      ]}
                    >
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={
                        sessionDurationMin === null || isSaving
                          ? colors.disabledText
                          : colors.textPrimary
                      }
                    />
                  </Pressable>
                </View>

                <View style={styles.privacyFooter}>
                  <Feather name="lock" size={15} color={colors.textMuted} />
                  <Text style={styles.privacyText}>
                    Your answers are private and secure.{"\n"}You can change them later.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const colors = {
  background: "#020617",
  textPrimary: "#F8FAFC",
  textSecondary: "rgba(226, 232, 240, 0.84)",
  textMuted: "rgba(148, 163, 184, 0.96)",
  iconMuted: "rgba(226, 232, 240, 0.78)",
  accent: "#2563EB",
  accentPressed: "#1D4ED8",
  disabled: "rgba(37, 99, 235, 0.42)",
  disabledText: "rgba(226, 232, 240, 0.64)",
  error: "#FCA5A5",
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.26)" },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "66%",
    backgroundColor: "rgba(1, 5, 12, 0.48)",
  },
  topShade: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    height: "32%",
    backgroundColor: "rgba(1, 5, 12, 0.22)",
  },
  bottomShade: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: "35%",
    backgroundColor: "rgba(1, 5, 12, 0.38)",
  },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 30,
  },
  topContent: { gap: 28 },
  progressHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  progressCopy: { gap: 10 },
  stepLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  progressTrack: {
    width: 172,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.34)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
  overflowContainer: { alignItems: "flex-end" },
  overflowButton: { width: 42, height: 36, alignItems: "center", justifyContent: "center" },
  logoutAction: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(2, 6, 23, 0.88)",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  logoutActionText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  questionBlock: { gap: 12 },
  chapterLabel: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.25 },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 35,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { maxWidth: 286, color: colors.textSecondary, fontSize: 16, lineHeight: 23 },
  durationSection: { gap: 12 },
  durationRow: { flexDirection: "row", gap: 9 },
  durationChip: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.34)",
    backgroundColor: "rgba(5, 12, 22, 0.72)",
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  durationChipSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(30, 64, 175, 0.34)",
  },
  durationChipPressed: { backgroundColor: "rgba(30, 41, 59, 0.86)" },
  chipTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
    minHeight: 15,
  },
  chipCheck: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  chipNumber: {
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "800",
    textAlign: "center",
  },
  chipNumberSelected: { color: "#BFDBFE" },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  chipLabelSelected: { color: "#93C5FD" },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.32)",
    backgroundColor: "rgba(2, 6, 23, 0.62)",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: "#BFDBFE", fontSize: 15, fontWeight: "700" },
  summaryDescription: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  bottomContent: { gap: 14 },
  errorMessage: { color: colors.error, fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.32)",
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 17,
  },
  backButtonPressed: { backgroundColor: "rgba(30, 41, 59, 0.86)" },
  backLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
  continueButton: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  continueButtonDisabled: { backgroundColor: colors.disabled },
  continueButtonPressed: { backgroundColor: colors.accentPressed },
  continueLabel: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  continueLabelDisabled: { color: colors.disabledText },
  privacyFooter: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 8 },
  privacyText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: "center" },
});
