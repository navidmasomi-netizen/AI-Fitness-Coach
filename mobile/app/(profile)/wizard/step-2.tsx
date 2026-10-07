import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const TRAINING_LEVEL_OPTIONS = [
  { value: 'beginner', title: 'Beginner', description: 'New to structured training', icon: 'sprout-outline' },
  { value: 'intermediate', title: 'Intermediate', description: 'Training consistently and\nready to progress', icon: 'trending-up' },
  { value: 'advanced', title: 'Advanced', description: 'Experienced with structured,\nhigh-level training', icon: 'medal-outline' },
] as const;

export default function WizardStepTwoScreen() {
  const currentStep = 2;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const trainingLevel = useWizardDraftStore((state) => state.trainingLevel);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const setTrainingLevel = useWizardDraftStore((state) => state.setTrainingLevel);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (!trainingLevel) return;
    const didSave = await saveStep({ trainingLevel }, 2);
    if (didSave) router.push('/(profile)/wizard/step-3');
  };

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <WizardStepScreen
      title="What’s your training level?"
      subtitle="This helps me match the training intensity to your experience."
      currentStep={currentStep}
      totalSteps={totalSteps}
      primaryActionLabel="Continue"
      onPrimaryAction={onContinue}
      primaryActionDisabled={trainingLevel === null || isSaving}
      primaryActionLoading={isSaving}
      onBack={() => router.replace('/(profile)/wizard/step-1')}
      backAccessibilityLabel="Go back to the primary goal question"
      footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}
    >
      <View accessibilityRole="radiogroup" style={styles.optionList}>
        {TRAINING_LEVEL_OPTIONS.map((option) => {
          const icon = option.value === 'intermediate' ? (
            <Feather name="trending-up" size={spacing.xl} color={theme.colors.textSecondary} />
          ) : (
            <MaterialCommunityIcons name={option.icon} size={spacing.xl} color={theme.colors.textSecondary} />
          );
          return (
            <RunpuySelectableCard
              key={option.value}
              label={option.title}
              description={option.description}
              icon={icon}
              selected={trainingLevel === option.value}
              selectionRole="radio"
              onPress={() => setTrainingLevel(option.value)}
              accessibilityHint={option.description.replace('\n', ' ')}
              theme={theme}
            />
          );
        })}
      </View>
      {errorMessage ? <RunpuyText accessibilityRole="alert" theme={theme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
    </WizardStepScreen>
  );
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { const { theme } = useRunpuyTheme(); const styles = createStyles(theme);
  return <View style={styles.footerContent}>
    <Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}>
      <Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} />
    </Pressable>
    {isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={theme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}
    <View style={styles.privacyFooter}>
      <Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} />
      <RunpuyText theme={theme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText>
    </View>
  </View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({
  optionList: { gap: spacing.md }, errorMessage: { color: theme.colors.textPrimary }, footerContent: { alignItems: 'center', gap: spacing.sm },
  overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget },
  logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' },
} as const);
