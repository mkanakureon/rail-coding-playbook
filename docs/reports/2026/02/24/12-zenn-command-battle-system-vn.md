---
title: "コマンドバトルシステムを VN エンジンに組み込んだ設計と実装"
emoji: "⚔"
type: "tech"
topics: ["claudecode", "typescript", "ゲーム開発", "設計"]
published: false
---

## はじめに

ノベルゲームエンジン kaedevn に RPG 風のコマンドバトルシステムを統合した。ノベルゲームとバトルシステムは本来別物だが、「物語を補強するサブシステム」という位置づけで設計することで、両者を自然に連携させることができた。

本記事では仕様書から設計書、UI 設計、実装に至るまでの全工程を記録する。将来の Nintendo Switch（C++）移植を前提とした設計上の制約が、結果的にクリーンなアーキテクチャにつながった。

## 設計方針: 5 つの絶対原則

プロジェクト全体の設計指針として、以下の 5 原則を最初に定めた。

| # | 原則 | 理由 |
|---|------|------|
| 1 | BattleCore は純粋関数 | `result = simulate(scenario, inputs)` -- 副作用なし |
| 2 | RNG は引数渡し | グローバル/static state 禁止 -- C++ 移植で破綻する |
| 3 | UI は IO インタフェースで分離 | ブラウザ(PixiJS) / Switch(NVN) で差替可能 |
| 4 | データ駆動 | スキル・敵・AI すべて JSON 定義 -- コード直書き禁止 |
| 5 | ノベル <-> 戦闘の境界維持 | BATTLE コマンドが唯一の入口/出口 |

特に原則 2 の「RNG は引数渡し」が重要だ。`Math.random()` を直接使うと、テストの再現性が失われるだけでなく、将来 C++ に移植する際にアルゴリズムの一致を保証できなくなる。

```typescript
type Rng = {
  seed: number;
  nextFloat: () => number;   // [0, 1)
  nextInt: (n: number) => number;  // [0, n)
};

function makeRng(seed: number): Rng;
```

RNG は `makeRng(seed)` で毎回生成し、グローバル状態を持たない。同じ seed を渡せば同じ結果が返る。

## パッケージ構成

バトルシステムは独立したパッケージとして設計した。

```
packages/
  battle/
    src/
      core/
        types.ts             型定義（ActorState, BattleState, etc.）
        rng.ts               疑似乱数（xorshift32）
        damage.ts            ダメージ計算（純粋関数）
        applyAction.ts       行動適用（state → newState）
        evaluate.ts          局面評価関数（AI用）
        victory.ts           勝敗判定
        simulate.ts          simulate(scenario, inputs) → result
      ai/
        candidateGen.ts      行動候補生成
        gating.ts            ルールベースゲーティング
        utility.ts           Utility AI スコアリング
        expectimax.ts        Expectimax 先読み
        chooseAction.ts      統合エントリ
      data/
        skills.ts            スキル定義
        enemyProfiles.ts     敵AIプロファイル
        aiTuning.ts          難易度プリセット
      runner/
        battleRunner.ts      戦闘進行管理
        battleIO.ts          UI抽象
```

既存パッケージとの依存関係は一方向だ。

```
packages/core    → battle が参照（共通型）
packages/battle  → interpreter から呼び出される
packages/web     → BattleIO の Web 実装
```

## データモデル

### Actor（味方キャラ）

```typescript
type ActorDef = {
  id: string;
  name: string;
  portraitId?: string;
  stats: { hpMax: number; mpMax: number; atk: number; def: number };
  skills: string[];
};
```

### Skill（スキル）

```typescript
type SkillDef = {
  id: string;
  name: string;
  mpCost: number;
  hitChance: number;      // 0..1
  variance?: number;       // 0..1（ダメージブレ幅）
  kind: "attack" | "heal" | "applyStatus";
  power?: number;
  statusId?: StatusId;
  statusChance?: number;
  statusTurns?: number;
};
```

`variance` フィールドによりダメージに揺らぎを持たせている。これにより同じ攻撃でも毎回微妙に異なるダメージが出て、戦闘に緊張感が生まれる。

### BattleState（戦闘全体状態）

```typescript
type BattleState = {
  turn: number;
  rngSeed: number;
  party: ActorState[];
  enemies: EnemyState[];
};
```

BattleState は immutable として扱う。`applyAction` は新しい state を返し、元の state は変更しない。

## ダメージ計算

ダメージ計算は純粋関数として実装している。

```
raw = max(1, atk - def)
dmg = raw * skill.power * variance_factor
variance_factor = 1 + (rng.nextFloat() * 2 - 1) * skill.variance
dmg = max(1, floor(dmg))
```

TypeScript での実装:

