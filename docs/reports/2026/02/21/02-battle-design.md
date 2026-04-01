# コマンドバトルシステム 設計書

> Stage 2/3 - ブラウザ実行を前提としたアーキテクチャ設計

## 0. 実行環境（重要）

```
実行場所: ブラウザ（TypeScript）
サーバー: 不要（使わない）

戦闘ロジック ─→ ブラウザで実行
敵AI         ─→ ブラウザで実行
RNG          ─→ ブラウザで実行
データ       ─→ バンドルに含める or JSON読み込み
```

サーバー検証・サーバーAPI は今回のスコープ外。将来のオンライン対応時に検討する。

## 1. 設計方針

### 1.1 絶対原則

| # | 原則 | 理由 |
|---|------|------|
| 1 | **BattleCore は純粋関数** | `result = simulate(scenario, inputs)` — 副作用なし |
| 2 | **RNG は引数渡し** | グローバル/static state 禁止 — 将来の C++ 移植で破綻する |
| 3 | **UI は IO インタフェースで分離** | ブラウザ(PixiJS) / 将来 Switch(NVN) で差替可能 |
| 4 | **データ駆動** | スキル・敵・AI すべて JSON 定義 — コード直書き禁止 |
| 5 | **ノベル↔戦闘の境界維持** | BATTLE コマンドが唯一の入口/出口 |

### 1.2 将来の Switch 移植対策

```
TypeScript（ブラウザ） ←→ C++（Switch）
  同一 RNG アルゴリズム（splitmix64）
  同一 JSON データ形式
  同一 ダメージ計算式（整数演算）
  テストベクトルで結果一致を CI 検証
```

**浮動小数は避け、将来的には整数（basis points: 10000 = 100%）に移行する。**
MVP では float 許容だが、計算結果は `Math.floor()` で整数に丸める。

## 2. パッケージ構成

```
packages/
  battle/                    ← 新規パッケージ
    src/
      core/
        types.ts             型定義（ActorState, BattleState, etc.）
        rng.ts               疑似乱数（xorshift32 → splitmix64）
        damage.ts            ダメージ計算（純粋関数）
        applyAction.ts       行動適用（state → newState）
        evaluate.ts          局面評価関数（AI用）
        victory.ts           勝敗判定
        simulate.ts          simulate(scenario, inputs) → result
      ai/
        aiTypes.ts           CandidateAction, ScoredCandidate
        candidateGen.ts      行動候補生成
        gating.ts            ルールベースゲーティング
        utility.ts           Utility AI スコアリング
        expectimax.ts        Expectimax 先読み
        chooseAction.ts      統合エントリ: chooseEnemyAction()
      data/
        skills.ts            スキル定義
        enemyProfiles.ts     敵AIプロファイル
        aiTuning.ts          難易度プリセット＋敵別オーバーライド
      runner/
        battleRunner.ts      戦闘進行管理（ロジックを持たない）
        battleIO.ts          UI抽象（BattleIO インタフェース）
      index.ts               公開API
    __tests__/
      rng.test.ts
      damage.test.ts
      simulate.test.ts
      ai.test.ts
    package.json
    tsconfig.json
```

### 既存パッケージとの関係

```
packages/core          → battle が参照する共通型（セーブ構造など）
packages/interpreter   → BATTLE コマンドの実行時に battle を呼び出す
packages/web           → BattleIO の Web 実装（PixiJS）
apps/editor            → 敵データ/スキルデータの編集UI（将来）
```

## 3. モジュール設計

### 3.1 型定義 (core/types.ts)

```typescript
// 状態異常
type StatusId = "poison" | "paralyze" | "stun";

// 行動対象
type Target =
  | { kind: "self" }
  | { kind: "party"; actorId: string }
  | { kind: "enemy"; index: number };

// 味方ランタイム状態
type ActorState = {
  actorId: string;
  hp: number; hpMax: number;
  mp: number; mpMax: number;
  atk: number; def: number;
  statuses: Partial<Record<StatusId, { turns: number }>>;
};

// 敵ランタイム状態
type EnemyState = {
  rid: string;          // ランタイムID（同一敵が複数いる場合の識別）
  enemyId: string;      // 定義ID
  name: string;
  hp: number; hpMax: number;
  mp: number; mpMax: number;
  atk: number; def: number;
  statuses: Partial<Record<StatusId, { turns: number }>>;
};

// 戦闘全体状態
type BattleState = {
  turn: number;
  rngSeed: number;
  party: ActorState[];
  enemies: EnemyState[];
};

// 戦闘結果
type BattleResult = {
  outcome: "WIN" | "LOSE";
  turns: number;
  partyAfter: PartyState;
  log: BattleLogEntry[];
};
```

