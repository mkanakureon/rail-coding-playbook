# ツクール将来拡張計画

**作成日**: 2026-03-16
**前提**: Phase 2〜6 完了済み。ツクール相当ラインに到達。以下は「あると嬉しい」機能。

---

## 優先度と依存関係

```
Phase 7 ─── 経験値・レベルアップ ──→ 装備変更 UI ──→ ショップ UI ──→ テスト
                                                                        │
Phase 8 ─── バトルアニメーション ──→ スキルエフェクト ────────────────→ テスト
                                                                        │
Phase 9 ─── オートタイル UI ───────→ タイルセット管理 ────────────────→ テスト
                                                                        │
Phase 10 ── プラグインシステム ────────────────────────────────────────→ テスト
```

---

## Phase 7: RPG 進行システム（経験値・装備・ショップ）

### 7-1. 経験値・レベルアップ処理

**規模**: 中
**依存**: GameDb（ActorDef.growthCurve 型は定義済み）

バトル勝利後に経験値を獲得し、レベルアップ時にステータスが上昇する。

**実装内容:**
- `packages/battle/src/core/experience.ts`（新規）
  - `calculateExpReward(enemies: EnemyState[]): number` — 敵の合計 EXP
  - `checkLevelUp(actor: ActorDef, currentLevel: number, currentExp: number): LevelUpResult`
  - `applyGrowth(stats: BaseStats, curve: GrowthCurve): BaseStats` — ステータス上昇
- `WebOpHandler.battleStart()` — 勝利後に EXP 加算 + レベルアップ判定
- `BattleScene` — レベルアップ演出表示
- `SaveData.party.states` — exp/level の保存（型は v2 で定義済み）

**テスト:**
- experience.ts のユニットテスト（vitest）
- レベルアップ境界値テスト

### 7-2. 装備変更 UI（プレイ中）

**規模**: 中
**依存**: 7-1（レベルアップ後に装備を変えたくなる）

プレイ中にパーティメンバーの武器・防具を変更する画面。

**実装内容:**
- `packages/web/src/renderer/ui/EquipmentScreen.ts`（新規）
  - PixiJS Container ベース
  - 左: パーティメンバー選択
  - 右: 装備スロット（武器・防具）+ 所持アイテムから選択
  - ステータス変化のプレビュー表示
- `WebOpHandler` — メニューから呼び出し
- `SaveData.inventory.equipment` — 装備状態の保存（型は v2 で定義済み）

### 7-3. ショップ UI（プレイ中）

**規模**: 中
**依存**: 7-2（装備を買う場所が必要）

NPC との会話から呼び出せるショップ画面。

**実装内容:**
- `packages/web/src/renderer/ui/ShopScreen.ts`（新規）
  - 購入: アイテム一覧（名前・価格・説明）、所持金表示
  - 売却: 所持アイテム一覧（売値は price の半額）
  - 購入/売却時に inventory.gold と inventory.items を更新
- `SHOP_OPEN` Op（新規）— `@shop itemId1 itemId2 ...`
- または `ksc` ブロック経由で呼び出し（Op 追加なしでも可能）

**代替案**: choice + set_var の組み合わせで実現可能（エディタ上で手動構築）。専用 UI は UX 改善目的。

---

## Phase 8: バトルアニメーション

**規模**: 大
**依存**: なし（独立して実装可能）

スキル発動時のエフェクト演出。ツクールのアニメーションエディタに相当。

### 8-1. アニメーションデータ

```typescript
interface BattleAnimation {
  id: string;
  name: string;
  frames: BattleAnimFrame[];
  sound?: string;  // SE ID
}

interface BattleAnimFrame {
  duration: number;  // ms
  cells: BattleAnimCell[];
}

interface BattleAnimCell {
  spriteIndex: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}
```

### 8-2. 実装内容

- `GameDb` に `animations: BattleAnimation[]` を追加
- `BattleScene` でスキル発動時にアニメーション再生
- スプライトシートからフレームを切り出して連番再生
- エディタにアニメーションプレビュー

### 8-3. 簡易版（先行実装可能）

フル実装の前に、組み込みエフェクト（flash/shake/particle）でスキルごとに演出を設定:

```typescript
interface SkillEffect {
  type: 'flash' | 'shake' | 'particle';
  color?: number;
  duration?: number;
  intensity?: number;
}
```

GameSkillDef に `effect?: SkillEffect` を追加するだけで実現可能。

---

## Phase 9: マップエディタ オートタイル UI

**規模**: 中
**依存**: なし

### 9-1. オートタイルパレット

ランタイム（MapSystem）はオートタイル描画を実装済み。
エディタ側でオートタイルをパレットに表示し、配置時に自動的に隣接タイルを更新する。

**実装内容:**
- `TilePalette.tsx` — オートタイルセクション追加
- `MapCanvas.tsx` — タイル配置時に周囲のオートタイルを再計算
- `autotile.ts`（packages/map）の `calculateAutotileMask` をエディタから呼び出し

### 9-2. タイルセット管理

現在ハードコードの `DEFAULT_TILESET` を、プロジェクトごとにカスタムタイルセットを設定可能にする。

- タイルセットアップロード（アセット管理経由）
- タイルセットの tileWidth/tileHeight/columns 設定
- マップごとに使用タイルセットを選択

---

## Phase 10: プラグインシステム

**規模**: 大
**依存**: Phase 7-9 完了後が望ましい

ツクールのプラグイン（js ファイルで機能拡張）に相当する仕組み。

### 設計方針

kaedevn はブラウザベースなので、ツクールの JS プラグインとは異なるアプローチが必要。

**候補 A: KSC スクリプト拡張**
- `ksc` ブロックで JavaScript を直接記述（既存機能）
- 共通処理はテンプレート（call ブロック）で再利用
- 利点: 追加実装なし。欠点: 高度な処理には限界

**候補 B: カスタム Op 登録**
- プロジェクト JSON にカスタム Op の定義を記述
- ランタイムがカスタム Op を `ksc` ブロック経由で実行
- 利点: 拡張性高い。欠点: 実装コスト大

**候補 C: WebAssembly プラグイン**
- Wasm モジュールをアップロードしてランタイムから呼び出し
- 利点: 高速、言語自由。欠点: 作者の敷居が高い

**推奨**: Phase 10 は**候補 A（KSC + テンプレート）で十分**。プラグインの需要が明確になってから B or C を検討。

---

## 実装スケジュール（目安）

| Phase | 期間 | 前提 |
|:-----:|:----:|------|
| 7 | 1-2 週間 | なし（すぐ着手可能） |
| 8 | 2-3 週間 | なし（7 と並行可能） |
| 9 | 1 週間 | なし |
| 10 | 検討のみ | 7-9 完了後 |

**Phase 7 が最優先** — 経験値・レベルアップがないと RPG として成り立たない。
Phase 8 は見た目の改善で後回し可能。
Phase 9 はエディタの使い勝手改善。
Phase 10 はリリース後の検討事項。

---

## 関連ファイル

| 既存リソース | 用途 |
|-------------|------|
| `packages/core/src/types/GameDb.ts` | ActorDef.growthCurve 型（Phase 7 で使用） |
| `packages/core/src/types/SaveData.ts` | inventory.equipment / party.states（Phase 7 で使用） |
| `packages/battle/src/core/damage.ts` | formula 評価（Phase 8 で拡張） |
| `packages/map/src/autotile.ts` | calculateAutotileMask（Phase 9 で使用） |
| `packages/web/src/renderer/ui/BattleScene.ts` | バトルアニメーション追加先（Phase 8） |
