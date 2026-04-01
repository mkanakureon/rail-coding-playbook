# Azure App Service 移行検討: Container Apps との比較

**作成日**: 2026-03-03
**ステータス**: 検討のみ（実装なし）

---

## 1. 現在の構成（Container Apps）

`04-azure-subscription-migration.md` より:

| アプリ | コンテナ | 役割 |
|--------|---------|------|
| ca-api | hono-api | Hono API (Node.js) |
| ca-nextjs | ca-nextjs | Next.js (SSR, Auth) |
| ca-editor | editor | Vite SPA + Nginx |
| ca-preview | preview-app | Vite SPA + Nginx |

**現在のコスト（月額）**:

| サービス | 月額 |
|---------|-----:|
| Container Apps × 4 (min=0) | ¥2,000〜3,000 |
| PostgreSQL Flexible (B1ms) | ¥1,435 |
| Container Registry (Basic) | ¥312 |
| Storage | ¥1〜 |
| **合計** | **¥3,748〜4,748** |

Container Apps の最大の利点: **min replicas = 0 でアイドル時課金ゼロ**。

---

## 2. App Service の料金体系

### プラン一覧（Linux）

| プラン | vCPU | RAM | Storage | 月額 (USD) | 月額 (JPY 概算) |
|--------|------|-----|---------|-----------|----------------|
| Free F1 | 共有 (60分/日) | 1 GB | 1 GB | $0 | ¥0 |
| Basic B1 | 1 | 1.75 GB | 10 GB | ~$55 | ~¥8,250 |
| Basic B2 | 2 | 3.5 GB | 10 GB | ~$110 | ~¥16,500 |
| Standard S1 | 1 | 1.75 GB | 50 GB | ~$69 | ~¥10,350 |

※ Japan East はこれより 10〜20% 高くなる傾向
※ 1 USD = 150 JPY で概算

### 重要な特徴

- **ゼロスケールは不可能**: App Service Plan は最低 1 インスタンスが常時起動
- **1 プランに複数アプリ配置可**: 同一プランに 4 アプリを入れればコスト共有
- **Free プランは制限が厳しい**: 共有 CPU 60 分/日、カスタムドメイン不可、コンテナ非対応

---

## 3. App Service でのデプロイ構成パターン

### パターン A: 1 つの B1 プランに 4 アプリ

```
App Service Plan (B1: 1 vCPU, 1.75 GB)
  ├─ app-api       (カスタムコンテナ: hono-api)
  ├─ app-nextjs    (カスタムコンテナ: ca-nextjs)
  ├─ app-editor    (カスタムコンテナ: editor)
  └─ app-preview   (カスタムコンテナ: preview-app)
```

**月額**: ~$55 (~¥8,250)
**問題**: 1 vCPU / 1.75 GB を 4 アプリで共有 → 性能不足の可能性大

### パターン B: 2 つの B1 プラン（API系 + フロント系）

```
Plan 1 (B1): app-api, app-nextjs     ← 動的処理（Node.js）
Plan 2 (B1): app-editor, app-preview  ← 静的配信（Nginx）
```

**月額**: ~$110 (~¥16,500)

### パターン C: 静的サイトは Free、API は B1

```
Plan 1 (B1): app-api, app-nextjs       ← Node.js 動的処理
Static Web Apps (Free): editor, preview  ← Vite SPA は静的配信
```

**月額**: ~$55 (~¥8,250) + $0 = ~¥8,250
**注意**: Editor/Preview は Nginx コンテナ → Static Web Apps に移行可能だが、SPA routing 設定の変更が必要

---

## 4. GitHub デプロイの比較

### App Service: Deployment Center（ポータル GUI）

App Service には **Deployment Center** という組み込み機能がある:

1. Azure Portal → App Service → Deployment Center
2. Source: GitHub を選択
3. リポジトリ・ブランチを指定
4. **自動で `.github/workflows/` に YAML が生成されてリポジトリにコミットされる**

```
git push → GitHub Actions（自動生成）→ ACR push → App Service restart
```

