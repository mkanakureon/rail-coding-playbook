# Phase 3 実装設計: gameDb 統合スキーマ

**作成日**: 2026-03-16
**Phase**: 3（ゲームデータベース）
**規模**: 中（型定義 + 既存データ移行 + エディタ UI）
**依存**: なし（Phase 2 と並行可能）

---

## 概要

ツクールの「データベース」に相当する機能。キャラクター・敵・スキル・アイテム・ステートをプロジェクト JSON 内で一元管理する。

現状、`packages/battle/src/data/` にハードコードされているデータを、プロジェクト JSON の `data.gameDb` に移行する。

---

## 1. 現状の問題

| 問題 | 詳細 |
|------|------|
| データがハードコード | `skills.ts` に "atk"/"healS" の2つ、`troops.ts` に slime/goblin の2種のみ |
| プレイヤーがハードコード | `WebOpHandler.battleStart()` 内で Hero (hp:100, atk:18, def:6) が固定 |
| プロジェクト固有データが定義不可 | 作者がエディタからキャラ・敵・スキルを定義できない |
| battle パッケージが自己完結 | 外部からのデータ注入の仕組みがない |

---

## 2. gameDb スキーマ

### 配置: `packages/core/src/types/GameDb.ts`

```typescript
// ===== アクター（味方キャラ） =====
export interface ActorDef {
  id: string;               // "actor-hero"
  name: string;             // "勇者"
  characterId?: string;     // 立ち絵の characterId（既存の characters[] を参照）
  stats: BaseStats;
  skills: string[];         // スキル ID の配列
  equipment: {
    weapon?: string;        // アイテム ID
    armor?: string;         // アイテム ID
  };
  level: number;
  growthCurve: GrowthCurve;
}

export interface BaseStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  mat: number;    // 魔法攻撃
  mdf: number;    // 魔法防御
  agi: number;    // 敏捷性
  luk: number;    // 運
}

export interface GrowthCurve {
  hp: number;     // レベルアップ時の上昇量
  mp: number;
  atk: number;
  def: number;
  mat: number;
  mdf: number;
  agi: number;
  luk: number;
}

// ===== 敵キャラ =====
export interface EnemyDef {
  id: string;               // "enemy-goblin"
  name: string;             // "ゴブリン"
  imageId?: string;         // 敵画像アセット ID
  stats: Partial<BaseStats>; // maxMp, mat, mdf, luk は省略可
  exp: number;
  gold: number;
  drops: DropItem[];
  actions: EnemyAction[];
}

export interface DropItem {
  itemId: string;
  chance: number;           // 0.0〜1.0
}

export interface EnemyAction {
  skillId: string;
  rating: number;           // 選択重み
  condition?: {
    hpBelow?: number;       // HP% 以下で使用
    turnMultiple?: number;  // n ターンごとに使用
  };
}

// ===== スキル =====
export interface SkillDef {
  id: string;               // "skill-slash"
  name: string;             // "斬撃"
  type: 'physical' | 'magical' | 'heal' | 'buff' | 'debuff';
  mpCost: number;
  target: 'one-enemy' | 'all-enemies' | 'one-ally' | 'all-allies' | 'self';
  formula: string;          // "a.atk * 4 - b.def * 2" — JS 式
  animation?: string;       // アニメーション ID
  description: string;
}

// ===== アイテム =====
export interface ItemDef {
  id: string;               // "item-herb"
  name: string;             // "薬草"
  type: 'consumable' | 'weapon' | 'armor' | 'key';
  effect?: ItemEffect;
  stats?: Partial<BaseStats>; // 装備時のステータス補正
  price: number;
  description: string;
}

export interface ItemEffect {
  type: 'heal-hp' | 'heal-mp' | 'cure-status' | 'buff';
  value: number;
  statusId?: StatusId;
}

// ===== 敵グループ =====
export interface TroopDef {
  id: string;               // "troop-goblin-x3"
  name: string;             // "ゴブリン×3"
  members: TroopMember[];
  events?: TroopEvent[];
}

export interface TroopMember {
  enemyId: string;
  x?: number;               // バトル画面での位置（フロントビュー用）
  y?: number;
}

export interface TroopEvent {
  condition: TroopEventCondition;
  blocks: Block[];           // シナリオと同じブロック型
}

export type TroopEventCondition =
  | { type: 'turn'; turn: number }
  | { type: 'enemyHpBelow'; index: number; percent: number }
  | { type: 'actorHpBelow'; actorId: string; percent: number };

// ===== ステート =====
export interface StateDef {
  id: StatusId;
  name: string;
  icon?: string;
  duration: number;         // 持続ターン数（0 = 永続）
  effects: StateEffect[];
  removeOnBattleEnd: boolean;
}

export interface StateEffect {
  type: 'damage-per-turn' | 'skip-turn' | 'stat-modifier';
  value?: number;
  stat?: keyof BaseStats;
  modifier?: number;        // 倍率（0.5 = 半減, 1.5 = 1.5倍）
}

// ===== 統合スキーマ =====
export interface GameDb {
  actors: ActorDef[];
  enemies: EnemyDef[];
  troops: TroopDef[];
  skills: SkillDef[];
  items: ItemDef[];
  states: StateDef[];
}

// デフォルト値（ノベルプロジェクトでは空）
export const EMPTY_GAME_DB: GameDb = {
  actors: [],
  enemies: [],
  troops: [],
  skills: [],
  items: [],
  states: [],
};
```

