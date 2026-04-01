/**
 * テンプレート: API モックテスト（パターンB）
 *
 * 使い方:
 * 1. このファイルを tests/ にコピーしてリネーム
 * 2. SS_DIR, モックデータ, テスト内容を書き換え
 * 3. エディタ起動: ./scripts/dev-start.sh editor
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

// ===== モックデータ =====
const MOCK_PROJECT = {
  project: {
    id: 'test-project',
    title: 'テストプロジェクト', // ← 変更
    data: {
      pages: [
        {
          id: 'page1',
          name: 'Page 1',
          blocks: [{ id: 'start-1', type: 'start' }],
        },
      ],
      assets: [],
    },
    characters: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

const EDITOR_URL = `${URLS.EDITOR}/projects/editor/${MOCK_PROJECT.project.id}`;

// ===== テスト =====
test.describe('テスト名を変更', () => { // ← 変更
  test.beforeEach(async ({ page }) => {
    // 認証状態セット
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('currentUserId', 'test-user');
    });

    // API モック
    await page.route('**/api/projects/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PROJECT),
      })
    );

    // 保存 API モック（PUT）
    await page.route('**/api/projects/*/data', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({ status: 200, body: '{"ok":true}' });
      } else {
        route.continue();
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(EDITOR_URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('.editor-layout', { timeout: 10000 });
  });

  test('基本的なUI表示', async ({ page }) => { // ← 変更
    await page.screenshot({ path: ss('01-loaded.png') });

    // ===== ここにテスト内容を書く =====

  });
});
