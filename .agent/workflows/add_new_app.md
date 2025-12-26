---
description: Formal process for adding a new application to the portfolio
---

# Workflow: Add New App

> **CRITICAL**: Do not write a single line of code until Step 3 is complete and signed off.

## Phase 1: Assessment & Agreement
1.  **Define Identity**:
    *   **Name**: Must be unique (e.g., `@tope/flashcards`).
    *   **Directory**: Must be `apps/<app-name>`.
2.  **Problem Statement**:
    *   What problem does this solve?
    *   Who is the user?
3.  **Requirements & Flow**:
    *   List functional requirements.
    *   Describe the user journey (Step-by-step).
4.  **Technical Assessment**:
    *   What shared packages will it use?
    *   What AI models are required?
5.  **Sign-Off**:
    *   Create a `README.md` in the target directory with the above details.
    *   **STOP**: Present this plan to the user.
    *   **Proceed ONLY** after explicit user approval.

## Phase 2: Implementation (Iterative)
6.  **Scaffolding**:
    *   Run `mkdir apps/<name>`.
    *   Initialize: `pnpm create vite . --template react`.
    *   Update `package.json` to `@tope/<name>` and add dependencies (`@tope/ui`, `@tope/utils`).
    *   Configure `vite.config.js` with `base: '/<name>/'`.
7.  **Testing Harness**:
    *   Install `vitest`.
    *   Create a dummy test to ensure harness works.
8.  **Development Loop**:
    *   **Step A**: Implement a small feature.
    *   **Step B**: Write Unit/Integration test.
    *   **Step C**: Verify pass.
    *   *Repeat*.

## Phase 3: Documentation & Release
9.  **Documentation**:
    *   Update `README.md` with: "How to run", "Architecture", "Key Features".
10. **Final Verification**:
    *   Run `pnpm build` (must pass for whole repo).
    *   Run `pnpm lint`.
