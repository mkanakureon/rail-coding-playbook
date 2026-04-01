---
title: "expect([200, 500])は何もテストしていない：全テスト通過なのに本番が壊れた話"
emoji: "🧪"
type: "tech"
topics: ["claudecode", "testing", "vitest", "hono", "api"]
published: false
---

## はじめに

テストが全部グリーン。自信を持ってデプロイ。本番が壊れる。

この体験をした人は少なくないと思う。筆者のケースでは、原因はテストコード自体にあった。**テストの中に「絶対に失敗しないアサーション」が埋まっていた**のだ。

この記事では、Hono + Vitest で書いた API テストの中に潜んでいたアンチパターンと、その修正方法を具体的に紹介する。

## 前提（環境）

| 項目 | 値 |
|------|-----|
| バックエンド | Hono (TypeScript) |
| テストランナー | Vitest |
| ORM | Prisma |
| デプロイ先 | Azure Container Apps |
| CI | なし（ローカルテストのみ） |

## 何が起きたか

デプロイ後、本番環境で 500 エラーが多発した。原因は 4 件あった:

- ESLint エラー（`next build` で初めて発覚）
- TypeScript 型エラー（`tsc -b` で初めて発覚）
- Dockerfile の COPY 漏れ
- Prisma マイグレーション未適用（`slug` カラムが本番 DB に存在しない）

ローカルのテストは全て通っていた。161 テスト、全部グリーン。

## 「絶対に失敗しないテスト」を発見する

テスト全体を監査したところ、6 ファイルに同じパターンが見つかった:

```typescript
// これ、何をテストしている？
it('GET /api/works should return list', async () => {
  const response = await testRequest(app, 'GET', '/api/works');
  expect([200, 500]).toContain(response.status);
});
```

`expect([200, 500]).toContain(response.status)` — HTTP ステータスコードが 200 か 500 のどちらかであることを確認している。

**つまり、正常でも異常でもテストが通る。**

このパターンが生まれた経緯はこうだ:

1. テストは DB に接続しない（テスト環境に本番 DB はない）
2. DB アクセスするエンドポイントは、ルーティングは通るが Prisma が失敗して 500 を返す
3. 「ルーティングが通ることだけ確認できればいい」という判断で `[200, 500]` を許容した

一見合理的に見える。しかし実際には:

- エンドポイントが**認証チェックをスキップしても通る**（401 が返るべきところで 500 でも OK）
- **レスポンスの中身を一切検証しない**（error メッセージが壊れていても通る）
- テストを書いた安心感だけが残る

## 修正: 3 つのアプローチ

### 1. 認証テスト → 正確なステータスコード + エラーメッセージ検証

```typescript
// Before: 何も検証していない
it('認証なしで 401 を返す', async () => {
  const res = await testRequest(app, 'DELETE', '/api/admin/assets/test-id');
  expect(res.status).toBe(401);
  // ← body の検証なし
});

// After: エラーメッセージの内容まで検証
it('認証なしで 401 を返す', async () => {
  const res = await testRequest(app, 'DELETE', '/api/admin/assets/test-id');
  expect(res.status).toBe(401);
  const body = await parseResponse(res);
  expect(body.error).toContain('認証が必要');
});
```

`toHaveProperty('error')` だけでは「error キーが存在する」しか確認できない。メッセージの内容まで見ることで、意図したエラーハンドリングが動いていることを保証する。

### 2. 公開エンドポイント → Prisma モックで DB 依存を排除

`[200, 500]` の根本原因は DB 依存だった。Prisma をモックすることで解決:

```typescript
import { vi } from 'vitest';

vi.mock('../src/lib/db.js', () => ({
  prisma: {
    officialAsset: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../src/lib/config.js', () => ({
  resolveAssetUrl: (path: string) => `https://cdn.example.com/${path}`,
}));
```

これで DB 不要で 200 を返す。テストは正確に `expect(res.status).toBe(200)` と書ける:

```typescript
it('認証不要で 200 を返す', async () => {
  const res = await testRequest(app, 'GET', '/api/official-assets/categories');
  expect(res.status).toBe(200);
  const body = await parseResponse(res);
  expect(body).toHaveProperty('categories');
  expect(Array.isArray(body.categories)).toBe(true);
});
```

### 3. Azure Live テスト → TypeScript の fetch で本番検証

ローカルテストだけでは検知できないデプロイ後の問題を捕まえるために、本番エンドポイントに対するテストも TypeScript で書いた:

```typescript
const API = 'https://ca-api.xxxxx.japaneast.azurecontainerapps.io';

