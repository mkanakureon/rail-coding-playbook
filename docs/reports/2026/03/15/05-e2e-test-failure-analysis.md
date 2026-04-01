# E2Eテスト失敗分析 + 改善計画

> 2026-03-15 / 配信時のブラウザテスト失敗を分析

## 対象ファイル一覧

### ヘルパー（修正対象）

| ファイル | 行数 | 役割 |
|---------|------|------|
| `tests/block-coverage/press/helpers/editor-actions.ts` | 392 | 全テスト共通ヘルパー。ブロック追加・アセット選択・プレビュー実行 |

### テスト（ヘルパー改善後に修正）

| ファイル | カテゴリ | ブロック型 |
|---------|---------|-----------|
| `tests/block-coverage/press/rec-basic-display.spec.ts` | 基本表示 | bg, ch, text, overlay |
| `tests/block-coverage/press/rec-effects.spec.ts` | 演出 | effect, screen_filter, camera |
| `tests/block-coverage/press/rec-logic.spec.ts` | ロジック | set_var, choice, if, jump |
| `tests/block-coverage/press/rec-special.spec.ts` | 特殊 | ksc, timeline, battle |
| `tests/block-coverage/press/verify-press-method.spec.ts` | 検証 | 全4カテゴリ統合 |
| `tests/block-coverage/press/verify-screenshots.spec.ts` | 検証 | スクリーンショット確認 |

### CLI スキル（改善対象）

| ファイル | 役割 |
|---------|------|
| `.claude/skills/edit-blocks/skill.md` | ブロック CLI 操作スキル |
| `scripts/cli/block/editor-cli.mjs` | CLI 本体 |

### Playwright 設定

| ファイル | 用途 |
|---------|------|
| `tests/block-coverage/playwright.block-coverage.config.ts` | プレス方式テスト用 |
| `tests/block-coverage/playwright.block-coverage-video.config.ts` | 録画用 |

### URL / 認証

| ファイル | 内容 |
|---------|------|
| `tests/fixtures/urls.ts` | API / Editor / Preview の URL 定義 |
| `tests/fixtures/db.ts` | DB 接続 |

## 問題の整理

配信中に繰り返し発生した失敗パターン:

| 問題 | 頻度 | 根本原因 |
|------|------|---------|
| キャラクター画像が設定されない | 高 | `addBlock(page, 'ch')` は追加するだけ。`selectChAsset()` ヘルパーが存在しない |
| 丸いエフェクトが実装されない | 高 | `addBlock(page, 'effect')` は追加するだけ。エフェクト種別を選択する `configureEffect()` が存在しない |
| 3秒待ちが実装されない | 高 | wait ブロックの追加・設定ヘルパー `configureWait()` が存在しない |
| 公式アセットの画像選択がうまくいかない | 高 | `selectBgAsset()` が「ファンタジー」カテゴリ固定。画像の読み込み待ちが `waitForTimeout` 依存 |
| テストの再生産（似たテストが増える） | 中 | 新テストを書くたびにヘルパーを微修正 → 本体の `editor-actions.ts` に反映されない |
| ブレが多い（同じテストが通ったり落ちたり） | 高 | `waitForTimeout` の多用（17箇所）。UI状態の確認なしに次の操作に進んでいる |

## 根本原因

### 1. ヘルパーのカバレッジ不足（`editor-actions.ts`）

全14ブロック型のうち、プロパティ設定ヘルパーがあるのは 5 つだけ:

| ブロック型 | ヘルパー | 状態 |
|-----------|---------|------|
| bg | `selectBgAsset()` | ✅ あるが脆弱（後述） |
| text | `fillText()` | ✅ OK |
| set_var | `fillSetVar()` | ✅ OK |
| choice | `fillChoice()` | ✅ OK |
| if | `configureIf()` | ✅ OK |
| ch | — | ❌ **追加するだけで画像未選択** |
| effect | — | ❌ **追加するだけで種別未選択** |
| wait | — | ❌ **ヘルパー自体がない** |
| camera | — | ❌ 追加するだけ |
| screen_filter | — | ❌ 追加するだけ |
| overlay | — | ❌ 追加するだけで画像未選択 |
| jump | — | ⚠️ 追加するだけ（遷移先未設定でもスキップされるので致命的ではない） |
| ksc | — | ⚠️ スクリプト未入力でもスキップされる |
| timeline | — | ⚠️ 未実装機能 |
| battle | — | ⚠️ 未実装機能 |

### 2. `waitForTimeout` の乱用（`editor-actions.ts` 内 17 箇所）

