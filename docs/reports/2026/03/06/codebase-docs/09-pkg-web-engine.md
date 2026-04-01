# packages/web - PixiJS WebGL エンジン

## 概要

PixiJS ベースの Web ビジュアルノベルエンジン。Op 命令の実行、スプライト・テキスト・UI のレンダリング、15種類のスクリーンフィルター、ゲームシステム（セーブ/ロード、バックログ、設定）を提供する。プレビューエンジン (:5175) として動作。

## ディレクトリ構成

```
packages/web/
├── src/
│   ├── engine/
│   │   ├── KscRunner.ts                # KSC 実行ループ (80+行)
│   │   ├── KscHostAdapter.ts           # KSC→IOpHandler ブリッジ (300+行)
│   │   ├── resolveScenarioConfig.ts    # シナリオ設定解決
│   │   └── _deprecated/WebEngine.ts    # 旧エンジン
│   ├── renderer/
│   │   ├── WebOpHandler.ts             # メイン Op 実行器 (1000+行)
│   │   ├── LayerManager.ts             # レイヤー階層管理
│   │   ├── TextWindow.ts              # テキスト描画
│   │   ├── ChoiceOverlay.ts           # 選択肢 UI
│   │   ├── BacklogStore.ts            # 対話履歴
│   │   ├── ScreenFilter.ts           # フィルター管理
│   │   ├── screenFx.ts               # 画面エフェクト (フラッシュ、フェード)
│   │   ├── shake.ts                   # 画面揺れ
│   │   ├── fadeTo.ts                  # フェード遷移
│   │   ├── lerpPosition.ts           # 位置補間
│   │   ├── easing.ts                  # イージング関数
│   │   ├── PC98Filter.ts             # PC-98 レトロフィルター
│   │   ├── filters/                   # 15種カスタムフィルター
│   │   │   ├── BloomFilter.ts
│   │   │   ├── ChromaticAberrationFilter.ts
│   │   │   ├── ColorTintFilter.ts
│   │   │   ├── CRTFilter.ts
│   │   │   ├── FocusBlurFilter.ts
│   │   │   ├── GameBoyFilter.ts
│   │   │   ├── GlitchFilter.ts
│   │   │   ├── NightFilter.ts
│   │   │   ├── NoiseFilter.ts
│   │   │   ├── OldFilmFilter.ts
│   │   │   ├── PixelateFilter.ts
│   │   │   ├── RainFilter.ts
│   │   │   ├── UnderwaterFilter.ts
│   │   │   ├── VignetteFilter.ts
│   │   │   └── shaderUtils.ts
│   │   └── ui/
│   │       ├── GameUI.ts             # メイン UI コンテナ
│   │       ├── BacklogScreen.ts      # バックログ画面
│   │       ├── SaveLoadScreen.ts     # セーブ/ロード画面
│   │       ├── MenuScreen.ts         # メニュー画面
│   │       ├── SettingsScreen.ts     # 設定画面
│   │       ├── DebugScreen.ts        # デバッグ画面
│   │       └── GalleryScreen.ts      # ギャラリー画面
│   ├── systems/
│   │   ├── FlagSystem.ts             # フラグ管理
│   │   └── InventorySystem.ts        # アイテムインベントリ
│   ├── audio/
│   │   └── AudioManager.ts           # Web Audio API ラッパー (60+行)
│   ├── input/
│   │   └── InputManager.ts           # ポインター/キーボード入力
│   ├── storage/
│   │   └── StorageManager.ts         # IndexedDB セーブ/ロード
│   ├── ui/
│   │   ├── LoadingScreen.ts          # ローディング画面
│   │   ├── SkeletonUI.ts             # スケルトン UI
│   │   └── DiagnosticsOverlay.ts     # 診断オーバーレイ
│   ├── utils/
│   │   ├── Logger.ts                 # ログ出力
│   │   └── LRUCache.ts              # LRU キャッシュ
│   ├── config/
│   │   └── UserConfig.ts             # ユーザー設定
│   ├── main.ts                       # エントリポイント
│   ├── ksc-demo.ts                   # デモスクリプトローダー
│   ├── timeline-demo.ts             # タイムラインデモ
│   └── ksc-demo.html                # デモ HTML
├── test/
│   └── game-systems.e2e.test.ts
├── package.json
├── vite.config.ts                    # ポート 5175
└── vitest.config.ts
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| WebOpHandler.ts | 1000+ | Op 実行の中核。スプライト管理、テキスト描画、音声制御、画面状態管理 |
| KscHostAdapter.ts | 300+ | KSC VM の HostAPI 実装。KSC コマンド → WebOpHandler メソッド変換 |
| KscRunner.ts | 80+ | KSC 実行ループ。ソースコード → コンパイル → VM 実行 |
| ScreenFilter.ts | — | フィルター管理。15種のカスタム GLSL シェーダー切り替え |
| AudioManager.ts | 60+ | Web Audio API。BGM/SE/VOICE カテゴリ別音量管理 |

## レイヤー構成

```
Stage
├── Background Layer (z: 0)     # 背景画像
├── Character Layer (z: 1)      # キャラクタースプライト
├── Overlay Layer (z: 2)        # オーバーレイ画像
└── UI Layer (z: 3)             # テキストウィンドウ、選択肢、メニュー
```

## WebOpHandler の主要メソッド

| メソッド | Op 型 | 説明 |
|---------|-------|------|
| handleTextAppend | TEXT_APPEND | テキスト表示 (文字送り) |
| handleBgSet | BG_SET | 背景画像設定 (cover スケーリング) |
| handleChSet | CH_SET | キャラクター表示 (L/C/R 位置) |
| handleChHide | CH_HIDE | キャラクター非表示 |
| handleChoice | CHOICE | 選択肢 UI 表示 |
| handleJump | JUMP | ラベルジャンプ |
| handleVarSet | VAR_SET | 変数設定 |
| handleBgmPlay | BGM_PLAY | BGM 再生 |
| handleSePlay | SE_PLAY | SE 再生 |
| handleVoicePlay | VOICE_PLAY | ボイス再生 |
| handleWait | WAIT | 待機 (クリック/タイムアウト/ボイス終了) |
| handleOvlSet | OVL_SET | オーバーレイ表示 |
| handleScreenFilter | SCREEN_FILTER | スクリーンフィルター適用 |
| handleMove | MOVE | 移動アニメーション |
| handleFade | FADE | フェードアニメーション |

## スクリーンフィルター (15種)

| フィルター | 効果 |
|-----------|------|
| Bloom | グロー / 発光 |
| ChromaticAberration | 色収差 |
| ColorTint | 色調変更 |
| CRT | CRT モニター風 |
| FocusBlur | フォーカスブラー |
| GameBoy | ゲームボーイ風 |
| Glitch | グリッチ / ノイズ |
| Night | 夜景 / 暗転 |
| Noise | ノイズ |
| OldFilm | 古いフィルム風 |
| Pixelate | ピクセル化 |
| Rain | 雨エフェクト |
| Underwater | 水中エフェクト |
| Vignette | ビネット (周辺減光) |
| PC98 | PC-98 レトロ風 |

## ゲームシステム

| システム | ファイル | 説明 |
|---------|---------|------|
| セーブ/ロード | StorageManager.ts, SaveLoadScreen.ts | IndexedDB にセーブデータ保存 |
| バックログ | BacklogStore.ts, BacklogScreen.ts | 対話履歴の保存・表示 |
| 設定 | UserConfig.ts, SettingsScreen.ts | テキスト速度、音量、フルスクリーン |
| メニュー | MenuScreen.ts | ゲームメニュー |
| フラグ | FlagSystem.ts | ブール型フラグの管理 |
| インベントリ | InventorySystem.ts | アイテム管理 |
| デバッグ | DebugScreen.ts | 変数ウォッチ、ステップ実行 |
| ギャラリー | GalleryScreen.ts | CG / シーン回想 |

## 依存関係

### 内部パッケージ
- `@kaedevn/core` (Op 型、タイムライン型)
- `@kaedevn/compiler` (.ks コンパイル)
- `@kaedevn/ksc-compiler` (.ksc コンパイル + VM)
- `@kaedevn/battle` (バトルシステム)

### 主要外部ライブラリ
- `pixi.js` — WebGL レンダリング
- `vite` — 開発サーバー

## データフロー

```
[KSC スクリプト]
    ↓
[KscRunner] → [ksc-compiler] → IR
    ↓
[VM] → HostAPI コールバック
    ↓
[KscHostAdapter] → WebOpHandler メソッド呼び出し
    ↓
[WebOpHandler] → PixiJS スプライト操作
    ↓
[LayerManager] → Stage 描画
```

## テスト

- `test/game-systems.e2e.test.ts` — ゲームシステム E2E テスト
- `e2e/ksc-demo.spec.ts` (4,396行) — KSC デモの包括的テスト（背景、キャラクター、選択肢、変数、デバッグモード）
