# ネイティブエンジン Android / iOS 実行結果報告書

**日時**: 2026-03-08
**対象**: `packages/native-engine` Android エミュレーター + iOS シミュレーター
**ブランチ**: `feature/map-editor`
**テストデータ**: サーバー取得プロジェクト `01KK64AXBXGB4D3X9PA96HHJHX`

---

## 1. テスト環境

| 項目 | iOS | Android |
|------|-----|---------|
| デバイス | iPhone 16 Pro Simulator (iOS 26) | sdl_test AVD (API 35, x86_64) |
| 画面解像度 | 2556×1179 → 論理 1562×720 | 2400×1080 → 論理 1600×720 |
| ビルド方式 | CMake + Xcode (static link) | Gradle + NDK 28 (JNI) |
| SDL2 バージョン | 2.30.12 (ソースビルド) | 2.30.12 (ソースビルド) |
| フォント | システム (ヒラギノ角ゴシック) | バンドル (NotoSansJP-Regular.ttf) |
| アセット配置 | Documents/project/ (simctl cp) | APK assets/ (ビルド時同梱) |

## 2. 再現手順

### iOS シミュレーター

```bash
# 1. アセット取得
node scripts/cli/native/fetch-assets.mjs 01KK64AXBXGB4D3X9PA96HHJHX

# 2. ビルド
cd packages/native-engine/ios/build-sim
cmake .. -G Xcode \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator \
  -DCMAKE_OSX_ARCHITECTURES=x86_64 \
  -DCMAKE_XCODE_ATTRIBUTE_DEVELOPMENT_TEAM=""
cmake --build . --config Debug --target kaedevn_ios

# 3. インストール
xcrun simctl install booted build-sim/Debug-iphonesimulator/kaedevn_ios.app

# 4. アセットコピー
DATA=$(xcrun simctl get_app_container booted com.kaedevn.native-engine data)
mkdir -p "$DATA/Documents/project"
cp -R packages/native-engine/data/01KK64AXBXGB4D3X9PA96HHJHX/* "$DATA/Documents/project/"

# 5. 起動
xcrun simctl launch booted com.kaedevn.native-engine
```

### Android エミュレーター

```bash
# 1. アセット取得（iOS と共有）
node scripts/cli/native/fetch-assets.mjs 01KK64AXBXGB4D3X9PA96HHJHX

# 2. WebP → PNG 変換（Android SDL2_image が WebP 未サポートのため）
cd packages/native-engine/data/01KK64AXBXGB4D3X9PA96HHJHX
for f in bg/*.webp ch/*.webp; do
  sips -s format png "$f" --out "${f%.webp}.png"
  rm "$f"
done
# assets.json 内の .webp → .png も書き換え

# 3. APK assets にコピー
cp -R packages/native-engine/data/01KK64AXBXGB4D3X9PA96HHJHX/* \
  packages/native-engine/android/app/src/main/assets/assets/

# 4. ビルド & インストール
cd packages/native-engine/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 \
ANDROID_HOME=$HOME/Library/Android/sdk \
./gradlew installDebug

# 5. 起動
adb shell am start -n com.kaedevn.native_engine/.KaedevnActivity
```

## 3. テスト結果

### 機能テスト

| 機能 | iOS | Android | 備考 |
|------|:---:|:-------:|------|
| タイトル画面表示 | ✅ | ✅ | タイトルはスクリプトヘッダーから抽出 |
| タップでゲーム開始 | ✅ | ✅ | |
| 背景表示 (cover) | ✅ | ✅ | アスペクト比に合わせたクロップ |
| キャラクター立ち絵 | ✅ | ✅ | left/center/right 配置 |
| セリフ表示 | ✅ | ✅ | 日本語テキスト、話者名付き |
| ▼クリック待ちインジケータ | ✅ | ✅ | sin波アルファ点滅 (0.5s周期) |
| タップで次のセリフに進む | ✅ | ✅ | |
| 背景切り替え (クロスフェード) | ✅ | ✅ | |
| エンド画面 | ✅ | ✅ | 「タイトルに戻る」ボタン |
| タイトルへの復帰 | ✅ | ✅ | resetState() でエンジン状態クリア |
| ローディング表示 | ✅ | ✅ | 未読み込みテクスチャ時に半透明オーバーレイ |

### パフォーマンス（エミュレーター）

| 計測項目 | iOS Simulator | Android Emulator |
|---------|:---:|:---:|
| 起動 → タイトル表示 | ~1s | ~4s |
| テクスチャ初回読み込み (3枚) | ~100ms | ~300ms |
| タップ → 画面遷移 | 即座 | 即座 |
| 体感フレームレート | 60fps | 30-40fps（エミュ制限） |

## 4. 手間取ったところ（トラブルシューティング）

### 4.1 Android: WebP が読み込めない

**症状**: `Unsupported image format` エラーで画像が表示されない。

**原因**: Android NDK ビルドの SDL2_image が WebP をサポートしていない（libwebp がリンクされない）。

**解決**: `sips -s format png` で WebP → PNG に変換し、`assets.json` のパスも `.png` に書き換え。

**再発防止**: `fetch-assets.mjs` に `--format png` オプションを追加する（未実装）。

### 4.2 Android: APK 内アセットのパス解決

**症状**: `Couldn't open asset 'bg/...'` でテクスチャが見つからない。

**原因**: `AssetProvider` の `baseDir` が未設定。APK 内の `assets/` ディレクトリは通常のファイルシステムパスではなく `SDL_RWFromFile` 経由でしかアクセスできない。しかし SDL2 の `IMG_LoadTexture` は内部で `SDL_RWFromFile` を使うため、パスのプレフィックスとして `"assets"` を設定すれば動作する。

