# セーブスキーマ v2 設計

**作成日**: 2026-03-16
**対象**: Phase 3〜5 で必要な全フィールドを含む新セーブスキーマ
**方針**: リリース前のため後方互換は不要。最初から完成形で定義する

---

## 1. 現行スキーマ（v1）— 廃止予定

```typescript
// packages/core/src/types/SaveData.ts（現行）
export interface SaveData {
  save_schema_version: 1;
  engine_version: string;
  work_id: string;
  scenario_id: string;
  node_id: string;
  vars: Record<string, unknown>;
  read: Record<string, unknown>;
  timestamp: number;
  flags?: Record<string, unknown>;
  inventory?: Record<string, number>;
  viewState?: ViewState;
  thumbnail?: string;
}
```

**問題点:**
- `inventory` が `Record<string, number>` で装備・ゴールドを表現できない
- パーティ状態（HP/MP/レベル）の保存先がない
- マップ位置の保存先がない
- `flags` と `vars` が重複している

---

## 2. 新スキーマ（v2）

リリース前なので段階的マイグレーション（v1.1→v1.2→v1.3）は不要。
全機能を最初から含む v2 を一括定義する。

```typescript
// packages/core/src/types/SaveData.ts

export interface SaveData {
  save_schema_version: 2;
  engine_version: string;
  work_id: string;
  scenario_id: string;
  node_id: string;
  timestamp: number;

  // ===== ノベル基盤（v1 から継続） =====
  vars: Record<string, unknown>;       // フラグ・変数
  read: Record<string, unknown>;       // 既読ページ

  // ===== 表示状態 =====
  viewState?: ViewState;               // 背景・キャラ・オーバレイの表示状態
  thumbnail?: string;                  // サムネイル画像（base64）

  // ===== インベントリ =====
  inventory: {
    gold: number;
    items: Record<string, number>;     // itemId → 所持数
    equipment: Record<string, {        // actorId → 装備
      weapon?: string;                 // アイテム ID
      armor?: string;                  // アイテム ID
    }>;
  };

  // ===== パーティ =====
  party: {
    members: string[];                 // actorId の配列（先頭がリーダー）
    states: Record<string, {           // actorId → 現在のステータス
      hp: number;
      mp: number;
      level: number;
      exp: number;
      statuses: string[];              // 付与中のステータス異常 ID
    }>;
  };

  // ===== マップ状態 =====
  mapState: {
    currentMapId: string;
    playerX: number;
    playerY: number;
    direction: 'up' | 'down' | 'left' | 'right';
    visitedMaps: string[];
  } | null;                            // null = シナリオモード（マップ未使用）
}
```

### v1 との差分

| フィールド | v1 | v2 | 変更理由 |
|-----------|:--:|:--:|---------|
| `save_schema_version` | `1` | `2` | 新スキーマ |
| `flags` | あり（オプショナル） | **削除** | `vars` と重複 |
| `inventory` | `Record<string, number>?` | 構造化オブジェクト | gold・装備を表現 |
| `party` | なし | 追加 | バトル状態の保存 |
| `mapState` | なし | 追加 | マップ位置の保存 |

### デフォルト値

ノベル専用プロジェクトでは inventory / party / mapState は使わないが、型としては必須。
セーブ生成時にデフォルト値を適用する:

```typescript
export const DEFAULT_SAVE_DATA: Omit<SaveData, 'engine_version' | 'work_id' | 'scenario_id' | 'node_id' | 'timestamp'> = {
  save_schema_version: 2,
  vars: {},
  read: {},
  inventory: {
    gold: 0,
    items: {},
    equipment: {},
  },
  party: {
    members: [],
    states: {},
  },
  mapState: null,
};
```

---

## 3. ファイル変更一覧

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `packages/core/src/types/SaveData.ts` | v2 スキーマに置き換え。`flags` 削除 |
| 2 | `packages/web/src/engine/WebOpHandler.ts` | セーブ生成時に v2 構造で出力 |
| 3 | `packages/web/src/systems/InventorySystem.ts` | `toJSON()` / `loadJSON()` を v2 の inventory 構造に対応 |
| 4 | `packages/core/src/types/index.ts` | re-export 更新 |

**不要になったもの:**
- ~~`migrateSaveData.ts`~~ — マイグレーション関数は不要
- ~~`SaveDataV1_1` / `SaveDataV1_2` / `SaveDataV1_3`~~ — 中間バージョンの型は不要
- ~~`AnySaveData` / `CurrentSaveData`~~ — バージョン分岐の型は不要

---

## 4. 各システムとの連携

### InventorySystem（既存）

```typescript
// Before: Record<string, number>
toJSON(): Record<string, number>
loadJSON(data: Record<string, number>): void

// After: v2 の inventory 構造
toJSON(): SaveData['inventory']
loadJSON(data: SaveData['inventory']): void
```

`gold` と `equipment` の管理を InventorySystem に追加するか、別クラスに分離するかは実装時に判断。

### バトルシステム（Phase 4）

バトル終了後にパーティ状態をセーブデータに反映:

```typescript
// WebOpHandler.battleStart() の戻り処理
const partyStates: SaveData['party']['states'] = {};
for (const actor of battleResult.party) {
  partyStates[actor.id] = {
    hp: actor.hp,
    mp: actor.mp,
    level: actor.level,
    exp: actor.exp,
    statuses: actor.statuses.map(s => s.id),
  };
}
this.saveData.party.states = partyStates;
```

### マップシステム（Phase 5）

マップ遷移時に mapState を更新:

```typescript
// MapSystem 内
this.saveData.mapState = {
  currentMapId: mapId,
  playerX: this.player.x,
  playerY: this.player.y,
  direction: this.player.direction,
  visitedMaps: [...(this.saveData.mapState?.visitedMaps ?? []), mapId],
};
```

---

## 5. テスト計画

| テスト | 内容 |
|-------|------|
| 型チェック | `npm run typecheck` — SaveData v2 型が全パッケージで整合 |
| セーブ/ロード | v2 構造でセーブ → ロード → 全フィールドが復元される |
| ノベル専用 | inventory/party/mapState がデフォルト値のまま正常動作する |
| InventorySystem | 新 inventory 構造での add/remove/toJSON/loadJSON |

### 確認事項

- [ ] v2 でセーブ → ロードで全フィールドが復元される
- [ ] ノベル専用プロジェクトで inventory/party/mapState がデフォルト値のまま動作する
- [ ] InventorySystem の toJSON/loadJSON が v2 構造に対応している
- [ ] `save_schema_version: 2` がセーブデータに含まれる

---

## 6. 注意事項

1. **v1 との後方互換は不要** — リリース前のため、既存のセーブデータは破棄して問題ない
2. **リリース後は後方互換が必要になる** — v2 が確定した後にスキーマを変更する場合は、マイグレーション関数を実装する
3. **`flags` フィールドは削除** — `vars` と機能が重複しているため統合。既存コードで `flags` を参照している箇所があれば `vars` に置き換える
4. **ノベルプロジェクトへの影響ゼロ** — 新フィールドはデフォルト値で初期化されるため、RPG 機能を使わないプロジェクトの動作は変わらない
