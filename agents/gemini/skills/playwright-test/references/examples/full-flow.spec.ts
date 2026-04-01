import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

function getScreenshotPath(filename: string): string {
  const today = new Date().toISOString().split('T')[0];
  const dir = path.join('screenshots', today);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, filename);
}

test.describe('完全なユーザーフロー', () => {
  test('新規登録 → プロジェクト作成 → エディタ → プレビュー → 作品公開 → プレイ', async ({ page, context }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testUsername = `testuser${timestamp}`;
    const projectTitle = `テストプロジェクト ${timestamp}`;

    // 1. 新規登録
    await test.step('新規登録', async () => {
      await page.goto(`${URLS.NEXT}/register`);
      await page.fill('input[name="username"]', testUsername);
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.fill('input[name="confirmPassword"]', 'testpassword123');
      await page.click('button[type="submit"]');

      await page.waitForURL('**/login', { timeout: 10000 });
    });

    // 2. ログイン
    await test.step('ログイン', async () => {
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'testpassword123');
      await page.click('button[type="submit"]');

      await page.waitForURL('**/mypage', { timeout: 10000 });
      await expect(page.locator('h1')).toContainText('マイページ');
    });

    // 3. プロジェクト作成
    await test.step('プロジェクト作成', async () => {
      await page.goto(`${URLS.NEXT}/projects`);
      await page.click('text=新規プロジェクト作成');
      await page.fill('input[placeholder*="プロジェクト名"]', projectTitle);
      await page.click('button:has-text("作成")');

      await page.waitForURL('**/projects', { timeout: 10000 });
      await expect(page.locator(`text=${projectTitle}`)).toBeVisible();
    });

    // 4. エディタでブロック追加
    await test.step('エディタでブロック追加', async () => {
      await page.click(`text=${projectTitle}`);
      await page.waitForURL('**/projects/*', { timeout: 10000 });

      await page.click('text=エディタを開く');
      await page.waitForURL('**/editor/*', { timeout: 10000 });

      await page.click('button:has-text("ブロックを追加")');
      await page.click('button:has-text("テキスト")');

      await page.fill('textarea[placeholder*="セリフ"]', 'こんにちは、世界！');
      await page.fill('input[placeholder*="キャラクター名"]', 'ナレーター');
      await page.click('button:has-text("追加")');

      await expect(page.locator('text=こんにちは、世界！')).toBeVisible();

      await page.click('button:has-text("ブロックを追加")');
      await page.click('button:has-text("選択肢")');
      await page.fill('input[placeholder*="選択肢のテキスト"]', 'はい');
      await page.fill('input[placeholder*="ジャンプ先"]', 'yes_route');
      await page.click('button:has-text("追加")');

      // 自動保存を待つ
      // 自動保存が完了するまで待つ
      await expect(page.locator('text=保存済み')).toBeVisible({ timeout: 10000 });
    });

    // 5. プレビュー
    await test.step('プレビュー', async () => {
      const [previewPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('button:has-text("プレビュー")'),
      ]);

      await previewPage.waitForLoadState();
      await expect(previewPage.locator('text=プレビューモード')).toBeVisible();

      await previewPage.click('button:has-text("START")');
      await expect(previewPage.locator('text=こんにちは、世界！')).toBeVisible();
      await expect(previewPage.locator('text=ナレーター')).toBeVisible();

      await previewPage.close();
    });

    // 6. 作品を公開
    await test.step('作品を公開', async () => {
      await page.click('text=戻る');
      await page.waitForURL('**/projects/*', { timeout: 10000 });

      await page.click('button:has-text("作品を公開")');
      await page.fill('input[placeholder*="作品のタイトル"]', `公開作品 ${timestamp}`);
      await page.fill('textarea[placeholder*="作品の説明"]', 'これはテスト用の公開作品です。');
      await page.click('button:has-text("公開する")');

      await page.waitForURL('**/works', { timeout: 10000 });
    });

    // 7. 作品をプレイ
    await test.step('作品をプレイ', async () => {
      await expect(page.locator(`text=公開作品 ${timestamp}`)).toBeVisible();

      await page.click(`text=公開作品 ${timestamp}`);
      await page.waitForURL('**/play/*', { timeout: 10000 });

      await expect(page.locator(`text=公開作品 ${timestamp}`)).toBeVisible();
      await page.click('button:has-text("START")');

      await expect(page.locator('text=こんにちは、世界！')).toBeVisible();
      await page.click('button:has-text("次へ")');
      await expect(page.locator('text=はい')).toBeVisible();
    });
  });
});
