# 全15ブロック型テスト計画書

**作成日**: 2026-03-13
**更新日**: 2026-03-23（filter_mix 追加、テストスイート整理）
**目的**: 全ブロック型の保存・コンパイル・描画を3段階で網羅的にテストする
**テストフォルダ**: `tests/block-coverage/`（独立ディレクトリ、後からフェーズ追加可能）

---

## ディレクトリ構成

```
tests/block-coverage/
├── README.md                          # テスト概要・実行方法
├── playwright.block-coverage.config.ts # 専用 Playwright config
├── fixtures/
│   ├── all-blocks-project.json        # 全14ブロック型を含むプロジェクトJSON
│   └── helpers.ts                     # 共通ユーティリティ（login, createProject 等）
├── phase1-api/
│   └── api-save-load.spec.ts          # Phase 1: API 保存・読込テスト
├── phase2-compiler/
│   └── blocks-to-ksc.test.ts          # Phase 2: コンパイラ変換テスト（Vitest）
└── phase3-browser/
    └── preview-playback.spec.ts       # Phase 3: ブラウザ再生テスト
```

---

## 対象ブロック型（全14種）

| # | type | 必須プロパティ | テスト観点 |
|---|------|-------------|----------|
| 1 | `start` | — | ページ先頭に存在すること |
| 2 | `bg` | `assetId` | 背景画像の表示 |
| 3 | `ch` | `characterId`, `expressionId`, `pos`, `visible` | キャラ表示・位置・表情 |
| 4 | `text` | `body` | テキスト表示、speaker あり/なし |
| 5 | `choice` | `options[]` (各: `id`, `text`, `actions[]`) | 選択肢の表示・アクション実行 |
| 6 | `if` | `conditions[]`, `thenBlocks[]` | 条件分岐（then/else） |
| 7 | `set_var` | `varName`, `operator`, `value` | 変数代入（=, +=, -=） |
| 8 | `effect` | `effect` | エフェクト8種（shake, flash 等） |
| 9 | `screen_filter` | `filterType` | フィルタ43種 + クリア |
| 9b | `filter_mix` | `layers[]` | フィルタ重ね掛け（2〜4層）+ 制約バリデーション |
| 10 | `timeline` | `label`, `timeline` | タイムライン再生 |
| 11 | `battle` | `troopId`, `onWinPageId`, `onLosePageId` | バトル開始・ページ遷移 |
| 12 | `overlay` | `assetId`, `visible` | オーバーレイ表示/非表示 |
| 13 | `camera` | (全 optional: `x`,`y`,`zoom`,`time`,`easing`,`shake`,`reset`) | カメラ移動・リセット |
| 14 | `jump` | `toPageId` | ページジャンプ |
| 15 | `ksc` | `script` | 生スクリプト実行 |

> **注**: `start` は自動生成されるため実質テスト対象は14型（start含めて15エントリだがスキーマ上は14ブロック型）。

---

## Phase 1: API 保存・読込テスト

**ツール**: Playwright (`page.request`)
**対象**: `PUT /api/projects/:id` → `GET /api/projects/:id`
**ファイル**: `tests/block-coverage/phase1-api/api-save-load.spec.ts`

### テスト内容

1. **プロジェクト作成** — `POST /api/projects` でテスト用プロジェクト作成
2. **全ブロック保存** — `fixtures/all-blocks-project.json` のデータを `PUT /api/projects/:id` で保存
3. **読み戻し検証** — `GET /api/projects/:id` で取得し、全ブロックが正しく保存されたか検証

### 検証項目（ブロックごと）

| 検証 | 内容 |
|------|------|
| 型一致 | `block.type` が正しいこと |
| プロパティ保持 | 各ブロック固有プロパティが保存・復元されること |
| ネスト構造 | `if.thenBlocks` / `if.elseBlocks` / `choice.options[].actions[]` が再帰的に保持 |
| ID 一意性 | 全ブロック ID が重複しないこと |

### テスト数（想定）

- 1 テストスイート × 約 16 テストケース
  - プロジェクト作成: 1
  - ブロック型ごとの保存・復元: 14
  - 全体整合性チェック: 1

---

## Phase 2: コンパイラ変換テスト

**ツール**: Vitest（`npm test -w @kaedevn/compiler` と同等）
**対象**: ブロック → KSC スクリプト → Op 配列
**ファイル**: `tests/block-coverage/phase2-compiler/blocks-to-ksc.test.ts`

### テスト内容

1. **ブロック → KSC 変換** — `ksConverter.ts` の `blocksToKs()` で各ブロックが正しい KSC コマンドに変換されるか
2. **KSC → Op 変換** — コンパイラの `compile()` で正しい Op 配列が生成されるか
3. **Preview API 変換** — `generateKSCScript()` のスクリプト出力が正しいか

### 検証項目（ブロック型ごと）

