import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { INJURY_FLAG_LABELS, getWizardStepNumber, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  knee: require('../../../assets/images/onboarding/onboarding-step-16-icon-knee.png'),
  shoulder: require('../../../assets/images/onboarding/onboarding-step-16-icon-shoulder.png'),
  lower_back: require('../../../assets/images/onboarding/onboarding-step-16-icon-lower-back.png'),
  wrist: require('../../../assets/images/onboarding/onboarding-step-16-icon-wrist.png'),
  none: require('../../../assets/images/onboarding/onboarding-step-16-icon-none.png'),
};
const INJURY_OPTIONS = ['knee', 'shoulder', 'lower_back', 'wrist'];

export default function WizardStepSixteenScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const injuryFlags = useWizardDraftStore((state) => state.injuryFlags);
  const setInjuryFlags = useWizardDraftStore((state) => state.setInjuryFlags);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(16, supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const toggleInjuryFlag = (option: string) => { if (option === 'none') { setInjuryFlags(['none']); return; } const current = injuryFlags.filter((item) => item !== 'none'); if (current.includes(option)) { setInjuryFlags(current.filter((item) => item !== option)); return; } setInjuryFlags([...current, option]); };
  const onContinue = async () => { if (injuryFlags.length === 0 || isSaving) return; const didSave = await saveStep({ injuryFlags }, currentStep); if (!didSave) return; router.push(injuryFlags.includes('none') || injuryFlags.length === 0 ? '/(profile)/wizard/step-18' : '/(profile)/wizard/step-17'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const isNextEnabled = injuryFlags.length > 0;
  const noneSelected = injuryFlags.includes('none');

  return <WizardStepScreen title="Any injuries or limitations to consider?" subtitle="We'll avoid exercises that stress injured areas." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!isNextEnabled || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace(supplementUse.includes('other') ? '/(profile)/wizard/step-15b' : '/(profile)/wizard/step-15')} backAccessibilityLabel="Go back to the supplements question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <ScrollView style={styles.listScroll} contentContainerStyle={styles.optionList} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={styles.optionGroup}>{INJURY_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={INJURY_FLAG_LABELS[option]} icon={<Image source={OPTION_ICONS[option]} style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no" />} selected={injuryFlags.includes(option)} selectionRole="checkbox" onPress={() => toggleInjuryFlag(option)} />)}</View><View style={styles.orDivider}><View style={styles.orLine} /><RunpuyText variant="caption" tone="secondary">OR</RunpuyText><View style={styles.orLine} /></View><RunpuySelectableCard label={INJURY_FLAG_LABELS.none} icon={<Image source={OPTION_ICONS.none} style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no" />} selected={noneSelected} selectionRole="checkbox" accessibilityLabel="No injuries or limitations — clears all other selections" onPress={() => toggleInjuryFlag('none')} /></ScrollView>
    {errorMessage ? <RunpuyText accessibilityRole="alert" variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText variant="caption" tone="secondary" style={styles.privacyText}>Your answers stay private and shape your plan.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({ listScroll: { flex: 1 }, optionList: { gap: spacing.md, paddingBottom: spacing.sm }, optionGroup: { gap: spacing.md }, optionIcon: { height: layout.minimumTouchTarget, width: layout.minimumTouchTarget }, orDivider: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, orLine: { backgroundColor: theme.colors.borderSubtle, flex: 1, height: 1 }, errorMessage: { color: theme.colors.textPrimary }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const);
