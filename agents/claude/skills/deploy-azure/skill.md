---
description: Use when the user asks to deploy to Azure via GitHub Actions. Triggers on "デプロイして", "デプロイ", "Azure deploy", "本番に反映".
---

# Azure デプロイ

GitHub Actions で Azure にデプロイする。

## ワークフロー

| ワークフロー | 対象 | ホスト |
|---|---|---|
| `deploy.yml` | api, nextjs | Container Apps |
| `deploy-swa.yml` | editor, preview | Static Web Apps (Free) |

## デプロイ手順

### 1. ターゲット判断

| ユーザーの表現 | ワークフロー | targets パラメータ |
|---|---|---|
| `api` / `API` / `バックエンド` / `hono` | `deploy.yml` | `api` |
| `nextjs` / `next` / `フロント` / `認証` / `管理画面` | `deploy.yml` | `nextjs` |
| `editor` / `エディタ` / `エディター` | `deploy-swa.yml` | — |
| `preview` / `プレビュー` / `web` / `ゲーム` | `deploy-swa.yml` | — |
| `全部` / `all` / `デプロイして` | 両方実行 | — |

### 2. コミット & push

未コミットの変更がある場合は先にコミット → push する。

### 3. ワークフロー実行

```bash
# Container Apps (api + nextjs)
gh workflow run deploy.yml

# Container Apps (api のみ)
gh workflow run deploy.yml -f targets=api

# Container Apps (nextjs のみ)
gh workflow run deploy.yml -f targets=nextjs

# Static Web Apps (editor + preview)
gh workflow run deploy-swa.yml
```

### 4. 実行監視 & 時間計測

```bash
# Run ID を取得
sleep 3 && gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId'

# 完了まで監視
gh run watch <RUN_ID> --exit-status

# ジョブ時間を取得
gh run view <RUN_ID> --json jobs -q '.jobs[] | "\(.name): \((.completedAt | fromdateiso8601) - (.startedAt | fromdateiso8601))s"'
```

### 5. 結果報告

以下の形式でユーザーに報告する:

```
| ジョブ | 結果 | 時間 |
|---|---|---|
| Build & Push (api) | 成功 | Xm Ys |
| Build & Push (nextjs) | 成功 | Xm Ys |
| Verify Deployment | 成功 | Xm Ys |
```

## 変更パスからターゲットを判断

"変更したところだけ" と言われた場合は `git diff` から判断する。

| 変更パス | ターゲット |
|---|---|
| `apps/hono/` | api (`deploy.yml -f targets=api`) |
| `apps/next/` | nextjs (`deploy.yml -f targets=nextjs`) |
| `apps/editor/` | editor (`deploy-swa.yml`) |
| `packages/web/` | preview (`deploy-swa.yml`) |
| `packages/core/` / `packages/compiler/` 等 | api + editor + preview |

## アーキテクチャ

| アプリ | ホスト | URL |
|---|---|---|
| API | Container Apps | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Next.js | Container Apps | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Editor | Static Web Apps | `https://agreeable-river-0bfb78000.4.azurestaticapps.net` |
| Preview | Static Web Apps | `https://happy-tree-012282700.1.azurestaticapps.net` |

- ACR: `acrnextacamin.azurecr.io`
- Resource Group: `rg-next-aca-min`
- Docker イメージ: `hono-api` (api), `ca-nextjs` (nextjs)

## ローカルデプロイ（緊急時・デバッグ時）

GitHub Actions が使えない場合のみ `deploy-azure.sh` を使う。
pre-flight チェック（typecheck + test + prisma migrate status）が自動実行される。

```bash
# 通常（pre-flight あり）
./scripts/deploy/deploy-azure.sh api nextjs

# pre-flight スキップ（緊急時のみ）
SKIP_PREFLIGHT=1 ./scripts/deploy/deploy-azure.sh api
```

## デプロイ & 検証スクリプト（推奨）

一気通貫でデプロイから検証まで行う場合:

```bash
# push → Actions完了待ち → Health → API → E2E テスト
./scripts/test/deploy-verify.sh

# push 済みの場合（Actions待ち → テストのみ）
./scripts/test/deploy-verify.sh --no-push

# push → Actions完了待ちのみ（テストなし）
./scripts/test/deploy-verify.sh --skip-test
```

動作:
1. 未コミット変更チェック（あれば警告）
2. `git push` 実行
3. `gh run watch` で deploy.yml / deploy-swa.yml の完了待ち
4. 30秒待機（サービス反映）
5. `./scripts/test/azure/run-all.sh` で3段階検証（Health → API → E2E）

| ユーザーの表現 | 動作 |
|---|---|
| `デプロイして` / `デプロイ` | 上記手順 2→3→4→5 を実行 |
| `デプロイして確認して` / `デプロイ＆テスト` | 同上 |
| `デプロイだけ` / `テストなし` | `--skip-test` で 2→3 のみ |
| `push済み` / `もうpushした` | `--no-push` で 3→4→5 |

## 注意

- **通常のデプロイは GitHub Actions を使う**（CI 検証 + Docker キャッシュ + 自動 verify）
- `deploy-azure.sh` は緊急時・ローカルデバッグ用のフォールバック
- 手動で `docker build` / `docker push` / `az containerapp update` を個別実行しない
- デプロイ時間は GitHub Actions の Step Summary に自動記録される
