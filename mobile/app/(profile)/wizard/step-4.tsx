import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { WizardStepScreen } from '../../../src/components/wizard/WizardStepScreen';
import { getWizardTotalSteps } from '../../../src/constants/wizardLabels';
import { RunpuyCard, RunpuySelectableCard, RunpuyText } from '../../../src/design-system/components';
import { useRunpuyTheme } from '../../../src/design-system/theme-context';
import { layout, radii, spacing } from '../../../src/design-system/tokens';
import { useWizardStepSave } from '../../../src/hooks/useWizardStepSave';
import { useAuthStore } from '../../../src/store/authStore';
import { useWizardDraftStore } from '../../../src/store/wizardDraftStore';

const SESSION_DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;
type DurationOption = (typeof SESSION_DURATION_OPTIONS)[number];

const DURATION_SUMMARIES: Record<DurationOption, { title: string; description: string }> = {
  30: { title: '30 minutes per session', description: "Short and focused. Every rep counts — we'll keep it efficient." },
  45: { title: '45 minutes per session', description: 'A solid block. Enough time for a complete, quality session.' },
  60: { title: '60 minutes per session', description: 'A balanced training window with room for focused, quality work.' },
  75: { title: '75 minutes per session', description: 'Room to warm up, work hard, and cool down properly.' },
  90: { title: '90 minutes per session', description: "High-commitment training. We'll use every minute intentionally." },
};

export default function WizardStepFourScreen() {
  const currentStep = 4;
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const supplementUse = useWizardDraftStore((state) => state.supplementUse);
  const sessionDurationMin = useWizardDraftStore((state) => state.sessionDurationMin);
  const setSessionDurationMin = useWizardDraftStore((state) => state.setSessionDurationMin);
  const totalSteps = getWizardTotalSteps(supplementUse);
  const { isSaving, errorMessage, saveStep } = useWizardStepSave();
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const onContinue = async () => {
    if (sessionDurationMin === null) return;
    const didSave = await saveStep({ sessionDurationMin }, 4);
    if (didSave) router.push('/(profile)/wizard/step-5');
  };
  const onLogout = async () => { await logout(); router.replace('/(auth)/login'); };
  const selectedSummary = sessionDurationMin !== null ? (DURATION_SUMMARIES[sessionDurationMin as DurationOption] ?? null) : null;

  return (
    <WizardStepScreen title="How long should each session be?" subtitle={'Choose the time that fits your schedule\nand helps you stay consistent.'} currentStep={currentStep} totalSteps={totalSteps} primaryActionLabel="Continue" onPrimaryAction={onContinue} primaryActionDisabled={sessionDurationMin === null || isSaving} primaryActionLoading={isSaving} onBack={() => router.replace('/(profile)/wizard/step-3')} backAccessibilityLabel="Go back to the session frequency question" footer={<Footer isOverflowOpen={isOverflowOpen} onToggleOverflow={() => setIsOverflowOpen((current) => !current)} onLogout={onLogout} />}>
      <View accessibilityRole="radiogroup" style={styles.durationList}>
        {SESSION_DURATION_OPTIONS.map((option) => <RunpuySelectableCard key={option} label={`${option} MIN`} selected={sessionDurationMin === option} selectionRole="radio" onPress={() => setSessionDurationMin(option)} accessibilityLabel={`${option} minutes`} theme={theme} />)}
      </View>
      {selectedSummary ? <RunpuyCard theme={theme} style={styles.summaryCard}>
        <Feather name="clock" size={spacing.xl} color={theme.colors.actionPrimary} />
        <View style={styles.summaryCopy}><RunpuyText theme={theme} variant="title">{selectedSummary.title}</RunpuyText><RunpuyText theme={theme} variant="caption" tone="secondary">{selectedSummary.description}</RunpuyText></View>
      </RunpuyCard> : null}
      {errorMessage ? <RunpuyText accessibilityRole="alert" theme={theme} variant="caption" style={styles.errorMessage}>{errorMessage}</RunpuyText> : null}
    </WizardStepScreen>
  );
}

function Footer({ isOverflowOpen, onToggleOverflow, onLogout }: { isOverflowOpen: boolean; onToggleOverflow: () => void; onLogout: () => void | Promise<void> }) { const { theme } = useRunpuyTheme(); const styles = createStyles(theme);
  return <View style={styles.footerContent}><Pressable accessibilityRole="button" accessibilityLabel="More onboarding options" accessibilityState={{ expanded: isOverflowOpen }} onPress={onToggleOverflow} style={styles.overflowButton}><Feather name="more-horizontal" size={spacing.xl} color={theme.colors.textSecondary} /></Pressable>{isOverflowOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logoutAction}><RunpuyText theme={theme} variant="caption" tone="secondary">Log out</RunpuyText></Pressable> : null}<View style={styles.privacyFooter}><Feather name="lock" size={spacing.md} color={theme.colors.textSecondary} /><RunpuyText theme={theme} variant="caption" tone="secondary" style={styles.privacyText}>Your answers are private and secure.{'\n'}You can change them later.</RunpuyText></View></View>;
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({
  durationList: { gap: spacing.md }, summaryCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md }, summaryCopy: { flex: 1, gap: spacing.xs }, errorMessage: { color: theme.colors.error },
  footerContent: { alignItems: 'center', gap: spacing.sm }, overflowButton: { alignItems: 'center', justifyContent: 'center', minHeight: layout.minimumTouchTarget, minWidth: layout.minimumTouchTarget },
  logoutAction: { borderColor: theme.colors.borderSubtle, borderRadius: radii.control, borderWidth: 1, minHeight: layout.minimumTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  privacyFooter: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }, privacyText: { textAlign: 'center' },
} as const);
