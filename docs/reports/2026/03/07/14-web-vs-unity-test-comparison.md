# Web（Playwright） vs Unity テスト自動化比較

## 概要

kaedevn のブロックエディタ E2E テストで実現している「外部スクリプトからマウス操作 → UI 検証 → プレイ完走」を Unity で同等に実現できるかの比較。

## 機能比較

| 項目 | Playwright（Web） | Unity |
|------|-------------------|-------|
| マウス操作 | `page.mouse.click(x, y)` | OS レベルの入力シミュレーションが必要 |
| 要素の検出 | DOM セレクタ（`.class`, `text=`, `[data-testid]`） | ゲームオブジェクト名 or 座標指定 |
| テキスト入力 | `textarea.fill()` / `.type()` | IME 制御が複雑 |
| 画面の読み取り | DOM の状態を直接取得 | スクリーンショット + OCR or API 経由 |
| 新しいウィンドウ | `context.waitForEvent('page')` | プロセス間通信が必要 |
| コンソールログ監視 | `page.on('console', ...)` | ログファイル監視 or WebSocket |
| 状態の取得 | `page.evaluate(() => ...)` で JS 直接実行 | API を用意しないと外から見えない |
| localStorage | `page.evaluate(() => localStorage.setItem(...))` | PlayerPrefs（外部アクセス不可） |
| ネットワーク傍受 | `page.route()` / `request.post()` | プロキシ or Unity 内部フック |
| CI / ヘッドレス | 標準対応 | Unity Batch Mode（制限あり） |
| セットアップ | `npm install` のみ | Unity Editor + Test Framework + SDK |

## Unity を外部からマウス操作する方法

### 1. OS レベルの入力シミュレーション

- **macOS**: `cliclick` コマンド、`pyautogui`（Python）
- **Windows**: `pyautogui`、`AutoHotKey`
- 座標固定なのでウィンドウ位置・解像度に依存
- UI 要素の状態を取得する手段がない

### 2. Unity Test Framework（内部テスト）

- Unity エディタ内で動作する公式テストフレームワーク
- `InputTestFixture` でマウス・キーボード入力をシミュレート
- PlayMode テストでゲームを実行しながらテスト可能
- 制約: Unity エディタが必要、外部ツールとの連携が限定的

### 3. WebSocket ブリッジ（カスタム実装）

- Unity に WebSocket サーバーを組み込む
- 外部スクリプトから JSON コマンドを送信: `{"action":"click","x":400,"y":300}`
- 状態の取得も可能: `{"query":"getBlockCount"}` → `{"result":6}`
- 開発コストが高い（プロトコル設計 + Unity 側実装が必要）

### 4. Airtest / Poco（ゲーム自動化ツール）

- NetEase 製のゲーム自動化フレームワーク
- Unity SDK（Poco SDK）を入れると UI 要素ツリーで操作可能
- Python スクリプトでテストを記述
- 画像認識ベースのフォールバックあり
- 制約: SDK の導入が必要、日本語ドキュメントが少ない

## Playwright が圧倒的に有利な理由

### DOM の存在

Web には DOM（Document Object Model）がある。UI 要素をセレクタで一意に特定できる。

```typescript
// Web: セレクタで要素を特定してクリック
await page.locator('button:has-text("背景")').click();
await page.locator('[data-block-id]').last().click();
```

Unity にはこれに相当するものがない。画面上の座標か、ゲームオブジェクト名でしかアクセスできない。

### 状態の直接取得

```typescript
// Web: ブラウザ内で JS を実行して何でも取れる
const blockCount = await page.locator('[data-block-id]').count();
const isModalOpen = await page.locator('.bottom-sheet').isVisible();
```

Unity は外部からゲームの内部状態を取得する標準的な方法がない。API を用意する必要がある。

### イベント監視

```typescript
// Web: コンソールログを監視してシナリオ完了を検出
playPage.on('console', (msg) => {
  if (msg.text().includes('Scenario completed')) completed = true;
});
```

Unity では Player.log ファイルを tail するか、WebSocket で送信する仕組みを自作する必要がある。

## kaedevn における結論

kaedevn が Web ベース（PixiJS / React）であることは、開発・テストの両面で大きなメリット。

- **今回の E2E テスト**: Playwright だけで「プロジェクト作成 → ログイン → エディタ操作 → アセット選択 → テキスト入力 → プレイ完走」を約2.5分で全自動実行
- **OBS 連携**: `obs-websocket-js` で録画制御 + テキストオーバーレイも数行で実現
- **CI 対応**: ヘッドレスモードでそのまま CI に載せられる

Switch 版を Unity で作る場合、同じレベルの E2E テストを組むには相当な基盤工事（WebSocket ブリッジ、状態取得 API、入力シミュレーション）が必要になる。Web 版でのテスト資産は Switch 版には直接移植できないため、テスト戦略を分ける必要がある。

## 推奨アプローチ（Switch 版を作る場合）

| テストレベル | Web 版 | Switch / Unity 版 |
|------------|--------|-------------------|
| E2E（UI 操作） | Playwright（現行） | Unity Test Framework + Poco |
| API テスト | Playwright request | 同じ（API は共通） |
| エンジンロジック | Jest / Vitest | Unity Test Framework |
| ビジュアル確認 | スクリーンショット比較 | Unity Graphic Tests |
| プレイテスト | canvas クリック | Unity PlayMode テスト |
