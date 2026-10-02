# Connecting this repository

The repository is self-contained. After creating an empty GitHub repository, connect and publish it:

```bash
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git push -u origin main
```

## Connect to the main product later

Choose one strategy; do not use all three.

### Git subtree — recommended

Keeps brand history while making files available directly inside the product repository.

```bash
git remote add runpuy-brand <BRAND_REPOSITORY_URL>
git fetch runpuy-brand
git subtree add --prefix=brand-system runpuy-brand main --squash
```

Future updates:

```bash
git subtree pull --prefix=brand-system runpuy-brand main --squash
```

### Git submodule

Use when the brand package should keep an independent checkout and release cycle.

```bash
git submodule add <BRAND_REPOSITORY_URL> brand-system
```

### One-time copy

Copy `docs/brand-system/` and `assets/brand/` into matching paths in the main repository. This is simplest but does not preserve an update relationship.

