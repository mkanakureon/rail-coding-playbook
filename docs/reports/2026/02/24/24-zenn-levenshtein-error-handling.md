---
title: "エラーハンドリング設計 — Levenshtein 距離で「もしかして: xxx」を出す"
emoji: "🔍"
type: "tech"
topics: ["claudecode", "typescript", "エラー処理", "アルゴリズム"]
published: false
---

## はじめに

「変数名を typo したら実行時エラーで止まった。でもどの変数を打ち間違えたのか分からない」——これはスクリプト言語を使う誰もが経験する苦痛だ。

kaedevn の KSC インタプリタでは、未定義の変数や関数を参照した際に **Levenshtein 距離** を使って修正候補を提示する。加えて、スタックトレース、エラーコンテキスト（前後のコード表示）、構造化されたエラー型を組み合わせ、「エラーが起きたとき、次のアクションが即座に分かる」体験を目指した。

## エラーの 5+1 種別

KSC のエラーは 6 種別に分類される。

```typescript
enum ErrorType {
  SyntaxError    = "SyntaxError",     // 構文エラー
  ReferenceError = "ReferenceError",  // 参照エラー
  TypeError      = "TypeError",       // 型エラー
  RuntimeError   = "RuntimeError",    // 実行時エラー
  StackOverflow  = "StackOverflow",   // スタックオーバーフロー
  FileNotFound   = "FileNotFound",    // ファイル未検出
}
```

### SyntaxError: 構文が壊れている

| 発生条件 | メッセージ例 |
|---------|------------|
| if 文の構文不正 | `if文の構文が正しくありません` |
| choice の選択肢不正 | `choice構文の選択肢が正しくありません` |
| choice が閉じられていない | `choice構文が閉じられていません` |
| 未知の文字 | `Unknown character at position N: X` |

### ReferenceError: 存在しないものを参照した

これが Levenshtein 距離による修正候補が最も活躍する場面だ。

| 発生条件 | メッセージ例 |
|---------|------------|
| 未定義変数 | `未定義の変数: varName` |
| 未定義関数 | `未定義の関数: funcName` |
| 未定義ラベル | `未定義のラベル: labelName` |

### TypeError: 型の不整合

| 発生条件 | メッセージ例 |
|---------|------------|
| 代入左辺が変数でない | `代入の左辺は変数名である必要があります` |
| 予期しないトークン | `予期しないトークン: X` |
| 括弧不一致 | `閉じ括弧 ')' がありません` |

### RuntimeError: 実行時の不正操作

| 発生条件 | メッセージ例 |
|---------|------------|
| 0 除算 | `0除算エラー` |
| 空スタックで ret() | `ret()が呼ばれましたが、呼び出しスタックが空です` |
| sub 内で return expr | `サブルーチン内では値を返すreturnは使用できません` |
| 引数数不一致 | `関数 'X' の引数の数が一致しません` |
| 表示可能選択肢なし | `表示可能な選択肢がありません` |
| 組み込み関数名の予約 | `'X' は組み込み関数名です` |

### StackOverflow: 再帰の暴走

再帰深度が 16 を超えると発生する。

```
再帰呼び出しの深度が上限（16）を超えました
```

StackOverflow は `suggestions` に修正のヒントを含める特別仕様だ。

```typescript
static createStackOverflowError(
  line: number,
  stack: CallFrame[]
): KNFError {
  return {
    type: ErrorType.StackOverflow,
    message: "スタックオーバーフロー: 再帰の深さが上限を超えました",
    line,
    stack,
    suggestions: [
      "再帰関数の終了条件を確認してください",
      "再帰の深さを減らしてください",
    ],
  };
}
```

## KNFError: 構造化エラー型

すべてのエラーは `KNFError` インターフェースに統一される。

```typescript
interface KNFError {
  type: ErrorType;          // エラー種別
  message: string;          // エラーメッセージ
  line: number;             // エラー発生行（1 始まり）
  column?: number;          // エラー発生列（オプション）
  stack: CallFrame[];       // スタックトレース
  suggestions?: string[];   // 修正候補
  context?: string;         // エラー発生箇所の前後コード
}
```

### なぜ構造化したか

最も素朴なアプローチは `throw new Error("メッセージ")` だ。しかしこれだと、エラーを受け取った側（エディタの UI、デバッグコンソールなど）が情報を取り出すためにメッセージ文字列をパースしなければならない。

構造化エラー型にすることで、以下が可能になる。

- **エラー種別でフィルタリング**: エディタで SyntaxError だけハイライトする
- **行番号で直接ジャンプ**: IDE 的な体験を提供
- **修正候補のクリック適用**: suggestions をボタンとして表示

### CallFrame: スタックトレース

```typescript
interface CallFrame {
  functionName: string;  // 関数名（"<main>" はトップレベル）
  line: number;          // 行番号（1 始まり）
  column?: number;       // 列番号
}
```

スタックトレースは `Interpreter.buildErrorStack()` で構築される。