**メリット**:
- GitHub Actions の YAML を手書きしなくてよい
- ポータルからワンクリックで設定完了
- Publish Profile ベースの認証（Service Principal 不要）

**デメリット**:
- 自動生成の YAML がプロジェクト構造と合わない場合がある（モノレポ等）
- カスタマイズの自由度が低い

### Container Apps: GitHub Actions（手動設定）

現在の計画（`06-github-actions-deploy-plan.md`）:

```
git push → GitHub Actions（手書き YAML）→ ACR push → az containerapp update
```

**メリット**:
- 完全にカスタマイズ可能（matrix 並列ビルド等）
- `workflow_dispatch` で手動トリガー可

**デメリット**:
- YAML を自分で書く必要がある
- Service Principal の管理が必要

### 結論: デプロイ速度に大きな差はない

どちらも最終的に **GitHub Actions → Docker build → レジストリ push → アプリ更新** のフロー。
App Service の Deployment Center は初期設定が簡単だが、モノレポでは結局カスタマイズが必要になるため、手書き YAML と手間は同程度。

---

## 5. 総合比較

| 項目 | Container Apps (現状) | App Service |
|------|----------------------|-------------|
| **月額コスト** | ¥2,000〜3,000 | ¥8,250〜16,500 |
| **ゼロスケール** | 対応（min=0） | **非対応**（常時課金） |
| **GitHub デプロイ** | GitHub Actions (手書き) | Deployment Center or GitHub Actions |
| **デプロイ速度** | 同等 | 同等 |
| **コンテナサポート** | ネイティブ | カスタムコンテナ対応 |
| **スケーリング** | アプリ個別にスケール | プラン単位でスケール |
| **マネージド証明書** | 無料 | Free/Basic は非対応 |
| **カスタムドメイン** | 対応 | Basic 以上 |
| **複雑さ** | やや複雑 | シンプル |
| **デプロイスロット** | リビジョン + トラフィック分割 | Standard 以上 |

---

## 6. コスト詳細比較

### 月額コスト（インフラ全体）

| 項目 | Container Apps | App Service (パターンA) | App Service (パターンB) |
|------|---------------|------------------------|------------------------|
| コンピュート | ¥2,000〜3,000 | ¥8,250 | ¥16,500 |
| PostgreSQL | ¥1,435 | ¥1,435 | ¥1,435 |
| ACR | ¥312 | ¥312 | ¥312 |
| Storage | ¥1 | ¥1 | ¥1 |
| **合計** | **¥3,748〜4,748** | **¥9,998** | **¥18,248** |
| **差額** | — | +¥5,250〜6,250 | +¥13,500〜14,500 |

App Service は Container Apps の **2〜4 倍のコスト**。

### なぜ Container Apps が安いのか

- **ゼロスケール**: アイドル時（夜間・休日）は課金ゼロ
- **秒単位課金**: リクエスト処理時のみ CPU/メモリが課金
- 開発フェーズでトラフィックが少ない現状では、この差が特に大きい

---

## 7. App Service が優位になるケース

App Service への移行が合理的なのは以下の場合:

1. **常時トラフィックがある本番環境** — ゼロスケールの恩恵が薄い
2. **デプロイスロットが必要** — Blue/Green デプロイを App Service Standard で実現
3. **チームが App Service に慣れている** — 学習コストゼロ
4. **コンテナ化したくない** — コード直接デプロイ（zip deploy）が可能

現在のプロジェクトはいずれにも該当しない。

---

## 8. 構成最適化: 静的 SPA を Container Apps から分離する

### 問題: Container Apps が 4 つある必要があるか

現在の 4 アプリの実態を整理すると、**半分は Nginx で静的ファイルを返しているだけ**:

| アプリ | ランタイム | 実態 | Container Apps が必要？ |
|--------|----------|------|----------------------|
| ca-api | Node.js (Hono) | 動的 API サーバー | **必要** |
| ca-nextjs | Node.js (Next.js SSR) | 認証・SSR | **必要** |
| ca-editor | Nginx | Vite ビルド済み SPA を配信するだけ | **不要** |
| ca-preview | Nginx | Vite ビルド済み SPA を配信するだけ | **不要** |

