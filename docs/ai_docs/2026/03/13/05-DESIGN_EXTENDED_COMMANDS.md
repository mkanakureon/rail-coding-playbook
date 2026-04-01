# 詳細設計書: コマンドセット拡張 (RPG & Item)

**作成日**: 2026-03-13
**対象**: `packages/core`, `packages/compiler`

## 1. 目的
ノベルエンジンに RPG 的要素（マップ移動、アイテム操作）を組み込むため、標準命令セット (Op) を拡張し、コンパイラで扱えるようにする。

## 2. 新規追加コマンド定義

### 2.1 マップ操作 (Map Ops)
| コマンド名 | Op 型 | 引数 | 説明 |
| :--- | :--- | :--- | :--- |
| `map_load` | `MAP_LOAD` | `mapId`, `x?`, `y?`, `dir?` | 指定マップへ移動し、座標を指定する。 |
| `map_move` | `MAP_MOVE` | `x`, `y` | 同一マップ内での強制移動。 |
| `map_tint` | `MAP_TINT` | `r`, `g`, `b`, `a`, `durationMs?` | マップ全体の色調変更。 |
| `event_move` | `EVENT_MOVE` | `eventId`, `x`, `y` | 特定のイベント（NPCなど）を指定座標へ。 |

### 2.2 アイテム操作 (Item Ops)
| コマンド名 | Op 型 | 引数 | 説明 |
| :--- | :--- | :--- | :--- |
| `item_add` | `ITEM_ADD` | `itemId`, `count?` | アイテムの追加。 |
| `item_remove` | `ITEM_REMOVE` | `itemId`, `count?` | アイテムの削除。 |
| `item_clear` | `ITEM_CLEAR` | なし | 全アイテムの削除。 |

## 3. 実装詳細

### `packages/core/src/types/Op.ts` への追加
```typescript
export type Op =
  // ...既存のOp...
  | { op: "MAP_LOAD"; mapId: string; x?: number; y?: number; direction?: Direction }
  | { op: "ITEM_ADD"; itemId: string; count?: number }
  | { op: "ITEM_REMOVE"; itemId: string; count?: number }
  // ...
```

### `packages/core/src/registry/commandDefinitions.ts` への追加
- `CommandCategory` に `map`, `item` を追加。
- 各新規コマンドのメタデータ（引数名、必須フラグ、型）を定義。

### `packages/compiler/src/parser/parseCommand.ts`
- 新規コマンドをトークンから `Op` へ変換するパーサーロジックの追加（引数のパース）。

## 4. バリデーション
- `MAP_LOAD` 時、参照先の `mapId` が存在するファイルを指しているか、ビルド時に検証する。
- `ITEM_ADD` 等で使用される `itemId` が定義済みデータにあるかチェックする。
