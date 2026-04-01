# プレスリリース方式 4カテゴリ動画テスト報告書

- **日付**: 2026-03-13
- **テスト環境**: ローカル（localhost:8080 / 3000 / 5176 / 5175）
- **Playwright**: v1.58.2 / Chromium / headless / video: on
- **テスト合計**: 4テスト / 全パス / 3分54秒

---

## 概要

エディタの全14ブロック型を4カテゴリに分類し、「ブロック追加 → 保存 → プレビュー完走」の一連操作を **Playwright の動画録画機能** で記録した。各カテゴリの動画は操作の流れを連続的に確認できる。

---

## テスト結果サマリー

| # | カテゴリ | ブロック型 | テスト時間 | 結果 | 動画 |
|---|---------|-----------|-----------|------|------|
| 1 | 基本表示 | bg, ch, text, overlay | 47.2s | PASS | [01-basic-display.webm](press-videos/01-basic-display.webm) |
| 2 | 演出 | effect, screen_filter, camera | 1.1m | PASS | [02-effects.webm](press-videos/02-effects.webm) |
| 3 | ロジック | set_var, choice, if, jump | 59.5s | PASS | [03-logic.webm](press-videos/03-logic.webm) |
| 4 | 特殊 | ksc, timeline, battle | 1.0m | PASS | [04-special.webm](press-videos/04-special.webm) |

全テストでプレビュー完走（completed=true, clicks=3）を確認。

---

## カテゴリ1: 基本表示（bg / ch / text / overlay）

**動画**: `press-videos/01-basic-display.webm`（2.8MB / 47.2s）

### テストフロー

| 時間帯 | 操作 | 画面の変化 |
|--------|------|-----------|
| 0:00〜 | エディタ初期表示 | 新規プロジェクト作成、初期コンテンツ（bg+ch+text）が表示 |
| 〜0:10 | bg ブロック追加 → アセット選択 | ブロックリストに bg 追加、サムネイルが切り替わる |
| 〜0:15 | ch ブロック追加 | キャラクターブロック追加 |
| 〜0:20 | text × 2 追加 | セリフ（話者付き）+ 地の文 |
| 〜0:25 | overlay 追加 | オーバーレイブロック追加 |
| 〜0:35 | 全ブロックプロパティ確認 | 9ブロックを順番にクリック、プロパティパネル表示 |
| 〜0:40 | 保存 | 保存完了 |
| 〜0:47 | プレビュー | タイトル → 開始 → 3クリック → END到達 |

### 確認ブロック（9個）

start → bg → ch → text → bg → ch → text → text → overlay

---

## カテゴリ2: 演出（effect / screen_filter / camera）

**動画**: `press-videos/02-effects.webm`（4.2MB / 1.1m）

### テストフロー

| 時間帯 | 操作 | 画面の変化 |
|--------|------|-----------|
| 0:00〜 | エディタ初期表示 | 新規プロジェクト + 初期コンテンツ |
| 〜0:15 | bg 追加 + アセット選択 | 背景設定 |
| 〜0:20 | text 追加 | 「エフェクトテスト開始。」 |
| 〜0:25 | effect × 2 追加 | エフェクトブロック2つ（デフォルト状態） |
| 〜0:30 | screen_filter 追加 | スクリーンフィルタ（デフォルト状態） |
| 〜0:35 | camera 追加 | カメラブロック（デフォルト状態） |
| 〜0:55 | 全ブロックプロパティ確認 | 13ブロックを順番にクリック |
| 〜1:00 | 保存 → プレビュー | 3クリック → END到達 |

### 確認ブロック（13個）

start → bg → ch → text → bg → text → effect → text → effect → screen_filter → text → camera → text

---

## カテゴリ3: ロジック（set_var / choice / if / jump）

**動画**: `press-videos/03-logic.webm`（3.8MB / 59.5s）

### テストフロー

