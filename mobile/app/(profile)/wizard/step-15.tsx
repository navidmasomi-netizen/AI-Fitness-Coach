import { useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { SUPPLEMENT_LABELS, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepFifteenBackground = require("../../../assets/images/onboarding/onboarding-step-15-supplements-background.png");

const SUPPLEMENT_OPTIONS = [
  "protein",
  "creatine",
  "omega3",
  "multivitamin",
  "vitamin_d",
  "magnesium",
  "fish_oil",
  "electrolytes",
  "pre_workout",
  "other",
];

export default function WizardStepFifteenScreen() {
  const currentStep = 15;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setSupplementUse = useWizardDraftStore((s) => s.setSupplementUse);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const toggleSupplement = (option: string) => {
    if (option === "none") {
      setSupplementUse(["none"]);
      return;
    }
    const current = supplementUse.filter((item) => item !== "none");
    if (current.includes(option)) {
      setSupplementUse(current.filter((item) => item !== option));
      return;
    }
    setSupplementUse([...current, option]);
  };

  const onContinue = async () => {
    if (supplementUse.length === 0 || isSaving) return;
    const didSave = await saveStep({ supplementUse }, 15);
    if (didSave) {
      router.push(supplementUse.includes("other") ? "/(profile)/wizard/step-15b" : "/(profile)/wizard/step-16");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const isNextEnabled = supplementUse.length > 0;
  const noneSelected = supplementUse.includes("none");

  return (
    <View style={styles.root}>
      <ImageBackground source={stepFifteenBackground} resizeMode="cover" style={styles.background} accessible={false}>
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
                <Text style={styles.chapterLabel}>SUPPLEMENTS & LIFESTYLE</Text>
                <Text accessibilityRole="header" style={styles.questionTitle}>
                  Which supplements{"\n"}
                  <Text style={styles.questionAccent}>do you use?</Text>
                </Text>
                <Text style={styles.coachingCopy}>Select all that apply.</Text>
              </View>
            </View>

            <View style={styles.listPanel}>
              <ScrollView
                style={styles.listScroll}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {SUPPLEMENT_OPTIONS.map((option) => {
                  const isSelected = supplementUse.includes(option);
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={SUPPLEMENT_LABELS[option]}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => toggleSupplement(option)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                        pressed && !isSelected && styles.optionCardPressed,
                      ]}
                    >
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {SUPPLEMENT_LABELS[option]}
                      </Text>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected ? <Feather name="check" size={12} color={colors.textPrimary} /> : null}
                      </View>
                    </Pressable>
                  );
                })}

                <View style={styles.noneSeparator} />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="I don't take supplements — clears all other selections"
                  accessibilityState={{ selected: noneSelected }}
                  onPress={() => toggleSupplement("none")}
                  style={({ pressed }) => [
                    styles.optionCard,
                    noneSelected && styles.optionCardSelected,
                    pressed && !noneSelected && styles.optionCardPressed,
                  ]}
                >
                  <Text style={[styles.optionLabel, noneSelected && styles.optionLabelSelected]}>
                    {SUPPLEMENT_LABELS["none"]}
                  </Text>
                  <View style={[styles.checkbox, noneSelected && styles.checkboxSelected]}>
                    {noneSelected ? <Feather name="check" size={12} color={colors.textPrimary} /> : null}
                  </View>
                </Pressable>
              </ScrollView>
            </View>

            <View style={styles.bottomContent}>
              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back to the cardio preference question"
                  hitSlop={8}
                  onPress={() => router.replace("/(profile)/wizard/step-14")}
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
                  Your answers are private and secure.{"\n"}You can change them later.
                </Text>
              </View>
            </View>
          </View>
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
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.20)" },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "28%",
    backgroundColor: "rgba(1, 5, 12, 0.28)",
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "22%",
    backgroundColor: "rgba(1, 5, 12, 0.44)",
  },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
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
  questionBlock: { gap: 6 },
  chapterLabel: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.25 },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 35,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { color: colors.textSecondary, fontSize: 16, lineHeight: 22 },
  listPanel: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.14)",
    backgroundColor: "rgba(3, 8, 18, 0.62)",
    overflow: "hidden",
  },
  listScroll: { flex: 1 },
  listContent: { padding: 10, gap: 5 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.20)",
    backgroundColor: "rgba(5, 12, 22, 0.52)",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
    minHeight: 46,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(37, 99, 235, 0.14)",
  },
  optionCardPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.82)",
  },
  optionLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 15,
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
  noneSeparator: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    marginVertical: 4,
  },
  errorMessage: { color: colors.error, fontSize: 13, lineHeight: 19 },
  bottomContent: { gap: 8 },
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
