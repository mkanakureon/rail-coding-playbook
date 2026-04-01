# Phase 4 実装設計: バトルランタイム拡張

**作成日**: 2026-03-16
**Phase**: 4（バトル）
**規模**: 大（ランタイム拡張 + UI 刷新 + gameDb 連携）
**依存**: Phase 3（gameDb）

---

## 概要

現在の `packages/battle/` は**コアロジックが完成**している。Phase 4 では gameDb 連携、UI 改善、高度な戦闘機能を追加し、ツクール相当のバトルシステムに仕上げる。

---

## 1. 現状の評価（03/15 コードレビューより）

| コンポーネント | 完了度 | 詳細 |
|--------------|:------:|------|
| シミュレーション (simulate.ts) | 100% | 決定論的、50ターン制限、テスト済み |
| ダメージ計算 (damage.ts) | 100% | variance 付き、テスト済み |
| 勝敗判定 (victory.ts) | 100% | 全滅チェック |
| RNG (rng.ts) | 100% | xorshift32、シード固定可能 |
| 行動適用 (applyAction.ts) | 90% | ステータス効果の適用が未実装 |
| 敵 AI (simpleAi.ts) | 30% | ランダム攻撃のみ。スキル選択・条件分岐なし |
| バトル UI | 50% | DOM オーバレイ。Attack/Heal の2ボタンのみ |
| onWin/onLose ジャンプ | 0% | ラベルを受け取るが使用していない |
| gameDb 連携 | 0% | アクター・スキル・敵がハードコード |

---

## 2. 改修項目

### 2-1. onWin/onLose ラベルジャンプの実装

**対象**: `packages/core/src/engine/OpRunner.ts`

```typescript
case "BATTLE_START": {
  if (h.battleStart) {
    const outcome = await h.battleStart(op.troopId, op.onWin, op.onLose, op.seed);
    this.vars["battle_result"] = outcome === "WIN" ? 1 : 0;
    // ラベルジャンプの追加
    const targetLabel = outcome === "WIN" ? op.onWin : op.onLose;
    if (targetLabel) {
      const targetPc = this.labelMap.get(targetLabel);
      if (targetPc !== undefined) {
        this.pc = targetPc;
        break;
      }
    }
  }
  this.pc++;
  break;
}
```

### 2-2. gameDb からのデータ読み込み

**対象**: `packages/web/src/engine/WebOpHandler.ts` の `battleStart()`

```typescript
async battleStart(troopId: string, onWin: string, onLose: string, seed?: number): Promise<string> {
  const gameDb = this.project.data.gameDb ?? EMPTY_GAME_DB;

  // トループ取得（gameDb → フォールバックで battle パッケージのデフォルト）
  const troop = gameDb.troops.find(t => t.id === troopId)
    ?? defaultTroops.find(t => t.id === troopId);

  // パーティ構成（gameDb.actors の先頭N人、またはデフォルト）
  const party = gameDb.actors.length > 0
    ? gameDb.actors.slice(0, 4)  // 最大4人
    : [DEFAULT_HERO];

  // スキル取得関数
  const getSkill = (id: string) =>
    gameDb.skills.find(s => s.id === id) ?? defaultSkills.find(s => s.id === id);

  // ... バトル開始
}
```

### 2-3. 敵 AI の拡張

**対象**: `packages/battle/src/ai/simpleAi.ts` → `smartAi.ts` に拡張

```typescript
export function smartAi(
  enemy: EnemyState,
  enemyDef: EnemyDef,
  state: BattleState,
  rng: Rng
): Action {
  // 1. 使用可能なアクションをフィルタ（条件チェック）
  const available = enemyDef.actions.filter(a => {
    if (a.condition?.hpBelow) {
      return enemy.hp / enemy.maxHp <= a.condition.hpBelow;
    }
    if (a.condition?.turnMultiple) {
      return state.turn % a.condition.turnMultiple === 0;
    }
    return true;
  });

  // 2. rating ベースの重み付き抽選
  const totalRating = available.reduce((sum, a) => sum + a.rating, 0);
  let roll = rng.nextFloat() * totalRating;
  let selected = available[0];
  for (const a of available) {
    roll -= a.rating;
    if (roll <= 0) { selected = a; break; }
  }

  // 3. ターゲット選択
  const skill = getSkill(selected.skillId);
  const target = selectTarget(skill.target, state, rng);

  return { skillId: selected.skillId, targetRid: target.rid };
}
```

### 2-4. ステータス効果の実装

**対象**: `packages/battle/src/core/applyAction.ts` + 新規 `statusEffects.ts`

```typescript
// statusEffects.ts
export function applyTurnEndEffects(
  state: BattleState,
  stateDefs: StateDef[]
): { state: BattleState; log: LogEntry[] } {
  const log: LogEntry[] = [];

  for (const actor of [...state.party, ...state.enemies]) {
    for (const status of actor.statuses) {
      const def = stateDefs.find(s => s.id === status.id);
      if (!def) continue;

      for (const effect of def.effects) {
        switch (effect.type) {
          case 'damage-per-turn':
            actor.hp = Math.max(0, actor.hp - effect.value!);
            log.push({ text: `${actor.name}は毒のダメージを受けた！` });
            break;
          case 'skip-turn':
            actor.skipNextTurn = true;
            log.push({ text: `${actor.name}は動けない！` });
            break;
          case 'stat-modifier':
            // 一時的なステータス補正（バトル中のみ）
            break;
        }
      }

      // 持続ターン減少
      status.remainingTurns--;
      if (status.remainingTurns <= 0) {
        actor.statuses = actor.statuses.filter(s => s !== status);
        log.push({ text: `${actor.name}の${def.name}が治った！` });
      }
    }
  }

  return { state, log };
}
```

