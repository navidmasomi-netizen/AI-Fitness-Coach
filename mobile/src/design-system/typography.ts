import { runpuyFontFamilies, type RunpuyTextScript } from './fonts';
import { runpuyTokens } from './tokens';

/** Exact typography values from the canonical RUNPUY token source. */
export const fontFamilies = {
  latin: runpuyTokens.typography.latin,
  persianArabic: runpuyTokens.typography.persianArabic,
} as const;

const { scale } = runpuyTokens.typography;

export const typography = {
  display: {
    fontSize: scale.display.size,
    lineHeight: scale.display.lineHeight,
    weight: scale.display.weight,
  },
  heading: {
    fontSize: scale.heading.size,
    lineHeight: scale.heading.lineHeight,
    weight: scale.heading.weight,
  },
  title: {
    fontSize: scale.title.size,
    lineHeight: scale.title.lineHeight,
    weight: scale.title.weight,
  },
  body: {
    fontSize: scale.body.size,
    lineHeight: scale.body.lineHeight,
    weight: scale.body.weight,
  },
  caption: {
    fontSize: scale.caption.size,
    lineHeight: scale.caption.lineHeight,
    weight: scale.caption.weight,
  },
} as const;

export function getRunpuyFontFamily(
  variant: keyof typeof typography,
  script: RunpuyTextScript,
) {
  return runpuyFontFamilies[script][variant];
}
