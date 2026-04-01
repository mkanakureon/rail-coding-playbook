---
title: "デバッグシステム設計 — ブレークポイント・変数ウォッチ・ステップ実行"
emoji: "🐛"
type: "tech"
topics: ["claudecode", "typescript", "デバッグ", "設計"]
published: false
---

## はじめに

スクリプト言語を作ったら、次に必要なのはデバッグ手段だ。`console.log` を埋めて動作確認する原始的な方法では、VN のシナリオが長くなるにつれて破綻する。

kaedevn の KSC インタプリタには、以下の 4 つのデバッグ機能を組み込んだ。

1. **ブレークポイント**（条件付き対応）
2. **変数ウォッチ**（変更履歴の記録）
3. **ステップ実行**（over / into / out）
4. **トレースログ**（関数呼び出し・変数変更の自動記録）

この記事では、Debugger クラスの設計とインタプリタとの統合方法を解説する。

## 設計原則: 疎結合

最も重要な設計判断は、**Debugger をインタプリタと疎結合に保つ**ことだ。

```typescript
// Interpreter のコンストラクタ
this.debugger = new Debugger({ enabled: options?.debug ?? false });

// 外部からのアクセス
const dbg = interpreter.getDebugger();
```

Debugger は Interpreter の内部ロジックに介入しない。Interpreter が能動的に Debugger のメソッドを呼び出す形式だ。

### なぜ疎結合か

代替案として、Interpreter のメソッドをすべてオーバーライドする「AOP（アスペクト指向）的なアプローチ」や、Interpreter 内部にデバッグ用のフックポイントを大量に埋め込む方式も検討した。

しかし、これらは以下の問題を持つ。

1. **パフォーマンス**: デバッグ無効時にもフックのオーバーヘッドがかかる
2. **保守性**: Interpreter の変更が Debugger に波及する
3. **テスト**: Debugger 単体のテストが困難になる

疎結合にすることで、`debugger.isEnabled() === false` の場合は早期リターンし、デバッグ無効時のオーバーヘッドをほぼゼロにできる。

## Debugger クラスの内部状態

```typescript
class Debugger {
  private enabled: boolean;                          // デバッグモード
  private watchedVars: Set<string>;                  // 監視対象変数
  private varHistory: Map<string, VariableChange[]>; // 変更履歴
  private breakpoints: Map<number, BreakpointInfo>;  // ブレークポイント
  private paused: boolean;                           // 一時停止中フラグ
  private stepMode: "none"|"over"|"into"|"out";      // ステップモード
  private traceEnabled: boolean;                     // トレースログ
  private traceLog: string[];                        // ログ蓄積
  private eventListeners: Array<(event) => void>;    // リスナー
}
```

コンストラクタでオプションを受け取り、初期状態を設定できる。

```typescript
constructor(options?: {
  enabled?: boolean;
  watchVariables?: string[];
  breakpoints?: number[];
  trace?: boolean;
}) {
  if (options) {
    this.enabled = options.enabled ?? false;
    this.traceEnabled = options.trace ?? false;

    if (options.watchVariables) {
      options.watchVariables.forEach((v) => this.watchVariable(v));
    }
    if (options.breakpoints) {
      options.breakpoints.forEach((line) => this.addBreakpoint(line));
    }
  }
}
```

これにより、テスト時に `new Debugger({ enabled: true, watchVariables: ["score"], breakpoints: [10, 20] })` のように一行で初期化できる。

## ブレークポイント管理

### BreakpointInfo

```typescript
interface BreakpointInfo {
  line: number;        // 行番号（1 始まり）
  condition?: string;  // 条件式（オプション）
  enabled: boolean;    // 有効/無効
}
```

条件付きブレークポイントは、VN スクリプトのデバッグで特に有用だ。例えば「好感度が 5 以上になったときだけ止めたい」というケースに対応できる。

```typescript
dbg.addBreakpoint(10);                    // 行 10 で無条件停止
dbg.addBreakpoint(20, "score > 50");      // 行 20 で score > 50 のときだけ停止
```

