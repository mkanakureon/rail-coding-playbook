# KSC コンパイラ Phase 0〜1 改善点

仕様書（03-ts-vm-2d-engine-spec.md）・設計書（04-ts-vm-2d-engine-design.md）と現在の実装（02-ksc-compiler-phase0-1-report.md）を突き合わせ、Phase 2 以降に進む前に対応すべき改善点を洗い出した。

## 改善点一覧（重要度順）

### S: 仕様実現に必須

仕様書の核心機能「停止可能 VM（await による一時停止）」を実現するために不可欠。

#### S-1. `await` キーワード・式が未実装

**影響範囲**: token.ts / lexer.ts / ast.ts / parser.ts

仕様書の最大の特徴「VM 主導型」の根幹。以下の全パターンが現在パースできない。

```typescript
await wait(1.0);
await preload(["bg.city.night"]);
await minigameWait(handle);
await tween(nodeId, { x: 100 }, { durationSec: 0.5 });
const data = await httpGet("...");
```

**必要な変更:**

| ファイル | 変更内容 |
|---------|---------|
| `token.ts` | `TokenType.Await` を追加、`KEYWORDS` に `await` を追加 |
| `ast.ts` | `AwaitExpr` ノードを追加（`{ kind: 'AwaitExpr'; operand: Expression; loc }`） |
| `ast.ts` | `Expression` ユニオンに `AwaitExpr` を追加 |
| `parser.ts` | `parseUnary()` で `await` を処理（単項演算子と同じ優先順位） |
| `ir.ts` | `OpCode.AWAIT` を追加（VM がここで停止し、Promise 完了で再開） |

#### S-2. IR 型の `sourceMap` が JSON シリアライズ不可

**影響範囲**: ir.ts

`IRModule.sourceMap` が `Map<number, number>` だが、`Map` は `JSON.stringify` で空オブジェクトになる。VM の save/load（VMState）と合わせて、シリアライズ可能な形にする必要がある。

```typescript
// 現在
sourceMap: Map<number, number>;

// 改善案
sourceMap: Array<[number, number]>;  // or Record<string, number>
```

### A: 言語仕様の完全性

KSC が TS 風言語として自然に使えるために必要。

#### A-1. `continue` 文が未実装

**影響範囲**: token.ts / ast.ts / parser.ts

`for` / `while` ループで `continue` が使えない。ゲームロジック（弾管理、エンティティ更新等）で頻出するパターン。

```typescript
for (let i = 0; i < enemies.length; i += 1) {
  if (enemies[i].dead) continue;  // ← パースエラー
  enemies[i].update(dt);
}
```

**必要な変更:**

| ファイル | 変更内容 |
|---------|---------|
| `token.ts` | `TokenType.Continue` を追加、`KEYWORDS` に `continue` を追加 |
| `ast.ts` | `ContinueStmt` を追加、`Statement` ユニオンに追加 |
| `parser.ts` | `parseStatement()` に `case TokenType.Continue` を追加 |
| `ir.ts` | `OpCode.CONTINUE` は不要（IR レベルでは `JMP` でループ先頭に戻れる） |

#### A-2. テンプレート文字列の式展開が未パース

**影響範囲**: lexer.ts / parser.ts

現在 `` `EXP +${exp}` `` は `TemplateString` トークンとして生のテキスト `"EXP +${exp}"` が格納されるだけで、`${exp}` 内の式はパースされない。

```typescript
// 仕様で想定される使い方
const msg = `HP: ${player.hp} / ${player.maxHp}`;
#narrator `${hero.name}は剣を構えた`
```

**現在の動作**: `parts: ["HP: ${player.hp} / ${player.maxHp}"]`（文字列1つ）
**期待する動作**: `parts: ["HP: ", player.hp, " / ", player.maxHp]`（文字列と式の交互）

**改善方針**: レキサーレベルでテンプレート文字列を `TemplateHead` / `TemplateMiddle` / `TemplateTail` に分割するか、パーサー側で raw 文字列から `${...}` を二次パースするか。前者が一般的。

#### A-3. アロー関数式が未実装

**影響範囲**: ast.ts / parser.ts

設計書の VMBuiltins 型定義にコールバックパターンがある。将来的に必要になる可能性が高い。

```typescript
const doubled = items.map((x: number) => x * 2);
```

**必要な変更:**

| ファイル | 変更内容 |
|---------|---------|
| `ast.ts` | `ArrowFunctionExpr` を追加（`{ kind: 'ArrowFunctionExpr'; params; body: Expression \| BlockStmt; loc }`） |
| `ast.ts` | `Expression` ユニオンに追加 |
| `parser.ts` | `parsePrimary()` で `(params) => body` パターンを検出 |

**注意**: パーサーでの `(` の解釈が括弧式・関数呼び出し・アロー関数パラメータの3つで曖昧になるため、先読みまたはバックトラックが必要。Phase 2 以降で実装でもよい。

#### A-4. `TokenType.Ternary` が未使用デッドコード

**影響範囲**: token.ts

`Ternary = 'Ternary'` が定義されているが、レキサーもパーサーも使用していない（`QuestionMark` で統一されている）。混乱の元になるため削除すべき。

### B: 堅牢性・エッジケース

現在の実装が壊れるケースの修正。

#### B-1. 未終端ブロックコメントがエラーにならない

**影響範囲**: lexer.ts

```typescript
/* this comment never ends
let x = 42;
```

現在は `skipWhitespace()` の `while (pos < source.length)` がファイル末尾で終了し、エラーなしで後続トークンが消える。`LexerError` を投げるべき。

