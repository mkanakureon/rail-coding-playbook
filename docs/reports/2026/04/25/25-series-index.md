# シリーズ索引・読む順番ガイド — 2026-04-25 文書群

## このシリーズについて

`docs/09_reports/2026/04/25/` に **15 文書 + 計画書 + 候補リスト** = 計 **17 文書** を配置している。テーマは **「kaedevn-monorepo の AI 連携リファレンス本」**。読者は **IT 経験者・生成 AI 初心者** を想定。

> 全文書 Claude Code 単独執筆。Gemini CLI 用は `docs/10_ai_docs/` に別系統で並走（前書 16）。

---

# 第 1 部 — 全文書一覧

## 基盤シリーズ（01〜09）— 思想と全体像

| # | ファイル | 主題 | 概要 |
|---|---|---|---|
| 01 | [01-guardrails-reproduction.md](./01-guardrails-reproduction.md) | ガードレール再現手順 | hooks / sync テスト / architecture-check |
| 02 | [02-guardrails-ts-techniques.md](./02-guardrails-ts-techniques.md) | TS 特有の技法 | 判別共用体 / strict / isolatedModules |
| 03 | [03-typescript-with-genai.md](./03-typescript-with-genai.md) | TS が AI と相性良い理由 | 型 = AI への暗黙の指示書 |
| 04 | [04-document-implementation-workflow.md](./04-document-implementation-workflow.md) | 設計→計画→実装→テスト | 4 段順守、AI 暴走の止め方 |
| 05 | [05-rag-search-system.md](./05-rag-search-system.md) | RAG 検索システム | pgvector + ハイブリッド検索 |
| 06 | [06-commit-message-conventions.md](./06-commit-message-conventions.md) | コミット慣行 | Co-Authored-By + 感想 |
| 07 | [07-workflow-actual-elapsed-time.md](./07-workflow-actual-elapsed-time.md) | 実所要時間 | 計画 14 日 → 実測 4 時間 |
| 08 | [08-cli-via-ai-prompts.md](./08-cli-via-ai-prompts.md) | CLI を AI 経由で | 31 スキルで作業を圧縮 |
| 09 | [09-all-tests-overview.md](./09-all-tests-overview.md) | 全テスト + Docker E2E | 162 + 75 + 89 ケース、6 層 |

## 計画系（10〜11）

| # | ファイル | 主題 |
|---|---|---|
| 10 | [10-additional-examples-to-document.md](./10-additional-examples-to-document.md) | 未カバー実例リスト 38 件 |
| 11 | [11-documentation-plan.md](./11-documentation-plan.md) | 実装計画書（D1〜D15） |

## 実装シリーズ（12〜24）— 個別技術

| # | ファイル | 主題 | 行数目安 |
|---|---|---|---|
| 12 | [12-mcp-server-implementation.md](./12-mcp-server-implementation.md) | MCP サーバー自前実装 | ~400 |
| 13 | [13-skill-design-patterns.md](./13-skill-design-patterns.md) | スキル設計パターン | ~500 |
| 14 | [14-claude-code-hooks.md](./14-claude-code-hooks.md) | Hooks による安全弁 | ~300 |
| 15 | [15-ai-metadata-api.md](./15-ai-metadata-api.md) | AI Metadata API | ~400 |
| 16 | [16-multi-ai-parallel-dev.md](./16-multi-ai-parallel-dev.md) | Multi-AI 並列開発 | ~300 |
| 17 | [17-broken-memo-pattern.md](./17-broken-memo-pattern.md) | broken-memo パターン | ~250 |
| 18 | [18-devlog-from-git-log.md](./18-devlog-from-git-log.md) | devlog 自動生成 | ~250 |
| 19 | [19-phase-incremental-pattern.md](./19-phase-incremental-pattern.md) | Phase 段階実装 | ~350 |
| 20 | [20-llm-feature-pipeline.md](./20-llm-feature-pipeline.md) | LLM 機能パイプライン | ~450 |
| 21 | [21-llm-gateway-abstraction.md](./21-llm-gateway-abstraction.md) | ai-gateway 抽象 | ~300 |
| 22 | [22-design-principles-collection.md](./22-design-principles-collection.md) | 設計原則アンソロジー | ~500 |
| 23 | [23-operations-collection.md](./23-operations-collection.md) | 運用パターン集 | ~400 |
| 24 | [24-skills-and-scripts-catalog.md](./24-skills-and-scripts-catalog.md) | スキル + スクリプトカタログ | ~600 |

## 索引・完了レポート（25〜26）

| # | ファイル | 主題 |
|---|---|---|
| **25** | **本書** — シリーズ索引・読む順番 | この文書 |
| 26 | (予定) [26-documentation-completion-report.md](./26-documentation-completion-report.md) | 完了レポート |

---

# 第 2 部 — 読む順番ガイド（読者別）

## 経路 1: 全体を最短で把握したい

