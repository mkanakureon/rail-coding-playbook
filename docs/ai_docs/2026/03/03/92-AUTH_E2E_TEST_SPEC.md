# 認証 E2E テスト仕様書

> 作成日: 2026-03-03
> テストファイル: `tests/auth-redirect.spec.ts`, `tests/auth-flow.spec.ts`, `tests/local-auth.spec.ts`

---

## 概要

ログイン・ログアウト・未認証アクセスのリダイレクト動作を Playwright で検証する E2E テスト群。
3 ファイル合計 **34 テスト**、3 ワーカーで並列実行（約 55 秒）。

### 前提条件

| 項目 | 値 |
|------|-----|
| Next.js | `http://localhost:3000` |
| Hono API | `http://localhost:8080` |
| テストユーザー | `test1@example.com` / `DevPass123!` |
| Editor | `http://localhost:5176`（エディタ連携テストのみ） |

### レートリミット対策

| リミッター | 制限 | 対策 |
|-----------|------|------|
| `loginLimiter` | 5/min | フォームログインを最小限に抑え、トークン注入 (`injectAuth`) で代替 |
| `registerLimiter` | 3/hour | テストでは新規登録を行わない（バリデーションテストはAPIエラーを確認するのみ） |
| `apiLimiter` | 200/min (default) | 並列テストで枯渇するため `API_RATE_LIMIT=1000` を `.env` に設定 |

### トークン注入パターン

```typescript
// beforeAll で API ログインして sharedToken を取得（1回のみ）
let sharedToken = '';
test.beforeAll(async () => {
  const res = await fetch(`${URLS.API}/api/auth/login`, { ... });
  sharedToken = (await res.json()).token;
});

// 各テストは injectAuth で localStorage にトークンをセット
async function injectAuth(page: Page) {
  await page.goto(`${URLS.NEXT}/login`);
  await page.evaluate((t) => localStorage.setItem('authToken', t), sharedToken);
}
```

---

## 1. auth-redirect.spec.ts（25 テスト）

認証リダイレクトの包括テスト。9 セクションで構成。

### 1.1 未ログイン — 保護ページへのアクセス（5 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 1 | `/mypage` → `/login?from=` | 未認証で `/mypage` → `/login` にリダイレクト、`from` パラメータ付与 |
| 2 | `/projects` → `/login?from=` | 未認証で `/projects` → `/login` にリダイレクト |
| 3 | `/my-assets` → `/login` | 未認証で `/my-assets` → `/login` にリダイレクト |
| 4 | `/mypage/messages` → `/login` | ネストされた保護ページも `/login` にリダイレクト |
| 5 | `/admin` → `/login` | 管理者ページも未認証で `/login` にリダイレクト |

### 1.2 未ログイン — 公開ページはリダイレクトなし（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 6 | `/login` はそのまま表示 | ログインフォームが表示される |
| 7 | `/register` はそのまま表示 | 登録フォームが表示される |
| 8 | `/works` はそのまま表示 | 公開ページはリダイレクトされない |

### 1.3 ログインフォーム — バリデーション（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 9 | 空フォームで送信 | ページ遷移しない（HTML5 required バリデーション） |
| 10 | 存在しないメールアドレス | エラーメッセージ表示（`.bg-red-*` or `text-red-*`） |
| 11 | 間違ったパスワード | エラーメッセージ表示 |

### 1.4 ログイン成功 — リダイレクト（2 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 12 | デフォルトは `/mypage` にリダイレクト | トークン注入後 `/mypage` に遷移できる |
| 13 | 保護ページ → ログイン → 元のページ | `/mypage` → `/login?from=` → トークン注入 → `/mypage` に戻る |

### 1.5 登録フォーム — バリデーション（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 14 | 短いユーザー名（2文字） | サーバーサイドバリデーションでエラー、`/register` に留まる |
| 15 | 弱いパスワード（数字なし） | 同上 |
| 16 | 弱いパスワード（大文字なし） | 同上 |

> **注意**: 登録ページにはクライアントサイドバリデーションがなく、全件 API に送信される。`registerLimiter` (3/hour) を消費するため、追加テストには注意。

### 1.6 ログアウト（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 17 | ログアウトボタン → `/login` | ボタンクリックで `/login` にリダイレクト |
| 18 | ログアウト後に `/mypage` | 再度 `/login` にリダイレクトされる |
| 19 | localStorage がクリア | `authToken` が `null` になっている |

