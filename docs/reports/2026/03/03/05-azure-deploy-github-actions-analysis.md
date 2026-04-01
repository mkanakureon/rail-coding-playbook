# Azure デプロイ高速化検討: GitHub Actions 経由 vs ローカルビルド

**作成日**: 2026-03-03
**ステータス**: 検討のみ（実装なし）

---

## 1. 現状分析

### 現在のデプロイフロー (`scripts/deploy-azure.sh`)

```
Mac (ローカル)
  ├─ docker build × 4 (--platform linux/amd64, QEMU エミュレーション)
  ├─ docker push × 4 (ローカル → ACR Japan East)
  └─ az containerapp update × 4
```

### ボトルネックの特定

| ステップ | 推定時間 | ボトルネック要因 |
|----------|----------|-----------------|
| Docker build × 4 | 10〜20 分 | ARM Mac で `linux/amd64` を QEMU エミュレーション。ネイティブの **3〜5 倍遅い** |
| Docker context 転送 | 数十秒〜数分 | **ルートに `.dockerignore` がない** → monorepo context（3.8GB）が Docker daemon に毎回送られる |
| docker push × 4 | 5〜15 分 | 自宅ネットワークの**アップロード帯域**がボトルネック（一般的に 10〜50 Mbps） |
| az containerapp update | 1〜2 分 | Azure 側処理（比較的高速） |
| **合計** | **約 20〜40 分** | |

### リポジトリ・イメージサイズ

| 項目 | サイズ |
|------|--------|
| リポジトリ全体 | 3.8 GB |
| git 管理ファイルのみ | 336 MB |
| .git ディレクトリ | 585 MB |
| node_modules (root) | 987 MB |
| native-engine/external | 702 MB |
| ルート .dockerignore | **なし** |

---

## 2. GitHub Actions 経由のデプロイ案

### 提案フロー

```
Developer (git push) → GitHub Actions Runner (ubuntu-latest)
                          ├─ docker build × 4 (ネイティブ linux/amd64)
                          ├─ docker push × 4 (データセンター間通信)
                          └─ az containerapp update × 4
```

### 高速化の根拠

| 項目 | ローカル | GitHub Actions | 改善率 |
|------|---------|---------------|--------|
| **CPU アーキテクチャ** | ARM Mac → QEMU → amd64 | ネイティブ amd64 | **3〜5倍高速** |
| **ネットワーク (push)** | 自宅回線 10〜50 Mbps up | DC 間 1〜10 Gbps | **20〜100倍高速** |
| **Docker context** | 3.8GB 送信（.dockerignore なし） | git clone で必要ファイルのみ | **不要** |
| **並列ビルド** | 逐次実行 | matrix strategy で 4 並列可 | **4倍高速** |

### 推定デプロイ時間

| ステップ | 推定時間 |
|----------|----------|
| git checkout + npm ci (キャッシュ有) | 1〜2 分 |
| docker build × 4 (並列 or 逐次) | 3〜8 分 |
| docker push × 4 | 1〜2 分 |
| az containerapp update × 4 | 1〜2 分 |
| **合計** | **約 5〜15 分** |

---

## 3. 実装パターンの比較

### パターン A: GitHub Actions で直接 docker build + push

```yaml
# .github/workflows/deploy.yml (概念)
on:
  push:
    branches: [main]
  workflow_dispatch:  # 手動トリガーも可

jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target: [api, editor, nextjs, preview]
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
      - uses: azure/docker-login@v2
        with:
          login-server: acrnextacamin.azurecr.io
      - run: docker build ...
      - run: docker push ...
      - run: az containerapp update ...
```

**メリット**: シンプル、既存 Dockerfile をそのまま使える
**デメリット**: ビルドキャッシュの管理が必要（actions/cache or GitHub Container Registry）

### パターン B: ACR Tasks でリモートビルド

```bash
az acr build --registry acrnextacamin \
  --image hono-api:$TAG \
  --platform linux/amd64 \
  --file apps/hono/Dockerfile .
```

**メリット**: GitHub Actions 不要、Azure 内で完結
**デメリット**: CLAUDE.md で `az acr build` は使わないルール。monorepo の context 転送が発生する

### パターン C: GitHub Actions + Docker layer cache

```yaml
steps:
  - uses: docker/setup-buildx-action@v3
  - uses: docker/build-push-action@v6
    with:
      context: .
      file: apps/hono/Dockerfile
      push: true
      tags: acrnextacamin.azurecr.io/hono-api:${{ github.sha }}
      cache-from: type=gha
      cache-to: type=gha,mode=max
```

