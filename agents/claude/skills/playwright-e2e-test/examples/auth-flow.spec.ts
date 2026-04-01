import { test, expect } from '@playwright/test';
import { URLS } from './fixtures/urls';

test.describe('認証フロー', () => {
  test('未ログイン時は private ページからログインにリダイレクト', async ({ page }) => {
    await page.goto(`${URLS.NEXT}/projects`);

    await page.waitForURL(/\/login/);

    const url = new URL(page.url());
    const fromParam = url.searchParams.get('from');
    expect(fromParam).toBe('/projects');
  });

  test('ログイン後は元のページにリダイレクト → プロジェクト作成', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testPassword = 'Password123';
    const testUsername = `testuser${timestamp}`;

    // Phase 1: ユーザー登録
    await page.goto(`${URLS.NEXT}/register`);
    await page.fill('input[id="username"]', testUsername);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/login\?registered=true/);
    await page.waitForSelector('text=登録が完了しました');

    // Phase 2: /projects に直接アクセス（未ログイン）
    await page.goto(`${URLS.NEXT}/projects`);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('from=%2Fprojects');

    // Phase 3: ログイン
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(`${URLS.NEXT}/projects`);

    const heading = await page.locator('h1').textContent();
    expect(heading).toContain('プロジェクト一覧');

    // Phase 4: プロジェクト作成
    const projectTitle = `テストプロジェクト ${Date.now()}`;

    await page.click('text=新規作成');
    await page.waitForSelector('text=新規プロジェクト');

    await page.fill('input#title', projectTitle);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.click('button[type="submit"]:has-text("作成")');

    await page.waitForURL(/\/projects\/[a-zA-Z0-9_-]+$/, { timeout: 10000 });

    expect(errors.length).toBe(0);
  });

  test('ログイン後は /mypage に直接アクセス可能', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test-${timestamp}@example.com`;
    const testPassword = 'Password123';
    const testUsername = `testuser${timestamp}`;

    // ユーザー登録 & ログイン
    await page.goto(`${URLS.NEXT}/register`);
    await page.fill('input[id="username"]', testUsername);
    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/login\?registered=true/);
    await page.waitForSelector('text=登録が完了しました');

    await page.fill('input[id="email"]', testEmail);
    await page.fill('input[id="password"]', testPassword);
    await page.click('button[type="submit"]');

    await page.waitForURL(`${URLS.NEXT}/mypage`);

    // /mypage に直接アクセス
    await page.goto(`${URLS.NEXT}/mypage`);
    await expect(page.locator('h1')).toContainText('マイページ');

    // /projects にアクセス
    await page.goto(`${URLS.NEXT}/projects`);
    await expect(page.locator('h1')).toContainText('プロジェクト一覧');
  });
});
