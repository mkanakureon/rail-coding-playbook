# ブラウザテスト（Playwright）リファレンスガイド

> 新しい E2E テストを書くときの参考資料。既存テストのパターン・規約・実行方法をまとめる。

## 1. ディレクトリ構成

```
tests/
├── fixtures/
│   └── urls.ts              # 環境別 URL 定数
├── configs/
│   ├── playwright.local.config.ts   # ローカル用
│   ├── playwright.azure.config.ts   # Azure 用
│   └── playwright.recording.config.ts
├── shared/                  # ローカル・Azure 両方で実行
│   ├── auth/                # 認証（ログイン、リダイレクト、Cookie）
│   ├── flow/                # ページ遷移・ユーザーフロー
│   ├── editor/              # エディタ操作
│   ├── guest/               # ゲストモード
│   ├── assets/              # アセット管理
│   ├── admin/               # 管理画面
│   ├── battle/              # バトルシステム
│   ├── timeline/            # タイムライン
│   └── ...
├── local/                   # ローカル専用
├── azure/                   # Azure 専用
└── block-coverage/          # ブロックカバレッジ
```

## 2. テストファイルの書き方

### ヘッダー（必須）

すべてのテストファイルに JSDoc メタデータを記載する。

```typescript
/**
 * @file my-test.spec.ts
 * @env shared              // shared | local | azure
 * @category flow           // auth | flow | editor | assets | ...
 * @description テストの説明（日本語OK）
 * @run npx playwright test tests/shared/flow/my-test.spec.ts --config=tests/configs/playwright.local.config.ts
 */
```

### import パターン

```typescript
import { test, expect } from '@playwright/test';
import { URLS } from '../../fixtures/urls';
```

### URL 定数（`tests/fixtures/urls.ts`）

```typescript
export const URLS = {
  NEXT: process.env.TEST_NEXT_URL || 'http://localhost:3000',
  EDITOR: process.env.TEST_EDITOR_URL || 'http://localhost:5176',
  KSC_EDITOR: process.env.TEST_KSC_EDITOR_URL || 'http://localhost:5177',
  API: process.env.TEST_API_URL || 'http://localhost:8080',
  PREVIEW: process.env.TEST_PREVIEW_URL || 'http://localhost:5175',
} as const;
```

環境変数で Azure URL に切替可能。テスト内では `URLS.NEXT` 等を使い、ハードコードしない。

## 3. 参考テスト 3 選

### 3-1. リンク検証パターン — `tests/azure/azure-landing-links.spec.ts`

**用途**: ページが200で返ること + 404でないことを一括確認

```typescript
const LANDING_LINKS = [
  { path: '/login', label: 'ログイン' },
  { path: '/docs', label: 'ドキュメント一覧' },
  { path: '/works', label: '作品一覧' },
  // ...
];

async function assertPageLoads(page: Page, path: string) {
  const res = await page.goto(`${NEXT}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  expect(res?.status()).toBe(200);

  // メインコンテンツが存在する
  await expect(
    page.locator('main, article, [role="main"], .container, h1, h2').first()
  ).toBeVisible({ timeout: 10000 });

  // 404 でない
  const h1Text = await page.locator('h1').first().textContent();
  expect(h1Text).not.toContain('404');
}

test.describe('ランディングページのリンク', () => {
  for (const link of LANDING_LINKS) {
    test(`${link.label} (${link.path})`, async ({ page }) => {
      await assertPageLoads(page, link.path);
    });
  }
});
```

**ポイント**: データ配列 + ループでテストを自動生成。リンクの追加・削除が配列編集だけで済む。

### 3-2. セクション表示・ナビゲーション — `tests/shared/flow/landing-ai-profiles.spec.ts`

**用途**: LP 上のセクション存在確認 → カード内容確認 → クリック遷移確認

```typescript
test('LP にセクションが表示される', async ({ page }) => {
  await page.goto(URLS.NEXT, { waitUntil: 'networkidle', timeout: 15000 });
  await expect(page.locator('text=AI と作る開発')).toBeVisible({ timeout: 5000 });
});

test('カードの内容を確認', async ({ page }) => {
  await page.goto(URLS.NEXT, { waitUntil: 'networkidle', timeout: 15000 });
  const card = page.locator('a[href="/docs/ai-profile-claude-code"]');
  await expect(card).toBeVisible({ timeout: 5000 });
  await expect(card).toContainText('Claude Code');
});

