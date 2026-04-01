# 引き継ぎ資料: assist-* テスト修正

> ブランチ: `fix/assist-test-sync`
> 担当: Gemini CLI
> 作成日: 2026-03-15

## 概要

`apps/hono/test/assist-*.test.ts` の 36 テストが失敗している。
原因は **実装側が複数回リファクタされたのに、テスト側の期待値が古いまま** になっていること。
実装のバグではなくテストの不整合なので、**テスト側を現在の実装に合わせて修正する**。

## ルール（重要）

- **実装（`src/lib/assist/`）は変更しない** — テスト側だけ直す
- 各テストの `expect` が実装の実際の出力と一致するように期待値を更新する
- 修正後 `npm test -w @kaedevn/hono` で **0 failed** にする
- テストの意図（何を検証しているか）は変えない。期待文字列だけ現在の実装に合わせる

## 失敗テスト一覧（36件、5ファイル）

### 1. test/assist-ks-generator.test.ts（7 failed）

| テスト名 | エラー概要 |
|---------|-----------|
| dialogue をセリフテキストのみ出力する（話者プレフィックスなし） | 出力形式が変わった |
| dialogue テキストをそのまま出力する | 同上 |
| 不明な slug でもテキストのみ出力する | 同上 |
| choice を choice {} ブロックに変換する | choice 出力形式の変更 |
| flagSet を @set コマンドに変換する | @set 出力形式の変更 |
| jumpTo を @jump コマンドに変換する | @jump 出力形式の変更 |
| 複合的なシーンを正しく変換する | 上記全ての複合 |

**修正方針**: `ks-generator.ts` の `generateKS()` を実際に呼んで出力を確認し、テストの期待値を更新。

### 2. test/assist-md-parser.test.ts（6 failed）

| テスト名 | エラー概要 |
|---------|-----------|
| デモ設定ファイルを読み込める | ファイルパス解決エラー |
| キャラクターを正しく読み込む | 同上 |
| overview.md のボディを overview に格納する | 同上 |
| オプションファイルを読み込む | 同上 |
| アセットマッピングを読み込む | 同上 |
| 存在しないディレクトリはエラー | エラー型の不一致 |

**修正方針**: テストで参照している `projects/demo/settings/` のパスが正しいか確認。`loadProjectSettings()` の引数を現在のディレクトリ構造に合わせる。

### 3. test/assist-prompts.test.ts（9 failed）

| テスト名 | エラー概要 |
|---------|-----------|
| system にジャンルとルールを含む | プロンプト文面が変わった |
| targetLength 未指定時はデフォルト 3 章 | 関数シグネチャ変更 |
| 対象章の情報を含む | プロンプト構造変更 |
| 全章プロットのコンテキストを含む | 同上 |
| system にシーンプロット情報を含む | 同上 |
| user に場所・時間・キャラを含む | 同上 |
| previousContext がある場合に含む | 新パラメータ対応 |
| previousEpisodeSummary がある場合に含む | 同上 |
| system に要約指示を含む | プロンプト文面変更 |

**修正方針**: `prompts.ts` の各 `build*Prompt()` 関数を実際に呼んで出力を確認し、`toContain` の期待文字列を更新。

### 4. test/assist-context.test.ts（11 failed）

| テスト名 | エラー概要 |
|---------|-----------|
| system に要約指示と200字制限を含む | プロンプト文面変更 |
| system に状態変化抽出の指示を含む | 同上 |
| user に対象キャラクターとテキストを含む | user プロンプト構造変更 |
| system に章要約の指示と文字数制限を含む | 同上 |
| user に章タイトルと各話要約を含む | 同上 |
| user にキャラクター状態を含む | 同上 |
| valid な章要約を受け入れる | `ChapterSummaryResultSchema` が undefined |
| previousChapterSummaries がある場合にセクションを含む | 新パラメータ |
| characterStates がある場合にセクションを含む | 同上 |
| previousChapterSummaries（最新2章のみ） | 同上 |
| 従来のパラメータのみでも動作する（後方互換） | 同上 |

**修正方針**:
- `context.ts`（または統合先）の関数を確認し、テストの import と期待値を更新
- `ChapterSummaryResultSchema` の export 元を確認（`schemas.ts` に移動された可能性）

### 5. test/assist-schemas.test.ts（1 failed）

| テスト名 | エラー概要 |
|---------|-----------|
| 不正な line type を拒否する | スキーマが `unknown` を許容するようになった |

**修正方針**: `schemas.ts` の `SceneTextResultSchema` の Line 型定義を確認し、テストを合わせる。

### 6. test/assist-pipeline.test.ts（2 failed）— assist-cli-e2e.test.ts 内

- MockClient での E2E テスト 2 件が上記の関数変更に連鎖して失敗
- 上記 1〜5 を修正すれば連鎖的に解消される可能性が高い

## 対象ファイル

### 実装（読み取り専用 — 変更しない）

```
apps/hono/src/lib/assist/
├── ks-generator.ts    # KS スクリプト生成
├── md-parser.ts       # Markdown 設定パーサー
├── prompts.ts         # プロンプト構成関数
├── schemas.ts         # Zod スキーマ定義
├── types.ts           # 型定義
├── parser.ts          # レスポンスパーサー
├── genre-rules.ts     # ジャンル別ルール
├── chunker.ts         # テキスト分割
├── rag.ts             # RAG
├── hybrid-rag.ts      # ハイブリッド RAG
└── vector-store.ts    # ベクトルストア
```

### テスト（修正対象）

```
apps/hono/test/
├── assist-ks-generator.test.ts   # 7 failed
├── assist-md-parser.test.ts      # 6 failed
├── assist-prompts.test.ts        # 9 failed
├── assist-context.test.ts        # 11 failed
├── assist-schemas.test.ts        # 1 failed
└── assist-cli-e2e.test.ts        # 2 failed (連鎖)
```

## 作業手順

1. 実装ファイルを読んで現在の関数シグネチャ・出力を把握する
2. テストファイルの import と期待値を現在の実装に合わせて修正する
3. `npm test -w @kaedevn/hono` で全テスト通過を確認する
4. コミットする

## 確認コマンド

```bash
# 全テスト実行
npm test -w @kaedevn/hono

# 特定ファイルだけ実行（デバッグ時）
npx vitest run test/assist-ks-generator.test.ts --config vitest.config.ts
npx vitest run test/assist-prompts.test.ts --config vitest.config.ts
npx vitest run test/assist-context.test.ts --config vitest.config.ts
npx vitest run test/assist-md-parser.test.ts --config vitest.config.ts
npx vitest run test/assist-schemas.test.ts --config vitest.config.ts
```

## 完了条件

```
npm test -w @kaedevn/hono
→ 0 failed
```
