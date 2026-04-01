# iOS フルスクリーン対応 振り返り

**日時**: 2026-03-08
**対象**: `packages/native-engine` iOS シミュレータビルド

## 概要

iOS シミュレータ (iPhone 17 Pro) でネイティブエンジンが画面全体を使えず、左右に黒帯が表示される問題を調査・解決した。

## 根本原因

**LaunchScreen.storyboard が存在しなかった。**

iOS は `UILaunchStoryboardName` が Info.plist に設定されていない（またはLaunchScreen.storyboard がバンドルに含まれない）アプリを **レガシー互換モード** で起動する。このモードでは `UIScreen.bounds` が iPhone 4 相当の **320×480 points** を返し、SDL2 がその値を使って Display Mode を `480×320` に設定してしまう。

iPhone 17 Pro の実際の解像度は **1206×2622 pixels (402×874 points)** だが、SDL2 には **960×1440 pixels (320×480 points)** としか認識されなかった。

## 解決策

1. `LaunchScreen.storyboard` を作成（黒背景のシンプルなもの）
2. `Info.plist.in` に `UILaunchStoryboardName` = `LaunchScreen` を追加
3. `CMakeLists.txt` で storyboard をバンドルリソースとして追加

結果:
```
Before: Window: 480x320, Renderer: 480x320, Display: 480x320
After:  Window: 874x402, Renderer: 2622x1206, Display: 874x402
```

## 試行錯誤の経緯

### 1. shouldAutorotate の修正（効果なし）
SDL2 の `SDLLaunchScreenController.shouldAutorotate` が `NO` を返すことでシミュレータが自動回転しない問題を調査。`YES` に変更しても解像度問題は解決せず。ただしシミュレータでの手動回転（Cmd+←）は必要。

### 2. SDL_RenderSetLogicalSize の動的計算（部分的に正しい）
高さ720固定、幅をウィンドウのアスペクト比から動的計算する方式を実装。考え方は正しかったが、ウィンドウサイズ自体が間違っていたため効果がなかった。

### 3. UIScreen API での直接取得（効果なし）
`UIScreen.bounds`、`nativeBounds`、`nativeScale` を直接呼び出して正しいサイズを取得しようとした。しかし `bounds` も `nativeBounds` もレガシーモードの値（960×1440）を返していた。

### 4. SDL2 の UIKit_AddDisplay 修正（効果なし）
SDL2 ソースの `SDL_uikitmodes.m` で `nativeBounds` を使うよう修正したが、`nativeBounds` 自体がレガシー値だったため意味がなかった。

### 5. coverモード背景描画（真っ黒になった）
背景画像をアスペクト比維持で画面全体を埋める `drawTextureCover` を実装。最初は負の座標を使い、iOS で描画されなかった。ソースRect方式に修正したが、根本のウィンドウサイズ問題が未解決のため効果確認できず。

### 6. 白画面テストアプリ（決定的な診断）
全てのエンジンコードを除外し、白い画面だけを描画するテストアプリで検証。`SDL_RenderSetLogicalSize` を使わなくても黒帯が出ることを確認 → **SDL2 のウィンドウ自体が画面全体を使えていない** ことが判明。

### 7. Display Mode 列挙（原因特定）
`SDL_GetNumDisplayModes` で利用可能なモードを列挙 → `480x320` と `320x480` の2つしかなく、ネイティブ解像度が認識されていないことを確認。

### 8. シミュレータ Device Profile 確認（答えへの到達）
`plutil` で `iPhone 17 Pro.simdevicetype/profile.plist` を確認 → `mainScreenWidth: 1206, mainScreenHeight: 2622` が正しい値であることを確認。iOS のレガシー互換モードが原因と判断。

## 学んだこと

### iOS 開発の基礎知識
- **LaunchScreen.storyboard は必須**。これがないと iOS はアプリをレガシー互換モードで起動し、画面解像度が大幅に制限される
- この仕様は iOS 8+ で導入され、iOS 12 以降は LaunchScreen なしのアプリの新規提出ができない
- シミュレータでも実機でも同じ制限が適用される

### SDL2 固有の知識
- SDL2 2.30.12 は `UIScreen.bounds` を信頼してDisplay Mode を設定する
- `SDL_WINDOW_ALLOW_HIGHDPI` なしだと `SDL_GetRendererOutputSize` がポイントサイズを返す（Retina 解像度にならない）
- `SDLLaunchScreenController.shouldAutorotate = NO` はシミュレータの自動回転を妨げるが、解像度には影響しない
- SDL2 の iOS コードは `UIKit_ComputeViewFrame` → `UIScreen.bounds` → `statusBarOrientation` の依存チェーンがある

### デバッグ手法
- **最小再現テスト**（白画面テスト）が最も効果的だった。エンジンの複雑さを排除して SDL2 + iOS の問題に絞り込めた
- `Display Mode 列挙` で SDL2 が認識しているスクリーン情報を直接確認できた
- `simctl list devicetypes` + `plutil` でシミュレータの正しいデバイス仕様を確認できた
- `xcrun simctl launch --console-pty` でリアルタイムのアプリログを取得できた

### 作業プロセスの反省
- 初期段階で「なぜ黒帯が出るのか」の仮説を複数立てて、**最も基礎的なもの（画面解像度が正しいか）から検証すべき**だった
- cover モードや margin 調整など、「黒帯の見え方を改善する」方向に進んでしまい、「なぜ黒帯が存在するのか」の根本原因追及が遅れた
- **白画面テスト**のような最小再現は、問題の切り分けに最初から使うべきだった

## 今後の課題

1. `renderHistoryOverlay()` の `logicalW`/`logicalH` 対応（まだハードコード 1280x720）
2. cover モード背景描画の動作確認（LaunchScreen 修正後に再テスト必要）
3. 実機での動作確認
4. Android ビルドへの SDL_WINDOW_ALLOW_HIGHDPI 反映確認

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `ios/LaunchScreen.storyboard` | 新規: 黒背景のランチスクリーン |
| `ios/Info.plist.in` | UILaunchStoryboardName 追加 |
| `ios/CMakeLists.txt` | storyboard リソース追加、ios_screen.m 追加 |
| `src/main.cpp` | HIGHDPI フラグ、動的論理解像度、iOS プロジェクトディレクトリモード |
| `src/engine/SDL2Engine.cpp` | 5% マージンテキストウィンドウ、cover モード背景、logicalW/H 対応 |
| `src/engine/SDL2Engine.hpp` | logicalW/H メンバー、setLogicalSize()、drawTextureCover() |
| `src/platform/ios_screen.h/m` | iOS スクリーンサイズ取得ヘルパー |
