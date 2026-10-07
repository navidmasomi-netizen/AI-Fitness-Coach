import { useState } from 'react';
import { I18nManager, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const MIN_MEALS = 1;
const MAX_MEALS = 6;

export default function WizardStepThirteenScreen() {
  const currentStep = 13;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const mealFrequency = useWizardDraftStore((state) => state.mealFrequency);
  const setMealFrequency = useWizardDraftStore((state) => state.setMealFrequency);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [localValue, setLocalValue] = useState<number>(mealFrequency !== null && mealFrequency >= MIN_MEALS && mealFrequency <= MAX_MEALS ? mealFrequency : 3);
  const atMin = localValue <= MIN_MEALS;
  const atMax = localValue >= MAX_MEALS;
  const decrement = () => { if (atMin) return; const next = localValue - 1; setLocalValue(next); setMealFrequency(next); };
  const increment = () => { if (atMax) return; const next = localValue + 1; setLocalValue(next); setMealFrequency(next); };
  const onContinue = async () => { if (isSaving) return; const didSave = await saveStep({ mealFrequency: localValue }, 13); if (didSave) router.push('/(profile)/wizard/step-14'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const unitLabel = localValue === 1 ? 'meal/day' : 'meals/day';

  return <WizardStepScreen title="How many meals do you usually eat per day?" subtitle="This gives us context about your usual eating routine for future nutrition coaching." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-12')} backAccessibilityLabel="Go back to the eating habits question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View style={styles.stepperPanel}><View style={styles.stepperRow}><View style={styles.stepperButtonSlot}><Pressable accessibilityRole="button" accessibilityLabel="Decrease meals per day" accessibilityState={{ disabled: atMin }} disabled={atMin} onPress={decrement} style={styles.stepperButton}><Feather name="minus" size={spacing.xl} color={theme.colors.textPrimary} /></Pressable></View><View style={styles.stepperValueBlock} accessible accessibilityLabel={String(localValue) + ' ' + unitLabel}><RunpuyText variant="display" style={styles.numericValue}>{localValue}</RunpuyText><RunpuyText variant="body" tone="secondary" style={styles.numericValue}>{unitLabel}</RunpuyText></View><View style={[styles.stepperButtonSlot, styles.stepperButtonSlotRight]}><Pressable accessibilityRole="button" accessibilityLabel="Increase meals per day" accessibilityState={{ disabled: atMax }} disabled={atMax} onPress={increment} style={styles.stepperButton}><Feather name="plus" size={spacing.xl} color={theme.colors.textPrimary} /></Pressable></View></View><RunpuyText variant="caption" tone="secondary" style={styles.helperText}>Choose between 1 and 6 meals</RunpuyText></View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({ stepperPanel: { backgroundColor: theme.colors.card, borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl }, stepperRow: { alignItems: 'center', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }, stepperButtonSlot: { alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start', flex: 1 }, stepperButtonSlotRight: { alignItems: I18nManager.isRTL ? 'flex-start' : 'flex-end' }, stepperButton: { alignItems: 'center', backgroundColor: theme.colors.card, borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, stepperValueBlock: { alignItems: 'center', flex: 1, gap: spacing.xs }, numericValue: { writingDirection: 'ltr' }, helperText: { textAlign: 'center' }, errorMessage: { color: theme.colors.error }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const);
