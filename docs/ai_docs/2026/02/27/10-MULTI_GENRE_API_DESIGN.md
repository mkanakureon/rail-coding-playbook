# ジャンル別拡張設計書：共通APIと個別実装仕様

**日付**: 2026-02-27
**レビュアー**: Gemini CLI
**対象**: `IEngineAPI` の拡張およびマルチジャンル対応

---

## 1. 共通 API 基盤 (Universal Core API)
全ジャンルで共通して使用する、低レイヤーの抽象化層です。既存の `IEngineAPI` を含みます。

### 1.1 レンダリング・リソース管理
*   `showImage(layerId, assetId, transform, effect)`: 指定レイヤーに画像を表示。
*   `hideImage(layerId, effect)`: 画像を非表示。
*   `playAudio(type, assetId, volume, loop)`: BGM/SE/VOICEの再生。
*   `setCamera(position, zoom, shake)`: カメラ（ビューポート）の制御。

### 1.2 UI・インタラクション
*   `drawUI(uiJsonId, dataContext)`: JSON定義に基づき、ボタン、プログレスバー、テキストを動的に描画。
*   `waitForInput(inputMask)`: 特定の入力（OK, Back, 方向キー等）を待機。
*   `showChoice(options)`: 汎用選択肢の表示。

### 1.3 状態管理 (State)
*   `getVar(key)` / `setVar(key, value)`: ゲーム変数の操作。
*   `saveSnapshot()` / `loadSnapshot()`: 任意時点の状態保存。

---

## 2. ジャンル別追加 API と実装詳細

### 2.1 ノベル・アドベンチャー (Visual Novel / ADV)
**特徴**: テキスト、立ち絵、背景のレイヤー管理とフラグ分岐。

*   **専用 API**:
    *   `showDialogue(speaker, text)`: メッセージウィンドウへのテキスト流し込み。
    *   `setBacklog(entry)`: 履歴への追加。
    *   `autoSkip(enabled)`: オート/スキップモードの切り替え。
*   **実装上の要点**:
    *   **TextWindow クラス**: 禁則処理、ルビ対応、クリック待ちアイコンの制御。
    *   **CharacterLayer**: Z順序を管理し、キャラクター同士の重なりを制御。

### 2.2 コマンドバトル (Turn-based RPG)
**特徴**: ターン制ロジック、動的なステータス表示、演出アニメーション。

*   **専用 API**:
    *   `battleStart(troopId)`: バトルシーンへの遷移とデータの初期化。
    *   `updateStatus(actorId, statusDelta)`: HP/MPの変動をUIに反映（アニメーション付き）。
    *   `playBattleAnim(animId, targetId)`: エフェクト（パーティクル、画面フラッシュ）の再生。
*   **実装上の要点**:
    *   **BattleLogic (C++移植)**: `packages/battle` の計算式を Native 側に移植し、Web版と同一のダメージ計算を保証。
    *   **CommandUI**: 攻撃、スキル、防御などの階層化されたボタンメニューの動的生成。

### 2.3 フィールド探索 (Top-down Adventure)
**特徴**: タイルマップ、衝突判定、イベント接触。

*   **専用 API**:
    *   `loadMap(mapId, startPos)`: タイルマップデータのロード。
    *   `moveEntity(entityId, targetPos, speed)`: キャラクターやオブジェクトの移動。
    *   `onEntityTrigger(callback)`: プレイヤーがイベント（扉、NPC）に接触した際のフック。
*   **実装上の要点**:
    *   **TileMapRenderer**: `SDL_RenderCopy` を用いた高速なタイル描画。
    *   **CollisionSystem**: AABB（軸並行境界ボックス）によるシンプルな当たり判定。

### 2.4 アクション・ミニゲーム (Action / Arcade)
**特徴**: 毎フレームの更新 (Update Loop)、物理演算、入力レスポンス。

*   **専用 API**:
    *   `setPhysics(gravity, friction)`: 物理パラメータの設定。
    *   `applyImpulse(entityId, vector)`: 瞬間的な力の付与（ジャンプ等）。
    *   `setUpdateCallback(scriptFunction)`: 毎フレーム実行するロジックを KSC 側から登録。
*   **実装上の要点**:
    *   **GameLoop 拡張**: 従来の「命令待ち」ではなく、毎フレーム `update()` を呼び出すモードの追加。
    *   **InputState**: キーの「押し下げ中」状態をリアルタイムで取得。

---

## 3. 実装ロードマップ (Implementation Strategy)

### Step 1: `DynamicUI` システムの導入
共通 API に `drawUI(json)` を追加します。これにより、バトル画面やステータス画面を C++ コードを書き換えずに作成可能にします。

### Step 2: レイヤーマネージャーの抽象化
`SDL2Engine.cpp` 内でハードコードされている描画順を、スタック型のレイヤー管理に変更します。
*   Layer 0: Map (Action/ADV用)
*   Layer 1: Background
*   Layer 2: Characters / Entities
*   Layer 3: UI / Dialogue
*   Layer 4: Overlays (Fade/Flash)

### Step 3: ジャンル別 `OpHandler` の定義
`Interpreter` はそのままに、`battle()` や `move_map()` などの新しい命令（Op）を追加し、各プラットフォームのエンジン側でハンドラを実装します。

---

## 4. 結論

本設計により、kaedevn エンジンは単なるノベルエンジンから、**「シナリオ駆動型のマルチジャンル・ゲームフレームワーク」**へと進化します。

共通 API を薄く保ち、ジャンル固有のロジックを `IEngineAPI` の拡張として定義することで、**Android, macOS, Web の全てのプラットフォームにおいて、ジャンルを跨いだ 100% のコード共有**が継続可能となります。

---
*Created by Gemini CLI. The roadmap to multi-genre support is now technically defined.*
