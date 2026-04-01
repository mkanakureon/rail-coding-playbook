# 転送量最適化 実施レポート

**実施日:** 2026-02-19
**対象:** Azure Front Door + アプリケーション側キャッシュ最適化

## 概要

アセット配信の転送量を最小化するため、以下の6フェーズを実施した。

- Phase 1-5: アプリケーションコード変更（ローカル + Azure デプロイ対象）
- Phase 6: Azure Front Door CDN 構築（Azure 上で実行）

## Azure 上で作成したリソース

### Front Door プロファイル

| 項目 | 値 |
|------|-----|
| プロファイル名 | `fd-kaedevn` |
| SKU | `Standard_AzureFrontDoor` |
| リソースグループ | `rg-next-aca-min` |
| Front Door ID | `d7e66711-ccc0-4177-b5c8-5324bdba144b` |

### エンドポイント

| 項目 | 値 |
|------|-----|
| エンドポイント名 | `ep-kaedevn` |
| ホスト名 | `ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net` |
| CDN URL | `https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net` |

### Origin Groups

#### 1. blob-origin（アセット配信用）

| 項目 | 値 |
|------|-----|
| Origin名 | `blob-storage` |
| ホスト名 | `kaedevnworks.blob.core.windows.net` |
| ヘルスプローブ間隔 | 60秒 |
| プローブパス | `/` |
| プロトコル | HTTPS |

#### 2. api-origin（API 転送用）