### ブレーク判定フロー

Interpreter の `step()` メソッドの冒頭で、ブレーク判定が行われる。

```typescript
private async step(): Promise<void> {
  if (this.debugger.isEnabled()) {
    const shouldBreak = await this.debugger.shouldBreak(
      this.pc + 1,
      this.state,
      async (condition, state) => {
        return await this.evaluator.evaluateCondition(condition, state);
      }
    );

    if (shouldBreak) {
      this.debugger.pause();
    }
  }

  // ... 通常の実行処理
}
```

Debugger 側の判定ロジックは以下の通り。

```typescript
async shouldBreak(
  line: number,
  state: GameState,
  evaluateCondition?: (condition: string, state: GameState) => Promise<boolean>
): Promise<boolean> {
  if (!this.enabled) return false;

  const bp = this.breakpoints.get(line);
  if (!bp || !bp.enabled) return false;

  // 条件付きブレークポイントの評価
  if (bp.condition && evaluateCondition) {
    try {
      return await evaluateCondition(bp.condition, state);
    } catch (error) {
      // 条件評価に失敗 → 安全側に倒してブレーク
      return true;
    }
  }

  return true;
}
```

### 条件評価のエラー処理

条件式の評価に失敗した場合は **安全側に倒してブレーク** する。

なぜか。条件式に typo がある場合（例: `scroe > 50`）、評価エラーを無視して実行を続けると、開発者は「ブレークポイントが効かない」と勘違いする。むしろ止めてしまった方が「条件式がおかしい」と気づきやすい。

### ブレークポイントの有効/無効切り替え

ブレークポイントを削除せずに無効化できる。

```typescript
toggleBreakpoint(line: number, enabled: boolean): void {
  const bp = this.breakpoints.get(line);
  if (bp) {
    bp.enabled = enabled;
  }
}
```

これは IDE のブレークポイント管理と同じ UX だ。一時的に無効にしたいが、再設定するのは面倒——というケースに対応する。

## 変数ウォッチ

### VariableChange

```typescript
interface VariableChange {
  line: number;      // 変更発生行
  oldValue: unknown; // 変更前の値
  newValue: unknown; // 変更後の値
  timestamp: number; // タイムスタンプ
}
```

### 記録フロー

Interpreter の代入処理で、変数の変更を Debugger に通知する。

```typescript
// handleExpression() 内
const varMatch = line.match(/^(\w+)\s*[+\-*/]?=/);
const varName = varMatch ? varMatch[1] : null;
const oldValue = varName && this.state.hasVar(varName)
  ? this.state.getVar(varName)
  : undefined;

await this.evaluator.executeAssignment(line, this.state);

// 変更を記録
if (varName && this.debugger.isEnabled()) {
  const newValue = this.state.getVar(varName);
  this.debugger.recordVariableChange(
    varName, oldValue, newValue, this.pc + 1
  );
}
```

Debugger 側では、**監視対象の変数のみ**を記録する。

```typescript
recordVariableChange(
  name: string,
  oldValue: unknown,
  newValue: unknown,
  line: number
): void {
  if (!this.enabled || !this.watchedVars.has(name)) return;

  const change: VariableChange = {
    line, oldValue, newValue, timestamp: Date.now(),
  };

  const history = this.varHistory.get(name) || [];
  history.push(change);
  this.varHistory.set(name, history);

  // イベント発火
  this.emitEvent({
    type: DebugEventType.VariableChanged,
    line,
    data: { name, oldValue, newValue },
  });

  // トレースログ
  if (this.traceEnabled) {
    this.addTrace(
      `[Line ${line}] ${name} changed: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`
    );
  }
}
```

### なぜ全変数ではなく監視対象のみか

VN スクリプトでは変数の更新が非常に頻繁に行われる（好感度、フラグ、カウンターなど）。全変数を記録すると、メモリと CPU の両方で無視できないコストが発生する。

必要な変数だけを明示的にウォッチする方式は、IDE のウォッチ式と同じ発想だ。

