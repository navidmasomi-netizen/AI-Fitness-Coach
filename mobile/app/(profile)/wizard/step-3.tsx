import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyCard, RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const TRAINING_DAY_ROWS = [[1, 2, 3, 4], [5, 6, 7]] as const;

export default function WizardStepThreeScreen() {
  const currentStep = 3;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const trainingDaysPerWeek = useWizardDraftStore((state) => state.trainingDaysPerWeek);
  const setTrainingDaysPerWeek = useWizardDraftStore((state) => state.setTrainingDaysPerWeek);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (trainingDaysPerWeek === null) return;
    const didSave = await saveStep({ trainingDaysPerWeek }, 3);
    if (didSave) router.push('/(profile)/wizard/step-4');
  };

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const selectedDayLabel = trainingDaysPerWeek === 1 ? '1 training day per week' : `${trainingDaysPerWeek} training days per week`;

  return (
    <WizardStepScreen
      title="How many days per week do you train?"
      subtitle="Choose a schedule you can realistically maintain."
      currentStep={currentStep}
      totalSteps={totalSteps}
      primaryActionLabel="Continue"
      onPrimaryAction={onContinue}
      primaryActionDisabled={trainingDaysPerWeek === null || isSaving}
      primaryActionLoading={isSaving}
      onBack={() => router.replace('/(profile)/wizard/step-2')}
      backAccessibilityLabel="Go back to the training level question"
      footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}
    >
      <View accessibilityRole="radiogroup" style={styles.frequencyGrid}>
        {TRAINING_DAY_ROWS.map((row) => (
          <View key={row[0]} style={styles.frequencyRow}>
            {row.map((option) => {
              const dayLabel = option === 1 ? 'DAY' : 'DAYS';
              const accessibilityLabel = option === 1 ? '1 training day per week' : `${option} training days per week`;
              return (
                <RunpuySelectableCard
                  key={option}
                  label={`${option} ${dayLabel}`}
                  icon={<MaterialCommunityIcons name="calendar-week-outline" size={spacing.lg} color={darkTheme.colors.textSecondary} />}
                  selected={trainingDaysPerWeek === option}
                  selectionRole="radio"
                  onPress={() => setTrainingDaysPerWeek(option)}
                  accessibilityLabel={accessibilityLabel}
                  theme={darkTheme}
                  style={styles.frequencyCard}
                />
              );
            })}
          </View>
        ))}
      </View>
      {trainingDaysPerWeek !== null ? (
        <RunpuyCard theme={darkTheme} style={styles.summaryCard}>
          <MaterialCommunityIcons name="calendar-check-outline" size={spacing.xl} color={darkTheme.colors.actionPrimary} />
          <View style={styles.summaryCopy}>
            <RunpuyText theme={darkTheme} variant="title">{selectedDayLabel}</RunpuyText>
            <RunpuyText theme={darkTheme} variant="caption" tone="secondary">We’ll build your plan around this{'\n'}schedule to help you stay consistent.</RunpuyText>
          </View>
        </RunpuyCard>
      ) : null}
      {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
    </WizardStepScreen>
  );
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  return <View style={styles.footerContent}>
    <Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}>
      <Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} />
    </Pressable>
    {isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}
    <View style={styles.privacyFooter}>
      <Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} />
      <RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText>
    </View>
  </View>;
}

const styles = {
  frequencyGrid: { gap: spacing.md }, frequencyRow: { flexDirection: 'row', gap: spacing.md }, frequencyCard: { flex: 1 },
  summaryCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md }, summaryCopy: { flex: 1, gap: spacing.xs }, errorMessage: { color: darkTheme.colors.error },
  footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget },
  logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' },
} as const;
