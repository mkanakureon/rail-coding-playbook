# Azure プレスリリース方式 4カテゴリテスト報告書

- **日付**: 2026-03-13
- **テスト環境**: Azure 本番
  - API: `ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io`
  - Next.js: `ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io`
  - Editor: `agreeable-river-0bfb78000.4.azurestaticapps.net`
  - Preview: `happy-tree-012282700.1.azurestaticapps.net`
- **Playwright**: v1.58.2 / Chromium / headless
- **テスト合計**: 4テスト / 全パス / 3分54秒
- **スクリーンショット**: 110枚

---

## 前提作業: 公式アセット同期

テスト実行前に、ローカル DB → Azure DB の公式アセット同期を実施。

| 項目 | 件数 |
|------|------|
| 同期前（Azure） | 346 レコード |
| INSERT | 275 |
| UPDATE（ID統一） | 306 |
| DELETE | 1 |
| 同期後（Azure） | 620 レコード |
| ローカル | 590 レコード |

同期前は「ファンタジー」カテゴリのアセットが Azure に不足しており、テストが `selectBgAsset` で失敗していた。

---

## テスト結果サマリー

| # | カテゴリ | テストファイル | ブロック型 | 時間 | 結果 | SS枚数 |
|---|---------|-------------|-----------|------|------|--------|
| 1 | 基本表示 | rec-basic-display.spec.ts | bg, ch, text, overlay | 48.0s | PASS | 23 |
| 2 | 演出 | rec-effects.spec.ts | effect, screen_filter, camera | 1.1m | PASS | 30 |
| 3 | ロジック | rec-logic.spec.ts | set_var, choice, if, jump | 59.9s | PASS | 29 |
| 4 | 特殊 | rec-special.spec.ts | ksc, timeline, battle | 1.0m | PASS | 28 |

全テストでプレビュー完走（completed=true, clicks=3）。

---

## カテゴリ1: 基本表示（bg / ch / text / overlay）

**23枚** — `azure-press-screenshots/basic-display/`

### エディタ操作

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 01 | editor-initial.png | エディタ初期表示（初期コンテンツ: start+bg+ch+text） |
| 02 | after-add-bg.png | bg ブロック追加 |
| 03 | after-select-bg-asset.png | ファンタジー背景選択完了 |
| 04 | after-add-ch.png | ch ブロック追加 |
| 05 | after-add-text-speaker.png | text（話者付き）追加 |
| 06 | after-add-text-narration.png | text（地の文）追加 |
| 07 | after-add-overlay.png | overlay ブロック追加 |

### プロパティパネル確認（9ブロック）

| # | スクリーンショット | ブロック型 | プロパティ表示 |
|---|-----------------|----------|:------------:|
| 08 | prop-00-start.png | start | OK |
| 09 | prop-01-bg.png | bg | OK |
| 10 | prop-02-ch.png | ch | OK |
| 11 | prop-03-text.png | text | OK |
| 12 | prop-04-bg.png | bg（追加分） | OK |
| 13 | prop-05-ch.png | ch（追加分） | OK |
| 14 | prop-06-text.png | text（話者付き） | OK |
| 15 | prop-07-text.png | text（地の文） | OK |
| 16 | prop-08-overlay.png | overlay | OK |

### 保存・プレビュー

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 17 | after-save.png | 保存完了 |
| 18 | preview-title.png | プレビュータイトル画面 |
| 19 | preview-start.png | 「はじめから」クリック後 |
| 20 | preview-click-01.png | クリック1回目 |
| 21 | preview-click-02.png | クリック2回目 |
| 22 | preview-click-03.png | クリック3回目 |
| 23 | preview-final.png | END到達（タイトル画面に戻る） |

---

## カテゴリ2: 演出（effect / screen_filter / camera）

**30枚** — `azure-press-screenshots/effects/`

### エディタ操作

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 01 | editor-initial.png | エディタ初期表示 |
| 02 | after-add-bg.png | bg 追加 + アセット選択 |
| 03 | after-add-text.png | text「エフェクトテスト開始。」 |
| 04 | after-add-effect-1.png | effect ブロック1つ目（デフォルト） |
| 05 | after-add-text-2.png | text「シェイク完了。次はフラッシュ。」 |
| 06 | after-add-effect-2.png | effect ブロック2つ目（デフォルト） |
| 07 | after-add-screen_filter.png | screen_filter（デフォルト） |
| 08 | after-add-text-3.png | text「フィルタ適用中。」 |
| 09 | after-add-camera.png | camera（デフォルト） |
| 10 | after-add-text-4.png | text「演出テスト完了！」 |

