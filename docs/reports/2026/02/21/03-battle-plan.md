# コマンドバトルシステム 実装計画書

> Stage 3/3 - 段階的実装の手順・タスク・判断基準
>
> **実行環境: ブラウザ（TypeScript）。サーバーは使わない。**

## 関連文書

| # | 文書 | 内容 |
|---|------|------|
| Stage 1 | [01-battle-spec.md](./01-battle-spec.md) | 仕様書（要件定義） |
| Stage 2 | [02-battle-design.md](./02-battle-design.md) | 設計書（アーキテクチャ） |
| Stage 3 | 本文書 | 計画書（タスク・判断基準） |
| UI設計 | [04-battle-ui-design.md](./04-battle-ui-design.md) | バトル画面UI設計（レイアウト・座標・遷移フロー） |

## 1. 全体スケジュール（5フェーズ）

```
Phase 1: BattleCore 最小実装     ← 最優先
Phase 2: ノベルエンジン連携
Phase 3: 状態異常 + トリガー演出
Phase 4: AI拡張（Utility + Expectimax）
Phase 5: スキル拡張 + データ充実
```

**フェーズ順序は厳守。前のフェーズが完了しテストが通るまで次に進まない。**

---

## Phase 1: BattleCore 最小実装

### 目標

- `simulate(scenario, inputs) → BattleResult` が動く
- 決定論（同一 seed + inputs → 同一結果）をテストで保証

### タスク

| # | タスク | ファイル | 完了条件 |
|---|--------|---------|---------|
| 1-1 | パッケージ作成 | `packages/battle/package.json`, `tsconfig.json` | ビルド通る |
| 1-2 | 型定義 | `core/types.ts` | ActorState, BattleState, BattleResult 等 |
| 1-3 | RNG 実装 | `core/rng.ts` | xorshift32, `makeRng(seed)` |
| 1-4 | ダメージ計算 | `core/damage.ts` | 純粋関数 `calcDamage(atk, def, power, variance, rng)` |
| 1-5 | 行動適用 | `core/applyAction.ts` | attack / heal のみ（状態異常は Phase 3） |
| 1-6 | 勝敗判定 | `core/victory.ts` | 敵全滅 / 味方全滅 |
| 1-7 | simulate 統合 | `core/simulate.ts` | シナリオ + 入力列 → 結果 |
| 1-8 | スキルデータ | `data/skills.ts` | atk, healS の 2 種のみ |
| 1-9 | 最初の敵AI | `ai/simpleAi.ts` | `if hp < 30% → atk else → atk`（固定ロジック） |
| 1-10 | テスト3件 | `__tests__/` | seed同一→結果同一 / 同inputs→同結果 / 1入力変更→結果変化 |

### 判断基準

- [ ] `npm test` で 3 テスト PASS
- [ ] `simulate()` が純粋関数（引数のみ依存、副作用なし）
- [ ] RNG にグローバル状態がない

---

## Phase 2: ノベルエンジン連携

### 目標

- BATTLE コマンドでノベル進行から戦闘に入り、勝敗で分岐できる

### タスク

| # | タスク | ファイル | 完了条件 |
|---|--------|---------|---------|
| 2-1 | BattleRunner 実装 | `runner/battleRunner.ts` | ターンループ + BattleIO 呼び出し |
| 2-2 | BattleIO 定義 | `runner/battleIO.ts` | show / choose / promptCommand インタフェース |
| 2-3 | CLI用 BattleIO | `runner/cliBattleIO.ts` | readline ベースの実装（テスト用） |
| 2-4 | BATTLE コマンド追加 | `packages/interpreter/` | SceneRunner に BATTLE 処理を追加 |
| 2-5 | セーブ構造拡張 | `packages/core/` | party + inventory フィールド追加 |
| 2-6 | サンプルシーン | `data/sampleScene.ts` | TEXT → CHOICE → BATTLE → WIN/LOSE 分岐 |
| 2-7 | 統合テスト | `__tests__/` | シーン実行 → 戦闘 → 分岐 を end-to-end で確認 |

