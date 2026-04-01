---
description: Use when the user asks to create, edit, preview, or validate game maps. Triggers on "マップを作って", "マップ編集", "地形配置", "マップ一覧", "マッププレビュー".
---

# マップ操作 Skill

マップの作成・編集・プレビューを行う。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "マップを作って" | 新規マップ作成フロー |
| "マップを編集して" | 既存マップ編集 |
| "地形を配置して" | レイヤー編集 |
| "マップ一覧" | マップ一覧表示 |
| "マップをプレビューして" | PNG レンダリング |
| "マップエディタを開いて" | GUI エディタ起動 |

## 作業フロー

### 新規マップ作成

1. **タイルセット確認**
   ```bash
   node scripts/cli/map/map-cli.mjs tilesets
   node scripts/cli/map/map-cli.mjs tiles <tilesetId>
   ```

2. **マップ作成**
   ```bash
   node scripts/cli/map/map-cli.mjs create <mapId> --name "マップ名" --label "日本語名" \
     --width 20 --height 15 --tileset tileset-interior
   ```

3. **地面レイヤー生成**（2つの方法）

   **方法A: terrain テキスト（推奨）**
   ```bash
   node scripts/cli/map/map-cli.mjs gen-layer <tilesetId> <mapId> layer-ground <<'EOF'
   wall-top-left  wall-top  wall-top  wall-top-right
   wall-left      wood-floor wood-floor wall-right
   wall-left      wood-floor wood-floor wall-right
   wall-btm-left  wall-btm  wall-btm  wall-btm-right
   EOF
   ```
   - name（英語）または label（日本語）でタイルを指定可能
   - `tiles <tilesetId>` で確認した name/label を使う

   **方法B: JSON 直接編集**
   - `maps/<mapId>.json` を Read → layers[].data 配列を編集 → Write
   - `data[y * width + x] = tileId`
   - `-1` = 空タイル

4. **装飾レイヤー追加**
   - 既存レイヤーの data を Read して上書き
   - または gen-layer で新レイヤー生成

5. **コリジョン自動生成**
   ```bash
   node scripts/cli/map/map-cli.mjs gen-collision <mapId>
   ```

6. **イベント追加**
   ```bash
   node scripts/cli/map/map-cli.mjs add-event <mapId> \
     --name "exit-door" --label "出口" --x 5 --y 14 \
     --trigger touch --note "外のマップへ遷移"
   ```

7. **バリデーション**
   ```bash
   node scripts/cli/map/map-cli.mjs validate <mapId>
   ```

8. **プレビュー**
   ```bash
   node scripts/cli/map/render-map.mjs <mapId> maps/<mapId>-preview.png
   ```

### 既存マップ編集

1. **現状確認**
   ```bash
   node scripts/cli/map/map-cli.mjs show <mapId>
   ```

2. **JSON を直接編集**
   - Read: `maps/<mapId>.json`
   - 編集: layers[].data, events[], playerStart 等を変更
   - Write: 保存

3. **バリデーション + プレビュー**
   ```bash
   node scripts/cli/map/map-cli.mjs validate <mapId>
   node scripts/cli/map/render-map.mjs <mapId> maps/<mapId>-preview.png
   ```

### GUI エディタで開く

```bash
node scripts/cli/map/open-map-editor.mjs <mapId>
```
- ブラウザで Canvas 2D エディタが開く
- サーバ不要（file:// + base64 埋め込み）
- 編集後は Export JSON でダウンロード → maps/ に配置

## CLI コマンドリファレンス

| コマンド | 説明 |
|----------|------|
| `tilesets` | タイルセット一覧 |
| `tiles <tilesetId>` | タイル一覧（ID/name/label/terrain/passable） |
| `list` | マップ一覧 |
| `show <mapId>` | マップ詳細（レイヤー/イベント一覧、terrain ビュー） |
| `create <mapId> [opts]` | 新規マップ作成 |
| `validate <mapId>` | バリデーション |
| `gen-layer <tsId> <mapId> <layerId>` | name/label テキスト → data 配列 |
| `gen-collision <mapId>` | passable から collision レイヤー自動生成 |
| `add-event <mapId> [opts]` | イベント追加 |
| `remove-event <mapId> <eventId>` | イベント削除 |
| `resize <mapId> --width N --height N` | マップリサイズ |
| `set-player <mapId> --x N --y N` | プレイヤー開始位置設定 |
| `set-prop <mapId> [opts]` | マッププロパティ変更（bgm/weather/label等） |
| `render <mapId> [output.png]` | PNG プレビュー出力 |
| `edit <mapId>` | GUI エディタを開く |

## ファイル配置

```
maps/tilesets.json          -- タイルセット定義（全タイルセット）
maps/<mapId>.json           -- マップデータ
assets/tilesets/*.png       -- タイルセット画像
```

## data 配列のルール

- `data[y * width + x] = tileId`（左上原点、行優先）
- `-1` = 空タイル（透明）
- `data.length` は必ず `width * height` と一致
- collision レイヤー: `0`=通行可、`1`=通行不可、`2`=特殊（上から通行可等）

## マップ JSON の主要プロパティ

| プロパティ | 必須 | 説明 |
|-----------|------|------|
| id | Yes | `map-xxx` 形式 |
| name | Yes | 英語名 |
| label | Yes | 日本語表示名 |
| width, height | Yes | タイル数 |
| tileWidth, tileHeight | Yes | 48（デフォルト） |
| tilesets | Yes | 使用タイルセット ID の配列 |
| layers | Yes | レイヤー配列 |
| events | No | イベント配列 |
| playerStart | No | `{ x, y, direction }` |
| bgm, bgs | No | BGM/環境音 ID |
| connections | No | マップ間接続 |
