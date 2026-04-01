# ツクール型エディタ テスト計画書（サーバーなし・単体テスト）

> **作成日**: 2026-03-18
> **担当**: Claude Code (Opus 4.6)
> **テストフレームワーク**: Vitest 4.0.18 + jsdom
> **実行方法**: `npm test -w apps/editor`
> **前提**: API サーバー・DB 不要。全テストがローカルで完結する

---

## 0. テスト方針

### サーバーなしで検証可能な範囲

| レイヤー | テスト可能 | テスト不可（API 依存） |
|---------|----------|---------------------|
| 型定義・ヘルパー関数 | ✅ | — |
| Zustand ストア | ✅ | API fetch 部分 |
| コマンドツリー操作 | ✅ | — |
| GameState | ✅ | — |
| EventInterpreter | ✅ | — |
| React コンポーネント描画 | ✅ (jsdom) | API 呼び出し |
| API ルート | — | ❌ DB 必要 |
| Prisma マイグレーション | — | ❌ DB 必要 |

### テスト構成

```
apps/editor/src/
  __tests__/
    runtime/
      GameState.test.ts          ← ゲーム状態管理
      EventInterpreter.test.ts   ← コマンド実行エンジン
    utils/
      commandTree.test.ts        ← ツリー操作ユーティリティ
    types/
      eventCommand.test.ts       ← コマンドヘルパー関数
    store/
      useTsukuruStore.test.ts    ← Zustand ストア
    components/
      GameDbPanel.test.tsx       ← DB パネル描画
```

---

## 1. commandTree.test.ts（ツリー操作）— 最重要

Phase 3 レビューで「ネスト対応が核心」と評価された `commandTree.ts` のテスト。

### テストケース (15 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | トップレベルに挿入 | `insertCommandAtPath([], 0, cmd)` → 先頭に追加 |
| 2 | トップレベル末尾に挿入 | `insertCommandAtPath([], 3, cmd)` → 末尾に追加 |
| 3 | 条件分岐 then に挿入 | `insertCommandAtPath([0, 'thenCommands'], 0, cmd)` |
| 4 | 条件分岐 else に挿入 | `insertCommandAtPath([0, 'elseCommands'], 0, cmd)` |
| 5 | 選択肢の中に挿入 | `insertCommandAtPath([0, 'choices', 1, 'commands'], 0, cmd)` |
| 6 | 2段ネスト（if の中の if）に挿入 | `insertCommandAtPath([0, 'thenCommands', 0, 'thenCommands'], 0, cmd)` |
| 7 | トップレベルのコマンド更新 | `updateCommandAtPath([], 1, updated)` |
| 8 | ネスト内のコマンド更新 | `updateCommandAtPath([0, 'thenCommands'], 0, updated)` |
| 9 | トップレベルのコマンド削除 | `deleteCommandAtPath([], 1)` → 長さ -1 |
| 10 | ネスト内のコマンド削除 | `deleteCommandAtPath([0, 'thenCommands'], 0)` |
| 11 | コマンドの上移動 | `moveCommandAtPath([], 1, 0)` |
| 12 | コマンドの下移動 | `moveCommandAtPath([], 0, 1)` |
| 13 | 空配列への挿入 | `insertCommandAtPath([], 0, cmd)` on empty |
| 14 | 不正パスでも壊れない | `insertCommandAtPath([99, 'thenCommands'], 0, cmd)` → 元の配列を返す |
| 15 | Immutable 性 | 操作後、元の配列が変更されていないことを確認 |

---

## 2. GameState.test.ts（ゲーム状態管理）

### テストケース (18 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | 初期状態 | 変数 0、スイッチ false、所持金 0 |
| 2 | 変数の代入 | `setVariable(1, 42)` → `getVariable(1) === 42` |
| 3 | 変数の加算 | `operateVariable(1, '+=', 10)` |
| 4 | 変数の減算 | `operateVariable(1, '-=', 5)` |
| 5 | 変数の乗算 | `operateVariable(1, '*=', 3)` |
| 6 | 変数のゼロ除算 | `operateVariable(1, '/=', 0)` → 0 |
| 7 | スイッチの設定 | `setSwitch(1, true)` → `getSwitch(1) === true` |
| 8 | セルフスイッチ | `setSelfSwitch('ev1', 'A', true)` |
| 9 | 所持金の増加 | `changeGold(100)` → `gold === 100` |
| 10 | 所持金の下限 | `changeGold(-9999)` → `gold === 0`（負にならない） |
| 11 | アイテム追加 | `changeItem('potion', 3)` → `getItemCount('potion') === 3` |
| 12 | アイテム全消費 | `changeItem('potion', -3)` → `getItemCount('potion') === 0` |
| 13 | パーティ追加 | `addPartyMember('hero')` → party に含まれる |
| 14 | パーティ重複防止 | 2回追加しても1人 |
| 15 | パーティ離脱 | `removePartyMember('hero')` → party から除外 |
| 16 | 場所移動 | `transferPlayer('map2', 5, 10, 'up')` |
| 17 | スナップショット | `snapshot()` が deep copy であること |
| 18 | subscribe 通知 | 値変更時にリスナーが呼ばれる |

