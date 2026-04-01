import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { URLS } from './fixtures/urls';

function getScreenshotPath(filename: string): string {
  const dir = path.join('screenshots', '2026-02-20-timeline');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, filename);
}

const EDITOR_URL = `${URLS.EDITOR}/projects/editor/test-timeline`;

test.describe('タイムラインパネル', () => {
  test.beforeEach(async ({ page }) => {
    // localStorage にトークンをセット（キー名は api.ts の TOKEN_KEY = 'authToken'）
    await page.addInitScript(() => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('currentUserId', 'test-user');
    });

    // API をモックしてプロジェクトデータを返す
    await page.route('**/api/projects/*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          project: {
            id: 'test-timeline',
            title: 'Timeline Test Project',
            data: {
              pages: [{ id: 'page1', name: 'Page 1', blocks: [{ id: 'start-1', type: 'start' }] }],
              assets: [],
            },
            characters: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        }),
      })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(EDITOR_URL, { waitUntil: 'networkidle' });

    // エディタのロード完了を待機
    await page.waitForSelector('.editor-layout', { timeout: 10000 });
  });

  test('ヘッダーにTLボタンが表示される', async ({ page }) => {
    const tlButton = page.locator('button[aria-label="タイムラインパネル"]');
    await expect(tlButton).toBeVisible();
    await expect(tlButton).toHaveText('TL');
    await page.screenshot({ path: getScreenshotPath('tl-01-header-button.png') });
  });

  test('TLボタンクリックでタイムラインパネルが開閉する', async ({ page }) => {
    const tlButton = page.locator('button[aria-label="タイムラインパネル"]');

    // 初期状態: タイムラインは非表示
    await expect(page.locator('.timeline-panel')).not.toBeVisible();

    // クリック → タイムラインパネルが表示
    await tlButton.click();
    await expect(page.locator('.timeline-panel')).toBeVisible();
    await page.screenshot({ path: getScreenshotPath('tl-02-panel-open.png') });

    // TLボタンがアクティブ色（紫）になっている
    await expect(tlButton).toHaveClass(/bg-purple-600/);

    // もう一度クリック → タイムラインパネルが非表示
    await tlButton.click();
    await expect(page.locator('.timeline-panel')).not.toBeVisible();

    // TLボタンが非アクティブ色に戻る
    await expect(tlButton).not.toHaveClass(/bg-purple-600/);
    await page.screenshot({ path: getScreenshotPath('tl-03-panel-closed.png') });
  });

  test('タイムラインパネルにツールバーが表示される', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    // ツールバーの各要素を確認
    const toolbar = page.locator('.timeline-toolbar');
    await expect(toolbar).toBeVisible();

    // 再生/停止ボタン
    const playBtn = toolbar.locator('button[title="再生"]');
    await expect(playBtn).toBeVisible();

    // 先頭ボタン
    const seekBtn = toolbar.locator('button[title="先頭へ"]');
    await expect(seekBtn).toBeVisible();

    // 時間表示
    const timeDisplay = toolbar.locator('.timeline-time-display');
    await expect(timeDisplay).toBeVisible();
    await expect(timeDisplay).toContainText('/');

    // ズームボタン
    const zoomIn = toolbar.locator('button[title="ズームイン"]');
    const zoomOut = toolbar.locator('button[title="ズームアウト"]');
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    await page.screenshot({ path: getScreenshotPath('tl-04-toolbar.png') });
  });

  test('サンプルタイムラインのトラックが表示される', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    // サンプルデータの読み込みを待機
    await page.waitForSelector('.timeline-track-label', { timeout: 5000 });

    // 4つのトラックラベルが表示される
    const trackLabels = page.locator('.timeline-track-label');
    await expect(trackLabels).toHaveCount(4);

    // トラック名の確認（order 順: bg-main=10, villain=49, hero=50, camera=100）
    const trackNames = page.locator('.timeline-track-name');
    await expect(trackNames.nth(0)).toContainText('bg-main');
    await expect(trackNames.nth(1)).toContainText('villain');
    await expect(trackNames.nth(2)).toContainText('hero');
    await expect(trackNames.nth(3)).toContainText('camera');

    await page.screenshot({ path: getScreenshotPath('tl-05-tracks.png') });
  });

  test('react-timeline-editor が描画される', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    // サンプルデータの読み込みを待機
    await page.waitForSelector('.timeline-track-label', { timeout: 5000 });

    // react-timeline-editor のコンテナが存在
    const editorWrapper = page.locator('.timeline-editor-wrapper');
    await expect(editorWrapper).toBeVisible();

    // timeline-editor 本体が描画されている
    const timelineEditor = page.locator('.timeline-editor');
    await expect(timelineEditor).toBeVisible();

    // クリップ（action）が表示されている
    const actions = page.locator('.timeline-editor-action');
    const actionCount = await actions.count();
    expect(actionCount).toBeGreaterThan(0);

    await page.screenshot({ path: getScreenshotPath('tl-06-editor-rendered.png') });
  });

  test('3カラムレイアウトがタイムライン表示時も正常', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    // 3カラムレイアウトが崩れていない
    const layout = page.locator('.editor-layout');
    await expect(layout).toBeVisible();

    // 左サイドバー
    await expect(page.locator('.editor-sidebar-left')).toBeVisible();
    // 中央
    await expect(page.locator('.editor-center')).toBeVisible();
    // 右サイドバー
    await expect(page.locator('.editor-sidebar-right')).toBeVisible();

    // リサイズハンドルが存在
    await expect(page.locator('.timeline-resize-handle')).toBeVisible();

    await page.screenshot({ path: getScreenshotPath('tl-07-layout-with-timeline.png') });
  });

  test('リサイズハンドルでタイムライン高さが変わる', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    const panel = page.locator('.timeline-panel');
    const initialHeight = await panel.evaluate((el) => el.getBoundingClientRect().height);

    // リサイズハンドルを上にドラッグ
    const handle = page.locator('.timeline-resize-handle');
    const handleBox = await handle.boundingBox();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 100);
      await page.mouse.up();
    }

    const newHeight = await panel.evaluate((el) => el.getBoundingClientRect().height);
    expect(newHeight).toBeGreaterThan(initialHeight);

    await page.screenshot({ path: getScreenshotPath('tl-08-resized.png') });
  });

  test('ズームボタンでスケールが変わる', async ({ page }) => {
    // タイムラインを開く
    await page.locator('button[aria-label="タイムラインパネル"]').click();
    await expect(page.locator('.timeline-panel')).toBeVisible();

    // 初期ズームレベル
    const zoomLabel = page.locator('.timeline-zoom-label');
    await expect(zoomLabel).toContainText('x1.0');

    // ズームイン
    await page.locator('button[title="ズームイン"]').click();
    await expect(zoomLabel).toContainText('x0.5');

    // ズームアウト2回で元より大きく
    await page.locator('button[title="ズームアウト"]').click();
    await page.locator('button[title="ズームアウト"]').click();
    await expect(zoomLabel).toContainText('x2.0');

    await page.screenshot({ path: getScreenshotPath('tl-09-zoomed.png') });
  });
});
