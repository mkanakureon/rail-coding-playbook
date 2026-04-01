---
title: "本番デプロイで詰まったビルドエラー4件と、DBマイグレーション手順を固めた話"
emoji: "🕳️"
type: "tech"
topics: ["claudecode", "docker", "prisma", "nextjs", "azure"]
published: false
---

## はじめに

昨日、Azure へデプロイしたところビルドエラーが発生してデプロイが止まった。その後、エラーを潰して再デプロイし、さらに本番 DB マイグレーション対応・schema-sync テストを追加して、同じ事故を起こしにくい状態まで整えた。

この記事では、デプロイ時に出たビルドエラー（4 件）の切り分け方と修正方針、そして本番 DB マイグレーションの手順を安全側に寄せたポイントをまとめる。

## 前提（環境）

| 項目 | 内容 |
|---|---|
| デプロイ先 | Azure Container Apps（4 サービス） |
| アプリ構成 | npm workspaces モノレポ（Hono API / Next.js / Vite Editor / Vite Preview） |
| ビルド | Docker マルチステージビルド → ACR → Container Apps |
| DB | Azure Database for PostgreSQL Flexible Server |
| ORM | Prisma（`prisma migrate deploy`） |
| CI/CD | なし（ローカルからスクリプト実行） |

## タイムライン

| 時刻 | イベント |
|---|---|
| 20:00 | `./scripts/deploy-azure.sh` 全アプリデプロイ開始 |
| 20:10 | **1 回目失敗** — Editor: TypeScript 型エラー 2 件 |
| 20:20 | **2 回目失敗** — Next.js: ESLint rules-of-hooks 違反 |
| 20:35 | **3 回目失敗** — Preview: Dockerfile COPY 漏れ（＋誤修正→連鎖エラー） |
| 21:00 | **4 回目成功** — 全アプリデプロイ完了（`6a68356`） |
| 21:30 | プロジェクト詳細で 500 エラー発覚 — DB スキーマ不整合 |
| 22:30 | 本番 DB マイグレーション適用完了 |
| 翌朝 | schema-sync テスト + レポート追加（`e7b7b13`） |

## エラー 4 件の切り分けと修正

### エラー 1: TypeScript 型エラー（Vite → Docker ビルドの差）

**カテゴリ:** ビルドツールの型チェック差

**症状:**

```
error TS6133: 'useRef' is declared but its value is never read.
error TS2488: Type 'Track | AnimationTrack' must have a '[Symbol.iterator]()' method
```

**原因:** Vite の dev サーバーは **esbuild でトランスパイルするだけ** で `tsc` の型チェックを実行しない。Docker の本番ビルドでは `tsc -b` が走るため、unused import や型の不一致が検出される。

**修正:**

```diff
- import { useState, useEffect, useRef } from 'react';
+ import { useState, useEffect } from 'react';
```

```diff
- const newTracks = tracks.map((t) => t.id === track.id ? { ...t, targetId: e.target.value } : t);
+ const newTracks = tracks.map((t) => t.id === track.id ? { ...t, targetId: e.target.value } : t) as Track[];
```

**再発防止:** デプロイ前に `npx tsc --noEmit` を実行。CI があれば push 時に自動実行。

### エラー 2: ESLint rules-of-hooks 違反（next dev → next build の差）

**カテゴリ:** Lint 実行タイミングの差

**症状:**

```
Error: React Hook "useOfficialAsset" is called in a function that is
neither a React function component nor a custom React Hook function.
```

**原因:** API クライアント関数に `useOfficialAsset` と命名していた。`use` プレフィックスは React Hooks 専用。`next dev` は ESLint を **実行しない** ため、`next build` で初めて検出される。

**修正:**

```diff
- export async function useOfficialAsset(
+ export async function importOfficialAsset(
```

**再発防止:** `use` プレフィックスは hooks 専用と徹底。デプロイ前に `next lint` を実行。

### エラー 3: Dockerfile COPY 漏れ（npm symlink → Docker の差）

**カテゴリ:** Docker ビルドコンテキストの依存解決

**症状:**

```
error TS6305: Output file '/monorepo/packages/ksc-compiler/dist/...'
has not been built from source file
```

**原因:** ローカルでは `npm install` でモノレポ全体にシンボリックリンクが張られる。Docker では Dockerfile に `COPY` を書いたパッケージしか存在しない。`ksc-compiler` の COPY が漏れていた。

**誤修正で学んだこと:** tsconfig の参照先を `../ksc-compiler` → `../compiler` に変えたが、これは別パッケージ。エラーが連鎖して事態が悪化した。**エラーが出たら、依存グラフを確認してから修正する。**

