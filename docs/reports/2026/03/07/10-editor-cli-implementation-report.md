# ブロックエディタ CLI 実装結果報告書

## 概要

ブロックエディタ CLI (`scripts/editor-cli.mjs`) の認証対応・機能強化・E2Eテストを完了し、CLI 単体でプロジェクト作成からシナリオ構築まで一気通貫で実行できる状態にした。

## 確認用プロジェクト

| 項目 | 値 |
|------|-----|
| プロジェクトID | `01KK3VXSKPYRBAXQ4DV4F74GD9` |
| プロジェクト名 | 2026-03-07 CLI E2E総合テスト |
| ユーザー | `test1@example.com` / `DevPass123!` |
| ページ数 | 2（第1話 + 第2話テンプレートテスト） |
| 総ブロック数 | 21 |
| バリデーション | OK |

### 第1話（手動ブロック追加）: 13ブロック

| # | 種別 | 内容 |
|---|------|------|
| 0 | start | — |
| 1 | bg | ファンタジー城（自動生成） |
| 2 | ch | fantasy_hero (normal) |
| 3 | text | 初期テキスト |
| 4 | text | ナレーション「冒険の始まりだ…」 |
| 5 | text | 勇者「この城に何があるんだろう…」 |
| 6 | set_var | courage += 1 |
| 7 | effect | shake (intensity:3, duration:300) |
| 8 | screen_filter | sepia |
| 9 | text | 「あの日の記憶が蘇る…」 |
| 10 | screen_filter | none（フィルタ解除） |
| 11 | text | 勇者「行こう、前に進むしかない！」 |
| 12 | choice | 「城に入る」「引き返す」 |

### 第2話（テンプレート適用）: 8ブロック

テンプレート `daily-conversation` を適用。placeholder をプロジェクトのアセット/キャラで解決。

| # | 種別 | 内容 |
|---|------|------|
| 0 | start | — |
| 1 | bg | ファンタジー城 |
| 2 | ch | fantasy_hero (normal) |
| 3-7 | text | 会話テンプレート（3往復） |

---

## 実装内容

### 新規追加

| 機能 | コマンド | 説明 |
|------|---------|------|
| プロジェクト作成 | `create <title>` | POST /api/projects で新規作成 |
| スナップショット保存 | `snapshot <id> [--tag]` | .snapshots/ にJSON保存 |
| スナップショット復元 | `restore <id> <file>` | スナップショットからデータ復元 |
| スナップショット一覧 | `snapshots <id>` | 保存済み一覧表示 |
| テンプレート一覧 | `template list` | templates/scenes/ の一覧 |
| テンプレートプレビュー | `template preview <name>` | ブロック構成とplaceholder表示 |
| テンプレート適用 | `template apply <id> <page> <name> [--var ...]` | placeholder解決してブロック追加 |

### 修正・改善

| 修正 | 内容 |
|------|------|
| 認証対応 | `getToken()` で自動ログイン、全APIに `Authorization` ヘッダ |
| PUT修正 | `{ title, ...data }` → `{ title, data }` （データ消失バグ） |
| validate強化 | 必須フィールド/enum範囲/ID重複/空choice/参照整合性チェック |
| ブロック型追加 | add に choice/overlay/screen_filter/if/battle/timeline 対応 |
| 自動スナップショット | remove/remove-page/import/template apply 実行前に自動保存（最新10件保持） |
| ブロックID重複修正 | `generateBlockId` にカウンター追加（同一ミリ秒での重複防止） |
| availableAssets修正 | オブジェクト形式 `{ backgrounds: [], overlays: [] }` に対応 |

### テンプレート（4種）

| テンプレート | 説明 | ブロック数 |
|-------------|------|-----------|
| daily-conversation | 背景→キャラ登場→3往復会話 | 7 |
| choice-branch | 会話→選択肢→変数→条件分岐 | 7 |
| battle-intro | 演出→バトル→勝敗分岐 | 8 |
| dramatic-reveal | フィルタ演出→背景切替→衝撃台詞 | 8 |

---

## E2E テスト結果

```
=== Results: 89 passed, 0 failed (89 total) ===
```

| カテゴリ | テスト数 |
|---------|---------|
| 閲覧系 (list/blocks/context/export) | 8 |
| ブロック追加 (11型 + 位置指定) | 17 |
| 更新 (body/speaker/visible) | 6 |
| 移動 (up/down + 境界エラー) | 6 |
| 削除 (通常 + start拒否) | 4 |
| ページ操作 (追加/名変更/削除) | 7 |
| インポート | 4 |
| バリデーション (正常 + 4種エラー検出) | 5 |
| スナップショット (保存/一覧/自動/復元/エラー) | 6 |
| テンプレート (list/preview/apply/エラー) | 8 |
| エラーケース (不正ID/不正JSON) | 4 |
| **合計** | **89** |

---

## 詰まった箇所・教訓

### 1. PUT のデータ形式バグ（最も影響大）

**症状**: `add` でブロック追加 → 直後の `export` で追加したブロックが消えている

**原因**: `updateProject` が `{ title, ...data }` で送信していたため、`data` キーがなく `pages`/`assets`/`characters` がトップレベルに展開され、API 側の `z.object({ title, data })` に `data` が渡らなかった

**修正**: `{ title, ...data }` → `{ title, data }`

**教訓**: API の Zod スキーマと CLI の送信ペイロードを必ず突合せる。PUT が 200 を返しても中身が無視されている場合がある

### 2. ブロック ID 重複（テンプレート適用時）

**症状**: テンプレートで7ブロック一括追加 → 全ブロックの ID が同じ → validate で重複エラー

**原因**: `generateBlockId` が `{type}-{Date.now()}` で、同一ミリ秒内に複数回呼ばれると同じ ID を返す

**修正**: カウンター追加 `{type}-{Date.now()}-{counter++}`

**教訓**: 一括操作では ID 生成にユニーク保証が必要。`Date.now()` 単体では不十分

### 3. availableAssets の形式差異

**症状**: `validate` で `((intermediate value) ?? []).map is not a function`

**原因**: `_ai_context.availableAssets` が配列ではなくオブジェクト `{ backgrounds: [], overlays: [] }` で返ってくる

**修正**: `Array.isArray` チェック → オブジェクトなら `Object.values().flat()`

**教訓**: API レスポンスの型を実際のデータで検証する。ドキュメントと実装が乖離していることがある

### 4. choice の JSON がシェルグロブに引っかかる

**症状**: `--options '["城に入る","引き返す"]'` がシェルで `no matches found` エラー

**原因**: zsh がブラケット `[]` をグロブパターンとして解釈する

**回避策**: `eval` ではなく直接 `node scripts/editor-cli.mjs` を呼ぶか、`noglob` を使う

---

## ファイル一覧

| ファイル | 変更種別 |
|---------|---------|
| `scripts/editor-cli.mjs` | 修正（認証/create/snapshot/template/validate強化） |
| `scripts/test-editor-cli-e2e.mjs` | 修正（89テスト） |
| `templates/scenes/*.json` | 新規（4テンプレート） |
| `.gitignore` | 修正（.snapshots/ 追加） |

---

*報告: Claude Code (Claude Opus 4.6) -- 2026-03-07*
