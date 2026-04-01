# KSCインタプリタ移行 実装計画書

> 作成日: 2026-02-23
> ステータス: 計画フェーズ
> 入力仕様: `docs/01_in_specs/0221-2/インタプリタ/KSCインタプリタ変更仕様 統合版.md`

---

## 1. 現状分析

### 1.1 既存実装の全体像

現在、スクリプト実行には **2つの経路** が共存している。

```
経路A: KS（TyranoScript風DSL）→ Compiler → Op[] → OpRunner → IOpHandler
経路B: KSC（JSサブセット）→ Interpreter（AST直接実行）→ IEngineAPI
```

| コンポーネント | パッケージ | テスト数 | 状態 |
|--------------|-----------|---------|------|
| Compiler（KS→Op） | `packages/compiler` | 84（1件失敗） | 安定 |
| Interpreter（KSC直接実行） | `packages/interpreter` | 107（2件スキップ） | 安定 |
| OpRunner（Op実行） | `packages/core` | — | 安定 |
| Battle（戦闘シミュレーション） | `packages/battle` | 21 | 全件パス |
| WebEngine（PixiJS実装） | `packages/web` | — | 動作中 |

### 1.2 現在のインタプリタの実行方式

**AST直接実行（ASTインタプリタ）。IR/バイトコードは存在しない。**

```
KSCソース（テキスト）
  ↓ classifyLine()（行分類）
  ↓ パーサー（構造解析）
  ↓ Evaluator（式評価：再帰下降）
  → 直接実行（IEngineAPI呼び出し）
```

- PC（プログラムカウンタ）ベースの逐次実行
- 全メソッドが `async`（Switch移植対応済み）
- GameState: グローバル変数、ローカルスコープスタック、コールスタック
- デバッガ完備（ブレークポイント、変数ウォッチ、トレース）

### 1.3 現在のKSC構文（実装済み）

```javascript
// 変数宣言（型注釈なし）
gold = 100
name = "hiro"

// 関数定義（def構文）
def calcDamage(atk, def) {
  return max(1, atk - def)
}

// セリフブロック
#hero
おはよう。{name}くん。
#

// 制御構文
if (gold >= 100) {
  // ...
} else {
  // ...
}

// 組み込み関数
bg("school_day")
ch("hero", "smile", "center")
battle("boss_01")
```

### 1.4 既知の問題

| 問題 | 重要度 | 詳細 |
|------|--------|------|
| Phase 5 再帰がハングする | 中 | fibonacci再帰でタイムアウト（テストスキップ中） |
| `@bg` 引数なしで例外が出ない | 低 | Compiler統合テスト1件失敗 |
| 型安全性がない | — | 変数に型注釈なし、実行時エラーのみ |
| Switch移植でJSが使えない | — | AST直接実行なのでC++移植にはIR化が必要 |

---

## 2. 目標状態

### 2.1 KSC v0.1 の到達点

```
KSCソース（*.ksc、TS風）
  ↓ パーサー → AST
  ↓ 型チェッカー
  ↓ コードジェネレーター → IR（バイトコード）
  ↓ スタック型VM
  ↓ Host API → Game Systems → Renderer
```

### 2.2 変更のスコープ

| 項目 | 現状 | 目標 |
|------|------|------|
| 構文 | JSサブセット（`gold = 100`） | TS風（`let gold: number = 100`） |
| 型 | なし | 静的型チェック（注釈必須） |
| 実行 | AST直接実行 | IR → スタック型VM |
| 関数 | `def f(a, b) {}` | `function f(a: number, b: number): number {}` |
| モジュール | なし | `import { x } from "module"` |
| セリフ | `#speaker...#` | **維持**（変更なし） |
| 演出コマンド | `bg()`, `ch()` 等 | **維持**（Host API経由） |
| デバッガ | あり | **維持・拡張**（IRレベルでも動作） |

### 2.3 変更しないもの

- **IEngineAPI / IOpHandler**: プラットフォーム抽象層はそのまま
- **WebEngine / WebOpHandler**: PixiJS実装はそのまま
- **Battle System**: 純関数シミュレーションはそのまま
- **KS Compiler**（経路A）: 既存のOp経路は維持（エディタのブロック→KS変換）
- **セリフブロック構文**: `#speaker...#` は継続
- **SaveData Schema**: frozen、変更不可

---

## 3. 実装フェーズ

### Phase 0: 基盤整備（1-2日）

**目的**: 新コンパイラパッケージの作成と既存テストの安定化

| タスク | 詳細 |
|--------|------|
| `packages/ksc-compiler` パッケージ作成 | package.json、tsconfig、vitest設定 |
| 型定義（`packages/ksc-compiler/src/types.ts`） | AST Node型、Token型、IR命令型 |
| 既存Interpreter再帰バグ修正 | Phase 5 fibonacci再帰のハング対策 |
| 既存Compiler `@bg` 引数バリデーション修正 | 統合テスト1件の修正 |

