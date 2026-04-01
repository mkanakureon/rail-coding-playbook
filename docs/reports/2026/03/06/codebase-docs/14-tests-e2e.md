# tests/ - E2E テスト

## 概要

Playwright による E2E テスト群。48 テストファイル (約 9,500 行) で、エディタ、認証、プレビュー、バトル、タイムライン、アセット管理、ゲストモード、管理画面をカバーする。ローカル環境と Azure 環境の両方に対応。

## ディレクトリ構成

```
tests/
├── fixtures/
│   └── urls.ts                     # 環境別 URL 定義 (URLS.NEXT, URLS.EDITOR, URLS.API, URLS.PREVIEW)
├── *.spec.ts                       # 48 テストファイル
e2e/
└── ksc-demo.spec.ts                # KSC デモ包括テスト (4,396行)
```

## Playwright 設定ファイル

| ファイル | テスト対象 | baseURL | 用途 |
|---------|----------|---------|------|
| playwright.config.ts | e2e/ | localhost:5175 | KSC デモテスト |
| playwright.local.config.ts | tests/ | localhost:3000 | ローカル E2E |
| playwright.azure.config.ts | tests/ | Azure Next.js URL | Azure E2E |
| playwright.azure-auth.config.ts | tests/ | Azure Next.js URL | Azure 認証テスト |
| playwright.demo.config.ts | — | — | デモモード |
| playwright.check.config.ts | — | — | UI 検証 |

## テスト一覧

### 認証テスト (3 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| auth-flow.spec.ts | 105 | ログイン/ログアウトフロー |
| auth-redirect.spec.ts | 396 | OAuth フロー、リダイレクトチェーン、セッション持続 |
| local-auth.spec.ts | 167 | ローカル dev server 認証 |

### エディタテスト (8 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| editor-blocks.spec.ts | 117 | ブロック CRUD |
| editor-mobile.spec.ts | 256 | モバイルビューポート (375x667) |
| asset-selection.spec.ts | 166 | キャラクター/背景選択モーダル |
| asset-management.spec.ts | 307 | キャラクター/BG 管理、ファンタジーアセット |
| comprehensive-nav.spec.ts | 125 | サイドバー、パンくずナビゲーション |
| ks-editor-sync.spec.ts | 248 | KS スクリプト ↔ ビジュアルエディタ双方向同期 |
| ksc-block.spec.ts | 213 | KSC ブロックエディタ |
| screen-filter-block.spec.ts | 97 | スクリーンフィルターエフェクト |

### タイムラインテスト (5 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| timeline-block.spec.ts | 333 | タイムラインブロック追加/削除/移動 |
| timeline-block-real.spec.ts | 230 | 実 API 接続タイムライン |
| timeline-panel.spec.ts | 225 | タイムラインパネル UI (再生/一時停止/シーク) |
| timeline-props-seek.spec.ts | 365 | プロパティ補間、キーフレームシーク |
| tl-kf-diamond.spec.ts | 277 | キーフレームドラッグ&ドロップ |

### バトルテスト (2 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| battle-block.spec.ts | 212 | バトルブロックエディタ |
| battle-play.spec.ts | 186 | バトルシーン再生 |

### ゲストモードテスト (6 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| guest-fantasy-assets.spec.ts | 280 | ゲスト + ファンタジーアセット |
| guest-restore-priority.spec.ts | 215 | ゲストデータ復元優先順位 |
| guest-direct-url.spec.ts | — | ダイレクト URL アクセス |
| guest-session.spec.ts | — | セッション管理 |
| guest-multi-session.spec.ts | — | マルチセッション |
| guest-upgrade.spec.ts | — | ゲスト → 登録アップグレード |

### 管理画面テスト (2 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| admin-panel.spec.ts | 352 | 公式アセット管理 CRUD、インポート |
| admin-official-assets.spec.ts | 271 | 公式アセットカタログ |

### Azure テスト (4 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| azure-full-flow.spec.ts | 891 | 全フロー: サインアップ→ログイン→エディタ→プレビュー (serial) |
| azure-create-and-play.spec.ts | 435 | API 駆動プロジェクト作成、プレビュー検証 |
| azure-ks-editor.spec.ts | 123 | Azure 上の KSC エディタ |
| check-azure-editor.spec.ts | 133 | Editor SPA fallback, CORS チェック |

### KSC エディタテスト (2 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| ksc-editor.spec.ts | 217 | Monaco エディタ、ファイルツリー、プレビュー |
| ksc-inline-commands.spec.ts | 314 | インラインコマンド解析 (@l, @c, @r, @lc) |

### その他テスト

| ファイル | 行数 | 内容 |
|---------|------|------|
| full-flow.spec.ts | 75 | 基本スモークテスト |
| mypage.spec.ts | 91 | マイプロジェクト一覧 |
| ovl-preview.spec.ts | 136 | オーバーレイレンダリング |
| test-import.spec.ts | 87 | モジュールインポート検証 |
| docs-verify.spec.ts | 68 | ドキュメントリンク有効性 |
| verify-cookie.spec.ts | 35 | セッション/認証クッキー |
| visual-logic-verify.spec.ts | 25 | スクリーンショット比較スタブ |
| admin-official-assets-check.spec.ts | 85 | 公式アセット API ヘルスチェック |

### KSC デモ包括テスト (e2e/)

| ファイル | 行数 | 内容 |
|---------|------|------|
| ksc-demo.spec.ts | 4,396 | KSC デモ全機能テスト: 背景、キャラ、選択肢、変数、デバッグモード |

## 共通パターン

### URL 定義

```typescript
import { URLS } from './fixtures/urls';
// URLS.NEXT    = http://localhost:3000
// URLS.EDITOR  = http://localhost:5176
// URLS.API     = http://localhost:8080
// URLS.PREVIEW = http://localhost:5175
```

### ログインヘルパー

```typescript
async function login(page: Page) {
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  const { token, user } = await res.json();
  await page.addInitScript(({ token, userId }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUserId', userId);
  }, { token, userId: user.id });
  return { token, userId: user.id };
}
```

### スクリーンショットヘルパー

```typescript
const SS_DIR = path.join('screenshots', 'YYYY-MM-DD-テスト名');
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}
```

## テストルール

- `expect` で期待する状態を 1 つだけ明示する
- `if` で `expect` をスキップしない
- `waitForTimeout` でごまかさない（正しいセレクタ/条件を待つ）
- 失敗したら原因を調査してコードを修正する

## テスト実行

```bash
# ローカル E2E
npx playwright test tests/editor-blocks.spec.ts

# Azure E2E
npx playwright test --config=playwright.azure.config.ts

# Azure 認証テスト
npx playwright test --config=playwright.azure-auth.config.ts

# KSC デモテスト
npx playwright test e2e/ksc-demo.spec.ts
```

## テスト結果 (2026-03-05 安定確認済み)

| Phase | テスト数 | 所要時間 |
|-------|---------|---------|
| E2E (Azure full-flow) | 55 | ~2分 |
| Auth (Azure) | 34 | ~55秒 |
| KSC Demo (e2e/) | 多数 | ~3分 |
| **合計** | **100+** | **~6分** |
