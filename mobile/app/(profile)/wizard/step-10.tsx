import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { OCCUPATION_TYPE_LABELS, OCCUPATION_TYPE_SUB_COPY, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  desk_job: require('../../../assets/images/onboarding/onboarding-step-10-icon-sitting.png'),
  active_job: require('../../../assets/images/onboarding/onboarding-step-10-icon-active.png'),
  mixed: require('../../../assets/images/onboarding/onboarding-step-10-icon-mixed.png'),
  student: require('../../../assets/images/onboarding/onboarding-step-10-icon-light-activity.png'),
  unemployed: require('../../../assets/images/onboarding/onboarding-step-10-icon-home.png'),
};
const OCCUPATION_TYPE_OPTIONS = ['desk_job', 'active_job', 'mixed', 'student', 'unemployed'];

export default function WizardStepTenScreen() {
  const currentStep = 10;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const occupationType = useWizardDraftStore((state) => state.occupationType);
  const setOccupationType = useWizardDraftStore((state) => state.setOccupationType);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const onContinue = async () => { if (!occupationType || isSaving) return; const didSave = await saveStep({ occupationType }, 10); if (didSave) router.push('/(profile)/wizard/step-11'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return <WizardStepScreen title="What does your typical day look like?" subtitle="Your daily activity level shapes how we calculate your total energy needs and recovery." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!occupationType || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-9')} backAccessibilityLabel="Go back to the weight question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}>
    <View accessibilityRole="radiogroup" style={styles.optionList}>{OCCUPATION_TYPE_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={OCCUPATION_TYPE_LABELS[option]} description={OCCUPATION_TYPE_SUB_COPY[option]} icon={<Image source={OPTION_ICONS[option]} style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no" />} selected={occupationType === option} selectionRole="radio" onPress={() => setOccupationType(option)} theme={darkTheme} />)}</View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { optionList: { gap: spacing.md }, optionIcon: { height: layout.minimumTouchTarget, width: layout.minimumTouchTarget }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
