# クラス追加準備仕様書

## 背景

KSC 言語にクラス機構を導入する予定だが、本体実装は Switch 移植が見えてからにする。
しかし「後で入れたら破壊的変更になった」を防ぐため、VM/IR/型定義の土台だけを先に整備する必要がある。

元ドキュメント: `docs/01_in_specs/0223/クラスの追加.md` の7項目を、現在のコードベースと照合して具体的な変更内容を定めたもの。

## 現状の実装状態

| 層 | ファイル | 状態 |
|----|---------|------|
| AST | `packages/ksc-compiler/src/types/ast.ts` | MemberExpr / IndexExpr / CallExpr / ObjectLiteral 定義済み |
| IR | `packages/ksc-compiler/src/types/ir.ts` | CALL / GET_FIELD / SET_FIELD / GET_INDEX / MAKE_OBJECT 定義済み |
| VM State | `packages/ksc-compiler/src/types/ir.ts` | VMState に callStack / globals / stack あり |
| Interpreter | `packages/interpreter/src/core/GameState.ts` | 変数は `Map<string, unknown>`。値型は number/string/boolean/null のみ |
| CallFrame | `packages/interpreter/src/types/CallFrame.ts` | returnPc / scopeDepth / kind / source あり |
| Error | `packages/interpreter/src/types/Error.ts` | KNFError + CallFrame（functionName / line / column） |
| CodeGen | 未実装 | AST → IR 変換なし |
| VM実行 | 未実装 | IR を実行するループなし |

**好都合な点**: CodeGen と VM 実行がまだ存在しないので、型定義を拡張しても破壊的変更にならない。

---

## 準備 1: CALL 命令に this を渡せる設計

### 問題

現在の `CALL` は `operand = 引数数` のみ。`obj.method()` を表現できない。
後からメソッド呼び出しを入れると命令セットの破壊的変更になる。

### 現状 (`ir.ts:35`)

```typescript
CALL = 'CALL',  // Call function (operand = arg count)
```

### 変更内容

`ir.ts` の OpCode に `CALL_METHOD` を追加する。

```typescript
// Control flow
CALL = 'CALL',                 // Call function (operand = arg count)
CALL_METHOD = 'CALL_METHOD',   // Call method (operand = arg count, stack: [obj, ...args, methodNameIdx])
RET = 'RET',                   // Return from function
```

**CALL_METHOD のスタックレイアウト**:

```
実行前スタック (top→bottom):
  argN, ..., arg1, obj

operand = N (引数数)
追加operand = メソッド名の定数プール index

実行時:
  1. スタックから N 個の引数を pop
  2. スタックから obj を pop
  3. obj のメソッドテーブルから name を解決
  4. this = obj として関数を呼び出し
  5. 戻り値を push
```

**CallFrame の拡張** (`CallFrame.ts`):

```typescript
export interface CallFrame {
  returnPc: number;
  scopeDepth: number;
  kind: "label" | "function" | "subroutine" | "method";  // "method" 追加
  returnVar?: string;
  thisRef?: unknown;  // メソッド呼び出し時の this 参照
  source?: {
    line: number;
    name: string;
  };
}
```

### 作業

- OpCode に `CALL_METHOD` を定義に追加
- CallFrame に `kind: "method"` と `thisRef` を追加
- 実行ロジックは後回し（VM 実装時に対応）

---

## 準備 2: プロパティアクセスのルール固定

### 問題

`obj.x` の解決規則が未定。後から決めると互換性問題になる。

### 現状

AST に `MemberExpr` (`obj.property`) と `IndexExpr` (`obj[index]`) が定義済み。
IR に `GET_FIELD` / `SET_FIELD` / `GET_INDEX` が定義済み。
**しかし解決規則が文書化されていない。**

### 固定するルール

#### 2-1. ドットアクセス `obj.x`

```
1. obj が null/undefined → TypeError を投げる
2. obj 自身のプロパティに x があれば返す
3. (将来) prototype チェーンを辿る ← クラス導入時に追加
4. 見つからなければ undefined を返す
```

#### 2-2. ブラケットアクセス `obj[expr]`

- **許可する**（配列アクセス `arr[0]` と統一するため必須）
- `expr` は string または number に評価される必要がある
- それ以外は TypeError

#### 2-3. 禁止プロパティ（PF安全性）

以下のプロパティ名へのアクセスは **常にエラー** とする:

