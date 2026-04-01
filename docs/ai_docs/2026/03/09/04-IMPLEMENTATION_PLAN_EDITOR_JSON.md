# 実施計画書：Gemini 多段階生成・エディタ直結出力の実装（Fantasy テスト版）

## 1. 目的
`docs/10_ai_docs/2026/03/09/` の 01〜03 の設計・戦略に基づき、`assist-cli.ts` を刷新する。
**リファレンスとして `projects/fantasy/output/20260308_143338/editor-json/` を使用し、同等の構造を持つ JSON を Gemini が直接生成することを目指す。**

## 2. 実装フェーズ

### フェーズ 1：Config ローダーと基本構造の構築
- **Config ローダー**: `scripts/cli/configs/*.json` を読み込み。特に `fantasy.json` を基準とする。
- **Manifest 生成**: `manifest.json` と `characters.json` をリファレンスと同じ形式で書き出す。
- **設定の移行**: `projects/fantasy/settings/` 内のファイルを `s_01_overview.md` 等の新仕様（v2）にリネーム・ヘッダー追加。

### フェーズ 2：Stage 4 (JSON Generator) の刷新
- **`editor-json-generator.ts` 実装**:
  - `Stage 3` の本文ドラフトを受け取り、`page-XXX.json`（ブロック配列）に変換。
  - **リファレンスの `page-001.json` 等の構造を厳密に模倣する。**
  - 46文字×3行の制約、`@r\n` 改行、`start`/`bg`/`ch`/`text`/`jump` ブロックの正しい配置。

### フェーズ 3：2パス（ドラフト＆リライト）の実装
- **モデル切り替え**: 
  - Stage 3 (Flash-Lite): 本文ドラフト。
  - Stage 4 (3.1 Pro): エディタ形式への成形。
- `fantasy` プロジェクトの第1章を対象にテスト生成を実施。

### フェーズ 4：検証と画像プロンプト連携
- **投入テスト**: 生成した JSON を `ks-upload.mjs` でエディタに投入。
- **画像連携**: `assets-prompts.json` の生成ロジック追加。

## 3. リファレンスデータ
- **Path**: `projects/fantasy/output/20260308_143338/editor-json/`
- **確認ポイント**:
  - `manifest.json` のアセット依存関係。
  - `page-XXX.json` 内のブロック ID 命名規則 (`text-1` 等)。
  - テキスト内の `@r\n` の位置。

## 4. 成功の定義
- `projects/fantasy/output/` 配下に、リファレンスと互換性のある `editor-json/` が生成されること。
- `ks-upload.mjs` によるエディタへの投入が成功すること。

---
*本計画は docs/10_ai_docs/2026/03/09/ の 01-03 および 05-07 ドキュメントに基づき作成されました。*
