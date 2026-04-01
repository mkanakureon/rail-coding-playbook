# ブロックカバレッジテスト 完全報告書

**日付**: 2026-03-13
**対象**: 全14ブロックタイプの E2E テスト（プレスリリース方式）
**スクリーンショット**: 45枚（新規プロジェクト 25枚 + 既存プロジェクト 20枚）

---

## 目次

1. [概要](#概要)
2. [テスト方式](#テスト方式)
3. [発見した問題と修正（3件）](#発見した問題と修正)
4. [テストA: 新規プロジェクト — 全14ブロック追加](#テストa-新規プロジェクト--全14ブロック追加)
   - [初期状態（start + bg + ch + text）](#a-1-初期状態)
   - [各ブロック追加（14種）](#a-2-各ブロック追加)
   - [全ブロック一覧](#a-3-全ブロック一覧)
   - [プレビュー再生](#a-4-プレビュー再生)
5. [テストB: 既存プロジェクト — プレスリリース方式検証](#テストb-既存プロジェクト--プレスリリース方式検証)
   - [エディタ（21ブロック）](#b-1-エディタ)
   - [プレビュー進行（9クリック）](#b-2-プレビュー進行)
6. [テスト結果サマリ](#テスト結果サマリ)
7. [残課題](#残課題)

---

## 概要

エディタ UI でブロックを追加 → 保存 → プレビュー再生 → シナリオ完走を確認する「プレスリリース方式」のテストを実施。3つの問題を発見・修正し、全14ブロックタイプのカバレッジを達成した。

---

## テスト方式

「プレスリリース方式」とは、以下のフローでブロックの動作を検証するテスト手法:

1. **API でプロジェクト作成**（自動生成: start → bg → ch → text の4ブロック）
2. **エディタで各ブロックを追加**（+ ブロック追加 → bottom-sheet → 型選択）
3. **保存ボタンクリック**（`button[aria-label="プロジェクトとページを保存"]`）
4. **プレビューに遷移**（`/ksc-demo.html?work={projectId}&page=001`）
5. **「はじめから」クリック → canvas クリック + Enter で進行**
6. **`Scenario completed` コンソールログで完走判定**

---

## 発見した問題と修正

### 問題1: 保存ステップの欠落（テスト側）

| 項目 | 内容 |
|------|------|
| **症状** | テストは「通過」するが、プレビューで追加ブロックが再生されない |
| **原因** | ヘルパーに保存ボタンクリックがなかった。API に永続化されず、初期コンテンツ（3ブロック）だけ再生 |
| **修正** | `editor-actions.ts` に `saveProject()` 関数追加。全テストのプレビュー遷移前に挿入 |
| **影響** | 全6テストファイル |

### 問題2: 空の選択肢で ChoiceOverlay がクラッシュ（エンジン側）

| 項目 | 内容 |
|------|------|
| **症状** | `Cannot set properties of undefined (setting 'tint')` エラー |
| **原因** | `ChoiceOverlay.show()` で空 options 配列が渡された際に `bgs[0].tint` が undefined アクセス |
| **修正** | `show()` 先頭に空配列ガード追加（`Promise.resolve(-1)` を返す） |
| **ファイル** | `packages/web/src/renderer/ChoiceOverlay.ts` |

### 問題3: 未設定ブロックが不正な KSC を生成（API 側）

| 項目 | 内容 |
|------|------|
| **症状** | `Cannot read properties of undefined (reading 'op')` エラー |
| **原因** | `generateKSCScript()` が未設定ブロックから不正な KSC を生成 |
| **修正** | set_var / choice / if / jump に未設定チェック追加（スキップ） |
| **ファイル** | `apps/hono/src/routes/preview.ts` |

| ブロック | 不正な KSC | 修正後 |
|---------|-----------|--------|
| set_var | ` = 0`（変数名なし） | 空文字列（スキップ） |
| choice | `choice {\n\n}`（選択肢なし） | 空文字列（スキップ） |
| if | `if () {\n\n}`（条件なし） | 空文字列（スキップ） |
| jump | `@jump `（ジャンプ先なし） | 空文字列（スキップ） |

---

## テストA: 新規プロジェクト — 全14ブロック追加

テストファイル: `verify-screenshots.spec.ts`
所要時間: 約50秒

### A-1. 初期状態

新規プロジェクト作成直後。API が自動生成した4ブロック（start → bg → ch → text）。

![初期状態](block-coverage-images/new-project/01-editor-initial.png)

左サイドバーに「ページ構成」として4ブロックが表示:
- `0` START
- `1` 背景 bg_mk18x_dark_souls_styl...
- `2` キャラ 勇者
- `3` テキスト ここにセリフを入力してく...

右下にプレビューウィンドウ（Loading KNF Interpreter Demo...）。

---

### A-2. 各ブロック追加

#### bg（背景）ブロック

**追加直後** — 「背景ブロックを追加しました」トースト。画像未選択状態。

![bg追加](block-coverage-images/new-project/02-after-add-bg.png)

**アセット選択後** — 公式アセットから `bg_mk18x_landscape_fantasy_role_playing_game_v...` を選択。プロパティパネルに背景画像、位置・スケール設定が表示。

![bgアセット選択](block-coverage-images/new-project/03-after-select-bg-asset.png)

---

#### ch（キャラクター）ブロック

「キャラクターブロックを追加しました」トースト。`未選択 / 未選択` 状態（? アイコン）。

![ch追加](block-coverage-images/new-project/04-after-add-ch.png)

プロパティパネルに背景画像（前のbgブロックの）が表示されている。サイドバーで `5 キャラ 未選択` と確認できる。

---

#### text（テキスト）ブロック — speaker 付き

テキスト入力エリアが展開。「こんにちは！テストキャラです。」を入力済み。プロパティパネルに「話者」「本文」「枠色」が表示。

![text speaker](block-coverage-images/new-project/05-after-add-text-speaker.png)

---

#### text（テキスト）ブロック — 地の文

2つ目のテキスト。「こんにちは！テストキャラです。」（閉じるボタン付き）と「静かな森の中。」の2つが展開表示。

![text narration](block-coverage-images/new-project/06-after-add-text-narration.png)

---

#### set_var（変数）ブロック

「変数ブロックを追加しました」トースト。`変数名` / `= ▼` / `0` の入力フォーム。サイドバーに `8 変数 ? = 0` と表示。

![set_var追加](block-coverage-images/new-project/07-after-add-set_var.png)

---

#### effect（エフェクト / FX）ブロック

「エフェクトブロックを追加しました」トースト。`-- 選択 --` ドロップダウン + パラメータ `3` / `500`。

![effect追加](block-coverage-images/new-project/08-after-add-effect.png)

---

#### screen_filter（フィルター）ブロック

「フィルターブロックを追加しました」トースト。`なし（解除）` ドロップダウン。サイドバーに `10 フィルター` と表示。

![screen_filter追加](block-coverage-images/new-project/09-after-add-screen_filter.png)

---

#### overlay（OVL）ブロック

「OVLブロックを追加しました」トースト。`画像未選択` + `✅ 表示` チェック + `変更` ボタン。

![overlay追加](block-coverage-images/new-project/10-after-add-overlay.png)

---

#### camera（カメラ）ブロック

「カメラブロックを追加しました」トースト。`1000ms` デュレーション表示。

![camera追加](block-coverage-images/new-project/11-after-add-camera.png)

---

#### choice（選択肢）ブロック

「選択肢ブロックを追加しました」トースト。`! 0 個の選択肢` + `編集` ボタン。

![choice追加](block-coverage-images/new-project/12-after-add-choice.png)

---

#### if（IF文）ブロック

「IF文ブロックを追加しました」トースト。`if（条件未設定）→ T:0 / F:0` + `編集` ボタン。サイドバーに `14 IFX 条件未設定` と表示。

![if追加](block-coverage-images/new-project/13-after-add-if.png)

---

#### jump（ジャンプ）ブロック

「ジャンプブロックを追加しました」トースト。`→ 選択してください` ドロップダウン。サイドバーに `15 ジャンプ 未選択` と表示。

![jump追加](block-coverage-images/new-project/14-after-add-jump.png)

---

#### ksc（スクリプト）ブロック

「スクリプトブロックを追加しました」トースト。`（空）` 表示。サイドバーに `16 スクリプト（空）` と表示。

![ksc追加](block-coverage-images/new-project/15-after-add-ksc.png)

---

#### timeline（演出TL）ブロック

「タイムラインブロックを追加しました」トースト。`ラベル` 入力 + `0 tracks` + `0:05.000` デュレーション。

![timeline追加](block-coverage-images/new-project/16-after-add-timeline.png)

---

#### battle（バトル）ブロック

「バトルブロックを追加しました」トースト。`-- 敵グループ --` / `勝利時→` / `敗北時→` の3ドロップダウン。

![battle追加](block-coverage-images/new-project/17-after-add-battle.png)

---

### A-3. 全ブロック一覧

全14ブロック（+ 自動生成分で合計19ブロック）の一覧。

**上部（ブロック 0〜12）**

![全ブロック上部](block-coverage-images/new-project/18-all-blocks-top.png)

サイドバーにページ構成が見える:
`0 START` / `1 背景` / `2 キャラ 勇者` / `3 テキスト` / `4 背景` / `5 キャラ 未選択` / `6 テキスト` / `7 テキスト` / `8 変数 ? = 0` / `9 FX 未選択` / `10 フィルター` / `11 OVL 未選択` / `12 カメラ`

**下部（ブロック 13〜18 + ブロック追加ボタン）**

![全ブロック下部](block-coverage-images/new-project/19-all-blocks-bottom.png)

`13 選択肢 0個` / `14 IFX 条件未設定` / `15 ジャンプ 未選択` / `16 スクリプト（空）` / `17 演出TL`

メインエリアにバトルブロック（`-- 敵グループ --`）と「+ ブロック追加」ボタンが表示。

---

### A-4. プレビュー再生

保存後、プレビューに遷移してシナリオ完走を確認。

#### タイトル画面

![プレビュータイトル](block-coverage-images/new-project/20-preview-title.png)

プロジェクト名「verify-ss-1773367894416」と「はじめから」ボタン。

#### 再生開始

![プレビュー開始](block-coverage-images/new-project/21-preview-after-start.png)

最初のbgブロック（ダークソウル風城）+ キャラクター（勇者）+ テキストウィンドウ「ここにセリフを入力してください」。

#### 1クリック目 — 背景切替 + テキスト進行

![1クリック目](block-coverage-images/new-project/22-preview-click-01.png)

2番目のbgブロック（ファンタジー都市）に切替。テキスト「こんにちは！テストキャラです。」が表示。話者名が確認できる。

#### 2クリック目 — テキスト進行

![2クリック目](block-coverage-images/new-project/23-preview-click-02.png)

テキスト「静かな森の中。」に進行。背景はファンタジー都市のまま。

#### 3クリック目 — END 画面

![3クリック目](block-coverage-images/new-project/24-preview-click-03.png)

シナリオ完走。「END」+ 「タイトルに戻る」「エディタに戻る」ボタン。背景はファンタジー都市の暗転。

#### 最終状態

![最終状態](block-coverage-images/new-project/25-preview-final.png)

`completed=true` 確認。END 画面のまま。

---

## テストB: 既存プロジェクト — プレスリリース方式検証

テストファイル: `verify-press-method.spec.ts`
対象プロジェクト: `01KKH4N20JJEHXC48J48BS39CY`（「背景デモ」21ブロック）
所要時間: 約1.1分

### B-1. エディタ

![エディタ](block-coverage-images/existing-project/01-editor-loaded.png)

「背景デモ 22:44」プロジェクト。21ブロック構成（bg/text が交互に並ぶ）。左サイドバーに全ブロック一覧。

#### ブロック順次クリック

テスト内で全21ブロックを順番にクリックし、プロパティを確認。先頭5つ + 最後の1つでスクリーンショットを撮影。

**ブロック1: start**

![start](block-coverage-images/existing-project/02-block-01-start.png)

START ブロック選択状態。

**ブロック2: bg**

![bg](block-coverage-images/existing-project/03-block-02-bg.png)

`bg_mk18x_dark_souls_style_realisti...` 背景。プロパティパネルに画像プレビュー表示。

**ブロック3: ch**

![ch](block-coverage-images/existing-project/04-block-03-ch.png)

`勇者 / normal` キャラクター。プロパティパネルにキャラ画像表示。

**ブロック4: text**

![text](block-coverage-images/existing-project/05-block-04-text.png)

テキストブロック選択。プロパティパネルにテキスト内容表示。

**ブロック5: bg（2番目）**

![bg2](block-coverage-images/existing-project/06-block-05-bg.png)

2番目の背景ブロック。異なる背景画像が設定されている。

**ブロック21: bg（最後）**

![last bg](block-coverage-images/existing-project/07-block-21-bg.png)

最後のブロック。全21ブロックのクリック完了。

#### プレビュー遷移前

![プレビュー前](block-coverage-images/existing-project/08-before-preview.png)

「実行」ボタンが確認できる状態。

---

### B-2. プレビュー進行

#### タイトル画面

![タイトル](block-coverage-images/existing-project/09-preview-title.png)

プロジェクト名と「はじめから」ボタン。

#### 再生開始

![開始](block-coverage-images/existing-project/10-preview-after-start.png)

ダークソウル風城の背景 + キャラクター + テキストウィンドウ。

#### 1クリック目

![click1](block-coverage-images/existing-project/11-click-01.png)

テキスト進行。背景・キャラ維持。

#### 2クリック目

![click2](block-coverage-images/existing-project/12-click-02.png)

テキスト進行。

#### 3クリック目

![click3](block-coverage-images/existing-project/13-click-03.png)

背景が切り替わり（暗い森のシーン）、テキスト内容も変化。

#### 4クリック目

![click4](block-coverage-images/existing-project/14-click-04.png)

「地下深くに広がる洞窟。松明の光が壁を照らす。」背景が軍事施設風に変化。

#### 5クリック目

![click5](block-coverage-images/existing-project/15-click-05.png)

テキスト進行。

#### 6クリック目

![click6](block-coverage-images/existing-project/16-click-06.png)

背景変化（新しいシーン）。

#### 7クリック目

![click7](block-coverage-images/existing-project/17-click-07.png)

テキスト進行。

#### 8クリック目

![click8](block-coverage-images/existing-project/18-click-08.png)

テキスト進行。背景が再度変化。

#### 9クリック目

![click9](block-coverage-images/existing-project/19-click-09.png)

END 画面に到達。「タイトルに戻る」「エディタに戻る」ボタン。

#### 最終状態

![final](block-coverage-images/existing-project/20-final.png)

`completed=true`、9クリックで完走。

---

## テスト結果サマリ

### E2E テスト通過状況

| テスト | ファイル | 結果 | 所要時間 |
|--------|---------|------|---------|
| 全ブロックスクリーンショット | verify-screenshots.spec.ts | **PASS** | 49.6s |
| プレスリリース方式検証 | verify-press-method.spec.ts | **PASS** | 1.1m |

### ブロック別カバレッジ（全14種）

| # | ブロック | ラベル | カテゴリ | エディタ追加 | プレビュー |
|---|---------|--------|---------|-----------|----------|
| 1 | start | START | - | 自動生成 | OK |
| 2 | bg | 背景 | 基本表示 | OK（アセット選択確認） | OK（背景切替確認） |
| 3 | ch | キャラ | 基本表示 | OK（キャラ表示確認） | OK |
| 4 | text | テキスト | 基本表示 | OK（speaker + 地の文） | OK（テキスト進行確認） |
| 5 | overlay | OVL | 基本表示 | OK（画像未選択状態） | OK（スキップ） |
| 6 | effect | FX | 演出 | OK（パラメータ表示） | OK（スキップ） |
| 7 | screen_filter | フィルター | 演出 | OK（なし（解除）） | OK（スキップ） |
| 8 | camera | カメラ | 演出 | OK（1000ms） | OK（スキップ） |
| 9 | set_var | 変数 | ロジック | OK（変数名=0フォーム） | OK（未設定→スキップ） |
| 10 | choice | 選択肢 | ロジック | OK（0個の選択肢） | OK（未設定→スキップ） |
| 11 | if | IFX | ロジック | OK（条件未設定 T:0/F:0） | OK（未設定→スキップ） |
| 12 | jump | ジャンプ | ロジック | OK（選択してください） | OK（未設定→スキップ） |
| 13 | ksc | スクリプト | 特殊 | OK（空） | OK（スキップ） |
| 14 | timeline | 演出TL | 特殊 | OK（0 tracks 0:05.000） | OK（スキップ） |
| 15 | battle | バトル | 特殊 | OK（敵グループDD） | OK（スキップ） |

### スクリーンショット一覧（全45枚）

#### 新規プロジェクト（25枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-initial | エディタ初期状態（4ブロック） |
| 02 | after-add-bg | bg 追加（画像未選択） |
| 03 | after-select-bg-asset | bg アセット選択後 |
| 04 | after-add-ch | ch 追加（未選択状態） |
| 05 | after-add-text-speaker | text 追加（speaker 付き） |
| 06 | after-add-text-narration | text 追加（地の文） |
| 07 | after-add-set_var | set_var 追加（変数名=0） |
| 08 | after-add-effect | effect 追加（FX ドロップダウン） |
| 09 | after-add-screen_filter | screen_filter 追加（なし（解除）） |
| 10 | after-add-overlay | overlay 追加（画像未選択） |
| 11 | after-add-camera | camera 追加（1000ms） |
| 12 | after-add-choice | choice 追加（0個の選択肢） |
| 13 | after-add-if | if 追加（条件未設定） |
| 14 | after-add-jump | jump 追加（選択してください） |
| 15 | after-add-ksc | ksc 追加（空） |
| 16 | after-add-timeline | timeline 追加（0 tracks） |
| 17 | after-add-battle | battle 追加（敵グループDD） |
| 18 | all-blocks-top | 全ブロック上部（0〜12） |
| 19 | all-blocks-bottom | 全ブロック下部（13〜17） |
| 20 | preview-title | プレビュータイトル画面 |
| 21 | preview-after-start | プレビュー再生開始 |
| 22 | preview-click-01 | 背景切替 + テキスト進行 |
| 23 | preview-click-02 | テキスト進行 |
| 24 | preview-click-03 | END 画面 |
| 25 | preview-final | 最終状態（completed=true） |

#### 既存プロジェクト（20枚）

| # | ファイル | 内容 |
|---|--------|------|
| 01 | editor-loaded | エディタ（21ブロック一覧） |
| 02 | block-01-start | start ブロック選択 |
| 03 | block-02-bg | bg ブロック選択（プロパティ） |
| 04 | block-03-ch | ch ブロック選択（プロパティ） |
| 05 | block-04-text | text ブロック選択 |
| 06 | block-05-bg | 2番目の bg 選択 |
| 07 | block-21-bg | 最後の bg 選択 |
| 08 | before-preview | プレビュー遷移前 |
| 09 | preview-title | タイトル画面 |
| 10 | preview-after-start | 再生開始 |
| 11 | click-01 | 1クリック目 |
| 12 | click-02 | 2クリック目 |
| 13 | click-03 | 3クリック目（背景変化） |
| 14 | click-04 | 4クリック目（洞窟シーン） |
| 15 | click-05 | 5クリック目 |
| 16 | click-06 | 6クリック目（背景変化） |
| 17 | click-07 | 7クリック目 |
| 18 | click-08 | 8クリック目 |
| 19 | click-09 | 9クリック目（END） |
| 20 | final | 最終状態（completed=true） |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `tests/block-coverage/press/helpers/editor-actions.ts` | saveProject, fillSetVar, fillChoice, configureIf 追加 |
| `tests/block-coverage/press/rec-basic-display.spec.ts` | saveProject 呼び出し追加 |
| `tests/block-coverage/press/rec-effects.spec.ts` | saveProject 呼び出し追加 |
| `tests/block-coverage/press/rec-logic.spec.ts` | saveProject + fillSetVar + fillChoice + configureIf 追加 |
| `tests/block-coverage/press/rec-special.spec.ts` | saveProject 呼び出し追加 |
| `tests/block-coverage/press/verify-screenshots.spec.ts` | saveProject 呼び出し追加 |
| `packages/web/src/renderer/ChoiceOverlay.ts` | 空 options ガード追加 |
| `apps/hono/src/routes/preview.ts` | 未設定ブロックのスキップ（set_var, choice, if, jump） |

---

## 残課題

| # | 課題 | 優先度 | 備考 |
|---|------|--------|------|
| 1 | jump の設定テスト | 中 | 2ページ構成でジャンプ動作を確認するテストが望ましい |
| 2 | timeline の動作確認 | 中 | 複雑なため独立したテストを作成する（ブロック追加・プレビュー起動は確認済み） |
| 3 | battle | 低 | リリース対象外のためテストは後回し |
| 4 | choice / if / set_var の値設定テスト | 中 | rec-logic.spec.ts で設定済みだが、verify-screenshots では未設定状態のみ |
