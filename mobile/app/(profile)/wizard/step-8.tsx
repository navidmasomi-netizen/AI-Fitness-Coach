import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyText } from '../../../src/design-system/components';
import { runpuyFontFamilies } from '../../../src/design-system/fonts';
import { darkTheme } from '../../../src/design-system/themes';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

export default function WizardStepEightScreen() {
  const currentStep = 8;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const heightCm = useWizardDraftStore((state) => state.heightCm);
  const setHeightCm = useWizardDraftStore((state) => state.setHeightCm);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [heightInput, setHeightInput] = useState(heightCm !== null ? String(heightCm) : '');
  const [isFocused, setIsFocused] = useState(false);
  const parsedHeight = Number(heightInput);
  const isHeightValid = Number.isInteger(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 250;
  const showError = heightInput.length > 0 && !isHeightValid;
  const hasError = showError || Boolean(errorMessage);
  const onContinue = async () => { if (!isHeightValid) return; Keyboard.dismiss(); const didSave = await saveStep({ heightCm: parsedHeight }, 8); if (didSave) { setHeightCm(parsedHeight); router.push('/(profile)/wizard/step-9'); } };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return <WizardStepScreen title="How tall are you?" subtitle="Your height helps us calibrate exercises, range of motion, and training loads." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!isHeightValid || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-7')} backAccessibilityLabel="Go back to the sex question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}>
    <ScrollView style={styles.inputScroll} contentContainerStyle={styles.inputScrollContent} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><View style={[styles.numericCard, { borderColor: hasError ? darkTheme.colors.error : isFocused ? darkTheme.colors.focus : darkTheme.colors.borderSubtle }]}><TextInput accessibilityLabel="Your height in centimetres" value={heightInput} onChangeText={(value) => { setHeightInput(value); const nextValue = Number(value); if (value.length === 0) setHeightCm(null); else if (Number.isInteger(nextValue) && nextValue >= 100 && nextValue <= 250) setHeightCm(nextValue); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} onSubmitEditing={Keyboard.dismiss} keyboardType="number-pad" returnKeyType="done" maxLength={3} placeholder="—" placeholderTextColor={darkTheme.colors.textSecondary} style={styles.numericInput} selectionColor={darkTheme.colors.actionPrimary} /><RunpuyText theme={darkTheme} variant="body" tone="secondary">cm</RunpuyText><View style={styles.divider} /><View style={styles.hints}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Tap number to type</RunpuyText><RunpuyText theme={darkTheme} variant="caption" tone="secondary">100–250 cm</RunpuyText></View></View>
    {showError ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>Height must be between 100 and 250 cm.</RunpuyText> : null}
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}</ScrollView>
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { inputScroll: { flex: 1 }, inputScrollContent: { gap: spacing.md }, numericCard: { alignItems: 'center', backgroundColor: darkTheme.colors.card, borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }, // 72/82 is local data-display geometry required for direct numeric entry, not a RUNPUY type scale.
  numericInput: { color: darkTheme.colors.textPrimary, fontFamily: runpuyFontFamilies.latin.body, fontSize: 72, letterSpacing: -2, lineHeight: 82, paddingHorizontal: 0, paddingVertical: 0, textAlign: 'center', width: '100%' }, divider: { backgroundColor: darkTheme.colors.borderSubtle, height: 1, marginBottom: spacing.md, marginTop: spacing.xl, width: '100%' }, hints: { alignItems: 'center', gap: spacing.xs }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
