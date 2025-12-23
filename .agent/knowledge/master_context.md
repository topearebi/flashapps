# Master System Context

> **CRITICAL FOR AGENTS**: Read this file before making major architectural changes.

## System Overview
This is a **Monorepo** hosting a portfolio of AI-enabled web applications.
- **Goal**: Demonstrate enterprise-grade AI integration, CI/CD, and UX design.
- **Host**: GitHub Pages (Single root `origin/gh-pages`).
- **Core Stack**: React, Vite, Vanilla CSS (Variables), pnpm workspaces, TurboRepo.

## Architecture Map
- **Root**: Configuration and orchestration.
- **`packages/ui`**: The Design System. **Source of Truth for Styles**.
  - *Rule*: Never hardcode colors in apps. Use variables from here.
  - *Rule*: Always use `Layout` and `Button` from here.
- **`packages/utils`**: Shared Business Logic.
  - *Rule*: AI Client instantiation happens here.
  - *Rule*: API Key persistence logic happens here.
- **`apps/*`**: The implementation layer.
  - `portfolio`: The Gateway (Path: `/`).
  - `flashcards`: AI App 1 (Path: `/flashcards`).
  - `puzzle-solver`: AI App 2 (Path: `/puzzle-solver`).

## Agent Protocols (Anti-Hallucination)
1. **Verify Existence**: Before importing a file, verify it exists.
2. **Check Uniqueness**: Do not create duplicate components in `apps/` if they belong in `packages/ui`.
3. **Build Integrity**: After editing code, run `pnpm build` to verify you didn't break the build graph.
4. **Context Loading**: If you are confused about the state, read `.agent/knowledge/project_structure.md`.

## Current State
- Monorepo initialized.
- Shared packages created.
- Portfolio app created.
- CI/CD workflows created.
