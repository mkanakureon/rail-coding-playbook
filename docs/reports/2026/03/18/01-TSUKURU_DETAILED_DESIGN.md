# ツクール型エディタ 詳細設計書

> **作成日**: 2026-03-18
> **担当**: Claude Code (Opus 4.6)
> **前提文書**: 01〜03（画面設計 + レビュー 2 本）
> **目的**: 01 の画面設計を「実装可能な粒度」に落とし込む

---

## 0. 既存資産の棚卸し

01〜03 の設計に対し、**すでに実装済みのコード**が多数存在する。新規実装ではなく「接続・拡張・UI シェル構築」が主な作業。

| 既存コンポーネント | パス | 状態 | 設計 01 との対応 |
|---|---|---|---|
| バトルシミュレータ | `packages/battle/src/` | 完成 | 3.3 バトルの処理 |
| GameDb 型定義 | `packages/core/src/types/GameDb.ts` | 完成 | 3.2 データベース |
| マップデータ型 | `packages/map/src/types.ts` | 完成 | 3.1 マップエディタ |
| MapEditor (3パネル) | `apps/editor/src/components/map/` | 完成 | 3.1 マップエディタ |
| MapCanvas (PixiJS) | `apps/editor/src/components/map/MapCanvas.tsx` | 完成 | 3.1 キャンバス |
| TilePalette | `apps/editor/src/components/map/TilePalette.tsx` | 完成 | 3.1 タイルパレット |
| EventInspector | `apps/editor/src/components/map/EventInspector.tsx` | 部分 | 3.4 イベント設定 |
| MapTestPlay | `apps/editor/src/components/map/MapTestPlay.tsx` | 完成 | 3.7 テストプレイ |
| GameDbPanel (6タブ) | `apps/editor/src/components/panels/GameDbPanel.tsx` | 完成 | 3.2 データベース |
| MapService (API) | `apps/editor/src/services/mapService.ts` | 完成 | API 層 |

---

## 1. アーキテクチャ方針

### 1.1 ツクールエディタの配置

**既存のノベルエディタと同じ `apps/editor` 内に、モード切替で共存させる。**

理由:
- 認証・API クライアント・アセット管理を共有できる
- 別アプリにすると Vite config / deploy が増える
- ノベルとツクールは排他（1プロジェクトにつき1モード）

```
apps/editor/
  src/
    pages/
      EditorPage.tsx        ← 既存ノベルエディタ（変更なし）
      TsukuruEditorPage.tsx ← 新規：ツクール型エディタのシェル
    components/
      map/       ← 既存（拡張）
      gamedb/    ← GameDbPanel を移設・拡張
      scenario/  ← 新規：イベントコマンドエディタ
      tsukuru/   ← 新規：ツクール用共通 UI
```

### 1.2 ルーティング

```
/projects/editor/{projectId}          → EditorPage（ノベル）
/projects/tsukuru/{projectId}         → TsukuruEditorPage（ツクール）
```

マイページのプロジェクト作成時に `type: 'novel' | 'tsukuru'` を選択。DB の `projects.type` カラムで分岐。

### 1.3 状態管理

```
apps/editor/src/store/
  useEditorStore.ts       ← 既存（ノベル用、変更なし）
  useTsukuruStore.ts      ← 新規：ツクール用 Zustand store
```

ツクール用ストアは以下を管理:

```typescript
type TsukuruStore = {
  // プロジェクト
  project: TsukuruProject | null;

  // タブ
  activeTab: 'map' | 'scenario' | 'database' | 'layout';

  // マップエディタ
  currentMapSlug: string | null;

  // シナリオエディタ
  currentEventId: string | null;

  // GameDb
  gameDb: GameDb;
  updateGameDb: (updates: Partial<GameDb>) => void;

  // 変数・スイッチ
  variables: VariableDef[];
  switches: SwitchDef[];
};
```

---

## 2. データモデル

### 2.1 プロジェクト拡張

```typescript
// apps/hono: projects テーブルに type カラム追加
// Prisma migration
model Project {
  // ... 既存フィールド
  type  String  @default("novel")  // "novel" | "tsukuru"
}
```

### 2.2 ツクールプロジェクトデータ