**成果物**: 空のksc-compilerパッケージ + 既存テスト全件パス

---

### Phase 1: レキサー＋パーサー（3-5日）

**目的**: KSC（TS風）ソースをASTに変換

#### 1.1 レキサー（Tokenizer）

```typescript
// トークン種別
enum TokenType {
  // リテラル
  Number, String, TemplateString, Boolean, Null, Undefined,
  // 識別子・キーワード
  Identifier, Let, Const, Function, Return, If, Else, For, While,
  Switch, Case, Default, Break, Import, From, Export, Type,
  // 演算子
  Plus, Minus, Star, Slash, Percent,
  Eq, NotEq, Lt, LtEq, Gt, GtEq, And, Or, Not,
  Assign, PlusAssign, MinusAssign,
  // 区切り
  LParen, RParen, LBrace, RBrace, LBracket, RBracket,
  Comma, Colon, Semicolon, Dot, Arrow,
  // 特殊
  Hash,          // # セリフブロック
  EOF,
}
```

#### 1.2 パーサー（Parser）

```
KSCソース → Token[] → AST

AST Node型:
  Program
  ├─ ImportDecl
  ├─ TypeAlias
  ├─ FunctionDecl（引数型注釈、戻り値型注釈）
  ├─ VariableDecl（let/const + 型注釈）
  ├─ IfStmt / ForStmt / WhileStmt / SwitchStmt
  ├─ ReturnStmt
  ├─ ExpressionStmt
  │   ├─ BinaryExpr / UnaryExpr
  │   ├─ CallExpr
  │   ├─ MemberExpr
  │   ├─ TemplateLiteral
  │   └─ Literal / Identifier
  └─ DialogueBlock（#speaker...# — 既存構文維持）
```

#### 1.3 テスト（目標: 50件以上）

- 各トークン種別の正しい分類
- 基本的な宣言（let/const/function/type）
- 制御構文（if/else/for/while/switch）
- セリフブロックの互換性
- エラーケース（不正トークン、構文エラー）

**成果物**: `KSCソース → AST` が動作、50件以上のテスト

---

### Phase 2: 型チェッカー（3-5日）

**目的**: ASTに対して静的型検査を行う

#### 2.1 型システム

```typescript
type KscType =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'undefined' }
  | { kind: 'void' }
  | { kind: 'array'; element: KscType }
  | { kind: 'object'; fields: Map<string, KscType> }
  | { kind: 'union'; members: KscType[] }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'function'; params: KscType[]; returnType: KscType }
  | { kind: 'LabelRef' }
  | { kind: 'FnRef' }
```

#### 2.2 チェック内容

| チェック | エラーコード |
|---------|------------|
| 型不一致（代入、引数、戻り値） | E1201 |
| string + number 混在禁止 | E1203 |
| import解決失敗 | E2001 |
| 保存不可の値を永続領域へ格納 | E3001 |
| 未定義変数参照 | E1101 |
| 関数の引数数不一致 | E1301 |

#### 2.3 テスト（目標: 40件以上）

- 型一致/不一致の検出
- union型のナローイング（switch/if）
- type alias の解決
- エラーコードの正確性

**成果物**: `AST → 型チェック済みAST` が動作、エラーコード体系確立

---

### Phase 3: IRコードジェネレーター（3-5日）

**目的**: 型チェック済みASTからIR（バイトコード）を生成

#### 3.1 IR命令セット

```typescript
enum OpCode {
  // スタック操作
  LOAD_CONST,    // スタックに定数をプッシュ
  LOAD_VAR,      // 変数値をプッシュ
  STORE_VAR,     // スタックトップを変数に格納
  POP,           // スタックトップを破棄

  // 演算
  ADD, SUB, MUL, DIV, MOD,
  CMP_EQ, CMP_NEQ, CMP_LT, CMP_LTEQ, CMP_GT, CMP_GTEQ,
  AND, OR, NOT,

  // 制御
  JMP,           // 無条件ジャンプ
  JMP_IF_FALSE,  // 条件偽でジャンプ
  CALL,          // 関数呼び出し
  RET,           // 関数リターン
  SWITCH,        // caseテーブルジャンプ

  // オブジェクト/配列
  MAKE_ARRAY,    // N個の値から配列作成
  MAKE_OBJECT,   // N個のkey-value対からオブジェクト作成
  GET_FIELD,     // オブジェクトフィールド取得
  SET_FIELD,     // オブジェクトフィールド設定
  GET_INDEX,     // 配列要素取得

  // Host API
  HOST_CALL,     // Host関数呼び出し（say, bg, ch等）

  // デバッグ
  DEBUG_LINE,    // ソース行番号マッピング
}
```

