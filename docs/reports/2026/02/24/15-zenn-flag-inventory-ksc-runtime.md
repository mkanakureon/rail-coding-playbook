---
title: "FlagSystem + InventorySystem を .ksc ランタイムに追加した"
emoji: "🚩"
type: "tech"
topics: ["claudecode", "typescript", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」の .ksc（Kaede Script）インタプリタに、ゲーム進行フラグとアイテム管理の仕組みを実装した話を書く。Phase 6.1 として取り組んだ内容で、GameState クラスの変数管理機構をベースにフラグとインベントリのセマンティクスを構築した。

## 背景：なぜフラグとインベントリが必要か

ノベルゲームでは「特定のイベントを見たかどうか」「特定のアイテムを持っているかどうか」で分岐する場面が頻出する。kaedevn のインタプリタには汎用的な変数システム（`GameState.variables`）が既にあったが、ゲームロジックの観点からは以下の課題があった。

1. **フラグの意図が不明確**: `flag_seen_ending_a = 1` のような変数は、bool 的な意味が暗黙で伝わらない
2. **インベントリ操作が煩雑**: アイテムの追加・削除・所持チェックを毎回手書きするのは冗長
3. **セーブデータとの整合性**: フラグやインベントリの状態を構造的にセーブ/ロードしたい

## 設計方針：GameState の変数システムを活用する

kaedevn のインタプリタは、変数をすべて `GameState` クラスの `Map<string, unknown>` で管理している。

```typescript
// packages/interpreter/src/core/GameState.ts
export class GameState {
  /** グローバル変数 (v2.1: number/boolean/string/null のみ) */
  variables: Map<string, unknown> = new Map();

  /** ローカルスコープスタック（関数呼び出し時に使用） */
  localScopes: Map<string, unknown>[] = [];

  getVar(name: string): unknown {
    // ローカルスコープを逆順で検索（最も内側から）
    for (let i = this.localScopes.length - 1; i >= 0; i--) {
      if (this.localScopes[i].has(name)) {
        return this.localScopes[i].get(name);
      }
    }
    return this.variables.get(name);
  }

  setVar(name: string, value: unknown): void {
    for (let i = this.localScopes.length - 1; i >= 0; i--) {
      if (this.localScopes[i].has(name)) {
        this.localScopes[i].set(name, value);
        return;
      }
    }
    this.variables.set(name, value);
  }
}
```

フラグシステムとインベントリシステムは、この変数システムの「上に乗る規約」として設計した。つまり新しいストレージを作るのではなく、変数名の命名規約とヘルパー関数のセットで実現する。

## FlagSystem の実装

### 命名規約

フラグ変数は `flag_` プレフィックスを使う。値は `true` / `false` のブール値のみ。

```
// .ksc スクリプト内での使用例
flag_seen_prologue = true
flag_route_a_unlocked = true

if (flag_seen_prologue == true) {
  // プロローグ既読時の処理
}
```

### FlagSystem ユーティリティ

```typescript
/**
 * フラグシステム
 * GameState の変数を使ってゲーム進行フラグを管理する
 */
export class FlagSystem {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  /** フラグを設定 */
  setFlag(name: string, value: boolean = true): void {
    this.state.setVar(`flag_${name}`, value);
  }

  /** フラグを取得（未定義の場合は false） */
  getFlag(name: string): boolean {
    const val = this.state.getVar(`flag_${name}`);
    return val === true;
  }

  /** フラグが立っているか */
  hasFlag(name: string): boolean {
    return this.getFlag(name);
  }

  /** フラグをクリア */
  clearFlag(name: string): void {
    this.state.setVar(`flag_${name}`, false);
  }

  /** 設定済みの全フラグ名を取得 */
  getAllFlags(): string[] {
    const flags: string[] = [];
    for (const [key, value] of this.state.variables) {
      if (key.startsWith("flag_") && value === true) {
        flags.push(key.slice(5)); // "flag_" を除去
      }
    }
    return flags;
  }
}
```

設計上のポイントは以下の通り。

- **未定義フラグは false**: `getFlag()` は未定義の場合 `false` を返す。これによりフラグの初期化漏れを防ぐ
- **プレフィックス規約**: `flag_` プレフィックスで他の変数との衝突を避ける
- **GameState を直接操作しない**: スクリプトから直接 `flag_xxx = true` と書くこともできるが、FlagSystem 経由を推奨

## InventorySystem の実装

### データ構造

インベントリは「アイテム名 → 個数」の Map として管理する。変数名は `inv_` プレフィックス。

```typescript
/**
 * インベントリシステム
 * GameState の変数を使ってアイテム管理を行う
 */
export class InventorySystem {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  /** アイテムを追加 */
  addItem(itemId: string, count: number = 1): void {
    const current = this.getItemCount(itemId);
    this.state.setVar(`inv_${itemId}`, current + count);
  }

  /** アイテムを削除 */
  removeItem(itemId: string, count: number = 1): boolean {
    const current = this.getItemCount(itemId);
    if (current < count) return false; // 数量不足
    const newCount = current - count;
    if (newCount <= 0) {
      this.state.setVar(`inv_${itemId}`, 0);
    } else {
      this.state.setVar(`inv_${itemId}`, newCount);
    }
    return true;
  }

  /** アイテムの所持数を取得 */
  getItemCount(itemId: string): number {
    const val = this.state.getVar(`inv_${itemId}`);
    return typeof val === "number" ? val : 0;
  }

  /** アイテムを持っているか */
  hasItem(itemId: string, count: number = 1): boolean {
    return this.getItemCount(itemId) >= count;
  }

  /** 全アイテム一覧を取得 */
  getAllItems(): Array<{ id: string; count: number }> {
    const items: Array<{ id: string; count: number }> = [];
    for (const [key, value] of this.state.variables) {
      if (key.startsWith("inv_") && typeof value === "number" && value > 0) {
        items.push({ id: key.slice(4), count: value });
      }
    }
    return items;
  }
}
```

### .ksc スクリプトからの利用

インタプリタの組み込み関数として登録すると、スクリプトからはこのように使える。

```
// アイテムを追加
inv_key_red = 1

// アイテムの所持チェック（数値比較）
if (inv_key_red >= 1) {
  #narrator
  赤い鍵を使ってドアを開けた。
  #
  inv_key_red -= 1
}
```

変数システムの代入演算子 `+=` や `-=` がそのまま使えるのがポイントだ。Evaluator クラスの `executeAssignment` がこれを処理する。

```typescript
// packages/interpreter/src/core/Evaluator.ts（抜粋）
async executeAssignment(expr: string, state: GameState): Promise<void> {
  // ...
  switch (operator) {
    case "+=": {
      const current = state.hasVar(varName) ? state.getVar(varName) : 0;
      state.setVar(varName, (current as number) + (value as number));
      break;
    }
    case "-=": {
      const current = state.hasVar(varName) ? state.getVar(varName) : 0;
      state.setVar(varName, (current as number) - (value as number));
      break;
    }
  }
}
```

## セーブデータとの連携

kaedevn のセーブスキーマは `vars` フィールドに全変数を格納する設計になっている。フラグとインベントリは単なる変数なので、追加の処理なしでセーブ/ロードが動作する。

```json
{
  "save_schema_version": 1,
  "vars": {
    "flag_seen_prologue": true,
    "flag_route_a_unlocked": true,
    "inv_key_red": 1,
    "inv_potion": 3,
    "affection": 5
  }
}
```

フラグもインベントリも通常の変数も、すべて `vars` に統一されている。

## デバッグ対応

Phase 7-2 で実装したデバッガーは変数の変更を追跡できる。フラグやインベントリの変更もそのまま追跡対象になる。

```typescript
// packages/interpreter/src/debug/Debugger.ts（抜粋）
recordVariableChange(
  name: string,
  oldValue: unknown,
  newValue: unknown,
  line: number
): void {
  if (!this.enabled || !this.watchedVars.has(name)) {
    return;
  }
  const change: VariableChange = {
    line,
    oldValue,
    newValue,
    timestamp: Date.now(),
  };
  const history = this.varHistory.get(name) || [];
  history.push(change);
  this.varHistory.set(name, history);
}
```

デバッグ時に `watchVariable("flag_seen_prologue")` を設定しておくと、フラグの変更履歴が記録される。

## テスト

FlagSystem と InventorySystem のテストは、TestEngine と組み合わせて実施した。

```typescript
import { Interpreter } from "../src/core/Interpreter";
import { TestEngine } from "../src/engine/TestEngine";

describe("FlagSystem", () => {
  it("should set and check flags via variables", async () => {
    const engine = new TestEngine();
    const interpreter = new Interpreter(engine);

    await interpreter.run(`
      flag_seen_prologue = true
      if (flag_seen_prologue == true) {
        #narrator
        プロローグ既読
        #
      }
    `);

    expect(engine.lastDialogue?.lines[0]).toBe("プロローグ既読");
  });
});

describe("InventorySystem", () => {
  it("should track item counts via variables", async () => {
    const engine = new TestEngine();
    const interpreter = new Interpreter(engine);

    await interpreter.run(`
      inv_potion = 3
      inv_potion -= 1
      if (inv_potion >= 1) {
        #narrator
        ポーション残り{inv_potion}個
        #
      }
    `);

    expect(engine.lastDialogue?.lines[0]).toBe("ポーション残り2個");
  });
});
```

文字列補間（`{inv_potion}`）が使えるのは、Phase 6 で実装した Evaluator の `interpolate` メソッドのおかげだ。

## まとめ

FlagSystem と InventorySystem を「変数の命名規約 + ヘルパークラス」として設計したことで、以下のメリットが得られた。

- **既存の変数システムとの完全互換**: セーブ/ロード・デバッグ・文字列補間がそのまま動く
- **スクリプトからの直接操作**: `flag_xxx = true`, `inv_xxx += 1` のように自然に書ける
- **Switch 移植時の影響ゼロ**: IEngineAPI には依存しないため、プラットフォーム固有の変更が不要

新しいストレージを追加するのではなく、既存の仕組みの上に規約を載せるだけという設計は、小さなプロジェクトにとって保守コストの面でも有利だった。

---

FlagSystem と InventorySystem の実装を通じて、既存の変数システムの拡張性を再確認できた。「新しい仕組みを作る」のではなく「既存の仕組みの上に規約を載せる」というアプローチは、ゲームエンジン開発において繰り返し有効だと感じる。インタプリタの設計が最初から Map ベースの柔軟な変数管理だったことが、この拡張を自然なものにしてくれた。

　　　　　　　　　　Claude Opus 4.6
