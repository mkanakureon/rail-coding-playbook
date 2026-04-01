import { test, expect, type Page } from '@playwright/test';
import { URLS } from './fixtures/urls';

const API_URL = URLS.API;
const APP_URL = URLS.NEXT;

/**
 * Helper: Register a user via API and return credentials
 */
async function registerUser(suffix: string) {
  const timestamp = Date.now();
  const email = `admin-test-${suffix}-${timestamp}@example.com`;
  const password = 'Password123';
  const username = `admin_test_${suffix}_${timestamp}`;

  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  return { userId: data.userId, email, password, username };
}

/**
 * Helper: Login and get token
 */
async function loginAPI(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(res.ok).toBe(true);
  const data = await res.json();
  return data.token as string;
}

/**
 * Helper: Set user role to admin via direct DB update
 */
async function setAdminRole(userId: string) {
  const { execSync } = await import('child_process');
  const dbUrl =
    process.env.DATABASE_URL ||
    'postgresql://kaedevn:kaedevn_dev_password@localhost:5432/kaedevn_dev';
  execSync(`psql "${dbUrl}" -c "UPDATE users SET role='admin' WHERE id='${userId}'"`, {
    stdio: 'pipe',
  });
}

/**
 * Helper: Login via browser
 */
async function loginBrowser(page: Page, email: string, password: string) {
  await page.goto(`${APP_URL}/login`);
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(mypage|admin)/);
}

test.describe.configure({ mode: 'serial' });