### 2-5. バトル UI の PixiJS 移行

**現状**: DOM オーバレイ（`document.createElement` で構築）
**目標**: PixiJS ベースの UI（PlayLayout との統一）

```
┌──────────────────────────────────────┐
│ [バトル背景]                          │
│                                      │
│    🐉 🐉 🐉  ← 敵スプライト          │
│    HP バー（各敵の上部）               │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ステータスウィンドウ               │ │
│ │ 勇者  HP ████████ 100/100       │ │
│ │       MP ████     30/30         │ │
│ └──────────────────────────────────┘ │
│ ┌──────────┐  ┌──────────────────┐  │
│ │ コマンド   │  │ バトルログ        │  │
│ │ > たたかう │  │ ゴブリンに15の... │  │
│ │   スキル   │  │ 勇者の攻撃！     │  │
│ │   アイテム │  │                  │  │
│ │   防御     │  │                  │  │
│ │   逃げる   │  │                  │  │
│ └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
```

**UI コンポーネント:**

| コンポーネント | 役割 |
|--------------|------|
| `BattleScene` | バトル画面の Container（背景 + 敵 + UI） |
| `EnemySprites` | 敵のスプライト表示 + HP バー |
| `StatusWindow` | パーティの HP/MP 表示 |
| `CommandWindow` | コマンド選択（5項目） |
| `SkillWindow` | スキル一覧（サブメニュー） |
| `ItemWindow` | アイテム一覧（サブメニュー） |
| `TargetSelector` | ターゲット選択カーソル |
| `BattleLog` | テキストログ表示 |
| `DamagePopup` | ダメージ数値のポップアップ |

### 2-6. formula 評価の安全化

**現状**: `new Function('a', 'b', 'return ' + formula)`
**問題**: 任意コード実行のリスク

```typescript
// 安全な formula 評価器
function evalFormula(formula: string, a: BaseStats, b: BaseStats): number {
  // 許可する識別子: a.xxx, b.xxx, Math.xxx, 数値, 演算子
  const sanitized = formula.replace(/[^a-zA-Z0-9_.+\-*/%() ]/g, '');
  const fn = new Function('a', 'b', 'Math', `"use strict"; return (${sanitized})`);
  const result = fn(a, b, Math);
  return Math.max(0, Math.floor(result));
}
```

---

## 3. セーブデータ連携

セーブスキーマは Phase 3 で v2 に一括置換済み。`party` フィールドは v2 に最初から含まれている。
Phase 4 ではバトル終了後に `saveData.party.states` を更新するロジックを実装する。詳細は `05-save-schema-v2-design.md` を参照。

---

## 4. ファイル変更一覧

| # | ファイル | 変更内容 | 規模 |
|---|---------|---------|:----:|
| 1 | `OpRunner.ts` | onWin/onLose ラベルジャンプ | 小 |
| 2 | `WebOpHandler.ts` | gameDb 連携、PixiJS バトル UI | 大 |
| 3 | `simpleAi.ts` → `smartAi.ts` | 条件付きスキル選択 + rating 抽選 | 中 |
| 4 | `applyAction.ts` | ステータス効果の適用 | 中 |
| 5 | **新規** `statusEffects.ts` | ターン終了時のステータス処理 | 中 |
| 6 | **新規** `BattleScene.ts` | PixiJS バトル画面 | 大 |
| 7 | **新規** `CommandWindow.ts` | コマンド選択 UI | 中 |
| 8 | **新規** `DamagePopup.ts` | ダメージ表示 | 小 |
| 9 | `simulate.ts` | gameDb 引数対応 | 小 |
| 10 | `damage.ts` | formula 評価の安全化 | 小 |
| 11 | `WebOpHandler.ts` | バトル後に saveData.party.states を更新 | 小 |

---

## 5. テスト計画

| テスト | 内容 |
|-------|------|
| AI | smartAi の条件分岐・rating 抽選が正しく動作する |
| ステータス | 毒でターン終了時にダメージ、麻痺でスキップ |
| formula | 安全な式は計算される、危険な式はブロックされる |
| ラベルジャンプ | WIN → onWin ラベル、LOSE → onLose ラベルに飛ぶ |
| gameDb 連携 | gameDb が空ならデフォルトデータにフォールバック |
| セーブ/ロード | バトル後の party.states が正しくセーブ/ロードされる |

---

## 6. 実装順序（推奨）

```
Step 1: onWin/onLose ラベルジャンプ（OpRunner.ts のみ、小）
Step 2: gameDb 連携（WebOpHandler で gameDb からデータ取得）
Step 3: smartAi（条件付きスキル選択）
Step 4: ステータス効果（statusEffects.ts + applyAction.ts）
Step 5: バトル UI 刷新（BattleScene + 各ウィンドウ）← 最大の工数
Step 6: formula 安全化
Step 7: party.states のセーブ/ロード連携
```

Step 1-4 は独立して進められる。Step 5 が最も工数が大きい。
