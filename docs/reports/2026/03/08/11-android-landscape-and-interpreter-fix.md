# Android 横画面対応 & インタープリター改善

**日時**: 2026-03-08
**対象**: `packages/native-engine` Android ビルド + 共通インタープリター

## 概要

Android エミュレーターでネイティブエンジンを動作確認し、以下の問題を修正した。

1. **縦画面で起動する** — `sensorLandscape` を AndroidManifest に追加
2. **論理解像度が縦画面基準になる** — Android 用の縦横 swap ロジック追加
3. **スクリプトが一気に最後まで実行される** — インタープリターにクリック待ち機構を追加
4. **クリック待ちインジケータがない** — ▼三角の点滅表示を追加
5. **Android でタップが重複処理される** — FINGERDOWN + MOUSEBUTTONDOWN の重複防止

## 修正内容

### 1. Android 横画面対応

**症状**: アプリが縦画面（1080x2400）で起動し、ゲーム画面が非常に小さい。

**原因**: `AndroidManifest.xml` に `screenOrientation` が未指定。

**解決**: `android:screenOrientation="sensorLandscape"` を追加。

```
Before: Window: 1080x2400, Logical: 324x720
After:  Window: 2400x1080, Logical: 1600x720
```

### 2. 動的論理解像度の Android 対応

**症状**: `SDL_WINDOW_FULLSCREEN_DESKTOP` で取得したウィンドウサイズが縦画面の値を返す場合がある。

**原因**: SDL2 がウィンドウを作成した時点ではまだ横画面回転が完了していない場合がある。

**解決**: `main.cpp` に Android 専用の分岐を追加し、`ww`/`wh` の縦横を swap してからアスペクト比を計算。

### 3. インタープリターのクリック待ち機構

**症状**: 初期ループ `while (!interpreter.isFinished()) { step(); }` が全スクリプトを一気に実行し、最終状態のみが表示される。

**原因**: `isFinished()` がスクリプト終端のみチェックし、ダイアログ表示後のクリック待ちを考慮していない。

**解決**:
- `Interpreter` に `waitingForClick` フラグを追加
- `step()` をリファクタリング: ダイアログに到達するまで自動的に進み、ダイアログで `waitingForClick = true` を設定して停止
- `isFinished()` = `waitingForClick || スクリプト終端`（初期ループ用）
- `isScriptEnd()` = `スクリプト終端のみ`（イベントループ用、クリック待ちでも進行可能）
- `isWaiting()` = `waitingForClick`（エンジンのUI表示用）

### 4. クリック待ちインジケータ（▼三角）

テキストウィンドウ右下に白い下向き三角を表示。700ms 周期で点滅。`SDL2Engine` に `waitingForClick` 状態を `setWaitingForClick()` で毎フレーム通知。

### 5. タッチイベント重複防止

**症状**: Android エミュレーターで1タップが2回処理される。

**原因**: SDL2 がタッチ操作に対して `SDL_FINGERDOWN` と `SDL_MOUSEBUTTONDOWN` の両方を生成する。

**解決**: 100ms のデバウンスタイマーで重複を防止。ただし Android エミュレーターでは完全には解決していない（点滅の不安定さが残る）。

## 未解決の課題

### Android エミュレーターでのタップ問題

▼三角の点滅が安定しない、タップで進まない場合がある。以下が考えられる原因:

- エミュレーターの入力遅延
- `SDL_FINGERDOWN` / `SDL_MOUSEBUTTONDOWN` のタイミングの不確実性
- デバウンスの 100ms が短すぎるまたは長すぎる

**次のステップ**: 実機テストで確認。エミュレーター固有の問題の可能性が高い。

## デモスクリプトのループ化

ビルトインデモスクリプトに `*start` ラベルと `jump('start')` を追加し、最後まで進むとループするようにした。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `android/app/src/main/AndroidManifest.xml` | `screenOrientation="sensorLandscape"` 追加 |
| `src/main.cpp` | Android 縦横 swap、デモスクリプトループ、デバウンス、waitingForClick 連携 |
| `src/interpreter/Interpreter.hpp` | `waitingForClick`, `isScriptEnd()`, `isWaiting()` 追加 |
| `src/interpreter/Interpreter.cpp` | `step()` リファクタリング: ダイアログまで自動進行 + jump 対応 |
| `src/engine/SDL2Engine.hpp` | `waitingForClick`, `setWaitingForClick()` 追加 |
| `src/engine/SDL2Engine.cpp` | ▼三角インジケータ描画、Android デバッグログ |
| `src/engine/TextureManager.cpp` | Android 用テクスチャロードログ追加 |
