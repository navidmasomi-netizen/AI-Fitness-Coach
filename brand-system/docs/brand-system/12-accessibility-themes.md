# 12 — Accessibility & Themes

Target WCAG 2.2 AA for production interfaces. Validated reference contrast ratios include 16.86:1 light primary text, 4.63:1 light secondary text, 17.32:1 dark primary text, 8.87:1 dark secondary text and 7.23:1 primary-button label.

## Requirements

- Never communicate status by color alone.
- Maintain visible keyboard focus using Information Blue `#2563EB`.
- Minimum target size is 44 × 44 px.
- Provide text alternatives for charts and health scores.
- Support reduced motion.
- Test zoom, large text, RTL layout and screen readers.
- Health guidance must distinguish measured data, inference and recommendation.

Light and dark themes are peers. Dark mode is not a simple inversion; use the theme tokens supplied in the package.

