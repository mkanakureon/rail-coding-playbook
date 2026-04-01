# iOS ネイティブエンジン — サーバーアセット取得・ローカル再生 計画書

**作成日**: 2026-03-08
**ステータス**: 計画

## 背景

iOS ネイティブエンジン (`packages/native-engine`) は SDL2 ベースで動作し、シミュレータでのビルド・起動に成功している。
ただし、シナリオデータとアセット（背景画像・キャラクター立ち絵・音声）はすべて Hono API サーバー + Azure Blob Storage にあり、ネイティブエンジンからは参照できない状態。

## 現状

### ネイティブエンジン側
- `AssetProvider` は `assets/assets.json`（slug → ローカルパス）を読み込んでアセットを解決
- `main.cpp` はビルトインのデモスクリプトか、ファイルパス引数でスクリプトを読み込み
- HTTP 通信機能は **未実装**

### サーバー側
- `GET /api/preview/:projectId` — KSC スクリプト + アセット URL + キャラクター情報を返す（認証不要）
- アセット URL は Azure Blob Storage の URL（本番）またはローカルの `/uploads/` パス（開発）
- `GET /api/projects/:id` — プロジェクト詳細（`_ai_context` 付き、認証必要）

## 全体方針

```
┌─────────────┐    HTTP     ┌─────────────┐    Blob URL    ┌─────────────┐
│  fetch CLI   │ ────────→ │  Hono API    │ ────────────→ │ Azure Blob  │
│  (Node.js)   │            │  /api/preview│               │  Storage    │
└──────┬──────┘            └─────────────┘               └─────────────┘
       │
       │  ファイル書き出し
       ▼
┌─────────────────────────────────────────┐
│  packages/native-engine/data/{projectId}/│
│    ├── script.ks        (KSC スクリプト) │
│    ├── assets.json      (slug → path)    │
│    ├── bg/              (背景画像)        │
│    ├── ch/              (キャラクター)    │
│    ├── bgm/             (BGM)            │
│    ├── se/              (SE)             │
│    └── voice/           (ボイス)         │
└──────────────┬──────────────────────────┘
               │
               │  ローカルファイル読み込み
               ▼
┌─────────────────────────────┐
│  iOS ネイティブエンジン       │
│  AssetProvider.loadFromJson  │
│  → ローカルパスで解決         │
└─────────────────────────────┘
```

**ネイティブエンジン自体に HTTP 通信は実装しない**。Node.js CLIでサーバーからデータを取得し、ローカルファイルとして配置する。

## 実装ステップ

### Step 1: フェッチ CLI の作成

**ファイル**: `scripts/cli/native/fetch-assets.mjs`

```
node scripts/cli/native/fetch-assets.mjs <projectId> [--env local|azure]
```

処理:
1. `GET /api/preview/{projectId}` を呼び出し
2. レスポンスの `script` を `data/{projectId}/script.ks` に保存
3. レスポンスの `assets[]` から各アセット URL をダウンロード
   - 画像 → `data/{projectId}/bg/` or `data/{projectId}/ch/`（kind で分類）
   - 音声 → `data/{projectId}/bgm/` or `data/{projectId}/se/`
4. キャラクター表情画像を `data/{projectId}/ch/{charSlug}/{exprSlug}.png` にダウンロード
5. `assets.json` を生成（slug → 相対パス）
6. タイムラインデータを `data/{projectId}/timelines.json` に保存

### Step 2: assets.json フォーマット

```json
{
  "bg01": "bg/forest_evening.png",
  "ch01:normal": "ch/yuuki/normal.png",
  "ch01:smile": "ch/yuuki/smile.png",
  "bgm01": "bgm/theme.ogg"
}
```

### Step 3: ネイティブエンジンの修正

**変更対象**: `main.cpp`

1. 起動引数でプロジェクトディレクトリを受け取る
   ```
   kaedevn_ios /path/to/data/{projectId}
   ```
2. そのディレクトリから `script.ks` と `assets.json` を読み込み
3. `AssetProvider` のパス解決をプロジェクトディレクトリからの相対パスに変更

**変更対象**: `AssetProvider.cpp`

- `resolvePath()` にベースディレクトリを追加
  - 現在: slug → path（絶対パス）
  - 変更後: slug → basedir + "/" + path（相対パス解決）

### Step 4: iOS シミュレータへのデータ配置

シミュレータの場合、アプリバンドルにデータを含めるか、シミュレータのファイルシステムに配置する。

**方法 A — アプリバンドルに含める（推奨）**:
- CMakeLists.txt でリソースバンドルを追加
- `data/` ディレクトリをバンドルリソースとしてコピー
- `SDL_GetBasePath()` でバンドルパスを取得してアセット読み込み

**方法 B — simctl でプッシュ**:
```bash
xcrun simctl get_app_container <UDID> com.kaedevn.native-engine data
# → /path/to/container/Documents/ にファイルをコピー
```

### Step 5: エンドツーエンドの動作確認

```bash
# 1. データ取得（ローカルサーバーから）
node scripts/cli/native/fetch-assets.mjs <projectId> --env local

# 2. ビルド（データをバンドルに含める）
cd packages/native-engine/ios && bash build-ios.sh simulator

# 3. シミュレータで起動
xcrun simctl install booted kaedevn_ios.app
xcrun simctl launch booted com.kaedevn.native-engine

# 4. スクリーンショット
xcrun simctl io booted screenshot output.png
```

## 優先度

| 順序 | タスク | 工数目安 |
|------|--------|---------|
| 1 | fetch CLI 作成 | 小 |
| 2 | AssetProvider にベースディレクトリ追加 | 小 |
| 3 | main.cpp の引数対応 | 小 |
| 4 | CMakeLists.txt でリソースバンドル設定 | 中 |
| 5 | エンドツーエンド動作確認 + スクリーンショット | 小 |

## 備考

- ネイティブエンジンに HTTP クライアントを組み込まない理由: libcurl 依存の追加が重い + SDL2 ビルドが既に複雑
- Node.js CLI でフェッチすることで、既存の API エンドポイントをそのまま利用できる
- 将来的にはアプリ内から API を叩く必要があるが、それは Switch 版の通信設計と合わせて検討する