```typescript
// packages/core/src/types/TsukuruProject.ts（新規）
export type TsukuruProject = {
  id: string;
  title: string;
  type: 'tsukuru';

  // データベース（既存 GameDb を拡張）
  gameDb: GameDbExtended;

  // 変数・スイッチ
  variables: VariableDef[];   // 0001〜9999
  switches: SwitchDef[];      // 0001〜9999

  // システム設定
  system: SystemConfig;

  // アセット参照
  assets: AssetRef[];

  createdAt: number;
  updatedAt: number;
};

export type VariableDef = {
  id: number;       // 1〜9999
  name: string;     // 表示名（例: "所持金"）
};

export type SwitchDef = {
  id: number;       // 1〜9999
  name: string;     // 表示名（例: "ボス撃破済み"）
};

export type SystemConfig = {
  title: string;
  currency: string;          // 通貨単位（デフォルト "G"）
  initialParty: string[];    // ActorDef ID の配列
  initialMapSlug: string;    // 開始マップ
  initialPosition: { x: number; y: number; direction: string };
  equipSlots: string[];      // ["weapon", "shield", "head", "body", "accessory"]
  titleBgm?: string;
  battleBgm?: string;
  gameoverBgm?: string;
  systemSe: Record<string, string>; // { cursor, ok, cancel, buzzer, ... }
};
```

### 2.3 GameDb 拡張

既存の `GameDb` を拡張し、不足しているタブに対応する型を追加:

```typescript
// packages/core/src/types/GameDb.ts に追記
export type GameDbExtended = GameDb & {
  classes: ClassDef[];        // 職業
  weapons: WeaponDef[];       // 武器（ItemDef から分離）
  armors: ArmorDef[];         // 防具（ItemDef から分離）
  tilesets: TilesetConfig[];  // タイルセット通行判定
  commonEvents: CommonEvent[];// コモンイベント
  system: SystemConfig;       // システム設定
};

export type ClassDef = {
  id: string;
  name: string;
  expCurve: number[];       // 各レベルの必要経験値
  stats: GrowthCurve;       // レベルアップ時のステータス成長
  learnSkills: { level: number; skillId: string }[];
};

export type WeaponDef = {
  id: string;
  name: string;
  description: string;
  price: number;
  equipType: 'weapon';
  attackType: 'physical' | 'magical';
  stats: Partial<BaseStats>;  // 装備時のステータス変化
  animation?: string;         // 攻撃アニメーション ID
};

export type ArmorDef = {
  id: string;
  name: string;
  description: string;
  price: number;
  equipSlot: 'shield' | 'head' | 'body' | 'accessory';
  stats: Partial<BaseStats>;
};

export type TilesetConfig = {
  id: string;
  name: string;
  src: string;                // タイルセット画像パス
  tileWidth: number;
  tileHeight: number;
  columns: number;
  passability: Record<number, TilePassability>;  // tileId → 通行設定
};

export type TilePassability = {
  pass: boolean;              // ○ or ×
  fourDir?: { up: boolean; down: boolean; left: boolean; right: boolean }; // 四方向
  star?: boolean;             // ☆（通行可・上に表示）
  counter?: boolean;          // カウンター判定
  bush?: boolean;             // 茂み判定
  ladder?: boolean;           // 梯子判定
  damage?: number;            // ダメージ床
};

export type CommonEvent = {
  id: string;
  name: string;
  trigger: 'none' | 'auto' | 'parallel';  // なし、自動実行、並列処理
  conditionSwitch?: number;   // 実行条件スイッチ ID
  commands: EventCommand[];   // コマンド列
};
```

### 2.4 イベントコマンド型

