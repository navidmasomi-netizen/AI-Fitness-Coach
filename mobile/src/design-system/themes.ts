import { runpuyTokens } from './tokens';

const { color } = runpuyTokens;

export const lightTheme = {
  colors: {
    canvas: color.light.surfaceCanvas,
    card: color.light.surfaceCard,
    textPrimary: color.light.textPrimary,
    textSecondary: color.light.textSecondary,
    borderSubtle: color.light.borderSubtle,
    actionPrimary: color.primitive.emerald,
    actionPrimaryText: color.primitive.ink,
    focus: color.semantic.focusRing,
    success: color.semantic.success,
    warning: color.semantic.warning,
    error: color.semantic.error,
    information: color.semantic.information,
  },
} as const;

export const darkTheme = {
  colors: {
    canvas: color.dark.surfaceCanvas,
    card: color.dark.surfaceCard,
    textPrimary: color.dark.textPrimary,
    textSecondary: color.dark.textSecondary,
    borderSubtle: color.dark.borderSubtle,
    actionPrimary: color.primitive.emerald,
    actionPrimaryText: color.primitive.ink,
    focus: color.semantic.focusRing,
    success: color.semantic.success,
    warning: color.semantic.warning,
    error: color.semantic.error,
    information: color.semantic.information,
  },
} as const;

export type RunpuyTheme = typeof lightTheme | typeof darkTheme;
