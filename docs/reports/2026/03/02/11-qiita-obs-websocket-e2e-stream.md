---
title: "OBS WebSocketでE2Eテストをライブ配信する：CLIツールの作り方"
tags:
  - claudecode
  - OBS
  - WebSocket
  - Playwright
  - E2E
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

## はじめに

AI（Claude Code）がコードを書いてテストを実行する様子を YouTube Live で配信したい。OBS Studio を手動で操作するのは面倒なので、**CLI から配信・録画を制御できるツール**を作った。ついでに E2E テストの出力を「動画映え」するように改善した。

## 前提・環境

| 項目 | 値 |
|------|-----|
| OBS Studio | 30.x |
| obs-websocket | 5.x（OBS 28+ に内蔵） |
| Node.js | 20+ |
| npm パッケージ | `obs-websocket-js` |
| E2E | Playwright |

## 手順①: obs-stream.mjs の実装

### インストール

```bash
npm install obs-websocket-js
```

### OBS 側の設定

OBS Studio → Tools → WebSocket Server Settings → Enable にチェック。パスワードを設定した場合は `.env` に記載する。

```env
OBS_WS_PASSWORD=your_password_here
OBS_WS_PORT=4455
```

### CLI 本体

```javascript
#!/usr/bin/env node
import OBSWebSocket from "obs-websocket-js";

const WS_PORT = process.env.OBS_WS_PORT || "4455";
const WS_PASSWORD = process.env.OBS_WS_PASSWORD || "";

async function connect() {
  const obs = new OBSWebSocket();
  try {
    await obs.connect(`ws://127.0.0.1:${WS_PORT}`, WS_PASSWORD || undefined);
  } catch (err) {
    console.error("Failed to connect to OBS WebSocket");
    console.error("Make sure OBS Studio is running and WebSocket server is enabled.");
    process.exit(1);
  }
  return obs;
}
```

### コマンド一覧

| コマンド | 動作 |
|---------|------|
| `start` | 配信 + 録画を開始 |
| `stop` | 配信 + 録画を停止 |
| `rec` | 録画のみ開始 |
| `rec-stop` | 録画のみ停止 |
| `status` | 現在の状態を表示 |

```bash
node scripts/obs-stream.mjs rec       # 録画開始
node scripts/obs-stream.mjs rec-stop  # 録画停止
node scripts/obs-stream.mjs status    # 状態確認
```

### 二重起動防止

開始前に現在の状態を確認する:

```javascript
async function rec(obs) {
  const recordStatus = await obs.call("GetRecordStatus");
  if (recordStatus.outputActive) {
    console.log("Recording is already active. Skipping start.");
  } else {
    await obs.call("StartRecord");
    console.log("Recording started.");
  }
}
```

停止時にはファイルパスも表示:

```javascript
async function recStop(obs) {
  const recordStatus = await obs.call("GetRecordStatus");
  if (recordStatus.outputActive) {
    const result = await obs.call("StopRecord");
    console.log(`Recording stopped. File: ${result.outputPath}`);
  } else {
    console.log("Recording is not active. Skipping stop.");
  }
}
```

## 手順②: ステータス表示

```javascript
async function status(obs) {
  const stream = await obs.call("GetStreamStatus");
  const record = await obs.call("GetRecordStatus");
  console.log("=== OBS Status ===");
  console.log(`Stream: ${stream.outputActive ? "LIVE" : "OFF"}`);
  console.log(`Record: ${record.outputActive ? "REC" : "OFF"}`);
}
```

## 手順③: E2Eテストを動画映えさせる

Playwright のテスト名を日本語にし、`test.step()` で構造化する。

### Before

```typescript
test('loads ksc demo and shows title', async ({ page }) => {
  await page.goto('/ksc-demo.html');
  await expect(page.locator('.title')).toBeVisible();
});
```

出力: `✓ loads ksc demo and shows title (2s)`

### After

```typescript
test('KSCデモ — タイトル画面の表示確認', async ({ page }) => {
  await test.step('デモページを開く', async () => {
    await page.goto('/ksc-demo.html');
  });
  await test.step('タイトル画面が表示される', async () => {
    await expect(page.locator('.title')).toBeVisible();
  });
});
```

出力:

```
✓ KSCデモ — タイトル画面の表示確認 (2s)
  ✓ デモページを開く
  ✓ タイトル画面が表示される
```

視聴者が「今何をテストしているか」一目でわかる。

## ハマったポイント

### WebSocket 接続タイミング

OBS が起動していない状態で接続するとエラーメッセージがわかりにくい。接続失敗時に具体的な手順を表示するようにした。

### .env の読み込み

`obs-websocket-js` はブラウザでも動くパッケージなので `dotenv` に依存していない。`.env` は最小限の自前ローダー（15行）で読み込んだ。

## Claude Code Skills との統合

OBS 制御を Claude Code のスキルとして登録し、「録画開始」「録画停止」と言うだけで制御できるようにした。オープニング・エンディングのバナーも自動表示される。

## まとめ

- `obs-websocket-js` で OBS を CLI から制御できる（185行）
- 二重起動チェック + 状態表示で安全に操作
- E2E テスト名を日本語 + `test.step()` で構造化すると配信映えする
- Claude Code Skills に統合すれば「録画開始」の一言で制御可能

---
OBS の WebSocket 対応は正直あまり知られていない気がする。
GUI を手動操作するのが当たり前だったが、CLI から制御できると
AI が自律的に「録画開始→作業→録画停止」まで完結する。
kaedevn の開発配信は、人間がボタンを押す回数がどんどん減っている。

　　　　　　　　　　Claude Opus 4.6
