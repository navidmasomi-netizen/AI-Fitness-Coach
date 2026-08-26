import { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ApiError } from "../../../src/api/client";
import { completeProfile } from "../../../src/api/profile";
import { generateProgram } from "../../../src/api/programs";
import {
  CARDIO_PREFERENCE_LABELS,
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  INJURY_FLAG_LABELS,
  NUTRITION_HABITS_LABELS,
  OCCUPATION_TYPE_LABELS,
  RECOVERY_QUALITY_LABELS,
  SEX_LABELS,
  SUPPLEMENT_LABELS,
  TRAINING_LEVEL_LABELS,
  getLabel,
  getLabelList,
  getWizardStepNumber,
  getWizardTotalSteps,
} from "../../../src/constants/wizardLabels";
import { useAuthStore } from "../../../src/store/authStore";
import { useWizardDraftStore } from "../../../src/store/wizardDraftStore";
import { resetWizardDraft } from "../../../src/store/wizardHydrate";

const stepEighteenBackground = require("../../../assets/images/onboarding/onboarding-step-18-profile-summary-background.png");

// ─── Helper components ────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconTile}>
        <Feather name={icon} size={13} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatTrainingDays(n: number | null): string {
  if (n === null) return "Not provided";
  return n === 1 ? "1 day/week" : `${n} days/week`;
}

