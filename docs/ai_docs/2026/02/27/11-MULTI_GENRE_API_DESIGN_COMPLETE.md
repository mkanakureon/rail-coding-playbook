# ジャンル別拡張設計書：共通APIと個別実装仕様 (完全版)

**日付**: 2026-02-27
**レビュアー**: Gemini CLI
**対象**: `IEngineAPI` の拡張および全5ジャンル（ノベル, RPG, ローグライク, 放置, 育成）対応

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
*   `waitForInput(inputMask)`: 特定の入力（OK, Back, 方向キー, タップ等）を待機。
*   `showChoice(options)`: 汎用選択肢の表示。

### 1.3 状態管理 (State) & 時間
*   `getVar(key)` / `setVar(key, value)`: ゲーム変数の操作。
*   `getTimestamp()`: 現在時刻（UNIXタイム）の取得（放置ゲー用）。
*   `saveSnapshot()` / `loadSnapshot()`: 任意時点の状態保存。

---

## 2. ジャンル別追加 API と実装詳細

### 2.1 ノベル・アドベンチャー (Visual Novel / ADV)
**特徴**: テキスト、立ち絵、背景のレイヤー管理とフラグ分岐。
*   **専用 API**:
    *   `showDialogue(speaker, text)`: メッセージウィンドウへのテキスト流し込み。
    *   `setBacklog(entry)`: 履歴への追加。
*   **実装上の要点**: `TextWindow` クラスによる禁則処理と `CharacterLayer` によるZ順序管理。

### 2.2 コマンドバトル RPG (Command-Based Battle)
**特徴**: ターン制ロジック、動的なステータス表示。
*   **専用 API**:
    *   `battleStart(troopId)`: バトルシーンへの遷移とデータの初期化。
    *   `playBattleEffect(effectId, targetId)`: パーティクルや画面フラッシュの再生。
*   **実装上の要点**: `packages/battle` の計算式を C++ へ移植し、Web/Native で同一のダメージ計算を保証。

### 2.3 軽量 RPG / フィールド探索 (RPG Exploration)
**特徴**: タイルマップ、衝突判定、イベント接触。
*   **専用 API**:
    *   `loadMap(mapId, startPos)`: タイルマップデータのロード。
    *   `moveEntity(entityId, targetPos, speed)`: キャラクターやオブジェクトの移動。
*   **実装上の要点**: `SDL_RenderCopy` を用いた高速タイル描画と AABB による当たり判定。

### 2.4 ローグライク・ダンジョン (Procedural Roguelike)
**特徴**: グリッドベース、ターン管理、ランダム生成。
*   **専用 API**:
    *   `setGridMap(width, height, data)`: 動的に生成されたタイルデータの流し込み。
    *   `processTurn()`: 全エンティティの行動を1ステップ進める。
    *   `getEntitiesAt(x, y)`: 特定グリッド上のオブジェクト取得。
*   **実装上の要点**: 複雑なパスファイディング（A*）や視界範囲計算（FOV）を C++/TS 両側で最適化実装。

### 2.5 放置ゲー・クリッカー (Idle / Clicker)
**特徴**: 時間経過によるリソース増加、オフライン報酬。
*   **専用 API**:
    *   `calculateOfflineProgress(lastTimestamp)`: 離脱時間に基づいた報酬計算。
    *   `updateResource(id, perSecondAmount)`: 毎秒の自動増加設定。
*   **実装上の要点**: 64bit整数（BigInt）または浮動小数点による大規模な数値インフレへの対応。

### 2.6 育成シミュレーション (Training / Management)
**特徴**: パラメータ管理、スケジュール進行、複雑なイベント分岐。
*   **専用 API**:
    *   `bindUIValue(uiElementId, varName)`: UIと変数を直結し、自動でメータを更新。
    *   `triggerEventByParams(paramCriteria)`: 現在のパラメータ条件に合致するイベントを自動抽出。
*   **実装上の要点**: 膨大なパラメータとイベントの依存関係を管理する「イベントスケジューラ」の導入。

---

## 3. 実装ロードマップ (Implementation Strategy)

1.  **Step 1: 状態管理の強化 (Variable Engine)**: 配列やオブジェクト、および BigInt への対応。
2.  **Step 2: レイヤーマネージャーの抽象化**: 描画順をスタック型のレイヤー管理（Map, Character, UI, Effect）に変更。
3.  **Step 3: 動的 UI システム (Dynamic UI)**: JSONによるUI定義を全プラットフォームで解釈可能にする。

---
*Created by Gemini CLI. The "Universal Playback Machine" architecture for any 2D genre is now fully designed.*
