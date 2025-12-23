---
description: Enterprise CI/CD and Release Workflow
---

# Enterprise CI/CD Workflow

## Philosophy
We treat this portfolio as a production-grade system.
- **Main Branch is Sacred**: The `main` branch must always be deployable.
- **Everything via PR**: No direct pushes to main.
- **Automated Gates**: Code cannot merge unless it passes Lint, Test, and Build.

## The Pipeline

### 1. Pull Request (The "Staging" Phase)
When a developer (you) opens a PR:
1. **Validation**: GitHub Actions triggers `ci.yml`.
   - Lints code (ESLint).
   - Runs Unit Tests (Vitest).
   - Runs Build Check (ensures no compile errors).
2. **Review**: Code must be reviewed (self-review accepted for solo projects, but the discipline matters).
3. **Merge**: Only squash-merge after checks pass.

### 2. Deployment (The "Production" Phase)
When code lands on `main`:
1. **Build**: The entire monorepo is rebuilt.
2. **Release**: The `dist` folder is deployed to GitHub Pages.
3. **Rollback**: If a bug is found, revert the PR in Git and the pipeline automatically redeploys the previous safe state.

## Versioning
- We use SemVer.
- Significant changes should be tagged in git.