```typescript
function calculateDamage(
  attacker: { atk: number },
  defender: { def: number },
  skill: SkillDef,
  rng: Rng
): number {
  const raw = Math.max(1, attacker.atk - defender.def);
  const varianceFactor = 1 + (rng.nextFloat() * 2 - 1) * (skill.variance ?? 0);
  const dmg = raw * (skill.power ?? 1) * varianceFactor;
  return Math.max(1, Math.floor(dmg));
}
```

`Math.floor()` で整数に丸めるのは、将来の C++ 移植で浮動小数点演算の差異を回避するためだ。

## 行動適用（applyAction）

行動の適用は state をクローンしてから変更する immutable パターンを採用している。

```typescript
function applyAction(state: BattleState, action: Action, rng: Rng): BattleState {
  const newState = deepClone(state);

  // 命中判定
  const hit = rng.nextFloat() <= action.skill.hitChance;
  if (!hit) {
    return newState; // ミス
  }

  // ダメージ/回復/状態付与
  switch (action.skill.kind) {
    case "attack":
      const dmg = calculateDamage(action.source, action.target, action.skill, rng);
      newState.target.hp = Math.max(0, newState.target.hp - dmg);
      break;
    case "heal":
      const heal = Math.floor(action.source.atk * (action.skill.power ?? 0.25));
      newState.target.hp = Math.min(newState.target.hpMax, newState.target.hp + heal);
      break;
    case "applyStatus":
      if (rng.nextFloat() <= (action.skill.statusChance ?? 0)) {
        newState.target.statuses[action.skill.statusId!] = {
          turns: action.skill.statusTurns ?? 3
        };
      }
      break;
  }

  return newState;
}
```

乱数の消費順序は固定されている: 命中 -> ダメージ分散 -> 状態異常。この順序を変えると同一 seed での再現性が崩れるため、厳守する。

## 敵 AI: 3 層パイプライン

敵 AI は 3 層構造で設計した。MVP では Layer 1 のみ実装し、段階的に拡張する。

```
EnemyProfile
    |
    v
[Layer 1] generateCandidates() → gateCandidates()
    |     ルールベース: 条件で候補行動を絞る
    v
[Layer 2] scoreCandidates()
    |     Utility AI: 候補にスコアを付ける
    v
[Layer 3] expectimaxChoose()
          Expectimax: 上位候補を1手先読み
    |
    v
最終決定 (ScoredCandidate)
```

### Layer 1: ルールベースゲーティング（ツクール風）

```typescript
type ActionPattern = {
  skillId: string;
  when: GateCondition[];
  gatePriority: number;    // 0..100
  targetPolicy: "self" | "lowestHp" | "highestAtk" | "random";
};

type GateCondition =
  | { type: "always" }
  | { type: "hpBelow"; ratio: number }
  | { type: "hpAbove"; ratio: number }
  | { type: "mpAtLeast"; value: number }
  | { type: "turnAtLeast"; value: number }
  | { type: "targetHasNotStatus"; status: StatusId };
```

ツクール風の行動パターン定義だ。「HPが30%以下なら回復」「3ターン目以降は強攻撃」といったルールを JSON で記述できる。

### Layer 2: Utility AI

候補行動にスコアを付けて最適な行動を選ぶ。

| 項目 | 意味 | デフォルト重み |
|------|------|--------------|
| EV_damage | 期待ダメージ | 1.0 |
| kill_bonus | 確殺加点 | 25.0 |
| EV_survival | 回復による生存率向上 | 30.0 |
| EV_disable | 状態異常の効果価値 | 12.0 |
| mp_penalty | MPコスト減点 | 0.8 |
| overlap_penalty | 重複状態異常の減点 | 10.0 |

### Layer 3: Expectimax 先読み

上位 N 候補をモンテカルロ法で 1 手先読みする。

```
難易度別パラメータ:
| 項目 | Easy | Normal | Hard |
|------|------|--------|------|
| TOP_N | 3 | 6 | 8 |
| SAMPLES | 3 | 8 | 16 |
| GAMMA | 0.6 | 0.85 | 0.9 |
```

Hard では最大 8 x 16 = 128 シミュレーション/ターンを実行する。ブラウザ上での実行なのでパフォーマンスに注意が必要だが、state のクローンを shallow clone にすることで十分な速度を確保している。

## ノベルエンジンとの連携

### BATTLE コマンド

ノベルスクリプトからバトルを呼び出す唯一のインターフェースが `BATTLE` コマンドだ。

```typescript
{ op: "BATTLE"; troopId: string; onWin: string; onLose: string; difficulty?: Difficulty }
```

インタプリタ側の実装:

```typescript
case "battle": {
  const troopId = String(args[0]);
  const onWin = args[1] !== undefined ? String(args[1]) : undefined;
  const onLose = args[2] !== undefined ? String(args[2]) : undefined;
  const result = await this.engine.battleStart(troopId);
  if (result === "win" && onWin) {
    this.executeJump(onWin);
    return false; // PC制御はjump側で
  } else if (result === "lose" && onLose) {
    this.executeJump(onLose);
    return false;
  }
  return true;
}
```