```
__proto__
__defineGetter__
__defineSetter__
__lookupGetter__
__lookupSetter__
constructor   ← 直接アクセス禁止（将来 class で制御するまで）
prototype     ← 直接アクセス禁止（同上）
```

実装: `GET_FIELD` / `SET_FIELD` の実行時にプロパティ名をチェック。

#### 2-4. 存在しないプロパティへの代入

```
obj.x = value  →  obj に x を追加する（動的フィールド追加を許可）
```

理由: VN スクリプトでは柔軟性が重要。strict mode は不要。

### 作業

- 上記ルールを `ir.ts` にコメントとして記録
- 禁止プロパティリストを定数として定義

---

## 準備 3: ObjectValue 型の導入

### 問題

現在の値は `unknown` 型で number/string/boolean/null のみ。
クラス導入時に「インスタンスもオブジェクトも区別できない」状態では内部表現が総入れ替えになる。

### 現状 (`GameState.ts:8`)

```typescript
variables: Map<string, unknown> = new Map();
```

### 変更内容

`packages/ksc-compiler/src/types/value.ts` を新規作成:

```typescript
/** KSC ランタイム値型 */
export type Value =
  | number
  | string
  | boolean
  | null
  | KscObject
  | KscArray;

/** オブジェクト値 */
export interface KscObject {
  readonly __ksc_type: 'object';
  fields: Map<string, Value>;
  typeTag: string | null;       // クラス名 ("Player" 等)。今は常に null
  proto: KscObject | null;      // プロトタイプチェーン。今は常に null
}

/** 配列値 */
export interface KscArray {
  readonly __ksc_type: 'array';
  elements: Value[];
}
```

**設計ポイント**:

- `typeTag`: クラス導入時に `"Player"` などのクラス名を入れる。今は `null`
- `proto`: クラス導入時にプロトタイプチェーン用。今は `null`
- `__ksc_type` タグで型判定（TypeScript の discriminated union）
- 型判定ヘルパー (`isKscObject`, `isKscArray`) とファクトリ関数 (`createKscObject`, `createKscArray`) も同梱

### 作業

- `value.ts` を作成
- `VMState` の `stack: unknown[]` → `stack: Value[]` に型を変更
- `GameState` の `Map<string, unknown>` は当面そのまま（KNF インタプリタは既存動作を壊さない）

---

## 準備 4: 環境（Env）とオブジェクト（Obj）の分離設計

### 問題

クラス導入で壊れがちなのが「this がどこから来るか」。
変数スコープ解決とプロパティ解決が混在すると、this バインディングが地獄になる。

### 現状

`GameState` のスコープ解決（`getVar` / `setVar`）はローカルスコープスタック → グローバルの順。
プロパティ解決は未実装なので、**現時点では混在していない**。

### 固定する設計原則

```
変数解決 (Env):
  getVar("x")  →  localScopes[N] → ... → localScopes[0] → globals

プロパティ解決 (Obj):
  GET_FIELD(obj, "x")  →  obj.fields["x"] → obj.proto.fields["x"] → ... → undefined

この2つは完全に別の経路。決して混ぜない。
```

**this の解決ルール**:

```
1. メソッド呼び出し obj.m() → this = obj (CallFrame.thisRef に格納)
2. 通常の関数呼び出し f()  → this = undefined
3. this はローカルスコープに束縛しない（専用フィールドで管理）
```

### 作業

- 上記原則をこの文書で確定（実装は VM 構築時）
- CallFrame に `thisRef` を追加（準備 1 で対応済み）

---

## 準備 5: スタックトレース / ソースマップ土台

### 現状（既にほぼ揃っている）

| 要素 | 状態 | 場所 |
|------|------|------|
| AST の SourceLocation | line / column あり | `ast.ts:4-7` |
| IR の DEBUG_LINE | 定義済み | `ir.ts:50` |
| IRModule の sourceMap | `Map<number, number>` | `ir.ts:75` |
| CallFrame の source | `{ line, name }` あり | `CallFrame.ts:19-22` |
| KNFError の stack | `CallFrame[]` あり | `Error.ts:25-33` |

### 不足点と変更内容

**AST** — `SourceLocation` に `file?` を追加:

```typescript
export interface SourceLocation {
  line: number;
  column: number;
  file?: string;  // import 対応時に使用。単一ファイルなら省略
}
```

