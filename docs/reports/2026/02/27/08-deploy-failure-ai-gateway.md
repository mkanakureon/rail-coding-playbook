# デプロイ失敗: @kaedevn/ai-gateway が Dockerfile に含まれていない

**日時:** 2026-02-27
**対象:** `apps/hono` (API サーバー)
**コマンド:** `./scripts/deploy-azure.sh api editor`

## エラー内容

```
npm error 404 Not Found - GET https://registry.npmjs.org/@kaedevn%2fai-gateway - Not found
npm error 404  '@kaedevn/ai-gateway@*' is not in this registry.
```

## 原因

`apps/hono/package.json` が `@kaedevn/ai-gateway: "*"` に依存しているが、これはローカルの monorepo パッケージ (`packages/ai-gateway`) であり、npm レジストリに公開されていない。

`apps/hono/Dockerfile` は単体コンテキスト (`apps/hono/` 内のみ) でビルドしているため、`packages/ai-gateway` がコピーされず `npm install` で 404 になる。

### 参照箇所

- `apps/hono/src/routes/assist.ts` — AI 執筆支援 API
- `apps/hono/src/lib/assist/rag.ts` — RAG 処理

## 今回のアセット管理変更との関係

**無関係。** `@kaedevn/ai-gateway` 依存は以前から存在していた問題。今回のコミット (`6de3560`) はキャラクター管理の ch-class 移行のみ。

## 修正方針

以下のいずれか:

### 方針 A: Dockerfile をモノレポルートコンテキストに変更 (editor/preview と同様)

```dockerfile
# apps/hono/Dockerfile → monorepo root からビルド
COPY packages/ai-gateway ./packages/ai-gateway
COPY apps/hono ./apps/hono
WORKDIR /app/apps/hono
RUN npm install
```

`deploy-azure.sh` の api ビルドも `cd "$REPO_ROOT"` + `-f apps/hono/Dockerfile .` に変更が必要。

### 方針 B: ai-gateway を hono に直接バンドル

`packages/ai-gateway/src/` の内容を `apps/hono/src/lib/ai-gateway/` にコピーし、monorepo 依存を外す。パッケージが小さければこちらが簡単。

### 方針 C: ai-gateway を devDependencies に移動 + ビルド時に除外

assist 機能が本番で不要なら依存を外す。ただし現状 assist ルートは登録されているため、ランタイムエラーになる。

## 推奨

**方針 A** が最も安全。`packages/web/Dockerfile` と `apps/editor/Dockerfile` は既にモノレポルートコンテキストでビルドしており、同じパターンに合わせる。
