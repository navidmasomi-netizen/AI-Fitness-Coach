import { useState } from 'react';
import { I18nManager, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyText } from '../../../src/design-system/components';
import { runpuyFontFamilies } from '../../../src/design-system/fonts';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const currentStep = 16;

export default function WizardStepFifteenBScreen() {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
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
  const inputBorderColor = errorMessage ? theme.colors.error : isFocused ? theme.colors.focus : theme.colors.borderSubtle;

  return <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoid}><WizardStepScreen title="What other supplements do you use?" subtitle="Add any supplements not listed earlier." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-15')} backAccessibilityLabel="Go back to the supplements selection" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View style={[styles.inputPanel, { borderColor: inputBorderColor }]}><View style={styles.inputHeader}><RunpuyText variant="caption" tone="secondary">Optional</RunpuyText>{supplementOtherInput.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss keyboard" onPress={Keyboard.dismiss} style={styles.doneButton}><RunpuyText variant="caption">Done</RunpuyText></Pressable> : null}</View><TextInput accessibilityLabel="Other supplements you use" value={supplementOtherInput} onChangeText={(value) => { setSupplementOtherInput(value); setSupplementOther(value.length > 0 ? value : null); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} multiline placeholder="Type other supplements here..." placeholderTextColor={theme.colors.textSecondary} style={styles.textInput} textAlignVertical="top" /></View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen></KeyboardAvoidingView></TouchableWithoutFeedback>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({ keyboardAvoid: { flex: 1 }, inputPanel: { backgroundColor: theme.colors.card, borderRadius: radii.control, borderWidth: 1, gap: spacing.sm, padding: spacing.lg }, inputHeader: { alignItems: 'center', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }, doneButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, textInput: { color: theme.colors.textPrimary, fontFamily: runpuyFontFamilies.persianArabic.body, height: 200, textAlign: 'right', textAlignVertical: 'top', writingDirection: 'rtl' }, errorMessage: { color: theme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const);
