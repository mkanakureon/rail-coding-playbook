# C++ 版インタプリタ：型マッピングとテスト設計

**作成日**: 2026-02-26
**対象**: インタプリタ移植担当
**参照**: `packages/interpreter/src/core/Interpreter.ts`

## 1. 型マッピング表

| TypeScript 型 | C++ 移行先 | 理由 |
| :--- | :--- | :--- |
| `string | number | boolean` | `std::variant<std::string, double, bool>` | ゲーム変数の多態性維持 |
| `Map<string, any>` | `std::unordered_map<std::string, Variable>` | 高速な変数検索 |
| `Array<{...}>` (Stack) | `std::vector<CallFrame>` | コールスタック管理 |
| `RegExp` | `std::regex` | パースロジックの共通化 |

## 2. 実装すべきテストケース (Test Matrix)

### 2.1 パースの検証 (`ParserTest.cpp`)
- `"#hero
「こんにちは」
#"` → `DialogueBlock { speaker: "hero", text: "「こんにちは」" }`
- `"jump(next_label)"` → `Command { name: "jump", args: ["next_label"] }`

### 2.2 式評価の検証 (`EvaluatorTest.cpp`)
- `"1 + 2 * 3"` → `7.0`
- `"trust >= 10"` (trust=15) → `true`
- 未定義変数へのアクセス → `std::runtime_error` のスロー

### 2.3 制御フローの検証 (`FlowTest.cpp`)
- `call` -> `ret` で PC が正しく戻るか。
- `if` ブロックの条件が偽のとき、中身が正しくスキップされるか。

## 3. テストデータの共有
`projects/demo/settings/plot.md` から生成された JSON を、C++ 版のテスト入力としても使用し、**TS 版と C++ 版で同一の実行結果が得られること**を自動検証します（黄金の基準テスト）。

---
*Created by Gemini CLI Systems Engineer.*
