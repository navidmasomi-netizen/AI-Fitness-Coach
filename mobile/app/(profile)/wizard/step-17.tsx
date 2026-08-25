import { useState } from "react";
import {
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getWizardStepNumber, getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepSeventeenBackground = require("../../../assets/images/onboarding/onboarding-step-17-injury-notes-background.png");

export default function WizardStepSeventeenScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const injuryNotes = useWizardDraftStore((s) => s.injuryNotes);
  const setInjuryNotes = useWizardDraftStore((s) => s.setInjuryNotes);
  const [injuryNotesInput, setInjuryNotesInput] = useState(injuryNotes || "");
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(17, supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (isSaving) return;
    const didSave = await saveStep({ injuryNotes }, currentStep);
    if (didSave) {
      router.push("/(profile)/wizard/step-18");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.root}>
        <ImageBackground
          source={stepSeventeenBackground}
          resizeMode="cover"
          style={styles.background}
          accessible={false}
        >
          <View pointerEvents="none" style={styles.baseTone} />
          <View pointerEvents="none" style={styles.topShade} />
          <View pointerEvents="none" style={styles.bottomShade} />

          <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardAvoid}
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
                      Tell us more about{"\n"}your{" "}
                      <Text style={styles.questionAccent}>injuries</Text>
                    </Text>
                    <Text style={styles.coachingCopy}>
                      Add any details you'd like us to keep with your profile.
                    </Text>
                  </View>
                </View>

                <View style={styles.inputPanel}>
                  <View style={styles.inputHeader}>
                    <Text style={styles.optionalLabel}>Optional</Text>
                    {injuryNotesInput.length > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss keyboard"
                        onPress={Keyboard.dismiss}
                        hitSlop={8}
                      >
                        <Text style={styles.doneLabel}>Done</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <TextInput
                    accessibilityLabel="Injury notes (optional)"
                    accessibilityHint="Describe any injuries or limitations in more detail"
                    value={injuryNotesInput}
                    onChangeText={(value) => {
                      setInjuryNotesInput(value);
                      setInjuryNotes(value.length > 0 ? value : null);
                    }}
                    multiline
                    placeholder="E.g. left knee pain when squatting, previous shoulder injury..."
                    placeholderTextColor={colors.textPlaceholder}
                    style={styles.textInput}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.spacer} />

                <View style={styles.bottomContent}>
                  {errorMessage ? (
                    <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Go back to the injury flags question"
                      hitSlop={8}
                      onPress={() => router.replace("/(profile)/wizard/step-16")}
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
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ImageBackground>
      </View>
    </TouchableWithoutFeedback>
  );
}

const colors = {
  background: "#020617",
  textPrimary: "#F8FAFC",
  textSecondary: "rgba(226, 232, 240, 0.84)",
  textMuted: "rgba(148, 163, 184, 0.96)",
  textPlaceholder: "rgba(148, 163, 184, 0.52)",
  accent: "#2563EB",
  accentPressed: "#1D4ED8",
  disabled: "rgba(37, 99, 235, 0.42)",
  disabledText: "rgba(226, 232, 240, 0.64)",
  error: "#FCA5A5",
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  baseTone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(1, 5, 12, 0.22)" },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
    backgroundColor: "rgba(1, 5, 12, 0.28)",
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "22%",
    backgroundColor: "rgba(1, 5, 12, 0.08)",
  },
  safeArea: { flex: 1 },
  keyboardAvoid: { flex: 1 },
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
  inputPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.16)",
    backgroundColor: "rgba(3, 8, 18, 0.64)",
    padding: 14,
    gap: 8,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionalLabel: {
    color: "rgba(148, 163, 184, 0.60)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  doneLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  textInput: {
    height: 200,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    textAlignVertical: "top",
  },
  spacer: { flex: 1 },
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