```typescript
private buildErrorStack(): ErrorCallFrame[] {
  const stack: ErrorCallFrame[] = [];

  // 現在のコンテキストを <main> として追加
  stack.push({
    functionName: "<main>",
    line: this.pc + 1,
  });

  // コールスタックを逆順で追加
  for (let i = this.state.callStack.length - 1; i >= 0; i--) {
    const frame = this.state.callStack[i];
    if (frame.source) {
      stack.push({
        functionName: frame.source.name,
        line: frame.source.line + 1,
      });
    }
  }

  return stack.reverse();
}
```

`<main>` はトップレベルの実行コンテキストを表す。Node.js の `at Object.<anonymous>` に相当する。

## Levenshtein 距離による修正候補

### アルゴリズム

Levenshtein 距離（編集距離）は、一方の文字列を他方に変換するために必要な **挿入・削除・置換の最小回数** を表す。

KSC では動的計画法で計算する。

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // 置換
          matrix[i][j - 1] + 1,       // 挿入
          matrix[i - 1][j] + 1        // 削除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

計算量は O(n * m)（n, m は文字列の長さ）だ。変数名の長さは通常 20 文字以下なので、パフォーマンス上の問題はない。

### フィルタ条件

候補として採用する条件は 2 つだ。

```typescript
static suggestSimilarVariables(
  varName: string,
  availableVars: string[]
): string[] {
  const suggestions: Array<{ name: string; distance: number }> = [];

  for (const available of availableVars) {
    const distance = levenshteinDistance(varName, available);
    // 条件1: 編集距離が 3 以下
    // 条件2: 編集距離が元の文字列長の半分以下
    if (distance <= 3 && distance <= varName.length / 2) {
      suggestions.push({ name: available, distance });
    }
  }

  // 距離が近い順にソート
  suggestions.sort((a, b) => a.distance - b.distance);

  // 上位 3 件を返す
  return suggestions.slice(0, 3).map((s) => s.name);
}
```

**条件 1: 編集距離 3 以下**

編集距離 4 以上の候補は、ほぼ確実に別の変数だ。`score` と `affection` の距離は 8 で、「もしかして affection?」と提案されても混乱するだけだ。

**条件 2: 元の文字列長の半分以下**

短い変数名に対するガードだ。例えば `a` と `bg` の編集距離は 2 だが、1 文字の変数名で距離 2 は「ほぼ別物」だ。半分以下という制約により、短い変数名で誤った候補が出ることを防ぐ。

### 上限 3 件

候補が多すぎると選択に迷う。3 件は「最も可能性の高い候補を素早く確認できる」ちょうどよい数だ。Git の `Did you mean?` も通常 1-3 件の候補を出す。

### 実際の出力例

```
未定義変数: scroe
→ ヒント: 'score' ではありませんか？

未定義変数: afection
→ ヒント: 'affection' ではありませんか？
```

複数候補がある場合：

```
ヒント: もしかして 'score', 'store', 'scare' のいずれかではありませんか？
```

## エラーメッセージのフォーマット

`ErrorHandler.formatError()` は以下の 4 つの要素を組み合わせてエラーメッセージを構成する。

```
[KNF ReferenceError] Line 6: 未定義の変数: scroe
  at <main> (line 6)
  at def mood (line 3)

  4: affection = 0
  5: score = 0
→ 6: scroe += 1
  7: name = "Player"
  8: flag = true

ヒント: 'score' ではありませんか？
```

### 1. ヘッダー

```
[KNF {ErrorType}] Line {line}: {message}
```

`KNF` は KaedevN Framework の略。プレフィックスをつけることで、JavaScript 自体のエラー（`TypeError: Cannot read property...`）と KSC のエラーを視覚的に区別できる。

### 2. スタックトレース

```
  at <main> (line 6)
  at def mood (line 3)
```

Node.js のスタックトレースと同じ形式を採用した。VN スクリプトの開発者も JavaScript/TypeScript の経験がある可能性が高いため、馴染みのある形式がよい。

### 3. コンテキスト

```
  4: affection = 0
  5: score = 0
→ 6: scroe += 1
  7: name = "Player"
  8: flag = true
```

エラー行の前後 2 行を表示する。`→` プレフィックスでエラー行を強調する。

```typescript
static generateContext(
  script: string,
  line: number,
  contextLines: number = 2
): string {
  const lines = script.split("\n");
  const startLine = Math.max(0, line - 1 - contextLines);
  const endLine = Math.min(lines.length, line + contextLines);

  const contextParts: string[] = [];
  for (let i = startLine; i < endLine; i++) {
    const lineNum = i + 1;
    const prefix = lineNum === line ? "→ " : "  ";
    contextParts.push(`${prefix}${lineNum}: ${lines[i] || ""}`);
  }

  return contextParts.join("\n");
}
```

### 4. 修正候補

```
ヒント: 'score' ではありませんか？
```

候補が 1 件の場合と複数件の場合でメッセージを変える。