test('カードをクリックすると遷移', async ({ page }) => {
  await page.goto(URLS.NEXT, { waitUntil: 'networkidle', timeout: 15000 });
  await page.locator('a[href="/docs/ai-profile-claude-code"]').click();
  await page.waitForURL('**/docs/ai-profile-claude-code', { timeout: 10000 });
  await expect(page.locator('h1')).toContainText('Claude Code');
});
```

**ポイント**: 1テスト = 1つの確認事項。表示確認とナビゲーション確認を分離する。

### 3-3. フルフローテスト — `tests/shared/flow/full-flow.spec.ts`

**用途**: 登録 → ログイン → プロジェクト作成 → エディタ → 公開 の一連フロー

```typescript
test('完全なユーザーフロー', async ({ page, context }) => {
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@example.com`;

  // 1. 新規登録
  await test.step('新規登録', async () => {
    await page.goto(`${URLS.NEXT}/register`);
    await page.fill('input[id="username"]', `testuser${timestamp}`);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', 'Password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/login**', { timeout: 10000 });
  });

  // 2. ログイン
  await test.step('ログイン', async () => {
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', 'Password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/mypage', { timeout: 10000 });
  });

  // 3. エディタを開く（新しいタブ）
  await test.step('エディタを開く', async () => {
    const [editorPage] = await Promise.all([
      context.waitForEvent('page'),
      page.getByTestId('link-editor').click(),
    ]);
    await editorPage.waitForLoadState('networkidle');
    await expect(editorPage.locator('.block-card').first()).toBeVisible({ timeout: 15000 });
  });
});
```

**ポイント**: `test.step()` でフェーズを明示。`context.waitForEvent('page')` で新規タブのハンドリング。

## 4. 認証パターン

### フォームログインを避ける（並列テスト向け）

`loginLimiter`（5回/分）があるため、並列テストではフォームログインが枯渇する。

```typescript
let sharedToken = '';

test.beforeAll(async () => {
  const res = await fetch(`${URLS.API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'mynew@test.com',
      password: 'DevPass123!',
    }),
  });
  const data = await res.json();
  sharedToken = data.token;
});

async function injectAuth(page: Page) {
  await page.goto(`${URLS.NEXT}/login`);
  await page.evaluate((t) => {
    localStorage.setItem('authToken', t);
  }, sharedToken);
}

test('認証済みページ', async ({ page }) => {
  await injectAuth(page);
  await page.goto(`${URLS.NEXT}/mypage`);
  // ...
});
```

## 5. セレクタの優先順位

```typescript
// 1. TestID（最も安定）
page.getByTestId('btn-new-project')

// 2. アクセシブルロール
page.getByRole('heading', { name: '作品を公開' })
page.getByRole('button', { name: 'Submit' })

// 3. CSS セレクタ（属性指定）
page.locator('a[href="/docs/platform-support"]')
page.locator('input[id="email"]')

// 4. テキスト（変更されやすいので最終手段）
page.locator('text=新規作成')
```

## 6. 待機パターン

```typescript
// ナビゲーション後 → URL で待つ
await page.waitForURL('**/mypage', { timeout: 10000 });

// 動的コンテンツ → networkidle
await page.waitForLoadState('networkidle');

// 要素の出現 → toBeVisible
await expect(page.locator('.block-card').first()).toBeVisible({ timeout: 15000 });

// NG: waitForTimeout でごまかさない
// await page.waitForTimeout(3000);  // ← 禁止
```

## 7. 実行方法

```bash
# ローカル: shared + local テスト
npx playwright test tests/shared/flow/my-test.spec.ts \
  --config=tests/configs/playwright.local.config.ts

# Azure: shared + azure テスト
npx playwright test tests/azure/azure-landing-links.spec.ts \
  --config=tests/configs/playwright.azure.config.ts

# 特定テストのみ（grep）
npx playwright test --grep "ランディング" \
  --config=tests/configs/playwright.local.config.ts

# トレース付き（デバッグ用）
npx playwright test tests/shared/flow/my-test.spec.ts \
  --config=tests/configs/playwright.local.config.ts --trace on

# ヘッドあり（ブラウザ表示）
npx playwright test tests/shared/flow/my-test.spec.ts \
  --config=tests/configs/playwright.local.config.ts --headed
```

## 8. config の概要

### ローカル（`tests/configs/playwright.local.config.ts`）

```typescript
export default defineConfig({
  testDir: '..',
  testMatch: ['local/**/*.spec.ts', 'shared/**/*.spec.ts'],
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
});
```

- `workers: 1` — ローカルはシリアル実行（DB 競合防止）
- `timeout: 60_000` — 1テスト最大60秒

### Azure（`tests/configs/playwright.azure.config.ts`）

- `timeout: 120_000` — コールドスタート考慮で長め
- `navigationTimeout: 30_000` — ネットワーク遅延考慮
- 環境変数で URL を Azure に上書き

## 9. 注意事項

- **LP の AI Profiles セクションは 2026-03-13 に削除済み**。`landing-ai-profiles.spec.ts` のテスト 1〜5 は更新が必要
- `azure-landing-links.spec.ts` の `LANDING_LINKS` も LP 変更に合わせて更新が必要
- スクリーンショットは `screenshots/YYYY-MM-DD/` に日付別保存
- テスト用アカウント: `mynew@test.com` / `DevPass123!`（Admin）、`test1@example.com` / `DevPass123!`（User）
