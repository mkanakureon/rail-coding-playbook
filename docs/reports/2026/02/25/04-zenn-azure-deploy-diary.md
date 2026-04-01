---
title: "Azure デプロイ 4 連敗から本番 DB 復旧まで — CI なし個人開発の実録"
emoji: "🔥"
type: "idea"
topics: ["claudecode", "azure", "docker", "個人開発"]
published: false
---

## あの夜、何が起きたか

火曜の夜。モノレポの全アプリを Azure Container Apps にデプロイした。`./scripts/deploy-azure.sh` — ワンコマンドで 4 サービスがビルドされてプッシュされる。いつもの作業だった。

4 回リトライして、ようやくデプロイが通って、そのあと本番 DB が壊れていることに気づくとは、このとき思っていなかった。

### 構成

npm workspaces モノレポに 4 サービス（Hono API / Next.js / Vite Editor / Vite Preview）。Docker マルチステージビルドで ACR にプッシュし、Azure Container Apps にデプロイしている。DB は Azure PostgreSQL、ORM は Prisma。CI はない。

## 1 回目: Editor が落ちる

```
error TS6133: 'useRef' is declared but its value is never read.
```

unused import で `tsc` に怒られた。ローカルでは Vite で開発しているから、型チェックは走らない。esbuild はトランスパイルだけ。ブラウザ上ではちゃんと動いていたのに。

Claude Code に「直して」と言ったら 10 秒で修正してくれた。未使用の `useRef`, `AssetRef`, `addAsset` を消しただけ。

## 2 回目: Next.js が落ちる

Editor は通った。次は Next.js。

```
Error: React Hook "useOfficialAsset" is called in a function that
is neither a React function component nor a custom React Hook function.
```

API クライアントの関数名が `useOfficialAsset` だった。hooks でもないのに `use` プレフィックスをつけていた。`next dev` では ESLint が走らないから、開発中ずっと気づかなかった。

「根本対策は eslint-disable とリネームどっち？」と Claude Code に聞いた。「リネームです」と即答された。`importOfficialAsset` に変更。

## 3 回目: Preview が落ちる — そして誤修正

Editor 通った、Next.js 通った。次は Preview（ゲームプレビュー用の Vite アプリ）。

```
error TS6305: Output file '.../ksc-compiler/dist/...'
has not been built from source file
```

モノレポの `ksc-compiler` パッケージが Docker コンテナ内に存在しなかった。Dockerfile に COPY を書き忘れていた。

ここで **最初の誤修正** をやった。tsconfig の参照先を `../ksc-compiler` → `../compiler` に変えた。これは別パッケージだった。エラーは連鎖し、事態は悪化した。

焦って原因を調べずに「似た名前のパッケージ」に差し替えたのが敗因。冷静になって依存グラフを確認し、Dockerfile に 3 行追加。これが正解だった。

## 4 回目: ようやく通る — しかし…

全アプリのビルドが通り、Azure にデプロイされた。ブラウザで確認——動いている。安堵した。

30 分後、プロジェクト詳細画面を開いたら 500 エラーが出た。

## 本当の問題: DB が追いついていない

```
The column `assets.slug` does not exist in the current database.
```

ローカルでは `prisma db push` でスキーマを直接同期していた。マイグレーションファイルは作っていなかった。本番 DB には `_prisma_migrations` テーブルすら存在しない。新しいカラム 12 個、テーブル 3 つ、インデックス多数が、何ひとつ反映されていなかった。

これが一番痛かった。ビルドが通ってデプロイも成功したのに、アプリが壊れている。

### 復旧手順 — 安全側に倒す

1. Azure PostgreSQL のファイアウォールに作業 IP だけ一時許可
2. `prisma migrate status` で状態確認 — 9 件全て「未適用」
3. 既存 9 件を `resolve --applied` でマーク（テーブルは `db push` で存在済み。SQL は実行せず記録のみ）
4. `prisma migrate diff` でスキーマと実 DB の差分 SQL を生成
5. 差分を新マイグレーションファイルとして保存
6. `prisma migrate deploy` で適用
7. API 動作確認 → OK
8. ファイアウォールルール削除

ロールバック手順（`resolve --rolled-back` + 手動 DROP）を事前に用意してから実行した。個人開発でもロールバック戦略は書いておくべきだった。

## CI がないと、こうなる

全部のエラーに共通していたのは、**ローカルでは検知されない** こと。

| チェック | ローカルの挙動 | 本番の挙動 |
|---|---|---|
| TypeScript 型チェック | Vite: 省略（esbuild のみ） | Docker: `tsc -b` 実行 |
| ESLint | `next dev`: 省略 | `next build`: 実行 |
| Docker 内の依存解決 | npm symlink で全解決 | COPY した分だけ |
| DB マイグレーション | `db push` で直接同期 | `migrate deploy` ファイル必須 |

開発ツールは DX のために色々省略してくれている。それは開発速度に直結する。でも、本番ビルドでは省略されたチェックが全部走る。

CI があれば、push のたびに `tsc --noEmit` と `next lint` と `docker build` が走る。個人開発だから CI は後回しにしていた。その判断のツケが、火曜の夜にまとめて来た。

## Claude Code は何をしてくれたか

正直に書く。

**速かった:**
- エラーメッセージから原因特定 → 修正提案まで数十秒
- 未使用 import の特定、リネームの一括変更、Dockerfile の修正案
- Azure CLI コマンド（`firewall-rule create/delete`）の生成
- `prisma migrate diff` の実行と SQL ファイル作成

**人間が必要だった:**
- 「`ksc-compiler` と `compiler` は別パッケージ」という文脈知識
- `prisma db push` と `prisma migrate` の運用判断
- 「まず Firewall を開けてから接続する」という手順設計
- ロールバック手順を用意してからマイグレーションを実行する判断

AI は手数が多くて速い。でも「この環境で何が起きているか」の全体像は人間が持っている。ペアプロとしては理想的な組み合わせだった。

## その後 — 事故を繰り返さないために

schema 整合性を確認するテストを作った。

```typescript
it('Prisma schema と DB が同期している', async () => {
  await expect(prisma.asset.findFirst()).resolves.not.toThrow();
});
```

`findFirst()` は全カラムを SELECT する。カラムが存在しなければ即落ちる。

そしてデプロイ前チェックリストも作った。

- [ ] `npx tsc --noEmit`
- [ ] `next lint`
- [ ] `npx prisma migrate status`
- [ ] `npx vitest run test/schema-sync.test.ts`
- [ ] `npm run build`

CI がなくても、このリストを手動で回せば最低限の検知はできる。完璧ではないが、何もないよりはいい。次は GitHub Actions で自動化する。

---
4 回デプロイして、4 回落ちて、
1 回は通ったのに中身が壊れていた。
エラーを直すのは得意だけれど、
エラーが出る前に気づく仕組みは、まだ人間が作らなければならない。

　　　　　　　　　　Claude Opus 4.6
