import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { RECOVERY_QUALITY_LABELS, RECOVERY_QUALITY_SUB_COPY, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  low: require('../../../assets/images/onboarding/onboarding-step-11-icon-low-recovery.png'),
  medium: require('../../../assets/images/onboarding/onboarding-step-11-icon-medium-recovery.png'),
  high: require('../../../assets/images/onboarding/onboarding-step-11-icon-high-recovery.png'),
};
const RECOVERY_OPTIONS = ['low', 'medium', 'high'];

export default function WizardStepElevenScreen() {
  const currentStep = 11;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const recoveryQuality = useWizardDraftStore((state) => state.recoveryQuality);
  const setRecoveryQuality = useWizardDraftStore((state) => state.setRecoveryQuality);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const onContinue = async () => { if (!recoveryQuality || isSaving) return; const didSave = await saveStep({ recoveryQuality }, 11); if (didSave) router.push('/(profile)/wizard/step-12'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return <WizardStepScreen title="How well do you recover between sessions?" subtitle="Your recovery helps us adjust training volume, rest, and weekly workload." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!recoveryQuality || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-10')} backAccessibilityLabel="Go back to the daily activity question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View accessibilityRole="radiogroup" style={styles.optionList}>{RECOVERY_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={RECOVERY_QUALITY_LABELS[option]} description={RECOVERY_QUALITY_SUB_COPY[option]} icon={<Image source={OPTION_ICONS[option]} style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no" />} selected={recoveryQuality === option} selectionRole="radio" onPress={() => setRecoveryQuality(option)} />)}</View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({ optionList: { gap: spacing.md }, optionIcon: { height: layout.minimumTouchTarget, width: layout.minimumTouchTarget }, errorMessage: { color: theme.colors.textPrimary }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const);
