# Google Analytics 4 (GA4) 導入レポート

日付: 2026-02-19

## 概要

サイトのアクセス解析のため Google Analytics 4 を導入した。
既存の AdSense と同じパターン（Cookie 同意後にスクリプト読み込み）で実装。

## 実装内容

### 新規作成

**`apps/next/components/analytics/GoogleAnalytics.tsx`**

- `'use client'` コンポーネント
- `hasConsentedToCookies()` で Cookie 同意チェック
- `next/script` で `gtag.js` を読み込み + `gtag('config', gaId)` で初期化
- 同意前はコンポーネント自体をレンダリングしない（`return null`）

### 修正

**`apps/next/app/layout.tsx`**

- `GoogleAnalytics` を import
- `NEXT_PUBLIC_GA_ID` が設定されている場合のみ `<body>` 内にレンダリング（AdSenseScript の隣）

**`apps/next/.env.local`**

- `NEXT_PUBLIC_GA_ID=` を追加（空値）

## 動作仕様

| 条件 | 動作 |
|------|------|
| `NEXT_PUBLIC_GA_ID` 未設定 / 空 | コンポーネント自体がレンダリングされない |
| `NEXT_PUBLIC_GA_ID` 設定済み + Cookie 未同意 | コンポーネントは `null` を返す |
| `NEXT_PUBLIC_GA_ID` 設定済み + Cookie 同意済み | gtag.js が読み込まれ GA4 が有効化 |

## GA4 測定IDの設定手順

### 1. 測定IDを取得

1. https://analytics.google.com/ にアクセス
2. 「管理」→「プロパティを作成」
3. サイトURL を入力して「ウェブストリーム」を作成
4. 表示される `G-XXXXXXXXXX` 形式の測定IDをコピー

### 2. ローカル環境に設定

`apps/next/.env.local` を編集:

```
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 3. Azure 環境に設定

```bash
az containerapp update \
  --name <app-name> \
  --resource-group <resource-group> \
  --set-env-vars "NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX"
```

または Azure Portal > Container Apps > 環境変数 から設定。

## 修正ファイル一覧

| ファイル | 変更種別 |
|----------|----------|
| `apps/next/components/analytics/GoogleAnalytics.tsx` | 新規作成 |
| `apps/next/app/layout.tsx` | 修正 |
| `apps/next/.env.local` | 修正 |