editor と preview は `docker build` → `nginx:alpine` で静的ファイルを `COPY` しているだけ（`apps/editor/Dockerfile`, `packages/web/Dockerfile` 参照）。コンテナで動かすオーバーヘッド（Docker build、ACR push、Container Apps 管理）に見合わない。

### 推奨: Azure Static Web Apps (Free) に移行

```
現在:
  Container Apps × 4 (ca-api, ca-nextjs, ca-editor, ca-preview)
  ACR イメージ × 4
  Dockerfile × 4
  デプロイ: 4 並列ビルド

推奨:
  Container Apps × 2 (ca-api, ca-nextjs)      ← 動的サーバーのみ
  Static Web Apps × 2 (editor, preview)        ← 静的 SPA（無料）
  ACR イメージ × 2
  Dockerfile × 2
  デプロイ: コンテナ 2 並列 + SWA 2 並列
```

### Azure Static Web Apps の特徴

| 項目 | 内容 |
|------|------|
| **料金** | Free プラン: $0/月 |
| **GitHub 連携** | 組み込み — リポジトリ連携で自動デプロイ（YAML 自動生成） |
| **SPA ルーティング** | デフォルトで `try_files` 相当の fallback 対応 |
| **カスタムドメイン** | Free プランで対応（SSL 自動） |
| **グローバル CDN** | 自動的にエッジ配信 |
| **ビルド** | GitHub Actions 内で `npm run build` → dist をアップロード（Docker 不要） |

### 移行による効果

| 項目 | 現在 (Container Apps × 4) | 推奨 (CA × 2 + SWA × 2) |
|------|--------------------------|--------------------------|
| **コンテナビルド数** | 4 | 2 |
| **Docker build 時間** | 4 アプリ分 | 2 アプリ分（半減） |
| **ACR push** | 4 イメージ | 2 イメージ（半減） |
| **デプロイ所要時間** | 20〜40 分 (ローカル) | コンテナ: 10〜20 分 + SWA: 2〜3 分 |
| **Container Apps コスト** | ¥2,000〜3,000 | ¥1,000〜1,500（半減） |
| **Static Web Apps コスト** | — | ¥0 |
| **管理する Dockerfile** | 4 | 2 |

### 移行手順

#### Step 1: Static Web Apps リソース作成

```bash
# editor
az staticwebapp create \
  --name swa-editor \
  --resource-group rg-next-aca-min \
  --source https://github.com/mkanakureon/kaedevn-monorepo \
  --branch main \
  --app-location "apps/editor" \
  --output-location "dist" \
  --login-with-github

# preview
az staticwebapp create \
  --name swa-preview \
  --resource-group rg-next-aca-min \
  --source https://github.com/mkanakureon/kaedevn-monorepo \
  --branch main \
  --app-location "packages/web" \
  --output-location "dist" \
  --login-with-github
```

#### Step 2: ビルド設定（自動生成 YAML のカスタマイズ）

Static Web Apps は GitHub 連携時に `.github/workflows/` に YAML を自動生成する。
モノレポなのでビルドコマンドのカスタマイズが必要:

```yaml
# editor 用（自動生成後にカスタマイズ）
app_location: "apps/editor"
output_location: "dist"
app_build_command: "npm run build"
# 環境変数
env:
  VITE_API_URL: "https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
  VITE_NEXT_APP_URL: "https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
  VITE_PREVIEW_URL: "https://swa-preview.xxxxx.azurestaticapps.net"
```

```yaml
# preview 用
app_location: "packages/web"
output_location: "dist"
app_build_command: "npm run build"
env:
  VITE_API_URL: "https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io"
```

**注意**: editor と preview は monorepo 内の他パッケージ（`@kaedevn/core` 等）に依存しているため、`npm ci` をルートで実行してから workspace ビルドする必要がある。自動生成 YAML では不足する場合、以下のように書き換える:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'npm'
  - run: npm ci
  - run: npm run build -w @kaedevn/core
  - run: npm run build -w apps/editor  # or packages/web
  - uses: Azure/static-web-apps-deploy@v1
    with:
      app_location: "apps/editor/dist"
      skip_app_build: true  # 上でビルド済み
