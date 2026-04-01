# ブロックエディタ CLI 実装計画書

## 概要

`scripts/editor-cli.mjs` は既に実装済み（14コマンド）。
本計画では **認証対応・E2E テスト・不足機能の補完** を行い、CLI 単体でシナリオ1本を完成させられる状態にする。

---

## 1. 現状分析

### 実装済みコマンド（14個）

| カテゴリ | コマンド | 状態 |
|---------|---------|------|
| 閲覧 | `list`, `blocks`, `context` | 実装済み |
| ブロック編集 | `add`, `update`, `remove`, `move` | 実装済み |
| ページ操作 | `add-page`, `rename-page`, `remove-page` | 実装済み |
| 一括操作 | `export`, `import`, `validate` | 実装済み |

### 未対応の課題

| 課題 | 影響 | 優先度 |
|------|------|--------|
| **認証ヘッダ未送信** | 全 API が 401 で失敗する | 必須 |
| **choice ブロックの options 未対応** | `add` で選択肢を作れない | 高 |
| **overlay ブロック未対応** | `add` でオーバーレイを作れない | 中 |
| **screen_filter ブロック未対応** | `add` でフィルタを作れない | 中 |
| **battle / timeline 未対応** | `add` で戦闘/タイムラインを作れない | 低 |
| **E2E テスト未作成** | 動作保証がない | 必須 |
| **エラー時の JSON レスポンス未解析** | エラー原因が分かりにくい | 低 |

---

## 2. 実装タスク

### Phase 1: 認証対応（必須）

`editor-cli.mjs` に認証トークンの取得・送信を追加する。

#### 2.1 認証フロー

```
1. 環境変数 KAEDEVN_TOKEN があればそれを使う
2. なければ KAEDEVN_EMAIL + KAEDEVN_PASSWORD で /api/auth/login を叩いてトークン取得
3. 全 API リクエストに Authorization: Bearer <token> ヘッダを付与
```

#### 2.2 変更箇所

- `apiGet()` / `apiPut()` に `Authorization` ヘッダ追加
- `getToken()` 関数を新設（環境変数 or ログイン API）
- デフォルト認証情報: `.env` から読むか、`KAEDEVN_EMAIL` / `KAEDEVN_PASSWORD` 環境変数

#### 2.3 使い方

```bash
# 方法1: 環境変数でトークン直接指定
KAEDEVN_TOKEN=xxx node scripts/editor-cli.mjs list

# 方法2: メール/パスワードで自動ログイン（デフォルト = .env の開発用認証情報）
node scripts/editor-cli.mjs list

# 方法3: Azure 向け
KAEDEVN_API=https://api.example.com/api \
KAEDEVN_EMAIL=test@example.com \
KAEDEVN_PASSWORD=pass \
node scripts/editor-cli.mjs list
```

### Phase 2: add コマンドのブロック型補完

`cmdAdd()` の switch 文に不足しているブロック型を追加する。

| ブロック型 | 必要なオプション |
|-----------|----------------|
| `choice` | `--options '["はい","いいえ"]'`（JSON 配列文字列） |
| `overlay` | `--assetId`, `--visible true/false` |
| `screen_filter` | `--filterType sepia/grayscale/blur/none` |
| `if` | `--varName`, `--operator`, `--value`, `--thenJump` |
| `battle` | `--troopId` |
| `timeline` | `--label`, `--tracks '[]'` |

### Phase 3: E2E テスト

`scripts/test-editor-cli-e2e.mjs` を作成する。マップ CLI テストと同じパターン（`execSync` + `assert`）。

#### 3.1 前提

- ローカル API サーバーが起動していること（`./scripts/dev-start.sh api`）
- テスト用プロジェクトを作成し、テスト後に元の状態に戻す

#### 3.2 テスト項目（想定 30〜40 テスト）