#### 3.2 IR出力形式

```typescript
interface IRModule {
  constants: unknown[];           // 定数プール
  functions: IRFunction[];        // 関数定義
  entryPoint: number;            // メイン関数インデックス
  sourceMap: Map<number, number>; // IR位置 → ソース行番号
}

interface IRFunction {
  name: string;
  paramCount: number;
  localCount: number;
  instructions: Instruction[];
}

interface Instruction {
  op: OpCode;
  operand?: number;  // 定数プールインデックス or ジャンプ先
}
```

#### 3.3 テスト（目標: 30件以上）

- 算術式 → 正しいスタック操作列
- 制御構文 → 正しいジャンプ命令
- 関数定義 → IRFunction生成
- Host API呼び出し → HOST_CALL命令
- ソースマップの正確性

**成果物**: `型チェック済みAST → IRModule` が動作

---

### Phase 4: スタック型VM（3-5日）

**目的**: IRを実行するVM

#### 4.1 VM構成

```typescript
class KscVM {
  private stack: unknown[] = [];
  private callStack: CallFrame[] = [];
  private pc: number = 0;
  private globals: Map<string, unknown> = new Map();
  private hostAPI: HostAPI;

  async execute(module: IRModule): Promise<void>;
  private async step(): Promise<VMResult>;  // CONTINUE | WAIT_*

  // セーブ/ロード
  serialize(): VMState;
  restore(state: VMState): void;
}
```

#### 4.2 Host API統合

```typescript
interface HostAPI {
  // ノベル命令
  say(char: string, text: string): Promise<VMResult>;
  choice(options: string[]): Promise<number>;
  wait(ms: number): Promise<VMResult>;

  // 演出命令
  bg(image: string, effect?: string): VMResult;
  show(id: string, pos: string): VMResult;
  hide(id: string): VMResult;

  // RPG命令（将来）
  startBattle(id: string): Promise<VMResult>;
  // ...
}
```

#### 4.3 WAIT処理

```
VM実行ループ:
  while (pc < instructions.length) {
    result = step()
    if (result === CONTINUE) continue
    if (result.type === WAIT_*) {
      // 停止。外部からresume()で再開
      return
    }
  }
```

#### 4.4 テスト（目標: 40件以上）

- 基本命令の実行（LOAD/STORE/演算）
- 関数呼び出し/リターン
- WAIT → resume の正しい動作
- VM状態のserialize/restore
- Host API呼び出しの正しいディスパッチ

**成果物**: `IRModule → VM実行` が動作、WAIT/resume対応

---

### Phase 5: 既存システムとの統合（2-3日）

**目的**: 新VMを既存のWebEngine / エディタに接続

| タスク | 詳細 |
|--------|------|
| HostAPI → IEngineAPI アダプター | 新VMのHostAPIを既存IEngineAPIに変換 |
| HostAPI → IOpHandler アダプター | 同上、OpHandler経路も対応 |
| エディタの KSC プレビュー対応 | KSCソース → IR → VM → WebEngine |
| 既存KS経路との共存 | エディタのブロック→KS変換は維持 |

**成果物**: エディタからKSCスクリプトのプレビューが動作

---

### Phase 6: Game Systems統合（将来・RPG対応時）

**目的**: 統合仕様書のGame Systems（Map/Event/Battle/Inventory/Flag）を実装

| サブPhase | 対象 | 前提 |
|-----------|------|------|
| 6.1 | FlagSystem, InventorySystem | Phase 5完了 |
| 6.2 | MapSystem, CharacterController | 6.1完了 |
| 6.3 | EventSystem | 6.2完了 |
| 6.4 | BattleBridge（既存Battle接続） | 6.3完了 |
| 6.5 | Save / Load（VM状態永続化） | 6.4完了 |

**注意**: この順序は統合仕様書で「Claude必須遵守」と定められている。

---

## 4. パッケージ構成

### 4.1 新規パッケージ