### 3.2 RNG (core/rng.ts)

```typescript
// MVP: xorshift32（軽量）
// 将来: splitmix64（C++ 互換）
type Rng = {
  seed: number;
  nextFloat: () => number;   // [0, 1)
  nextInt: (n: number) => number;  // [0, n)
};

function makeRng(seed: number): Rng;
```

**重要**: RNG は `makeRng(seed)` で毎回生成。グローバル状態を持たない。

### 3.3 行動適用 (core/applyAction.ts)

```typescript
// 入力: 現在状態 + 行動 + RNG → 新状態（immutable）
function applyAction(state: BattleState, action: Action, rng: Rng): BattleState;
```

- state をクローンしてから変更（元の state は不変）
- 命中判定 → ダメージ/回復/状態付与 → seed 更新

### 3.4 BattleRunner (runner/battleRunner.ts)

**Runner は進行管理だけ。ロジックを持たない。**

```typescript
class BattleRunner {
  async run(store: DataStore, config: BattleConfig, io: BattleIO): Promise<BattleResult> {
    // ループ:
    //   1. 勝敗判定
    //   2. プレイヤー入力（io.promptCommand）
    //   3. applyAction
    //   4. 勝敗判定
    //   5. 敵AI決定（chooseEnemyAction）
    //   6. applyAction
    //   7. ターン経過処理
  }
}
```

### 3.5 BattleIO（UI抽象）

```typescript
type BattleIO = {
  // テキスト表示
  show: (text: string) => Promise<void>;
  // 選択UI
  choose: (title: string, choices: Choice[]) => Promise<number>;
  // コマンド選択（Attack/Skill/Item/Guard）
  promptCommand: (state: BattleState, actor: ActorState) => Promise<PlayerCommand>;
};
```

- **ブラウザ（PixiJS）**: 本番用 — UIパネルで実装
- CLI（readline）: テスト・デバッグ用
- 将来 Switch: NVN UIフレームワークで差替

### 3.6 敵AI パイプライン

```
EnemyProfile
    ↓
generateCandidates()   ← パターンからターゲット付き候補を生成
    ↓
gateCandidates()       ← 条件を満たさない候補を除外（Rule-Based）
    ↓
scoreCandidates()      ← 残った候補にスコア付与（Utility AI）
    ↓
expectimaxChoose()     ← 上位N候補を1手先読み（Expectimax）
    ↓
ScoredCandidate        ← 最終決定
```

#### Utility スコア項目

| 項目 | 意味 | デフォルト重み |
|------|------|--------------|
| EV_damage | 期待ダメージ | 1.0 |
| kill_bonus | 確殺加点 | 25.0 |
| EV_survival | 回復による生存率向上 | 30.0 |
| EV_disable | 状態異常の効果価値 | 12.0 |
| mp_penalty | MPコスト減点 | 0.8 |
| overlap_penalty | 無駄手（重複状態異常など） | 10.0 |

#### Expectimax パラメータ

| パラメータ | 意味 | Normal値 |
|-----------|------|---------|
| TOP_N | 先読みする候補数 | 6 |
| SAMPLES | モンテカルロサンプル数 | 8 |
| GAMMA | 将来価値の割引率 | 0.85 |
| DEPTH | 先読み深さ | 1（固定） |

### 3.7 難易度調整 (data/aiTuning.ts)

```typescript
type AiTuning = {
  utility: UtilityWeights;
  search: SearchParams;
};

// プリセット
const DifficultyPresets: Record<Difficulty, AiTuning>;

// 敵別オーバーライド（差分のみ）
const EnemyOverrides: Record<string, Partial<AiTuning>>;

// マージして最終チューニングを返す
function getAiTuning(difficulty: Difficulty, enemyId: string): AiTuning;
```

