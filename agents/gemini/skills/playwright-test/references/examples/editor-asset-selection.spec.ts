import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

// レートリミット回避のため直列実行
test.describe.configure({ mode: 'serial' });

function getScreenshotPath(filename: string): string {
  const today = new Date().toISOString().split('T')[0];
  const dir = path.join('screenshots', today);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, filename);
}

test.describe('公式アセット・マイアセット選択', () => {
  // プロジェクト「画像test」(bg+ch アセットあり、キャラクターあり)
  const PROJECT_WITH_ASSETS = '01KHRJ9DGDZA8DE06XCEQQJZ7Q';

  const adminUser = {
    email: 'mynew@test.com',
    password: 'DevPass123!',
  };

  let authToken: string;
  let authUserId: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${URLS.API}/api/auth/login`, {
      data: adminUser,
    });
    const loginData = await loginRes.json();
    authToken = loginData.token;
    authUserId = loginData.user.id;
  });

  async function openEditor(page: any, projectId: string) {
    await page.addInitScript(
      ({ token, userId }: { token: string; userId: string }) => {
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUserId', userId);
      },
      { token: authToken, userId: authUserId }
    );

    await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    });
    await page.waitForTimeout(3000);
  }

  // ── 背景選択 ──

  test('1. 背景選択 — マイアセットタブ', async ({ page }) => {
    await openEditor(page, PROJECT_WITH_ASSETS);
    await page.screenshot({ path: getScreenshotPath('asset-01-editor-loaded.png') });

    // 背景ブロックの「変更」ボタン
    const changeBtn = page.locator('button').filter({ hasText: '変更' }).first();
    await expect(changeBtn).toBeVisible({ timeout: 5000 });
    await changeBtn.click();
    await page.waitForTimeout(1500);

    // モーダル確認
    await expect(page.locator('text=背景画像を選択')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: getScreenshotPath('asset-02-bg-my-assets.png') });

    await page.locator('button[aria-label="モーダルを閉じる"]').click();
  });

  test('2. 背景選択 — 公式アセットタブ', async ({ page }) => {
    await openEditor(page, PROJECT_WITH_ASSETS);

    const changeBtn = page.locator('button').filter({ hasText: '変更' }).first();
    await expect(changeBtn).toBeVisible({ timeout: 5000 });
    await changeBtn.click();
    await page.waitForTimeout(1500);

    // 公式アセットタブ切替
    const officialTab = page.locator('button').filter({ hasText: '公式アセット' });
    await expect(officialTab).toBeVisible({ timeout: 3000 });
    await officialTab.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: getScreenshotPath('asset-03-bg-official-assets.png') });

    await page.locator('button[aria-label="モーダルを閉じる"]').click();
  });

  // ── キャラクター選択 ──

  test('3. キャラクター選択 — マイアセットタブ', async ({ page }) => {
    await openEditor(page, PROJECT_WITH_ASSETS);

    // 「キャラ」タブをクリック
    const charTab = page.locator('button, a').filter({ hasText: 'キャラ' }).first();
    await expect(charTab).toBeVisible({ timeout: 5000 });
    await charTab.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: getScreenshotPath('asset-04-char-panel.png') });

    // キャラクターカードの「編集」ボタンをクリック
    const editBtn = page.locator('button').filter({ hasText: '編集' }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: getScreenshotPath('asset-05-char-edit-modal.png') });

      // 表情の「既存から選択」ボタンをクリック
      const selectFromExistingBtn = page.locator('button').filter({ hasText: '既存から選択' }).first();
      if (await selectFromExistingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectFromExistingBtn.click();
        await page.waitForTimeout(1500);

        // キャラクター画像選択モーダル
        await expect(page.locator('text=キャラクター画像を選択')).toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: getScreenshotPath('asset-06-ch-my-assets.png') });

        // 公式アセットタブに切替
        const officialTab = page.locator('button').filter({ hasText: '公式アセット' });
        if (await officialTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await officialTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: getScreenshotPath('asset-07-ch-official-assets.png') });
        }

        // AssetSelectModal の閉じるボタン（CharacterEditModalと2つあるので最後のを使う）
        await page.locator('button[aria-label="モーダルを閉じる"]').last().click();
      } else {
        console.log('「既存から選択」ボタンが見つかりません');
        await page.screenshot({ path: getScreenshotPath('asset-06-no-select-btn.png') });
      }
    } else {
      console.log('キャラクターの編集ボタンが見つかりません');
      await page.screenshot({ path: getScreenshotPath('asset-05-no-edit-btn.png') });
    }
  });

  // ── 管理画面 ──

  test('4. 管理画面 — 公式アセット管理', async ({ page }) => {
    await page.addInitScript(
      ({ token }: { token: string }) => {
        localStorage.setItem('authToken', token);
      },
      { token: authToken }
    );

    await page.goto(`${URLS.NEXT}/login`);
    await page.waitForTimeout(1000);
    await page.fill('input[id="email"]', adminUser.email);
    await page.fill('input[id="password"]', adminUser.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    await page.goto(`${URLS.NEXT}/admin/official-assets`);
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: getScreenshotPath('asset-08-admin-official-assets.png') });
  });
});