```
packages/ksc-compiler/
├── src/
│   ├── lexer.ts          // レキサー
│   ├── parser.ts         // パーサー → AST
│   ├── checker.ts        // 型チェッカー
│   ├── emitter.ts        // IRコードジェネレーター
│   ├── vm.ts             // スタック型VM
│   ├── host.ts           // Host API定義
│   ├── types/
│   │   ├── ast.ts        // AST Node型定義
│   │   ├── ir.ts         // IR命令型定義
│   │   ├── ksc-type.ts   // KSC型システム定義
│   │   └── token.ts      // トークン型定義
│   └── index.ts
├── test/
│   ├── lexer.test.ts
│   ├── parser.test.ts
│   ├── checker.test.ts
│   ├── emitter.test.ts
│   ├── vm.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 4.2 既存パッケージへの影響

| パッケージ | 変更 |
|-----------|------|
| `packages/core` | Host API型定義を追加（or ksc-compilerからexport） |
| `packages/web` | KscVM用アダプター追加（IEngineAPI接続） |
| `packages/interpreter` | **変更なし**（互換維持、段階的に非推奨化） |
| `packages/compiler` | **変更なし**（KS経路は維持） |
| `packages/battle` | **変更なし**（Host API経由で接続） |
| `apps/editor` | KSCプレビュー機能追加 |

---

## 5. 移行戦略

### 5.1 段階的移行（Big Bangは避ける）

```
Phase 0-4: packages/ksc-compiler を独立開発（既存に影響なし）
     ↓
Phase 5: 既存WebEngineに接続（KS経路と並行動作）
     ↓
検証期間: 両経路で同じスクリプトを実行し結果一致を確認
     ↓
安定後: エディタのデフォルトをKSCに切り替え
     ↓
将来: 旧Interpreter非推奨化（急がない）
```

### 5.2 互換性

- **KS経路（Compiler→Op→OpRunner）は維持**
  - エディタのブロック→KS変換は現状のまま
  - 既存プロジェクトのスクリプトは引き続き動作

- **セリフブロック構文は継承**
  - `#speaker...#` はKSCでもそのまま使える
  - レキサーで `#` をトークン化し、パーサーでDialogueBlockノードに変換

### 5.3 テスト戦略

各Phaseで独立してテスト可能な設計にする。

| Phase | テスト種別 | 目標件数 |
|-------|-----------|---------|
| Phase 1 | ユニット（レキサー・パーサー） | 50+ |
| Phase 2 | ユニット（型チェッカー） | 40+ |
| Phase 3 | ユニット（IRジェネレーター） | 30+ |
| Phase 4 | ユニット + 統合（VM実行） | 40+ |
| Phase 5 | E2E（エディタ→プレビュー） | 10+ |
| **合計** | | **170+** |

---

## 6. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 既存スクリプトとの互換性破損 | 高 | KS経路を維持、並行運用で検証 |
| VM実装の複雑化 | 中 | スタック型VM（最もシンプル）を選択 |
| 型チェッカーの複雑化 | 中 | v0.1は型注釈必須（推論なし）で簡素化 |
| セリフブロック構文の統合 | 低 | レキサーレベルで `#` を特別扱い |
| Phase 5再帰バグの影響 | 低 | 新VMでは再帰をコールスタックで正しく管理 |
| パフォーマンス劣化 | 低 | IR化でAST直接実行より高速になるはず |

---

## 7. スケジュール概算

| Phase | 期間 | 累計 | マイルストーン |
|-------|------|------|-------------|
| Phase 0 | 1-2日 | 2日 | パッケージ作成、既存バグ修正 |
| Phase 1 | 3-5日 | 7日 | KSCソース → AST |
| Phase 2 | 3-5日 | 12日 | 静的型チェック動作 |
| Phase 3 | 3-5日 | 17日 | AST → IR生成 |
| Phase 4 | 3-5日 | 22日 | IR → VM実行（単体動作） |
| Phase 5 | 2-3日 | 25日 | エディタ統合・プレビュー動作 |

**Phase 0-5 合計: 約3-4週間**

Phase 6（Game Systems）はRPG対応時に別途着手。

---

## 8. 判断ポイント

各Phase完了時に以下を判断する。

| タイミング | 判断 |
|-----------|------|
| Phase 1完了後 | セリフブロック構文の統合方法を最終決定 |
| Phase 2完了後 | 型システムの複雑さが許容範囲か確認（v0.2機能を前倒すか判断） |
| Phase 3完了後 | IR命令セットの妥当性を確認（不足命令がないか） |
| Phase 4完了後 | VM単体のパフォーマンス計測（AST直接実行との比較） |
| Phase 5完了後 | KSCをデフォルトにする時期を判断 |

---

## 関連文書

- [02 KSC Compiler Phase 0-1 実装レポート](./02-ksc-compiler-phase0-1-report.md) — Phase 0-1 完了報告
- [03 TS-VM 2D Engine 仕様書](./03-ts-vm-2d-engine-spec.md) — VM/エンジン全体仕様
- [04 TS-VM 2D Engine 設計書](./04-ts-vm-2d-engine-design.md) — パッケージ構成・型定義
- [05 KSC Compiler 改善点](./05-ksc-compiler-improvements.md) — Phase 2 以降に必要な改善
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — IAssets/IInput/IHttp 等の移植課題
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — VM/IR 型定義の先行整備
