import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { SUPPLEMENT_LABELS, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const SUPPLEMENT_OPTIONS = ['protein', 'creatine', 'omega3', 'multivitamin', 'vitamin_d', 'magnesium', 'fish_oil', 'electrolytes', 'pre_workout', 'other'];

export default function WizardStepFifteenScreen() {
  const currentStep = 15;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const setSupplementUse = useWizardDraftStore((state) => state.setSupplementUse);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const toggleSupplement = (option: string) => { if (option === 'none') { setSupplementUse(['none']); return; } const current = supplementUse.filter((item) => item !== 'none'); if (current.includes(option)) { setSupplementUse(current.filter((item) => item !== option)); return; } setSupplementUse([...current, option]); };
  const onContinue = async () => { if (supplementUse.length === 0 || isSaving) return; const didSave = await saveStep({ supplementUse }, 15); if (didSave) router.push(supplementUse.includes('other') ? '/(profile)/wizard/step-15b' : '/(profile)/wizard/step-16'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const isNextEnabled = supplementUse.length > 0;
  const noneSelected = supplementUse.includes('none');

  return <WizardStepScreen title="Which supplements do you use?" subtitle="Select all that apply." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!isNextEnabled || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-14')} backAccessibilityLabel="Go back to the cardio preference question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <ScrollView style={styles.listScroll} contentContainerStyle={styles.optionList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>{SUPPLEMENT_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={SUPPLEMENT_LABELS[option]} selected={supplementUse.includes(option)} selectionRole="checkbox" onPress={() => toggleSupplement(option)} theme={darkTheme} />)}<View style={styles.noneSeparator} /><RunpuySelectableCard label={SUPPLEMENT_LABELS.none} selected={noneSelected} selectionRole="checkbox" accessibilityLabel="I don't take supplements — clears all other selections" onPress={() => toggleSupplement('none')} theme={darkTheme} /></ScrollView>
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { listScroll: { flex: 1 }, optionList: { gap: spacing.md, paddingBottom: spacing.sm }, noneSeparator: { backgroundColor: darkTheme.colors.borderSubtle, height: 1 }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
