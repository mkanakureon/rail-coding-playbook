# コマンドバトルシステム 仕様書

> Stage 1/3 - 入力文書（コマンドバトル.md / アドバイス.md）を整理・雑音除去した要件定義

## 1. 目的

kaedevn ノベルゲームエンジンに **ツクール風コマンドバトル** を追加する。
戦闘は物語を補強するサブシステムであり、複雑さより **演出との連携** を重視する。

## 2. 前提条件

| 項目 | 内容 |
|------|------|
| 実行環境 | **ブラウザ（TypeScript）** — サーバー不要 |
| ターゲット | Web（ブラウザ）で動作 → 将来 Switch（C++）移植 |
| 言語 | TypeScript — ブラウザ上で戦闘ロジック・敵AI をすべて実行 |
| 既存エンジン | ノベルエンジン（ScriptRunner / Timeline / Save 済み） |
| 戦闘の位置づけ | ノベル進行中にイベントとして呼び出す（BATTLE コマンド） |

> **注意**: サーバーは使わない。戦闘ロジック・敵AI・RNG すべてブラウザ内で完結する。
> サーバー検証（改ざん防止API等）は将来のオンライン対応時にのみ検討する。

## 3. MVP機能セット（初期実装スコープ）

**これだけ作る。これ以外は作らない。**

| # | 機能 | 内容 |
|---|------|------|
| 1 | プレイヤー入力 | attack / skill / item / guard |
| 2 | 敵AI | 1関数 `decide(state)` で行動決定 |
| 3 | 勝敗判定 | 敵全滅 → WIN / 味方全滅 → LOSE |
| 4 | 入力ログ | `BattleInputFrame[]` — 決定論再現の基礎 |
| 5 | RNG | seed式疑似乱数（xorshift32 → 将来 splitmix64） |

### MVPで作らないもの

- 装備（武器/防具）、パラメータ成長、レベルアップ
- 属性相性（火/水など）
- 速度順/CTB/行動順操作
- スキルツリー、ジョブ
- エンカウント（ランダム戦闘）
- マップシステム

## 4. データ定義

### 4.1 Actor（味方キャラ）

```typescript
type ActorDef = {
  id: string;
  name: string;
  portraitId?: string;
  stats: { hpMax: number; mpMax: number; atk: number; def: number };
  skills: string[];
};
```

### 4.2 Enemy（敵）

```typescript
type EnemyDef = {
  id: string;
  name: string;
  spriteId?: string;
  stats: { hpMax: number; mpMax: number; atk: number; def: number };
  skills: string[];
  aiProfileId: string;
};
```

### 4.3 Skill（スキル）

```typescript
type SkillDef = {
  id: string;
  name: string;
  mpCost: number;
  hitChance: number;      // 0..1
  variance?: number;       // 0..1（±ブレ幅）
  kind: "attack" | "heal" | "applyStatus";
  power?: number;          // 攻撃/回復倍率
  statusId?: StatusId;
  statusChance?: number;   // 0..1
  statusTurns?: number;
};
```

### 4.4 Item（アイテム）

MVP は回復系のみ。

```typescript
type ItemDef = {
  id: string;
  name: string;
  kind: "healHp" | "healMp" | "cureStatus";
  power: number;
  target: "self" | "ally";
  statusId?: StatusId;
};
```

### 4.5 Troop（敵グループ）

```typescript
type TroopDef = {
  id: string;
  enemies: Array<{ enemyId: string; count: number }>;
  bgId?: string;
  musicId?: string;
};
```

### 4.6 EnemyProfile（ツクール風行動パターン）

```typescript
type GateCondition =
  | { type: "always" }
  | { type: "hpBelow"; ratio: number }
  | { type: "hpAbove"; ratio: number }
  | { type: "mpAtLeast"; value: number }
  | { type: "turnAtLeast"; value: number }
  | { type: "targetHasNotStatus"; status: StatusId };

type ActionPattern = {
  skillId: string;
  when: GateCondition[];
  gatePriority: number;  // 0..100
  targetPolicy: "self" | "lowestHp" | "highestAtk" | "random";
};

type EnemyProfile = {
  id: string;
  patterns: ActionPattern[];
};
```

### 4.7 StatusId（状態異常 — MVP）

```typescript
type StatusId = "poison" | "paralyze" | "stun";
```

## 5. 戦闘フロー

### 5.1 ターン進行（MVP: 味方→敵の固定順）

```
1. プレイヤーがコマンド選択（attack / skill / item / guard）
2. プレイヤー行動を applyAction で適用
3. 勝敗判定（敵全滅 → WIN）
4. 敵AIがコマンド決定 → applyAction で適用
5. 状態異常ターン経過（毒ダメ、スタン解除など）
6. 勝敗判定（味方全滅 → LOSE）
7. ターン +1 → 1に戻る
```

