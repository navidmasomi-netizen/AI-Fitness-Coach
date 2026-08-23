import { useState } from "react";
import { ImageBackground, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepEightHero = require("../../../assets/images/onboarding/onboarding-step-8-height-hero.jpg");

export default function WizardStepEightScreen() {
  const currentStep = 8;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const heightCm = useWizardDraftStore((s) => s.heightCm);
  const setHeightCm = useWizardDraftStore((s) => s.setHeightCm);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [heightInput, setHeightInput] = useState(heightCm !== null ? String(heightCm) : "");

  const parsedHeight = Number(heightInput);
  const isHeightValid = Number.isInteger(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 250;
  const showError = heightInput.length > 0 && !isHeightValid;

  const onContinue = async () => {
    if (!isHeightValid) return;
    Keyboard.dismiss();
    const didSave = await saveStep({ heightCm: parsedHeight }, 8);
    if (didSave) {
      setHeightCm(parsedHeight);
      router.push("/(profile)/wizard/step-9");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={stepEightHero} resizeMode="cover" style={styles.background} accessible={false}>
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
            automaticallyAdjustKeyboardInsets={true}
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
                    How tall{"\n"}
                    <Text style={styles.questionAccent}>are you?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    Your height helps us calibrate exercises, range of motion, and training loads.
                  </Text>
                </View>

                <View style={styles.heightCard}>
                  <TextInput
                    accessibilityLabel="Your height in centimetres"
                    value={heightInput}
                    onChangeText={(value) => {
                      setHeightInput(value);
                      const nextValue = Number(value);
                      if (value.length === 0) {
                        setHeightCm(null);
                      } else if (Number.isInteger(nextValue) && nextValue >= 100 && nextValue <= 250) {
                        setHeightCm(nextValue);
                      }
                    }}
                    onSubmitEditing={Keyboard.dismiss}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={3}
                    placeholder="—"
                    placeholderTextColor={colors.inputPlaceholder}
                    style={styles.heightInput}
                    selectionColor={colors.accent}
                  />
                  <Text style={styles.heightUnit}>cm</Text>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardHints}>
                    <Text style={styles.cardHintPrimary}>Tap number to type</Text>
                    <Text style={styles.cardHintRange}>100–250 cm</Text>
                  </View>
                </View>
              </View>

              <View style={styles.bottomContent}>
                {showError ? (
                  <Text accessibilityRole="alert" style={styles.validationError}>
                    Height must be between 100 and 250 cm.
                  </Text>
                ) : null}

                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the sex question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-7")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: !isHeightValid || isSaving, busy: isSaving }}
                    disabled={!isHeightValid || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (!isHeightValid || isSaving) && styles.continueButtonDisabled,
                      pressed && isHeightValid && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.continueLabel,
                        (!isHeightValid || isSaving) && styles.continueLabelDisabled,
                      ]}
                    >
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={!isHeightValid || isSaving ? colors.disabledText : colors.textPrimary}
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
  inputPlaceholder: "rgba(226, 232, 240, 0.22)",
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
  heightCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    backgroundColor: "rgba(5, 12, 22, 0.78)",
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 0,
  },
  heightInput: {
    color: colors.textPrimary,
    fontSize: 72,
    lineHeight: 82,
    fontWeight: "800",
    letterSpacing: -2,
    textAlign: "center",
    width: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  heightUnit: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginTop: 4,
  },
  cardDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    marginTop: 20,
    marginBottom: 14,
  },
  cardHints: { alignItems: "center", gap: 4 },
  cardHintPrimary: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  cardHintRange: { color: "rgba(148, 163, 184, 0.58)", fontSize: 12, fontWeight: "500" },
  bottomContent: { gap: 8 },
  validationError: { color: colors.error, fontSize: 13, lineHeight: 19 },
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
