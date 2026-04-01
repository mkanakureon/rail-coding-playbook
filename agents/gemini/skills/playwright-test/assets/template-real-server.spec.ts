/**
 * テンプレート: 実サーバー接続テスト（パターンA）
 *
 * 使い方:
 * 1. このファイルを tests/ にコピーしてリネーム
 * 2. SS_DIR, テスト名, テスト内容を書き換え
 * 3. サーバー起動: ./scripts/dev-start.sh all
 * 4. 実行: npx playwright test tests/{ファイル名}.spec.ts
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

// ===== スクリーンショット =====
const SS_DIR = path.join('screenshots', 'YYYY-MM-DD-テスト名'); // ← 変更
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}

// ===== ログイン =====
async function login(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
  const { token, user } = await res.json();

  await page.addInitScript(
    ({ token, userId }: { token: string; userId: string }) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUserId', userId);
    },
    { token, userId: user.id },
  );

  return { token, userId: user.id };
}

// ===== プロジェクト作成/削除 =====
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

async function deleteProject(
  page: import('@playwright/test').Page,
  token: string,
  projectId: string,
) {
  await page.request.delete(`${URLS.API}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ===== テスト =====
test.describe('テスト名を変更', () => { // ← 変更
  let token: string;
  let userId: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const creds = await login(page);
    token = creds.token;
    userId = creds.userId;

    projectId = await createProject(page, token, 'テスト用プロジェクト'); // ← 変更
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (projectId && token) {
      const page = await browser.newPage();
      await deleteProject(page, token, projectId);
      await page.close();
    }
  });

  test('デスクトップでの基本操作', async ({ page }) => { // ← 変更
    test.setTimeout(60000);

    // ログイン状態セット
    await page.addInitScript(
      ({ t, u }: { t: string; u: string }) => {
        localStorage.setItem('authToken', t);
        localStorage.setItem('currentUserId', u);
      },
      { t: token, u: userId },
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.editor-layout', { timeout: 15000 });
    await page.screenshot({ path: ss('01-editor-loaded.png'), fullPage: true });

    // ===== ここにテスト内容を書く =====

  });

  test('モバイルでの基本操作', async ({ page }) => { // ← 変更
    await page.addInitScript(
      ({ t, u }: { t: string; u: string }) => {
        localStorage.setItem('authToken', t);
        localStorage.setItem('currentUserId', u);
      },
      { t: token, u: userId },
    );

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.block-list', { timeout: 15000 });
    await page.screenshot({ path: ss('10-mobile-loaded.png'), fullPage: true });

    // ===== ここにテスト内容を書く =====

  });
});