| ブロック型 | 期待する KSC 出力 | 期待する Op |
|-----------|-----------------|-----------|
| `bg` | `@bg assetId` | `BG_SET` |
| `ch` (visible) | `@ch characterId expressionId pos=L` | `CH_SET` |
| `ch` (!visible) | `@ch_hide characterId` | `CH_HIDE` |
| `text` | `【speaker】\nbody` | `TEXT_APPEND` + `WAIT_CLICK` |
| `text` (地の文) | `body` | `TEXT_APPEND` + `WAIT_CLICK` |
| `choice` | `@choice ...` | `CHOICE` |
| `if` | `@if ... @then ... @endif` | `JUMP_IF` |
| `set_var` | `@set varName operator value` | `VAR_SET` / `VAR_ADD` / `VAR_SUB` |
| `effect` (shake) | `@shake intensity duration` | `SHAKE` |
| `effect` (flash) | `@flash intensity duration` | `FLASH` |
| `screen_filter` | `@filter filterType intensity` | `SCREEN_FILTER` |
| `screen_filter` (クリア) | `@filter_clear` | `SCREEN_FILTER_CLEAR` |
| `filter_mix` | `@filter_mix type1 int1 type2 int2 ...` | `FILTER_MIX` |
| `timeline` | `@timeline_play label` | `TIMELINE_PLAY` |
| `battle` | `@battle troopId winPage losePage` | `BATTLE_START` |
| `overlay` (show) | `@overlay assetId` | `OVERLAY_SET` |
| `overlay` (hide) | `@overlay_hide assetId` | `OVERLAY_HIDE` |
| `camera` | `@camera x y zoom time easing` | `CAMERA_SET` |
| `camera` (reset) | `@camera reset` | `CAMERA_SET` (reset) |
| `jump` | `@jump toPageId` | `JUMP` |
| `ksc` | そのまま出力 | スクリプト依存 |

### テスト数（想定）

- 約 20 テストケース（ブロック型 × バリエーション）

---

## Phase 3: ブラウザ再生テスト

**ツール**: Playwright（ブラウザ起動）
**対象**: Preview (`ksc-demo.html`) でプロジェクトを再生
**ファイル**: `tests/block-coverage/phase3-browser/preview-playback.spec.ts`

### 前提

- Phase 1 で保存したプロジェクトの Preview URL を使用
- Preview API (`/api/preview/:id`) が KSC を生成 → WebEngine が実行

### テスト内容

1. **Preview 読込** — Preview URL にアクセスしてエラーなく読み込めること
2. **背景表示** — `bg` ブロック後に canvas 上に背景が描画されること
3. **キャラ表示** — `ch` ブロック後にキャラスプライトが表示されること
4. **テキスト表示** — `text` ブロックでテキストウィンドウに正しい文字列
5. **選択肢表示** — `choice` ブロックで選択肢ボタンが表示されること
6. **エフェクト実行** — `effect` ブロックで画面が変化すること（スクショ比較）
7. **フィルタ適用** — `screen_filter` で色味が変わること
8. **オーバーレイ** — overlay 画像が bg/ch より上に表示されること
9. **ページジャンプ** — `jump` で次ページに遷移すること
10. **変数設定** — `set_var` 後にデバッグ表示で変数値を確認

### 検証方法

| 方法 | 対象ブロック |
|------|------------|
| DOM 要素の存在 | text, choice |
| Canvas スクリーンショット比較 | bg, ch, overlay, effect, screen_filter |
| コンソールログ確認 | set_var（デバッグモード） |
| ページ遷移検知 | jump, battle |
| エラーなし確認 | 全ブロック（console.error 監視） |

### テスト数（想定）

- 約 12〜15 テストケース

---

## 実行方法

```bash
# Phase 1: API テスト（サーバー起動必要: API + DB）
npx playwright test tests/block-coverage/phase1-api/ \
  --config=tests/block-coverage/playwright.block-coverage.config.ts

# Phase 2: コンパイラテスト（サーバー不要）
npx vitest run tests/block-coverage/phase2-compiler/

# Phase 3: ブラウザテスト（サーバー起動必要: API + DB + Preview）
npx playwright test tests/block-coverage/phase3-browser/ \
  --config=tests/block-coverage/playwright.block-coverage.config.ts

# 全フェーズ
npx playwright test tests/block-coverage/ \
  --config=tests/block-coverage/playwright.block-coverage.config.ts && \
npx vitest run tests/block-coverage/phase2-compiler/
```

---

## Playwright Config 設計

```typescript
// tests/block-coverage/playwright.block-coverage.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: [
    'phase1-api/**/*.spec.ts',
    'phase3-browser/**/*.spec.ts',
  ],
  timeout: 60_000,
  retries: 0,
  workers: 1,  // 順序依存（Phase1 → Phase3 で同じプロジェクトを使う場合）
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
});
```

---

## fixtures/all-blocks-project.json の構成

```
Page 1「全ブロックテスト」:
  start → bg → ch(visible) → text(speaker) → text(地の文) →
  set_var → effect(shake) → effect(flash) → screen_filter(sepia) →
  screen_filter(clear) → filter_mix(night+warm) → overlay(show) → overlay(hide) →
  camera(move) → camera(reset) → ksc

Page 2「分岐テスト」:
  start → choice(2択) → if(条件分岐) → text → jump(→Page 3)

Page 3「バトル・タイムライン」:
  start → timeline → battle → text(到達確認)
```