#### B-2. トレーリングカンマが許容されない

**影響範囲**: parser.ts

以下のコードがパースエラーになる。TS では一般的な書き方。

```typescript
const arr = [1, 2, 3,];           // ← Error: Expected expression
const obj = { x: 1, y: 2, };     // ← Error: Expected identifier
fn(a, b,);                         // ← Error: Expected expression
function f(a: number, b: number,) {} // ← Error: Expected identifier
```

**改善箇所**: 配列リテラル、オブジェクトリテラル、関数引数、関数パラメータの各パース関数で、閉じ括弧の直前にカンマが来た場合にスキップする。

#### B-3. `%=` 複合代入が未実装

**影響範囲**: token.ts / lexer.ts / parser.ts

`+=` `-=` `*=` `/=` は実装されているが `%=` がない。STG のロジック（角度の剰余代入等）で使う可能性がある。

#### B-4. 負の数値リテラルの扱い

**影響範囲**: parser.ts

`-42` は現在 `UnaryExpr(-, NumberLiteral(42))` としてパースされる。これ自体は正しいが、型チェッカーや IR エミッターで定数畳み込みを行わないと、`const NEG = -1;` のような定数が IR 上で2命令（LOAD_CONST + NEG）になる。改善は Phase 3（IR エミッター）で対応可能。

### C: 型定義の整合性

Phase 2（型チェッカー）以降でスムーズに進むための事前修正。

#### C-1. IR に `AWAIT` オペコードがない

**影響範囲**: ir.ts

仕様書の VM は `await` で一時停止する設計だが、`OpCode` に対応する命令がない。

```typescript
// 追加すべき
AWAIT = 'AWAIT',           // スタックトップの Promise を待機、VM 停止
HOST_CALL_ASYNC = 'HOST_CALL_ASYNC',  // 非同期 Host API 呼び出し（結果を await）
```

`HOST_CALL` と `HOST_CALL_ASYNC` を分けるか、全 HOST_CALL が `VMResult` を返して VM 側で判断するかは設計判断。現在の `VMResultType`（CONTINUE / WAIT_TIME / WAIT_INPUT 等）の仕組みと整合させる。

#### C-2. IR に `SET_INDEX` オペコードがない

**影響範囲**: ir.ts

`GET_INDEX` はあるが `SET_INDEX` がない。配列要素への代入ができない。

```typescript
items[0] = "sword";  // SET_INDEX が必要
```

#### C-3. `VMState.callStack.locals` の型

**影響範囲**: ir.ts

`locals: Record<string, unknown>` だが、IR では変数をインデックスで管理する設計（`LOAD_VAR` / `STORE_VAR` の operand は変数名の定数プールインデックス）。`locals` を配列にするか、名前ベースにするかを統一すべき。

#### C-4. `FunctionParam.type` が必須

**影響範囲**: ast.ts

現在 `FunctionParam.type: TypeAnnotation` は non-nullable だが、仕様上は型推論で省略可能な場面もありうる。Phase 2 で型推論を入れるなら `TypeAnnotation | null` にする余地を残すべき。ただし KSC は明示的型付けを重視するなら現状でもよい。

## 改善の優先順位と実装順

```
Phase 1.5（パーサー補完）
  ├ S-1  await キーワード・式の追加        ← 最優先
  ├ A-1  continue 文の追加
  ├ A-4  Ternary デッドコード削除
  ├ B-1  未終端ブロックコメントのエラー
  └ B-2  トレーリングカンマ対応

Phase 2（型チェッカー）と並行
  ├ C-1  IR に AWAIT / HOST_CALL_ASYNC 追加
  ├ C-2  IR に SET_INDEX 追加
  ├ S-2  sourceMap を配列に変更
  └ B-3  %= 複合代入

Phase 3（IR エミッター）以降
  ├ A-2  テンプレート文字列の式展開
  ├ A-3  アロー関数式
  ├ B-4  定数畳み込み（負の数値リテラル）
  └ C-3  VMState.locals の型統一
```

## 影響を受けるテスト

| 改善 | 新規テスト | 既存テスト修正 |
|------|-----------|--------------|
| S-1 await | `await wait(1.0)` パーステスト 5+ 件 | なし |
| A-1 continue | `for + continue` テスト 2 件 | なし |
| A-4 Ternary 削除 | なし | なし（使われていない） |
| B-1 未終端コメント | エラーケーステスト 1 件 | なし |
| B-2 トレーリングカンマ | 配列/オブジェクト/引数/パラメータ 4 件 | なし |
| B-3 %= | 代入演算子テスト 1 件 | `values('= += -= *= /=')` を拡張 |
| C-1 AWAIT | IR 型テスト（Phase 3 で） | なし |
| C-2 SET_INDEX | IR 型テスト（Phase 3 で） | なし |
| S-2 sourceMap | シリアライズテスト 1 件 | なし |

**推定追加テスト**: 14 件以上（Phase 1.5 で 8 件 + Phase 2〜3 で 6 件）
**既存テスト影響**: 最小（B-3 の 1 件のみ修正）

---

## 関連文書

- [02 KSC Compiler Phase 0-1 実装レポート](./02-ksc-compiler-phase0-1-report.md) — 現在の実装状態
- [03 TS-VM 2D Engine 仕様書](./03-ts-vm-2d-engine-spec.md) — await / VM 停止の仕様元
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — 移植に影響する実装課題
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — ir.ts / ast.ts への追加変更（CALL_METHOD, Value 型等）
