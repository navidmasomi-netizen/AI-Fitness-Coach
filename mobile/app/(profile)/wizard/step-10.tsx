import { useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { OCCUPATION_TYPE_LABELS, OCCUPATION_TYPE_SUB_COPY, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepTenHero = require("../../../assets/images/onboarding/onboarding-step-10-hero.png");

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  desk_job: require("../../../assets/images/onboarding/onboarding-step-10-icon-sitting.png"),
  active_job: require("../../../assets/images/onboarding/onboarding-step-10-icon-active.png"),
  mixed: require("../../../assets/images/onboarding/onboarding-step-10-icon-mixed.png"),
  student: require("../../../assets/images/onboarding/onboarding-step-10-icon-light-activity.png"),
  unemployed: require("../../../assets/images/onboarding/onboarding-step-10-icon-home.png"),
};

const OCCUPATION_TYPE_OPTIONS = ["desk_job", "active_job", "mixed", "student", "unemployed"];

export default function WizardStepTenScreen() {
  const currentStep = 10;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const occupationType = useWizardDraftStore((s) => s.occupationType);
  const setOccupationType = useWizardDraftStore((s) => s.setOccupationType);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (!occupationType || isSaving) return;
    const didSave = await saveStep({ occupationType }, 10);
    if (didSave) {
      router.push("/(profile)/wizard/step-11");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={stepTenHero} resizeMode="cover" style={styles.background} accessible={false}>
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
                  <Text style={styles.chapterLabel}>PERSONAL PROFILE</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    What does your{"\n"}
                    <Text style={styles.questionAccent}>typical day look like?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    Your daily activity level shapes how we calculate your total energy needs and recovery.
                  </Text>
                </View>
              </View>

              <View style={styles.bottomContent}>
                <View style={styles.optionList}>
                  {OCCUPATION_TYPE_OPTIONS.map((option) => {
                    const isSelected = occupationType === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={OCCUPATION_TYPE_LABELS[option]}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setOccupationType(option)}
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
                            {OCCUPATION_TYPE_LABELS[option]}
                          </Text>
                          <Text style={[styles.optionSubCopy, isSelected && styles.optionSubCopySelected]}>
                            {OCCUPATION_TYPE_SUB_COPY[option]}
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
                    accessibilityLabel="Go back to the weight question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-9")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: !occupationType || isSaving, busy: isSaving }}
                    disabled={!occupationType || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (!occupationType || isSaving) && styles.continueButtonDisabled,
                      pressed && !!occupationType && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.continueLabel,
                        (!occupationType || isSaving) && styles.continueLabelDisabled,
                      ]}
                    >
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={!occupationType || isSaving ? colors.disabledText : colors.textPrimary}
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
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.32)" },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "66%",
    backgroundColor: "rgba(1, 5, 12, 0.52)",
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
    height: "55%",
    backgroundColor: "rgba(1, 5, 12, 0.64)",
  },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  topContent: { gap: 22 },
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
  questionBlock: { gap: 10 },
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
  bottomContent: { gap: 10 },
  optionList: { gap: 8 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    backgroundColor: "rgba(5, 12, 22, 0.72)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  optionCardPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.86)",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  optionText: { flex: 1, gap: 2 },
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
