# E2E テスト整理・品質改善 報告書

- **日時**: 2026-02-19
- **対象ディレクトリ**: `tests/`
- **作業内容**: Batch 2（アンチパターン修正）、Batch 3（URL一元化）、Batch 4（テスト整理）

## サマリ

| 項目 | Before | After | 変化 |
|------|--------|-------|------|
| テストファイル数 | 33 | 11 | **-22 (-67%)** |
| `waitForTimeout` 使用数 | 24 | 0 | **全廃** |
| `.catch(() => false)` 使用数 | 6 | 0 | **全廃** |
| `if (*.isVisible())` ガード | 5 | 0 | **全廃** |
| ハードコード localhost (テスト内) | 21+ | 0 | **全廃** |

---

## Batch 4: テスト整理（不要テスト削除・統合）

### 削除したファイル（19ファイル）

診断スクリプト・デバッグ用・重複テストを削除。すべて `azure-full-flow.spec.ts` や `auth-flow.spec.ts` 等の正式テストでカバー済み。

| # | ファイル | 削除理由 |
|---|---------|---------|
| 1 | `debug-404.spec.ts` | 1回限りのデバッグスクリプト。`comprehensive-nav.spec.ts` でカバー済み |
| 2 | `check-browser.spec.ts` | ブラウザ状態チェック用。`auth-flow.spec.ts` でカバー済み |
| 3 | `console-check.spec.ts` | コンソールエラー確認用。`comprehensive-nav.spec.ts` でカバー済み |
| 4 | `simple-redirect.spec.ts` | リダイレクト確認のみ。`auth-flow.spec.ts` と完全重複 |
| 5 | `editor-link-test.spec.ts` | 認証なしのエディタリンクテスト。`local-auth.spec.ts` に統合 |
| 6 | `editor-navigation-trace.spec.ts` | `editor-link-authenticated.spec.ts` とほぼ同一 |
| 7 | `real-login-test.spec.ts` | ハードコード認証情報のデバッグスクリプト |
| 8 | `editor-auth-diagnostic.spec.ts` | `if/else` 分岐で絶対に失敗しない偽グリーンテスト |
| 9 | `preview-direct.spec.ts` | `waitForTimeout` + 401エラー握りつぶし。`azure-full-flow.spec.ts` でカバー済み |
| 10 | `preview.spec.ts` | `test.skip()` 使用。`azure-full-flow.spec.ts` でカバー済み |
| 11 | `email-verification-azure.spec.ts` | `test.skip()` + ハードコード実メールアドレス |
| 12 | `example.spec.ts` | ボイラープレート。意味のあるアサーションなし |
| 13 | `mypage-bug-check.spec.ts` | デバッグ調査スクリプト。`mypage.spec.ts` に統合 |
| 14 | `mypage-logged-in.spec.ts` | `mypage-tabs.spec.ts` のサブセット |
| 15 | `azure-navigation.spec.ts` | `azure-full-flow.spec.ts` で完全カバー済み |
| 16 | `azure-full-test.spec.ts` | `azure-full-flow.spec.ts` で完全カバー済み |
| 17 | `mypage-tabs.spec.ts` | → `mypage.spec.ts` に統合 |
| 18 | `quick-actions.spec.ts` | → `mypage.spec.ts` に統合 |
| 19 | `quick-actions-tabs.spec.ts` | → `mypage.spec.ts` に統合 |

### 統合したファイル（3グループ）

#### グループ A: マイページテスト → `mypage.spec.ts`

| 統合元 | テスト数 |
|--------|---------|
| `mypage-tabs.spec.ts` | 4 |
| `quick-actions.spec.ts` | 4 |
| `quick-actions-tabs.spec.ts` | 4 |
| **合計** | **12テスト → 1ファイル** |

構成:
- `タブナビゲーション` (4テスト): ダッシュボード・作品管理・素材管理・プロフィール
- `クイックアクション` (4テスト): 作品管理・みんなの作品・つくり方・お気に入り
- `クイックアクション → タブ切り替え` (4テスト): ボタンクリックでタブ切り替え

#### グループ B: モバイルUIテスト → `editor-mobile.spec.ts`

| 統合元 | テスト数 |
|--------|---------|
| `editor-mobile.spec.ts` (旧) | 6 |
| `mobile-phase-a.spec.ts` | 3 |
| `mobile-phase-b.spec.ts` | 3 |
| **合計** | **12テスト → 1ファイル** |

