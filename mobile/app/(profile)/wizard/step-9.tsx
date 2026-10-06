import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
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

function parseWeightInput(input: string): number | null {
  if (input === '' || input === '.') return null;
  const value = parseFloat(input);
  if (isNaN(value)) return null;
  // At most one decimal place.
  const dotIndex = input.indexOf('.');
  if (dotIndex !== -1 && input.length - dotIndex - 1 > 1) return null;
  if (value < 20 || value > 400) return null;
  return value;
}

export default function WizardStepNineScreen() {
  const currentStep = 9;
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const weightKg = useWizardDraftStore((state) => state.weightKg);
  const setWeightKg = useWizardDraftStore((state) => state.setWeightKg);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [weightInput, setWeightInput] = useState(weightKg !== null ? String(weightKg) : '');
  const [isFocused, setIsFocused] = useState(false);
  const parsedWeight = parseWeightInput(weightInput);
  const isWeightValid = parsedWeight !== null;
  const showError = weightInput.length > 0 && !isWeightValid;
  const hasError = showError || Boolean(errorMessage);
  const onContinue = async () => { if (!isWeightValid || parsedWeight === null) return; Keyboard.dismiss(); const didSave = await saveStep({ weightKg: parsedWeight }, 9); if (didSave) { setWeightKg(parsedWeight); router.push('/(profile)/wizard/step-10'); } };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return <WizardStepScreen title="How much do you weigh?" subtitle="Your weight helps us personalize training loads, recovery, and nutrition targets." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!isWeightValid || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-8')} backAccessibilityLabel="Go back to the height question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}>
    <ScrollView style={styles.inputScroll} contentContainerStyle={styles.inputScrollContent} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><View style={[styles.numericCard, { borderColor: hasError ? darkTheme.colors.error : isFocused ? darkTheme.colors.focus : darkTheme.colors.borderSubtle }]}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Your weight</RunpuyText><View style={styles.inputRow}><TextInput accessibilityLabel="Your weight in kilograms" value={weightInput} onChangeText={(value) => { setWeightInput(value); const next = parseWeightInput(value); if (value.length === 0) setWeightKg(null); else if (next !== null) setWeightKg(next); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} onSubmitEditing={Keyboard.dismiss} keyboardType="decimal-pad" returnKeyType="done" placeholder="—" placeholderTextColor={darkTheme.colors.textSecondary} style={styles.numericInput} selectionColor={darkTheme.colors.actionPrimary} /><RunpuyText theme={darkTheme} variant="title" tone="secondary">kg</RunpuyText></View><View style={styles.divider} /><View style={styles.hints}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Tap to enter</RunpuyText><RunpuyText theme={darkTheme} variant="caption" tone="secondary">20–400 kg</RunpuyText></View></View>
    {showError ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>Weight must be between 20 and 400 kg, with at most one decimal place.</RunpuyText> : null}
    {errorMessage ? <RunpuyText accessibilityRole="alert" theme={darkTheme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}</ScrollView>
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={darkTheme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={darkTheme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={darkTheme.colors.textSecondary} /><RunpuyText theme={darkTheme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>; }
const styles = { inputScroll: { flex: 1 }, inputScrollContent: { gap: spacing.md }, numericCard: { alignItems: 'center', backgroundColor: darkTheme.colors.card, borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }, inputRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, // 72/82 is local data-display geometry required for direct numeric entry, not a RUNPUY type scale.
  numericInput: { color: darkTheme.colors.textPrimary, fontSize: 72, fontWeight: '700', letterSpacing: -2, lineHeight: 82, minWidth: layout.minimumTouchTarget, paddingHorizontal: 0, paddingVertical: 0, textAlign: 'center' }, divider: { backgroundColor: darkTheme.colors.borderSubtle, height: 1, marginBottom: spacing.md, marginTop: spacing.xl, width: '100%' }, hints: { alignItems: 'center', gap: spacing.xs }, errorMessage: { color: darkTheme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: darkTheme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const;
