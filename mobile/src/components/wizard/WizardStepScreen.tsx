import { useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RunpuyButton } from '../../design-system/components/RunpuyButton';
import { RunpuyText } from '../../design-system/components/RunpuyText';
import { useRunpuyTheme } from '../../design-system/theme-context';
import { layout, radii, spacing } from '../../design-system/tokens';

export type WizardStepScreenProps = {
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
  primaryActionLabel: string;
  onPrimaryAction: () => void | Promise<void>;
  primaryActionDisabled?: boolean;
  primaryActionLoading?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
  backAccessibilityLabel?: string;
  footer?: ReactNode;
};

export function WizardStepScreen({
  title,
  subtitle,
  currentStep,
  totalSteps,
  children,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled = false,
  primaryActionLoading = false,
  onBack,
  backDisabled = false,
  backAccessibilityLabel = 'Go back',
  footer,
}: WizardStepScreenProps) {
  const [backFocused, setBackFocused] = useState(false);
  const { theme } = useRunpuyTheme();
  const styles = createStyles(theme);
  const safeTotalSteps = totalSteps > 0 ? totalSteps : 1;
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), safeTotalSteps);
  const progressPercentage = (safeCurrentStep / safeTotalSteps) * 100;
  const progressWidth: `${number}%` = `${progressPercentage}%`;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.progressHeader}>
              <View style={styles.progressCopy}>
                <RunpuyText variant="caption" tone="secondary">
                  {safeCurrentStep} / {safeTotalSteps}
                </RunpuyText>
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel={`${safeCurrentStep} / ${safeTotalSteps}`}
                  accessibilityValue={{
                    min: 0,
                    max: safeTotalSteps,
                    now: safeCurrentStep,
                  }}
                  style={styles.progressTrack}
                >
                  <View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
              </View>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={backAccessibilityLabel}
                  accessibilityState={{ disabled: backDisabled }}
                  disabled={backDisabled}
                  onPress={onBack}
                  onFocus={() => setBackFocused(true)}
                  onBlur={() => setBackFocused(false)}
                  style={[
                    styles.backControl,
                    {
                      borderColor: backFocused ? theme.colors.focus : theme.colors.borderSubtle,
                      borderWidth: backFocused ? 2 : 1,
                    },
                  ]}
                >
                  <RunpuyText variant="body" tone="secondary">
                    ‹
                  </RunpuyText>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.titleCopy}>
              <RunpuyText accessibilityRole="header" variant="heading">
                {title}
              </RunpuyText>
              {subtitle ? (
                <RunpuyText variant="body" tone="secondary">
                  {subtitle}
                </RunpuyText>
              ) : null}
            </View>
          </View>

          <View style={styles.body}>{children}</View>

          <View style={styles.actionArea}>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
            <RunpuyButton
              label={primaryActionLabel}
              onPress={onPrimaryAction}
              disabled={primaryActionDisabled}
              loading={primaryActionLoading}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useRunpuyTheme>['theme']) => ({
  root: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    gap: spacing.xl,
    paddingBottom: layout.pageMargin,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.lg,
  },
  progressHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  // Progress thickness is local structural geometry; its color comes from the theme.
  progressTrack: {
    backgroundColor: theme.colors.borderSubtle,
    borderRadius: radii.control,
    height: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: theme.colors.actionPrimary,
    borderRadius: radii.control,
    height: '100%',
  },
  // Back-control borders are structural focus geometry, not brand tokens.
  backControl: {
    alignItems: 'center',
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: layout.minimumTouchTarget,
    minWidth: layout.minimumTouchTarget,
  },
  titleCopy: {
    gap: spacing.sm,
  },
  body: {
    flex: 1,
  },
  actionArea: {
    gap: spacing.md,
  },
  footer: {
    alignItems: 'center',
  },
} satisfies Record<string, ViewStyle>);
