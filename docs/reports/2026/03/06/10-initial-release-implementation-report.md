# 初期リリース実装レポート

日付: 2026-03-06

## 概要

エディタ初期リリースに向けた優先タスク（計画書 `09-initial-release-implementation-plan.md` 参照）の実装結果。

## 完了タスク

### M3: ブロック警告表示

未設定のブロックにオレンジ色の左ボーダーと "!" アイコンを表示する。

**変更ファイル:**
- `apps/editor/src/components/BlockList.tsx` — `getBlockWarning()` 関数を追加。ブロック種別ごとに未設定項目を検出し、`warning` prop として各カードに渡す
- `apps/editor/src/components/blocks/CardShell.tsx` — `warning?: string` prop を受け取り、オレンジ枠 + "!" アイコンを表示
- 全13ブロックカード — `warning` prop を Props に追加し CardShell に転送

**警告ルール:**

| ブロック | 条件 | メッセージ |
|---------|------|-----------|
| bg | `!assetId` | 背景画像が未選択です |
| ch | `!characterId \|\| !expressionId` | キャラクターまたは表情が未選択です |
| overlay | `!assetId` | オーバーレイ画像が未選択です |
| jump | `!toPageId` | ジャンプ先が未選択です |
| choice | `options.length === 0` | 選択肢がありません |
| if | `conditions.length === 0` | 条件が未設定です |
| battle | `!troopId` | 敵グループが未選択です |

### S1: 自動保存（60秒間隔）

**変更ファイル:**
- `apps/editor/src/store/useEditorStore.ts` — `_lastSavedAt`, `_markSaved()`, `_isDirty()` を追加。`setProject` 時に `_lastSavedAt = Date.now()` で初期化
- `apps/editor/src/pages/EditorPage.tsx` — 60秒間隔で `_isDirty()` をチェックし、変更があれば PUT API で保存
- `apps/editor/src/components/Header.tsx` — `handleSave` 成功時に `_markSaved()` を呼び出し

**仕組み:**
- `_lastSavedAt`: 最後に保存した時刻（`Date.now()`）
- `_isDirty()`: `project.updatedAt > _lastSavedAt` で判定
- `setProject`（初回読み込み）時は `_lastSavedAt = Date.now()` でクリーン状態に
- 手動保存時も `_markSaved()` で更新

### S3: 離脱警告（beforeunload）

**変更ファイル:**
- `apps/editor/src/pages/EditorPage.tsx` — `beforeunload` イベントで `_isDirty()` をチェック。未保存時にブラウザの確認ダイアログを表示

### S2: プロジェクト名変更

**変更ファイル:**
- `apps/editor/src/components/HamburgerMenu.tsx` — 「名前変更」ボタンの onClick を `window.prompt` + `updateProjectTitle()` に変更。`useEditorStore` を import

### ヘッダー UX 改善

**変更ファイル:**
- `apps/editor/src/components/Header.tsx`

**変更内容:**
- Undo/Redo ボタンを右セクションの一番左に移動
- Undo/Redo のフォントサイズを `text-[50px]` に拡大（視認性向上）
- TL / 設定 / マイページ / スクリプト / 保存 / 実行ボタンの高さを `h-10` に統一
- モバイル時はアイコンのみ表示、PC時はテキストラベル付き

## 設定済み確認タスク（変更不要）

| タスク | 状態 | 備考 |
|--------|------|------|
| M1: Azure CORS | 設定済み | Editor SWA URL が `ALLOWED_ORIGINS` に含まれている |
| M2: Preview SPA fallback | 設定済み | `staticwebapp.config.json` に `navigationFallback` あり |
| S4: フロントエンド URL | 設定済み | `VITE_NEXT_APP_URL` / `VITE_PREVIEW_URL` 環境変数で設定済み |

## 未解決の問題

### ハンバーガーメニュー 4項目目が表示されない

**症状:** ハンバーガーメニューに「設定」項目を追加したが、ユーザーのブラウザで表示されない（3項目のまま）。

**調査結果:**
- コード上は4項目（プロジェクト一覧、名前変更、設定、プロジェクト削除）が存在
- Vite dev server は正しく4項目を含むコードを配信（`curl` / `fetch` で確認済み）
- Playwright テスト（Chromium headless）では4項目表示・クリック可能（スクリーンショットで確認済み）
- ユーザーのブラウザでは `document.querySelectorAll('.absolute button').length` が `3` を返す
- `location.reload(true)`, Cmd+Shift+R, DevTools「Disable cache」, Viteキャッシュ削除、サーバー再起動 — いずれも効果なし
- Service Worker なし（`navigator.serviceWorker.getRegistrations()` → 0）
- Azure デプロイ版（ビルド済み本番）でも3項目

**対応:** 原因特定できず。「設定」項目を削除してリバート。

**考えられる原因（未検証）:**
- ユーザーのブラウザ固有の問題（拡張機能、ブラウザバージョン）
- ES モジュールのブラウザ内キャッシュ（HTTP キャッシュとは別）
- React Fast Refresh が新規 JSX 要素の追加を正しく反映しない
- Azure SWA の CDN キャッシュ（デプロイ直後でも旧バージョンを配信）

**今後の対策案:**
- ユーザーのブラウザ情報（UA、バージョン）を確認
- 別ブラウザ（Safari, Firefox）で再現テスト
- DevTools Elements パネルで DOM ツリーを直接確認
- React DevTools でコンポーネントの props/state を確認

## コミット履歴

| ハッシュ | メッセージ |
|---------|-----------|
| `2d59fe1` | feat: add block warnings, autosave, beforeunload, and project rename |
| `401e065` | feat: improve header UX - larger undo/redo buttons, unified button sizes, hamburger menu settings item |
| `7bce42f` | fix: remove unverified settings item from hamburger menu |

## テスト結果

- Editor unit tests: 189/189 passed
- TypeCheck: pass
- Lint: pass
- Playwright (hamburger menu): 4項目表示確認済み（headless Chromium）
