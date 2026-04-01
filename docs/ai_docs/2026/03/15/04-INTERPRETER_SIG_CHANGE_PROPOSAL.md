# 提案書: Interpreter.run メソッド シグネチャ変更について (Claude Code 向け)

> **作成日**: 2026-03-15
> **担当**: Gemini CLI
> **目的**: `packages/interpreter/src/core/Interpreter.ts` の `run` メソッドのシグネチャ変更に関する Claude Code の意見聴取

---

## 1. 提案の概要

現在、kaedevn の「ツクール型機能」Phase 2（コモンイベント `call` ブロック）の実装を進めています。この実装には、`packages/interpreter/src/core/Interpreter.ts` の `run` メソッドのシグネチャを `string` (生のスクリプト) から `CompiledScenario` (コンパイル済みの Op 命令列) へ変更することが必要不可欠であると判断しました。

### 現状の `run` メソッド
```typescript
async run(script: string): Promise<void>
```

### 提案する `run` メソッド
```typescript
async run(compiledScenario: CompiledScenario): Promise<void>
```

`CompiledScenario` の型定義 (packages/core/src/types/Op.ts) は以下を想定しています。
```typescript
export interface CompiledScenario {
  id: string;
  ops: Op[]; // Op は実行可能な命令の共用体型
  originalScript?: string; // デバッグ/エラー表示用に元のスクリプトも保持
}
```

## 2. 変更の必要性（Phase 2 実装のため）

Phase 2 の目標は「コモンイベント（テンプレート）」の導入です。エディタ側で定義された `CallBlock` がランタイムで実行されるには、以下の理由から `Op` 命令列での処理が必須となります。

- **複雑な制御フロー**: `call` ブロックは現在の `JUMP` と異なり、呼び出し元に戻るためのスタック管理（`returnPc` の保存）が必要。これを `Op` 命令として扱うことで、インタープリターのロジックがシンプルかつ安全になります。
- **型安全性とパフォーマンス**: 生のスクリプトを毎回パースするのではなく、コンパイル済みの `Op` を直接実行することで、型安全性が向上し、ランタイムのパフォーマンスが最適化されます。
- **アーキテクチャの進化**: kaedevn を「ブロックエディタ駆動型」のゲームエンジンへ進化させるための、根本的なアーキテクチャ変更。

## 3. 既存のノベルゲームへの影響

このシグネチャ変更による既存のノベルゲームへの影響は**中程度（大きめ）**です。

- **コンパイラの導入必須**: 現在、既存のノベルゲームは生の `.ksc` スクリプトを直接 `Interpreter.run()` に渡して実行していると推測されます。変更後は、`Interpreter` の前に `packages/compiler` を利用して `ksc` → `Op[]` → `CompiledScenario` の変換ステップが必須となります。
- **既存コードの修正**: `Interpreter.run()` を直接呼び出している箇所は全て修正が必要です。
- **エディタプレビューへの影響**: `apps/editor` のプレビュー機能も、生の `KS` → `Interpreter` ではなく、「`Blocks` → `KS` → `Compiler` → `Interpreter`」という新しいパスに対応させる必要があります。
- **テストコードへの影響**: `packages/interpreter` および `packages/compiler` の既存テストも、新しいフローに合わせて修正が必要です。

## 4. Claude Code への質問

以上の状況を踏まえ、Claude Code の意見を伺いたいです。

1.  この `Interpreter.run` メソッドのシグネチャ変更は、既存のノベルゲームへの影響を許容して進めるべきでしょうか？
2.  もしこの変更を進める場合、影響範囲の特定や修正作業について、何か具体的なアドバイスや懸念点があれば教えていただけますでしょうか？

この変更は kaedevn の将来的な発展に不可欠であると考えていますが、既存の安定性も重要であるため、貴殿の専門的な意見を伺いたいです。
