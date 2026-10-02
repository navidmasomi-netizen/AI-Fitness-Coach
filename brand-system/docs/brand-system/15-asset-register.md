# 15 — Asset Register

| Location | Status | Purpose |
|---|---|---|
| `01-logo/` | Approved | canonical logo and reference sheet |
| `02-app-icons/ios/` | Production master | opaque 1024 px App Store source |
| `02-app-icons/android/` | Production master | adaptive background, foreground, monochrome |
| `02-app-icons/web/` | Production master | favicon and PWA sizes |
| `03-social/avatars/` | Provisional approval | current social avatar |
| `03-social/templates/` | Approved direction | static content layouts |
| `04-product/` | Approved concept | splash and web application examples |
| `05-iconography/` | Approved | Precision Motion SVG masters |
| `06-tokens/` | Approved | design-token source and code exports |
| `archive/` | Not production | alternatives, rejected routes and review history |

Every release regenerates `reports/SHA256SUMS` and `reports/validation.json`. Consumers should use files from production folders, never the archive.

