import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { NUTRITION_HABITS_LABELS, NUTRITION_HABITS_SUB_COPY, getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const OPTION_ICONS: Record<string, ReturnType<typeof require>> = {
  strict: require('../../../assets/images/onboarding/onboarding-step-12-icon-structured.png'),
  moderate: require('../../../assets/images/onboarding/onboarding-step-12-icon-consistent.png'),
  flexible: require('../../../assets/images/onboarding/onboarding-step-12-icon-intuitive.png'),
  unstructured: require('../../../assets/images/onboarding/onboarding-step-12-icon-no-routine.png'),
};
const NUTRITION_OPTIONS = ['strict', 'moderate', 'flexible', 'unstructured'];

export default function WizardStepTwelveScreen() {
  const currentStep = 12;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const nutritionHabits = useWizardDraftStore((state) => state.nutritionHabits);
  const setNutritionHabits = useWizardDraftStore((state) => state.setNutritionHabits);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const onContinue = async () => { if (!nutritionHabits || isSaving) return; const didSave = await saveStep({ nutritionHabits }, 12); if (didSave) router.push('/(profile)/wizard/step-13'); };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };

  return <WizardStepScreen title="How would you describe your eating habits?" subtitle="This gives us useful nutrition context for future coaching — no calorie tracking required." currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={!nutritionHabits || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-11')} backAccessibilityLabel="Go back to the recovery question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((value) => !value)} onLogout={onLogout} />}>
    <View accessibilityRole="radiogroup" style={styles.optionList}>{NUTRITION_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={NUTRITION_HABITS_LABELS[option]} description={NUTRITION_HABITS_SUB_COPY[option]} icon={<Image source={OPTION_ICONS[option]} style={styles.optionIcon} accessibilityElementsHidden importantForAccessibility="no" />} selected={nutritionHabits === option} selectionRole="radio" onPress={() => setNutritionHabits(option)} />)}</View>
    {errorMessage ? <RunpuyText accessibilityRole="alert" variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
  </WizardStepScreen>;
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) {
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);

  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({ optionList: { gap: spacing.md }, optionIcon: { height: layout.minimumTouchTarget, width: layout.minimumTouchTarget }, errorMessage: { color: theme.colors.textPrimary }, footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget }, logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' } } as const);
