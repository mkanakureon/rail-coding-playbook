/**
 * バトル実行テスト
 *
 * プロジェクトにバトルブロックを設定し、
 * プレビュー画面でバトルが実行・完了することを確認する。
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

const SS_DIR = path.join('screenshots', '2026-02-21-battle-play');
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}

async function login(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  const { token, user } = await res.json();
  return { token, userId: user.id };
}

async function createProject(page: import('@playwright/test').Page, token: string, title: string) {
  const res = await page.request.post(`${URLS.API}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  if (!res.ok()) throw new Error(`Create project failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return body.project?.id || body.id;
}

async function updateProjectData(page: import('@playwright/test').Page, token: string, projectId: string, data: any) {
  const res = await page.request.put(`${URLS.API}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { data },
  });
  if (!res.ok()) throw new Error(`Update project failed: ${res.status()} ${await res.text()}`);
}

async function deleteProject(page: import('@playwright/test').Page, token: string, projectId: string) {
  await page.request.delete(`${URLS.API}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('バトル実行テスト（プレビュー）', () => {
  let token: string;
  let userId: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const creds = await login(page);
    token = creds.token;
    userId = creds.userId;

    // プロジェクト作成
    projectId = await createProject(page, token, 'バトル実行テスト');

    // バトルブロックを含むプロジェクトデータを設定
    await updateProjectData(page, token, projectId, {
      pages: [
        {
          id: 'page1',
          name: 'ページ1',
          blocks: [
            { id: 'start-1', type: 'start' },
            { id: 'text-1', type: 'text', body: 'バトル開始！' },
            { id: 'battle-1', type: 'battle', troopId: 'slime_pack', onWinPageId: '', onLosePageId: '' },
          ],
        },
      ],
    });

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (projectId && token) {
      const page = await browser.newPage();
      await deleteProject(page, token, projectId);
      await page.close();
    }
  });

  test('プレビューでバトルを実行し勝敗まで確認', async ({ page }) => {
    test.setTimeout(120000);

    // プレビューページを開く
    await page.goto(`${URLS.PREVIEW}/ksc-demo.html?work=${projectId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await page.screenshot({ path: ss('01-preview-loading.png') });

    // canvas が表示されるまで待機
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.screenshot({ path: ss('02-canvas-ready.png') });

    // テキスト「バトル開始！」の表示後、Space キーで進める
    // OpRunner がテキスト → waitClick → バトル と進む
    await page.waitForTimeout(2000);
    await page.screenshot({ path: ss('03-text-displayed.png') });

    // Space キーでテキスト送り（canvas クリックよりも確実）
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);

    // バトルオーバーレイが表示されるまで待機
    const overlay = page.locator('#battle-overlay');
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: ss('04-battle-started.png') });

    // ENEMIES, PARTY セクションが表示されている
    await expect(overlay.locator('text=ENEMIES')).toBeVisible();
    await expect(overlay.locator('text=PARTY')).toBeVisible();
    await expect(overlay.locator('text=Hero')).toBeVisible();

    // 「たたかう」ボタンが表示されている
    const attackBtn = overlay.locator('button:has-text("たたかう")');
    await expect(attackBtn).toBeVisible({ timeout: 5000 });

    // 「回復」ボタンが表示されている
    const healBtn = overlay.locator('button:has-text("回復")');
    await expect(healBtn).toBeVisible();

    await page.screenshot({ path: ss('05-battle-commands.png') });

    // バトルループ: 「たたかう」を繰り返しクリック
    let turnCount = 0;
    const maxTurns = 30;

    while (turnCount < maxTurns) {
      // 勝敗判定テキストが出ていたら終了
      const victoryVisible = await overlay.locator('text=VICTORY!').isVisible().catch(() => false);
      const defeatVisible = await overlay.locator('text=DEFEAT...').isVisible().catch(() => false);
      if (victoryVisible || defeatVisible) break;

      // 「たたかう」ボタンが表示されるまで待機（敵ターン後）
      const atkVisible = await attackBtn.isVisible().catch(() => false);
      if (atkVisible) {
        await page.screenshot({ path: ss(`06-turn-${turnCount + 1}.png`) });
        await attackBtn.click();
        turnCount++;
      }

      await page.waitForTimeout(800);
    }

    await page.screenshot({ path: ss('07-battle-result.png') });

    // 勝利 or 敗北メッセージが表示されている
    const victoryText = overlay.locator('text=VICTORY!');
    const defeatText = overlay.locator('text=DEFEAT...');
    const hasVictory = await victoryText.isVisible().catch(() => false);
    const hasDefeat = await defeatText.isVisible().catch(() => false);

    expect(hasVictory || hasDefeat).toBeTruthy();

    if (hasVictory) {
      console.log('Battle result: VICTORY!');
    } else {
      console.log('Battle result: DEFEAT...');
    }

    // 「タップして続ける」が表示されている
    await expect(overlay.locator('text=タップして続ける')).toBeVisible();

    // タップして続ける
    await overlay.click();
    await page.waitForTimeout(500);

    // オーバーレイが消えている
    await expect(overlay).not.toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: ss('08-battle-finished.png') });
  });
});
