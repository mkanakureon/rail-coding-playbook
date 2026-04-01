# 詳細設計書: マップエンジン & PixiJS レンダラー

**作成日**: 2026-03-13
**対象**: `packages/web/src/systems/MapSystem.ts`

## 1. 目的
`packages/map` のデータを元に、PixiJS を使用して 2D タイルマップを描画し、プレイヤーキャラクターの移動を制御する。

## 2. 描画構造 (PixiJS Layering)
マップは複数のレイヤーで構成され、以下の Z-Order で描画する。

1.  **ParallaxLayer**: 遠景（背景）。
2.  **GroundLayer**: `MapLayer.type === "tile"` のうち、最下層。
3.  **DecorLayer**: 装飾タイル。
4.  **EntityLayer**: プレイヤー、NPC、イベントスプライト。Y座標によるソート (Y-Sorting) を行う。
5.  **OverheadLayer**: キャラクターの上を覆うタイル（屋根、木の上部など）。
6.  **CollisionDebugLayer**: デバッグ用。衝突判定を可視化する。

## 3. 主要クラス構成

### `MapSystem` (Main System)
- `loadMap(mapData: MapData)`: 指定されたマップデータを読み込み、PixiJS コンテナを構築する。
- `update(dt: number)`: キャラクターの移動、カメラの追従、アニメーションタイルの更新。
- `checkCollision(x: number, y: number): boolean`: 指定座標の通行可否を返す。

### `MapTileRenderer`
- `TilingSprite` または `Container` を使用した効率的な描画。
- ビューポート外のタイルをカリング（描画スキップ）する最適化。

### `CharacterSprite`
- 4方向/8方向のアニメーション制御。
- 歩行グラフィックの切り替えロジック（`packages/map` の `EventSprite` 準拠）。

## 4. 移動ロジック
- **グリッドベース移動**: ツクール同様、1タイル単位での移動入力を受け付けるが、描画上はスムーズに補完する。
- **入力ソース**: `InputManager` からの `UP/DOWN/LEFT/RIGHT` アクション。
- **衝突判定アルゴリズム**:
    1.  移動先タイルの `CollisionValue` をチェック。
    2.  同一座標に存在する `MapEvent` (priority="same") の有無をチェック。

## 5. データ連携
- マップ切り替え時に、前マップのエンティティを破棄し、新マップの `playerStart` または指定座標にプレイヤーを配置する。
- `SaveData` からの復帰時は、`mapId`, `x`, `y`, `direction` を元に初期化する。
