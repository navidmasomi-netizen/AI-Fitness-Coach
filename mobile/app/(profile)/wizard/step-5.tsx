import { useState } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { getWizardTotalSteps } from "../../../src/constants/wizardLabels";
import { useWizardStepSave } from "../../../src/hooks/useWizardStepSave";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";

const stepFiveHero = require("../../../assets/images/onboarding/onboarding-step-5-equipment-hero.png");

const EQUIPMENT_OPTIONS = [
  {
    value: "barbell",
    title: "Barbell",
    image: require("../../../assets/images/onboarding/equipment-icons/barbell.png"),
    imageWidth: 78,
    imageHeight: 58,
  },
  {
    value: "dumbbell",
    title: "Dumbbell",
    image: require("../../../assets/images/onboarding/equipment-icons/dumbbell.png"),
    imageWidth: 68,
    imageHeight: 62,
  },
  {
    value: "machine",
    title: "Machine",
    image: require("../../../assets/images/onboarding/equipment-icons/machine.png"),
    imageWidth: 62,
    imageHeight: 66,
  },
  {
    value: "cable",
    title: "Cable",
    image: require("../../../assets/images/onboarding/equipment-icons/cable.png"),
    imageWidth: 64,
    imageHeight: 68,
  },
  {
    value: "bodyweight",
    title: "Bodyweight",
    image: require("../../../assets/images/onboarding/equipment-icons/bodyweight.png"),
    imageWidth: 66,
    imageHeight: 64,
  },
  {
    value: "pull_up_bar",
    title: "Pull-Up Bar",
    image: require("../../../assets/images/onboarding/equipment-icons/pull-up-bar.png"),
    imageWidth: 62,
    imageHeight: 70,
  },
] as const;

const EQUIPMENT_ROWS = [
  [EQUIPMENT_OPTIONS[0], EQUIPMENT_OPTIONS[1]],
  [EQUIPMENT_OPTIONS[2], EQUIPMENT_OPTIONS[3]],
  [EQUIPMENT_OPTIONS[4], EQUIPMENT_OPTIONS[5]],
] as const;

export default function WizardStepFiveScreen() {
  const currentStep = 5;
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const supplementUse = useWizardDraftStore((s) => s.supplementUse);
  const equipmentAccess = useWizardDraftStore((s) => s.equipmentAccess);
  const setEquipmentAccess = useWizardDraftStore((s) => s.setEquipmentAccess);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const toggleEquipment = (value: string) => {
    if (equipmentAccess.includes(value)) {
      setEquipmentAccess(equipmentAccess.filter((item) => item !== value));
    } else {
      setEquipmentAccess([...equipmentAccess, value]);
    }
  };

  const onContinue = async () => {
    if (equipmentAccess.length === 0) return;
    const didSave = await saveStep({ equipmentAccess }, 5);
    if (didSave) {
      router.push("/(profile)/wizard/step-6");
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const selectedCount = equipmentAccess.length;

  return (
    <View style={styles.root}>
      <ImageBackground source={stepFiveHero} resizeMode="cover" style={styles.background} accessible={false}>
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
                    What equipment{"\n"}do you have{"\n"}
                    <Text style={styles.questionAccent}>access to?</Text>
                  </Text>
                  <Text style={styles.coachingCopy}>
                    Select everything available to you — your program will be built around what you actually have.
                  </Text>
                </View>

                <View style={styles.equipmentSection}>
                  <View style={styles.equipmentGrid}>
                    {EQUIPMENT_ROWS.map((row, rowIndex) => (
                      <View key={rowIndex} style={styles.equipmentRow}>
                        {row.map((option) => {
                          const isSelected = equipmentAccess.includes(option.value);
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="checkbox"
                              accessibilityLabel={option.title}
                              accessibilityState={{ checked: isSelected }}
                              onPress={() => toggleEquipment(option.value)}
                              style={({ pressed }) => [
                                styles.equipmentTile,
                                isSelected && styles.equipmentTileSelected,
                                pressed && styles.equipmentTilePressed,
                              ]}
                            >
                              <View style={styles.tileTopRow}>
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                  {isSelected ? (
                                    <Ionicons name="checkmark" size={12} color={colors.textPrimary} />
                                  ) : null}
                                </View>
                              </View>
                              <Image
                                source={option.image}
                                style={{ width: option.imageWidth, height: option.imageHeight }}
                                resizeMode="contain"
                                accessible={false}
                              />
                              <Text style={[styles.tileTitle, isSelected && styles.tileTitleSelected]}>
                                {option.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>

                  {selectedCount > 0 ? (
                    <Text accessibilityRole="text" style={styles.selectedCount}>
                      {selectedCount} selected
                    </Text>
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
                    accessibilityLabel="Go back to the session duration question"
                    hitSlop={8}
                    onPress={() => router.replace("/(profile)/wizard/step-4")}
                    style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                  >
                    <Feather name="arrow-left" size={19} color={colors.textSecondary} />
                    <Text style={styles.backLabel}>Back</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Continue to the next onboarding question"
                    accessibilityState={{ disabled: selectedCount === 0 || isSaving, busy: isSaving }}
                    disabled={selectedCount === 0 || isSaving}
                    onPress={onContinue}
                    style={({ pressed }) => [
                      styles.continueButton,
                      (selectedCount === 0 || isSaving) && styles.continueButtonDisabled,
                      pressed && selectedCount > 0 && !isSaving && styles.continueButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.continueLabel,
                        (selectedCount === 0 || isSaving) && styles.continueLabelDisabled,
                      ]}
                    >
                      {isSaving ? "Saving..." : "Continue"}
                    </Text>
                    <Feather
                      name="arrow-right"
                      size={20}
                      color={selectedCount === 0 || isSaving ? colors.disabledText : colors.textPrimary}
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
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14 },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    justifyContent: "space-between",
    gap: 14,
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
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { maxWidth: 286, color: colors.textSecondary, fontSize: 15, lineHeight: 19 },
  equipmentSection: { gap: 5 },
  equipmentGrid: { gap: 6 },
  equipmentRow: { flexDirection: "row", gap: 8 },
  equipmentTile: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.34)",
    backgroundColor: "rgba(8, 18, 32, 0.86)",
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 7,
    alignItems: "center",
    justifyContent: "space-between",
  },
  equipmentTileSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(30, 64, 175, 0.44)",
  },
  equipmentTilePressed: { backgroundColor: "rgba(30, 41, 59, 0.88)" },
  tileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
    minHeight: 18,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(226, 232, 240, 0.46)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  tileTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  tileTitleSelected: { color: "#BFDBFE" },
  selectedCount: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  bottomContent: { gap: 8 },
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