### 判断基準

- [ ] CLI デモで「テキスト→選択→戦闘→勝敗分岐」が動作
- [ ] BattleRunner が BattleIO 経由でのみ UI 操作（直接 console.log しない）
- [ ] セーブ/ロード後に戦闘状態が復元できる

---

## Phase 3: 状態異常 + トリガー演出

### 目標

- poison / paralyze / stun が機能する
- 戦闘中に条件付きテキスト差し込みができる

### タスク

| # | タスク | ファイル | 完了条件 |
|---|--------|---------|---------|
| 3-1 | 状態異常適用 | `core/applyAction.ts` | applyStatus スキル対応 |
| 3-2 | ターン経過処理 | `core/turnEnd.ts` | 毒ダメ / スタン解除 / turns 減算 |
| 3-3 | poison スキル追加 | `data/skills.ts` | poison, powerAtk 追加 |
| 3-4 | 敵プロファイル | `data/enemyProfiles.ts` | 5体分のパターン定義 |
| 3-5 | トリガー判定 | `runner/triggerCheck.ts` | TriggerRule 評価 |
| 3-6 | BattleHooks 追加 | `runner/battleRunner.ts` | onTrigger コールバック |
| 3-7 | BATTLE コマンド拡張 | コマンド型 | triggerLines フィールド追加 |
| 3-8 | テスト | `__tests__/` | 毒ダメ計算 / トリガー発火 |

### 判断基準

- [ ] 毒ダメージが毎ターン正しく適用される
- [ ] スタン中の敵が行動スキップされる
- [ ] triggerLines の差し込みテキストが正しいタイミングで表示される
- [ ] seed 固定で結果が再現できる（状態異常込み）

---

## Phase 4: AI拡張（Utility + Expectimax）

### 目標

- 敵AIが「賢い」行動を取れる（確殺・回復・MP管理）
- 難易度調整が機能する

### タスク

| # | タスク | ファイル | 完了条件 |
|---|--------|---------|---------|
| 4-1 | 候補生成 | `ai/candidateGen.ts` | ターゲット方針付き候補列挙 |
| 4-2 | ゲーティング | `ai/gating.ts` | 条件不一致の候補を除外 |
| 4-3 | Utility スコアリング | `ai/utility.ts` | 6項目のスコア計算 |
| 4-4 | Expectimax | `ai/expectimax.ts` | TOP_N + SAMPLES でモンテカルロ先読み |
| 4-5 | 局面評価関数 | `core/evaluate.ts` | HP比 + 状態異常加点 |
| 4-6 | 難易度プリセット | `data/aiTuning.ts` | easy / normal / hard |
| 4-7 | chooseAction 統合 | `ai/chooseAction.ts` | パイプライン全体をつなぐ |
| 4-8 | テスト | `__tests__/` | 同一状態で難易度変更→行動変化 / デバッグ出力でスコア確認 |

### 判断基準

- [ ] HP 30% 以下で回復スキルを選択する（ゲーティング動作）
- [ ] 確殺可能なターゲットを優先する（Utility 動作）
- [ ] Easy と Hard で行動が異なる
- [ ] デバッグ出力で breakdown（各スコア項目）が確認できる

---

## Phase 5: スキル拡張 + データ充実

### 目標

- ゲームとして遊べる最小のデータセットが揃う
- 拡張パターンが確立される

### タスク

| # | タスク | 内容 |
|---|--------|------|
| 5-1 | アイテム使用 | BattleRunner でインベントリ消費 + applyItem |
| 5-2 | guard 実装 | 防御コマンド（次ターンの被ダメ半減） |
| 5-3 | Troop データ充実 | 5種の敵グループ（雑魚 → ボスの段階） |
| 5-4 | サンプルシナリオ | 3戦闘の短編ノベル（選択肢→戦闘→分岐→エンディング） |
| 5-5 | ブラウザ UI（PixiJS） | BattleIO のブラウザ実装 → [04-battle-ui-design.md](./04-battle-ui-design.md) 参照 |
| 5-6 | パラメータ調整 | aiTuning.ts のチューニング + テストプレイ |