### プロパティパネル確認（13ブロック）

| # | スクリーンショット | ブロック型 | プロパティ表示 |
|---|-----------------|----------|:------------:|
| 11 | prop-00-start.png | start | OK |
| 12 | prop-01-bg.png | bg | OK |
| 13 | prop-02-ch.png | ch | OK |
| 14 | prop-03-text.png | text | OK |
| 15 | prop-04-bg.png | bg（追加分） | OK |
| 16 | prop-05-text.png | text | OK |
| 17 | prop-06-effect.png | effect | OK — エフェクト選択・強度・時間 |
| 18 | prop-07-text.png | text | OK |
| 19 | prop-08-effect.png | effect | OK |
| 20 | prop-09-screen_filter.png | screen_filter | OK — フィルター種別・強度 |
| 21 | prop-10-text.png | text | OK |
| 22 | prop-11-camera.png | camera | OK — ズーム・パン設定 |
| 23 | prop-12-text.png | text | OK |

### 保存・プレビュー

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 24 | after-save.png | 保存完了 |
| 25 | preview-title.png | タイトル画面 |
| 26 | preview-start.png | 開始 |
| 27 | preview-click-01.png | クリック1 |
| 28 | preview-click-02.png | クリック2 |
| 29 | preview-click-03.png | クリック3 |
| 30 | preview-final.png | END到達 |

---

## カテゴリ3: ロジック（set_var / choice / if / jump）

**29枚** — `azure-press-screenshots/logic/`

### エディタ操作

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 01 | editor-initial.png | エディタ初期表示 |
| 02 | after-add-bg.png | bg 追加 + アセット選択 |
| 03 | after-add-set_var-before-fill.png | set_var 追加（入力前） |
| 04 | after-fill-set_var.png | set_var 入力後（score = 10） |
| 05 | after-add-text.png | text「変数を設定しました。」 |
| 06 | after-add-choice-before-fill.png | choice 追加（入力前） |
| 07 | after-fill-choice.png | choice 入力後（はい / いいえ） |
| 08 | after-add-if-before-config.png | if 追加（設定前） |
| 09 | after-config-if.png | if 設定後 |
| 10 | after-add-text-2.png | text「ロジックテスト完了！」 |
| 11 | after-add-jump.png | jump ブロック追加 |

### プロパティパネル確認（11ブロック）

| # | スクリーンショット | ブロック型 | プロパティ表示 |
|---|-----------------|----------|:------------:|
| 12 | prop-00-start.png | start | OK |
| 13 | prop-01-bg.png | bg | OK |
| 14 | prop-02-ch.png | ch | OK |
| 15 | prop-03-text.png | text | OK |
| 16 | prop-04-bg.png | bg（追加分） | OK |
| 17 | prop-05-set_var.png | set_var | OK — 変数名・値 |
| 18 | prop-06-text.png | text | OK |
| 19 | prop-07-choice.png | choice | OK — 選択肢一覧 |
| 20 | prop-08-if.png | if | OK — 条件式 |
| 21 | prop-09-text.png | text | OK |
| 22 | prop-10-jump.png | jump | OK — ジャンプ先 |

### 保存・プレビュー

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 23 | after-save.png | 保存完了 |
| 24 | preview-title.png | タイトル画面 |
| 25 | preview-start.png | 開始 |
| 26 | preview-click-01.png | クリック1 |
| 27 | preview-click-02.png | クリック2 |
| 28 | preview-click-03.png | クリック3 |
| 29 | preview-final.png | END到達 |

---

## カテゴリ4: 特殊（ksc / timeline / battle）

**28枚** — `azure-press-screenshots/special/`

