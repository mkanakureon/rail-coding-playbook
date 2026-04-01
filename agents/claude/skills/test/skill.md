# スマートテスト Skill

変更内容を分析し、関連するテストだけを自動選択して実行する。最後に報告書を保存する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "テストして" | 変更を分析して関連テストを実行 |
| "test" | 同上 |
| "テスト回して" | 同上 |

## 手順

### Step 1: 変更内容を分析

```bash
# ステージ済み + 未ステージの変更ファイルを取得
git diff --name-only HEAD
git diff --name-only --cached
# 直近コミットの変更も見る（コミット直後の場合）
git diff --name-only HEAD~1..HEAD
```

### Step 2: 変更ファイルからテスト対象を判定

以下のマッピングで、どのワークスペースのテストを実行するか決める。**複数に該当する場合は全て実行する。**

| 変更パス | 実行するテスト | コマンド |
|---------|--------------|---------|
| `packages/core/` | core 単体テスト | `npm test -w @kaedevn/core` |
| `packages/compiler/` | compiler 単体テスト | `npm test -w @kaedevn/compiler` |
| `packages/interpreter/` | interpreter 単体テスト | `npm test -w @kaedevn/interpreter` |
| `packages/web/` | web 単体テスト | `npm test -w @kaedevn/web` |
| `packages/map/` | map 単体テスト | `npm test -w @kaedevn/map` |
| `packages/battle/` | battle 単体テスト | `npm test -w @kaedevn/battle` |
| `packages/ksc-compiler/` | ksc-compiler テスト | `npm test -w @kaedevn/ksc-compiler` |
| `packages/ai-gateway/` | ai-gateway テスト | `npm test -w @kaedevn/ai-gateway` |
| `apps/hono/` | hono API テスト | `npm test -w @kaedevn/hono` |
| `apps/editor/` | editor テスト | `npm test -w apps/editor` |
| `apps/next/` | next テスト | `npm test -w @kaedevn/next` |
| `apps/hono/prisma/` | **必ず** schema-sync テスト | `npm test -w @kaedevn/hono -- --grep schema-sync` |

### Step 3: 特殊ルール

- **schema.prisma が変更されている場合**: `npm test -w @kaedevn/hono` を必ず含める（schema-sync テストのため）
- **commandRegistry.ts / Op.ts / commandDefinitions.ts が変更されている場合**: `npm test -w @kaedevn/core` と `npm test -w @kaedevn/compiler` を両方実行（同期テスト）
- **変更がドキュメントのみ（`docs/`, `oss/docs/`, `*.md`）の場合**: テスト不要。「ドキュメントのみの変更のためテストスキップ」と報告
- **変更が特定できない / 広範囲の場合**: 全テスト `npm test`（ルート）を実行
- **E2E テストは自動実行しない**: E2E が必要な場合はユーザーに確認してから `npx playwright test` 系を実行

### Step 4: テスト実行

- 判定したテストを順番に実行する
- 各テストの結果（passed / failed / skipped）を記録する
- 失敗したテストがある場合、エラー内容を簡潔に記録する

### Step 5: 報告書を保存

テスト完了後、結果を `docs/09_reports/{YYYY}/{MM}/{DD}/` に保存する。

#### ファイル名

```
{連番}-test-report.md
```

連番は同日の既存ファイルの最大番号 + 1。

#### 報告書フォーマット

```markdown
# テスト報告書 — {YYYY}年{M}月{D}日

> 実行時刻: {HH:MM} / トリガー: {変更の概要}

## 変更内容

- {変更ファイルの要約（パス群をワークスペース単位でまとめる）}

## テスト判定

| ワークスペース | 判定理由 | 実行 |
|--------------|---------|------|
| {workspace} | {なぜ選ばれたか} | ✅ / ⏭️ スキップ |

## テスト結果

| ワークスペース | passed | failed | skipped | 結果 |
|--------------|--------|--------|---------|------|
| {workspace} | {n} | {n} | {n} | ✅ / ❌ |

## 失敗詳細

（失敗がなければ「なし」）

### {テストファイル名}

- **テスト名**: {失敗したテスト名}
- **エラー**: {エラーメッセージの要約}
- **今回の変更との関連**: あり / なし（既存の問題）

## 総合判定

{✅ 全テスト通過 / ⚠️ 既存の失敗のみ / ❌ 今回の変更による失敗あり}
```

### 判定の基準

- **✅ 全テスト通過**: failed = 0
- **⚠️ 既存の失敗のみ**: failed > 0 だが、失敗テストが今回の変更ファイルと無関係
- **❌ 今回の変更による失敗あり**: 失敗テストが今回の変更したコードに関連している
