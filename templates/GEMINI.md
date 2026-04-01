# GEMINI.md - kaedevn-monorepo

This file provides context and instructions for the Gemini CLI agent working in the `kaedevn-monorepo`.

## Project Overview

**kaedevn-monorepo** is a cross-platform visual novel engine targeting **Nintendo Switch** (primary) and **Web** (secondary, via PixiJS/WebGL). It uses a monorepo structure with multiple applications and shared packages.

### Architecture

The system follows a 3-tier architecture:
1.  **Next.js (apps/next):** The main landing page, user portal, and project management site. (Port 3000)
2.  **Editor (apps/editor):** A React/Vite-based visual editor for creating visual novels. (Port 5176/5173)
3.  **Hono API (apps/hono):** Node.js backend API serving both the Next.js portal and the Editor. (Port 8080)
4.  **Core Packages (packages/):** Shared logic including the engine (`web`), script interpreter (`interpreter`), and core types (`core`).

### Tech Stack
- **Frontend:** Next.js (App Router), React, TailwindCSS (for some parts), Vanilla CSS (preferred for core).
- **Backend:** Hono, Node.js, PostgreSQL.
- **Rendering:** PixiJS (Web), with abstractions for native ports.
- **Infrastructure:** Azure Container Apps, Docker.

## Building and Running

### Development

The primary entry point for local development is the `dev-start.sh` script.

```bash
# Start all services (API, Next.js, Editor)
./scripts/dev-start.sh all

# Start specific services
./scripts/dev-start.sh api next editor
```

| Service | Local URL | Role |
| :--- | :--- | :--- |
| **Next.js** | `http://localhost:3000` | Landing page, User portal (Main Entry) |
| **Editor** | `http://localhost:5176` | Visual Novel Editor |
| **Hono API** | `http://localhost:8080` | Backend API |
| **Engine Preview** | `http://localhost:5175` | Engine/Game preview |

### Core Commands

```bash
# Install dependencies
npm install

# Build core engine and web implementation
npm run build

# Run type checks across the monorepo
npm run typecheck

# Run tests for all packages
npm test

# Run E2E tests (Playwright)
npm run test:e2e
```

## Development Conventions

### 1. Portability First (Nintendo Switch)
Rendering is done via PixiJS, but logic **must** use abstractions for platform-specific features:
- **IInput:** Unified action dispatch (`OK`, `Back`, `Menu`, etc.). No direct DOM event handling in game logic.
- **IAudio:** Categorized playback (BGM, SE, VOICE).
- **IStorage:** Save/Load abstraction.

### 2. Resolution & UI
- **Logical Resolution:** 1280×720.
- **Safe Area:** 5% margins (64px horizontal, 36px vertical).
- **Layout:** Anchor-based relative coordinates; avoid hardcoded pixels.

### 3. Coding Style
- **Language:** Specifications and documentation are primarily in **Japanese**. Code, identifiers, and commit messages should be in **English**.
- **State Management:** Lift state to the closest common ancestor.
- **Styling:** Prefer **Vanilla CSS** for maximum flexibility and performance in the engine core.

### 4. Testing & Validation
- **Empirical Reproduction:** Always reproduce a bug with a test case before applying a fix.
- **E2E Testing:** Critical flows (Login, Project Creation, Editor saving) are covered by Playwright tests in `tests/`.

## Key Directories

- `apps/`: Main applications (next, editor, hono).
- `packages/`: Shared libraries (core, interpreter, web, ui).
- `docs/`: Design specifications and architecture guides.
- `scripts/`: Development and deployment utilities.
- `projects/`: Sample/User project data.

## Deployment

Deployments to Azure are managed via the `./scripts/deploy-azure.sh` script. Do not use `docker build` or `az acr build` directly.

```bash
# Deploy all apps
./scripts/deploy-azure.sh
```

## AI Agent Governance & Audit Mandate (Chief Audit Officer)

このプロジェクトにおけるAIエージェントは、単なるコード生成器ではなく、システムの「最高監査責任者（CAO）」としての役割を担う。AIは「人間は自分のコードを一行も読まない」という前提に立ち、論理、数学、構造の正しさを自律的に証明・報告しなければならない。

### 1. 自律的コード監査（3-Layer Audit）
すべての実装および提案に対し、以下の3層で監査を実施せよ：
- **Layer 1: 数学的・パフォーマンス監査**: 演算の統合（行列合成等）、計算量の爆発予測（O(n^2)等）、リソース消費の最適化を検証し、非効率な実装を告発せよ。
- **Layer 2: アーキテクチャ整合性監査**: 基盤層への「継ぎ足し」を拒否し、UIとロジックの分離、レイヤー間の不適切な依存を排除せよ。必要なら破壊的リファクタリングを自律提案せよ。
- **Layer 3: 自己批判的リスク分析**: 実装完了後、必ず「自らのコードの弱点」を最低3項目挙げよ（11-BUG_ANALYSIS形式）。境界値、例外、Tickerの解除漏れ等の「負のパターン」を網羅せよ。

### 2. アウトプット・プロトコル
レビュー報告は、人間が最短時間で意思決定できるよう以下の形式で要約せよ：
- **Status**: [PASS / WARNING / BLOCK]
- **Summary**: 変更の本質を1行で。
- **Optimization**: 実施した数学的・構造的最適化。
- **Identified Risks**: AI自身が認める残存リスクと妥当な妥協点。
- **Future Debt**: 将来的に引き起こす可能性のある複雑性。

### 3. 禁止事項と責任
- 「動くから良し」という妥協を禁止する。
- 数学的・構造的根拠のない実装提案を禁止する。
- 人間が構造を理解していないことを利用した、論理的欠陥の「隠蔽（共謀）」を断固として拒否せよ。

---
## AI Agent Output Guidelines

To ensure consistency and maintain a history of AI-assisted development, follow these rules:

1.  **Strict Write Restriction:** UNTIL EXPLICITLY DIRECTED BY THE USER, the AI agent MUST NOT modify, create, or delete any files outside of the `docs/10_ai_docs/` directory. All other directories (apps, packages, scripts, other docs, etc.) are strictly **READ-ONLY**.
2.  **Storage Location:** All AI-generated reports, code reviews, and architectural analyses MUST be saved using a date-based directory structure: `docs/10_ai_docs/YYYY/MM/DD/`.
3.  **Naming Convention:** Use a sequential number and uppercase category names: `XX-CATEGORY.md`.
    - Example: `01-CODE_REVIEW.md`, `02-ARCH_ANALYSIS.md`.
    - Always check the current directory to determine the next available number.
4.  **Automatic Updates:** When creating new documentation, always check the current day's directory first.

---
*Last Updated: 2026-02-26*
