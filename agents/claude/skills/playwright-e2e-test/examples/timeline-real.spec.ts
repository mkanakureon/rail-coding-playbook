/**
 * タイムラインブロック実動作テスト
 *
 * 実サーバー（Editor:5176 + API:8080）を使い、
 * 実際にプロジェクトを作成してTLブロックの追加・編集・表示を確認する。
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

const SS_DIR = path.join('screenshots', '2026-02-20-timeline-block-real');
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}

// テスト用ユーザーでログインしてトークンを取得
async function login(page: import('@playwright/test').Page) {
  // API でトークン取得
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
  const { token, user } = await res.json();

  // localStorage にセット
  await page.addInitScript(
    ({ token, userId }: { token: string; userId: string }) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUserId', userId);
    },
    { token, userId: user.id },
  );

  return { token, userId: user.id };
}

// テスト用プロジェクトを作成
async function createProject(
  page: import('@playwright/test').Page,
  token: string,
  title: string,
) {
  const res = await page.request.post(`${URLS.API}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  if (!res.ok()) {
    throw new Error(`Create project failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.project?.id || body.id;
}

// テスト用プロジェクトを削除
async function deleteProject(
  page: import('@playwright/test').Page,
  token: string,
  projectId: string,
) {
  await page.request.delete(`${URLS.API}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe('タイムラインブロック 実動作テスト', () => {
  let token: string;
  let userId: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const creds = await login(page);
    token = creds.token;
    userId = creds.userId;

    // テスト用プロジェクト作成
    projectId = await createProject(page, token, 'TLブロック実テスト');
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (projectId && token) {
      const page = await browser.newPage();
      await deleteProject(page, token, projectId);
      await page.close();
    }
  });

  test('TLブロックの追加・ラベル編集・タイムラインパネル自動表示', async ({ page }) => {
    // ログイン状態をセット
    await page.addInitScript(
      ({ t, u }: { t: string; u: string }) => {
        localStorage.setItem('authToken', t);
        localStorage.setItem('currentUserId', u);
      },
      { t: token, u: userId },
    );

    // デスクトップサイズ
    await page.setViewportSize({ width: 1280, height: 800 });

    // エディタを開く
    await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.editor-layout', { timeout: 15000 });
    await page.screenshot({ path: ss('01-editor-loaded.png'), fullPage: true });

    // ===== 1. ブロック追加メニューを開く =====
    await page.click('.add-block-btn');
    await page.waitForSelector('.bottom-sheet', { timeout: 3000 });
    await page.screenshot({ path: ss('02-add-menu-open.png') });

    // 「演出TL」ボタンが表示されていることを確認
    const tlBtn = page.locator('.bottom-sheet button:has-text("演出TL")');
    await expect(tlBtn).toBeVisible();

    // ===== 2. 演出TLブロックを追加 =====
    await tlBtn.click();

    // TLブロックカードが表示される
    const tlCard = page.locator('[data-block-id^="timeline-"]');
    await expect(tlCard).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: ss('03-tl-block-added.png'), fullPage: true });

    // TLバッジ確認
    await expect(tlCard.locator('.block-type')).toHaveText('TL');

    // duration 表示確認（デフォルト5秒）
    await expect(tlCard).toContainText('0:05.000');

    // ===== 3. ラベル入力 =====
    const labelInput = tlCard.locator('input[placeholder="ラベル"]');
    await labelInput.fill('告白シーン');
    await expect(labelInput).toHaveValue('告白シーン');
    await page.screenshot({ path: ss('04-label-entered.png') });

    // ===== 4. ブロック選択 → サイドバーにプロパティ表示 =====
    await tlCard.click();

    const sidebar = page.locator('.editor-sidebar-right');
    await expect(sidebar.locator('text=ラベル')).toBeVisible({ timeout: 3000 });
    await expect(sidebar.locator('text=Duration')).toBeVisible();
    await expect(sidebar.getByText(/^トラック \(\d+\)$/)).toBeVisible();
    await page.screenshot({ path: ss('05-sidebar-props.png'), fullPage: true });

    // ===== 5. タイムラインパネルが自動で開く =====
    const timelinePanel = page.locator('.timeline-panel');
    await expect(timelinePanel).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: ss('06-timeline-panel-auto-open.png'), fullPage: true });

    // ===== 6. サイドバーから duration を変更 =====
    const durationInput = sidebar.locator('input[type="number"][min="100"]');
    await durationInput.fill('8000');
    // ブロックカードに反映される
    await expect(tlCard).toContainText('0:08.000');
    await page.screenshot({ path: ss('07-duration-changed.png') });

    // ===== 7. テキストブロックも追加して共存確認 =====
    await page.click('.add-block-btn');
    await page.waitForSelector('.bottom-sheet', { timeout: 3000 });
    await page.locator('.bottom-sheet button:has-text("テキスト")').click();
    await expect(page.locator('[data-block-id^="text-"]')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: ss('08-mixed-blocks.png'), fullPage: true });

    // 合計ブロック数: start + TL + text = 3
    const blockCards = page.locator('.block-card');
    await expect(blockCards).toHaveCount(3);

    // ===== 8. TLブロックを削除 =====
    // TLカードの削除ボタン
    await tlCard.locator('button:has-text("削除")').click();
    const confirmBtn = page.locator('button:has-text("削除する")');
    await expect(confirmBtn).toBeVisible({ timeout: 2000 });
    await page.screenshot({ path: ss('09-delete-confirm.png') });
    await confirmBtn.click();

    // TLブロックが消えている
    await expect(tlCard).not.toBeVisible({ timeout: 3000 });
    // start + text = 2
    await expect(blockCards).toHaveCount(2);
    await page.screenshot({ path: ss('10-after-delete.png'), fullPage: true });
  });

  test('モバイル表示でTLブロックがコンパクト表示される', async ({ page }) => {
    await page.addInitScript(
      ({ t, u }: { t: string; u: string }) => {
        localStorage.setItem('authToken', t);
        localStorage.setItem('currentUserId', u);
      },
      { t: token, u: userId },
    );

    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.block-list', { timeout: 15000 });
    await page.screenshot({ path: ss('11-mobile-editor.png'), fullPage: true });

    // FABメニューを開く
    const fab = page.locator('button[aria-label="ブロック追加メニューを開く"]');
    await expect(fab).toBeVisible();
    await fab.click();

    // 演出TLが表示される
    const tlFabItem = page.locator('button[aria-label="演出TLブロックを追加"]');
    await expect(tlFabItem).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: ss('12-mobile-fab-menu.png') });

    // TLブロック追加
    await tlFabItem.click();

    const tlCard = page.locator('[data-block-id^="timeline-"]');
    await expect(tlCard).toBeVisible({ timeout: 5000 });

    // コンパクト表示: TLバッジがある
    await expect(tlCard.locator('.block-type')).toHaveText('TL');

    // ミニタイムラインは非表示（モバイル）
    await expect(tlCard.locator('.timeline-block-mini')).not.toBeVisible();

    await page.screenshot({ path: ss('13-mobile-tl-compact.png'), fullPage: true });
  });
});
