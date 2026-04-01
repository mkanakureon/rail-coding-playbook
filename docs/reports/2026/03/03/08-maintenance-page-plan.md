# メンテナンスページ検討

**作成日**: 2026-03-03
**背景**: サーバーダウン時に「しばらくお待ちください」を表示する独立ページが必要

---

## 要件

- メインのサーバー（Container Apps）が落ちていても表示できる
- 独立したインフラで動く（Container Apps に依存しない）
- HTML 1 枚で完結（外部依存なし）
- 即座に公開・切り替えできる
- コスト: 無料〜極小

---

## 方式比較

| 方式 | 即時性 | コスト | 独立性 | 設定の手間 |
|------|--------|--------|--------|-----------|
| **Azure Blob Storage 静的サイト** | **数分で公開可** | **¥0**（既存アカウント） | Container Apps と完全独立 | 最小 |
| Azure Static Web Apps | 10〜15 分 | ¥0 (Free) | 完全独立 | GitHub 連携設定 |
| GitHub Pages | 5〜10 分 | ¥0 | Azure と完全独立 | repo 設定 |

### 推奨: Azure Blob Storage 静的サイト

**理由**:
- **既に `kaedevnworks` ストレージアカウントが存在する**（StorageV2, Japan East）
- 静的サイト機能を有効にして HTML をアップロードするだけ
- Container Apps Environment とは完全に独立
- `az` コマンド 3 つで完了

---

## 即時手順（Blob Storage 静的サイト）

### Step 1: 静的サイト機能を有効化

```bash
az storage blob service-properties update \
  --account-name kaedevnworks \
  --static-website \
  --index-document index.html \
  --404-document index.html
```

### Step 2: メンテナンスページをアップロード

```bash
# maintenance/index.html を作成済みの前提
az storage blob upload \
  --account-name kaedevnworks \
  --container-name '$web' \
  --file maintenance/index.html \
  --name index.html \
  --content-type "text/html; charset=utf-8" \
  --overwrite
```

### Step 3: URL 確認

```bash
az storage account show --name kaedevnworks \
  --query "primaryEndpoints.web" -o tsv
```

URL 形式: `https://kaedevnworks.z11.web.core.windows.net/`

### 完了

この URL をユーザーに共有すればメンテナンス中の案内が表示される。

---

## メンテナンスページ HTML

`maintenance/index.html` として配置:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>メンテナンス中 | kaedevn</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 480px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #f8fafc;
    }
    p {
      font-size: 1rem;
      line-height: 1.8;
      color: #94a3b8;
      margin-bottom: 0.5rem;
    }
    .status {
      margin-top: 2rem;
      padding: 1rem;
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
    }
    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #f59e0b;
      border-radius: 50%;
      margin-right: 8px;
      animation: blink 1.5s ease-in-out infinite;
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .footer {
      margin-top: 3rem;
      font-size: 0.8rem;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <h1>メンテナンス中</h1>
    <p>現在サーバーのメンテナンスを行っています。</p>
    <p>ご不便をおかけし申し訳ございません。</p>
    <div class="status">
      <span class="status-dot"></span>
      <span>作業中 — しばらくお待ちください</span>
    </div>
    <div class="footer">kaedevn</div>
  </div>
</body>
</html>
```

---

## 運用フロー

### サーバーダウン時（メンテナンスページ表示）

```bash
# 1. メンテナンスページをアップロード（初回のみ、以降は既に配置済み）
az storage blob upload \
  --account-name kaedevnworks \
  --container-name '$web' \
  --file maintenance/index.html \
  --name index.html \
  --content-type "text/html; charset=utf-8" \
  --overwrite

# 2. URL をユーザーに案内
echo "メンテナンス中ページ: https://kaedevnworks.z11.web.core.windows.net/"
```

### 復旧時

サーバー復旧後は通常の URL（Container Apps）に戻すだけ。
Blob Storage の静的サイトは放置でよい（コストはほぼゼロ）。

### 将来: カスタムドメイン導入後

カスタムドメイン（例: `kaedevn.com`）を導入した場合は、DNS の向き先を切り替えることでメンテナンスページを表示できる:

```
通常時:   kaedevn.com → Container Apps (ca-nextjs)
障害時:   kaedevn.com → Blob Storage 静的サイト
```

Azure DNS / Cloudflare 等の DNS サービスで切り替え。TTL を短く（60s）しておけば 1〜2 分で反映。

---

## コスト

| 項目 | コスト |
|------|--------|
| Blob Storage 静的サイト | 実質 ¥0（HTML 1 ファイル、アクセス微量） |
| 追加リソース | なし（既存 `kaedevnworks` を利用） |
