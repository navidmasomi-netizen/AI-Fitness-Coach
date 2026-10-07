import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const EQUIPMENT_OPTIONS = [
  { value: 'barbell', title: 'Barbell' },
  { value: 'dumbbell', title: 'Dumbbell' },
  { value: 'machine', title: 'Machine' },
  { value: 'cable', title: 'Cable' },
  { value: 'bodyweight', title: 'Bodyweight' },
  { value: 'pull_up_bar', title: 'Pull-Up Bar' },
] as const;

export default function WizardStepFiveScreen() {
  const currentStep = 5;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const equipmentAccess = useWizardDraftStore((state) => state.equipmentAccess);
  const setEquipmentAccess = useWizardDraftStore((state) => state.setEquipmentAccess);
  const totalSteps = getWizardTotalSteps(supplementUse);
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
    if (didSave) router.push('/(profile)/wizard/step-6');
  };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const selectedCount = equipmentAccess.length;

  return (
    <WizardStepScreen
      title="What equipment do you have access to?"
      subtitle="Select everything available to you — your program will be built around what you actually have."
      currentStep={currentStep}
      totalSteps={totalSteps}
      primaryActionLabel="Continue"
      onPrimaryAction={onContinue}
      primaryActionDisabled={selectedCount === 0 || isSaving}
      primaryActionLoading={isSaving}
      onBack={() => router.replace('/(profile)/wizard/step-4')}
      backAccessibilityLabel="Go back to the session duration question"
      footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}
    >
      <View accessibilityRole="none" style={styles.equipmentList}>
        {EQUIPMENT_OPTIONS.map((option) => (
          <RunpuySelectableCard
            key={option.value}
            label={option.title}
            selected={equipmentAccess.includes(option.value)}
            selectionRole="checkbox"
            onPress={() => toggleEquipment(option.value)}
            theme={theme}
          />
        ))}
      </View>
      {selectedCount > 0 ? <RunpuyText accessibilityRole="text" theme={theme} variant="caption" tone="secondary" style={styles.selectedCount}>{selectedCount} selected</RunpuyText> : null}
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
  equipmentList: { gap: spacing.md }, selectedCount: { color: theme.colors.actionPrimary, textAlign: 'center' }, errorMessage: { color: theme.colors.error },
  footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget },
  logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' },
} as const);
