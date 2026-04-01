# ジャンル戦略 実装計画書: ノベルゲーム & ツクール系サポート

**作成日**: 2026-03-13
**作成者**: Gemini CLI

## 1. 概要

`01-GENRE_STRATEGY_GAP_ANALYSIS.md` で特定されたギャップを埋めるための具体的な実装項目を定義する。
本計画は、まず「マップ機能のエンジン統合」を最優先とし、段階的にエディタ統合、戦闘システムの洗練、クロスプラットフォーム対応へと進める。

---

## 2. フェーズ別実装項目

### フェーズ 1: マップエンジン基礎 (Core & Web)
**目標**: PixiJS 上でマップを表示し、キャラクターが移動できる最小構成を構築する。

- [ ] **1-1. Core 命令セットの拡張** (`packages/core`)
    - `Op.ts` に `MAP_LOAD`, `MAP_MOVE`, `MAP_EXIT`, `EVENT_MOVE` 命令を追加。
    - `commandDefinitions.ts` へのレジストリ登録。
- [ ] **1-2. PixiJS マップレンダラーの実装** (`packages/web`)
    - `MapSystem.ts` の新規作成。
    - `packages/map` のデータを元に Tilemap (TilingSprite または Container 構成) を生成。
    - レイヤー構造（地面、装飾、通行不能、オーバーヘッド）の再現。
- [ ] **1-3. プレイヤー移動・衝突判定** (`packages/web`)
    - 4方向/8方向移動ロジック（ピクセル移動/グリッド吸着）。
    - `CollisionLayer` に基づいた通行判定。
    - マップ端のスクロール（CameraSystem との連携）。
- [ ] **1-4. セーブデータ拡張** (`packages/core`)
    - `SaveData.ts` に `mapId`, `playerPos` (x, y, dir) を追加。
    - `ViewState.ts` へのマップ表示状態の保持。

### フェーズ 2: シナリオ連携 & イベント (Interpreter Integration)
**目標**: マップ上のイベントからノベルシナリオ（.ksc）を呼び出し、双方向の連携を実現する。

- [ ] **2-1. マップイベント発火機構** (`packages/web`)
    - `action` (決定ボタン) または `touch` (接触) 時の判定。
    - イベントの `scenarioId` を指定して `OpRunner.start()` を呼ぶブリッジ。
- [ ] **2-2. RPG コマンドのインタプリタ統合** (`packages/interpreter`)
    - `IEngineAPI` への `loadMap`, `movePlayer`, `getMapId` 等のメソッド追加。
    - `.ksc` スクリプト内での `await loadMap("village")` 呼び出しのサポート。
- [ ] **2-3. アイテム・インベントリの標準化** (`packages/core`)
    - `InventorySystem` のロジックを `core` の命令（`ITEM_ADD`, `ITEM_HAS` 等）として昇格。
    - セーブデータへの完全な統合と復元。

### フェーズ 3: エディタ統合 (Editor & UX)
**目標**: シナリオ編集と同様の手軽さで、マップや戦闘データを編集可能にする。

- [ ] **3-1. マップエディタの React 統合** (`apps/editor`)
    - `maps/` にあるプロトタイプを React コンポーネント化。
    - タイルパレットからの選択、ペイント、塗りつぶし、消しゴム機能。
- [ ] **3-2. イベントエディタ UI** (`apps/editor`)
    - マップ上のイベント配置とプロパティ編集。
    - イベント発生条件 (スイッチ/変数) のビジュアル設定。
- [ ] **3-3. アセットブラウザの強化** (`apps/editor`)
    - `PNG/公式アセット` をジャンル別にブラウズ・プレビュー・インポートする機能。

### フェーズ 4: 戦闘システム洗練 & 演出 (Battle & VFX)
**目標**: DOM ベースの簡易戦闘から、PixiJS ベースの演出豊かな戦闘へ進化させる。

- [ ] **4-1. PixiJS バトルレンダラー** (`packages/web`)
    - 敵スプライトの表示、アニメーション、ダメージポップアップ。
    - エフェクト命令 (`FLASH`, `SHAKE`) との同期。
- [ ] **4-2. バトル UI コンポーネント** (`packages/web/renderer/ui`)
    - コマンド選択メニュー、HP/MP ゲージの PixiJS 実装。

### フェーズ 5: ネイティブ・クロスプラットフォーム (Native & Switch)
**目標**: ブラウザだけでなく、実機 (Switch/Android) でのパフォーマンスを最適化する。

- [ ] **5-1. Native Engine Bridge (QuickJS)** (`packages/native-engine`)
    - C++ 環境での JavaScript 実行環境の整備。
    - `IEngineAPI` の C++ 実装と JavaScript 側のスタブ連携。
- [ ] **5-2. SDL2 レンダリングバックエンド** (`packages/native-engine`)
    - PixiJS の描画命令を SDL2 の命令に変換、または同一の描画結果を出す C++ 実装の検証。

---

## 3. マイルストーン (Milestones)

1. **M1: Map Walking** (フェーズ1完了)
    - 成果物: マップが表示され、キャラクターが歩ける Web デモ。
2. **M2: RPG-VN Hybrid** (フェーズ2完了)
    - 成果物: 村人と話すとノベル形式の会話が始まるゲームループの完成。
3. **M3: Editor Ready** (フェーズ3完了)
    - 成果物: 開発者がコードを書かずにマップを作成できる状態。
4. **M4: Phase 1 Final** (フェーズ4, 5完了)
    - 成果物: Switch/Android で動作する RPG/ノベル作品の完成。

---

## 4. 次のアクション

1. **[Core]** マップ関連の `Op` 定義と `commandDefinitions.ts` の更新。
2. **[Web]** `packages/web/src/systems/MapSystem.ts` のプロトタイプ作成。
3. **[Compiler]** `.ksc` および `.knf` での新コマンドのサポート。
