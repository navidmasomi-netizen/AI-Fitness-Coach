import { useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { INJURY_FLAG_LABELS, getWizardStepNumber, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepSixteenBackground = require("../../../assets/images/onboarding/onboarding-step-16-injury-background.png");

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  knee: require("../../../assets/images/onboarding/onboarding-step-16-icon-knee.png"),
  shoulder: require("../../../assets/images/onboarding/onboarding-step-16-icon-shoulder.png"),
  lower_back: require("../../../assets/images/onboarding/onboarding-step-16-icon-lower-back.png"),
  wrist: require("../../../assets/images/onboarding/onboarding-step-16-icon-wrist.png"),
  none: require("../../../assets/images/onboarding/onboarding-step-16-icon-none.png"),
};

const INJURY_OPTIONS = ["knee", "shoulder", "lower_back", "wrist"];

export default function WizardStepSixteenScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const injuryFlags = useWizardDraftStore((s) => s.injuryFlags);
  const setInjuryFlags = useWizardDraftStore((s) => s.setInjuryFlags);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(16, supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const toggleInjuryFlag = (option: string) => {
    if (option === "none") {
      setInjuryFlags(["none"]);
      return;
    }
    const current = injuryFlags.filter((item) => item !== "none");
    if (current.includes(option)) {
      setInjuryFlags(current.filter((item) => item !== option));
      return;
    }
    setInjuryFlags([...current, option]);
  };

  const onContinue = async () => {
    if (injuryFlags.length === 0 || isSaving) return;
    const didSave = await saveStep({ injuryFlags }, currentStep);
    if (!didSave) return;
    router.push(
      injuryFlags.includes("none") || injuryFlags.length === 0
        ? "/(profile)/wizard/step-18"
        : "/(profile)/wizard/step-17"
    );
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const isNextEnabled = injuryFlags.length > 0;
  const noneSelected = injuryFlags.includes("none");

  return (
    <View style={styles.root}>
      <ImageBackground source={stepSixteenBackground} resizeMode="cover" style={styles.background} accessible={false}>
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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
                      onPress={() => setIsOverflowOpen((v) => !v)}
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
                  <Text style={styles.chapterLabel}>INJURY & SAFETY</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    Any injuries or{"\n"}
                    <Text style={styles.questionAccent}>limitations</Text>
                    {"\n"}to consider?
                  </Text>
                  <Text style={styles.coachingCopy}>
                    We'll avoid exercises that stress injured areas.
                  </Text>
                </View>
              </View>

              <View style={styles.bottomContent}>
                <View style={styles.optionList}>
                  {INJURY_OPTIONS.map((option) => {
                    const isSelected = injuryFlags.includes(option);
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={INJURY_FLAG_LABELS[option]}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => toggleInjuryFlag(option)}
                        style={({ pressed }) => [
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                          pressed && !isSelected && styles.optionCardPressed,
                        ]}
                      >
                        <Image
                          source={OPTION_ICONS[option]}
                          style={styles.optionIcon}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                          {INJURY_FLAG_LABELS[option]}
                        </Text>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected ? <Feather name="check" size={12} color={colors.textPrimary} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}

                  <View style={styles.orDivider}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.orLine} />
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="No injuries or limitations — clears all other selections"
                    accessibilityState={{ selected: noneSelected }}
                    onPress={() => toggleInjuryFlag("none")}
                    style={({ pressed }) => [
                      styles.optionCard,
                      noneSelected && styles.optionCardSelected,
                      pressed && !noneSelected && styles.optionCardPressed,
                    ]}
                  >
                    <Image
                      source={OPTION_ICONS["none"]}
                      style={styles.optionIcon}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                    <Text style={[styles.optionLabel, noneSelected && styles.optionLabelSelected]}>
                      {INJURY_FLAG_LABELS["none"]}
                    </Text>
                    <View style={[styles.checkbox, noneSelected && styles.checkboxSelected]}>
                      {noneSelected ? <Feather name="check" size={12} color={colors.textPrimary} /> : null}
                    </View>
                  </Pressable>
                </View>

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the supplements question"
                    hitSlop={8}
                    onPress={() => router.replace(
                      supplementUse.includes("other")
                        ? "/(profile)/wizard/step-15b"
                        : "/(profile)/wizard/step-15"
                    )}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: !isNextEnabled || isSaving, busy: isSaving }}
                    disabled={!isNextEnabled || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (!isNextEnabled || isSaving) && styles.continueButtonDisabled,
                      pressed && isNextEnabled && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text style={[styles.continueLabel, (!isNextEnabled || isSaving) && styles.continueLabelDisabled]}>
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={!isNextEnabled || isSaving ? colors.disabledText : colors.textPrimary}
                    />
                  </Pressable>
                </View>

                <View style={styles.privacyFooter}>
                  <Feather name="lock" size={15} color={colors.textMuted} />
                  <Text style={styles.privacyText}>
                    Your answers stay private and shape your plan.
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
  accent: "#2563EB",
  accentPressed: "#1D4ED8",
  disabled: "rgba(37, 99, 235, 0.42)",
  disabledText: "rgba(226, 232, 240, 0.64)",
  error: "#FCA5A5",
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.18)" },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "22%",
    backgroundColor: "rgba(1, 5, 12, 0.22)",
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(1, 5, 12, 0.68)",
  },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  topContent: { gap: 14 },
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
  questionBlock: { gap: 8 },
  chapterLabel: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.25 },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { maxWidth: 300, color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  bottomContent: { gap: 8 },
  optionList: { gap: 6 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(5, 12, 22, 0.72)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 14,
    minHeight: 62,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(37, 99, 235, 0.14)",
  },
  optionCardPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.86)",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  optionLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  optionLabelSelected: { color: colors.textPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
  },
  orText: {
    color: "rgba(148, 163, 184, 0.60)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  errorMessage: { color: colors.error, fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: {
    minHeight: 50,
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
    minHeight: 50,
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
  privacyText: { color: colors.textMuted, fontSize: 12, lineHeight: 16, textAlign: "center" },
});
