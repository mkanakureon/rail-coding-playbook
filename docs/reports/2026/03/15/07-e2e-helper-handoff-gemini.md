# 引き継ぎ資料: E2Eテストヘルパーの利用ガイド（Gemini CLI 向け）

> 作成日: 2026-03-15
> 目的: RPGマップ・エディタ関連のE2Eテスト作成時に、既存ヘルパーを活用する

## ヘルパーの場所

```
tests/block-coverage/press/helpers/editor-actions.ts
```

このファイルに全てのエディタ操作ヘルパーが集約されている。**新しいテストを書くときは必ずここから import する。テストファイル内にアドホックな操作コードを書かない。**

## 利用可能なヘルパー一覧

### 認証・プロジェクト

| ヘルパー | 用途 | 戻り値 |
|---------|------|--------|
| `login(request)` | ログインしてトークン取得 | `{ token, userId }` |
| `createProject(request, token, title)` | プロジェクト作成 | `projectId` |
| `openEditor(page, token, userId, projectId)` | エディタを開く（認証注入込み） | — |

### ブロック追加

| ヘルパー | 用途 | 戻り値 |
|---------|------|--------|
| `addBlock(page, blockType)` | ブロック追加（+ ボタン → bottom-sheet → 型選択） | `blockId` |

`blockType` に使える値:
```
bg, ch, text, set_var, choice, if, effect, screen_filter,
jump, battle, overlay, timeline, camera, ksc
```

### ブロック設定（追加後に呼ぶ）

| ヘルパー | ブロック型 | 引数例 |
|---------|-----------|--------|
| `selectBgAsset(page, assetIndex)` | bg | `selectBgAsset(page, 0)` |
| `selectChAsset(page, options?)` | ch | `selectChAsset(page, { characterIndex: 0 })` |
| `fillText(page, body, speaker?)` | text | `fillText(page, 'こんにちは', '勇者')` |
| `fillSetVar(page, varName, value)` | set_var | `fillSetVar(page, 'hp', '100')` |
| `fillChoice(page, options)` | choice | `fillChoice(page, ['はい', 'いいえ'])` |
| `configureIf(page)` | if | `configureIf(page)` |
| `configureEffect(page, type, options?)` | effect | `configureEffect(page, 'shake', { intensity: 3 })` |
| `configureCamera(page, options?)` | camera | `configureCamera(page, { time: 1000 })` |
| `configureScreenFilter(page, filterType, intensity?)` | screen_filter | `configureScreenFilter(page, 'sepia', 0.7)` |
| `selectOverlayAsset(page, assetIndex)` | overlay | `selectOverlayAsset(page, 0)` |

### 保存・確認・プレビュー

| ヘルパー | 用途 |
|---------|------|
| `saveProject(page)` | 保存ボタン → トースト確認 |
| `clickAllBlocks(page, pause, ss?)` | 全ブロックを順番にクリック（プロパティ確認） |
| `runPreview(page, projectId, maxClicks, ss?)` | プレビュー遷移 → シナリオ完走 |
| `createScreenshotter(dir)` | スクリーンショット撮影関数を生成 |

## RPGマップ・エディタでの使い方

### マップエディタのテストを書く場合

マップエディタは通常のブロックエディタとは別タブ（「マップ」タブ）にある。ヘルパーの `login` / `createProject` / `openEditor` はそのまま使えるが、マップタブへの遷移は自分で書く必要がある。

```typescript
import {
  login,
  createProject,
  openEditor,
  saveProject,
  createScreenshotter,
} from '../block-coverage/press/helpers/editor-actions';

test('マップエディタ: タイル配置 → 保存', async ({ page, request }) => {
  const ss = createScreenshotter('screenshots/map-editor');
  const { token, userId } = await login(request);
  const projectId = await createProject(request, token, `map-test-${Date.now()}`);

  await openEditor(page, token, userId, projectId);

  // マップタブに遷移
  await page.locator('button:has-text("マップ")').click();
  await page.waitForTimeout(1000);

  // ... マップ操作 ...

  await saveProject(page);
});
```

### マップ用のヘルパーが必要になったら

`editor-actions.ts` に追加する。テストファイル内にインラインで書かない。

```typescript
// 例: マップ作成ヘルパー
export async function createMap(page: Page, name: string, slug: string) { ... }

// 例: タイル配置ヘルパー
export async function placeTile(page: Page, x: number, y: number, tileIndex: number) { ... }

// 例: イベント設定ヘルパー
export async function configureMapEvent(page: Page, eventType: string) { ... }
```

### RPG戦闘テストを書く場合

battle ブロックは `addBlock(page, 'battle')` で追加できるが、設定ヘルパーはまだない。必要なら `editor-actions.ts` に `configureBattle()` を追加する。

## テスト設定ファイル

```bash
# ブロックカバレッジテスト（5分タイムアウト）
npx playwright test {テストファイル} \
  --config=tests/block-coverage/playwright.block-coverage.config.ts

# 録画付き
npx playwright test {テストファイル} \
  --config=tests/block-coverage/playwright.block-coverage-video.config.ts
```

## テストの書き方テンプレート

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';
import {
  login,
  createProject,
  openEditor,
  addBlock,
  // 必要なヘルパーを import
  saveProject,
  runPreview,
  createScreenshotter,
} from '../block-coverage/press/helpers/editor-actions';
// または相対パスを調整
// } from './helpers/editor-actions';

const SS_DIR = path.resolve('screenshots/{テスト名}');

test.setTimeout(300_000);

test('{テスト名}', async ({ page, request }) => {
  const ss = createScreenshotter(SS_DIR);

  // 1. ログイン＆プロジェクト作成
  const { token, userId } = await login(request);
  const projectId = await createProject(request, token, `{prefix}-${Date.now()}`);

  // 2. エディタを開く
  await openEditor(page, token, userId, projectId);

  // 3. ブロック追加＆設定
  await addBlock(page, 'bg');
  // ... ヘルパーで設定 ...

  // 4. 保存
  await saveProject(page);

  // 5. プレビュー（任意）
  const { completed, clicks } = await runPreview(page, projectId, 40, ss);
  expect(completed).toBe(true);
});
```

## 重要ルール

1. **ヘルパーを追加したらテストにも即適用する** — ヘルパーだけ作ってテスト未修正にしない
2. **`waitForTimeout` を新規追加しない** — `expect().toBeVisible()` や `waitForFunction()` を使う
3. **テスト実行して確認する** — 推測でセレクタを書かない。スクリーンショットで確認
4. **公式アセットがローカル DB にあることを前提にする** — なければ `COPY` コマンドで Azure から同期（手順は `docs/09_reports/2026/03/15/06-e2e-test-improvement-result.md` 参照）

## 既知の問題

| 問題 | 状態 | 備考 |
|------|------|------|
| OVL 公式アセットがない | 未解決 | `selectOverlayAsset()` はアセットなし時キャンセルするフォールバック付き |
| プレビュー完走タイムアウト | 未解決 | 新規プロジェクトの初期ブロックとテスト追加ブロックが合算されクリック数が増える |
| `waitForTimeout` 17箇所 | 未着手 | Phase 2 で条件待ちに置換予定 |