---

## 拡張ポイント

新しいフェーズを追加する場合:

```
tests/block-coverage/
├── phase4-editor-ui/          # エディタ上でブロック追加・編集
│   └── editor-blocks.spec.ts
├── phase5-azure/              # Azure 環境での検証
│   └── azure-blocks.spec.ts
└── phase6-regression/         # 既知バグの回帰テスト
    └── regression.spec.ts
```

`playwright.block-coverage.config.ts` の `testMatch` にパターン追加するだけで統合できる。

---

## 優先度・実装順

| 順番 | フェーズ | 理由 |
|------|---------|------|
| 1 | fixtures JSON 作成 | 全フェーズの基盤 |
| 2 | Phase 1 (API) | サーバーだけで検証可能、最速 |
| 3 | Phase 2 (Compiler) | サーバー不要、単体テスト |
| 4 | Phase 3 (Browser) | Phase 1 のプロジェクトを再利用 |

---

## 現在のテストスイート一覧（2026-03-23 更新）

### ユニットテスト（vitest）

| パッケージ | テスト数 | 状態 | 実行コマンド |
|-----------|---------|------|------------|
| packages/compiler | 272 | 全通過 | `cd packages/compiler && npx vitest run` |
| packages/core | ~30 | 通過 | `cd packages/core && npx vitest run` |
| packages/battle | ~20 | 通過 | `cd packages/battle && npx vitest run` |
| packages/interpreter | ~50 | 通過 | `cd packages/interpreter && npx vitest run` |
| packages/ksc-compiler | ~30 | 通過 | `cd packages/ksc-compiler && npx vitest run` |
| apps/hono | 406通過 / 116skip | assist 系スキップ | `cd apps/hono && npx vitest run` |
| apps/editor | ~30 | 通過 | `cd apps/editor && npx vitest run` |

### 今日追加したテスト

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `packages/compiler/test/command-sync.test.ts` | +7 | filter_mix 同期・出力値・エラーケース |
| `packages/compiler/test/lineClassifier.test.ts` | +1 | filter_mix needsArgs |
| `apps/hono/test/validation.test.ts` | 7 | validatePathParam（パストラバーサル・nullバイト） |
| `apps/hono/test/admin-api.test.ts` | 4 | Health Dashboard・認証拒否 |
| `apps/editor/src/__tests__/utils/filterCategories.test.ts` | 11 | getFilterCategory（tone/weather/postprocess） |
| `tests/shared/editor/filter-categories.spec.ts` | ~30 | フィルターカテゴリ・filter_mix E2E |

### スキップ中のテスト（リリース対象外）

| ファイル | 理由 |
|---------|------|
| `apps/hono/test/assist-*.test.ts` (6ファイル) | AI アシスタントはリリース対象外 |
| `apps/hono/test/preview.test.ts` (battle) | battle ブロックのスクリプト生成乖離 |

### E2E テスト（Playwright）

| ディレクトリ | ファイル数 | 対象 |
|------------|-----------|------|
| `tests/shared/` | ~50 | ローカル + Azure 共通 |
| `tests/azure/` | 7 | Azure 環境専用 |
| `tests/local/` | ~15 | ローカル専用 |
| `tests/block-coverage/` | ~5 | ブロック型網羅テスト |
| `e2e/` | 4 | マップ・モバイル |

### プロジェクト機能テスト（ブロック以外）

| 機能 | テストファイル | テスト数 | 状態 |
|------|-------------|---------|------|
| タイトル画像（サムネイル URL・画像取得・選択・撮影ボタン） | `tests/shared/editor/thumbnail.spec.ts` | ~8 | 追加予定 |
| 動画クリップ生成（API・ステータス・削除） | `apps/hono/test/videos.test.ts` | ~6 | 追加予定 |
| アナリティクス（ページビュー・リアクション・チップ） | `apps/hono/test/analytics.test.ts` | ~8 | 追加予定 |
| Discord リンク表示 | `tests/shared/editor/filter-categories.spec.ts` 内 | ~2 | 追加予定 |
| Health Dashboard | `apps/hono/test/admin-api.test.ts` | 4 | **実装済み** |
| パストラバーサル防止 | `apps/hono/test/validation.test.ts` | 7 | **実装済み** |

### CI で実行すべきテストスイート

```bash
# Phase 1: ユニットテスト（サーバー不要、最速）
cd packages/compiler && npx vitest run
cd packages/core && npx vitest run
cd apps/hono && npx vitest run
cd apps/editor && npx vitest run

# Phase 2: E2E テスト（サーバー起動必要）
npx playwright test tests/shared/ --config=tests/configs/playwright.local.config.ts

# Phase 3: ブロック網羅テスト（Phase 2 と同じ前提）
npx playwright test tests/block-coverage/ --config=tests/block-coverage/playwright.block-coverage.config.ts
```
