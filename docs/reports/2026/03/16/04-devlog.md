# 開発日誌 — 2026-03-16

## 概要

リリース前テストカバレッジ分析 → テストギャップ解消 → ツクール PR レビュー → バグ修正 → ツクール全機能テストの一連を1セッションで実施。

**2台の Claude Code 並行開発**（レビュー側 + 実装側）で、約4時間で以下を達成:

| 指標 | 値 |
|------|-----|
| main コミット数 | 20+ |
| 変更ファイル | 78+ |
| 追加行数 | **+8,563行** |
| PR レビュー＆マージ | **5本** (#4, #6, #7, #8, #9/10) |
| テスト追加 | **56件**（Unit 27 + E2E 29） |
| バグ発見 | **8件**（7件修正、1件 Issue） |

## 発見・修正したバグ

| # | バグ | 発見方法 | 修正 |
|---|------|---------|------|
| 1 | Parser.ts: if ブロック後テキスト到達不能 | テスト実装中 | `8c37492` |
| 2 | ksc-demo.ts: API preview で gameDb/templates 未取得 | PR レビュー | `59f8cc7` |
| 3 | applyAction.ts: 致死ダメージ時 RNG 消費欠落 | コードレビュー | `c757dc6` |
| 4 | SaveData.ts: statuses 型不一致（string[] vs Record） | コードレビュー | `c757dc6` |
| 5 | WebOpHandler.ts: scrollText メモリリーク | コードレビュー | `6fd6c85` |
| 6 | commandSync: call/scroll_text が COMMAND_DEFINITIONS 未登録 | テスト実行 | `6fd6c85` |
| 7 | Compiler.ts: labels PC が transform 後にズレる可能性 | コードレビュー | Issue #5 |
| 8 | Header.tsx/EditorPage.tsx: 保存時に characters/templates/gameDb 欠落 | テストスクリーンショットで発見 | `a300068` |

## テスト追加

### リリース前テストギャップ解消（+18テスト）

| Phase | 内容 |
|-------|------|
| 0 | if JUMP バグ修正 + E2E 検証復活 |
| 1 | choice+if KSC 生成 unit test (+5) |
| 2 | Guest → アップグレード E2E (+4) |
| 3 | Cloud Save/Load E2E (+5) |
| 4 | jump 参照整合性 unit test (+2) |

### ツクール機能テスト（+38テスト）

| Phase | 内容 | テスト数 |
|-------|------|---------|
| T7 | ステータス効果 Unit テスト | 6 |
| T5 | scroll_text プレビュー | 1 |
| T6 | map_jump プレビュー | 2 |
| T4 | バトル gameDb 連携 | 2 |
| T1 | エディタ新ブロック追加 | 4 |
| T2 | GameDb エディタ CRUD | 5 |
| T3 | テンプレート管理 | 3 |
| (既存) | experience.test.ts（PR #8 付属） | 14 |

### テストインフラ

- **autoFight テストフック**: BattleScene に `autoFight` フラグ追加。autostart=1 時にデフォルト有効。バトルを自動進行して完走確認
- **window.__test__**: Playwright からゲーム内部状態を読み取るフック

## PR レビュー＆マージ

| PR | タイトル | 行数 | 指摘 |
|----|---------|------|------|
| #4 | ツクール Phase 2-6 コア実装 | +2,042 | C2件 H6件 M9件 |
| #6 | エディタ UI + バトル PixiJS + PlayLayout | +1,310 | 軽微2件 |
| #7 | 残タスク7項目 | +874 | MapTestPlay 最適化指摘 |
| #8 | Phase 7 経験値・装備・ショップ | +1,091 | 問題なし |
| #9/10 | Phase 8-9 アニメ・オートタイル | +292 | 問題なし |

## CI 設定変更

GitHub Actions の全ワークフロー push トリガーを無効化（課金対策）。手動デプロイは `gh workflow run` で可能。PR トリガーは残存。

## 2台並行開発の知見

| 観点 | 効果 |
|------|------|
| バグ発見 | レビュー側がテスト＋コードレビューでバグ8件発見 |
| 修正サイクル | main に修正 push → 実装側が `git merge main` で即取り込み |
| 衝突回避 | ファイルが被らない分業（レビュー: テスト/バグ修正、実装: 機能/UI） |
| 速度 | 時速 +2,850行/時間。単純な2倍速ではなく相乗効果 |