```
04 (workflow) → 01 (guardrails) → 09 (tests) → 25 (本書)
```

4 文書で「**設計思想 + 規律 + 検証 + 索引**」が揃う。**約 2 時間**。

## 経路 2: AI 連携に絞って学びたい

```
03 (TS と AI) → 13 (skill) → 14 (hooks) → 12 (MCP) → 15 (AI Metadata) → 16 (Multi-AI)
```

「**AI を真剣に使う**」ための 6 文書。**約 2.5 時間**。

## 経路 3: 自分のプロジェクトに移植したい

```
01 (guardrails 再現) → 02 (TS 技法) → 13 (skill) → 14 (hooks) → 21 (gateway) → 22 (原則) → 23 (運用)
```

最も実装的なルート。**約 4 時間**。各文書に **「自分のプロジェクトへの移植手順」** セクションあり。

## 経路 4: テスト戦略を学びたい

```
09 (all tests) → 01 (guardrails で sync テスト) → 22 (frozen schema)
```

テスト中心の 3 文書。

## 経路 5: 開発フローを学びたい

```
04 (workflow) → 06 (commit) → 07 (実所要時間) → 17 (broken-memo) → 18 (devlog) → 19 (phase)
```

「**毎日の開発をどう回すか**」の 6 文書。

## 経路 6: LLM 機能を組み込みたい

```
05 (RAG) → 12 (MCP) → 20 (LLM パイプライン) → 21 (gateway)
```

AI 機能の自前実装 4 文書。

## 経路 7: 全文通読（推奨）

01 → 02 → 03 → 04 → 05 → ... → 24 の **連番通り**。**約 10 時間**。基盤 → 実装 の流れで理解が深まる。

---

# 第 3 部 — テーマ別クロスリファレンス

## ガードレール（壊れない仕組み）

- 01 guardrails-reproduction（全体像）
- 02 ts-techniques（型ガードレール）
- 09 all-tests-overview（テスト層）
- 14 hooks（Claude Code 自身のガードレール）
- 22 design-principles（C ゾーン保護）

## AI 連携の核

- 03 typescript-with-genai
- 12 mcp-server-implementation
- 13 skill-design-patterns
- 14 hooks
- 15 ai-metadata-api
- 16 multi-ai-parallel-dev

## ドキュメント運用

- 04 document-workflow
- 06 commit-conventions
- 17 broken-memo
- 18 devlog
- 25 本書

## LLM 機能

- 05 rag-search
- 20 llm-feature-pipeline
- 21 llm-gateway

## 設計と原則

- 02 ts-techniques
- 19 phase-incremental
- 22 design-principles

## 運用

- 08 cli-via-ai-prompts
- 23 operations-collection
- 24 skills-catalog

---

# 第 4 部 — 文書ごとの「次に読むべき」推薦

| この文書を読んだら | 次におすすめ |
|---|---|
| 01 guardrails | 02 ts-techniques / 09 tests |
| 02 ts-techniques | 03 typescript-with-genai |
| 03 typescript-with-genai | 15 ai-metadata-api |
| 04 workflow | 06 commit / 07 elapsed-time |
| 05 rag-search | 12 mcp / 20 llm-pipeline |
| 06 commit | 18 devlog |
| 07 elapsed-time | 19 phase-incremental |
| 08 cli-via-ai | 13 skill / 24 catalog |
| 09 tests | 01 guardrails / 22 design |
| 12 mcp | 13 skill / 15 ai-metadata |
| 13 skill | 14 hooks / 24 catalog |
| 14 hooks | 22 design (C ゾーン) |
| 15 ai-metadata | 20 llm-pipeline |
| 16 multi-ai | 04 workflow |
| 17 broken-memo | 09 tests |
| 18 devlog | 06 commit |
| 19 phase | 07 elapsed-time |
| 20 llm-pipeline | 21 gateway |
| 21 gateway | 20 pipeline |
| 22 design | 02 ts-techniques |
| 23 operations | 24 catalog |
| 24 catalog | 各スキルの SKILL.md |

---

# 第 5 部 — このリポジトリ外の参照

本シリーズが前提とする外部資料:

- `CLAUDE.md` — Claude Code 用ガイダンス（リポジトリルート）
- `GEMINI.md` — Gemini CLI 用ガイダンス
- `.claude/skills/{name}/SKILL.md` — 各スキルの詳細手順
- `docs/landing/codebase-docs/` — コード説明書 22 本
- `docs/01_in_specs/` — 人間の原典仕様書
- `docs/10_ai_docs/` — Gemini CLI 用文書（並走シリーズ）

---

# まとめ

このシリーズは **17 文書 / 約 6,000 行** の規模。全文通読で **AI 連携リファレンス本** として読み切れる。

「**何から読むか迷ったら本書（25）から**」を入口に、目的に合った経路で読み進める。各文書に必ず「自分のプロジェクトへの移植手順」セクションがあるので、**読みながら自分のプロジェクトに適用** できる。
