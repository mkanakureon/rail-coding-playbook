# Google AdSense 設定ガイド

日付: 2026-02-19

## 概要

Google AdSense による広告配信の実装構成と、IDの設定手順をまとめる。
広告は Cookie 同意後にのみ読み込まれる。

## アーキテクチャ

### スクリプト読み込み

`apps/next/app/layout.tsx` で `AdSenseScript` を `<body>` 内に配置。

```
<body>
  {adsenseClientId && <AdSenseScript clientId={adsenseClientId} />}  ← ここ
  {gaId && <GoogleAnalytics gaId={gaId} />}
  <Header />
  <main>{children}</main>
  <Footer />
  <CookieConsent />
</body>
```

- `NEXT_PUBLIC_ADSENSE_CLIENT_ID` が空なら何も出力しない
- Cookie 同意前は `null` を返す（`hasConsentedToCookies()` でチェック）

### 広告枠コンポーネント

| コンポーネント | スロット種別 | サイズ | 用途 |
|----------------|-------------|--------|------|
| `StickyBottomAd` | `stickyBottom` | 728x90 | ページ下部固定 |
| `BelowHeroAd` | `belowHero` | 728x90 | ヒーロー直下 |
| `InContentAd` | `inContent` | 336x280 | コンテンツ内 |
| `InListAd` | `inList` | 336x280 | 一覧内（8件ごと） |

すべて `AdSlot` コンポーネント経由で表示。`AdSlot` は IntersectionObserver による遅延読み込み + SPA ナビゲーション時のリセットを行う。

### 広告配置ページ

| ページ | 広告枠 |
|--------|--------|
| トップ (`/`) | BelowHeroAd + StickyBottomAd |
| 作品一覧 (`/works`) | InListAd + StickyBottomAd |
| 作品閲覧 (`/play/[id]`) | InContentAd |
| ユーザーページ (`/users/[id]`) | BelowHeroAd + StickyBottomAd |
| マイページ (`/mypage`) | BelowHeroAd + InContentAd |
| ログイン (`/login`) | InContentAd |
| 利用規約 (`/terms`) | InContentAd |
| プライバシーポリシー (`/privacy`) | InContentAd |
| 404 (`/not-found`) | InContentAd |
| エラー (`/error`) | InContentAd |

**広告を配置しないページ:** エディタ、プレビュー

## ファイル構成

```
apps/next/
├── lib/
│   └── ad-config.ts              # 環境変数・スロットID・サイズの一元管理
├── components/ads/
│   ├── index.ts                  # barrel export
│   ├── AdSenseScript.tsx         # gtag スクリプト読み込み（layout.tsx で使用）
│   ├── AdSlot.tsx                # 共通広告枠（遅延読み込み・SPA対応）
│   ├── StickyBottomAd.tsx        # ページ下部固定
│   ├── BelowHeroAd.tsx           # ヒーロー直下
│   ├── InContentAd.tsx           # コンテンツ内
│   └── InListAd.tsx              # 一覧内
```

## 環境変数

| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | AdSense パブリッシャーID（`ca-pub-XXXXXXXXXXXXXXXX`） | AdSense 管理画面 |
| `NEXT_PUBLIC_AD_SLOT_STICKY_BOTTOM` | stickyBottom 広告ユニットID | AdSense 広告ユニット |
| `NEXT_PUBLIC_AD_SLOT_IN_CONTENT` | inContent 広告ユニットID | AdSense 広告ユニット |
| `NEXT_PUBLIC_AD_SLOT_IN_LIST` | inList 広告ユニットID | AdSense 広告ユニット |
| `NEXT_PUBLIC_AD_SLOT_BELOW_HERO` | belowHero 広告ユニットID | AdSense 広告ユニット |

すべて未設定の場合、開発用プレースホルダー（破線枠）が表示される。

## AdSense IDの設定手順

### 1. パブリッシャーIDを取得

1. https://adsense.google.com/ にアクセス
2. 「アカウント」→「アカウント情報」
3. 「パブリッシャー ID」（`ca-pub-XXXXXXXXXXXXXXXX` 形式）をコピー

### 2. 広告ユニットIDを取得

1. AdSense 管理画面 →「広告」→「広告ユニットごと」
2. 各広告ユニットを作成（ディスプレイ広告）
3. 生成されるコード内の `data-ad-slot` の値（数字）をコピー
4. 用途に合わせて以下に設定:
   - `NEXT_PUBLIC_AD_SLOT_STICKY_BOTTOM` — ページ下部固定用
   - `NEXT_PUBLIC_AD_SLOT_BELOW_HERO` — ヒーロー直下用
   - `NEXT_PUBLIC_AD_SLOT_IN_CONTENT` — コンテンツ内用
   - `NEXT_PUBLIC_AD_SLOT_IN_LIST` — 一覧内用

### 3. ローカル環境に設定

`apps/next/.env.local` に追加:

```
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_AD_SLOT_STICKY_BOTTOM=1234567890
NEXT_PUBLIC_AD_SLOT_IN_CONTENT=1234567891
NEXT_PUBLIC_AD_SLOT_IN_LIST=1234567892
NEXT_PUBLIC_AD_SLOT_BELOW_HERO=1234567893
```

### 4. Azure 環境に設定

```bash
az containerapp update \
  --name <app-name> \
  --resource-group <resource-group> \
  --set-env-vars \
    "NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX" \
    "NEXT_PUBLIC_AD_SLOT_STICKY_BOTTOM=1234567890" \
    "NEXT_PUBLIC_AD_SLOT_IN_CONTENT=1234567891" \
    "NEXT_PUBLIC_AD_SLOT_IN_LIST=1234567892" \
    "NEXT_PUBLIC_AD_SLOT_BELOW_HERO=1234567893"
```

または Azure Portal > Container Apps > 環境変数 から設定。

## 設定ルール（`ad-config.ts`）

| 定数 | 値 | 説明 |
|------|----|------|
| `MAX_AD_SLOTS` | 2 | 1ページあたりの最大広告枠数 |
| `AD_LAZY_MARGIN` | `300px` | IntersectionObserver のルートマージン |
| `AD_LIST_INTERVAL` | 8 | 一覧で何件おきに InListAd を挿入するか |
