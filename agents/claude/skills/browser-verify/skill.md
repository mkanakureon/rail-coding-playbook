---
description: Use when the user asks to visually verify a page, check UI rendering, or validate browser state using Playwright MCP. Triggers on "画面確認", "UI検証", "ブラウザ確認", "表示チェック", "browser verify", "目視確認".
---

# Browser Verify Skill

Playwright MCP サーバーを使って、ブラウザ上の UI を構造的に検証する。
スクショの画像判定ではなく、DOM / アクセシビリティツリーで正確に検証する。

## 前提

- Playwright MCP サーバーが `.mcp.json` に設定済み（`@playwright/mcp`）
- MCP ツール（`browser_navigate`, `browser_snapshot` 等）が使える状態

## 環境切り替え

ユーザーの指示または文脈に応じて環境を選択する。

### ローカル環境（デフォルト）

| 画面 | URL |
|---|---|
| Next.js | http://localhost:3000 |
| Editor | http://localhost:5176 |
| KSC Editor | http://localhost:5177 |
| Preview | http://localhost:5175 |
| API | http://localhost:8080 |

### Azure 本番環境

「本番」「Azure」「production」「デプロイ後確認」等のキーワードがあればこちらを使う。

| 画面 | URL |
|---|---|
| Next.js | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Editor | https://agreeable-river-0bfb78000.4.azurestaticapps.net |
| Preview | https://happy-tree-012282700.1.azurestaticapps.net |
| API | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |

**注意**: Azure 環境では応答が遅い場合があるので `browser_wait_for` のタイムアウトを長めに設定する（15秒〜）。

## 検証フロー

### 1. ページを開く

```
browser_navigate → 対象 URL
```

### 2. 構造を取得（核心）

```
browser_snapshot → アクセシビリティツリー取得
```

- スクショではなく **DOM 構造** で判定する
- テキスト、要素の有無、値を正確に確認できる

### 3. 要素レベルで検証

目的に応じて使い分ける：

| ツール | 用途 |
|---|---|
| `browser_snapshot` | ページ全体の構造確認 |
| `browser_click` | ボタン押下・メニュー開閉 |
| `browser_type` | フォーム入力 |
| `browser_press_key` | キーボード操作 |
| `browser_select_option` | セレクトボックス |
| `browser_hover` | ホバー状態の確認 |
| `browser_evaluate` | JS 実行（カスタム検証、赤枠アノテーション等） |
| `browser_wait_for` | 非同期ロード待ち |
| `browser_file_upload` | ファイルアップロード |

### 4. スクリーンショット（補助）

```
browser_evaluate → アノテーション付きスクショ
```

- 検証箇所に赤枠を付けてスクショを撮ることで、人間にも結果を伝えやすくする
- あくまで補助。判定は DOM ベースで行う

## 認証が必要な場合

```
1. browser_navigate → {env}/login
2. browser_type → email 入力
3. browser_type → password 入力
4. browser_click → ログインボタン
```

テスト用アカウント:
- Admin: `mynew@test.com` / `DevPass123!`
- User: `test1@example.com` / `DevPass123!`

## 検証レポート形式

検証結果は以下の形式でユーザーに報告する：

```
## 検証結果: {画面名}

| # | 検証項目 | 結果 | 詳細 |
|---|---------|------|------|
| 1 | ヘッダー表示 | OK | "kaedevn" テキスト確認 |
| 2 | ログインボタン | OK | button[aria-label="login"] 存在 |
| 3 | プロジェクト一覧 | NG | リスト要素が 0 件（期待: 1件以上） |
```

## 検証結果の永続化

検証が完了したら、結果を `docs/09_reports/` に自動保存する。

### 保存方法

検証結果を JSON 形式にまとめてスクリプトに渡す：

```bash
cat <<'EOF' | npx tsx scripts/browser-verify/save-report.ts --stdin
{
  "screen": "エディタ ブロック追加メニュー",
  "url": "http://localhost:5176/projects/editor/xxx",
  "env": "local",
  "items": [
    { "no": 1, "item": "ヘッダー表示", "result": "OK", "detail": "\"kaedevn\" テキスト確認" },
    { "no": 2, "item": "ブロック追加ボタン", "result": "OK", "detail": "button 存在" }
  ],
  "snapshot": "（browser_snapshot の出力をここに含める — 省略可）"
}
EOF
```

保存先：
- JSON: `docs/09_reports/{YYYY}/{MM}/{DD}/verify-{slug}.json`
- Markdown: `docs/09_reports/{YYYY}/{MM}/{DD}/verify-{slug}.md`
- Snapshot: `tests/snapshots/{YYYY}/{MM}/{DD}/verify-{slug}.snapshot.txt`（snapshot フィールドがある場合）

### 保存タイミング

- ユーザーが「保存して」「レポート残して」と言った場合は必ず保存する
- NG 項目が 1 つでもある場合は自動保存する（問題の記録として）
- それ以外は検証結果をテーブル表示するだけでよい

## スナップショット比較

同じ画面を以前にも検証していた場合、前回のスナップショットと比較して差分を検出できる。

### 比較方法

```bash
# 画面 slug を指定して最新 2 つのスナップショットを比較
npx tsx scripts/browser-verify/compare-snapshots.ts エディタ-ブロック追加メニュー

# ファイルを直接指定
npx tsx scripts/browser-verify/compare-snapshots.ts \
  --previous tests/snapshots/2026/03/23/verify-editor.snapshot.txt \
  --current tests/snapshots/2026/03/24/verify-editor.snapshot.txt
```

### 比較結果の読み方

- **追加された要素**: 前回なかったが今回あるもの（新機能・変更）
- **削除された要素**: 前回あったが今回ないもの（リグレッションの可能性）
- **差分なし**: 前回と同じ構造（安定している）

ユーザーが「前回と比較して」「差分を見て」と言った場合にこの比較を実行する。

## CI 連携 — .spec.ts への変換

browser-verify の検証結果をリグレッション防止のため Playwright テストに変換できる。

### 変換方法

```bash
# 保存済みの検証レポート JSON を .spec.ts に変換
npx tsx scripts/browser-verify/generate-spec.ts \
  docs/09_reports/2026/03/24/verify-editor.json

# 出力先を指定
npx tsx scripts/browser-verify/generate-spec.ts \
  docs/09_reports/2026/03/24/verify-editor.json \
  --output tests/shared/verify/verify-editor.spec.ts
```

### 変換の流れ

1. browser-verify で対話的に検証 → レポート保存
2. `generate-spec.ts` で `.spec.ts` に変換
3. 生成されたテストのセレクタ・期待値を確認・調整
4. `npx playwright test tests/shared/verify/verify-xxx.spec.ts` で実行

**注意**: 自動生成されたテストには `// TODO` コメントが含まれる場合がある。セレクタと期待値は実際の DOM に合わせて手動調整が必要。

ユーザーが「テストにして」「CI で回せるようにして」と言った場合にこの変換を実行する。

## 既存スキルとの違い

| | playwright-e2e-test | browser-verify（これ） |
|---|---|---|
| 目的 | テストファイル作成・実行 | 対話的な UI 検証 |
| 判定 | スクショ画像 + expect | DOM / アクセシビリティツリー |
| 出力 | .spec.ts ファイル | 検証レポート（テーブル） |
| 依存 | npx playwright test | Playwright MCP ツール |
| 再現性 | テストとして何度も実行可能 | その場の確認向き |
| 永続化 | テストファイル自体が成果物 | JSON/MD レポート + スナップショット |
| CI 連携 | そのまま CI で実行可 | generate-spec.ts で変換後に CI 実行 |
