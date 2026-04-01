# プレスリリース方式 4カテゴリテスト報告書

**日付**: 2026-03-13
**スクリーンショット**: 全110枚（4カテゴリ）
**テスト結果**: 全4テスト PASS

---

## テスト概要

全14ブロックタイプを4カテゴリに分類し、各カテゴリで「ブロック追加 → 保存 → プレビュー完走」を検証。
操作の前後 + プロパティパネル + プレビュー各段階でスクリーンショットを撮影。

| カテゴリ | ブロック | SS枚数 | 所要時間 | 結果 |
|---------|---------|--------|---------|------|
| 基本表示 | bg, ch, text, overlay | 23枚 | 47.8s | PASS |
| 演出 | effect, screen_filter, camera | 30枚 | 1.1m | PASS |
| ロジック | set_var, choice, if, jump | 29枚 | 59.9s | PASS |
| 特殊 | ksc, timeline, battle | 28枚 | 1.0m | PASS |

---

## カテゴリ1: 基本表示（bg / ch / text / overlay）

テストファイル: `rec-basic-display.spec.ts`

### エディタ操作

#### 初期状態（自動生成4ブロック: start → bg → ch → text）

![初期状態](press-screenshots/basic-display/01-editor-initial.png)

#### bg 追加

![bg追加](press-screenshots/basic-display/02-after-add-bg.png)

「背景ブロックを追加しました」トースト。画像未選択状態。

#### bg アセット選択後

![bgアセット選択](press-screenshots/basic-display/03-after-select-bg-asset.png)

公式アセットからファンタジー背景を選択。プロパティパネルに画像・位置・スケール表示。

#### ch 追加

![ch追加](press-screenshots/basic-display/04-after-add-ch.png)

「キャラクターブロックを追加しました」トースト。未選択/未選択状態。

#### text 追加（speaker 付き）

![text speaker](press-screenshots/basic-display/05-after-add-text-speaker.png)

テキスト「こんにちは！基本表示テストのテキストです。」+ 話者入力。

#### text 追加（地の文）

![text narration](press-screenshots/basic-display/06-after-add-text-narration.png)

テキスト「静かな森の中。風が木々を揺らしている。」（話者なし）。

#### overlay 追加

![overlay追加](press-screenshots/basic-display/07-after-add-overlay.png)

「OVLブロックを追加しました」トースト。画像未選択 + 表示チェック。

### プロパティパネル確認（全9ブロック）

| # | ブロック | スクリーンショット |
|---|---------|------------------|
| 0 | start | ![](press-screenshots/basic-display/08-prop-00-start.png) |
| 1 | bg（自動生成） | ![](press-screenshots/basic-display/09-prop-01-bg.png) |
| 2 | ch（自動生成） | ![](press-screenshots/basic-display/10-prop-02-ch.png) |
| 3 | text（自動生成） | ![](press-screenshots/basic-display/11-prop-03-text.png) |
| 4 | bg（追加） | ![](press-screenshots/basic-display/12-prop-04-bg.png) |
| 5 | ch（追加） | ![](press-screenshots/basic-display/13-prop-05-ch.png) |
| 6 | text（speaker） | ![](press-screenshots/basic-display/14-prop-06-text.png) |
| 7 | text（地の文） | ![](press-screenshots/basic-display/15-prop-07-text.png) |
| 8 | overlay | ![](press-screenshots/basic-display/16-prop-08-overlay.png) |

### 保存後

![保存後](press-screenshots/basic-display/17-after-save.png)

### プレビュー

| 段階 | スクリーンショット |
|------|------------------|
| タイトル画面 | ![](press-screenshots/basic-display/18-preview-title.png) |
| 再生開始 | ![](press-screenshots/basic-display/19-preview-start.png) |
| 1クリック目 | ![](press-screenshots/basic-display/20-preview-click-01.png) |
| 2クリック目 | ![](press-screenshots/basic-display/21-preview-click-02.png) |
| 3クリック目（END） | ![](press-screenshots/basic-display/22-preview-click-03.png) |
| 最終状態 | ![](press-screenshots/basic-display/23-preview-final.png) |

**結果: completed=true, 3 clicks**

---

## カテゴリ2: 演出（effect / screen_filter / camera）

テストファイル: `rec-effects.spec.ts`

### エディタ操作

#### 初期状態

![初期状態](press-screenshots/effects/01-editor-initial.png)

#### bg 追加（アセット選択済み）

![bg追加](press-screenshots/effects/02-after-add-bg.png)

#### text 追加

![text追加](press-screenshots/effects/03-after-add-text.png)

#### effect 追加（1つ目）

![effect1追加](press-screenshots/effects/04-after-add-effect-1.png)

「エフェクトブロックを追加しました」トースト。FX ドロップダウン + パラメータ。

