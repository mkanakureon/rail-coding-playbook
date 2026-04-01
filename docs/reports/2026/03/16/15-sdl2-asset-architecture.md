# SDL2 ネイティブエンジン — アセット読み込みアーキテクチャ

## 概要

SDL2 ネイティブエンジン (`packages/native-engine`) は、**AssetProvider** を中心としたアセット解決パイプラインで、全プラットフォーム（macOS / Android / iOS）から同一のアセットデータを読み込む。本文書はその仕組みと各プラットフォームの差異を記述する。

## アセットパイプライン全体図

```
┌─────────────────────────────────────────────────────┐
│  assets.json (アセットレジストリ)                       │
│  { "slug-id": "bg/filename.png", ... }              │
└───────────────┬─────────────────────────────────────┘
                │ loadFromJson()
                ▼
┌─────────────────────────────────────────────────────┐
│  AssetProvider                                       │
│  ┌──────────┐  ┌────────────────────┐               │
│  │ baseDir  │  │ assetMap (slug→path)│               │
│  └──────────┘  └────────────────────┘               │
│  resolvePath(slug) → baseDir + assetMap[slug]        │
└───────────────┬─────────────────────────────────────┘
                │ 解決済みパス
                ▼
┌─────────────────────────────────────────────────────┐
│  SDL2Engine                                          │
│  ├── showBackground(slug) → TextureManager           │
│  ├── showCharacter(slug, pose) → TextureManager      │
│  ├── playBgm/playSe/playVoice(slug) → AudioManager   │
│  └── renderText() → FontManager                      │
└─────────────────────────────────────────────────────┘
```

## AssetProvider の役割

| メソッド | 説明 |
|---------|------|
| `setBaseDir(dir)` | アセットのルートディレクトリを設定（末尾 `/` 自動付与） |
| `loadFromJson(path)` | JSON ファイルから slug → 相対パスのマッピングを一括登録 |
| `registerAsset(slug, path)` | 個別にマッピングを追加 |
| `resolvePath(slug)` | `baseDir + 相対パス` のフルパスを返す |
| `hasAsset(slug)` | slug が登録済みか判定 |

### assets.json のフォーマット

```json
{
  "01KK64AXCVA29WDA3M7T20QZX0": "bg/01KK64AXCVA29WDA3M7T20QZX0.png",
  "01KK64AXDXA34KSNBHGWPMWQAM": "bg/01KK64AXDXA34KSNBHGWPMWQAM.png",
  "fantasy_hero:normal": "ch/fantasy_hero_normal.png",
  "luca:normal": "ch/luca_normal.png",
  "yolda:normal": "ch/yolda_normal.png"
}
```

- **キー**: スクリプト内で使用する slug（ULID またはキャラ名:表情）
- **値**: baseDir からの相対パス

## プラットフォーム別のアセット配置と読み込み

### macOS（デスクトップ）

```
packages/native-engine/
├── build/kaedevn_native    ← 実行ファイル
├── assets/                 ← シンボリックリンク → android/app/.../assets/
│   ├── assets.json
│   ├── bg/
│   ├── ch/
│   └── script.ks
└── saves/                  ← セーブデータ
```

| 項目 | 値 |
|------|------|
| **baseDir** | `assets` (CWD 相対) or argv[1] |
| **JSON 読み込み** | `std::ifstream` |
| **テクスチャ読み込み** | `IMG_LoadTexture(renderer, path)` |
| **フォント** | `/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc` (システムフォント) |
| **セーブ先** | `./saves/` (CWD 相対) |
| **スクリプト読み込み** | `std::ifstream` |

**起動方法**:
```bash
cd packages/native-engine
./build/kaedevn_native              # ./assets/ を自動検出
./build/kaedevn_native /path/to/dir # 任意のプロジェクトディレクトリ指定
```

### Android

```
APK
└── assets/
    └── assets/
        ├── assets.json
        ├── bg/
        ├── ch/
        └── script.ks
```

| 項目 | 値 |
|------|------|
| **baseDir** | `assets` (APK 内相対パス) |
| **JSON 読み込み** | `SDL_RWFromFile()` → APK 内アセットアクセス |
| **テクスチャ読み込み** | `IMG_LoadTexture()` (SDL2 が APK 内パスを自動解決) |
| **フォント** | `fonts/NotoSansJP-Regular.ttf` (APK バンドル、`SDL_RWFromFile` + `TTF_OpenFontRW`) |
| **セーブ先** | `SDL_AndroidGetInternalStoragePath() + "/saves"` |
| **スクリプト読み込み** | `SDL_RWFromFile("assets/script.ks")` |