### 5.2 ダメージ計算

```
raw = max(1, atk - def)
dmg = raw * skill.power * variance_factor
variance_factor = 1 + (rng.nextFloat() * 2 - 1) * skill.variance
dmg = max(1, floor(dmg))
```

### 5.3 命中判定

```
hit = rng.nextFloat() <= skill.hitChance
```

## 6. 敵AI方式（3層構造）

| レイヤ | 名称 | 役割 |
|--------|------|------|
| 1 | Rule-Based Action Gating | 条件で候補行動を絞る（ツクール風） |
| 2 | Utility AI Scoring | 候補にスコアを付けて最適を選ぶ |
| 3 | Depth-Limited Expectimax | 上位候補を1手先読みして最終決定 |

### 初期実装のAI

最初は **レイヤ1（ルールベース）のみ** で十分。

```
if player.hp < 30% → 強攻撃
else → 通常攻撃
```

レイヤ2-3 は基本戦闘完成後に段階的に追加。

## 7. ノベルエンジンとの連携

### 7.1 BATTLE コマンド

```typescript
{ op: "BATTLE"; troopId: string; onWin: string; onLose: string; difficulty?: Difficulty }
```

- ノベル進行中に BATTLE コマンドに到達 → 戦闘UIに遷移
- 戦闘終了 → outcome に応じて onWin / onLose ラベルへジャンプ

### 7.2 戦闘結果

```typescript
type BattleResult = {
  outcome: "WIN" | "LOSE";
  partyAfter: PartyState;
  log: BattleLogEntry[];
};
```

### 7.3 セーブデータ拡張

既存 `save_schema_version: 1` の `vars` に以下を追加保存:
- `party`: PartyState（HP/MP/status）
- `inventory`: Record<string, number>

## 8. 難易度調整

3段階のプリセット。SearchParams と UtilityWeights を難易度で切替。

| 項目 | Easy | Normal | Hard |
|------|------|--------|------|
| TOP_N（先読み候補数） | 3 | 6 | 8 |
| SAMPLES（期待値サンプル） | 3 | 8 | 16 |
| GAMMA（将来価値比重） | 0.6 | 0.85 | 0.9 |
| killBonus | 12 | 25 | 32 |

## 9. 決定論要件

| ルール | 内容 |
|--------|------|
| 同一入力→同一出力 | seed + inputs が同じなら結果が完全一致 |
| RNG | seed式疑似乱数（Math.random() 禁止） |
| 乱数消費順序 | 固定（命中→ダメージ分散→状態異常の順） |
| 目的 | Switch移植時の再現性 / リプレイ / デバッグ |

## 10. 拡張順序（厳守）

```
1. 基本戦闘完成（attack/skill/item + 勝敗）
2. 状態異常（poison/paralyze/stun）
3. トリガー演出（戦闘中テキスト差込み）
4. AI拡張（Utility + Expectimax）
5. スキル拡張（複数対象、属性など）
```

**順番を変えると設計破綻する。**

## 11. テスト要件（必須）

最低限この3つを最初に作る:

1. **seed同一 → 結果同一**: 同じ seed で2回実行し outcome/HP が一致
2. **同inputs → 同結果**: 同じ入力列で結果が一致
3. **1入力変更 → 結果変化**: 入力を変えると結果が変わることを確認

## 12. サンプルデータ（MVP動作確認用）

### 敵5体

| ID | 名前 | HP | MP | ATK | DEF | 性格 |
|----|------|----|----|-----|-----|------|
| slime | Slime | 35 | 0 | 8 | 2 | 殴るだけ |
| goblin | Goblin | 55 | 6 | 14 | 4 | 2T目から強攻撃 |
| shaman | Shaman | 60 | 14 | 10 | 3 | 回復役＋毒 |
| assassin | Assassin | 45 | 10 | 16 | 3 | 確殺狙い＋毒 |
| slimeBoss | Slime Boss | 120 | 12 | 18 | 6 | 回復＋毒＋強攻撃 |

### スキル4種

| ID | 名前 | MP | 命中 | 種別 | 倍率 |
|----|------|----|------|------|------|
| atk | Attack | 0 | 95% | attack | 1.0 |
| healS | Heal | 5 | 100% | heal | 0.25 |
| poison | Poison | 4 | 90% | applyStatus | - |
| powerAtk | Power Attack | 6 | 85% | attack | 1.6 |

### アイテム2種

| ID | 名前 | 効果 |
|----|------|------|
| potion | Potion | HP +30 |
| antidote | Antidote | 毒解除 |
