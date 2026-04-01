# 詳細機能差分マトリックス: ジャンル戦略達成への道

**更新日**: 2026-03-13
**対象範囲**: ノベルエンジン基盤、RPGマップシステム、戦闘システム、エディタ、ネイティブ

本ドキュメントは、現在のリポジトリに存在する「資産（実装済み）」と、Phase 1 達成のために必要な「不足（未実装）」をファイル・ロジック単位で詳細に定義する。

---

## 1. スクリプト・命令セット (Core & Interpreter)

| 機能カテゴリ | 実装済み (資産) | 未実装 (ギャップ) | 関連ファイル |
| :--- | :--- | :--- | :--- |
| **ノベル命令** | 背景、キャラ、BGM、SE、選択肢、分岐、変数操作の完全なセット。 | 特になし。 | `packages/core/src/types/Op.ts`<br>`packages/core/src/registry/commandDefinitions.ts` |
| **アイテム命令** | なし。 | `ITEM_ADD`, `ITEM_REMOVE`, `ITEM_HAS` 等の正規 Op 命令化。 | (新規追加が必要) |
| **マップ命令** | なし。 | `MAP_LOAD`, `MAP_MOVE`, `MAP_EXIT`, `EVENT_MOVE` 等の Op 命令化。 | (新規追加が必要) |
| **KSC (JS) 連携** | `giveItem`, `hasItem`, `battleStart` が HostCall として定義済み。 | `loadMap`, `movePlayer` 等の RPG 用 HostCall の追加。 | `packages/web/src/engine/KscHostAdapter.ts` |
| **インターフェース** | `IEngineAPI` にノベル・バトル用の定義あり。 | `IEngineAPI` への RPG 拡張（マップ操作メソッド）の追加。 | `packages/interpreter/src/engine/IEngineAPI.ts` |

---

## 2. マップ・移動システム (RPG Map)

| 機能カテゴリ | 実装済み (資産) | 未実装 (ギャップ) | 関連ファイル |
| :--- | :--- | :--- | :--- |
| **データ定義** | `MapData`, `MapLayer`, `MapEvent`, `TilesetDef` の完全なスキーマ。 | なし。 | `packages/map/src/types.ts` |
| **バリデーション** | マップ構造、タイルセットの整合性チェック。 | なし。 | `packages/map/src/validate.ts` |
| **描画 (PixiJS)** | なし。 (HTML Canvas 版のプロトタイプのみ存在) | `MapSystem.ts` の新規作成。PixiJS によるタイルマップ・レイヤー描画。 | (新規) `packages/web/src/systems/MapSystem.ts` |
| **衝突判定** | `CollisionValue` (0:通行可, 1:不可) の定義とデータ構造。 | プレイヤー座標とタイルマップ・コリジョンレイヤーを照合するロジック。 | `packages/map/src/types.ts` |
| **イベント発火** | マップ上のイベント (`MapEvent`) の配置定義。 | 指定座標のイベントを検出し、`scenarioId` をトリガーする発火エンジン。 | `packages/map/src/types.ts` |
| **カメラ** | `CAMERA_SET` による座標追従。 | キャラクターを画面中央に保ちながらマップをスクロールさせる追従モード。 | `packages/core/src/types/Op.ts` |

---

## 3. 戦闘システム (Battle)

| 機能カテゴリ | 実装済み (資産) | 未実装 (ギャップ) | 関連ファイル |
| :--- | :--- | :--- | :--- |
| **コアロジック** | ダメージ計算、ターン処理、簡易 AI、勝敗判定のピュア JS 実装。 | なし。 | `packages/battle/src/core/` |
| **データセット** | `Troop` (敵グループ), `Enemy`, `Skill` の基本データ定義。 | なし。 | `packages/battle/src/data/` |
| **バトル UI** | DOM Overlay による簡易的なメニュー表示と進行ロジック。 | PixiJS によるゲーム画面内での UI 描画（HP ゲージ、コマンド）。 | `packages/web/src/renderer/WebOpHandler.ts` |
| **演出 (VFX)** | `SHAKE`, `FLASH` 等の基本エフェクト。 | キャラクターの被弾アニメーション、エフェクト再生とダメージ表示の同期。 | `packages/web/src/renderer/WebOpHandler.ts` |

---

## 4. エディタ統合 (Editor Tooling)

| 機能カテゴリ | 実装済み (資産) | 未実装 (ギャップ) | 関連ファイル |
| :--- | :--- | :--- | :--- |
| **シナリオ編集** | React + Monaco Editor による `.ksc` 編集とプレビュー。 | なし。 | `apps/editor/src/pages/EditorPage.tsx` |
| **マップエディタ** | スタンドアロンの HTML 版エディタ（タイル配置、レイヤー、プレビュー機能）。 | `apps/editor` (React) への統合。タイルパレット、マップリスト管理。 | `maps/map-sample-room-editor.html` (参考) |
| **アセット管理** | 5ジャンルの大量な立ち絵画像。 | エディタ内からこれらを選択・プレビュー・適用する UI。 | `PNG/公式アセット/` |
| **プロジェクト設定** | `ProjectConfig` による基本メタデータ管理。 | 初期マップ、初期パーティ、ゲームモード（Novel or RPG）の設定。 | `packages/core/src/types/ProjectConfig.ts` |

---

## 5. ネイティブ・クロスプラットフォーム (Mobile / Switch)

| 機能カテゴリ | 実装済み (資産) | 未実装 (ギャップ) | 関連ファイル |
| :--- | :--- | :--- | :--- |
| **描画コア (C++)** | SDL2 を使用した画像・テキスト表示の基本エンジン。 | PixiJS の命令セットを C++ 側で再現する描画ブリッジ。 | `packages/native-engine/src/` |
| **Android 移植** | Gradle 設定、実機ビルド、Web と同一ロジックの動作確認。 | 特になし。 (ビルド自動化のみ) | `packages/native-engine/android/` |
| **JS ブリッジ** | なし。 (現在は Web エンジンを WebView 等で実行、または C++ 版は静的データのみ) | QuickJS を組み込み、`.ksc` インタプリタを C++ ネイティブで動かす。 | (新規追加が必要) |

---

## 6. 実装が必要な最重要項目リスト (Immediate Todo)

実装計画書 (`02-GENRE_STRATEGY_IMPLEMENTATION_PLAN.md`) を補足する、具体的コードレベルの Todo である。

1.  **[Core]** `packages/core/src/registry/commandDefinitions.ts` に以下のコマンドを追加:
    - `map_load`, `map_move`, `map_jump`, `event_move`, `item_add`, `item_remove`
2.  **[Web]** `packages/web/src/systems/MapSystem.ts` を作成:
    - `MapData` を受け取り、PixiJS の `Container` にレイヤーごとの `Sprite` を展開する。
3.  **[Web]** `packages/web/src/input/InputManager.ts` を拡張:
    - 十字キー/アナログスティックによるキャラクター移動ベクトルの生成。
4.  **[Interpreter]** `packages/interpreter/src/engine/IEngineAPI.ts` を拡張:
    - `loadMap(id)`, `movePlayer(x, y)`, `getMapPos()` 等を定義。
5.  **[Editor]** `apps/editor/src/pages/MapEditorPage.tsx` を新規作成:
    - `maps/map-sample-room-editor.html` の Canvas 操作ロジックを React の `useRef` と `useEffect` に移植。