```typescript
if (error.suggestions.length === 1) {
  lines.push(`ヒント: '${error.suggestions[0]}' ではありませんか？`);
} else {
  lines.push(
    `ヒント: もしかして '${error.suggestions.join("', '")}' のいずれかではありませんか？`
  );
}
```

## ErrorHandler のファクトリメソッド

エラーの生成は `ErrorHandler` のファクトリメソッドに集約している。

| メソッド | 用途 |
|---------|------|
| `createReferenceError` | 未定義変数エラー（修正候補付き） |
| `createFunctionNotFoundError` | 未定義関数エラー（修正候補付き） |
| `createTypeError` | 型エラー |
| `createRuntimeError` | 実行時エラー |
| `createStackOverflowError` | スタックオーバーフロー |

### なぜファクトリメソッドか

エラー生成のロジックを一箇所に集約することで、以下が実現できる。

1. **一貫したフォーマット**: すべてのエラーが同じ構造を持つ
2. **修正候補の自動付与**: `createReferenceError` を呼ぶだけで Levenshtein 距離の計算が走る
3. **コンテキストの自動生成**: スクリプト本文を渡せばエラー箇所の前後が自動で表示される

## Interpreter でのエラー拡張

Evaluator からスローされるエラーは、Interpreter で「拡張」される。

```typescript
private enhanceEvaluatorError(error: unknown): Error {
  const errorMessage = error instanceof Error
    ? error.message
    : String(error);

  // 未定義変数エラーをチェック
  const undefinedVarMatch = errorMessage.match(/未定義の変数: (\w+)/);
  if (undefinedVarMatch) {
    const varName = undefinedVarMatch[1];
    const knfError = ErrorHandler.createReferenceError(
      varName,
      this.pc + 1,
      this.getAvailableVariables(),
      this.buildErrorStack(),
      this.script
    );
    return new Error(ErrorHandler.formatError(knfError));
  }

  return new Error(`[KNF Error] Line ${this.pc + 1}: ${errorMessage}`);
}
```

この仕組みにより、Evaluator は単純な `throw new Error("未定義の変数: xxx")` を投げるだけでよく、修正候補やスタックトレースの付与は Interpreter が担当する。Evaluator の責務を最小限に保つための設計だ。

### 利用可能な変数の収集

修正候補を生成するには、「現在定義されている変数の一覧」が必要だ。

```typescript
private getAvailableVariables(): string[] {
  const vars = new Set<string>();

  // グローバル変数
  for (const key of this.state.variables.keys()) {
    vars.add(key);
  }

  // ローカルスコープの変数
  for (const scope of this.state.localScopes) {
    for (const key of scope.keys()) {
      vars.add(key);
    }
  }

  return Array.from(vars);
}
```

グローバル変数とローカルスコープの両方から候補を収集する。Set を使うことで重複を排除している。

## トレードオフと代替案

### Levenshtein vs Jaro-Winkler

Jaro-Winkler 距離は「先頭が一致する文字列をより類似と判定する」特性がある。変数名の typo は先頭が正しいケースが多い（`scroe` → `score`）ため、Jaro-Winkler の方が適切かもしれない。

しかし Levenshtein を採用した理由は 2 つ。

1. **実装のシンプルさ**: Levenshtein は DP テーブルだけで実装でき、理解しやすい
2. **十分な精度**: フィルタ条件（距離 3 以下、長さの半分以下）を適切に設定すれば、Levenshtein でも実用上十分な候補を出せる

### エラーの国際化

現在のエラーメッセージは日本語で記述されている。将来的に英語対応する場合、メッセージキーを導入してローカライゼーション対応する必要がある。ただし、KSC の主要ユーザーが日本語話者であることを考えると、現時点では日本語直書きで十分だという判断だ。

### 静的解析の可能性

現在の修正候補は**実行時**にのみ提示される。将来的には、Evaluator のパースフェーズ（実行前）で未定義変数を検出し、エディタ上でリアルタイムに波線を引く機能を検討している。その場合、ErrorHandler の仕組みはそのまま流用でき、「実行前チェック」として `getAvailableVariables()` を使った静的走査を追加するだけだ。

## まとめ

KSC のエラーハンドリング設計は、以下の原則に基づいている。

1. **構造化エラー型**: エラーを文字列ではなくオブジェクトとして扱い、プログラマティックにアクセス可能にする
2. **修正候補の自動提示**: Levenshtein 距離で typo を検出し、「次のアクション」を明示する
3. **コンテキスト表示**: エラー箇所の前後コードを表示し、目視での原因特定を支援
4. **責務の分離**: Evaluator はエラーをスロー、Interpreter がエラーを拡張、ErrorHandler がフォーマット

---

エラーハンドリングは「プログラムが正しく動いているときには存在感がない」が、壊れたときに開発体験を左右する重要な領域だ。Levenshtein 距離によるtypo 検出は、実装コストが低い割に効果が大きく、スクリプト言語を設計する人にはぜひ導入を勧めたい。

　　　　　　　　　　Claude Opus 4.6
