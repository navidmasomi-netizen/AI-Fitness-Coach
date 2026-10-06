import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyText } from '../../../src/design-system/components';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const currentStep = 16;

export default function WizardStepFifteenBScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const supplementOther = useWizardDraftStore((state) => state.supplementOther);
  const setSupplementOther = useWizardDraftStore((state) => state.setSupplementOther);
  const [supplementOtherInput, setSupplementOtherInput] = useState(supplementOther || '');
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const onContinue = async () => { if (isSaving) return; const didSave = await saveStep({}, 16); if (didSave) router.push('/(profile)/wizard/step-16'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const inputBorderColor = errorMessage ? darkTheme.colors.error : isFocused ? darkTheme.colors.focus : darkTheme.colors.borderSubtle;

  return <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}><WizardStepScreen title="What other supplements do you use?" subtitle="Add any supplements not listed earlier." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-15')} backAccessibilityLabel="Go back to the supplements selection" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View style={[styles.inputPanel, { borderColor: inputBorderColor }]}><View style={styles.inputHeader}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Optional</RunpuyText>{supplementOtherInput.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyboard" onPress={Keyboard.dismiss} style={styles.doneButton}><RunpuyText theme={darkTheme} variant="caption">Done</RunpuyText></Pressable> : null}</View><TextInput accessibilityLabel="Other supplements you use" value={supplementOtherInput} onChangeText={(value) => { setSupplementOtherInput(value); setSupplementOther(value.length > 0 ? value : null); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} multiline placeholder="Type other supplements here..." placeholderTextColor={darkTheme.colors.textSecondary} style={styles.textInput} textAlignVertical="top" /></View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen></KeyboardAvoidingView></TouchableWithoutFeedback>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { keyboardAvoid: { flex: 1 }, inputPanel: { backgroundColor: darkTheme.colors.card, borderRadius: radii.control, borderWidth: 1, gap: spacing.sm, padding: spacing.lg }, inputHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, doneButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, textInput: { color: darkTheme.colors.textPrimary, height: 200, textAlignVertical: 'top' }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
