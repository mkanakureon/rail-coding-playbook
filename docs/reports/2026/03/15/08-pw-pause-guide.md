# PW_PAUSE ブラウザ確認モード ガイド

## 使い方

```bash
# ブラウザを開いたまま確認（テスト完了後に一時停止）
PW_PAUSE=1 npx playwright test tests/block-coverage/press/rec-basic-display.spec.ts \
  --config=tests/block-coverage/playwright.block-coverage.config.ts --headed

# 通常実行（止まらない、ヘッドレス）
npx playwright test tests/block-coverage/press/rec-basic-display.spec.ts \
  --config=tests/block-coverage/playwright.block-coverage.config.ts
```

## 仕組み

- `editor-actions.ts` の `finishTest(page)` が末尾で `page.pause()` を呼ぶ
- `PW_PAUSE=1` が設定されていない場合はスキップ（通常実行に影響なし）
- 一時停止中は Playwright Inspector が開く。Inspector を閉じるとテスト終了

## 注意点

### 1. `--headed` を忘れない

`PW_PAUSE=1` だけだとヘッドレスモードで `page.pause()` が呼ばれてハングする。**必ず `--headed` を付ける。**

```bash
# NG — ハングする
PW_PAUSE=1 npx playwright test ...

# OK
PW_PAUSE=1 npx playwright test ... --headed
```

### 2. タイムアウトに注意

テストのタイムアウトは 300秒（5分）。Inspector を開いたまま5分放置するとタイムアウトで失敗する。長時間確認する場合はテストファイルの `test.setTimeout()` を延長する。

### 3. テスト結果は pause 前に確定

`finishTest(page)` は `expect()` の**後**に呼ばれる。つまり一時停止時点でテストの合否は既に確定している。ブラウザで確認した結果「これは失敗では？」と思っても、テスト自体は passed になることがある。

### 4. ローカルサーバーが必要

E2E テストはローカルの API / Editor / Preview サーバーに接続する。事前に起動しておくこと。

```bash
./scripts/dev-start.sh api editor preview
```

### 5. 公式アセットがローカル DB に必要

bg 選択テストは公式アセットからファンタジーカテゴリの画像を選択する。ローカル DB に `official_assets` がないと失敗する。

```bash
# 確認
psql postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev \
  -c "SELECT COUNT(*) FROM official_assets;"
```

0件の場合は Azure DB から同期が必要。

### 6. `from=editor` を URL に付けない

プレビュー URL に `from=editor` があると postMessage モードになり、黒画面でハングする。`runPreview()` ヘルパーは修正済みだが、手動でURL を書く場合は注意。

```bash
# NG — 黒画面
http://localhost:5175/ksc-demo.html?work=xxx&from=editor

# OK — API経由で取得
http://localhost:5175/ksc-demo.html?work=xxx&page=001
```

## 対応テストファイル

全4テストに `finishTest(page)` を追加済み:

- `rec-basic-display.spec.ts`
- `rec-effects.spec.ts`
- `rec-logic.spec.ts`
- `rec-special.spec.ts`