### エディタ操作

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 01 | editor-initial.png | エディタ初期表示 |
| 02 | after-add-bg.png | bg 追加 + アセット選択 |
| 03 | after-add-text.png | text「特殊ブロックテスト開始。」 |
| 04 | after-add-ksc.png | ksc スクリプトブロック（デフォルト） |
| 05 | after-add-text-2.png | text「KSC ブロック通過確認。」 |
| 06 | after-add-timeline.png | timeline ブロック（デフォルト） |
| 07 | after-add-text-3.png | text「タイムライン通過確認。」 |
| 08 | after-add-battle.png | battle ブロック（デフォルト） |
| 09 | after-add-text-4.png | text「全特殊ブロックテスト完了！」 |

### プロパティパネル確認（12ブロック）

| # | スクリーンショット | ブロック型 | プロパティ表示 |
|---|-----------------|----------|:------------:|
| 10 | prop-00-start.png | start | OK |
| 11 | prop-01-bg.png | bg | OK |
| 12 | prop-02-ch.png | ch | OK |
| 13 | prop-03-text.png | text | OK |
| 14 | prop-04-bg.png | bg（追加分） | OK |
| 15 | prop-05-text.png | text | OK |
| 16 | prop-06-ksc.png | ksc | OK — スクリプト入力欄 |
| 17 | prop-07-text.png | text | OK |
| 18 | prop-08-timeline.png | timeline | OK — チャンネル設定 |
| 19 | prop-09-text.png | text | OK |
| 20 | prop-10-battle.png | battle | OK — 敵グループ・勝敗ジャンプ先 |
| 21 | prop-11-text.png | text | OK |

### 保存・プレビュー

| # | スクリーンショット | 内容 |
|---|-----------------|------|
| 22 | after-save.png | 保存完了 |
| 23 | preview-title.png | タイトル画面 |
| 24 | preview-start.png | 開始 |
| 25 | preview-click-01.png | クリック1 |
| 26 | preview-click-02.png | クリック2 |
| 27 | preview-click-03.png | クリック3 |
| 28 | preview-final.png | END到達 |

---

## 全14ブロック型カバレッジ（Azure）

| ブロック型 | カテゴリ | エディタ追加 | プロパティ確認 | プレビュー通過 |
|-----------|---------|:-----------:|:------------:|:------------:|
| start | （全共通） | - | OK | OK |
| bg | 基本表示 | OK | OK | OK |
| ch | 基本表示 | OK | OK | OK |
| text | 基本表示 | OK | OK | OK |
| overlay | 基本表示 | OK | OK | OK |
| effect | 演出 | OK | OK | OK |
| screen_filter | 演出 | OK | OK | OK |
| camera | 演出 | OK | OK | OK |
| set_var | ロジック | OK | OK | OK |
| choice | ロジック | OK | OK | OK |
| if | ロジック | OK | OK | OK |
| jump | ロジック | OK | OK | OK |
| ksc | 特殊 | OK | OK | OK |
| timeline | 特殊 | OK | OK | OK |
| battle | 特殊 | OK | OK | OK |

**14/14 ブロック全て Azure 本番環境で動作確認完了。**

---

## ローカル vs Azure 比較

| 項目 | ローカル | Azure |
|------|---------|-------|
| テスト結果 | 4/4 PASS | 4/4 PASS |
| 合計時間 | 3.9m | 3.9m |
| スクリーンショット | 110枚 | 110枚 |
| プレビュー完走 | 全 completed=true | 全 completed=true |
| クリック数 | 各3 | 各3 |
| 差異 | - | アセット同期が必要だった |

---

## テスト実行コマンド

```bash
TEST_API_URL=https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io \
TEST_NEXT_URL=https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io \
TEST_EDITOR_URL=https://agreeable-river-0bfb78000.4.azurestaticapps.net \
TEST_PREVIEW_URL=https://happy-tree-012282700.1.azurestaticapps.net \
npx playwright test \
  tests/block-coverage/press/rec-basic-display.spec.ts \
  tests/block-coverage/press/rec-effects.spec.ts \
  tests/block-coverage/press/rec-logic.spec.ts \
  tests/block-coverage/press/rec-special.spec.ts \
  --config=tests/block-coverage/playwright.block-coverage.config.ts
```

---

## 結論

公式アセット同期（ローカル → Azure, +275件）を実施後、Azure 本番環境で全14ブロック型のプレスリリース方式テストが完走した。ローカルと Azure で完全に同じ挙動を確認。エディタ操作（ブロック追加・プロパティ表示）、保存、プレビュー再生の全ステップが正常動作している。
