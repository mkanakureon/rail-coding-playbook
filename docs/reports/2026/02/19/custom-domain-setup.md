# カスタムドメイン設定手順

日付: 2026-02-19

## 概要

`kaedevn.kaedeasset.com` を Next.js アプリ（`ca-nextjs`）に紐付ける。

| 項目 | 値 |
|------|-----|
| カスタムドメイン | `kaedevn.kaedeasset.com` |
| ドメイン管理 | ムームードメイン |
| Azure Container App | `ca-nextjs` |
| 現在のFQDN | `ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |

## 手順

### 1. ムームードメインで DNS レコード追加

1. https://muumuu-domain.com/?mode=conpane にログイン
2. `kaedeasset.com` のDNS設定（ムームーDNS）を開く
3. 以下のレコードを追加:

| サブドメイン | 種別 | 内容 |
|-------------|------|------|
| `kaedevn` | CNAME | `ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |

### 2. Azure でカスタムドメインを追加

```bash
# ドメイン検証用の TXT レコードが求められる場合がある
# その場合はムームードメインに TXT レコードも追加する

az containerapp hostname add \
  --name ca-nextjs \
  --resource-group <resource-group> \
  --hostname kaedevn.kaedeasset.com
```

リソースグループ名は以下で確認:

```bash
az containerapp show --name ca-nextjs --query resourceGroup -o tsv
```

### 3. SSL 証明書（マネージド証明書）

Azure Container Apps はマネージド証明書を自動発行できる:

```bash
az containerapp hostname bind \
  --name ca-nextjs \
  --resource-group <resource-group> \
  --hostname kaedevn.kaedeasset.com \
  --environment <environment-name> \
  --validation-method CNAME
```

環境名は以下で確認:

```bash
az containerapp env list --query "[].name" -o tsv
```

### 4. 確認

- `https://kaedevn.kaedeasset.com` にアクセスしてサイトが表示されること
- SSL 証明書が有効であること（ブラウザの鍵アイコン）
- DNS 反映には最大数時間かかる場合がある

## 注意事項

- CNAME レコードは他のレコード（A, MX 等）と同じサブドメインに共存できない
- DNS 反映前に Azure 側でドメイン追加するとバリデーションエラーになる場合がある — DNS が反映されてから Azure 設定を行うのが安全
- 将来的に API (`ca-api`) やエディタ (`ca-editor`) にもサブドメインを割り当てる場合は同じ手順で追加
