import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import {
  RunpuySelectableCard,
  RunpuyText,
} from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';
import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';

const GOAL_OPTIONS = [
  { value: 'hypertrophy', title: 'Muscle Growth', description: 'Build size and\nmuscle mass', icon: 'barbell-outline' },
  { value: 'strength', title: 'Strength', description: 'Get stronger and\nlift heavier', icon: 'arm-flex-outline' },
  { value: 'fat_loss', title: 'Fat Loss', description: 'Reduce body fat and\nget leaner', icon: 'flame-outline' },
  { value: 'recomposition', title: 'Body Recomposition', description: 'Build muscle while\nlosing fat', icon: 'sync-outline' },
] as const;

export default function WizardStepOneScreen() {
  const currentStep = 1;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const goal = useWizardDraftStore((state) => state.goal);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const setGoal = useWizardDraftStore((state) => state.setGoal);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (!goal) return;

    const didSave = await saveStep({ goal }, 1);
    if (didSave) router.push('/(profile)/wizard/step-2');
  };

  const onLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <WizardStepScreen
      title="What’s your primary goal?"
      subtitle="This helps me prioritize your training plan."
      currentStep={currentStep}
      totalSteps={totalSteps}
      primaryActionLabel="Continue"
      onPrimaryAction={onContinue}
      primaryActionDisabled={goal === null || isSaving}
      primaryActionLoading={isSaving}
      footer={
        <Footer
          isOverflowOpen={isOverflowOpen}
          onToggleOverflow={() => setIsOverflowOpen((current) => !current)}
          onLogout={onLogout}
        />
      }
    >
      <View accessibilityRole="radiogroup" style={styles.optionList}>
        {GOAL_OPTIONS.map((option) => {
          const selected = goal === option.value;
          const icon = option.value === 'strength' ? (
            <MaterialCommunityIcons name="arm-flex-outline" size={spacing.xl} color={theme.colors.textSecondary} />
          ) : (
            <Ionicons name={option.icon} size={spacing.xl} color={theme.colors.textSecondary} />
          );

          return (
            <RunpuySelectableCard
              key={option.value}
              label={option.title}
              description={option.description}
              icon={icon}
              selected={selected}
              selectionRole="radio"
              onPress={() => setGoal(option.value)}
              accessibilityHint={option.description.replace('\n', ' ')}
              theme={theme}
            />
          );
        })}
      </View>
      {errorMessage ? (
        <RunpuyText accessibilityRole="alert" theme={theme} variant="caption" style={styles.errorMessage}>
          {errorMessage}
        </RunpuyText>
      ) : null}
    </WizardStepScreen>
  );
}

function Footer({
  isOverflowOpen,
  onToggleOverflow,
  onLogout,
}: {
  isOverflowOpen: boolean;
  onToggleOverflow: () => void;
  onLogout: () => void | Promise<void>;
}) { const { theme } = useRunpuyTheme(); const styles = createStyles(theme);
  return (
    <View style={styles.footerContent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More onboarding options"
        accessibilityState={{ expanded: isOverflowOpen }}
        onPress={onToggleOverflow}
        style={styles.overflowButton}
      >
        <Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} />
      </Pressable>
      {isOverflowOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}>
          <RunpuyText theme={theme} variant="caption" tone="secondary">Log out</RunpuyText>
        </Pressable>
      ) : null}
      <View style={styles.privacyFooter}>
        <Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} />
        <RunpuyText theme={theme} variant="caption" tone="secondary" style={styles.privacyText}>
          Your answers are private and secure.{'\n'}You can change them later.
        </RunpuyText>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({
  optionList: { gap: spacing.md },
  errorMessage: { color: theme.colors.error },
  footerContent: { alignItems: 'center', gap: spacing.sm },
  overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget },
  logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  privacyText: { textAlign: 'center' },
} as const);