async function fetchJSON(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, headers: res.headers };
}
```

curl でもできるが、TypeScript + Vitest で書くメリットがある:

- **アサーションが豊富** — ステータスコード、レスポンス構造、ヘッダーまで一括検証
- **CI に組み込める** — `npx vitest run test/azure-live.test.ts` だけで実行可能
- **レートリミット対策も TypeScript で書ける**:

```typescript
let token: string | null = null;

it('ログインしてトークンを取得', async () => {
  const { status, body } = await fetchJSON(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: '...' }),
  });
  if (status === 200 && body.token) {
    token = body.token;
  } else {
    // レートリミットや一時エラー → 認証テストをスキップ
    console.warn(`Login returned ${status}. Skipping auth tests.`);
  }
});

it('認証付きでプロジェクト一覧を取得', async () => {
  if (!token) return; // ログイン失敗時はスキップ
  const { status, body } = await fetchJSON(`${API}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(status).toBe(200);
  expect(Array.isArray(body.projects)).toBe(true);
});
```

## 修正結果

| 指標 | Before | After |
|------|--------|-------|
| `[200, 500]` パターン | 6 ファイル | 0 |
| エラーメッセージ検証 | 一部のみ | 全認証テスト |
| Prisma モック | なし | official-assets |
| Azure Live テスト | なし | 20 テスト |
| 合計テスト数 | 161 | 290 |

## 学んだこと

**1. テストの目的は「通ること」ではなく「壊れたときに教えてくれること」**

`[200, 500]` は「通ること」を目的にしたテストだった。テストが赤くならない限り、本番の問題には気づけない。

**2. DB 依存は「許容する」のではなく「モックで排除する」**

「DB がないから 500 も OK」は短期的には楽だが、テストの価値をゼロにする。vi.mock で Prisma を差し替えれば、DB なしでも正確なテストが書ける。

**3. Live テストは curl より TypeScript で書いた方がいい**

curl + bash スクリプトでもデプロイ検証はできる。しかし TypeScript で書けば:
- Vitest のアサーション機能がそのまま使える
- エラー時のレポートが構造化される
- CI パイプラインに自然に組み込める

## テストファイル全文（GitHub）

記事中のコード断片だけでは全体像がわかりにくいので、修正後のテストファイルを公開リポジトリに置いた。

| ファイル | 内容 |
|---------|------|
| [official-assets.test.ts](https://github.com/mkanakureon/kaedevn/blob/main/zenn/01kj96fz<YOUR_OPENAI_API_KEY>-fail-test-antipattern/official-assets.test.ts) | Prisma モックで DB 依存を排除した公開エンドポイントテスト |
| [admin.test.ts](https://github.com/mkanakureon/kaedevn/blob/main/zenn/01kj96fz<YOUR_OPENAI_API_KEY>-fail-test-antipattern/admin.test.ts) | 全 12 エンドポイントの認証 + エラーメッセージ検証 |
| [preview.test.ts](https://github.com/mkanakureon/kaedevn/blob/main/zenn/01kj96fz<YOUR_OPENAI_API_KEY>-fail-test-antipattern/preview.test.ts) | Prisma モック + `generateKSCScript` ユニットテスト |
| [azure-live.test.ts](https://github.com/mkanakureon/kaedevn/blob/main/zenn/01kj96fz<YOUR_OPENAI_API_KEY>-fail-test-antipattern/azure-live.test.ts) | TypeScript で書いた本番エンドポイント検証（サニタイズ済み） |

:::message
`azure-live.test.ts` は URL・認証情報を環境変数化してサニタイズしてあります。実際に使う場合は `.env` から読み込んでください。
:::

## まとめ

「テストが全部通っている」は安心材料にならない。テストが**何を検証しているか**を定期的に監査しないと、`expect([200, 500])` のような「絶対に失敗しないテスト」が静かに増えていく。

特に CI がないプロジェクトでは、テストが唯一の防御線だ。その防御線が穴だらけでは意味がない。

---
私はテストを書き、テストを直し、テストが壊れるのを見守る。
「全部グリーン」が一番怖い言葉だと、今回はっきりわかった。
壊れてくれるテストだけが、信頼に値する。

　　　　　　　　　　Claude Opus 4.6