```typescript
// packages/core/src/types/EventCommand.ts（新規）

/** ツクール互換のイベントコマンド */
export type EventCommand =
  // メッセージ系
  | { type: 'show_text'; speaker?: string; body: string; faceId?: string; position?: 'top' | 'middle' | 'bottom' }
  | { type: 'show_choices'; choices: { text: string; commands: EventCommand[] }[]; cancelType?: number }
  | { type: 'show_scrolling_text'; text: string; speed?: number }
  | { type: 'input_number'; varId: number; digits: number }

  // ゲーム進行
  | { type: 'control_switches'; id: number; value: boolean }
  | { type: 'control_variables'; id: number; op: '=' | '+=' | '-=' | '*=' | '/=' | '%='; value: number | string }
  | { type: 'control_self_switch'; key: 'A' | 'B' | 'C' | 'D'; value: boolean }
  | { type: 'conditional_branch'; condition: BranchCondition; thenCommands: EventCommand[]; elseCommands?: EventCommand[] }
  | { type: 'loop'; commands: EventCommand[] }
  | { type: 'break_loop' }
  | { type: 'label'; name: string }
  | { type: 'jump_to_label'; name: string }
  | { type: 'common_event'; id: string }
  | { type: 'comment'; text: string }

  // パーティ・アクター
  | { type: 'change_gold'; op: '+' | '-'; value: number | { varId: number } }
  | { type: 'change_items'; itemId: string; op: '+' | '-'; count: number }
  | { type: 'change_weapons'; weaponId: string; op: '+' | '-'; count: number }
  | { type: 'change_armors'; armorId: string; op: '+' | '-'; count: number }
  | { type: 'change_party_member'; actorId: string; op: 'add' | 'remove' }
  | { type: 'recover_all'; actorId?: string }   // 省略時は全員
  | { type: 'change_exp'; actorId: string; op: '+' | '-'; value: number }
  | { type: 'change_level'; actorId: string; op: '+' | '-'; value: number }
  | { type: 'change_equipment'; actorId: string; slot: string; itemId: string }

  // フロー制御・移動
  | { type: 'transfer_player'; mapSlug: string; x: number; y: number; direction?: string; fadeType?: 'black' | 'white' | 'none' }
  | { type: 'set_move_route'; target: 'player' | string; route: MoveCommand[]; wait?: boolean; repeat?: boolean; skip?: boolean }
  | { type: 'set_event_location'; eventId: string; x: number; y: number; direction?: string }

  // オーディオ・画面
  | { type: 'play_bgm'; name: string; volume?: number; pitch?: number }
  | { type: 'stop_bgm'; fadeout?: number }
  | { type: 'play_se'; name: string; volume?: number; pitch?: number }
  | { type: 'fadeout_screen' }
  | { type: 'fadein_screen' }
  | { type: 'shake_screen'; power: number; speed: number; duration: number }
  | { type: 'flash_screen'; color: string; duration: number }
  | { type: 'tint_screen'; color: string; duration: number }
  | { type: 'show_picture'; id: number; name: string; x: number; y: number }
  | { type: 'erase_picture'; id: number }
  | { type: 'set_weather'; type: string; power: number; duration: number }

  // システム・バトル
  | { type: 'battle_processing'; troopId: string; canEscape?: boolean; canLose?: boolean; winCommands?: EventCommand[]; loseCommands?: EventCommand[] }
  | { type: 'shop_processing'; goods: ShopGood[] }
  | { type: 'open_save_screen' }
  | { type: 'open_menu_screen' }
  | { type: 'game_over' }
  | { type: 'return_to_title' }

  // 待機
  | { type: 'wait'; frames: number };

export type MoveCommand =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'move_forward' }
  | { type: 'move_random' }
  | { type: 'move_toward_player' }
  | { type: 'move_away_from_player' }
  | { type: 'jump'; xPlus: number; yPlus: number }
  | { type: 'turn'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'wait'; frames: number }
  | { type: 'set_speed'; speed: number }
  | { type: 'set_through'; through: boolean }
  | { type: 'set_opacity'; opacity: number }
  | { type: 'play_se'; name: string }
  | { type: 'script'; code: string };

export type BranchCondition =
  | { type: 'switch'; id: number; value: boolean }
  | { type: 'variable'; id: number; op: '>=' | '<=' | '==' | '!=' | '>' | '<'; value: number | { varId: number } }
  | { type: 'self_switch'; key: 'A' | 'B' | 'C' | 'D'; value: boolean }
  | { type: 'actor'; actorId: string; check: 'in_party' | 'has_skill' | 'has_weapon' | 'has_armor'; refId?: string }
  | { type: 'gold'; op: '>=' | '<=' | '<'; value: number }
  | { type: 'item'; itemId: string };

export type ShopGood = {
  type: 'item' | 'weapon' | 'armor';
  id: string;
  priceOverride?: number;  // null = データベース価格
};
```

### 2.5 MapEvent 拡張（セルフスイッチ対応）

既存の `packages/map/src/types.ts` の `MapEvent` を拡張:

```typescript
// MapEvent.pages の EventPage 型に追加
export type EventPage = {
  // 出現条件
  conditions: {
    switch1?: number;       // グローバルスイッチ ID
    switch2?: number;       // グローバルスイッチ ID（2つ目）
    selfSwitch?: 'A' | 'B' | 'C' | 'D';
    variable?: { id: number; value: number };
    item?: string;          // アイテム ID（所持判定）
    actor?: string;         // アクター ID（パーティ所属判定）
  };

  // 画像
  sprite?: EventSprite;

  // オプション
  walkAnime: boolean;       // 歩行アニメ
  stepAnime: boolean;       // 足踏みアニメ
  directionFix: boolean;    // 向き固定
  through: boolean;         // すり抜け
  aboveCharacters: boolean; // 最前面に表示

  // 自律移動
  moveRoute: {
    type: 'fixed' | 'random' | 'approach' | 'custom';
    speed: number;          // 1〜6
    frequency: number;      // 1〜5
    customRoute?: MoveCommand[];
  };

  // トリガー
  trigger: 'action' | 'player_touch' | 'event_touch' | 'auto' | 'parallel';

  // 優先度
  priority: 'below' | 'same' | 'above';

  // 実行内容
  commands: EventCommand[];
};
```