構成:
- `基本レイアウト` (6テスト): ホーム画面・ボタン表示・一覧画面・エディタ画面・ブロック追加UI・タッチターゲットサイズ
- `Phase A: ボトムシート・トースト・キーボード` (3テスト)
- `Phase B: FABメニュー・スティッキーヘッダー` (3テスト)

改善点: 旧ファイルの `waitForTimeout(200-500ms)` を全廃し `await expect()` に置換

#### グループ C: ローカル認証テスト → `local-auth.spec.ts`

| 統合元 | テスト数 |
|--------|---------|
| `local-login-test.spec.ts` | 3 |
| `editor-link-authenticated.spec.ts` | 1 |
| `integration-flow.spec.ts` | 2 |
| **合計** | **6テスト → 1ファイル** |

構成:
- `ログインフロー` (3テスト): トップ→ログイン→マイページ、プロテクトページ、ログアウト
- `エディタ連携` (3テスト): 登録→エディタリンク確認、新規登録フロー、エディタ編集・保存

---

## Batch 3: URL 一元化

### 修正ファイル

全テストファイルで `tests/fixtures/urls.ts` の `URLS` 定数を使用するように統一。

#### `admin-panel.spec.ts`

```diff
- const API_URL = 'http://localhost:8080';
- const APP_URL = 'http://localhost:3000';
+ import { URLS } from './fixtures/urls';
+ const API_URL = URLS.API;
+ const APP_URL = URLS.NEXT;
```

#### `integration/frontend-separation.spec.ts`

- **19箇所**の `http://localhost:3000` → `${URLS.NEXT}` に置換
- **2箇所**の `http://localhost:5176` → `${URLS.EDITOR}` に置換
- `localhost:5176` の文字列比較 → `new URL(URLS.EDITOR).host` に変更

### 最終状態

```
$ grep -r 'localhost:\d+' tests/*.spec.ts
tests/admin-panel.spec.ts:48:  'postgresql://...@localhost:5432/kaedevn_dev';
```

唯一の残留は **PostgreSQL 接続文字列**（DB URL のデフォルト値）であり、Web URL ではない。

---

## Batch 2: アンチパターン一括修正

### 修正ルール（MEMORY.md 準拠）

| アンチパターン | 修正方針 |
|--------------|---------|
| `waitForTimeout(N)` | `await expect(locator).toBeVisible()` 等の条件待ちに置換 |
| `.catch(() => false)` | `await expect(locator).not.toBeVisible()` に置換 |
| `if (*.isVisible())` ガード | `await expect(locator).toBeVisible()` + 直接クリックに置換 |
| コメントアウト assertion | 正式な `expect()` に復帰 |

### `azure-full-flow.spec.ts` (16箇所修正)

#### waitForTimeout 修正（7箇所）

| テスト | Before | After |
|--------|--------|-------|
| 16: Editor 認証付きアクセス | `waitForTimeout(5000)` | `waitForLoadState('networkidle')` |
| 19.2: canvas 背景レンダリング | `waitForTimeout(3000)` | `expect('Loading').not.toBeVisible({ timeout: 15000 })` |
| 19.3: canvas ピクセル描画 | `waitForTimeout(5000)` | `expect('Loading').not.toBeVisible({ timeout: 15000 })` |
| 19.4: コンソールエラー確認 | `waitForTimeout(5000)` | `expect('Loading').not.toBeVisible({ timeout: 15000 })` |
| 19.5: Editor ブロック一覧 | `waitForTimeout(3000)` | `waitForLoadState('networkidle')` |
| 19.10: アセット管理パネル | `waitForTimeout(3000)` + `waitForTimeout(1000)` | `waitForLoadState('networkidle')` |
| 19.11: フィルターボタン | `waitForTimeout(3000)` + `waitForTimeout(500)` x4 | `waitForLoadState('networkidle')` |

#### .catch(() => false) 修正（6箇所）