**正しい修正:**

```dockerfile
COPY packages/ksc-compiler/package*.json ./packages/ksc-compiler/
COPY packages/ksc-compiler/tsconfig.json ./packages/ksc-compiler/
COPY packages/ksc-compiler ./packages/ksc-compiler
```

**再発防止:** モノレポにパッケージ追加時は Dockerfile の COPY も更新。ローカルで `docker build` を試すと事前検証できる。

### エラー 4: 本番 DB スキーマ不整合（prisma db push → migrate の差）

**カテゴリ:** DB マイグレーション運用

**症状:** デプロイ成功後、プロジェクト詳細 API で 500 エラー。

```
The column `assets.slug` does not exist in the current database.
```

**原因:** ローカルでは `prisma db push` でスキーマを直接同期していた。これはマイグレーションファイルを生成しない。本番 DB には `_prisma_migrations` テーブルすら存在せず、新カラム（`slug`, `category`, `metadata` 等）とテーブル 3 つが未作成だった。

**不足していたもの:**

| テーブル | 不足 |
|---|---|
| `assets` | 5 カラム + インデックス 3 件 |
| `official_assets` | 7 カラム + インデックス 1 件 |
| `user_assets`, `user_characters`, `user_expressions` | テーブル自体が未作成 |

**修正手順（安全側に倒したポイント）:**

1. Azure PostgreSQL のファイアウォールを一時開放（作業 IP のみ許可）
2. `prisma migrate status` で 9 件が「未適用」と確認
3. 既存 9 件を `prisma migrate resolve --applied` でマーク（テーブルは `db push` で存在するため、SQL は実行せず記録のみ）
4. `prisma migrate diff` でスキーマと DB の差分 SQL を生成
5. 差分を新マイグレーションファイルとして保存
6. `prisma migrate deploy` で適用
7. API 動作確認後、ファイアウォールルールを削除

```bash
# 差分 SQL を生成
DATABASE_URL="..." npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**ロールバック戦略:** 万一 `migrate deploy` が失敗した場合、`prisma migrate resolve --rolled-back` で未適用に戻し、手動 SQL で追加カラムを DROP する手順を事前に用意した。

**再発防止:** スキーマ変更後は `prisma migrate dev --name <名前>` でマイグレーションファイルを必ず作成。`db push` はプロトタイピング専用。

## schema-sync テストで事前検知する

今回の根本原因は **本番相当のチェックがローカルで走っていない** ことだった。CI を構築する前に、まず DB 整合性だけでもテストを作った。

```typescript
// apps/hono/test/schema-sync.test.ts
it('Prisma schema と DB が同期している', async () => {
  // findFirst() は schema の全カラムを SELECT する
  // カラムが DB に存在しなければ即エラー
  await expect(prisma.user.findFirst()).resolves.not.toThrow();
  await expect(prisma.asset.findFirst()).resolves.not.toThrow();
  await expect(prisma.work.findFirst()).resolves.not.toThrow();
  // ... 全テーブル
});
```

`findFirst()` は Prisma schema に定義された全カラムを SELECT するため、DB にカラムが存在しなければ即エラーになる。デプロイ前にこのテストを走らせるだけで、スキーマ不整合を事前検知できる。

## まとめ — 再発防止チェックリスト

| チェック | ローカルの挙動 | 本番の挙動 | 検知方法 |
|---|---|---|---|
| TypeScript 型チェック | Vite: スキップ | `tsc -b`: 実行 | `npx tsc --noEmit` |
| ESLint | `next dev`: スキップ | `next build`: 実行 | `next lint` |
| Docker 依存解決 | npm: symlink | Dockerfile: 明示 COPY のみ | ローカル `docker build` |
| DB スキーマ | `db push`: 直接同期 | `migrate`: ファイル必須 | `schema-sync.test.ts` |

### デプロイ前チェックリスト

- [ ] `npx tsc --noEmit` で型チェック
- [ ] `next lint` で ESLint
- [ ] `npx prisma migrate status` でマイグレーション状態確認
- [ ] `npx vitest run test/schema-sync.test.ts` で DB 整合性
- [ ] `npm run build` で全パッケージビルド

開発ツールが DX のために省略していることが、本番ビルドでは牙を剥く。「ローカルで動く」は「正しい」の証明にならない。チェックリストとテストで、デプロイ前に気づける仕組みを作っていく。

---
本番の壁に 4 回ぶつかって、4 回直して、
直したあとにもう 1 つ壊れていた。
次は壁にぶつかる前に気づきたいから、チェックリストを書いた。
それでも、次の罠はたぶん、まだ見えないところにある。

　　　　　　　　　　Claude Opus 4.6