---

## 3. ディレクトリ作成手順

```bash
# Phase 1 開始時
mkdir -p packages/battle/src/{core,ai,data,runner}
mkdir -p packages/battle/__tests__

# package.json 作成
# tsconfig.json 作成（packages/core の tsconfig を参考に）
```

## 4. テスト戦略

### 4.1 テストの優先度

```
必須（各フェーズの完了条件）:
  - 決定論テスト（seed 再現）
  - ダメージ計算テスト
  - AI行動テスト（特定状態→特定行動）

推奨（安定性向上）:
  - 勝敗判定の境界テスト
  - 状態異常のターン経過テスト
  - Expectimax のスコア検証

将来（C++ 移植時）:
  - テストベクトル（JSON）による TS/C++ 結果一致テスト
```

### 4.2 テストベクトル形式（Phase 4 以降）

```json
{
  "name": "boss_basic_3turns",
  "scenario": { "troopId": "t_boss_1", "difficulty": "normal", "party": [...] },
  "inputs": [
    { "turn": 1, "actorId": "hero", "action": { "kind": "attack", "target": { "kind": "enemy", "index": 0 } } }
  ],
  "expect": {
    "outcome": "WIN",
    "turns": 3,
    "partyAfter": [{ "actorId": "hero", "hp": 41, "mp": 10 }]
  }
}
```

## 5. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| RNG 実装の TS/C++ 不一致 | 全テスト失敗 | Phase 1 で RNG テストベクトルを作り、将来の C++ 実装時に最初に合わせる |
| AI が強すぎ/弱すぎ | ゲーム体験崩壊 | aiTuning.ts で難易度を外部化。テストプレイで調整 |
| 戦闘とノベルの密結合 | 将来の Switch 移植時に破綻 | BattleIO で UI 分離。BATTLE コマンドが唯一の接点 |
| 状態異常の複雑化 | テスト困難 | Phase 3 では 3 種のみ。追加は Phase 5 以降 |
| 浮動小数の環境差 | 再現性崩壊 | `Math.floor()` で整数丸め。将来的に basis points 化 |

## 6. 成功条件（全フェーズ完了時）

- [ ] ブラウザで 3 戦闘の短編ノベルが最後まで遊べる
- [ ] 同一 seed で結果が完全再現される
- [ ] 難易度 Easy / Normal / Hard で体感差がある
- [ ] BattleCore が純粋関数で、UI 依存がない
- [ ] テスト件数 > コードファイル数（テスト量 > コード量の方針）

## 7. パラメータ調整ワークフロー（Phase 5）

```
Step 1: 敵の「性格」を行動パターン(enemyProfiles.ts)で決める
  → 回復条件、強攻撃の解禁タイミング、毒の使い方

Step 2: スキル性能を合わせる(skills.ts)
  → power / hitChance / statusChance を調整

Step 3: UtilityWeights で賢さの偏りを直す
  → 回復しない → survival ↑、状態異常ばかり → disable ↓

Step 4: SearchParams で難易度を決める
  → TOP_N / SAMPLES / GAMMA の調整（最後に行う）
```

### 調整時の確認方法

`chooseEnemyAction()` の戻り値に `debug.breakdown` が含まれる。
各スコア項目（EV_damage / kill_bonus / EV_survival / lookahead_EV 等）を確認して調整。

### よくある症状と処方箋

| 症状 | 原因 | 対策 |
|------|------|------|
| 回復しない | ゲートの hpBelow が低すぎ or survival が低い | hpBelow ↑ / survival ↑ |
| 毒ばかり | disable が高い or ゲート条件が緩い | disable ↓ / ゲート条件を厳しく |
| 強攻撃連発 | mpPenalty が低い | mpPenalty ↑ / powerAtk.mpCost ↑ |
| 弱すぎ | 先読みが浅い | TOP_N ↑ / SAMPLES ↑ / GAMMA ↑ |