**メリット**: GitHub Actions のキャッシュでレイヤーキャッシュが効く。2 回目以降は変更レイヤーだけリビルド
**デメリット**: 初回は遅い、キャッシュサイズ上限 10GB (GitHub Free)

---

## 4. 必要な準備・コスト

### GitHub 側

| 項目 | 内容 |
|------|------|
| GitHub Secrets | `AZURE_CREDENTIALS`（Service Principal）, ACR 認証情報 |
| ランナー | `ubuntu-latest`（Free: 2,000 分/月、Public repo は無制限） |
| Docker layer cache | `actions/cache` or `docker/build-push-action` の GHA cache |
| リポジトリ | 既に `github.com/mkanakureon/kaedevn-monorepo` が存在 |

### Azure 側

| 項目 | 内容 |
|------|------|
| Service Principal | `az ad sp create-for-rbac` で作成。ACR push + Container Apps 更新権限 |
| Federated Credentials | GitHub OIDC 連携（推奨、シークレットのローテーション不要） |

### コスト影響

| 項目 | 現在 | GitHub Actions 後 |
|------|------|-------------------|
| GitHub Actions | 0 円 | 無料枠 2,000 分/月（Private repo の場合） |
| ACR ストレージ | 変更なし | 変更なし |
| ローカル電力 | Docker ビルドで CPU 使用 | ビルドしないので軽い |

---

## 5. .dockerignore がないことの即時改善

**GitHub Actions 導入とは独立して即座に効果がある改善**:

現在、monorepo root context でビルドする 3 つの Dockerfile（hono, editor, preview）は、**`.dockerignore` がルートにないため 3.8 GB 全体が Docker daemon に送られている**。

各サブディレクトリ（`apps/editor`, `apps/next`, `packages/web`）には `.dockerignore` があるが、`docker build -f apps/hono/Dockerfile .` のようにルートを context にする場合は**ルートの `.dockerignore` が参照される**。

```
# 推奨: ルートに .dockerignore を追加
node_modules
.git
packages/native-engine/external
CMakeFiles
PNG
demo-results
projects
docs
tests
playwright-report
test-results
*.spec.ts
*.test.ts
```

これだけで Docker context 転送が **3.8 GB → 数百 MB** に削減され、ローカルビルドも大幅に高速化する。

---

## 6. リスク・注意点

| リスク | 影響 | 対策 |
|--------|------|------|
| Secrets 漏洩 | ACR / Azure への不正アクセス | OIDC 連携（Federated Credentials）で長期シークレット不要に |
| main push で自動デプロイ | 意図しないデプロイ | `workflow_dispatch` のみ or `paths` フィルタ or 環境保護ルール |
| ビルドキャッシュ肥大化 | GitHub 10GB 上限超え | `mode=max` でなく `mode=min` or 定期 evict |
| Env / ARG 管理 | 環境変数のハードコード | GitHub Environment Secrets で管理 |
| ローカルデプロイ不可に | 緊急時に手元からデプロイできない | `deploy-azure.sh` は残しておく（フォールバック） |
| npm ci 時間 | モノレポの npm install が遅い | `actions/setup-node` の cache: 'npm' で緩和 |

---

## 7. 推奨アクション

### 即時（GitHub Actions 不要）

1. **ルートに `.dockerignore` を追加** → ローカルビルドが即座に高速化（context 3.8GB → 数百MB）

### 短期（1〜2 時間で実装可能）

2. **GitHub Actions ワークフロー作成**（パターン C: Docker layer cache 付き）
3. **Azure Service Principal + OIDC 設定**
4. **`workflow_dispatch` で手動トリガー**（自動デプロイは段階的に）

### 中期（運用安定後）

5. main push 時の自動デプロイ有効化（`paths` フィルタ付き）
6. ステージング環境の分離（PR → staging, main → production）

---

## 8. 結論

**GitHub Actions 経由のデプロイは有効。推定 2〜4 倍の高速化が見込める。**

主な高速化要因:
- **QEMU エミュレーション不要**（最大の改善、ビルド時間 3〜5 倍改善）
- **データセンター間ネットワーク**（push が 20〜100 倍高速）
- **並列ビルド可能**（4 アプリを同時ビルド）

ただし、**ルートの `.dockerignore` 追加は GitHub Actions とは独立して即座に効果がある改善**であり、先にこちらを実施すべき。これだけでローカルビルドの context 転送時間が大幅に短縮される。
