# AI-Fitness-Coach V2 — Product Brand System

Canonical brand repository for **RUNPUY**, a premium health-intelligence product.

## Status

Release candidate: **v1.0.0-rc.1**. Brand decisions are locked and production assets are validated. The final designer-authored vector master, licensed photography library, and real App Store screenshots remain external release dependencies.

## Approved system

| Area | Decision |
|---|---|
| Brand | RUNPUY |
| Tagline | KEEP PUYING (English only) |
| Positioning | Premium Health Intelligence |
| Logo | Custom RUNPUY wordmark + compact framed R tile |
| Palette | Warm White, Ink, Deep Navy, Emerald, Pale Mint |
| Typography | Manrope / Vazirmatn |
| Icons | Precision Motion |
| Layout | Structured Calm |
| Interaction | Responsive Calm |
| Components | Layered Intelligence |
| Social direction | Health Intelligence (Route B) |

## Repository map

- `docs/brand-system/` — rationale, rules, decisions and audit
- `assets/brand/01-logo/` — approved logo variants and production sheet
- `assets/brand/02-app-icons/` — iOS, Android and web exports
- `assets/brand/03-social/` — provisional approved avatar and social templates
- `assets/brand/04-product/` — splash and web application examples
- `assets/brand/05-iconography/` — standalone Precision Motion icons
- `assets/brand/06-tokens/` — JSON, CSS and TypeScript design tokens
- `assets/brand/archive/` — rejected or exploratory work; not for production
- `reports/` — validation report and checksums

## Build and validate

```bash
python scripts/build_release_assets.py
python scripts/validate_brand_assets.py
```

The repository is intentionally standalone and can later be added to the main product repository as a subtree, submodule, or copied under `docs/brand-system` and `assets/brand`.