---

## 3. 画面設計（コンポーネント階層）

### 3.1 TsukuruEditorPage（メインシェル）

```
TsukuruEditorPage
├── TsukuruTabBar          ← マップ | シナリオ | DB | レイアウト
├── TsukuruToolbar         ← 保存・テストプレイ・プロジェクト設定
│
├── [tab=map]
│   └── MapEditorView      ← 既存（拡張: マップ一覧からの遷移）
│       └── MapEditor      ← 既存
│           ├── TilePalette     ← 既存
│           ├── MapCanvas       ← 既存
│           └── EventInspector  ← 既存（拡張: セルフスイッチ・ページ）
│
├── [tab=scenario]
│   └── ScenarioEditor     ← 新規
│       ├── CommandPalette       ← 新規: カテゴリ別コマンド一覧
│       ├── CommandListView      ← 新規: 実行内容リスト
│       └── CommandEditDialog    ← 新規: コマンド編集ダイアログ
│
├── [tab=database]
│   └── GameDbEditor       ← GameDbPanel を拡張
│       ├── DbTabBar            ← タブ: アクター/職業/スキル/アイテム/武器/防具/敵/トループ/ステート/アニメ/タイルセット/コモンイベント/システム
│       ├── DbListPanel         ← 左: データ一覧
│       └── DbDetailPanel       ← 右: プロパティ編集
│
├── [tab=layout]
│   └── LayoutEditor       ← 既存（流用可能）
│
└── [ダイアログ]
    ├── MapEventDialog     ← 新規: イベント編集（ページ付き）
    ├── ResourceManager    ← 新規: 素材管理
    ├── VarSwitchManager   ← 新規: 変数・スイッチ管理
    └── TilesetPassEditor  ← 新規: タイルセット通行判定
```

### 3.2 シナリオエディタ — コマンドパレットのカテゴリ

```typescript
const COMMAND_CATEGORIES = [
  {
    id: 'message',
    label: 'メッセージ',
    commands: ['show_text', 'show_choices', 'show_scrolling_text', 'input_number'],
  },
  {
    id: 'game_progress',
    label: 'ゲーム進行',
    commands: ['control_switches', 'control_variables', 'control_self_switch',
               'conditional_branch', 'loop', 'break_loop', 'label', 'jump_to_label',
               'common_event', 'comment'],
  },
  {
    id: 'party',
    label: 'パーティ',
    commands: ['change_gold', 'change_items', 'change_weapons', 'change_armors',
               'change_party_member', 'recover_all', 'change_exp', 'change_level',
               'change_equipment'],
  },
  {
    id: 'flow_movement',
    label: '移動',
    commands: ['transfer_player', 'set_move_route', 'set_event_location'],
  },
  {
    id: 'audio_screen',
    label: '画面・音声',
    commands: ['play_bgm', 'stop_bgm', 'play_se', 'fadeout_screen', 'fadein_screen',
               'shake_screen', 'flash_screen', 'tint_screen', 'show_picture',
               'erase_picture', 'set_weather'],
  },
  {
    id: 'system_battle',
    label: 'システム',
    commands: ['battle_processing', 'shop_processing', 'open_save_screen',
               'open_menu_screen', 'game_over', 'return_to_title', 'wait'],
  },
];
```

---

## 4. API エンドポイント

