# .pak アセットパッケージング実装レポート

**日付:** 2026-03-16
**ブランチ:** `feature/native-engine-mac-build`
**コミット:** `811fdc4`

## 背景

ネイティブエンジンで作品を配布する際、アセット（画像・音声・スクリプト）がフォルダに丸見えになる問題。
特に macOS / Windows のデスクトップ配布で、フォルダを開くだけで PNG が並ぶ状態だった。

## 対応内容

全アセットを1つの `.pak` ファイルにバンドルし、カジュアルコピーを防ぐ仕組みを実装した。
加えて macOS `.app` バンドルの作成・フルスクリーン対応も実施。

## .pak フォーマット仕様

```
[Header]  16 bytes
  Magic:      "KVPK"      (4 bytes)
  Version:    uint32_t = 1 (4 bytes)
  TOC count:  uint32_t     (4 bytes)
  TOC offset: uint64_t     (8 bytes, ファイル末尾の TOC 位置)

[Data region]  可変長（全ファイルを連結、圧縮なし）

[TOC region]  末尾
  Entry ごと:
    pathLen:  uint16_t
    path:     char[pathLen]  (例: "bg/01KK64...png")
    offset:   uint64_t       (Data 領域内の絶対オフセット)
    size:     uint64_t
```

- 圧縮なし（PNG/OGG は既に圧縮済み）
- TOC 末尾配置 → パッカーが順次書き込み可能

## 新規ファイル

| ファイル | 役割 |
|---------|------|
| `src/engine/PakReader.hpp` | .pak 読み込みクラス定義 |
| `src/engine/PakReader.cpp` | open / readFile / readText / openRW 実装（SDL_RWops 経由） |
| `tools/pak_tool.cpp` | CLI パッカー（pack / unpack / list）、SDL2 非依存 |
| `tests/PakReaderTest.cpp` | PakReader ユニットテスト（7テスト） |

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `AssetProvider.hpp/cpp` | `setPakReader()`, `loadFromPak()`, `isPakMode()`, `getPakReader()`, `resolveRelativePath()` 追加 |
| `TextureManager.hpp/cpp` | `loadTextureRW(SDL_RWops*, cacheKey)` 追加 |
| `AudioManager.hpp/cpp` | `playBgmRW()`, `playSeRW()`, `playVoiceRW()` 追加 |
| `SDL2Engine.hpp/cpp` | `loadTextureForSlug()` ヘルパー追加、全アセット読み込み箇所に pak/loose 分岐 |
| `main.cpp` | pak 初期化（game.pak 自動検出）・フォールバック・.app バンドル対応・フルスクリーン対応 |
| `CMakeLists.txt` | PakReader.cpp 追加、PakReaderTest.cpp 追加、pak_tool ターゲット追加 |

## フォールバック戦略

```
game.pak が存在し開ける → pak モード（全アセット pak 経由）
game.pak がない or 失敗 → ルースファイルモード（既存動作、変更なし）
```

ハイブリッドモードなし。全か無のシンプル設計。

## game.pak 検索順序

1. `{projectDir}/game.pak`（プロジェクトディレクトリ指定時）
2. `{exeDir}/game.pak`（実行ファイルと同じディレクトリ = .app バンドル対応）
3. `game.pak`（カレントディレクトリ）
4. `assets/game.pak`

## macOS .app バンドル

```
kaedevn.app/
  Contents/
    Info.plist
    MacOS/kaedevn_native
    Resources/game.pak
    Frameworks/libSDL2*.dylib
    _CodeSignature/
```

### ビルド手順

```bash
# 1. ビルド
cd packages/native-engine/build
cmake .. && cmake --build . -j$(sysctl -n hw.ncpu)

# 2. pak 作成
./pak_tool pack game.pak ../assets/

# 3. .app 作成
APP=../dist/kaedevn.app
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Frameworks"
cp kaedevn_native "$APP/Contents/MacOS/"
cp game.pak "$APP/Contents/Resources/"

# 4. dylib コピー＆パス修正
LIBS=(/opt/homebrew/opt/sdl2/lib/libSDL2-2.0.0.dylib
      /opt/homebrew/opt/sdl2_image/lib/libSDL2_image-2.0.0.dylib
      /opt/homebrew/opt/sdl2_ttf/lib/libSDL2_ttf-2.0.0.dylib
      /opt/homebrew/opt/sdl2_mixer/lib/libSDL2_mixer-2.0.0.dylib)
for lib in "${LIBS[@]}"; do
    cp "$lib" "$APP/Contents/Frameworks/"
    install_name_tool -change "$lib" "@executable_path/../Frameworks/$(basename $lib)" "$APP/Contents/MacOS/kaedevn_native"
done
for lib in "$APP/Contents/Frameworks"/*.dylib; do
    install_name_tool -id "@executable_path/../Frameworks/$(basename $lib)" "$lib"
done

# 5. 署名
codesign --force --deep --sign - "$APP"
```

## 修正した問題

### FileStorage が .app バンドルで abort する

- **原因:** `FileStorage("saves")` が相対パスでディレクトリ作成を試みるが、.app から起動するとカレントディレクトリが `/` になり `std::filesystem::create_directories` が失敗
- **修正:** macOS デスクトップでも `SDL_GetPrefPath("com.kaedevn", "kaedevn")` を使用し、`~/Library/Application Support/com.kaedevn/kaedevn/saves/` に保存

## テスト結果

全 31 テスト PASSED（既存 24 + 新規 PakReader 7）

```
PakReaderTest.OpenAndReadText
PakReaderTest.ReadFileReturnsBytes
PakReaderTest.OpenRWReturnsValidRWops
PakReaderTest.ListEntries
PakReaderTest.MissingEntryReturnsEmpty
PakReaderTest.InvalidFileFailsToOpen
PakReaderTest.InvalidMagicFailsToOpen
```

## 動作確認

- [x] `pak_tool pack` で assets/ から 7ファイル・4.9MB の pak 生成
- [x] `pak_tool list` で TOC 一覧表示
- [x] pak モードでエンジン起動（背景・キャラ・スクリプト読み込み確認）
- [x] ルースファイルモードで既存動作維持
- [x] .app バンドルでダブルクリック起動
- [x] フルスクリーン（緑ボタン）動作確認

## Phase 2 以降（将来）

| Phase | 内容 | 備考 |
|-------|------|------|
| Phase 2 | Android / iOS / Windows 対応 | PakReader は SDL_RWFromFile 経由なのでコード変更なしで動く見込み |
| Phase 3 | XOR 難読化 | Header に flags フィールド追加、pak_tool に --xor-key オプション |

## フォントについて

フォントは .pak に含めない。
- macOS/iOS: システムフォント使用
- Android: APK バンドル
- 将来バンドルフォントを入れる場合、FontManager は既に `TTF_OpenFontRW` パスがある