**ポイント**: Android APK 内のファイルは通常の `std::ifstream` では開けない。SDL2 の `SDL_RWFromFile` が APK 内アセットへの透過的アクセスを提供する。

### iOS

```
App Container/
├── kaedevn_ios.app/        ← バンドル
│   └── LaunchScreen.storyboard
└── Documents/
    └── project/            ← アセット配置先
        ├── assets.json
        ├── bg/
        ├── ch/
        └── script.ks
```

| 項目 | 値 |
|------|------|
| **baseDir** | `{AppContainer}/Documents/project` (自動検出) |
| **JSON 読み込み** | `std::ifstream` |
| **テクスチャ読み込み** | `IMG_LoadTexture(renderer, path)` |
| **フォント** | `/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc` 他 (iOS システムフォント) |
| **セーブ先** | `SDL_GetPrefPath("com.kaedevn", "kaedevn") + "saves"` |
| **スクリプト読み込み** | `std::ifstream` |

**自動検出ロジック**: `SDL_GetPrefPath` → `Library/Application Support/...` → 親をたどって `Documents/project/` を探索。`assets.json` の存在で確認。

## プラットフォーム分岐の一覧（main.cpp）

```
main.cpp の #ifdef 分岐
│
├── ウィンドウ作成
│   ├── Android / iOS → FULLSCREEN_DESKTOP + ALLOW_HIGHDPI
│   └── macOS / PC → 1280x720 ウィンドウ + ALLOW_HIGHDPI
│
├── 論理解像度計算
│   ├── iOS → RendererOutputSize (Retina 実ピクセル) からアスペクト比計算
│   ├── Android → WindowSize からアスペクト比計算 (縦横反転対応)
│   └── macOS / PC → WindowSize からアスペクト比計算
│
├── アセットディレクトリ
│   ├── iOS → Documents/project/ 自動検出
│   ├── Android → APK 内 assets/ (SDL_RWFromFile)
│   └── macOS / PC → argv[1] or ./assets/
│
├── フォント
│   ├── Android → APK 内バンドルフォント (SDL_RWFromFile + TTF_OpenFontRW)
│   ├── iOS → システムフォント候補リスト (TTF_OpenFont)
│   └── macOS → システムフォント候補リスト (TTF_OpenFont)
│
├── セーブディレクトリ
│   ├── Android → SDL_AndroidGetInternalStoragePath() + /saves
│   ├── iOS → SDL_GetPrefPath() + saves
│   └── macOS / PC → ./saves/
│
└── スクリプト読み込み
    ├── Android → SDL_RWFromFile("assets/script.ks")
    └── その他 → std::ifstream
```

## SDL2 が提供するプラットフォーム抽象

SDL2 が差分を吸収している箇所:

| 機能 | SDL2 API | プラットフォーム差異 |
|------|---------|-------------------|
| ウィンドウ | `SDL_CreateWindow` | フラグで全画面/ウィンドウを切替 |
| レンダラ | `SDL_CreateRenderer` | OpenGL / Metal / DirectX を自動選択 |
| テクスチャ | `IMG_LoadTexture` | ファイルパスから PNG/WebP を自動デコード |
| 音声 | `Mix_LoadMUS / Mix_LoadWAV` | 全プラットフォームで同一 API |
| フォント | `TTF_OpenFont / TTF_OpenFontRW` | RWops 経由で APK 内フォントにも対応 |
| ファイル IO | `SDL_RWFromFile` | APK / バンドル / ファイルシステムを透過的にアクセス |
| タッチ | `SDL_FINGERDOWN` | タッチデバイスのイベントを統一 |
| ストレージパス | `SDL_GetPrefPath` / `SDL_AndroidGetInternalStoragePath` | OS 固有のサンドボックスパス |

## SDL2 が吸収しない差異（自前実装）

| 差異 | 対応コード |
|------|-----------|
| iOS の Documents/ ディレクトリ探索 | main.cpp L131-158 |
| Android APK 内 JSON 読み込み | AssetProvider.cpp L45-57 |
| Android フォントの RWops 読み込み | FontManager.cpp L15-22 |
| Retina ディスプレイの論理解像度計算 | main.cpp L90-97 |
| Android 縦画面→横画面変換 | main.cpp L98-105 |