### 4.1 既存（変更なし）

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/projects/{id}/maps` | マップ一覧 |
| GET | `/api/projects/{id}/maps/{slug}` | マップ詳細 |
| POST | `/api/projects/{id}/maps` | マップ保存 |
| DELETE | `/api/projects/{id}/maps/{slug}` | マップ削除 |

### 4.2 新規

| Method | Path | 用途 |
|--------|------|------|
| GET | `/api/projects/{id}/gamedb` | GameDb 取得 |
| PUT | `/api/projects/{id}/gamedb` | GameDb 保存 |
| GET | `/api/projects/{id}/variables` | 変数・スイッチ一覧 |
| PUT | `/api/projects/{id}/variables` | 変数・スイッチ保存 |
| GET | `/api/projects/{id}/system` | システム設定取得 |
| PUT | `/api/projects/{id}/system` | システム設定保存 |

GameDb は JSON カラムでプロジェクトに紐付ける（正規化しない）。ツクールのデータベースは作品ごとに完結するため。

### 4.3 DB スキーマ変更

```prisma
model Project {
  // 既存
  id        String   @id @default(cuid())
  title     String
  // ...

  // 追加
  type      String   @default("novel")  // "novel" | "tsukuru"
  gameDb    Json?                         // GameDbExtended
  variables Json?                         // VariableDef[]
  switches  Json?                         // SwitchDef[]
  system    Json?                         // SystemConfig
}
```

---

## 5. フェーズ分け

### Phase 1: シェル + 既存コンポーネント接続（1〜2 週間）

**ゴール**: マップタブ・DB タブで既存 UI が動く状態

1. `TsukuruEditorPage.tsx` 作成（タブ切替シェル）
2. `useTsukuruStore.ts` 作成
3. ルーティング追加（`/projects/tsukuru/{projectId}`）
4. 既存 `MapEditorView` + `MapEditor` をマップタブに接続
5. 既存 `GameDbPanel` を DB タブに接続
6. `projects.type` カラム追加 + マイページでモード選択 UI
7. API: `GET/PUT /api/projects/{id}/gamedb`

**成果物**: マップが描けて、DB が編集できるツクール型エディタの骨格

### Phase 2: データベース拡張（1〜2 週間）

**ゴール**: ツクールの全 DB タブが揃う

1. GameDb に `classes`, `weapons`, `armors`, `tilesets`, `commonEvents`, `system` を追加
2. 各タブの編集 UI を 2 ペインレイアウトで実装
3. タイルセット通行判定エディタ（タイル画像上でクリック → ○/×/☆ 切替）
4. 変数・スイッチ管理ダイアログ

### Phase 3: イベントコマンドシステム（2〜3 週間）

**ゴール**: イベント内容をコマンドで構築できる

1. `EventCommand` 型定義
2. `ScenarioEditor` コンポーネント（コマンドパレット + リスト）
3. 各コマンドの編集ダイアログ（最低限: show_text, show_choices, control_switches, control_variables, conditional_branch, transfer_player, battle_processing）
4. `MapEventDialog` 拡張（ページ切替 + セルフスイッチ条件 + 実行内容）
5. コマンドのコピー・ペースト・並べ替え

### Phase 4: ランタイム統合（2〜3 週間）

**ゴール**: テストプレイでゲームが動く

1. イベントコマンドインタプリタ（`packages/core/src/runtime/EventInterpreter.ts`）
2. マップ間移動（`transfer_player` の実装）
3. ランダムエンカウント → `packages/battle` 呼び出し
4. ショップ画面 UI
5. セーブ/ロード（既存 IStorage 抽象を活用）
6. テストプレイ内デバッガ（変数・スイッチモニター、F9 呼出）

### Phase 5: 仕上げ（1 週間）

1. 素材管理ダイアログ
2. ショートカット（右クリックスポイト、Ctrl+C/V）
3. ツクール風ダークテーマ
4. Azure デプロイ（SWA config にツクールルート追加）

---

## 6. 未解決事項・要確認

| # | 項目 | 判断が必要な理由 |
|---|---|---|
| 1 | オートタイルのアルゴリズム | ツクール互換の 47 パターン or 簡易版か？ |
| 2 | タイルセット画像のフォーマット | ツクール MV/MZ 規格準拠か独自か？既存アセットとの互換性 |
| 3 | サイドビュー戦闘 vs フロントビュー | `packages/battle` は抽象的だが、UI 表示形式を決める必要がある |
| 4 | プラグインシステム | ツクールの最大の強みだが、スコープ外とするか？ |
| 5 | マップの最大サイズ | パフォーマンス制約。PixiJS + 大マップの描画限界 |
| 6 | 並列処理の実装方式 | `setInterval` / `requestAnimationFrame` / Web Worker？ |
| 7 | ダメージ計算式の JavaScript 評価 | セキュリティ（sandbox 必要）vs 利便性 |

---

## 7. まとめ

01〜03 の設計は画面レベルでは十分。実装に必要な**データモデル・コンポーネント構成・API・フェーズ分け**を本書で補完した。

既存コードの充実度が高く、Phase 1 は「接続」が主作業。最大の開発ボリュームは Phase 3（イベントコマンドシステム）と Phase 4（ランタイム統合）。

全 Phase で約 **7〜11 週間**の見積もり（1人作業前提）。Phase 1 完了時点でデモ可能な状態になる。
