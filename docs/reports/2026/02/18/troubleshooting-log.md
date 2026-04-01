# Azure デプロイ はまりどころ記録

- **日時**: 2026-02-18
- **対象**: kaedevn-monorepo Azure Container Apps

---

## 1. publishWork API の URL ミスマッチ

**症状**: 作品公開ボタンを押すと「Not Found」エラー

**原因**: クライアントが `POST /api/projects/{id}/publish` を呼んでいたが、サーバーは `POST /api/works/{id}/publish` で待ち受けていた

**修正箇所**: `apps/next/lib/api.ts` — URL を `/api/works/` に修正

**教訓**: API のパスはサーバー側のルート定義（`apps/hono/src/routes/works.ts`）を必ず確認する。コメントとコードが一致しているかも要確認。

---

## 2. Zod バリデーションで空文字 thumbnail が弾かれる

**症状**: 作品公開時に `[object Object]` というエラーメッセージが表示される

**原因**:
- 公開ダイアログの thumbnail フィールドが空文字 `""` のまま送信
- サーバーの Zod スキーマ `z.string().url().optional()` が空文字を弾く
- Zod のエラーオブジェクトが `new Error()` に渡され `[object Object]` として表示

**修正箇所**:
- サーバー: `thumbnail: z.string().url().optional().or(z.literal(''))`
- クライアント: 空文字フィールドを送信前に除外 + エラーオブジェクトの文字列化

**教訓**: `optional()` は `undefined` のみ許可し、空文字 `""` は通さない。フォームの空フィールドは送信前にフィルタする。エラーオブジェクトは必ず文字列化してから表示する。

---

## 3. アセットがアップロード後に消える（永続化されない）

**症状**: アセット管理で背景を追加 → 成功 → 再度アセット管理に戻ると背景がない

**原因（2層のギャップ）**:
1. **サーバー側**: アップロード API がファイルをディスクに保存するだけで、`project.data.assets` にもDBにも記録しない
2. **クライアント側**: `addAsset()` がメモリ上の Zustand ストアに追加するだけで、プロジェクト保存（`PUT /api/projects/:id`）を呼ばない
3. **GET /api/assets/:projectId**: 常に空配列 `[]` を返すスタブ実装のまま

**修正箇所**:
- `AssetPanel.tsx` / `AssetManager.tsx`: アップロード・削除後に `autoSaveProject()` を呼んでプロジェクトデータを自動保存
- `apps/hono/src/routes/assets.ts`: GET で `project.data.assets` から実データ返却、DELETE で実ファイル削除

**教訓**: 「アップロード成功」は「永続化完了」ではない。ファイル保存とメタデータ保存は別操作。ユーザーに「成功」と表示する前に、全ての永続化が完了していることを確認する。

---

## 4. テスト用 PNG が不正で PixiJS がデコードできない

**症状**: Preview テストで「The source image could not be decoded」エラー

**原因**: 手動で作った PNG バイナリが破損していた。1x1 の base64 PNG でも PixiJS のデコードに失敗するケースあり。

**修正**: Python の zlib で有効な 100x100 赤色 PNG を生成

```python
import struct, zlib
width, height = 100, 100
raw = b''
for _ in range(height):
    raw += b'\x00' + b'\xff\x00\x00' * width  # filter byte + RGB
# IHDR, IDAT, IEND チャンクを正しく構成
```

**教訓**: テスト用画像は「正しいフォーマットのバイナリ」を使う。手書きバイト列は壊れやすい。Python 等で正しく生成するか、実際の画像ファイルを base64 エンコードして使う。

---

## 5. Container Apps が `:latest` タグで新リビジョンを作らない

**症状**: `docker push` → `az containerapp update --image xxx:latest` しても古いコードのまま。リビジョンが更新されない。

**原因**: 同じタグ名 `:latest` でプッシュしても、Container Apps は digest が同じ場合に新リビジョンを作成しないことがある。

**修正**: ユニークタグを使う方式に変更

```bash
TAG=$(git rev-parse --short HEAD)-$(date +%s)
docker build -t acrnextacamin.azurecr.io/hono-api:$TAG ...
docker push acrnextacamin.azurecr.io/hono-api:$TAG
az containerapp update --name ca-api ... --image acrnextacamin.azurecr.io/hono-api:$TAG
```

**教訓**: 本番デプロイでは `:latest` タグに依存しない。git hash + timestamp のユニークタグを使えば確実に新リビジョンが作成される。

---

## 6. `az acr build` vs ローカル `docker build`

**症状**: `az acr build` が非常に遅い（monorepo 全体をクラウドに送るため）

**原因**: `az acr build` は monorepo ルートのファイルを全て ACR に転送してからクラウド上でビルドする。`.dockerignore` があっても転送量が大きい。

**修正**: ローカル `docker build` → `docker push` に切り替え

```bash
# 各アプリのディレクトリから実行
cd apps/hono && docker build -t acrnextacamin.azurecr.io/hono-api:$TAG --platform linux/amd64 .
docker push acrnextacamin.azurecr.io/hono-api:$TAG
```

**教訓**: monorepo では `az acr build` よりローカルビルド → push が速い。各 Dockerfile は自分のアプリディレクトリをビルドコンテキストとして期待している（`COPY package.json ./` が正しく動くように）。

---

## 7. Dockerfile のビルドコンテキスト間違い

**症状**: `docker build -f apps/hono/Dockerfile .`（monorepo ルートから）でビルドすると、`prisma generate` が command not found（exit code 127）

**原因**: Dockerfile の `COPY package.json ./` がルートの `package.json` をコピーしてしまい、Hono アプリの依存（prisma 等）がインストールされない

**修正**: 各アプリのディレクトリに移動してからビルド

```bash
# NG: monorepo ルートから
docker build -f apps/hono/Dockerfile .

# OK: アプリディレクトリから
cd apps/hono && docker build .
```

**教訓**: Dockerfile が `COPY package.json ./` を使っている場合、ビルドコンテキストはその Dockerfile があるディレクトリにする。`-f` でパスを指定しても、コンテキスト（`.`）はコマンド実行時のディレクトリになる。

---

## 8. Playwright テストのセレクタが複数要素にマッチ

**症状**: `button:has-text("背景")` が「背景を追加」ボタンとフィルター「背景 (1)」ボタンの2つにマッチして strict mode violation

**修正**: 正規表現で厳密マッチ

```typescript
// NG
const filterBg = page.locator('button:has-text("背景")');

// OK
const filterBg = page.locator('button', { hasText: /^🖼️ 背景 \(/ });
```

**教訓**: Playwright の `has-text` は部分一致。同じテキストを含むボタンが複数ある場合は正規表現（`^` で前方一致）やより具体的なセレクタを使う。

---

## まとめ：再発防止チェックリスト

| # | チェック項目 |
|---|------------|
| 1 | API パスはサーバー側ルート定義と一致しているか |
| 2 | Zod の `optional()` は空文字を通さない — `.or(z.literal(''))` が必要か確認 |
| 3 | アップロード成功 = ファイル保存のみ。メタデータの永続化も実装したか |
| 4 | テスト用画像は正しいフォーマットで生成しているか |
| 5 | デプロイ時はユニークタグ（`:latest` だけでなく）を使っているか |
| 6 | `docker build` は正しいディレクトリ（Dockerfile のコンテキスト）から実行しているか |
| 7 | Playwright セレクタは一意にマッチするか（strict mode で確認） |