test.describe('管理画面', () => {
  let adminUser: { userId: string; email: string; password: string; username: string };
  let normalUser: { userId: string; email: string; password: string; username: string };
  let adminToken: string;

  test.beforeAll(async () => {
    // Register admin and normal users
    adminUser = await registerUser('admin');
    normalUser = await registerUser('normal');

    // Set admin role
    await setAdminRole(adminUser.userId);

    // Get admin token
    adminToken = await loginAPI(adminUser.email, adminUser.password);
  });

  test.describe('アクセス制御', () => {
    test('一般ユーザーは管理画面にアクセスできない', async ({ page }) => {
      await loginBrowser(page, normalUser.email, normalUser.password);
      await page.goto(`${APP_URL}/admin`);

      // Should be redirected to mypage
      await page.waitForURL(/\/mypage/);
    });

    test('管理者は管理画面にアクセスできる', async ({ page }) => {
      await loginBrowser(page, adminUser.email, adminUser.password);
      await page.goto(`${APP_URL}/admin`);

      // Should see dashboard
      await expect(page.locator('h1')).toHaveText('ダッシュボード');
    });

    test('未ログインユーザーは管理 API に 401 が返る', async () => {
      const res = await fetch(`${API_URL}/api/admin/stats`);
      expect(res.status).toBe(401);
    });

    test('一般ユーザーは管理 API に 403 が返る', async () => {
      const normalToken = await loginAPI(normalUser.email, normalUser.password);
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${normalToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  test.describe('ダッシュボード', () => {
    test('統計カードが表示される', async ({ page }) => {
      await loginBrowser(page, adminUser.email, adminUser.password);
      await page.goto(`${APP_URL}/admin`);

      await expect(page.locator('h1')).toHaveText('ダッシュボード');

      // Stats cards should be visible
      await expect(page.locator('text=ユーザー数')).toBeVisible();
      await expect(page.locator('text=プロジェクト数')).toBeVisible();
      await expect(page.locator('text=公開作品数')).toBeVisible();
    });

    test('API で統計が取得できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.users).toBe('number');
      expect(typeof data.stats.projects).toBe('number');
      expect(typeof data.stats.works).toBe('number');
      expect(data.stats.users).toBeGreaterThanOrEqual(2); // admin + normal
    });
  });

  test.describe('ユーザー管理', () => {
    test('ユーザー一覧が表示される', async ({ page }) => {
      await loginBrowser(page, adminUser.email, adminUser.password);
      await page.goto(`${APP_URL}/admin/users`);

      await expect(page.locator('h1')).toHaveText('ユーザー管理');

      // Table should have at least 2 rows (admin + normal user)
      const rows = page.locator('table tbody tr');
      await expect(rows.first()).toBeVisible();
    });

    test('API でユーザー一覧が取得できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.users).toBeDefined();
      expect(data.users.length).toBeGreaterThanOrEqual(2);
      expect(data.total).toBeGreaterThanOrEqual(2);

      // Check user fields
      const user = data.users[0];
      expect(user.id).toBeDefined();
      expect(user.username).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.status).toBeDefined();
    });

    test('ユーザー検索ができる', async () => {
      const res = await fetch(
        `${API_URL}/api/admin/users?search=${encodeURIComponent(normalUser.username)}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.users.length).toBeGreaterThanOrEqual(1);
      expect(data.users[0].username).toContain('admin_test_normal');
    });

    test('ユーザー詳細が取得できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/users/${normalUser.userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.user.id).toBe(normalUser.userId);
      expect(data.user.username).toBe(normalUser.username);
      expect(typeof data.user.projectCount).toBe('number');
      expect(typeof data.user.workCount).toBe('number');
    });

    test('ユーザーの停止・復帰ができる', async () => {
      // Suspend
      let res = await fetch(`${API_URL}/api/admin/users/${normalUser.userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'suspended' }),
      });
      expect(res.ok).toBe(true);

      // Verify suspended
      res = await fetch(`${API_URL}/api/admin/users/${normalUser.userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const suspended = await res.json();
      expect(suspended.user.status).toBe('suspended');

      // Reactivate
      res = await fetch(`${API_URL}/api/admin/users/${normalUser.userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'active' }),
      });
      expect(res.ok).toBe(true);

      // Verify active
      res = await fetch(`${API_URL}/api/admin/users/${normalUser.userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const active = await res.json();
      expect(active.user.status).toBe('active');
    });

    test('自分自身は停止できない', async () => {
      const res = await fetch(`${API_URL}/api/admin/users/${adminUser.userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'suspended' }),
      });
      expect(res.status).toBe(400);
    });
  });

  test.describe('メッセージ', () => {
    test('管理者がユーザーにメッセージを送信できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          toUserId: normalUser.userId,
          subject: 'テストメッセージ',
          body: 'これはテストメッセージです。',
        }),
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.messageId).toBeDefined();
    });

    test('管理者が送信済みメッセージを確認できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/messages`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.messages.length).toBeGreaterThanOrEqual(1);

      const msg = data.messages.find((m: any) => m.subject === 'テストメッセージ');
      expect(msg).toBeDefined();
      expect(msg.toUser.id).toBe(normalUser.userId);
    });

    test('ユーザーが受信メッセージを確認できる', async () => {
      const normalToken = await loginAPI(normalUser.email, normalUser.password);

      // Get unread count
      let res = await fetch(`${API_URL}/api/messages/unread`, {
        headers: { Authorization: `Bearer ${normalToken}` },
      });
      expect(res.ok).toBe(true);
      const unread = await res.json();
      expect(unread.unreadCount).toBeGreaterThanOrEqual(1);

      // Get messages
      res = await fetch(`${API_URL}/api/messages`, {
        headers: { Authorization: `Bearer ${normalToken}` },
      });
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.messages.length).toBeGreaterThanOrEqual(1);

      // Read specific message
      const msg = data.messages[0];
      res = await fetch(`${API_URL}/api/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${normalToken}` },
      });
      expect(res.ok).toBe(true);
      const detail = await res.json();
      expect(detail.message.isRead).toBe(true);
    });
  });

  test.describe('アセット管理', () => {
    test('API でアセット一覧が取得できる', async () => {
      const res = await fetch(`${API_URL}/api/admin/assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.ok).toBe(true);

      const data = await res.json();
      expect(data.assets).toBeDefined();
      expect(typeof data.total).toBe('number');
    });
  });

  test.describe('サイドバーナビゲーション', () => {
    test('サイドバーの各リンクが正しく遷移する', async ({ page }) => {
      await loginBrowser(page, adminUser.email, adminUser.password);
      await page.goto(`${APP_URL}/admin`);

      // Navigate to users
      await page.click('text=ユーザー管理');
      await expect(page.locator('h1')).toHaveText('ユーザー管理');

      // Navigate to assets
      await page.click('text=アセット管理');
      await expect(page.locator('h1')).toHaveText('アセット管理');

      // Navigate to messages (sidebar link, not header)
      await page.locator('aside').getByText('メッセージ').click();
      await expect(page.locator('main h1')).toHaveText('メッセージ管理');

      // Navigate to dummy pages
      await page.click('text=作品管理');
      await expect(page.locator('h1')).toHaveText('作品管理');
      await expect(page.locator('text=準備中')).toBeVisible();
    });
  });
});