#### text 追加

![text追加2](press-screenshots/effects/05-after-add-text-2.png)

#### effect 追加（2つ目）

![effect2追加](press-screenshots/effects/06-after-add-effect-2.png)

#### screen_filter 追加

![screen_filter追加](press-screenshots/effects/07-after-add-screen_filter.png)

「フィルターブロックを追加しました」トースト。「なし（解除）」ドロップダウン。

#### text 追加

![text追加3](press-screenshots/effects/08-after-add-text-3.png)

#### camera 追加

![camera追加](press-screenshots/effects/09-after-add-camera.png)

「カメラブロックを追加しました」トースト。1000ms デュレーション。

#### text 追加

![text追加4](press-screenshots/effects/10-after-add-text-4.png)

### プロパティパネル確認（全13ブロック）

| # | ブロック | スクリーンショット |
|---|---------|------------------|
| 0 | start | ![](press-screenshots/effects/11-prop-00-start.png) |
| 1 | bg（自動生成） | ![](press-screenshots/effects/12-prop-01-bg.png) |
| 2 | ch（自動生成） | ![](press-screenshots/effects/13-prop-02-ch.png) |
| 3 | text（自動生成） | ![](press-screenshots/effects/14-prop-03-text.png) |
| 4 | bg（追加） | ![](press-screenshots/effects/15-prop-04-bg.png) |
| 5 | text | ![](press-screenshots/effects/16-prop-05-text.png) |
| 6 | effect（1つ目） | ![](press-screenshots/effects/17-prop-06-effect.png) |
| 7 | text | ![](press-screenshots/effects/18-prop-07-text.png) |
| 8 | effect（2つ目） | ![](press-screenshots/effects/19-prop-08-effect.png) |
| 9 | screen_filter | ![](press-screenshots/effects/20-prop-09-screen_filter.png) |
| 10 | text | ![](press-screenshots/effects/21-prop-10-text.png) |
| 11 | camera | ![](press-screenshots/effects/22-prop-11-camera.png) |
| 12 | text | ![](press-screenshots/effects/23-prop-12-text.png) |

### 保存後

![保存後](press-screenshots/effects/24-after-save.png)

### プレビュー

| 段階 | スクリーンショット |
|------|------------------|
| タイトル画面 | ![](press-screenshots/effects/25-preview-title.png) |
| 再生開始 | ![](press-screenshots/effects/26-preview-start.png) |
| 1クリック目 | ![](press-screenshots/effects/27-preview-click-01.png) |
| 2クリック目 | ![](press-screenshots/effects/28-preview-click-02.png) |
| 3クリック目（END） | ![](press-screenshots/effects/29-preview-click-03.png) |
| 最終状態 | ![](press-screenshots/effects/30-preview-final.png) |

**結果: completed=true, 3 clicks**

---

## カテゴリ3: ロジック（set_var / choice / if / jump）

テストファイル: `rec-logic.spec.ts`

### エディタ操作

#### 初期状態

![初期状態](press-screenshots/logic/01-editor-initial.png)

#### bg 追加（アセット選択済み）

![bg追加](press-screenshots/logic/02-after-add-bg.png)

#### set_var 追加（設定前）

![set_var追加前](press-screenshots/logic/03-after-add-set_var-before-fill.png)

「変数ブロックを追加しました」トースト。変数名・値が空の状態。

#### set_var 設定後（score = 10）

![set_var設定後](press-screenshots/logic/04-after-fill-set_var.png)

変数名「score」、値「10」を入力済み。

#### text 追加

![text追加](press-screenshots/logic/05-after-add-text.png)

#### choice 追加（設定前）

![choice追加前](press-screenshots/logic/06-after-add-choice-before-fill.png)

「選択肢ブロックを追加しました」トースト。0個の選択肢。

#### choice 設定後（はい / いいえ）

![choice設定後](press-screenshots/logic/07-after-fill-choice.png)

選択肢2つ（「はい」「いいえ」）を追加済み。

#### if 追加（設定前）

![if追加前](press-screenshots/logic/08-after-add-if-before-config.png)

「IF文ブロックを追加しました」トースト。条件未設定。

#### if 設定後（score >= 0）

![if設定後](press-screenshots/logic/09-after-config-if.png)

条件追加済み（score 変数を使用）。

#### text 追加

![text追加2](press-screenshots/logic/10-after-add-text-2.png)

#### jump 追加（未設定）

![jump追加](press-screenshots/logic/11-after-add-jump.png)

「ジャンプブロックを追加しました」トースト。ジャンプ先未選択（→スキップ）。

### プロパティパネル確認（全11ブロック）

