import type { RunpuyTheme } from '../../design-system/themes';
import { layout, radii, spacing } from '../../design-system/tokens';

/** Compatibility adapter for Auth-specific aliases backed by the resolved RUNPUY theme. */
export function createAuthTheme(theme: RunpuyTheme) {
  return {
  colors: {
    background: theme.colors.canvas,
    panel: theme.colors.card,
    panelBorder: theme.colors.borderSubtle,
    panelBorderFocus: theme.colors.focus,
    panelBorderError: theme.colors.error,
    textPrimary: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    textMuted: theme.colors.textSecondary,
    accent: theme.colors.actionPrimary,
    error: theme.colors.error,
    subtleDivider: theme.colors.borderSubtle,
    inputPlaceholder: theme.colors.textSecondary,
    icon: theme.colors.textSecondary,
    devOnly: theme.colors.information,
  },
  spacing: {
    screenHorizontal: spacing.xl,
    screenTop: spacing.lg,
    screenBottom: layout.pageMargin,
    sectionGap: spacing.xl,
    fieldGap: spacing.lg,
    panelPadding: 0,
  },
  radius: {
    input: radii.control,
    button: radii.button,
    card: radii.card,
  },
  sizes: {
    iconButton: layout.minimumTouchTarget,
    contentMaxWidth: 440,
  },
  } as const;
}

export type AuthTheme = ReturnType<typeof createAuthTheme>;
