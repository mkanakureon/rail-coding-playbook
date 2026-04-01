---
name: playwright-test
description: Playwright を使用したブラウザ E2E テストの作成・実行・分析を行う。新規テスト作成のガイド、カテゴリ別のサンプルコード、実サーバー/モックの切り替え基準を提供する。
---

# Playwright E2E Test Skill

Playwright を使用したブラウザ E2E テストの作成・実行・分析を行う。

## 重要ルール（Gemini CLI 向け）

**新規テスト作成時や既存テストの修正時は、必ず共有ヘルパーを使用する。テストファイル内にアドホックな操作コードを書かない。**

## ヘルパーの場所

```typescript
// 新しいテストを書くときは必ずここから import する
import {
  login,
  createProject,
  openEditor,
  addBlock,
  saveProject,
  runPreview,
  createScreenshotter,
  // その他設定系ヘルパー (selectBgAsset, fillText, fillChoice など)
} from '../block-coverage/press/helpers/editor-actions';
```

## 利用可能なヘルパー一覧

### 認証・プロジェクト
- `login(request)`: ログインしてトークン取得 (`{ token, userId }`)
- `createProject(request, token, title)`: プロジェクト作成 (`projectId`)
- `openEditor(page, token, userId, projectId)`: エディタを開く（認証注入込み）

### ブロック追加と設定
- `addBlock(page, blockType)`: ブロック追加 (`bg`, `ch`, `text`, `set_var`, `choice`, `if`, `effect`, `screen_filter`, `jump`, `battle`, `overlay`, `timeline`, `camera`, `ksc` など)
- **設定系**: 追加したブロックのプロパティを設定する
  - `selectBgAsset(page, assetIndex)`
  - `selectChAsset(page, options?)`
  - `fillText(page, body, speaker?)`
  - `fillSetVar(page, varName, value)`
  - `fillChoice(page, options)`
  - `configureIf(page)`
  - `configureEffect(page, type, options?)`
  - `configureCamera(page, options?)`
  - `configureScreenFilter(page, filterType, intensity?)`
  - `selectOverlayAsset(page, assetIndex)`

### 保存・確認・プレビュー
- `saveProject(page)`: 保存ボタン押下 → トースト確認
- `clickAllBlocks(page, pause, ss?)`: 全ブロックを順番にクリック（プロパティパネル表示確認）
- `runPreview(page, projectId, maxClicks, ss?)`: プレビュー遷移 → シナリオ完走
- `createScreenshotter(dir)`: スクリーンショット撮影関数を生成

## テスト作成手順

1. **基本構造**: ヘルパーを使った標準的なライフサイクルに従う。
2. **新規タブ遷移**: マップエディタなど別タブが必要な場合は、`openEditor` 後に自前でタブ遷移を書く。
3. **新規ヘルパー**: 新しいブロックや操作が必要になったら、**必ず `editor-actions.ts` にヘルパーを追加**し、テストファイルにはインラインで書かないこと。

### マップエディタのテスト例

```typescript
test('マップエディタ: タイル配置 → 保存', async ({ page, request }) => {
  const ss = createScreenshotter('screenshots/map-editor');
  const { token, userId } = await login(request);
  const projectId = await createProject(request, token, `map-test-${Date.now()}`);

  await openEditor(page, token, userId, projectId);

  // マップタブに遷移
  await page.locator('button:has-text("マップ")').click();
  await page.waitForTimeout(1000);

  // ... マップ特有の操作 ...

  await saveProject(page);
});
```

## テスト実行

```bash
# ブロックカバレッジテスト（5分タイムアウト）
npx playwright test {テストファイル} \
  --config=tests/block-coverage/playwright.block-coverage.config.ts

# 録画付き
npx playwright test {テストファイル} \
  --config=tests/block-coverage/playwright.block-coverage-video.config.ts
```

## ベストプラクティスと禁止事項

1. **ヘルパーを追加したらテストにも即適用する** — ヘルパーだけ作ってテスト未修正にしない
2. **`waitForTimeout` を新規追加しない** — `expect().toBeVisible()` や `waitForFunction()` を使う
3. **テスト実行して確認する** — 推測でセレクタを書かない。スクリーンショットで確認
4. **公式アセットがローカル DB にあることを前提にする** — なければ `COPY` コマンドで Azure から同期（手順は `06-e2e-test-improvement-result.md` 参照）