```
=== 認証 ===
1. トークン取得（ログイン API）
2. 認証なしで 401 エラー

=== 閲覧系 ===
3. list — プロジェクト一覧が取得できる
4. blocks — ブロック一覧が人間可読形式で表示される
5. context — アセット/キャラ/ページ/変数が表示される
6. export — JSON 出力が valid JSON である

=== ブロック追加 ===
7.  add text — テキストブロック追加
8.  add text --speaker — speaker 付きテキスト追加
9.  add text --after — 指定位置に挿入
10. add bg — 背景ブロック追加
11. add ch — キャラクターブロック追加
12. add jump — ジャンプブロック追加
13. add set_var — 変数設定ブロック追加
14. add effect — エフェクトブロック追加
15. add choice — 選択肢ブロック追加
16. add overlay — オーバーレイブロック追加
17. add screen_filter — フィルタブロック追加
18. add ksc — KSC スクリプトブロック追加

=== ブロック更新 ===
19. update --body — テキスト本文変更
20. update --speaker — speaker 変更
21. update --assetId — アセット変更
22. update --visible false — 表示/非表示切替

=== ブロック削除 ===
23. remove — 通常ブロック削除
24. remove start — start ブロック削除拒否（エラー）

=== ブロック移動 ===
25. move up — 上に移動
26. move down — 下に移動
27. move up on [1] — start の直後ブロックは上に移動できない
28. move down on last — 最後のブロックは下に移動できない

=== ページ操作 ===
29. add-page — ページ追加（start ブロック自動生成）
30. rename-page — ページ名変更
31. remove-page — ページ削除

=== 一括操作 ===
32. import — JSON ファイルからインポート（start 保持確認）
33. validate OK — 正常プロジェクトでバリデーション通過
34. validate NG — 不正な toPageId でエラー検出

=== エラーケース ===
35. add with invalid pageId — 存在しないページにブロック追加
36. update with invalid blockId — 存在しないブロック更新
37. remove with invalid blockId — 存在しないブロック削除
```

#### 3.3 テストの構造

```javascript
// scripts/test-editor-cli-e2e.mjs
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = `node ${join(ROOT, "scripts/editor-cli.mjs")}`;

// 1. テスト用プロジェクトを API で作成（または既存を使用）
// 2. 各コマンドを execSync で実行
// 3. blocks コマンドや export で結果を検証
// 4. テスト用に追加したブロック/ページをクリーンアップ
```

#### 3.4 実行方法

```bash
# API サーバー起動済みの状態で
node scripts/test-editor-cli-e2e.mjs

# Azure 向け
KAEDEVN_API=https://ca-api.xxx.azurecontainerapps.io/api \
KAEDEVN_EMAIL=test1@example.com \
KAEDEVN_PASSWORD=DevPass123! \
node scripts/test-editor-cli-e2e.mjs
```

---

## 3. 実装順序

```
Phase 1: 認証対応
  editor-cli.mjs に getToken() + Authorization ヘッダ追加
  ↓
Phase 2: add コマンド補完
  choice / overlay / screen_filter / if / battle / timeline 対応
  ↓
Phase 3: E2E テスト
  test-editor-cli-e2e.mjs 作成・全テスト通過
  ↓
動作確認: CLI でシナリオ1本作成
  list → context → add (bg/ch/text/choice/jump) → validate
```

---

## 4. ファイル一覧

| ファイル | 変更種別 | 内容 |
|---------|---------|------|
| `scripts/editor-cli.mjs` | 修正 | 認証対応 + ブロック型補完 |
| `scripts/test-editor-cli-e2e.mjs` | 新規 | E2E テスト（30〜40テスト） |
| `.claude/skills/edit-blocks/skill.md` | 修正 | 認証手順の追記 |

---

## 5. Skill 定義の更新

`/edit-blocks` Skill に以下を追記:

- 認証の前提条件（環境変数 or 自動ログイン）
- 新規対応ブロック型（choice, overlay, screen_filter）のコマンド例
- テスト実行コマンド

---

## 6. リスク・注意点

| リスク | 対策 |
|--------|------|
| テスト用プロジェクトの汚染 | テスト開始時に専用プロジェクト作成、終了時にブロック/ページを元に戻す |
| API レート制限 | テスト間に不要な遅延は入れないが、連続 PUT は避ける |
| 認証トークンの有効期限 | テスト実行前に毎回ログイン（短時間テストなので期限切れしない） |
| `list` コマンドの認証 | `/api/projects` は `authMiddleware` 配下。トークン必須 |

---

*文書作成: Claude Code (Claude Opus 4.6) -- 2026-03-07*