### 1.7 トークン・セッション管理（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 20 | authToken が localStorage に保存 | トークン注入後、ログアウトボタン表示を確認してから localStorage を検証 |
| 21 | 不正なトークンで保護ページ | `invalid-fake-token` → `/login` にリダイレクト |
| 22 | ページリロード → セッション維持 | `/mypage` → リロード → まだ `/mypage` にいる |

### 1.8 管理者ルート — アクセス制御（1 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 23 | 一般ユーザーが `/admin` | `role !== 'admin'` → `/mypage` にリダイレクト |

### 1.9 連続操作パターン（2 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 24 | ログイン → ログアウト → 再ログイン | トークン注入 → ログアウト → 再注入で復帰 |
| 25 | 複数タブでログアウト | tab1 でログアウト → tab2 リロード → `/login` にリダイレクト |

---

## 2. auth-flow.spec.ts（3 テスト）

認証フローの基本パターンを検証。

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 1 | 未ログイン時のリダイレクト | `/mypage` → `/login?from=%2Fmypage` |
| 2 | ログイン → プロジェクト作成 | トークン注入 → `/mypage` → 新規プロジェクト作成 → プロジェクト詳細ページへ遷移 |
| 3 | `/mypage` に直接アクセス | トークン注入 → `/mypage` 表示、`/projects` → `/mypage` リダイレクト確認 |

---

## 3. local-auth.spec.ts（6 テスト）

ログイン・エディタ連携の統合テスト。

### 3.1 ログインフロー（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 1 | トップページ → ログイン → マイページ | フォーム入力でログイン、`/mypage` に遷移、h1 にユーザー名表示 |
| 2 | 未ログイン時のプロテクトページ | `/mypage` → `/login?from=%2Fmypage` |
| 3 | ログイン → ログアウト | トークン注入 → ログアウトボタン → `/login` にリダイレクト |

### 3.2 エディタ連携（3 テスト）

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 4 | プロジェクト作成 → エディタリンク | 新規プロジェクト作成 → 「エディタで編集」リンクが表示される → 新タブで editor URL に遷移 |
| 5 | プロジェクト作成 → エディタリンク確認 | 新規プロジェクト作成 → `a[href*="editor"]` の href が `/projects/editor/` を含む |
| 6 | エディタでの編集と保存 | プロジェクト作成 → エディタ URL に直接アクセス → ページ読み込み成功 |

---

## 認証アーキテクチャ

```
Browser (Client-Side Auth)
│
├─ Navigate to /mypage
├─ (private)/layout.tsx renders
├─ <AuthProvider> mounts → checkAuth()
│   ├─ localStorage.getItem('authToken') or 'guestToken'
│   ├─ fetch GET /api/auth/me + Bearer token
│   │   ├─ 200 OK → setUser(data.user)
│   │   ├─ 401/429 → clearAuthToken() + setUser(null)
│   │   └─ Network Error → setUser(null)
│   └─ loading = false
├─ <AuthGuard> checks: !loading && !user
│   ├─ true → router.replace('/login?from=...')
│   └─ false → render children
│
└─ middleware.ts (Edge)
    └─ パススルー（localStorage は Edge で読めない）
```

### API エンドポイント

| Endpoint | Method | Auth | Rate Limit | 用途 |
|----------|--------|------|------------|------|
| `/api/auth/login` | POST | No | 5/min | メール/パスワード → JWT |
| `/api/auth/register` | POST | No | 3/hour | ユーザー登録 |
| `/api/auth/me` | GET | Bearer | 200/min (API) | トークン検証 |
| `/api/auth/logout` | POST | No | API | ログアウト（クライアント側のみ、サーバー無効化なし） |

### ログアウトの注意点

- `POST /api/auth/logout` はサーバー側でトークンを無効化**しない**（成功メッセージを返すだけ）
- ログアウトは純粋にクライアント側: `localStorage.removeItem('authToken')`
- JWT は有効期限（24時間）まで有効

---

## テスト実行

```bash
# 全認証テスト（34 テスト、3 ワーカー並列）
npx playwright test tests/auth-redirect.spec.ts tests/auth-flow.spec.ts tests/local-auth.spec.ts --config playwright.check.config.ts

# 個別ファイル
npx playwright test tests/auth-redirect.spec.ts --config playwright.check.config.ts
```

### 並列実行時の注意

`apiLimiter` (200/min) が 34 テストの並列実行で枯渇する場合がある。
`apps/hono/.env` に `API_RATE_LIMIT=1000` を設定すること。