```typescript
dbg.watchVariable("affection");
dbg.watchVariable("flag_library");

// 実行後
const history = dbg.getVariableHistory("affection");
// => [
//   { line: 5, oldValue: 0, newValue: 1, timestamp: ... },
//   { line: 12, oldValue: 1, newValue: 3, timestamp: ... },
// ]
```

## ステップ実行

### ステップモード

4 つのモードを定義している。

| モード | 動作 |
|--------|------|
| `"none"` | 通常実行（ブレークポイントまで） |
| `"over"` | 次の行で停止（関数内には入らない） |
| `"into"` | 次の行で停止（関数内にも入る） |
| `"out"` | 現在の関数を抜けるまで実行 |

### 制御 API

```typescript
pause(): void {
  this.paused = true;
}

continue(): void {
  this.paused = false;
  this.stepMode = "none";
}

stepOver(): void {
  this.paused = false;
  this.stepMode = "over";
}

stepInto(): void {
  this.paused = false;
  this.stepMode = "into";
}

stepOut(): void {
  this.paused = false;
  this.stepMode = "out";
}
```

`continue()` は `stepMode` を `"none"` にリセットする点に注意。これにより、ステップ実行から通常実行に戻れる。

### ステップ完了通知

ステップ実行が完了した際に Interpreter から呼ばれる。

```typescript
notifyStepComplete(line: number): void {
  if (this.stepMode !== "none") {
    this.paused = true;
    this.stepMode = "none";

    this.emitEvent({
      type: DebugEventType.StepComplete,
      line,
    });
  }
}
```

ステップモードが "none" でなければ、一時停止してイベントを発火する。外部のデバッグ UI はこのイベントを監視して、「次の行に進みました」というフィードバックを表示できる。

## イベントシステム

### イベント型

```typescript
enum DebugEventType {
  VariableChanged = "variable_changed",
  Breakpoint      = "breakpoint",
  StepComplete    = "step_complete",
  FunctionCall    = "function_call",
  FunctionReturn  = "function_return",
}

interface DebugEvent {
  type: DebugEventType;
  line: number;
  data?: unknown;
}
```

### イベントフロー

各イベントは以下のタイミングで発火される。

| イベント | タイミング | data の内容 |
|---------|-----------|------------|
| `VariableChanged` | 監視対象変数の変更時 | `{ name, oldValue, newValue }` |
| `Breakpoint` | ブレークポイントヒット時 | なし |
| `StepComplete` | ステップ実行完了時 | なし |
| `FunctionCall` | 関数呼び出し時 | `{ name, args }` |
| `FunctionReturn` | 関数リターン時 | `{ name, returnValue }` |

### リスナー管理

```typescript
addEventListener(listener: (event: DebugEvent) => void): void {
  this.eventListeners.push(listener);
}

removeEventListener(listener: (event: DebugEvent) => void): void {
  const index = this.eventListeners.indexOf(listener);
  if (index !== -1) {
    this.eventListeners.splice(index, 1);
  }
}
```

### エラー隔離

リスナー内で例外が発生した場合、他のリスナーの実行は**継続する**。

```typescript
private emitEvent(event: DebugEvent): void {
  for (const listener of this.eventListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("デバッグイベントリスナーでエラー:", error);
    }
  }
}
```

これは DOM のイベントモデルと同じ設計だ。1 つのリスナーのバグで他のリスナーが動かなくなるのは避けたい。

## トレースログ

### 自動記録

トレース有効時、以下が自動で記録される。

- **変数変更**: `[Line N] varName changed: oldValue → newValue`
- **関数呼び出し**: `[Line N] call funcName(arg1, arg2)`
- **関数リターン**: `[Line N] funcName() returned value`

```typescript
traceFunctionCall(name: string, args: unknown[], line: number): void {
  if (this.traceEnabled) {
    const argsStr = args.map((a) => JSON.stringify(a)).join(", ");
    this.addTrace(`[Line ${line}] call ${name}(${argsStr})`);
  }

  this.emitEvent({
    type: DebugEventType.FunctionCall,
    line,
    data: { name, args },
  });
}
```

