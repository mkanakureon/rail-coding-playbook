---
title: "実践ログ — Azure Container Apps に 4 サービスをデプロイ"
emoji: "☁️"
type: "idea"
topics: ["claudecode", "Azure", "Docker", "デプロイ"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」は、Monorepo 内に 4 つのサーバーアプリケーションを持っています。

| サービス | ポート | 役割 |
|---|---|---|
| Hono API | 8080 | バックエンド API |
| Editor (Vite) | 5176 | ノベルエディタ |
| Next.js | 3000 | 認証・プロジェクト管理 |
| Preview (Vite) | 5175 | ビジュアルノベル再生 |

これら 4 サービスを Azure Container Apps にデプロイする自動化を、`deploy-azure.sh` という 1 本のシェルスクリプトで実現しました。この記事では、そのスクリプトの設計と、デプロイ自動化に至るまでの過程を記録します。

## deploy-azure.sh の全体像

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

スクリプトの冒頭で、以下を定義しています。

- **TAG**: git の短縮ハッシュ + UNIX タイムスタンプ。一意なイメージタグになる
- **RG**: Azure リソースグループ名
- **ACR**: Azure Container Registry 名
- **TARGETS**: コマンドライン引数で指定。省略時は 4 サービス全部

### 使い方

```bash
# 全サービスデプロイ
./scripts/deploy-azure.sh

# API のみ
./scripts/deploy-azure.sh api

# API と Next.js のみ
./scripts/deploy-azure.sh api nextjs
```

## 4 つのフェーズ

スクリプトは 4 フェーズで構成されています。

### Phase 1: Docker 起動確認

```bash
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
fi
```

macOS では `open -a Docker` で Docker Desktop を起動し、Linux では `systemctl start docker` を使います。最大 60 秒待機して、起動しなければエラー終了します。

この「前提条件を自動解決する」アプローチは、デプロイスクリプトでは重要です。「Docker が起動していない」という些細な理由でデプロイが失敗し、再実行する手間を省けます。

### Phase 2: Docker ビルド

```bash
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
  esac
done
```

ここで注目すべきは、**ビルドコンテキストがサービスによって異なる** 点です。

| サービス | ビルドコンテキスト | 理由 |
|---|---|---|
| api | `apps/hono/` | 自己完結（依存パッケージなし） |
| editor | リポジトリルート | `@kaedevn/core` を参照 |
| nextjs | `apps/next/` | 自己完結 |
| preview | リポジトリルート | `@kaedevn/core`, `@kaedevn/web` を参照 |

editor と preview は Monorepo 内の共有パッケージ（`packages/core`）を `COPY` するため、リポジトリルートをビルドコンテキストにする必要があります。Dockerfile の場所は `-f` オプションで指定します。

また、全サービスに `--platform linux/amd64` を付けています。macOS (Apple Silicon) でビルドする場合、デフォルトでは arm64 イメージが作られますが、Azure Container Apps は amd64 で動くため、明示的にプラットフォームを指定します。

### Phase 3: ACR へのプッシュ

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

事前に `az acr login -n $ACR` で認証済みなので、`docker push` だけで ACR にプッシュできます。

### Phase 4: Container Apps 更新

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
```

`az containerapp update` はイメージ名を変えるだけでローリングアップデートが走ります。Container Apps はゼロダウンタイムでのデプロイをサポートしているため、新しいリビジョンが起動し、ヘルスチェックが通った時点でトラフィックが切り替わります。

### 確認

```bash
echo "=== 確認 ==="
az containerapp list --resource-group $RG \
  --query "[].{name:name, image:properties.template.containers[0].image, status:properties.runningStatus}" \
  -o table
```

デプロイ完了後、全 Container App のステータスを一覧表示します。`--query` で JMESPath を使い、名前・イメージ・ステータスだけを抜き出しています。

## TAG の設計

```bash
TAG=$(git rev-parse --short HEAD)-$(date +%s)
```

タグは `a0ad2e6-1740394567` のような形式になります。

- **git ハッシュ**: どのコミットからビルドしたか追跡可能
- **UNIX タイムスタンプ**: 同じコミットから複数回ビルドしても衝突しない

`latest` タグを使わない理由は、Container Apps がイメージタグの変更を検知してローリングアップデートを起動するためです。`latest` のままだと、同じタグ名でプッシュしてもアップデートがトリガーされません。

## なぜ `az acr build` を使わないのか

Azure Container Registry にはクラウド上でビルドする `az acr build` コマンドがあります。しかし、このプロジェクトでは使用していません。理由は以下です。

1. **ビルドコンテキストの制御**: editor と preview はリポジトリルートをコンテキストにする必要があるが、`az acr build` ではローカルのファイルを tar.gz に固めてアップロードするため、巨大な node_modules を除外する `.dockerignore` の調整が面倒
2. **ビルド速度**: ローカルの Docker キャッシュを活用できるため、2 回目以降のビルドが高速
3. **デバッグ**: ビルド失敗時にローカルで `docker build` して原因を調べやすい

## デプロイルールの明文化

CLAUDE.md にデプロイルールを明記しています。

```markdown
## Deploy

Azure Container Apps へのデプロイは必ず `./scripts/deploy-azure.sh` を使う。

- 手動で `docker build` / `docker push` / `az containerapp update` を実行しない
- `az acr build` は使わない
```

このルールがあることで、Claude Code にデプロイを頼んでも、手動コマンドではなく必ずスクリプト経由で実行されます。AI との協働では、こうした「やってはいけないこと」を明文化しておくことが重要です。

## 実際のデプロイフロー

典型的なデプロイの流れを時系列で示します。

```
$ ./scripts/deploy-azure.sh api editor

✅ Docker 稼働中
=== ACR ログイン ===
Login Succeeded
=== ビルド (TAG: a0ad2e6-1740394567) ===
--- hono-api ---
[+] Building 45.2s
--- editor (monorepo root context) ---
[+] Building 78.3s
=== プッシュ ===
The push refers to repository [acrnextacamin.azurecr.io/hono-api]
a0ad2e6-1740394567: digest: sha256:...
The push refers to repository [acrnextacamin.azurecr.io/editor]
a0ad2e6-1740394567: digest: sha256:...
=== Container App 更新 ===
=== 確認 ===
Name        Image                                              Status
----------  -------------------------------------------------  --------
ca-api      acrnextacamin.azurecr.io/hono-api:a0ad2e6-...      Running
ca-editor   acrnextacamin.azurecr.io/editor:a0ad2e6-...        Running
ca-nextjs   acrnextacamin.azurecr.io/ca-nextjs:prev-tag        Running
ca-preview  acrnextacamin.azurecr.io/preview-app:prev-tag      Running
=== デプロイ完了 (TAG: a0ad2e6-1740394567) ===
```

api と editor だけが新しいタグに更新され、nextjs と preview は前のタグのままであることが確認表示で分かります。

## トラブルシューティング

### Apple Silicon でのクロスプラットフォームビルド

Apple Silicon Mac で `--platform linux/amd64` を使うと、QEMU エミュレーションが走るためビルドが遅くなります。特に `npm install` を含むステップで顕著です。対策として、Dockerfile の `npm install` 層をキャッシュするマルチステージビルドを採用しています。

### ACR の認証期限切れ

`az acr login` のトークンは 3 時間で切れます。長時間かかるビルドの場合、プッシュ時に認証エラーが出ることがあります。その場合はスクリプトを再実行すれば、冒頭で再ログインされます。

## まとめ

4 サービスのデプロイを 1 本のシェルスクリプトに集約したことで、以下の効果がありました。

1. **再現性**: 誰が実行しても同じ手順でデプロイされる
2. **選択的デプロイ**: 引数で対象を絞れるため、変更があったサービスだけ高速にデプロイ
3. **追跡可能性**: git ハッシュ入りのタグで、どのコードがデプロイされているか一目瞭然
4. **AI 協働との相性**: CLAUDE.md にルールを書けば、Claude Code が正しくスクリプトを使う

「デプロイは怖い」と感じる人も多いですが、自動化してしまえば「スクリプトを実行するだけ」になります。最初に自動化の手間をかける価値は十分にあります。

---

deploy-azure.sh を書いた当初は「4 サービス分の case 文を書くのは冗長では」と感じましたが、結果としてサービスごとのビルドコンテキストやイメージ名の違いを明示的に管理できる構造になりました。シェルスクリプトは「読めばそのまま手順が分かる」という透明性が最大の利点です。

　　　　　　　　　　Claude Opus 4.6
