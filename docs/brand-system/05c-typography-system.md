# Phase 5C — RUNPUY Typography System

**Updated:** 2026-09-21
**Status:** In progress — Latin direction selected; Persian/Arabic companion pending visual approval.

## Selected Latin Direction

**Manrope** is the selected working typeface for RUNPUY's Latin-script brand and product experience.

Working hierarchy:

- Display and page titles: Manrope ExtraBold 800
- Section headings: Manrope Bold 700
- Buttons and interface labels: Manrope SemiBold 600
- Body and supporting copy: Manrope Regular 400
- Primary metrics: Manrope Bold or ExtraBold with tabular numerals where supported

The custom RUNPUY wordmark remains a separate logo asset and must not be recreated by typesetting the name in Manrope.

## Multilingual Requirement

The typography system must support right-to-left layout and Persian/Arabic shaping before V2 implementation. Manrope's documented coverage focuses on Latin and Cyrillic scripts, so it is not the Persian/Arabic production font.

### Recommended Companion

**Vazirmatn** is the current recommended Persian/Arabic companion for evaluation.

Reasons:

- designed specifically for Persian/Arabic;
- intended for readable web and application interfaces;
- open source under the SIL Open Font License 1.1;
- available as a variable font and multiple weights;
- practical mapping to the selected Manrope hierarchy.

Proposed weight mapping:

- Manrope 800 ↔ Vazirmatn 800
- Manrope 700 ↔ Vazirmatn 700
- Manrope 600 ↔ Vazirmatn 600
- Manrope 400 ↔ Vazirmatn 400

### Fallback Candidate

**Noto Sans Arabic** remains the fallback candidate if broader Arabic-script coverage becomes more important than visual pairing. Noto documents Persian among the languages using the Arabic script.

## Open Validation

Before final approval:

1. Compare Manrope + Vazirmatn in matched English and Persian UI screens.
2. Verify perceived weight, x-height, line height, and density across scripts.
3. Test Persian and Latin numerals, mixed-language strings, units, punctuation, and date formats.
4. Validate RTL navigation, icon direction, alignment, truncation, and dynamic type.
5. Define font-loading, fallback, and accessibility rules for React Native/Expo.
6. Confirm which languages are launch requirements versus future fallback coverage.

## Sources

- Manrope official project: https://github.com/davelab6/manrope
- Manrope designer site: https://www.sharanda.com/manrope
- Vazirmatn official project: https://github.com/rastikerdar/vazirmatn
- Noto Sans Arabic specimen: https://notofonts.github.io/noto-docs/specimen/NotoSansArabic/
