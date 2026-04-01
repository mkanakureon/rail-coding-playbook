# 詳細設計書: エディタへのマップ機能統合

**作成日**: 2026-03-13
**対象**: `apps/editor` (React / Vite)

## 1. 目的
`maps/map-sample-room-editor.html` の機能を、React ベースのモダンなエディタ UI へ統合・刷新する。

## 2. コンポーネント構成

### `MapEditorView` (Main Component)
- `MapCanvas`: PixiJS または Canvas によるマップ編集領域。
- `TilesetPanel`: タイル選択、チップセットの切り替え。
- `LayerPanel`: レイヤーの可視性制御、追加・削除、アクティブレイヤー選択。
- `EventPanel`: マップ上のイベントリスト、プロパティ編集。

## 3. マップ編集ロジック

### 編集モード
1.  **TileMode**: タイルチップをペイントする。
2.  **CollisionMode**: 通行可能/不可能を塗り分ける。
3.  **RegionMode**: エンカウント率などの地域設定を塗る。
4.  **EventMode**: イベントオブジェクトの配置、移動。

### 履歴管理 (Undo / Redo)
- `MapData` の状態をイミュータブルに管理し、変更履歴をスタックに保持する。

## 4. UI 仕様
- **ドラッグ & ドロップ**: タイルパレットからの範囲選択とマップへの描画。
- **ショートカット**:
    - `Ctrl + Z`: Undo
    - `Ctrl + S`: 保存 (API 経由)
    - `G`: グリッド表示切り替え。

## 5. バックエンド連携 (Hono API)
- `GET /api/maps`: マップ一覧取得。
- `POST /api/maps/:id`: マップデータの保存。
- `GET /api/tilesets`: 利用可能なタイルセット一覧。