---

## 3. プロジェクト JSON への配置

```json
{
  "data": {
    "pages": [],
    "characters": [],
    "templates": [],
    "gameDb": {
      "actors": [],
      "enemies": [],
      "troops": [],
      "skills": [],
      "items": [],
      "states": []
    }
  }
}
```

**後方互換**: 既存プロジェクトでは `gameDb` が `undefined`。ロード時に `gameDb ?? EMPTY_GAME_DB` でデフォルト補完。

---

## 4. ファイル変更一覧

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `packages/core/src/types/GameDb.ts` | **新規** — 上記スキーマ定義 |
| 2 | `packages/core/src/types/index.ts` | GameDb の re-export |
| 3 | `packages/battle/src/data/skills.ts` | `SkillDef` → GameDb の SkillDef を参照に変更 |
| 4 | `packages/battle/src/data/troops.ts` | `TroopDef` / `EnemyDef` → GameDb の型を参照に変更 |
| 5 | `packages/battle/src/core/types.ts` | `SkillDef` を GameDb から import |
| 6 | `packages/battle/src/core/simulate.ts` | gameDb を引数として受け取るように変更 |
| 7 | `packages/web/src/engine/WebOpHandler.ts` | `battleStart()` で gameDb からアクター・トループを取得 |
| 8 | `packages/core/src/types/SaveData.ts` | v1 → v2 に一括置換（inventory/party/mapState 追加） |
| 9 | `apps/editor/src/types/index.ts` | プロジェクトデータ型に `gameDb` 追加 |
| 10 | `apps/editor/src/components/GameDbEditor/` | **新規** — gameDb 編集 UI |

---

## 5. battle パッケージの移行方針

### Before（現状）

```
packages/battle/src/data/skills.ts    → ハードコードされたスキル定義
packages/battle/src/data/troops.ts    → ハードコードされた敵・トループ定義
packages/battle/src/core/simulate.ts  → data/ を直接 import
WebOpHandler.battleStart()            → Hero をハードコード
```

### After（Phase 3 完了後）

```
packages/core/src/types/GameDb.ts     → 型定義（単一定義源）
packages/battle/src/data/             → デフォルトデータ（サンプル用、開発用）
packages/battle/src/core/simulate.ts  → GameDb を引数として受け取る
WebOpHandler.battleStart()            → project.data.gameDb.actors から読み込み
```

**原則**: `packages/battle/` は純粋な計算ロジック。データは外部（プロジェクト JSON）から注入する。

---

## 6. エディタ UI: GameDb エディタ

エディタのメインナビゲーションに「データベース」タブを追加。

### タブ構成

```
データベース
├── アクター
├── 敵キャラ
├── トループ（敵グループ）
├── スキル
├── アイテム
└── ステート
```

各タブは同じ UI パターン:
- 左: エントリー一覧（追加・削除ボタン付き）
- 右: 選択中エントリーのプロパティエディタ

### 優先度

| UI | 優先度 | 理由 |
|----|:------:|------|
| アクター編集 | 高 | バトルに必須 |
| 敵キャラ編集 | 高 | バトルに必須 |
| トループ編集 | 高 | バトルに必須 |
| スキル編集 | 高 | バトルに必須 |
| アイテム編集 | 中 | インベントリ連携 |
| ステート編集 | 低 | 高度な機能 |

---

## 7. テスト計画

| テスト | 内容 |
|-------|------|
| 型チェック | `npm run typecheck` — GameDb 型 + SaveData v2 が全パッケージで整合 |
| バトル | `npm test -w @kaedevn/battle` — gameDb 注入でのシミュレーション |
| プロジェクトロード | 既存プロジェクト JSON を読み込んで gameDb が空で補完される |
| セーブ/ロード | v2 構造でセーブ → ロード → 全フィールドが復元される |
| API | gameDb を含むプロジェクトの CRUD |
| E2E | データベースタブでアクター作成 → バトルブロックで使用 → プレビュー |
