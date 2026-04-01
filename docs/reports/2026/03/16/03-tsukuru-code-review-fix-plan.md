# ツクール Phase 2-6 コードレビュー修正計画書

**作成日**: 2026-03-16
**対象**: PR #4 `feat: ツクール Phase 2〜6 コア実装` のコードレビュー指摘事項
**関連**: Issue #5（Compiler labels タイミング問題）

---

## 指摘事項一覧

### Critical（実バグ・データ破損リスク）

| # | ファイル | 問題 | 行 |
|---|---------|------|-----|
| **C1** | ~~ksc-demo.ts~~ | ~~API preview で gameDb/templates 未取得~~ | ~~354-356~~ |
| **C2** | Compiler.ts | labels の PC が transform 後にズレる（Issue #5） | 48 |
| **C3** | applyAction.ts | 致死ダメージ時にステータス効果が付与されない（`target.hp > 0` チェックが damage 後） | 109 |
| **C4** | SaveData.ts | `party.states[].statuses` が `string[]` だが BattleState では `Record<StatusId, {turns}>` → セーブ/ロードで型不一致 | 43 |

※ C1 は `59f8cc7` で修正済み

### High（機能不全・構文エラー）

| # | ファイル | 問題 | 行 |
|---|---------|------|-----|
| **H1** | WebOpHandler.ts | scrollText の click リスナーが `removeEventListener` されない → メモリリーク | 392 |
| **H2** | WebOpHandler.ts | scrollText を連続呼び出しすると前の overlay が残ったまま新しい overlay が追加される | 358 |
| **H3** | MapSystem.ts | `moveEvent` の `durationMs > 0` 分岐が `jumpTo` と同じ → アニメーションなし | 329-338 |
| **H4** | OpRunner.ts | `this.pc = op.pc` に境界チェックなし。不正 PC で undefined 動作 | 271, 322, 338 |
| **H5** | applyAction.ts | 存在しないスキル ID で silent failure（ログなし、RNG 消費なし） | 47-50 |
| **H6** | WebOpHandler.ts | blockToKsc が choice/if/jump/audio 等を未サポート → テンプレート内で使えない | 464-512 |

### Medium（品質・型安全性）

| # | ファイル | 問題 | 行 |
|---|---------|------|-----|
| **M1** | GameDb.ts | `EnemyDef.stats` が `Partial<BaseStats>` で maxHp undefined の敵が作れる | 56 |
| **M2** | GameDb.ts | formula フィールドが string → eval リスク（下流で使用される場合） | 85 |
| **M3** | GameDb.ts | `core` が `battle` を import（循環依存リスク） | 8 |
| **M4** | preview.ts | `@battle` の troopId/onWin/onLose が空文字で構文エラー KSC を生成 | 389 |
| **M5** | useEditorStore.ts | `@call` の templateId 未設定で `@call ` を生成（パース失敗） | 751-752 |
| **M6** | useEditorStore.ts | buildSnapshotScript で characterId を slug 前提で検索するが ID の場合がある | 866-867 |
| **M7** | SidebarPreview.tsx | gameDb を `(project as any).gameDb` で参照（型定義なし） | 77 |
| **M8** | SidebarPreview.tsx | KSC テストプレビューが gameDb を送っていない | 129 |
| **M9** | simulate.ts | 空の skillLookup `{}` で全スキル失敗、silent | 39, 53, 73 |

### Low（設計・ドキュメント）

| # | ファイル | 問題 |
|---|---------|------|
| **L1** | MapSystem.ts | `(char as any)._pathIndex` の型安全性 |
| **L2** | commandRegistry.ts | `JUMP_IF` が内部生成のみだがドキュメントなし |
| **L3** | IOpHandler.ts | async/sync メソッドが混在 |
| **L4** | applyTurnEndEffects | 毒で HP1 止まり → ターン上限 50 で引き分けリスク |

---

## 修正計画

### Phase A: Critical バグ修正

#### A-1: ステータス効果の致死ダメージ問題（C3）

**対象**: `packages/battle/src/core/applyAction.ts:109`

**現状**:
```typescript
if (skill.statusId && skill.statusChance && target.hp > 0) {
```
致死ダメージ後に `target.hp === 0` → ステータス付与されない。

**修正**: ダメージ適用前に HP を記録し、ダメージ前に HP > 0 だった場合はステータス判定を行う。
```typescript
const hpBeforeDamage = target.hp;
// ... damage calculation ...
if (skill.statusId && skill.statusChance && hpBeforeDamage > 0) {
```

**テスト**: `packages/battle/__tests__/damage.test.ts` にケース追加
- 致死ダメージ + 毒スキル → 毒は付与されない（dead target）or 付与される（design choice）

#### A-2: SaveData statuses 型不一致（C4）

**対象**: `packages/core/src/types/SaveData.ts:43`

**現状**: `statuses: string[]`（配列）
**BattleState**: `statuses: Partial<Record<StatusId, { turns: number }>>`（オブジェクト）

**修正**: SaveData の statuses をオブジェクト形式に変更。
```typescript
statuses: Record<string, { turns: number }>;  // statusId → {turns}
```

**影響**: `DEFAULT_SAVE_FIELDS` と `SaveData.test.ts` も更新。