**解決**: `assetProvider.setBaseDir("assets")` を追加。

### 4.3 Android: タップが二重に発火する

**症状**: 1回のタップで2行進む。

**原因**: SDL2 がタッチイベント (`SDL_FINGERDOWN`) から合成マウスイベント (`SDL_MOUSEBUTTONDOWN`) を自動生成する。両方を処理すると二重発火になる。

**解決**: `SDL_SetHint(SDL_HINT_TOUCH_MOUSE_EVENTS, "0")` を `SDL_Init` の前に設定。ただしエミュレーターのマウスクリックは `SDL_MOUSEBUTTONDOWN` なので、イベント判定は `FINGERDOWN || MOUSEBUTTONDOWN` のままにする。

### 4.4 Android: 起動時にタイトル画面がスキップされる

**症状**: アプリ起動と同時にゲームが開始される（タイトル画面が一瞬で消える）。

**原因**: Android が起動時に自動で `SDL_FINGERDOWN` イベントを生成する。これがタイトル画面のタップ判定に引っかかり、即座に `startGame()` が呼ばれる。

**解決**: `firstTapIgnored` フラグで起動直後の最初のタップイベントのみ無視する。時間ベースのガード（500ms）では、ガード中にユーザーの本物のタップも無視してしまい「2回クリックが必要」になった。

**教訓**: 時間ベースのガードより、イベントカウントベースの方が正確。

### 4.5 iOS: バンドル ID の特定

**症状**: `xcrun simctl launch` で `domain error` が出てアプリが起動しない。

**原因**: バンドル ID を `com.kaedevn.kaedevn-ios` と推測したが、実際は `com.kaedevn.native-engine`。

**解決**: `xcrun simctl listapps booted` でインストール済みアプリの正しいバンドル ID を確認。

### 4.6 iOS: Documents ディレクトリの自動検出

**症状**: `SDL_GetPrefPath` が返すパスは `Library/Application Support/` であり、`Documents/` ではない。

**原因**: SDL2 の `SDL_GetPrefPath` は iOS では `Library/Application Support/` を返す仕様。

**解決**: 返されたパスから `Library/` の位置を特定し、同じアプリルートの `Documents/project/` を組み立てる。

### 4.7 Android: JAVA_HOME が見つからない

**症状**: `./gradlew assembleDebug` が `No java installation was detected` で失敗。

**原因**: Homebrew で `openjdk@17` をインストール済みだが、`JAVA_HOME` 環境変数が未設定。

**解決**: `JAVA_HOME=/opt/homebrew/opt/openjdk@17` を Gradle 実行時に指定。

### 4.8 ゲーム中のテクスチャ読み込み遅延

**症状**: 新しい背景が表示されるタイミングで画面がフリーズする（特にエミュレーター）。

**原因**: テクスチャはレンダリング時に遅延読み込みされ、PNG デコード中はフレームが止まる。

**解決**: `showBackground` / `showCharacter` でテクスチャが未キャッシュの場合、`renderLoadingOverlay()` で「Loading...」を表示してからプリロードする。`TextureManager::hasTexture()` を追加してキャッシュ有無を判定。

## 5. 未解決・今後の課題

| 課題 | 優先度 | 備考 |
|------|:---:|------|
| `fetch-assets.mjs` に PNG 変換オプション追加 | 中 | Android 向け自動化 |
| 実機テスト（Android / iOS） | 高 | エミュレーター性能は参考値 |
| 音声再生テスト (BGM/SE/Voice) | 中 | アセット未準備のため未テスト |
| セーブ/ロード機能テスト | 中 | FileStorage 実装済みだが未検証 |
| スキップモードのテスト | 低 | キーボード `S` で切り替え |
| ヒストリー（バックログ）のテスト | 低 | キーボード `H` またはマウスホイール |

## 6. アーキテクチャ概要

```
┌─────────────────────────────────────────────┐
│                  main.cpp                    │
│  AppState { Title, Playing, End }            │
│  Event Loop → SDL_PollEvent                  │
├─────────────────────────────────────────────┤
│           Interpreter (step-driven)          │
│  Parser → Tokenizer → Evaluator             │
│  KSC format: bare text + @r/@l              │
├─────────────────────────────────────────────┤
│              SDL2Engine                      │
│  IEngineAPI implementation                   │
│  render() / renderTitleScreen() / renderEnd()│
├──────────┬──────────┬───────────┬───────────┤
│ Texture  │   Font   │   Audio   │  History  │
│ Manager  │  Manager │  Manager  │  Manager  │
├──────────┴──────────┴───────────┴───────────┤
│              AssetProvider                   │
│  assets.json → slug → file path             │
├─────────────────────────────────────────────┤
│           SDL2 (2.30.12 static)              │
│  SDL2_image / SDL2_ttf / SDL2_mixer          │
└─────────────────────────────────────────────┘
```

## 7. コミット履歴（関連）

| Hash | 内容 |
|------|------|
| `7159295` | タイトル画面・エンド画面を追加 |
| `cd39af5` | Android タップ二重発火修正・サーバーアセット対応 |
| `b57718e` | ▼クリック待ちインジケータをsin波アルファ点滅に変更 |
| `2f48b71` | KSCスクリプト対応・fetch-assets CLI |
| `d60f806` | Android 横画面対応・クリック待ち機構 |
| `eaa8e45` | iOS フルスクリーン対応・動的論理解像度 |
| `989fa14` | iOS Simulator ビルド対応・SDL2 ソースビルド |
| `8d2c5b6` | Android クロスビルド実装 |