---

## 3. EventInterpreter.test.ts（コマンド実行エンジン）

### テストケース (12 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | show_text 実行 | callback.showText が呼ばれる |
| 2 | show_choices 実行 | 選択肢 0 を選ぶ → choices[0].commands が実行される |
| 3 | control_switches | スイッチ [1] が ON になる |
| 4 | control_variables += | 変数 [1] が加算される |
| 5 | conditional_branch (true) | スイッチ ON → thenCommands 実行 |
| 6 | conditional_branch (false) | スイッチ OFF → elseCommands 実行 |
| 7 | conditional_branch 変数比較 | 変数 >= 条件 |
| 8 | transfer_player | callback.transferPlayer + GameState 更新 |
| 9 | battle_processing | callback.startBattle が呼ばれる |
| 10 | wait | callback.wait が正しい ms で呼ばれる |
| 11 | comment | 何も実行されない |
| 12 | abort | 途中で abort → 残りのコマンドが実行されない |

### テスト用モック

```typescript
function createMockCallbacks(): InterpreterCallbacks & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    showText: async (speaker, body) => { calls.push(`text:${body}`); },
    showChoices: async (choices) => { calls.push(`choices:${choices.join(',')}`); return 0; },
    transferPlayer: async (map, x, y) => { calls.push(`transfer:${map}`); },
    startBattle: async (troop) => { calls.push(`battle:${troop}`); return true; },
    wait: async (ms) => { calls.push(`wait:${ms}`); },
    log: (msg) => { calls.push(`log:${msg}`); },
  };
}
```

---

## 4. eventCommand.test.ts（コマンドヘルパー）

### テストケース (10 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | createDefaultCommand 全種類 | 16 コマンド全てが正しい type を持つ |
| 2 | commandSummary show_text | `"文章の表示"` を含む |
| 3 | commandSummary show_choices | 選択肢テキストが含まれる |
| 4 | commandSummary control_switches | `"スイッチ [0001] = ON"` |
| 5 | commandSummary conditional_branch (switch) | `"スイッチ [1] が ON"` |
| 6 | commandSummary conditional_branch (variable) | `"変数 [1] >= 10"` |
| 7 | commandSummary transfer_player | マップ名が含まれる |
| 8 | commandDetailLines show_text | テキストの各行が配列で返る |
| 9 | commandDetailLines show_choices | 選択肢が `[1] はい` 形式で返る |
| 10 | COMMAND_CATEGORIES | 全カテゴリが存在し、commands が空でない |

---

## 5. useTsukuruStore.test.ts（Zustand ストア）

### テストケース (8 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | 初期状態 | activeTab === 'map', maps === [], projectId === null |
| 2 | setActiveTab | 'database' に切替 |
| 3 | setProject | projectId, title, gameDb が設定される |
| 4 | setMaps | マップ一覧が設定される |
| 5 | setCurrentMapSlug | 選択マップが切り替わる |
| 6 | setDrawTool | 描画ツールが変わる |
| 7 | updateGameDb | gameDb が更新され、isDirty が true になる |
| 8 | setZoom | min 0.25, max 4 にクランプされる |

---

## 6. GameDbPanel.test.tsx（コンポーネント描画）

### テストケース (6 件)

| # | テスト | 検証内容 |
|---|--------|---------|
| 1 | 初期表示 | 13 タブボタンが表示される |
| 2 | タブ切替 | 「敵キャラ」クリック → リストが切り替わる |
| 3 | アクター追加 | 「+ 追加」→ リストに新アイテムが追加される |
| 4 | アクター選択 | リスト項目クリック → 詳細パネルが表示される |
| 5 | 外部 props | externalGameDb + onUpdateGameDb が正しく動作する |
| 6 | 空状態 | gameDb が空でもクラッシュしない |

---

## テスト実行コマンド

```bash
# 全テスト実行
npm test -w apps/editor

# 特定ファイル
npx vitest run apps/editor/src/__tests__/utils/commandTree.test.ts

# ウォッチモード
npx vitest apps/editor/src/__tests__/runtime/

# カバレッジ
npx vitest run --coverage -w apps/editor
```

---

## 優先順位

| 優先度 | テストファイル | 理由 |
|--------|-------------|------|
| **P0** | commandTree.test.ts | ネスト操作はバグると全コマンド編集が壊れる |
| **P0** | GameState.test.ts | ランタイムの根幹、全ての状態管理 |
| **P0** | EventInterpreter.test.ts | テストプレイの動作保証 |
| **P1** | eventCommand.test.ts | ◆ 表記の正確性 |
| **P1** | useTsukuruStore.test.ts | UI 状態の整合性 |
| **P2** | GameDbPanel.test.tsx | UI 描画テスト（jsdom） |

---

## 合計: 69 テストケース

| ファイル | ケース数 |
|---------|---------|
| commandTree.test.ts | 15 |
| GameState.test.ts | 18 |
| EventInterpreter.test.ts | 12 |
| eventCommand.test.ts | 10 |
| useTsukuruStore.test.ts | 8 |
| GameDbPanel.test.tsx | 6 |
| **合計** | **69** |