## アセット共有の仕組み（macOS ↔ Android ↔ iOS）

3 プラットフォームで同一のアセットファイルを使用するため、以下の構成を採用:

```
packages/native-engine/
├── android/app/src/main/assets/assets/   ← 実体（正本）
│   ├── assets.json
│   ├── bg/
│   ├── ch/
│   └── script.ks
├── assets -> android/app/.../assets/     ← macOS 用シンボリックリンク
└── ios/  （ビルド時に Documents/project/ へコピー）
```

- **Android**: Gradle が `src/main/assets/` を APK に自動バンドル
- **macOS**: シンボリックリンクで同じディレクトリを参照
- **iOS**: `xcrun simctl` でアプリの Documents/project/ にコピー

アセットの正本は 1 箇所（Android ディレクトリ）に集約されており、重複管理が不要。

## テクスチャ管理の詳細

### TextureManager

```
loadTexture(path)
    │
    ├── キャッシュヒット → SDL_Texture* を即座に返す
    │
    └── キャッシュミス
        ├── IMG_LoadTexture(renderer, path)
        ├── unique_ptr<SDL_Texture> でキャッシュに格納
        └── SDL_Texture* を返す
```

- `unordered_map<string, UniqueTexture>` によるキャッシュ
- `UniqueTexture` = `unique_ptr<SDL_Texture, SDL_DestroyTexture>` (RAII)
- 画像形式: PNG / WebP / JPG（SDL2_image が自動判定）

### SDL2Engine でのテクスチャ利用

| メソッド | テクスチャの使い方 |
|---------|-------------------|
| `showBackground(slug)` | `resolvePath` → `loadTexture` → `drawTextureCover` (cover モードでアスペクト比調整) |
| `showCharacter(slug, pose)` | slug + pose から合成キー → `resolvePath` → `loadTexture` → `drawTexture` |
| `drawTextureCover(slug, w, h)` | ソース Rect をクロップして viewport にフィット |
| `drawTexture(slug, x, y)` | 指定座標に描画（centered オプション付き） |

## 音声管理

### AudioManager

| メソッド | SDL2 API | 用途 |
|---------|---------|------|
| `playBgm(path, vol, loop, fade)` | `Mix_LoadMUS` + `Mix_FadeInMusic` | BGM 再生（ループ + フェード） |
| `playSe(path, vol)` | `Mix_LoadWAV` → キャッシュ → `Mix_PlayChannel` | 効果音 |
| `playVoice(path, vol)` | `Mix_LoadWAV` → `Mix_PlayChannel` | ボイス（専用チャンネル） |

- BGM: `Mix_Music*` で管理（ストリーミング再生）
- SE: `Mix_Chunk*` をキャッシュ（即座に重ね掛け可能）
- 全メソッドが `AssetProvider.resolvePath()` 経由でパスを取得

## フォント管理

### FontManager のプラットフォーム対応

```cpp
// Android: APK 内フォントは SDL_RWFromFile 経由
#ifdef __ANDROID__
    SDL_RWops* rw = SDL_RWFromFile(path.c_str(), "rb");
    TTF_OpenFontRW(rw, 1, ptSize);
#else
    // macOS / iOS: ファイルパス直接指定
    TTF_OpenFont(path.c_str(), ptSize);
#endif
```

### フォント候補（フォールバック順）

| プラットフォーム | 候補 |
|----------------|------|
| Android | `fonts/NotoSansJP-Regular.ttf` (APK バンドル) |
| iOS | ヒラギノ角ゴシック W3 → Hiragino Sans GB → AppleSDGothicNeo → Helvetica → Arial Unicode |
| macOS | ヒラギノ角ゴシック W3 → Hiragino Sans GB → AppleSDGothicNeo → Helvetica |

## まとめ

- **AssetProvider** がアセット ID → ファイルパスの変換を一元管理
- **assets.json** が全プラットフォーム共通のアセットレジストリ
- **SDL2** がファイル IO / テクスチャデコード / 音声再生のプラットフォーム差異を吸収
- **自前実装** が SDL2 でカバーされない差異（iOS パス探索、Android RWops、Retina 対応）を補完
- アセットの正本は Android ディレクトリに集約、macOS はシンボリックリンク、iOS はビルド時コピー