### 戦闘進行の流れ

```
SceneRunner が BATTLE コマンドに到達
  |
  v
BattleRunner.run() を呼び出し
  |
  v
[ターンループ]
  1. プレイヤーがコマンド選択（attack / skill / item / guard）
  2. applyAction で行動適用
  3. 勝敗判定（敵全滅 → WIN）
  4. 敵AIが行動決定 → applyAction
  5. 状態異常ターン経過
  6. 勝敗判定（味方全滅 → LOSE）
  |
  v
BattleResult を受け取る
  |
  v
outcome === "WIN" → onWin ラベルへジャンプ
outcome === "LOSE" → onLose ラベルへジャンプ
```

### BattleIO（UI 抽象）

UI は `BattleIO` インターフェースで抽象化されている。

```typescript
type BattleIO = {
  show: (text: string) => Promise<void>;
  choose: (title: string, choices: Choice[]) => Promise<number>;
  promptCommand: (state: BattleState, actor: ActorState) => Promise<PlayerCommand>;
};
```

ブラウザ実装は PixiJS のパネル UI、テスト用には readline、将来の Switch は NVN UI フレームワークで実装する。

## トリガー演出

戦闘中に条件を満たすとノベル的なテキストを差し込める「トリガー演出」を Phase 3 で追加した。

```typescript
type TriggerCondition =
  | { type: "turnIs"; value: number }
  | { type: "enemyHpBelow"; ratio: number }
  | { type: "partyAnyHpBelow"; ratio: number }
  | { type: "itemUsedFirst" }
  | { type: "enemyDefeated"; enemyId: string };
```

スクリプトからの指定例:

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

BattleRunner がターンごとに条件をチェックし、成立したらフックでテキストを差し込む。`once: true` を指定すれば 1 回だけ発火する。

## サンプルデータ

動作確認用のサンプルデータも JSON で定義している。

### 敵 5 体

| ID | 名前 | HP | ATK | DEF | 性格 |
|----|------|----|----|-----|------|
| slime | Slime | 35 | 8 | 2 | 殴るだけ |
| goblin | Goblin | 55 | 14 | 4 | 2T目から強攻撃 |
| shaman | Shaman | 60 | 10 | 3 | 回復役+毒 |
| assassin | Assassin | 45 | 16 | 3 | 確殺狙い+毒 |
| slimeBoss | Slime Boss | 120 | 18 | 6 | 回復+毒+強攻撃 |

### スキル 4 種

| ID | MP | 命中 | 種別 | 倍率 |
|----|----|------|------|------|
| atk | 0 | 95% | attack | 1.0 |
| healS | 5 | 100% | heal | 0.25 |
| poison | 4 | 90% | applyStatus | - |
| powerAtk | 6 | 85% | attack | 1.6 |

## テスト: 決定論の検証

バトルシステムの最も重要なテストは「決定論の検証」だ。

```typescript
test('同一seed → 同一結果', () => {
  const result1 = simulate(scenario, inputs, makeRng(42));
  const result2 = simulate(scenario, inputs, makeRng(42));
  expect(result1.outcome).toBe(result2.outcome);
  expect(result1.partyAfter.hp).toBe(result2.partyAfter.hp);
});

test('同一inputs → 同一結果', () => {
  const inputs = [{ type: 'attack', target: 0 }];
  const result1 = simulate(scenario, inputs, makeRng(42));
  const result2 = simulate(scenario, inputs, makeRng(42));
  expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
});

test('inputs変更 → 結果変化', () => {
  const inputs1 = [{ type: 'attack', target: 0 }];
  const inputs2 = [{ type: 'guard' }];
  const result1 = simulate(scenario, inputs1, makeRng(42));
  const result2 = simulate(scenario, inputs2, makeRng(42));
  expect(result1.outcome).not.toBe(result2.outcome);
});
```

## 拡張順序

機能の追加順序は厳守とした。

```
1. 基本戦闘完成（attack/skill/item + 勝敗）
2. 状態異常（poison/paralyze/stun）
3. トリガー演出（戦闘中テキスト差込み）
4. AI拡張（Utility + Expectimax）
5. スキル拡張（複数対象、属性など）
```

順番を変えると設計が破綻する。特に状態異常をトリガー演出より先に実装するのは、トリガー条件に状態異常を含められるようにするためだ。

---

ノベルゲームエンジンにコマンドバトルを組み込むという、一見無茶な要件に対して、純粋関数ベースの BattleCore と IO 抽象による UI 分離で応えた。seed 式 RNG による決定論的な戦闘結果は、テスタビリティだけでなく将来の C++ 移植にも直結する設計判断だった。

　　　　　　　　　　Claude Opus 4.6
