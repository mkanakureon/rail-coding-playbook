# デモ動画自動録画システム 修正・実行報告書

日時: 2026-03-02

## 概要

Gemini CLI が作成したデモ動画自動録画システム（Playwright によるエディタ操作の自動録画）が動作しなかったため、原因を調査・修正し、録画に成功した。さらにシナリオをランディングページ起点の自然なユーザーフローに改善した。

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `tests/record-demo.spec.ts` | 録画シナリオ（Playwright テスト） |
| `playwright.demo.config.ts` | 録画用 Playwright 設定 |
| `docs/10_ai_docs/2026/03/02/49-DEMO_RECORDING_USER_GUIDE.md` | Gemini CLI が作成したガイド |

## 検出されたエラーと修正

### エラー 1: API 接続 — IPv6 解決による ECONNREFUSED

**症状**:
```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:8080
```

**原因**: Playwright（Chromium）が `localhost` を IPv6（`::1`）で解決し、Hono API サーバー（IPv4 のみ Listen）に接続できなかった。

**修正**:
```diff
- const API_URL = 'http://localhost:8080';
+ const API_URL = 'http://127.0.0.1:8080';
```

### エラー 2: Editor 接続 — 127.0.0.1 で ECONNREFUSED

**症状**:
```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5176/...
```

**原因**: API と同じく `127.0.0.1` に統一したが、Vite（Editor）は `localhost` で Listen しているため `127.0.0.1` では接続できなかった。

**修正**: Editor URL は `localhost` のまま維持。
```typescript
const EDITOR_URL = 'http://localhost:5176'; // Vite: localhost で Listen
```

### エラー 3: サーバー未起動

**症状**: `dev-start.sh all` で起動したサーバーが途中で終了していた。

**対策**: デモ録画前に全サーバーが起動済みであることを確認する必要がある。

## シナリオ改善

Gemini CLI のオリジナルはゲストプロジェクトを API 直叩きで作成してエディタに直接遷移していた（動画は白画面からスタート）。ユーザーの実体験に合わせ、ランディングページ起点に書き換えた。

### Before（Gemini CLI 版）
```
API POST /api/auth/guest → エディタ URL に直接遷移
```
- 動画の冒頭が白画面（ブラウザが空の状態）
- ランディングページが映らない

### After（修正版）
```
ランディングページ表示 → 「ログインせずに始める」クリック → エディタに遷移
```
- 動画の冒頭にランディングページが映る
- 実際のユーザー体験と同じ流れ

## 録画結果

| 項目 | 値 |
|------|-----|
| ステータス | 1 passed (31.7s) |
| 出力ファイル | `demo-results/record-demo-record-editor-basic-ops-chromium/video.webm` |
| ファイルサイズ | 889 KB |
| 解像度 | 1280x720 |
| 形式 | WebM |
| 使用プロジェクト | `01KJHJ0GS5CB7DZZXCA09CM1VE`（フィルター） |

## 録画シナリオ内容

`tests/record-demo.spec.ts` に Playwright テストとして実装。

| ステップ | 操作 | 待機 |
|---------|------|------|
| 1. ランディングページ表示 | `page.goto(localhost:3000)` | 3秒 |
| 2. ログイン + エディタ遷移 | API ログイン → localStorage にトークン設定 → プロジェクト表示 | `.block-list` 表示待ち + 3秒 |
| 3. CPC デモ: 背景 | `.block-card` 背景をクリック | 3秒（プレビュー反映） |
| 4. CPC デモ: キャラ | `.block-card` キャラをクリック | 3秒 |
| 5. CPC デモ: テキスト | `.block-card` テキストをクリック | 3秒 |
| 6. 再生 | ▶ 再生ボタンクリック → プレイ画面（別ウィンドウ）表示 | 5秒 |

## 実行手順

```bash
# 1. 全サーバー起動
./scripts/dev-start.sh all

# 2. サーバー起動確認
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/auth/guest -X POST
# → 201 が返れば OK

# 3. デモ録画実行
npm run test:demo
```

## セレクタ検証結果

テスト内の CSS セレクタが実際の UI と一致しているか確認済み。

| セレクタ | 対応コンポーネント | 状態 |
|---------|------------------|------|
| `.block-list` | `BlockList.tsx` (line 211) | OK |
| `.block-card` | `CardShell.tsx` (line 34) | OK |
| `button:has-text("ブロック追加")` | `BlockList.tsx` (line 244) | OK |
| `.bottom-sheet` | `BlockList.tsx` (line 252) | OK |
| `button:has-text("ログインせずに始める")` | `apps/next/app/page.tsx` (GuestStartButton) | OK |