**IR** — `IRFunction` に `sourceFile?` を追加:

```typescript
export interface IRFunction {
  name: string;
  paramCount: number;
  localCount: number;
  instructions: Instruction[];
  sourceFile?: string;  // デバッグ用
}
```

---

## 準備 6: 禁止機能リストの確定

### 永久禁止（KSC 言語仕様として）

| 機能 | 理由 |
|------|------|
| `eval(code)` | サンドボックス破壊。Switch PF 審査不可 |
| `Function(...)` | 動的コード生成。eval と同等 |
| 動的 `import()` | ランタイム依存解決不可。Switch で動かない |
| `__proto__` 直接アクセス | プロトタイプ汚染。PF 安全性 |
| `constructor` 直接アクセス | プロトタイプ汚染経路 |
| `prototype` 直接アクセス | プロトタイプ汚染経路 |

### 初期禁止（クラス導入時に再検討）

| 機能 | 理由 | 再検討条件 |
|------|------|-----------|
| `call` / `apply` / `bind` | this 操作は複雑性の元 | クラス設計が固まったら再検討 |
| `delete obj.x` | プロパティ削除はデバッグ困難 | 必要性が出たら再検討 |
| `with` 文 | スコープ汚染 | 永久禁止でもよい |

### 実装方針

禁止チェックは **2箇所** で行う:

1. **パーサー**: `eval`, `Function`, `with`, 動的 `import()` → パース時エラー
2. **VM 実行時**: `__proto__`, `constructor`, `prototype` へのアクセス → ランタイムエラー

---

## 準備 7: 標準ライブラリを std 名前空間に寄せる

### 現状

`IEngineAPI` にホスト関数が集約済み。呼び出しは `HOST_CALL` 命令経由。

### 方針（命名規則の文書化のみ）

将来の `std.time.wait()` 等に備えて、HOST_CALL の命名規則だけ決めておく:

```
HOST_CALL の名前空間規則: カテゴリ.関数名

  dialogue.show     → showDialogue
  graphics.setBg    → setBg
  graphics.showChar → showChar
  audio.playBgm     → playBgm
  time.wait         → wait
  input.choice      → showChoice
  battle.start      → battleStart
```

これにより、将来 `std.audio.playBgm()` のような呼び出しに自然にマッピングできる。

優先度: 低。今は命名規則の文書化のみ。実装は後回し。

---

## 実装優先度まとめ

### 今やる（型定義の拡張のみ・全て破壊的変更なし）

| # | 作業 | 対象ファイル |
|---|------|-------------|
| 1 | `CALL_METHOD` を OpCode に追加 | `packages/ksc-compiler/src/types/ir.ts` |
| 2 | CallFrame に `kind: "method"` と `thisRef` 追加 | `packages/interpreter/src/types/CallFrame.ts` |
| 3 | `value.ts` 新規作成（KscObject / KscArray / Value 型） | `packages/ksc-compiler/src/types/value.ts` |
| 4 | VMState の stack 型を `Value[]` に変更 | `packages/ksc-compiler/src/types/ir.ts` |
| 5 | SourceLocation に `file?` 追加 | `packages/ksc-compiler/src/types/ast.ts` |
| 6 | IRFunction に `sourceFile?` 追加 | `packages/ksc-compiler/src/types/ir.ts` |
| 7 | 禁止プロパティ・禁止機能の定数定義 | `packages/ksc-compiler/src/types/restrictions.ts` |

### 今やらない（クラス本体実装時に対応）

- `extends` / 継承の詳細設計
- ジェネリクス / 型メタプログラミング
- `private` フィールド (`#x`)
- getter / setter
- `super` の仕様
- `call` / `apply` / `bind` の再検討

---

## 関連文書

- [02 KSC Compiler Phase 0-1 実装レポート](./02-ksc-compiler-phase0-1-report.md) — 現在の ir.ts / ast.ts の実装状態
- [03 TS-VM 2D Engine 仕様書](./03-ts-vm-2d-engine-spec.md) — VM/Engine 全体仕様
- [04 TS-VM 2D Engine 設計書](./04-ts-vm-2d-engine-design.md) — IR OpCode / VMState の設計
- [05 KSC Compiler 改善点](./05-ksc-compiler-improvements.md) — Phase 2 以降の改善（AWAIT 等、本準備と並行）
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — 移植課題（禁止機能リストと関連）
