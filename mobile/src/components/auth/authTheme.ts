import { darkTheme } from '../../design-system/themes';
import { layout, radii, spacing } from '../../design-system/tokens';

/** Compatibility adapter for unchanged Auth route styles. */
export const authTheme = {
  colors: {
    background: darkTheme.colors.canvas,
    panel: darkTheme.colors.card,
    panelBorder: darkTheme.colors.borderSubtle,
    panelBorderFocus: darkTheme.colors.focus,
    panelBorderError: darkTheme.colors.error,
    textPrimary: darkTheme.colors.textPrimary,
    textSecondary: darkTheme.colors.textSecondary,
    textMuted: darkTheme.colors.textSecondary,
    accent: darkTheme.colors.actionPrimary,
    error: darkTheme.colors.error,
    subtleDivider: darkTheme.colors.borderSubtle,
    inputPlaceholder: darkTheme.colors.textSecondary,
    icon: darkTheme.colors.textSecondary,
    devOnly: darkTheme.colors.information,
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
