import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardStepNumber, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyText } from '../../../src/design-system/components';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

export default function WizardStepSeventeenScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const injuryNotes = useWizardDraftStore((state) => state.injuryNotes);
  const setInjuryNotes = useWizardDraftStore((state) => state.setInjuryNotes);
  const [injuryNotesInput, setInjuryNotesInput] = useState(injuryNotes || '');
  const totalSteps = getWizardTotalSteps(supplementUse);
  const currentStep = getWizardStepNumber(17, supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const onContinue = async () => { if (isSaving) return; const didSave = await saveStep({ injuryNotes }, currentStep); if (didSave) router.push('/(profile)/wizard/step-18'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const inputBorderColor = errorMessage ? darkTheme.colors.error : isFocused ? darkTheme.colors.focus : darkTheme.colors.borderSubtle;

  return <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}><WizardStepScreen title="Tell us more about your injuries" subtitle="Add any details you'd like us to keep with your profile." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-16')} backAccessibilityLabel="Go back to the injury flags question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View style={[styles.inputPanel, { borderColor: inputBorderColor }]}><View style={styles.inputHeader}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Optional</RunpuyText>{injuryNotesInput.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyboard" onPress={Keyboard.dismiss} style={styles.doneButton}><RunpuyText theme={darkTheme} variant="caption">Done</RunpuyText></Pressable> : null}</View><TextInput accessibilityLabel="Injury notes (optional)" accessibilityHint="Describe any injuries or limitations in more detail" value={injuryNotesInput} onChangeText={(value) => { setInjuryNotesInput(value); setInjuryNotes(value.length > 0 ? value : null); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} multiline placeholder="E.g. left knee pain when squatting, previous shoulder injury..." placeholderTextColor={darkTheme.colors.textSecondary} style={styles.textInput} textAlignVertical="top" /></View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen></KeyboardAvoidingView></TouchableWithoutFeedback>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { keyboardAvoid: { flex: 1 }, inputPanel: { backgroundColor: darkTheme.colors.card, borderRadius: radii.control, borderWidth: 1, gap: spacing.sm, padding: spacing.lg }, inputHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, doneButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, textInput: { color: darkTheme.colors.textPrimary, height: 200, textAlignVertical: 'top' }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