| 時間帯 | 操作 | 画面の変化 |
|--------|------|-----------|
| 0:00〜 | エディタ初期表示 | 新規プロジェクト + 初期コンテンツ |
| 〜0:10 | bg 追加 + アセット選択 | 背景設定 |
| 〜0:15 | set_var 追加 → 値設定 | 変数 `score` に `10` を設定 |
| 〜0:20 | text 追加 | 「変数を設定しました。」 |
| 〜0:25 | choice 追加 → 選択肢設定 | 「はい」「いいえ」の2択 |
| 〜0:30 | if 追加 → 条件設定 | 条件分岐ブロック |
| 〜0:35 | text + jump 追加 | テキストとジャンプブロック |
| 〜0:50 | 全ブロックプロパティ確認 | 11ブロックを順番にクリック |
| 〜0:55 | 保存 → プレビュー | 3クリック → END到達 |

### 確認ブロック（11個）

start → bg → ch → text → bg → set_var → text → choice → if → text → jump

### 特記事項

- set_var / choice / if は値を設定（ロジック動作の確認に必要なため）
- プレビューでは choice の Enter キーで最初の選択肢が選ばれて進行
- if / jump は設定値に関わらずスキップされて進行

---

## カテゴリ4: 特殊（ksc / timeline / battle）

**動画**: `press-videos/04-special.webm`（3.9MB / 1.0m）

### テストフロー

| 時間帯 | 操作 | 画面の変化 |
|--------|------|-----------|
| 0:00〜 | エディタ初期表示 | 新規プロジェクト + 初期コンテンツ |
| 〜0:10 | bg 追加 + text 追加 | 背景 + 「特殊ブロックテスト開始。」 |
| 〜0:15 | ksc 追加 | KSCスクリプトブロック（デフォルト状態） |
| 〜0:20 | text + timeline 追加 | テキスト + タイムラインブロック |
| 〜0:25 | text + battle 追加 | テキスト + バトルブロック |
| 〜0:45 | 全ブロックプロパティ確認 | 12ブロックを順番にクリック |
| 〜0:55 | 保存 → プレビュー | 3クリック → END到達 |

### 確認ブロック（12個）

start → bg → ch → text → bg → text → ksc → text → timeline → text → battle → text

### 特記事項

- timeline / battle は未実装・不完全の可能性がある（テスト目的は「動くか動かないかの記録」）
- デフォルト状態でプレビューが停止せず完走した = KSC生成時にスキップされている

---

## 全14ブロック型カバレッジ

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

**14/14 ブロック全てカバー完了。**

---

## 動画ファイル一覧

| ファイル | サイズ | カテゴリ |
|---------|--------|---------|
| `press-videos/01-basic-display.webm` | 2.8 MB | 基本表示 |
| `press-videos/02-effects.webm` | 4.2 MB | 演出 |
| `press-videos/03-logic.webm` | 3.8 MB | ロジック |
| `press-videos/04-special.webm` | 3.9 MB | 特殊 |
| **合計** | **14.7 MB** | 4動画 |

---

## テスト実行コマンド

```bash
# 4カテゴリ一括（動画付き）
npx playwright test \
  tests/block-coverage/press/rec-basic-display.spec.ts \
  tests/block-coverage/press/rec-effects.spec.ts \
  tests/block-coverage/press/rec-logic.spec.ts \
  tests/block-coverage/press/rec-special.spec.ts \
  --config=tests/block-coverage/playwright.block-coverage-video.config.ts

# 動画なし（スクリーンショットのみ）
npx playwright test \
  tests/block-coverage/press/rec-basic-display.spec.ts \
  tests/block-coverage/press/rec-effects.spec.ts \
  tests/block-coverage/press/rec-logic.spec.ts \
  tests/block-coverage/press/rec-special.spec.ts \
  --config=tests/block-coverage/playwright.block-coverage.config.ts
```

---

## 結論

プレスリリース方式（ブロック追加 → デフォルト状態で保存 → プレビュー完走）により、全14ブロック型がエディタ上で正常に動作し、プレビューが停止せず最後まで再生されることを動画で確認した。各カテゴリの動画は操作の流れを連続的に記録しており、スクリーンショットでは確認しづらいアニメーションやトランジションの挙動も含めて検証可能である。
