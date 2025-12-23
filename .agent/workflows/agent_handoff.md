---
description: Protocols for AI Agents working on this repo
---

# Agent Handoff & Safety Protocols

## 1. The "Big Picture" First
Before starting ANY task, read `master_context.md`. If you don't understand where the component fits, STOP and read `implementation_plan.md`.

## 2. Anti-Hallucination Checklist
- **File Systems**: Do not assume a file exists. Check it with `ls` or `find`.
- **Imports**: verification. If you import `Button` from `@tope/ui`, check `packages/ui` to see if `Button` is actually exported in `index.js`.
- **Commands**: If `pnpm build` fails, do not just "try again". Read the error.

## 3. State Preservation
- If you are about to run out of steps or need to switch context, update `.agent/knowledge/current_state.md` (or similar) with:
  - What was just finished.
  - What is currently broken.
  - The exact next step to take.

## 4. Debugging Loops
If you try to fix the same error 3 times and fail:
1. Stop.
2. Re-read the error.
3. Search for the error text in the codebase.
4. Notify the user.