```

#### Step 3: Container Apps (editor, preview) 削除

Static Web Apps で動作確認後:

```bash
az containerapp delete --name ca-editor  --resource-group rg-next-aca-min --yes
az containerapp delete --name ca-preview --resource-group rg-next-aca-min --yes
```

ACR からも不要イメージを削除:

```bash
az acr repository delete --name acrnextacamin --repository editor --yes
az acr repository delete --name acrnextacamin --repository preview-app --yes
```

#### Step 4: URL 参照の更新

editor / preview の URL が Container Apps → Static Web Apps に変わるため:

- `apps/hono/Dockerfile` 内の `ALLOWED_ORIGINS`
- `apps/next/Dockerfile` 内の `NEXT_PUBLIC_EDITOR_URL`, `NEXT_PUBLIC_PREVIEW_URL`
- ca-api の環境変数 `ALLOWED_ORIGINS`
- ca-nextjs の環境変数

### リスクと注意点

| リスク | 対策 |
|--------|------|
| Static Web Apps の Free プラン制限（帯域 100GB/月） | 開発フェーズでは十分。超過時は Standard ($9/月) |
| モノレポのビルドが SWA のデフォルトフローに合わない | カスタムビルドコマンドで対応 |
| editor/preview が依存する npm パッケージのビルド順 | GitHub Actions 内で `npm ci` + workspace ビルドを明示 |
| URL 変更に伴う CORS / リダイレクト問題 | ALLOWED_ORIGINS と Dockerfile ARG を更新 |

---

## 9. 結論と推奨

### App Service への移行は推奨しない

| 理由 | 詳細 |
|------|------|
| **コストが 2〜4 倍** | 開発フェーズではゼロスケールの恩恵が大きい |
| **デプロイ速度は同等** | どちらも GitHub Actions 経由で差はない |
| **既に Container Apps で構築済み** | 移行の手間に見合うメリットがない |
| **Docker 化済み** | 4 つの Dockerfile が動作確認済み |

### 推奨アクション（優先順）

1. **静的 SPA (editor, preview) を Azure Static Web Apps (Free) に移行**
   - Container Apps 4 → 2 に削減
   - ビルド・デプロイ時間が半減
   - Static Web Apps は GitHub 連携が組み込みで最も手軽
   - コスト: ¥0
2. **残る Container Apps 2 つに GitHub Actions デプロイを導入**（`06-github-actions-deploy-plan.md`）
3. **ルート `.dockerignore` を追加**（ローカルビルドも高速化）

### 最適化後のコスト見込み

| サービス | 現在 | 最適化後 |
|---------|-----:|--------:|
| Container Apps | ¥2,000〜3,000 | ¥1,000〜1,500 |
| Static Web Apps (Free) | — | ¥0 |
| PostgreSQL | ¥1,435 | ¥1,435 |
| ACR | ¥312 | ¥312 |
| Storage | ¥1 | ¥1 |
| **合計** | **¥3,748〜4,748** | **¥2,748〜3,248** |

App Service は「GitHub 連携が簡単」というイメージがあるが、実際には Container Apps + Static Web Apps + GitHub Actions の組み合わせが最もコスパが良い。

---

## 参考リンク

- [Azure App Service vs Container Apps - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1337789/azure-app-service-vs-azure-container-apps-which-to)
- [Comparing Container Apps with other Azure container options - Microsoft Learn](https://learn.microsoft.com/en-us/azure/container-apps/compare-options)
- [App Service Plans to Container Apps: Reducing Costs by 99% - DEV Community](https://dev.to/alexortigosa/from-app-service-plans-to-azure-container-apps-reducing-costs-by-99-1lbg)
- [Azure App Service Pricing (Linux)](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/)
- [Deploy to App Service using GitHub Actions - Microsoft Learn](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