| # | ブロック | スクリーンショット |
|---|---------|------------------|
| 0 | start | ![](press-screenshots/logic/12-prop-00-start.png) |
| 1 | bg（自動生成） | ![](press-screenshots/logic/13-prop-01-bg.png) |
| 2 | ch（自動生成） | ![](press-screenshots/logic/14-prop-02-ch.png) |
| 3 | text（自動生成） | ![](press-screenshots/logic/15-prop-03-text.png) |
| 4 | bg（追加） | ![](press-screenshots/logic/16-prop-04-bg.png) |
| 5 | set_var（score=10） | ![](press-screenshots/logic/17-prop-05-set_var.png) |
| 6 | text | ![](press-screenshots/logic/18-prop-06-text.png) |
| 7 | choice（はい/いいえ） | ![](press-screenshots/logic/19-prop-07-choice.png) |
| 8 | if（条件付き） | ![](press-screenshots/logic/20-prop-08-if.png) |
| 9 | text | ![](press-screenshots/logic/21-prop-09-text.png) |
| 10 | jump（未設定） | ![](press-screenshots/logic/22-prop-10-jump.png) |

### 保存後

![保存後](press-screenshots/logic/23-after-save.png)

### プレビュー

| 段階 | スクリーンショット |
|------|------------------|
| タイトル画面 | ![](press-screenshots/logic/24-preview-title.png) |
| 再生開始 | ![](press-screenshots/logic/25-preview-start.png) |
| 1クリック目 | ![](press-screenshots/logic/26-preview-click-01.png) |
| 2クリック目 | ![](press-screenshots/logic/27-preview-click-02.png) |
| 3クリック目（END） | ![](press-screenshots/logic/28-preview-click-03.png) |
| 最終状態 | ![](press-screenshots/logic/29-preview-final.png) |

**結果: completed=true, 3 clicks**
- choice は Enter キーで最初の選択肢（「はい」）が自動選択
- if/jump は未設定のためスキップ

---

## カテゴリ4: 特殊（ksc / timeline / battle）

テストファイル: `rec-special.spec.ts`

### エディタ操作

#### 初期状態

![初期状態](press-screenshots/special/01-editor-initial.png)

#### bg 追加（アセット選択済み）

![bg追加](press-screenshots/special/02-after-add-bg.png)

#### text 追加

![text追加](press-screenshots/special/03-after-add-text.png)

#### ksc 追加

![ksc追加](press-screenshots/special/04-after-add-ksc.png)

「スクリプトブロックを追加しました」トースト。空のスクリプトブロック。

#### text 追加

![text追加2](press-screenshots/special/05-after-add-text-2.png)

#### timeline 追加

![timeline追加](press-screenshots/special/06-after-add-timeline.png)

「タイムラインブロックを追加しました」トースト。ラベル + 0 tracks + 0:05.000。

#### text 追加

![text追加3](press-screenshots/special/07-after-add-text-3.png)

#### battle 追加

![battle追加](press-screenshots/special/08-after-add-battle.png)

「バトルブロックを追加しました」トースト。敵グループ/勝利時/敗北時 ドロップダウン。

#### text 追加

![text追加4](press-screenshots/special/09-after-add-text-4.png)

### プロパティパネル確認（全12ブロック）

| # | ブロック | スクリーンショット |
|---|---------|------------------|
| 0 | start | ![](press-screenshots/special/10-prop-00-start.png) |
| 1 | bg（自動生成） | ![](press-screenshots/special/11-prop-01-bg.png) |
| 2 | ch（自動生成） | ![](press-screenshots/special/12-prop-02-ch.png) |
| 3 | text（自動生成） | ![](press-screenshots/special/13-prop-03-text.png) |
| 4 | bg（追加） | ![](press-screenshots/special/14-prop-04-bg.png) |
| 5 | text | ![](press-screenshots/special/15-prop-05-text.png) |
| 6 | ksc | ![](press-screenshots/special/16-prop-06-ksc.png) |
| 7 | text | ![](press-screenshots/special/17-prop-07-text.png) |
| 8 | timeline | ![](press-screenshots/special/18-prop-08-timeline.png) |
| 9 | text | ![](press-screenshots/special/19-prop-09-text.png) |
| 10 | battle | ![](press-screenshots/special/20-prop-10-battle.png) |
| 11 | text | ![](press-screenshots/special/21-prop-11-text.png) |

### 保存後

![保存後](press-screenshots/special/22-after-save.png)

### プレビュー

| 段階 | スクリーンショット |
|------|------------------|
| タイトル画面 | ![](press-screenshots/special/23-preview-title.png) |
| 再生開始 | ![](press-screenshots/special/24-preview-start.png) |
| 1クリック目 | ![](press-screenshots/special/25-preview-click-01.png) |
| 2クリック目 | ![](press-screenshots/special/26-preview-click-02.png) |
| 3クリック目（END） | ![](press-screenshots/special/27-preview-click-03.png) |
| 最終状態 | ![](press-screenshots/special/28-preview-final.png) |