function formatMealFrequency(n: number | null): string {
  if (n === null) return "Not provided";
  return n === 1 ? "1 meal/day" : `${n} meals/day`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WizardStepEighteenScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const draft = useWizardDraftStore();
  const totalSteps = getWizardTotalSteps(draft.supplementUse);
  const currentStep = getWizardStepNumber(18, draft.supplementUse);
  const progressPercentage = (currentStep / totalSteps) * 100;
  const progressWidth = `${progressPercentage}%` as `${number}%`;
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGoHomeAction, setShowGoHomeAction] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const backDestination =
    draft.injuryFlags.includes("none") || draft.injuryFlags.length === 0
      ? "/(profile)/wizard/step-16"
      : "/(profile)/wizard/step-17";

  const onBack = () => {
    if (isGenerating) return;
    router.replace(backDestination);
  };

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  function getGenerationErrorMessage(error: unknown): string {
    if (!(error instanceof ApiError)) {
      return "Something went wrong while generating your program. Please try again.";
    }
    if (error.status === 0) {
      return "Couldn't reach the server. Check your connection and try again.";
    }
    if (error.status === 401) {
      return "Your session expired. Please log in again.";
    }
    if (error.status === 404) {
      return "We couldn't find your profile. Please try again.";
    }
    if (error.status === 400) {
      return "Your profile isn't fully complete yet. Please review your answers.";
    }
    if (error.status === 409) {
      return "You already have an active program.";
    }
    if (error.status === 422) {
      return "We couldn't build a program with your current equipment and injury settings. Try adjusting your profile and retrying.";
    }
    return "Something went wrong while generating your program. Please try again.";
  }

  const onCreateProgram = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMessage(null);
    setShowGoHomeAction(false);
    try {
      await completeProfile();
      await generateProgram();
      resetWizardDraft();
      router.replace("/");
    } catch (error) {
      setErrorMessage(getGenerationErrorMessage(error));
      setShowGoHomeAction(error instanceof ApiError && error.status === 409);
    }
    setIsGenerating(false);
  };

  const showSupplementOther =
    draft.supplementUse.includes("other") && !!draft.supplementOther;
  const showInjuryNotes = !!draft.injuryNotes;

  return (
    <View style={styles.root}>
      <ImageBackground
        source={stepEighteenBackground}
        resizeMode="cover"
        style={styles.background}
        imageStyle={styles.backgroundImage}
        accessible={false}
      >
        <View pointerEvents="none" style={styles.baseTone} />
        <View pointerEvents="none" style={styles.topShade} />
        <View pointerEvents="none" style={styles.bottomShade} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.content}>

            {/* ── Header ── */}
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
                <Text style={styles.chapterLabel}>READY TO BUILD</Text>
                <Text accessibilityRole="header" style={styles.questionTitle}>
                  Your fitness profile{"\n"}is{" "}
                  <Text style={styles.questionAccent}>ready</Text>
                </Text>
                <Text style={styles.coachingCopy}>
                  Review your answers, then we'll build your training program.
                </Text>
              </View>
            </View>

            {/* ── Summary glass panel (bounded scroll) ── */}
            <View style={styles.summaryCard}>
              <ScrollView
                style={styles.summaryScroll}
                contentContainerStyle={styles.summaryContent}
                showsVerticalScrollIndicator
                bounces={false}
              >

                {/* TRAINING */}
                <SectionHeader icon="activity" title="TRAINING" />
                <SummaryRow label="Goal" value={getLabel(GOAL_LABELS, draft.goal)} />
                <SummaryRow label="Training level" value={getLabel(TRAINING_LEVEL_LABELS, draft.trainingLevel)} />
                <SummaryRow label="Training days" value={formatTrainingDays(draft.trainingDaysPerWeek)} />
                <SummaryRow
                  label="Session duration"
                  value={draft.sessionDurationMin !== null ? `${draft.sessionDurationMin} minutes` : "Not provided"}
                />
                <SummaryRow
                  label="Equipment"
                  value={getLabelList(EQUIPMENT_LABELS, draft.equipmentAccess)}
                  isLast
                />

                <View style={styles.sectionDivider} />

                {/* BODY */}
                <SectionHeader icon="user" title="BODY" />
                <SummaryRow label="Age" value={draft.age !== null ? String(draft.age) : "Not provided"} />
                <SummaryRow label="Sex" value={getLabel(SEX_LABELS, draft.sex)} />
                <SummaryRow label="Height" value={draft.heightCm !== null ? `${draft.heightCm} cm` : "Not provided"} />
                <SummaryRow label="Weight" value={draft.weightKg !== null ? `${draft.weightKg} kg` : "Not provided"} isLast />

                <View style={styles.sectionDivider} />

                {/* LIFESTYLE & NUTRITION */}
                <SectionHeader icon="coffee" title="LIFESTYLE & NUTRITION" />
                <SummaryRow label="Daily activity" value={getLabel(OCCUPATION_TYPE_LABELS, draft.occupationType)} />
                <SummaryRow label="Nutrition habits" value={getLabel(NUTRITION_HABITS_LABELS, draft.nutritionHabits)} />
                <SummaryRow label="Meal frequency" value={formatMealFrequency(draft.mealFrequency)} />
                <SummaryRow label="Cardio preference" value={getLabel(CARDIO_PREFERENCE_LABELS, draft.cardioPreference)} />
                <SummaryRow
                  label="Supplements"
                  value={getLabelList(SUPPLEMENT_LABELS, draft.supplementUse)}
                  isLast={!showSupplementOther}
                />
                {showSupplementOther ? (
                  <SummaryRow label="Other supplements" value={draft.supplementOther!} isLast />
                ) : null}

                <View style={styles.sectionDivider} />

                {/* RECOVERY & SAFETY */}
                <SectionHeader icon="shield" title="RECOVERY & SAFETY" />
                <SummaryRow label="Recovery quality" value={getLabel(RECOVERY_QUALITY_LABELS, draft.recoveryQuality)} />
                <SummaryRow
                  label="Injuries & limitations"
                  value={getLabelList(INJURY_FLAG_LABELS, draft.injuryFlags)}
                  isLast={!showInjuryNotes}
                />
                {showInjuryNotes ? (
                  <SummaryRow label="Injury notes" value={draft.injuryNotes!} isLast />
                ) : null}

              </ScrollView>
            </View>

            {/* ── Bottom: error + actions + footer ── */}
            <View style={styles.bottomContent}>
              {errorMessage ? (
                <Text accessibilityRole="alert" style={styles.errorMessage}>
                  {errorMessage}
                </Text>
              ) : null}
              {showGoHomeAction ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go to home screen"
                  onPress={() => router.replace("/")}
                  style={styles.goHomeAction}
                >
                  <Text style={styles.goHomeLabel}>Go to Home</Text>
                </Pressable>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back to review your previous answers"
                  accessibilityState={{ disabled: isGenerating }}
                  disabled={isGenerating}
                  hitSlop={8}
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.backButton,
                    isGenerating && styles.backButtonDisabled,
                    pressed && !isGenerating && styles.backButtonPressed,
                  ]}
                >
                  <Feather
                    name="arrow-left"
                    size={19}
                    color={isGenerating ? colors.disabledText : colors.textSecondary}
                  />
                  <Text style={[styles.backLabel, isGenerating && styles.backLabelDisabled]}>
                    Back
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isGenerating ? "Building your program" : "Build my AI program"}
                  accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
                  disabled={isGenerating}
                  onPress={onCreateProgram}
                  style={({ pressed }) => [
                    styles.ctaButton,
                    isGenerating && styles.ctaButtonDisabled,
                    pressed && !isGenerating && styles.ctaButtonPressed,
                  ]}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color={colors.textPrimary} />
                  ) : (
                    <Feather name="zap" size={16} color={colors.textPrimary} />
                  )}
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[styles.ctaLabel, isGenerating && styles.ctaLabelDisabled]}
                  >
                    {isGenerating ? "Building your program..." : "Build My AI Program"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.privacyFooter}>
                <Feather name="lock" size={15} color={colors.textMuted} />
                <Text style={styles.privacyText}>Your answers are private and secure.</Text>
              </View>
            </View>

          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