| 箇所 | 現在の待ち | あるべき待ち |
|------|-----------|------------|
| `openEditor` L95 | `waitForTimeout(1000)` | ページ読込完了の `waitForFunction` は直前にあるので、削除可能 |
| `addBlock` L111 | `waitForTimeout(300)` | スクロール完了待ち — 短いので許容 |
| `addBlock` L117 | `waitForTimeout(500)` | bottom-sheet 表示後 — `toBeVisible` の直後なので削除可能 |
| `addBlock` L122 | `waitForTimeout(500)` | bottom-sheet 非表示後 — `toBeHidden` の直後なので削除可能 |
| `selectBgAsset` L141 | `waitForTimeout(1500)` | モーダル表示待ち — `expect(modal).toBeVisible()` に置換 |
| `selectBgAsset` L146 | `waitForTimeout(2000)` | 公式タブ読み込み — `waitForSelector('img[src]')` に置換 |
| `selectBgAsset` L154 | `waitForTimeout(1000)` | カテゴリ読み込み — `waitForSelector('img[src]')` に置換 |
| `selectBgAsset` L160 | `waitForTimeout(500)` | 画像クリック後 — 短いので許容 |
| `selectBgAsset` L165 | `waitForTimeout(1500)` | 確定後 — モーダル閉じ待ち `toBeHidden` に置換 |
| `fillText` L183 | `waitForTimeout(1000)` | カード展開待ち — `textarea.isVisible` の直後なので削除可能 |
| `fillText` L207 | `waitForTimeout(500)` | 入力後 — 短いので許容 |
| `fillChoice` L252 | `waitForTimeout(300)` | 選択肢追加後 — 短いので許容 |
| `fillChoice` L258 | `waitForTimeout(200)` | 入力後 — 短いので許容 |
| `fillChoice` L266 | `waitForTimeout(500)` | 閉じた後 — 短いので許容 |
| `configureIf` L277 | `waitForTimeout(500)` | 展開後 — 短いので許容 |
| `configureIf` L295 | `waitForTimeout(500)` | 閉じた後 — 短いので許容 |
| `runPreview` L357 | `waitForTimeout(2000)` | プレビュー読み込み後 — canvas 描画待ちに置換可能 |

**置換すべき: 7 箇所** / 許容: 10 箇所

### 3. キャラクター作成の失敗パターン

`rec-basic-display.spec.ts` L51-53:
```typescript
await addBlock(page, 'ch');
await ss(page, 'after-add-ch');  // ← 画像選択なしで次に進む
```

キャラクターブロックは追加しただけでは**画像なし**。プレビューで空のキャラが表示されるか、描画エラーになる。必要な操作:

1. ch ブロックの「変更」ボタンをクリック
2. キャラクター選択モーダルが開く
3. 公式アセットからキャラ画像を選択
4. 表情を選択
5. 確定

これは `selectBgAsset()` と同じパターンだが、ch 用のモーダル構造が bg と異なるため、専用ヘルパーが必要。

### 4. CLI スキル（`edit-blocks`）の不足

CLI でブロックを追加するとき、以下が不足:

| CLI コマンド | 不足 |
|-------------|------|
| `add ... effect` | `--effectType shake` のようなオプションがない |
| `add ... wait` | wait ブロックの追加自体がない |
| `add ... camera` | `--zoom`, `--x`, `--y` のようなオプションがない |
| `add ... screen_filter` | `--filter` オプションがない |

## 改善計画

### Phase 1: ヘルパー追加（`editor-actions.ts`）

追加するヘルパー:

```typescript
// ch のキャラクター画像選択
export async function selectChAsset(page: Page, options?: {
  characterIndex?: number;
  expressionIndex?: number;
}) { ... }

// effect の種別選択
export async function configureEffect(page: Page,
  type: 'shake' | 'flash' | 'circle' = 'shake'
) { ... }

// wait の設定
export async function configureWait(page: Page,
  mode: 'click' | 'timeout' | 'voiceend',
  seconds?: number
) { ... }

// camera の設定
export async function configureCamera(page: Page,
  zoom?: number, x?: number, y?: number
) { ... }

// overlay の画像選択
export async function selectOverlayAsset(page: Page,
  assetIndex?: number
) { ... }

// screen_filter の設定
export async function configureScreenFilter(page: Page,
  filter?: string
) { ... }
```

### Phase 2: `waitForTimeout` → 条件待ち（`editor-actions.ts`）

7 箇所を条件待ちに置換（上記の表参照）。

### Phase 3: テストファイル修正

各テストで `addBlock` だけしてプロパティ未設定のブロックに、Phase 1 のヘルパーを適用:

| ファイル | 修正内容 |
|---------|---------|
| `rec-basic-display.spec.ts` | `addBlock('ch')` の後に `selectChAsset()` 追加。`addBlock('overlay')` の後に `selectOverlayAsset()` 追加 |
| `rec-effects.spec.ts` | `addBlock('effect')` の後に `configureEffect('shake')` / `configureEffect('flash')` 追加。`addBlock('camera')` の後に `configureCamera()` 追加。`addBlock('screen_filter')` の後に `configureScreenFilter()` 追加 |
| `rec-special.spec.ts` | ksc / timeline / battle は未実装機能なので現状維持 |

### Phase 4: CLI スキル改善（`edit-blocks/skill.md` + `editor-cli.mjs`）

CLI のブロック追加コマンドにオプション追加:

```bash
# effect に種別指定
node scripts/cli/block/editor-cli.mjs add <pid> <pageId> effect --effectType shake

# wait ブロック追加
node scripts/cli/block/editor-cli.mjs add <pid> <pageId> wait --mode timeout --seconds 3

# camera に設定
node scripts/cli/block/editor-cli.mjs add <pid> <pageId> camera --zoom 1.5 --x 100 --y 50
```

## 優先順位

1. **Phase 1（ヘルパー追加）** — 最大インパクト。テストの失敗原因を直接解消
2. **Phase 3（テスト修正）** — Phase 1 のヘルパーを即座に適用。同時コミット推奨
3. **Phase 2（waitForTimeout 置換）** — フレーキーテストの根本解決
4. **Phase 4（CLI 改善）** — 配信外の作業効率改善

## 実装ルール

- **ヘルパーを追加したら既存テストにも即適用する** — ヘルパーだけ追加してテスト未修正にしない
- **各 Phase でテスト実行して確認する** — Phase をまたいで一気にやらない
- **エディタの UI セレクタは実際に確認してから書く** — 推測でセレクタを書かない（CLAUDE.md ルール準拠）
