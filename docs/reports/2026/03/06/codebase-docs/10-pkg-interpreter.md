# packages/interpreter - スクリプトインタプリタ

## 概要

KNF (.ksc) スクリプトの純 JavaScript インタプリタ。VM、デバッグモード（ブレークポイント、変数ウォッチ、トレースログ）、エラーハンドリング（Levenshtein 距離によるコマンド候補提示）を備える。

## ディレクトリ構成

```
packages/interpreter/
├── src/
│   ├── core/
│   │   ├── Interpreter.ts      # メインインタプリタ
│   │   ├── Parser.ts           # KNF パーサー
│   │   ├── Tokenizer.ts        # 字句解析
│   │   ├── Evaluator.ts        # 式評価
│   │   └── GameState.ts        # VM 状態管理
│   ├── engine/
│   │   ├── IEngineAPI.ts       # エンジンインターフェース
│   │   ├── ConsoleEngine.ts    # コンソール実装
│   │   └── TestEngine.ts       # テストハーネス
│   ├── debug/
│   │   ├── Debugger.ts         # ブレークポイント、変数ウォッチ
│   │   └── ErrorHandler.ts     # エラーレポート + コマンド候補
│   ├── types/
│   │   ├── Token.ts
│   │   ├── LineType.ts
│   │   ├── CallFrame.ts
│   │   ├── Choice.ts
│   │   └── Error.ts
│   └── index.ts                # 公開 API
├── test/                       # 15+ テストファイル
│   ├── Interpreter.test.ts
│   ├── Parser.test.ts
│   ├── Integration.test.ts
│   ├── Phase2-6.test.ts        # 多段階テスト
│   ├── ErrorHandling.test.ts
│   ├── Debug.test.ts
│   └── demo.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| Interpreter.ts | メイン実行エンジン。パース → 評価 → エンジン API 呼び出し |
| Parser.ts | KNF テキスト・コマンド・制御フローをパース |
| Tokenizer.ts | 字句解析（トークン列生成） |
| Evaluator.ts | 式・条件の評価（算術、比較、論理演算） |
| GameState.ts | ランタイム状態（変数、コールスタック、プログラムカウンタ） |
| Debugger.ts | デバッグ機能（ブレークポイント、変数インスペクション、トレース） |
| ErrorHandler.ts | エラー報告（Levenshtein 距離でコマンド候補提示、スタックトレース） |

## アーキテクチャ

```
[KNF スクリプト]
    ↓
[Tokenizer] → Token[]
    ↓
[Parser] → 行データ (テキスト/コマンド/制御フロー)
    ↓
[Interpreter]
    ├── [Evaluator] → 式評価
    ├── [GameState] → 状態管理
    ├── [Debugger] → デバッグ制御
    └── [IEngineAPI] → エンジン操作
```

## IEngineAPI インターフェース

```typescript
interface IEngineAPI {
  showText(speaker: string, body: string): Promise<void>;
  showChoice(options: Choice[]): Promise<number>;
  setBg(assetId: string): void;
  showCh(characterId: string, expressionId: string, position: string): void;
  hideCh(characterId: string): void;
  playBgm(assetId: string): void;
  playSe(assetId: string): void;
  wait(mode: string, ms?: number): Promise<void>;
}
```

### 実装

| 実装 | 用途 |
|------|------|
| ConsoleEngine | コンソール出力デモ |
| TestEngine | ユニットテスト用（操作記録） |
| WebOpHandler | Web エンジン（packages/web） |

## デバッグモード

- **ブレークポイント**: 行番号指定で実行停止
- **変数ウォッチ**: 実行中の変数値をリアルタイム表示
- **トレースログ**: 実行された行をすべてログ出力
- **ステップ実行**: 1行ずつ実行

## エラーハンドリング

- **Levenshtein 距離**: 不明なコマンドに対し、類似コマンドを候補提示
- **スタックトレース**: コールスタック付きエラーメッセージ
- **エラーコンテキスト**: エラー発生行の前後を表示

## 依存関係

- **内部**: なし
- **外部**: なし
- **被依存**: なし（独立モジュール、将来的に web から参照予定）

## テスト

- **107 テスト passing** (Phase 7-3 時点)
- Interpreter.test.ts — 基本実行テスト
- Parser.test.ts — パース結果検証
- Integration.test.ts — 統合テスト
- ErrorHandling.test.ts — エラーケース
- Debug.test.ts — デバッグモード

### 既知の制限

- Phase 5 の再帰テスト（フィボナッチ）がハング
- 大規模ループテストがタイムアウト