| 項目 | 値 |
|------|-----|
| Origin名 | `container-app-api` |
| ホスト名 | `ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| ヘルスプローブ間隔 | 30秒 |
| プローブパス | `/api/health` |
| プロトコル | HTTPS |

### Routes（ルーティングルール）

#### 1. assets-route

| 項目 | 値 |
|------|-----|
| パターン | `/assets/*` |
| 転送先 | `blob-origin` |
| Origin Path | `/assets` |
| プロトコル | HTTPS のみ |
| HTTP→HTTPS リダイレクト | 有効 |
| 圧縮 | 有効（`image/svg+xml`, `application/json`, `text/plain`） |
| キャッシュ | Blob 側の Cache-Control ヘッダに従う |
| Query String | 無視 |

**リクエストフロー:**
```
クライアント → https://ep-kaedevn-xxx.z02.azurefd.net/assets/bg/abc.webp
         → Front Door (キャッシュ確認)
         → kaedevnworks.blob.core.windows.net/assets/bg/abc.webp (ミスの場合のみ)
```

#### 2. api-route

| 項目 | 値 |
|------|-----|
| パターン | `/api/*` |
| 転送先 | `api-origin` |
| Origin Path | なし |
| プロトコル | HTTPS のみ |
| HTTP→HTTPS リダイレクト | 有効 |
| キャッシュ | OFF（API レスポンスに `Cache-Control: no-store` 設定済み） |
| Query String | 転送 |

## アプリケーション側の変更

### Phase 1: ASSET_BASE_URL 導入

**変更ファイル:** `apps/hono/src/lib/config.ts`

`resolveAssetUrl()` に `ASSET_BASE_URL` 環境変数サポートを追加。

```
優先順位:
1. ASSET_BASE_URL 設定あり → ${ASSET_BASE_URL}/${path}
2. Azure ストレージ → Blob 直 URL
3. ローカル → /uploads/${path}
```

CDN 経由にするには Container Apps の環境変数に以下を設定:
```
ASSET_BASE_URL=https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/assets
```

### Phase 2: Cache-Control ヘッダ

**変更ファイル:**
- `apps/hono/src/lib/azure.ts` — Blob アップロード時に `blobCacheControl` 設定
- `apps/hono/src/index.ts` — ローカル `/uploads/*` に Cache-Control ミドルウェア
- `apps/hono/src/routes/assets.ts` — API に `Cache-Control: no-store`

| 対象 | Cache-Control |
|------|--------------|
| 画像・音声・フォント | `public, max-age=31536000, immutable` |
| JSON | `public, max-age=60` |
| API レスポンス | `no-store` |

### Phase 3: コンテンツハッシュファイル名

**新規ファイル:** `apps/hono/src/lib/hash.ts`

ファイル内容の SHA256 先頭16文字をファイル名に使用。

```
変更前: bg/{ULID}.png
変更後: bg/{sha256-16chars}.webp
```

これにより同一ファイルの再アップロードは同一 URL を返し（冪等性）、
ファイル内容が変わればURLも変わるため CDN キャッシュが自動的に破棄される。

### Phase 4: WebP 変換

**新規ファイル:** `apps/hono/src/lib/image.ts`
**依存追加:** `sharp`

アップロード時に bg/ch 画像を WebP に自動変換。

- 最大幅 2048px（超過時はリサイズ）
- 品質: 80
- 変換後が元より大きい場合は元画像を採用
- 音声ファイル（bgm）はスキップ

### Phase 5: gzip 圧縮

**変更ファイル:** `apps/hono/src/index.ts`

Hono `compress` ミドルウェアを追加。ローカル開発時も圧縮が有効になる。

## テスト結果

### ユニットテスト（25件パス）

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `config.test.ts` | 13 | `resolveAssetUrl()` / `normalizeAssetUrl()` 全パターン |
| `hash.test.ts` | 4 | SHA256 ハッシュ生成・冪等性・一意性 |
| `image.test.ts` | 8 | WebP 変換・リサイズ・非画像スキップ |

### 型チェック

`tsc --noEmit` パス（エラーなし）

### Azure Front Door 動作確認（2026-02-19 13:50 JST）

```
$ curl -s https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/api/health
{"status":"ok","timestamp":"2026-02-19T04:50:53.065Z","uptime":4149.644239583}

$ curl -s -I https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/api/health
HTTP/2 200
content-type: application/json
x-cache: CONFIG_NOCACHE   ← API キャッシュ無効

$ curl -s -I https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/assets/bg/test.webp
HTTP/2 404
x-ms-request-id: ...      ← Blob Storage に到達（ファイル未存在のため 404）
x-cache: CONFIG_NOCACHE
```

**結果:** API ルート・Assets ルートともに正常にルーティングされていることを確認。

**注意:** 初回作成後、エッジ POP への伝播に約30分を要した（`deploymentStatus: NotStarted` → 動作開始）。
また、Blob Storage のヘルスプローブパスは `/` だと 400 を返すため `/assets` に変更した。

## 今後の作業

### 必須: Container Apps に ASSET_BASE_URL を設定

```bash
az containerapp update --name ca-api --resource-group rg-next-aca-min \
  --set-env-vars "ASSET_BASE_URL=https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/assets"
```

### 確認コマンド

```bash
# Front Door 経由でアセット取得（キャッシュヒット確認）
curl -I https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/assets/bg/test.webp
# → X-Cache: HIT を確認

# API 経由（キャッシュなし確認）
curl -I https://ep-kaedevn-bka2bmbbhfccb3c9.z02.azurefd.net/api/health
# → Cache-Control: no-store, X-Cache: CONFIG_NOCACHE を確認

# Front Door ステータス確認
./scripts/setup-frontdoor.sh status
```

### 削除手順（必要な場合）

```bash
# Front Door プロファイルごと削除（全ルート・オリジン含む）
az afd profile delete --profile-name fd-kaedevn --resource-group rg-next-aca-min --yes
```

## ファイル一覧

| ファイル | 種別 |
|---------|------|
| `apps/hono/src/lib/config.ts` | 変更 |
| `apps/hono/src/lib/azure.ts` | 変更 |
| `apps/hono/src/index.ts` | 変更 |
| `apps/hono/src/routes/assets.ts` | 変更 |
| `apps/hono/.env` | 変更 |
| `apps/hono/package.json` | 変更（sharp 追加） |
| `apps/hono/src/lib/hash.ts` | 新規 |
| `apps/hono/src/lib/image.ts` | 新規 |
| `apps/hono/src/lib/config.test.ts` | 新規 |
| `apps/hono/src/lib/hash.test.ts` | 新規 |
| `apps/hono/src/lib/image.test.ts` | 新規 |
| `scripts/setup-frontdoor.sh` | 新規 |
| `docs/01_in_specs/0219/03_転送量最適化_実装計画.md` | 新規 |
