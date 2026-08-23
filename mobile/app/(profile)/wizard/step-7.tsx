import { useState } from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const heroNeutral = require("../../../assets/images/onboarding/onboarding-step-7-sex-neutral-hero.jpg");
const heroMale = require("../../../assets/images/onboarding/onboarding-step-7-sex-male-hero.jpg");
const heroFemale = require("../../../assets/images/onboarding/onboarding-step-7-sex-female-hero.jpg");

const SEX_OPTIONS = [
  { value: "male", title: "Male", icon: "gender-male" as const },
  { value: "female", title: "Female", icon: "gender-female" as const },
] as const;

export default function WizardStepSevenScreen() {
  const currentStep = 7;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const sex = useWizardDraftStore((s) => s.sex);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const setSex = useWizardDraftStore((s) => s.setSex);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const activeHero =
    sex === "male"
      ? heroMale
      : sex === "female"
        ? heroFemale
        : heroNeutral;

  const onContinue = async () => {
    if (!sex) return;
    const didSave = await saveStep({ sex }, 7);
    if (didSave) {
      router.push("/(profile)/wizard/step-8");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={activeHero}
        resizeMode="cover"
        style={styles.background}
        accessible={false}
      >
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
                      accessibilityLabel={`Progress: step ${currentStep} of ${totalSteps}`}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
                      style={styles.progressTrack}
                    >
                      <View style={[styles.progressFill, { width: `${progressPercentage}%` as `${number}%` }]} />
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
                  <Text style={styles.chapterLabel}>PERSONAL PROFILE</Text>
                  <Text accessibilityRole="header" style={styles.questionTitle}>
                    {"What's your\n"}
                    <Text style={styles.questionAccent}>sex?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    This helps us tailor your training recommendations and personalize your program.
                  </Text>
                </View>

                <View style={styles.optionList}>
                  {SEX_OPTIONS.map((option) => {
                    const isSelected = sex === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityLabel={option.title}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setSex(option.value)}
                        style={({ pressed }) => [
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                          pressed && styles.optionCardPressed,
                        ]}
                      >
                        <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                          <MaterialCommunityIcons
                            name={option.icon}
                            size={22}
                            color={isSelected ? colors.accent : colors.iconMuted}
                          />
                        </View>
                        <View style={styles.optionCopy}>
                          <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                            {option.title}
                          </Text>
                        </View>
                        <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorSelected]}>
                          {isSelected ? <Ionicons name="checkmark" size={15} color={colors.textPrimary} /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

              </View>

              <View style={styles.bottomContent}>
                {errorMessage ? (
                  <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back to the age question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-6")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: sex === null || isSaving, busy: isSaving }}
                    disabled={sex === null || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (sex === null || isSaving) && styles.continueButtonDisabled,
                      pressed && sex !== null && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text style={[styles.continueLabel, (sex === null || isSaving) && styles.continueLabelDisabled]}>
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={sex === null || isSaving ? colors.disabledText : colors.textPrimary}
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
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  baseTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 5, 12, 0.08)",
  },
  leftReadabilityShade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "60%",
    backgroundColor: "rgba(1, 5, 12, 0.62)",
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
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 22,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 30,
  },
  topContent: {
    gap: 28,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  progressCopy: {
    gap: 10,
  },
  stepLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  progressTrack: {
    width: 172,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148, 163, 184, 0.34)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  overflowContainer: {
    alignItems: "flex-end",
  },
  overflowButton: {
    width: 42,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutAction: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(2, 6, 23, 0.88)",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  logoutActionText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  questionBlock: {
    gap: 12,
  },
  chapterLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 35,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: {
    color: colors.accent,
  },
  coachingCopy: {
    maxWidth: 300,
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
  },
  optionList: {
    gap: 11,
  },
  optionCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.34)",
    backgroundColor: "rgba(5, 12, 22, 0.72)",
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  optionCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(30, 64, 175, 0.34)",
  },
  optionCardPressed: {
    backgroundColor: "rgba(30, 41, 59, 0.86)",
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
    backgroundColor: "rgba(2, 6, 23, 0.46)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconSelected: {
    borderColor: "rgba(96, 165, 250, 0.72)",
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  optionTitleSelected: {
    color: "#BFDBFE",
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(226, 232, 240, 0.54)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndicatorSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  bottomContent: {
    gap: 14,
  },
  errorMessage: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
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
  backButtonPressed: {
    backgroundColor: "rgba(30, 41, 59, 0.86)",
  },
  backLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "700",
  },
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
  continueButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  continueButtonPressed: {
    backgroundColor: colors.accentPressed,
  },
  continueLabel: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  continueLabelDisabled: {
    color: colors.disabledText,
  },
  privacyFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: 8,
  },
  privacyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
});
