# kaedevn ネイティブエンジン：操作・開発マニュアル (macOS)

**作成日**: 2026-02-26
**対象**: 開発者・テスター
**核心**: ネイティブプレビュー環境のビルドから操作までの全ガイド

## 1. ビルド・起動方法

### 1.1 前提条件
以下のライブラリが Homebrew でインストールされている必要があります。
```bash
brew install sdl2 sdl2_image sdl2_mixer sdl2_ttf cmake
```

### 1.2 CLI による一括ビルド＆テスト
スクリプト一発でビルドと全ユニットテストを実行します。
```bash
cd packages/native-engine
./test-cli.sh
```

### 1.3 手動ビルドと実行
```bash
mkdir -p build && cd build
cmake ..
make
# 実行（デフォルトで assets/main.ksc をロード）
./kaedevn_native
```

## 2. 実行時オプション (Command Line Arguments)

任意のスクリプトやアセット構成を指定して起動できます。

| オプション | 短縮形 | 説明 | デフォルト値 |
| :--- | :--- | :--- | :--- |
| `--script [path]` | `-s` | 実行する KSC ファイルのパスを指定 | `assets/main.ksc` |
| `--assets [path]` | `-a` | アセット対応 JSON のパスを指定 | `assets/assets.json` |

例: `./kaedevn_native --script assets/prologue.ksc`

## 3. ゲーム内操作方法 (In-Game Controls)

### 3.1 基本進行
- **セリフ送り**: `Enter` キー, `Space` キー, または **マウス左クリック**。
- **選択肢決定**: `0` 〜 `9` キー（表示された選択肢の番号に対応）。

### 3.2 特殊機能 (QOL)
- **高速スキップ (Hold)**: `Left Control` キー（押している間だけスキップ）。
- **高速スキップ (Toggle)**: `S` キー（スキップモードの ON/OFF を切り替え）。
- **バックログ（履歴）**: **マウスホイール上回転**。
- **履歴を閉じる**: マウス左クリック または 下回転。

## 4. 開発ワークフロー：エディタとの同期
Web エディタで作成した最新のシナリオをネイティブエンジンに反映させる手順です。

1.  Web エディタで「保存」を実行。
2.  ターミナルで `./scripts/sync-native.sh [projectId]` を実行。
3.  ネイティブエンジンを起動。

## 5. トラブルシューティング
- **文字化け・フォントエラー**: `main.cpp` 内のフォントパスが環境に存在するか確認してください（デフォルトは `Hiragino Sans GB`）。
- **アセットが表示されない**: `assets/assets.json` 内のパスと、物理ファイルの配置が一致しているか `sync-native.sh` のログを確認してください。

---
*Created by Gemini CLI Documentation Expert.*
