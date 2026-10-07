import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
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

export default function WizardStepSixScreen() {
  const currentStep = 6;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const age = useWizardDraftStore((state) => state.age);
  const setAge = useWizardDraftStore((state) => state.setAge);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [ageInput, setAgeInput] = useState(age !== null ? String(age) : '');
  const [isFocused, setIsFocused] = useState(false);

  const parsedAge = Number(ageInput);
  const isAgeValid = Number.isInteger(parsedAge) && parsedAge >= 13 && parsedAge <= 100;
  const showError = ageInput.length > 0 && !isAgeValid;
  const hasError = showError || Boolean(errorMessage);

  const onContinue = async () => {
    if (!isAgeValid) return;
    Keyboard.dismiss();
    const didSave = await saveStep({ age: parsedAge }, 6);
    if (didSave) {
      setAge(parsedAge);
      router.push('/(profile)/wizard/step-7');
    }
  };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return (
    <WizardStepScreen title="How old are you?" subtitle="Your age helps us personalize training intensity, recovery, and progression." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!isAgeValid || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-5')} backAccessibilityLabel="Go back to the equipment access question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}>
      <ScrollView style={styles.inputScroll} contentContainerStyle={styles.inputScrollContent} bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={[styles.numericCard, { borderColor: hasError ? theme.colors.error : isFocused ? theme.colors.focus : theme.colors.borderSubtle }]}>
        <TextInput accessibilityLabel="Your age in years" value={ageInput} onChangeText={(value) => { setAgeInput(value); const nextValue = Number(value); if (value.length === 0) setAge(null); else if (Number.isInteger(nextValue) && nextValue >= 13 && nextValue <= 100) setAge(nextValue); }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} onSubmitEditing={Keyboard.dismiss} keyboardType="number-pad" returnKeyType="done" maxLength={3} placeholder="—" placeholderTextColor={theme.colors.textSecondary} style={styles.numericInput} selectionColor={theme.colors.actionPrimary} />
        <RunpuyText theme={theme} variant="body" tone="secondary">years old</RunpuyText>
        <View style={styles.divider} />
        <View style={styles.hints}><RunpuyText theme={theme} variant="caption" tone="secondary">Tap number to type</RunpuyText><RunpuyText theme={theme} variant="caption" tone="secondary">13–100 years</RunpuyText></View>
      </View>
      {showError ? <RunpuyText accessibilityRole="alert" theme={theme} variant="caption" style={styles.errorMessage}>Age must be a whole number between 13 and 100.</RunpuyText> : null}
      {errorMessage ? <RunpuyText accessibilityRole="alert" theme={theme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
      </ScrollView>
    </WizardStepScreen>
  );
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { const { theme } = useRunpuyTheme(); const styles = createStyles(theme);
  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={theme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText theme={theme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({
  inputScroll: { flex: 1 }, inputScrollContent: { gap: spacing.md },
  numericCard: { alignItems: 'center', backgroundColor: theme.colors.card, borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  // 72/82 is local data-display geometry required for direct numeric entry, not a RUNPUY type scale.
  numericInput: { color: theme.colors.textPrimary, fontFamily: runpuyFontFamilies.latin.body, fontSize: 72, letterSpacing: -2, lineHeight: 82, paddingHorizontal: 0, paddingVertical: 0, textAlign: 'center', width: '100%' },
  divider: { backgroundColor: theme.colors.borderSubtle, height: 1, marginBottom: spacing.md, marginTop: spacing.xl, width: '100%' }, hints: { alignItems: 'center', gap: spacing.xs }, errorMessage: { color: theme.colors.error },
  footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' },
} as const);
