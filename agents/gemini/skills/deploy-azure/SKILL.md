---
name: deploy-azure
description: Guardrail for Azure deployments. Use when the user asks to "deploy", "push to production", or deploy to Azure. Prevents direct script execution.
---
# Deploy Azure Skill

This skill acts as a guardrail to prevent dangerous direct deployments from the local environment.

## Critical Rule

**NEVER execute `./scripts/deploy-azure.sh` directly.**
All deployments must be handled by GitHub Actions.

## Handling Deployment Requests

When the user requests a deployment to Azure:

1. **Refuse Direct Execution**: Politely inform the user that local deployment scripts are disabled for safety.
2. **Guide to CI/CD**: Explain that deployments are triggered automatically (or manually) via GitHub Actions when code is pushed to the `main` branch.
3. **Offer Next Steps**: Offer to prepare a commit and push the changes to `main` using the `safe-commit` workflow if there are uncommitted changes.