## 4. ノベルエンジン連携設計

### 4.1 コマンド追加

既存の Script Command Set に追加:

```typescript
// Core コマンドに追加（Switch対応必須）
| { op: "BATTLE"; troopId: string; onWin: string; onLose: string; difficulty?: Difficulty }
```

### 4.2 SceneRunner での処理

```
SceneRunner が BATTLE コマンドに到達
  ↓
BattleRunner.run() を呼び出し
  ↓
BattleResult を受け取る
  ↓
outcome === "WIN" → onWin ラベルへジャンプ
outcome === "LOSE" → onLose ラベルへジャンプ
  ↓
partyAfter を save.party に反映
```

### 4.3 セーブ構造の拡張

```typescript
// save_schema_version: 2 に上げる
type GameSave = {
  save_schema_version: 2;
  // ... 既存フィールド ...
  party?: PartyState;
  inventory?: Record<string, number>;
};
```

## 5. トリガー演出設計（Phase 3）

### 5.1 概要

戦闘中に条件を満たすとノベル的なテキスト/演出を差し込む。

```typescript
type TriggerRule = {
  id: string;
  once?: boolean;
  when: TriggerCondition;
};

type TriggerCondition =
  | { type: "turnIs"; value: number }
  | { type: "enemyHpBelow"; ratio: number }
  | { type: "partyAnyHpBelow"; ratio: number }
  | { type: "itemUsedFirst" }
  | { type: "enemyDefeated"; enemyId: string };
```

### 5.2 トリガー演出（BATTLE コマンドに定義）

```typescript
{
  op: "BATTLE",
  troopId: "t_boss_1",
  triggerLines: {
    "phase_50": { speaker: "Narrator", text: "敵の動きが変わった。", once: true },
    "party_low": { speaker: "Hero", text: "まずい、立て直す。", once: true }
  }
}
```

### 5.3 BattleRunner 側

```typescript
// BattleRunner のフック
type BattleHooks = {
  onTrigger?: (triggerId: string) => Promise<void>;
};
```

Runner がターンごとに条件チェック → 条件成立で `hooks.onTrigger(id)` を呼ぶ。

## 6. 将来拡張ポイント

### 6.1 安全に追加できるもの（データ追加のみ）

- 新スキル（kind 追加: "buff" / "debuff"）
- 新状態異常（StatusId に追加）
- 新敵・新 Troop
- 新 FXCommand（SE / Shake / Flash）

### 6.2 構造変更が必要なもの

| 機能 | 影響範囲 | 備考 |
|------|---------|------|
| 複数対象（全体攻撃） | SkillDef.targetScope 追加 + applyAction 修正 | 中規模 |
| 属性相性 | SkillDef.element + ActorState.resist 追加 | 中規模 |
| 速度順/CTB | ターン管理の入れ替え | 大規模 — BattleRunner 修正 |
| C++ 移植（Switch） | RNG を splitmix64 統一 + 整数演算化 | 計算式全体 |

### 6.3 拡張の原則

1. **データ駆動**: スキル効果は `kind` + `params` で表現。`if (skillId === "fireball")` は禁止
2. **境界維持**: 戦闘中にシナリオコマンドを直接実行しない
3. **セーブ版数管理**: `save_schema_version` を上げてマイグレーション可能にする

## 7. エラー処理

| ケース | 対応 |
|--------|------|
| 存在しない troopId | Error throw（開発時に検出） |
| 存在しない skillId | フォールバック: 通常攻撃 |
| MP 不足 | 行動失敗（ターンスキップしない: 再選択を促す） |
| 全候補がゲートで落ちた | フォールバック: 通常攻撃 |

## 8. パフォーマンス考慮

| 項目 | 制約 |
|------|------|
| Expectimax 上限 | TOP_N=8, SAMPLES=16 → 最大 128 シミュレーション/ターン |
| state クローン | shallow clone（MVP）→ 構造共有（最適化時） |
| ターン上限 | TURN_LIMIT = 50（無限ループ防止） |
