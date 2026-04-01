# SidebarPreview 黒画面バグ修正報告

- **実施日**: 2026-03-13
- **報告者**: Claude Opus 4.6
- **対象**: エディタ右パネル SidebarPreview（iframe プレビュー）
- **症状**: ブロック選択時にプレビューが黒画面になることがある
- **結果**: **修正完了。全ブロックでプレビュー正常表示を確認。**

---

## 原因

### 原因 1: テキスト本文がプレビュースクリプトに含まれていた

`buildSnapshotScript()` がテキストブロック選択時にテキスト本文（セリフ・地の文）をスクリプトに含めていた。TyranoScript コンパイラがテキスト行を `text` + `waitClick` オペレーションに変換し、プレビュー iframe 内でクリック待ちのままランナーが停止 → 黒画面。

**該当コード** (`apps/editor/src/store/useEditorStore.ts` L916-922):

```typescript
// 削除前
if (lastText && lastText.body) {
  if (lastText.speaker) {
    lines.push(`@name ${lastText.speaker}`);
  }
  lines.push(lastText.body.replace(/\n/g, '').replace(/@r/g, '\n@r\n'));
}
```

### 原因 2: 未選択ブロック（空 ID）がスクリプトに含まれていた

キャラ未選択（`characterId` が空）や OVL 未選択（`assetId` が空）のブロックがスクリプトに含まれ、`@ch  center` のような無効なコマンドが生成されてコンパイルエラー → 黒画面。

### 原因 3: iframe ハンドシェイクのタイミング問題

`iframe.onLoad` イベントは HTML ロード完了時に発火するが、PixiJS の初期化（`app.init()` — async）はその後に完了する。`onLoad` 直後に `postMessage` を送ると、PixiJS 未初期化のためメッセージが処理されない。

### 原因 4: resolveScenarioConfig のレースコンディション（キャラ画像が表示されない根本原因）

エディタプレビューの iframe URL は `?from=editor&work={workId}` パラメータを含むが、`resolveScenarioConfig()` では `from=editor` が `postmessage` ソースにルーティングされておらず、`source: 'api'` にフォールバックしていた。

結果、iframe が **API からシナリオを fetch** しつつ、エディタからの **postMessage も受信** する二重実行状態になり:
- タイミングによってはキャラ画像が表示されたりされなかったりする不安定な動作
- API fetch が postMessage のプレビュースクリプトを上書きして黒画面になるケース

**該当コード** (`packages/web/src/engine/resolveScenarioConfig.ts` L29-33):

```typescript
// 修正前: ksc-editor のみ postmessage にルーティング
if (params.from === 'ksc-editor' && params.work) {
  return { source: 'postmessage', path: params.work, compiler: 'ksc', scenarioId: params.work };
}

// 修正後: editor も postmessage にルーティング
if ((params.from === 'editor' || params.from === 'ksc-editor') && params.work) {
  const editorCompiler: CompilerMode = params.from === 'ksc-editor' ? 'ksc' : compiler;
  return { source: 'postmessage', path: params.work, compiler: editorCompiler, scenarioId: params.work };
}
```

---

## 修正内容

### コミット 1: `860de8c`

**fix: SidebarPreview 黒画面問題を修正 — テキスト除去 + previewReady ハンドシェイク**

| ファイル | 変更 |
|---------|------|
| `apps/editor/src/store/useEditorStore.ts` | `buildSnapshotScript` からテキスト出力を削除（`lastText` 変数・代入・出力コードを除去） |
| `apps/editor/src/components/sidebar/SidebarPreview.tsx` | `onLoad` → `previewReady` postMessage ベースのハンドシェイクに変更 |
| `packages/web/src/ksc-demo.ts` | PixiJS 初期化＋リスナー登録後に `previewReady` を parent に送信 |

### コミット 2: `477a543`

**fix: buildSnapshotScript で未選択の bg/ch/overlay をスキップ**

| ファイル | 変更 |
|---------|------|
| `apps/editor/src/store/useEditorStore.ts` | `block.assetId`（bg）、`block.characterId`（ch）、`block.assetId`（overlay）の空チェックを追加 |

### コミット 3: (本コミット)

**fix: resolveScenarioConfig で from=editor を postmessage にルーティング**

| ファイル | 変更 |
|---------|------|
| `packages/web/src/engine/resolveScenarioConfig.ts` | `from=editor` を `postmessage` ソースにルーティング。API fetch とのレースコンディションを解消 |

---

## 検証結果

テストプロジェクト: `basic-display-1773396211298`（9ブロック）

| Block | Type | 内容 | プレビュー | 判定 |
|-------|------|------|----------|------|
| 0 | START | ページ開始点 | 黒 | OK（視覚情報なし） |
| 1 | bg | dark_souls 背景 | 背景表示 | OK |
| 2 | ch | 勇者 / normal | 背景 + キャラ | OK |
| 3 | text | 「ここにセリフを〜」 | 背景 + キャラ | OK |
| 4 | bg | fantasy 背景 | 背景表示 | OK |
| 5 | ch | 未選択 / 未選択 | 背景表示 | OK |
| 6 | text | 「こんにちは！〜」 | 背景表示 | OK |
| 7 | text | 「静かな森の中〜」 | 背景表示 | OK |
| 8 | OVL | 画像未選択 | 背景表示 | OK |

---

## 検証スクリーンショット

画像パス: `docs/09_reports/2026/03/13/sidebar-preview-fix/`

### 最終検証（resolveScenarioConfig 修正後）

| ファイル | 内容 |
|---------|------|
| `check-0.png` | Block 0 (START) — プレビュー黒（正常: 視覚情報なし） |
| `check-1.png` | Block 1 (bg) — プレビューに背景表示 |
| `check-2.png` | Block 2 (ch 勇者) — プレビューに背景 + **キャラ表示** |
| `check-3.png` | Block 3 (text) — プレビューに背景 + キャラ表示（修正前は黒） |
| `check-4.png` | Block 4 (bg 2枚目) — プレビューに背景表示 |
| `check-5.png` | Block 5 (ch 未選択) — プレビューに背景表示（修正前は黒） |
| `check-6.png` | Block 6 (text) — プレビューに背景表示（修正前は黒） |
| `check-7.png` | Block 7 (text) — プレビューに背景表示（修正前は黒） |
| `check-8.png` | Block 8 (OVL 未選択) — プレビューに背景表示（修正前は黒） |

### 中間検証（コミット 1+2 のみ、resolveScenarioConfig 修正前）

| ファイル | 内容 |
|---------|------|
| `final-block0.png` 〜 `final-block8.png` | コミット 1+2 適用時の検証。キャラ画像が不安定に表示される状態 |

---

## 技術メモ

- プレビューは「選択ブロックまでの視覚状態の累積」を TyranoScript として iframe に送る仕組み
- テキスト表示にはクリック操作が必要なため、プレビュースクリプトに含めるのは不適切
- `previewReady` ハンドシェイクにより、PixiJS 初期化完了後にのみスクリプトが送信される
- 未選択ブロック（空 ID）はスクリプト生成時にスキップすることで、コンパイルエラーを防止
- `resolveScenarioConfig` の `from=editor` → `postmessage` ルーティングにより、API fetch との二重実行を防止。これが「キャラ画像が出たり出なかったりする」不安定動作の根本原因だった