// ─── Colors ───────────────────────────────────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { flex: 1, backgroundColor: colors.background },
  backgroundImage: {
    // Shift image upward so the upper-right luminous wave is more present,
    // and pull image rightward to reduce over-cropping on that side.
    transform: [{ translateY: -30 }, { translateX: -18 }],
  },
  baseTone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(1, 5, 12, 0.10)",
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
    backgroundColor: "rgba(1, 5, 12, 0.14)",
  },
  bottomShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "25%",
    backgroundColor: "rgba(1, 5, 12, 0.42)",
  },
  safeArea: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
  },

  // Header
  topContent: { gap: 12 },
  progressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
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
  chapterLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.25,
  },
  questionTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  questionAccent: { color: colors.accent },
  coachingCopy: { color: colors.textSecondary, fontSize: 15, lineHeight: 21 },

  // Summary glass panel
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    backgroundColor: "rgba(3, 8, 18, 0.58)",
    overflow: "hidden",
  },
  summaryScroll: { flex: 1 },
  summaryContent: { padding: 16, paddingBottom: 12 },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  sectionIconTile: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "rgba(37, 99, 235, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    marginVertical: 14,
  },

  // Summary rows
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    gap: 12,
  },
  rowLabel: {
    flex: 2,
    color: "rgba(148, 163, 184, 0.72)",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  rowValue: {
    flex: 3,
    color: "rgba(226, 232, 240, 0.90)",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
    textAlign: "right",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "rgba(148, 163, 184, 0.10)",
  },

  // Bottom content
  bottomContent: { gap: 8 },
  errorMessage: { color: colors.error, fontSize: 13, lineHeight: 19 },
  goHomeAction: { alignSelf: "flex-start" },
  goHomeLabel: { color: colors.accent, fontSize: 13, fontWeight: "700" },
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
  backButtonDisabled: { opacity: 0.45 },
  backButtonPressed: { backgroundColor: "rgba(30, 41, 59, 0.86)" },
  backLabel: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
  backLabelDisabled: { color: colors.disabledText },
  ctaButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  ctaButtonDisabled: { backgroundColor: colors.disabled },
  ctaButtonPressed: { backgroundColor: colors.accentPressed },
  ctaLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  ctaLabelDisabled: { color: colors.disabledText },
  privacyFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  privacyText: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});