### ISO タイムスタンプ

各ログエントリには ISO 8601 形式のタイムスタンプが付与される。

```typescript
addTrace(message: string): void {
  if (this.traceEnabled) {
    this.traceLog.push(`[${new Date().toISOString()}] ${message}`);
  }
}
```

出力例：

```
[2026-02-09T12:00:00.000Z] [Line 5] score changed: 0 → 10
[2026-02-09T12:00:00.001Z] [Line 8] call mood(10)
[2026-02-09T12:00:00.002Z] [Line 8] mood() returned "happy"
```

タイムスタンプにより、パフォーマンスのボトルネック（関数呼び出しに時間がかかっている箇所）も特定できる。

## 使用パターン

実際の使用例を示す。

```typescript
const interpreter = new Interpreter(engine, { debug: true });
const dbg = interpreter.getDebugger();

// ブレークポイント
dbg.addBreakpoint(10);
dbg.addBreakpoint(20, "score > 50");

// 変数ウォッチ
dbg.watchVariable("score");
dbg.watchVariable("health");

// トレース有効化
dbg.enableTrace();

// イベント監視
dbg.addEventListener((event) => {
  console.log(`[Debug] ${event.type} at line ${event.line}`);
});

// 実行
await interpreter.run(script);

// 結果取得
const history = dbg.getVariableHistory("score");
const trace = dbg.getTraceLog();
```

### リセット

`reset()` で変更履歴、トレースログ、一時停止状態をクリアする。ブレークポイントと監視変数は**保持される**。

```typescript
reset(): void {
  this.varHistory.clear();
  this.traceLog = [];
  this.paused = false;
  this.stepMode = "none";
}
```

この設計は「繰り返しテスト」のユースケースに対応している。スクリプトを修正して再実行するとき、ブレークポイントをいちいち再設定したくない。

## トレードオフ

### デバッグ有効時のパフォーマンス

`step()` の先頭で `debugger.isEnabled()` をチェックするため、デバッグ有効時は 1 行ごとにオーバーヘッドが発生する。しかし KSC は 1 秒間に数千行を処理するような高速実行を求められる言語ではない（VN はユーザーの読む速度がボトルネック）。実測でもデバッグ有効時の速度低下は体感できなかった。

### ステップ実行の外部制御

現在のステップ実行は `pause()` / `continue()` / `stepOver()` の API を提供しているが、実際に「停止してユーザーの入力を待つ」ためのイベントループは外部に委ねている。これは、Debugger がプラットフォーム固有の UI（ブラウザの DevTools 的なもの、CLI のプロンプトなど）に依存しないための設計だ。

将来的にエディタにデバッグ UI を組み込む際は、`DebugEvent` を React の state にバインドするだけで済む。

### 関数呼び出しトレースの粒度

現在は `def`/`sub` の呼び出しのみトレースしており、組み込み関数（`bg()`, `ch()` など）はトレース対象外だ。組み込み関数もトレースすると情報量が多くなりすぎるため、あえて除外している。必要に応じて `executeBuiltin()` 内にトレースポイントを追加できる拡張ポイントは残してある。

## まとめ

KSC のデバッグシステムは、以下の原則で設計した。

1. **疎結合**: Debugger は Interpreter の内部ロジックに介入しない
2. **オプトイン**: デバッグ無効時のオーバーヘッドはほぼゼロ
3. **イベント駆動**: 外部ツールとの連携はイベントリスナーで行う
4. **安全側に倒す**: 条件評価エラー時はブレーク、リスナーエラーは隔離

---

デバッグシステムは、インタプリタ本体とは独立した「観測レイヤー」として設計した。Interpreter の step() メソッドが Debugger に通知を送り、Debugger がイベントを発火するという一方向の情報フローを徹底することで、デバッグ機能の追加がインタプリタの安定性に影響しない構造を実現できた。

　　　　　　　　　　Claude Opus 4.6