| テスト | Before | After |
|--------|--------|-------|
| 19.2 | `loadingText.isVisible().catch(() => false)` | `await expect(loadingText).not.toBeVisible()` |
| 19.2 | `errorText.isVisible().catch(() => false)` | `await expect(errorText).not.toBeVisible()` |
| 19.2 | `imgErrorText.isVisible().catch(() => false)` | `await expect(imgErrorText).not.toBeVisible()` |
| 19.2 | `waitForEvent(...).catch(() => null)` | 削除（Loading 消失を直接待つ方式に変更） |
| 19.10 | `locator.isVisible().catch(() => false) \|\| ...` | `await expect(name.or(id)).toBeVisible()` |
| 19.11 | `filterAll.isVisible().catch(() => false)` | `await expect(filterAll).toBeVisible()` |

#### if ガード修正（2箇所）

| テスト | Before | After |
|--------|--------|-------|
| 19.10 | `if (await assetTab.isVisible()) { click }` | `await expect(assetTab).toBeVisible(); click` |
| 19.11 | `if (allVisible) { ... } else { console.log }` | `await expect(filterAll).toBeVisible(); ...` |

#### コメントアウト assertion 修正（1箇所）

| テスト | Before | After |
|--------|--------|-------|
| 19.10 | `// expect(hasAsset).toBe(true); // soft check` | `await expect(name.or(id)).toBeVisible()` |

### `editor-blocks.spec.ts` (1箇所修正)

```diff
- // 自動保存の間隔（約3秒）を待つ — タイマー起動のため waitForTimeout を維持
- await page.waitForTimeout(3500);
- const savedOrSaving = page.locator('text=保存済み, text=保存中...').first();
- await expect(savedOrSaving).toBeVisible({ timeout: 5000 });
+ // 自動保存が完了して「保存済み」が表示されることを確認
+ await expect(page.locator('text=保存済み')).toBeVisible({ timeout: 10000 });
```

### `full-flow.spec.ts` (1箇所修正)

```diff
- await page.waitForTimeout(3500); // auto-save interval
+ // 自動保存が完了するまで待つ
+ await expect(page.locator('text=保存済み')).toBeVisible({ timeout: 10000 });
```

---

## 最終ファイル構成

```
tests/
  fixtures/
    urls.ts                            # 共有URL定数（env var対応）
  integration/
    frontend-separation.spec.ts        # フロントエンド分離戦略テスト（URL修正済み）
  admin-panel.spec.ts                  # 管理画面テスト（URL修正済み）
  auth-flow.spec.ts                    # 認証フローテスト（変更なし）
  azure-full-flow.spec.ts              # Azure 完全フローテスト（アンチパターン修正済み）
  comprehensive-nav.spec.ts            # 全ページナビゲーションテスト（変更なし）
  editor-blocks.spec.ts                # エディタブロック機能テスト（waitForTimeout修正済み）
  editor-mobile.spec.ts                # モバイルUIテスト（3ファイル統合・新規作成）
  full-flow.spec.ts                    # 完全ユーザーフローテスト（waitForTimeout修正済み）
  local-auth.spec.ts                   # ローカル認証・エディタ連携テスト（3ファイル統合・新規作成）
  mypage.spec.ts                       # マイページテスト（3ファイル統合・新規作成）
  verify-cookie.spec.ts                # Cookie検証テスト（変更なし）
```

## 品質指標

| 指標 | 結果 |
|------|------|
| `waitForTimeout` | **0件** |
| `.catch(() => false/null)` | **0件** |
| `if (*.isVisible())` 条件ガード | **0件** |
| ハードコード localhost (Web URL) | **0件** |
| `test.skip()` / フォールバック | **0件** (全テストが必ず実行・検証) |
| 全テストファイルが `URLS` fixture 使用 | **Yes** (Azure テスト除く) |

---

## 今後の改善候補（スコープ外）

| 項目 | 詳細 |
|------|------|
| Azure URL の fixture 化 | `azure-full-flow.spec.ts` の4つのハードコード Azure URL を env var 化 |
| アプリソースの URL 一元化 | `apps/next` の3ファイルで散在する `NEXT_PUBLIC_*` 参照を `lib/urls.ts` に集約 |
| `apps/hono/src/routes/auth.ts` | `BASE_URL` の3回重複参照をファイルレベル定数に抽出 |
| root の `test-mobile-ui.spec.ts` | 間違ったポート(5173)を使用。`tests/` に移動して `URLS` fixture を使用 |
| テストタグ付け | 認証が必要なテストに `@auth` タグを付与し、CI で分離実行 |
