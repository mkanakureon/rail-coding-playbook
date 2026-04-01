# GitHub Actions デプロイ導入 実施レポート

**日付**: 2026-03-03
**計画書**: `06-github-actions-deploy-plan.md`
**実施範囲**: Phase 1〜5（Service Principal 作成 → コンテナ削減 → 確認）

## 実施内容

### Phase 1: Service Principal 作成

```
名前: github-actions-deploy
ロール: contributor
スコープ: /subscriptions/e665361e-cf3a-4bf5-8c42-d64223f54e39/resourceGroups/rg-next-aca-min
clientId: 99c94f7f-24db-46d5-8fad-85eb8ce43619
tenantId: 548e3b87-1905-44d6-94d8-c843d510b828
```

### Phase 2: GitHub Secrets / Variables 登録

| 種別 | 名前 | 状態 |
|------|------|------|
| Secret | `AZURE_CREDENTIALS` | 登録済み |
| Secret | `ACR_LOGIN_SERVER` | 登録済み (`acrnextacamin.azurecr.io`) |
| Secret | `ACR_USERNAME` | 登録済み (SP clientId) |
| Secret | `ACR_PASSWORD` | 登録済み (SP clientSecret) |
| Secret | `AZURE_RG` | 登録済み (`rg-next-aca-min`) |
| Variable | `API_URL` | 登録済み |
| Variable | `NEXTJS_URL` | 登録済み |
| Variable | `EDITOR_URL` | 登録済み |
| Variable | `PREVIEW_URL` | 登録済み |

### Phase 3: .dockerignore 作成

ルートに `.dockerignore` を新規作成。ビルドコンテキストから不要ファイルを除外。

除外対象: `.git`, `node_modules`, `docs`, `tests`, `CMakeFiles`, `PNG`, `demo-results`, `projects`, `.github`, `.claude`, `.vscode` 等

### Phase 4: deploy.yml 作成

`.github/workflows/deploy.yml` を新規作成。

| 項目 | 設定 |
|------|------|
| トリガー | `workflow_dispatch`（手動） |
| ビルド対象 | `api`, `nextjs` の 2 つのみ |
| ビルド方式 | `docker/build-push-action@v6` + BuildKit + GHA キャッシュ |
| 並列実行 | matrix strategy で api / nextjs を並列ビルド |
| タグ | `${{ github.sha }}` + `latest` |
| デプロイ | `az containerapp update` で Container Apps を更新 |
| 確認 | verify ジョブでヘルスチェック |

### Phase 5: コンテナ削減 (4 → 2)

| Container App | アクション | 理由 |
|---------------|-----------|------|
| `ca-api` | **維持** | Hono API サーバー（必須） |
| `ca-nextjs` | **維持** | Next.js フロントエンド（必須） |
| `ca-editor` | **削除** | Vite SPA — Static Web Apps に移行予定 |
| `ca-preview` | **削除** | Vite SPA — Static Web Apps に移行予定 |

## GitHub Actions 初回デプロイ結果

### Run ID: 22606573883

| ジョブ | 結果 | 所要時間 |
|--------|------|---------|
| Build & Push (api) | **成功** | 3m19s |
| Build & Push (nextjs) | **成功** | 4m5s |
| Verify Deployment | **成功** | 59s |

### ヘルスチェック

```
https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health → 200
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io → 200
```

### トラブルシューティング

| 問題 | 原因 | 解決 |
|------|------|------|
| `azure/login@v2` で `creds` が認識されない | v2 は `--sdk-auth` 形式の JSON を正しく処理しない | `azure/login@v1` に変更 |
| job レベル `if` で `matrix` 参照エラー | `workflow_dispatch` 時に matrix がパース不可 | ステップレベルの `if` に移動 |
| `AZURE_CREDENTIALS` が空 | `echo | gh secret set` でパイプ入力が不完全だった | `--body` フラグで再設定 |
| ACR ログイン | `azure/docker-login@v2` を廃止 | `az acr login` コマンドに統一 |

## 確認結果

### Container Apps 一覧（デプロイ後）

```
Name       Image                                                    MinReplicas    MaxReplicas
---------  -------------------------------------------------------  -------------  -------------
ca-api     acrnextacamin.azurecr.io/hono-api:04c688969...            0              3
ca-nextjs  acrnextacamin.azurecr.io/ca-nextjs:04c688969...           0              3
```

**2 コンテナのみ**。計画通り。GitHub Actions からのデプロイで最新イメージに更新済み。

### ACR リポジトリ

```
hono-api, ca-nextjs  ← 使用中
editor, editor-app, preview, preview-app  ← 不要（後日削除可）
api, nextjs, nextjs-app  ← 旧イメージ（後日削除可）
```

## Static Web Apps デプロイ（Editor / Preview）

### 作成したリソース

| リソース | URL | SKU |
|---------|-----|-----|
| swa-editor | https://agreeable-river-0bfb78000.4.azurestaticapps.net | Free |
| swa-preview | https://happy-tree-012282700.1.azurestaticapps.net | Free |

### ワークフロー: deploy-swa.yml

| 項目 | 設定 |
|------|------|
| トリガー | `workflow_dispatch` + `push`（paths: apps/editor, packages/web 等） |
| ビルド | `npm ci` → 依存パッケージ順序ビルド（core → compiler → ksc-compiler → battle → web → editor） |
| デプロイ | `Azure/static-web-apps-deploy@v1`（ビルド済み dist をアップロード） |

### デプロイ結果（Run ID: 22608173088）

| ジョブ | 結果 | 所要時間 |
|--------|------|---------|
| Deploy Editor (SWA) | **成功** | 2m16s |
| Deploy Preview (SWA) | **成功** | 2m10s |

### トラブルシューティング

| 問題 | 原因 | 解決 |
|------|------|------|
| `Cannot find module '@kaedevn/compiler'` | `npm run build -w editor` では依存パッケージが未ビルド | 依存パッケージを順序通り個別ビルド |
| `Cannot find module './PropertyImageGrid'` | ファイルが untracked でリモートに存在しない | `git add` でコミットに追加 |

## 全アプリ URL 一覧

| アプリ | ホスト | URL |
|--------|--------|-----|
| Next.js | Container Apps | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| API | Container Apps | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Editor | Static Web Apps | https://agreeable-river-0bfb78000.4.azurestaticapps.net |
| Preview | Static Web Apps | https://happy-tree-012282700.1.azurestaticapps.net |

## 作成・変更ファイル

| ファイル | 操作 |
|---------|------|
| `.dockerignore` | 新規作成 |
| `.github/workflows/deploy.yml` | 新規作成 |
| `.github/workflows/deploy-swa.yml` | 新規作成 |
| `apps/editor/public/staticwebapp.config.json` | 新規作成（SPA fallback） |

## 残作業

1. [x] `deploy.yml` を main に push して GitHub Actions から手動デプロイをテスト
2. [x] editor / preview を Azure Static Web Apps にデプロイ
3. [ ] 3 回以上手動デプロイ成功後、push トリガー自動化（Phase 6）
4. [ ] OIDC 連携でシークレット廃止（Phase 7）
5. [ ] ACR の不要イメージ削除（editor, preview-app 等）

## コスト効果

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| Container Apps 数 | 4 | **2** |
| Docker ビルド対象 | 4 | **2** |
| Static Web Apps | 0 | **2（Free）** |
| ビルド時間（実測） | 10〜15 分（Mac QEMU） | **4m5s**（GitHub Actions） |
| Container Apps 月額 | ¥2,918 | **¥1,500〜2,000**（見込み） |
