export const runpuyFontAliases = {
  manrope400: 'RUNPUY-Manrope-400',
  manrope650: 'RUNPUY-Manrope-650',
  manrope700: 'RUNPUY-Manrope-700',
  vazirmatn400: 'RUNPUY-Vazirmatn-400',
  vazirmatn650: 'RUNPUY-Vazirmatn-650',
  vazirmatn700: 'RUNPUY-Vazirmatn-700',
} as const;

export type RunpuyFontAlias = (typeof runpuyFontAliases)[keyof typeof runpuyFontAliases];
export type RunpuyTextScript = 'latin' | 'persianArabic';
export type RunpuyFontVariant = 'display' | 'heading' | 'title' | 'body' | 'caption';

export const runpuyFontFamilies: Record<RunpuyTextScript, Record<RunpuyFontVariant, RunpuyFontAlias>> = {
  latin: {
    display: runpuyFontAliases.manrope700,
    heading: runpuyFontAliases.manrope650,
    title: runpuyFontAliases.manrope650,
    body: runpuyFontAliases.manrope400,
    caption: runpuyFontAliases.manrope400,
  },
  persianArabic: {
    display: runpuyFontAliases.vazirmatn700,
    heading: runpuyFontAliases.vazirmatn650,
    title: runpuyFontAliases.vazirmatn650,
    body: runpuyFontAliases.vazirmatn400,
    caption: runpuyFontAliases.vazirmatn400,
  },
};

export const runpuyFontSources: Record<RunpuyFontAlias, number> = {
  [runpuyFontAliases.manrope400]: require('../../assets/fonts/RUNPUY-Manrope-400.ttf'),
  [runpuyFontAliases.manrope650]: require('../../assets/fonts/RUNPUY-Manrope-650.ttf'),
  [runpuyFontAliases.manrope700]: require('../../assets/fonts/RUNPUY-Manrope-700.ttf'),
  [runpuyFontAliases.vazirmatn400]: require('../../assets/fonts/RUNPUY-Vazirmatn-400.ttf'),
  [runpuyFontAliases.vazirmatn650]: require('../../assets/fonts/RUNPUY-Vazirmatn-650.ttf'),
  [runpuyFontAliases.vazirmatn700]: require('../../assets/fonts/RUNPUY-Vazirmatn-700.ttf'),
};