**結果: completed=true, 3 clicks**
- ksc（空）、timeline（0 tracks）、battle（未設定）はすべてスキップされて完走

---

## 全ブロックカバレッジ

| ブロック | カテゴリ | 追加SS | プロパティSS | プレビュー |
|---------|---------|--------|-----------|----------|
| start | - | 自動生成 | 4テスト全てで確認 | OK |
| bg | 基本表示 | 追加+アセット選択 | 画像・位置・スケール | 背景切替確認 |
| ch | 基本表示 | 追加（トースト） | キャラ名・表情 | キャラ表示確認 |
| text | 基本表示 | speaker付き+地の文 | 話者・本文・枠色 | テキスト進行確認 |
| overlay | 基本表示 | 追加（トースト） | 画像未選択・表示 | スキップ |
| effect | 演出 | 追加×2（トースト） | FX選択・パラメータ | スキップ |
| screen_filter | 演出 | 追加（トースト） | フィルター選択 | スキップ |
| camera | 演出 | 追加（トースト） | デュレーション | スキップ |
| set_var | ロジック | 追加前→入力後 | 変数名・演算子・値 | スキップ |
| choice | ロジック | 追加前→編集後 | 選択肢数・編集ボタン | Enter選択で通過 |
| if | ロジック | 追加前→条件設定後 | 条件・T/Fブロック数 | スキップ |
| jump | ロジック | 追加（トースト） | ジャンプ先DD | 未設定→スキップ |
| ksc | 特殊 | 追加（トースト） | スクリプト内容 | 空→スキップ |
| timeline | 特殊 | 追加（トースト） | ラベル・tracks・時間 | 0tracks→スキップ |
| battle | 特殊 | 追加（トースト） | 敵グループ・勝敗先 | 未設定→スキップ |

---

## スクリーンショット一覧（全110枚）

### 基本表示（23枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-initial | エディタ初期状態 |
| 02 | after-add-bg | bg 追加（トースト） |
| 03 | after-select-bg-asset | bg アセット選択後 |
| 04 | after-add-ch | ch 追加（トースト） |
| 05 | after-add-text-speaker | text 追加（speaker 付き） |
| 06 | after-add-text-narration | text 追加（地の文） |
| 07 | after-add-overlay | overlay 追加（トースト） |
| 08-16 | prop-00〜08 | 全9ブロック プロパティパネル |
| 17 | after-save | 保存完了 |
| 18-23 | preview-* | プレビュー6段階 |

### 演出（30枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-initial | エディタ初期状態 |
| 02 | after-add-bg | bg 追加 |
| 03 | after-add-text | text 追加 |
| 04 | after-add-effect-1 | effect 追加（1つ目） |
| 05 | after-add-text-2 | text 追加 |
| 06 | after-add-effect-2 | effect 追加（2つ目） |
| 07 | after-add-screen_filter | screen_filter 追加 |
| 08 | after-add-text-3 | text 追加 |
| 09 | after-add-camera | camera 追加 |
| 10 | after-add-text-4 | text 追加 |
| 11-23 | prop-00〜12 | 全13ブロック プロパティパネル |
| 24 | after-save | 保存完了 |
| 25-30 | preview-* | プレビュー6段階 |

### ロジック（29枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-initial | エディタ初期状態 |
| 02 | after-add-bg | bg 追加 |
| 03 | after-add-set_var-before-fill | set_var 追加（入力前） |
| 04 | after-fill-set_var | set_var 入力後（score=10） |
| 05 | after-add-text | text 追加 |
| 06 | after-add-choice-before-fill | choice 追加（編集前） |
| 07 | after-fill-choice | choice 編集後（はい/いいえ） |
| 08 | after-add-if-before-config | if 追加（設定前） |
| 09 | after-config-if | if 設定後（条件追加） |
| 10 | after-add-text-2 | text 追加 |
| 11 | after-add-jump | jump 追加（未設定） |
| 12-22 | prop-00〜10 | 全11ブロック プロパティパネル |
| 23 | after-save | 保存完了 |
| 24-29 | preview-* | プレビュー6段階 |

### 特殊（28枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-initial | エディタ初期状態 |
| 02 | after-add-bg | bg 追加 |
| 03 | after-add-text | text 追加 |
| 04 | after-add-ksc | ksc 追加 |
| 05 | after-add-text-2 | text 追加 |
| 06 | after-add-timeline | timeline 追加 |
| 07 | after-add-text-3 | text 追加 |
| 08 | after-add-battle | battle 追加 |
| 09 | after-add-text-4 | text 追加 |
| 10-21 | prop-00〜11 | 全12ブロック プロパティパネル |
| 22 | after-save | 保存完了 |
| 23-28 | preview-* | プレビュー6段階 |