### Phase B: High 機能不全修正

#### B-1: scrollText メモリリーク（H1, H2）

**対象**: `packages/web/src/renderer/WebOpHandler.ts:358-406`

**修正**:
1. 既存の overlay があれば先に除去（連続呼び出し対策）
2. resolve 時に `removeEventListener` を呼ぶ

```typescript
async scrollText(text: string, speed?: number): Promise<void> {
  // 既存のスクロールを停止
  const existing = document.getElementById("scroll-text-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "scroll-text-overlay";
  // ...
  const clickHandler = () => { skipped = true; };
  overlay.addEventListener("click", clickHandler);
  // ...
  // resolve 時
  overlay.removeEventListener("click", clickHandler);
  overlay.remove();
  resolve();
```

#### B-2: moveEvent アニメーション未実装（H3）

**対象**: `packages/web/src/systems/MapSystem.ts:329-338`

**修正**: `durationMs > 0` の場合に `lerpPosition` または `requestAnimationFrame` ベースの補間を実装。

```typescript
if (durationMs <= 0) {
  char.jumpTo(x, y);
} else {
  await char.moveTo(x, y, durationMs);  // 新メソッド
}
```

#### B-3: OpRunner PC 境界チェック（H4）

**対象**: `packages/core/src/engine/OpRunner.ts:271, 322, 338`

**修正**: JUMP/JUMP_IF で PC を設定する箇所に境界チェックを追加。

```typescript
if (op.pc < 0 || op.pc > this.ops.length) {
  console.warn(`[OpRunner] Invalid jump target: pc=${op.pc}, ops.length=${this.ops.length}`);
  this.pc = this.ops.length; // 安全に終了
} else {
  this.pc = op.pc;
}
```

#### B-4: スキル未存在時の silent failure（H5）

**対象**: `packages/battle/src/core/applyAction.ts:47-50`

**修正**: ログ出力 + RNG 消費で deterministic 性を維持。

```typescript
if (!skill) {
  rng.nextFloat(); // RNG 消費して同期を維持
  log.push({ type: 'miss', source: action.sourceId, target: action.targetId, reason: 'skill_not_found' });
  return { state: newState, log };
}
```

#### B-5: blockToKsc 未サポートブロック（H6）

**対象**: `packages/web/src/renderer/WebOpHandler.ts:464-512`

**修正**: テンプレートで使われる可能性のあるブロックを追加。

```typescript
case 'choice': // 選択肢
case 'if':     // 条件分岐
case 'jump':   // ページジャンプ
case 'wait':   // ウェイト
```

choice/if は `generateKSCScript`（preview.ts）の実装を流用する。

### Phase C: Medium 品質改善

#### C-1: battle/call の空値ガード（M4, M5）

**対象**: `preview.ts:389`, `useEditorStore.ts:751-752`

**修正**: 空値の場合は空行を出力（KSC 生成スキップ）。

```typescript
// preview.ts
case 'battle':
  if (!block.troopId) return '';
  return `@battle ${block.troopId} onWin=${block.onWinPageId || ''} onLose=${block.onLosePageId || ''}`;

// useEditorStore.ts
case 'call':
  return block.templateId ? `@call ${block.templateId}` : '';
```

#### C-2: gameDb 型定義追加（M7）

**対象**: `apps/editor/src/types/index.ts`

**修正**: EditorProject に `gameDb` フィールドを型付きで追加。SidebarPreview の `as any` を除去。

#### C-3: EnemyDef.stats の必須化（M1）

**対象**: `packages/core/src/types/GameDb.ts:56`

**修正**: 最低限 `maxHp`/`atk`/`def` を必須にする。

```typescript
stats: Pick<BaseStats, 'maxHp' | 'atk' | 'def'> & Partial<Omit<BaseStats, 'maxHp' | 'atk' | 'def'>>;
```

---

## 実施順序

```
Phase A（Critical）──── 致死ステータス + SaveData statuses 型修正
  │
Phase B（High）──────── scrollText リーク + moveEvent + PC境界 + skill failure + blockToKsc
  │
Phase C（Medium）────── 空値ガード + gameDb 型 + EnemyDef stats
```

- Phase A は Phase B/C と独立（先に実施）
- Phase B の各項目は互いに独立（並行可能）
- Phase C は Phase B 後に実施（M7 は B-5 と関連）

---

## 成果物

| Phase | 修正ファイル | テスト追加 |
|-------|------------|----------|
| A | applyAction.ts, SaveData.ts, SaveData.test.ts | +2 |
| B | WebOpHandler.ts, MapSystem.ts, OpRunner.ts, applyAction.ts | +4 |
| C | preview.ts, useEditorStore.ts, types/index.ts, GameDb.ts | +2 |
| **合計** | **10ファイル** | **+8テスト** |

---

## 対象外（次スプリント）

| # | 問題 | 理由 |
|---|------|------|
| C2 | Compiler.ts labels タイミング | Issue #5 で追跡中。現時点で実害なし |
| M2 | formula eval リスク | gameDb エディタ UI 未実装のため、ユーザー入力経路なし |
| M3 | core→battle 循環依存 | type import のみで実行時影響なし。構造的リファクタが必要 |
| L1-L4 | 型安全性・ドキュメント | リリースブロッカーではない |
