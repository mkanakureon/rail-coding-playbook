---
title: "Azure Container Apps に Monorepo から 4 サービスをデプロイする自動化"
emoji: "🚀"
type: "tech"
topics: ["claudecode", "azure", "docker", "monorepo"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」は monorepo 構成で開発しており、本番環境は Azure Container Apps を使用しています。4 つのサービス（API、Editor、Next.js、Preview）を個別に Docker ビルド → ACR プッシュ → Container Apps 更新するのは手間がかかります。

この記事では、93 行のシェルスクリプト `deploy-azure.sh` 1 本で 4 サービスのデプロイを自動化した方法を解説します。

## アーキテクチャ全体像

### 4 サービスの構成

monorepo 内の 4 つのサービスが、それぞれ独立した Azure Container Apps として動いています。

| ターゲット | Container App | Docker イメージ | Dockerfile |
|---|---|---|---|
| `api` | `ca-api` | `hono-api` | `apps/hono/Dockerfile` |
| `editor` | `ca-editor` | `editor` | `apps/editor/Dockerfile` |
| `nextjs` | `ca-nextjs` | `ca-nextjs` | `apps/next/Dockerfile` |
| `preview` | `ca-preview` | `preview-app` | `packages/web/Dockerfile` |

### Azure リソース

```
Azure Container Registry (ACR): acrnextacamin.azurecr.io
Resource Group: rg-next-aca-min
TAG 形式: {git-short-hash}-{timestamp}
```

TAG にコミットハッシュとタイムスタンプを含めることで、「このデプロイはどのコミットに基づいているか」「いつデプロイされたか」が一目で分かります。

## deploy-azure.sh の全体構成

スクリプトは以下の 5 フェーズで構成されています。

```
Phase 1: 変数定義・ターゲット決定
Phase 2: Docker 起動確認
Phase 3: ACR ログイン + Docker ビルド
Phase 4: イメージプッシュ
Phase 5: Container Apps 更新 + 確認
```

### Phase 1: 変数定義とターゲット決定

```bash
#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
TAG=$(git rev-parse --short HEAD)-$(date +%s)
RG="rg-next-aca-min"
ACR="acrnextacamin"
REGISTRY="$ACR.azurecr.io"

# デプロイ対象（引数なし=全部、引数あり=指定のみ）
TARGETS=${@:-api editor nextjs preview}
```

ポイントは `TARGETS=${@:-api editor nextjs preview}` の部分です。引数がなければ全サービスをデプロイし、引数があれば指定されたサービスのみをデプロイします。

```bash
./scripts/deploy-azure.sh            # 全サービス
./scripts/deploy-azure.sh api        # API のみ
./scripts/deploy-azure.sh api editor # API + Editor
```

`TAG` は `git rev-parse --short HEAD` と `date +%s`（UNIX タイムスタンプ）を組み合わせています。同じコミットから複数回デプロイしても TAG が重複しない設計です。

### Phase 2: Docker 起動確認

```bash
# === Docker 起動確認 ===
if ! docker info >/dev/null 2>&1; then
  echo "⏳ Docker が起動していません。起動を試みます..."
  if [[ "$(uname)" == "Darwin" ]]; then
    open -a Docker 2>/dev/null || { echo "❌ Docker Desktop が見つかりません"; exit 1; }
  else
    sudo systemctl start docker 2>/dev/null || { echo "❌ Docker を起動できません"; exit 1; }
  fi
  # 最大60秒待機
  for i in $(seq 1 12); do
    docker info >/dev/null 2>&1 && break
    echo "  Docker 起動待ち... ($((i*5))s)"
    sleep 5
  done
  docker info >/dev/null 2>&1 || { echo "❌ Docker の起動がタイムアウトしました"; exit 1; }
  echo "✅ Docker 起動完了"
else
  echo "✅ Docker 稼働中"
fi
```

macOS では `open -a Docker` で Docker Desktop を起動し、Linux では `systemctl start docker` を使います。起動後、最大 60 秒（5 秒 x 12 回）待機してから次に進みます。

「Docker が起動していなかった」というのはデプロイ時に最もよくあるエラーの 1 つです。手動で Docker を起動してから再実行する手間を省くために、スクリプト内で自動起動しています。

### Phase 3: ACR ログイン + Docker ビルド

```bash
echo "=== ACR ログイン ==="
az acr login -n $ACR

echo "=== ビルド (TAG: $TAG) ==="

for target in $TARGETS; do
  case $target in
    api)
      echo "--- hono-api ---"
      cd "$REPO_ROOT/apps/hono"
      docker build -t $REGISTRY/hono-api:$TAG --platform linux/amd64 .
      ;;
    editor)
      echo "--- editor (monorepo root context) ---"
      cd "$REPO_ROOT"
      docker build -t $REGISTRY/editor:$TAG --platform linux/amd64 -f apps/editor/Dockerfile .
      ;;
    nextjs)
      echo "--- ca-nextjs ---"
      cd "$REPO_ROOT/apps/next"
      docker build -t $REGISTRY/ca-nextjs:$TAG --platform linux/amd64 .
      ;;
    preview)
      echo "--- preview-app (monorepo root context) ---"
      cd "$REPO_ROOT"
      docker build -t $REGISTRY/preview-app:$TAG --platform linux/amd64 -f packages/web/Dockerfile .
      ;;
    *)
      echo "Unknown target: $target (api|editor|nextjs|preview)"
      exit 1
      ;;
  esac
done
```

ここで重要なのは **ビルドコンテキストの違い** です。

| ターゲット | ビルドコンテキスト | 理由 |
|---|---|---|
| `api` | `apps/hono/` | 単体パッケージ、外部依存なし |
| `editor` | リポジトリルート | `packages/core/` に依存しているため |
| `nextjs` | `apps/next/` | 単体パッケージ、外部依存なし |
| `preview` | リポジトリルート | `packages/core/`, `packages/interpreter/` に依存 |

`editor` と `preview` は monorepo 内の共有パッケージに依存しているため、リポジトリルートをビルドコンテキストにする必要があります。`-f apps/editor/Dockerfile .` のように、Dockerfile のパスとコンテキストのパスを分離して指定しています。

また、`--platform linux/amd64` を指定しています。開発マシンが Apple Silicon（arm64）の場合、これを省略すると arm64 イメージがビルドされ、Azure Container Apps（amd64）で動作しません。

### Phase 4: イメージプッシュ

```bash
echo "=== プッシュ ==="
for target in $TARGETS; do
  case $target in
    api)     docker push $REGISTRY/hono-api:$TAG ;;
    editor)  docker push $REGISTRY/editor:$TAG ;;
    nextjs)  docker push $REGISTRY/ca-nextjs:$TAG ;;
    preview) docker push $REGISTRY/preview-app:$TAG ;;
  esac
done
```

ビルドとプッシュを分離しているのは、ビルドが全て成功してからまとめてプッシュしたいためです。1 つのビルドが失敗した時点で `set -e` によりスクリプトが停止するため、ビルド失敗のイメージがプッシュされることはありません。

### Phase 5: Container Apps 更新 + 確認

```bash
echo "=== Container App 更新 ==="
for target in $TARGETS; do
  case $target in
    api)     az containerapp update --name ca-api     --resource-group $RG --image $REGISTRY/hono-api:$TAG ;;
    editor)  az containerapp update --name ca-editor  --resource-group $RG --image $REGISTRY/editor:$TAG ;;
    nextjs)  az containerapp update --name ca-nextjs  --resource-group $RG --image $REGISTRY/ca-nextjs:$TAG ;;
    preview) az containerapp update --name ca-preview --resource-group $RG --image $REGISTRY/preview-app:$TAG ;;
  esac
done

echo "=== 確認 ==="
az containerapp list --resource-group $RG \
  --query "[].{name:name, image:properties.template.containers[0].image, status:properties.runningStatus}" \
  -o table

echo "=== デプロイ完了 (TAG: $TAG) ==="
```

最後に `az containerapp list` で全サービスの状態を一覧表示します。イメージ名に TAG が含まれるため、「今デプロイしたバージョンが反映されているか」を確認できます。

## Claude Code スキルとの連携

デプロイ操作は Claude Code のスキルとしても定義しています。

```markdown
# Azure デプロイ

## ルール
- **必ず `./scripts/deploy-azure.sh` を使う**
- 手動で `docker build` / `docker push` / `az containerapp update` を実行しない
- `az acr build` は使わない

## ターゲット名マッピング
| ユーザーの表現 | ターゲット |
|---|---|
| `api` / `バックエンド` / `hono` | `api` |
| `editor` / `エディタ` | `editor` |
| `nextjs` / `next` / `認証` | `nextjs` |
| `preview` / `プレビュー` / `web` | `preview` |
| `全部` / `all` / `デプロイして` | 引数なし（全アプリ） |
```

このスキル定義により、Claude Code に「エディタをデプロイして」と言うだけで `./scripts/deploy-azure.sh editor` が実行されます。「変更したところだけデプロイ」と指示した場合は、`git diff` から変更パッケージを特定してターゲットを判断する設計です。

### 変更パッケージからの自動判断

```markdown
## 変更パッケージからターゲットを判断する方法

| 変更パス | ターゲット |
|---|---|
| `apps/hono/` | `api` |
| `apps/editor/` | `editor` |
| `apps/next/` | `nextjs` |
| `packages/web/` | `preview` |
| `packages/core/` | `api` + `preview`（共有パッケージなので両方） |
```

共有パッケージ（`packages/core/` など）が変更された場合は、それに依存する全サービスをデプロイ対象にします。

## なぜ `az acr build` を使わないのか

Azure には `az acr build` というクラウド側でビルドするコマンドがあります。ローカルの Docker が不要になるメリットがある一方、以下の理由で採用しませんでした。

1. **monorepo のビルドコンテキスト**: `editor` や `preview` はリポジトリルートをコンテキストにする必要があり、全ファイルをアップロードするのは非効率
2. **ビルドキャッシュ**: ローカルビルドなら Docker のレイヤーキャッシュが効く
3. **デバッグ**: ビルドが失敗した場合、ローカルの方がデバッグしやすい
4. **ネットワーク**: 大きなコンテキストのアップロードに時間がかかる

## 設計の意図: 「やってはいけないこと」の明文化

CLAUDE.md にも deploy-azure.sh のスキル定義にも、「やってはいけないこと」を明記しています。

```markdown
- 手動で `docker build` / `docker push` / `az containerapp update` を実行しない
- `az acr build` は使わない
```

AI と協働する場合、「推奨する方法」だけでなく「禁止する方法」を書くことが重要です。Claude Code は知識として `az acr build` を知っているため、明示的に禁止しないとそのコマンドを提案してくる可能性があります。

## TAG 設計の詳細

```bash
TAG=$(git rev-parse --short HEAD)-$(date +%s)
# 例: a0ad2e6-1740000000
```

TAG に含まれる情報は以下の 2 つです。

| 要素 | 値の例 | 用途 |
|---|---|---|
| `git rev-parse --short HEAD` | `a0ad2e6` | どのコミットのコードか |
| `date +%s` | `1740000000` | いつビルドしたか |

この設計により、以下の運用が可能になります。

- `az containerapp list` の出力で、現在デプロイされているバージョンを確認
- ACR のイメージ一覧で、過去のデプロイ履歴を追跡
- 問題発生時に、特定のコミットにロールバック

## エラーハンドリング

スクリプト冒頭の `set -e` により、どのコマンドが失敗してもスクリプトが即座に停止します。具体的なエラーパターンと対処は以下の通りです。

| エラー | 原因 | 対処 |
|---|---|---|
| `Docker Desktop が見つかりません` | Docker 未インストール | Docker Desktop をインストール |
| `Docker の起動がタイムアウト` | Docker Desktop の起動に 60 秒以上 | 手動で起動して再実行 |
| `ACR ログイン失敗` | Azure CLI 未認証 | `az login` を実行 |
| `docker build 失敗` | Dockerfile の問題 | エラーログを確認して修正 |
| `Unknown target` | ターゲット名のタイポ | `api|editor|nextjs|preview` から選択 |

## まとめ

| ポイント | 実現方法 |
|---|---|
| ワンコマンドデプロイ | `./scripts/deploy-azure.sh` |
| 選択的デプロイ | 引数でターゲット指定 |
| Docker 自動起動 | OS 判別 + 60 秒待機 |
| ビルドコンテキスト | 単体 vs monorepo root の使い分け |
| TAG によるトレーサビリティ | `{commit}-{timestamp}` |
| AI 連携 | Claude Code スキルで日本語指示対応 |
| 安全性 | `set -e` + 禁止事項の明文化 |

93 行のシェルスクリプトですが、Docker 起動確認、ACR ログイン、ビルドコンテキストの使い分け、TAG によるトレーサビリティ、エラーハンドリングと、デプロイに必要な要素が詰まっています。

---

「デプロイして」の一言で 4 サービスが更新される。この体験を実現するために、93 行のシェルスクリプトと Claude Code スキルの 2 つを用意しました。手動デプロイの手順書を書くよりも、自動化スクリプトを書く方が結果的に速い。そして、そのスクリプトを AI に呼び出させるスキルを書くことで、人間は「デプロイして」と言うだけで済むようになります。

　　　　　　　　　　Claude Opus 4.6
