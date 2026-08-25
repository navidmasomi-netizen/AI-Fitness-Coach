import { useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { CARDIO_PREFERENCE_LABELS, CARDIO_PREFERENCE_SUB_COPY, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepFourteenHero = require("../../../assets/images/onboarding/onboarding-step-14-cardio-hero.png");

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  none: require("../../../assets/images/onboarding/onboarding-step-14-icon-no-cardio.png"),
  low_intensity: require("../../../assets/images/onboarding/onboarding-step-14-icon-low-intensity.png"),
  hiit: require("../../../assets/images/onboarding/onboarding-step-14-icon-hiit.png"),
  mixed: require("../../../assets/images/onboarding/onboarding-step-14-icon-mixed.png"),
};

const CARDIO_OPTIONS = ["none", "low_intensity", "hiit", "mixed"];

export default function WizardStepFourteenScreen() {
  const currentStep = 14;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const cardioPreference = useWizardDraftStore((s) => s.cardioPreference);
  const setCardioPreference = useWizardDraftStore((s) => s.setCardioPreference);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (!cardioPreference || isSaving) return;
    const didSave = await saveStep({ cardioPreference }, 14);
    if (didSave) {
      router.push("/(profile)/wizard/step-15");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={stepFourteenHero} resizeMode="cover" style={styles.background} imageStyle={styles.heroImage} accessible={false}>
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
                  <Text style={styles.chapterLabel}>TRAINING STYLE</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    What kind of cardio{"\n"}
                    <Text style={styles.questionAccent}>do you prefer?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    This helps us understand the cardio style you enjoy for future coaching.
                  </Text>
                </View>
              </View>

              <View style={styles.bottomContent}>
                <View style={styles.optionList}>
                  {CARDIO_OPTIONS.map((option) => {
                    const isSelected = cardioPreference === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={CARDIO_PREFERENCE_LABELS[option]}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setCardioPreference(option)}
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
                        <View style={styles.optionText}>
                          <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                            {CARDIO_PREFERENCE_LABELS[option]}
                          </Text>
                          <Text style={[styles.optionSubCopy, isSelected && styles.optionSubCopySelected]}>
                            {CARDIO_PREFERENCE_SUB_COPY[option]}
                          </Text>
                        </View>
                        <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorSelected]}>
                          {isSelected ? (
                            <Feather name="check" size={13} color={colors.textPrimary} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the meal frequency question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-13")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: !cardioPreference || isSaving, busy: isSaving }}
                    disabled={!cardioPreference || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (!cardioPreference || isSaving) && styles.continueButtonDisabled,
                      pressed && !!cardioPreference && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text style={[styles.continueLabel, (!cardioPreference || isSaving) && styles.continueLabelDisabled]}>
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={!cardioPreference || isSaving ? colors.disabledText : colors.textPrimary}
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
  accent: "#2563EB",
  accentPressed: "#1D4ED8",
  disabled: "rgba(37, 99, 235, 0.42)",
  disabledText: "rgba(226, 232, 240, 0.64)",
  error: "#FCA5A5",
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  heroImage: { top: -60 },
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.18)" },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "55%",
    backgroundColor: "rgba(1, 5, 12, 0.32)",
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "20%",
    backgroundColor: "rgba(1, 5, 12, 0.10)",
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "56%",
    backgroundColor: "rgba(1, 5, 12, 0.72)",
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
    fontSize: 35,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { maxWidth: 300, color: colors.textSecondary, fontSize: 16, lineHeight: 23 },
  bottomContent: { gap: 8 },
  optionList: { gap: 6 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(5, 12, 22, 0.72)",
    paddingVertical: 11,
    paddingHorizontal: 16,
    gap: 14,
    minHeight: 82,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  optionCardPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.86)",
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  optionText: { flex: 1, gap: 3 },
  optionLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  optionLabelSelected: { color: colors.textPrimary },
  optionSubCopy: {
    color: "rgba(148, 163, 184, 0.68)",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  optionSubCopySelected: { color: "rgba(226, 232, 240, 0.72)" },
  selectionIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(148, 163, 184, 0.38)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
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
