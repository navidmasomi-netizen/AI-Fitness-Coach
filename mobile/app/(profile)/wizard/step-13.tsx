import { useState } from "react";
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepThirteenBg = require("../../../assets/images/onboarding/onboarding-step-13-meal-frequency-background.png");

const MIN_MEALS = 1;
const MAX_MEALS = 6;

export default function WizardStepThirteenScreen() {
  const currentStep = 13;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const mealFrequency = useWizardDraftStore((s) => s.mealFrequency);
  const setMealFrequency = useWizardDraftStore((s) => s.setMealFrequency);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  // Local display value: hydrate from store if valid, otherwise default to 3.
  // This does NOT persist the default — only a Continue press saves the value.
  const [localValue, setLocalValue] = useState<number>(
    mealFrequency !== null && mealFrequency >= MIN_MEALS && mealFrequency <= MAX_MEALS
      ? mealFrequency
      : 3
  );

  const atMin = localValue <= MIN_MEALS;
  const atMax = localValue >= MAX_MEALS;

  const decrement = () => {
    if (atMin) return;
    const next = localValue - 1;
    setLocalValue(next);
    setMealFrequency(next);
  };

  const increment = () => {
    if (atMax) return;
    const next = localValue + 1;
    setLocalValue(next);
    setMealFrequency(next);
  };

  const onContinue = async () => {
    if (isSaving) return;
    const didSave = await saveStep({ mealFrequency: localValue }, 13);
    if (didSave) {
      router.push("/(profile)/wizard/step-14");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const unitLabel = localValue === 1 ? "meal/day" : "meals/day";

  return (
    <View style={styles.root}>
      <ImageBackground source={stepThirteenBg} resizeMode="cover" style={styles.background} accessible={false}>
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShadeA} />
        <View pointerEvents="none" style={styles.bottomShadeB} />
        <View pointerEvents="none" style={styles.bottomShadeC} />

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
                  <Text style={styles.chapterLabel}>NUTRITION & LIFESTYLE</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    How many meals do{"\n"}
                    <Text style={styles.questionAccent}>you usually eat per day?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    This gives us context about your usual eating routine for future nutrition coaching.
                  </Text>
                </View>
              </View>

              <View style={styles.stepperPanel}>
                <View style={styles.stepperRow}>
                  <View style={styles.stepperButtonSlot}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease meals per day"
                      accessibilityState={{ disabled: atMin }}
                      disabled={atMin}
                      onPress={decrement}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        atMin && styles.stepperButtonDisabled,
                        pressed && !atMin && styles.stepperButtonPressed,
                      ]}
                    >
                      <Feather
                        name="minus"
                        size={22}
                        color={atMin ? colors.disabledText : colors.textPrimary}
                      />
                    </Pressable>
                  </View>

                  <View
                    style={styles.stepperValueBlock}
                    accessible
                    accessibilityLabel={`${localValue} ${unitLabel}`}
                  >
                    <Text style={styles.stepperNumber}>{localValue}</Text>
                    <Text style={styles.stepperUnit}>{unitLabel}</Text>
                  </View>

                  <View style={[styles.stepperButtonSlot, styles.stepperButtonSlotRight]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase meals per day"
                      accessibilityState={{ disabled: atMax }}
                      disabled={atMax}
                      onPress={increment}
                      style={({ pressed }) => [
                        styles.stepperButton,
                        atMax && styles.stepperButtonDisabled,
                        pressed && !atMax && styles.stepperButtonPressed,
                      ]}
                    >
                      <Feather
                        name="plus"
                        size={22}
                        color={atMax ? colors.disabledText : colors.textPrimary}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.helperRow}>
                  <Text style={styles.helperText}>Choose between 1 and 6 meals</Text>
                </View>
              </View>

              <View style={styles.bottomContent}>
                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the eating habits question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-12")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: isSaving, busy: isSaving }}
                    disabled={isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      isSaving && styles.continueButtonDisabled,
                      pressed && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text style={[styles.continueLabel, isSaving && styles.continueLabelDisabled]}>
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={isSaving ? colors.disabledText : colors.textPrimary}
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
  disabledText: "rgba(226, 232, 240, 0.42)",
  error: "#FCA5A5",
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.10)" },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
    backgroundColor: "rgba(1, 5, 12, 0.22)",
  },
  // Gradient-simulated bottom shade: three overlapping layers give a smooth
  // top-to-bottom darkening without a hard horizontal band.
  // Effective opacity at top of zone (~56% from top): baseTone(0.10) + shadeA(0.18) ≈ 0.26
  // At mid zone: + shadeB(0.18) ≈ 0.41
  // At very bottom: + shadeC(0.20) ≈ 0.55 — enough for CTA readability.
  bottomShadeA: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "56%",
    backgroundColor: "rgba(1, 5, 12, 0.18)",
  },
  bottomShadeB: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "38%",
    backgroundColor: "rgba(1, 5, 12, 0.18)",
  },
  bottomShadeC: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "20%",
    backgroundColor: "rgba(1, 5, 12, 0.20)",
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
  },
  topContent: { gap: 16 },
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
    fontSize: 33,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { maxWidth: 320, color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  bottomContent: { gap: 8 },
  stepperPanel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.36)",
    backgroundColor: "rgba(5, 12, 30, 0.78)",
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 16,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepperButtonSlot: {
    flex: 1,
    alignItems: "flex-start",
  },
  stepperButtonSlotRight: {
    alignItems: "flex-end",
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(37, 99, 235, 0.54)",
    backgroundColor: "rgba(37, 99, 235, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonDisabled: {
    borderColor: "rgba(148, 163, 184, 0.18)",
    backgroundColor: "rgba(15, 23, 42, 0.30)",
  },
  stepperButtonPressed: {
    backgroundColor: "rgba(37, 99, 235, 0.28)",
  },
  stepperValueBlock: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  stepperNumber: {
    color: colors.textPrimary,
    fontSize: 64,
    fontWeight: "800",
    lineHeight: 68,
    letterSpacing: -2,
  },
  stepperUnit: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  helperRow: {
    alignItems: "center",
  },
  helperText: {
    color: "rgba(148, 163, 184, 0.68)",
    fontSize: 13,
    fontWeight: "400",
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
