---
name: safe-commit
description: Commit changes safely using workspace guidelines. Use when the user asks to "commit", "push", or "save my work". Intercepts commit requests to ensure testing and linting are performed first.
---
# Safe Commit Skill

This skill ensures that all code changes in the `kaedevn-monorepo` are tested and validated before being committed to version control.

## 🔴 CRITICAL RULE: MAIN BRANCH PROTECTION
**Direct commits or merges to the `main` branch are STRICTLY PROHIBITED.**
Any work must be performed on a feature branch. Before committing or merging, always verify the current branch.

1. **Check Branch**: If the current branch is `main`, the agent MUST stop and ask the user to create a feature branch.
2. **Never Merge to Main**: The agent is not allowed to execute `git merge` into `main` unless explicitly and repeatedly confirmed by the user for a final release.

## Required Workflow
...
Never commit code immediately. Always follow this exact sequence:

1. **Verify Changes**: Use `git status` and `git diff` to review what will be committed.
2. **Run Tests (Mandatory)**: Execute the tests for the affected workspaces.
   - Example: `npm test -w @kaedevn/hono`
   - If tests fail, **DO NOT COMMIT**. Stop and inform the user, or fix the code.
3. **Type Check & Lint (Recommended)**: Run `npm run typecheck` and `npm run lint` if the changes are significant.
4. **Commit**: Only after all checks pass, proceed with `git add` and `git commit`. Use Conventional Commits formatting.
5. **Report (Optional)**: If requested, create a report in `docs/09_reports/YYYY/MM/DD/` only after the commit succeeds.
