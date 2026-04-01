# パイプライン断絶解消 実装計画書

**日付:** 2026-03-02
**ステータス:** 未着手
**関連:** `35-PIPELINE_DISCONNECTION_REALITY.md`

---

## 1. 背景・目的

パイプライン断絶報告書 (`35-PIPELINE_DISCONNECTION_REALITY.md`) で指摘された通り、Core 層（OpRunner / IOpHandler）に実装済みのコマンドが Interpreter 層（IEngineAPI / Interpreter.executeBuiltin）に反映されていない。

`.ks` スクリプトから `@overlay` 等を呼んでも `console.warn("未実装のコマンド")` で無視される状態。

**調査結果: 欠落コマンド一覧（10件）**

| # | コマンド | OpRunner | IEngineAPI | Interpreter | 用途 |
|---|---------|----------|------------|-------------|------|
| 1 | `overlay` | OVERLAY_SET | 未定義 | 未実装 | オーバーレイ表示 |
| 2 | `overlay_hide` | OVERLAY_HIDE | 未定義 | 未実装 | オーバーレイ非表示 |
| 3 | `flash` | FLASH | 未定義 | 未実装 | 画面フラッシュ |
| 4 | `fade_black` | FADE_BLACK | 未定義 | 未実装 | 暗転 |
| 5 | `fade_white` | FADE_WHITE | 未定義 | 未実装 | 白転 |
| 6 | `black_in` | BLACK_IN | 未定義 | 未実装 | 暗転から復帰 |
| 7 | `white_in` | WHITE_IN | 未定義 | 未実装 | 白転から復帰 |
| 8 | `bg_clear` | BG_CLEAR | 未定義 | 未実装 | 背景消去 |
| 9 | `ch_move` | CH_MOVE | 定義済み | 未実装 | キャラ移動 |
| 10 | `wait_voice_end` | WAIT_VOICE_END | 未定義 | 未実装 | ボイス終了待ち |

---

## 2. 実装計画

### Phase F-1: IEngineAPI インターフェース拡張

`packages/interpreter/src/engine/IEngineAPI.ts` に不足メソッドを追加。
既存メソッド `shake?()` / `screenFilter?()` と同様に optional (`?`) で定義する（後方互換性の維持）。

| メソッド | シグネチャ | 備考 |
|---------|----------|------|
| `overlaySet?` | `(id: string, fadeMs?: number): Promise<void>` | |
| `overlayHide?` | `(id?: string, fadeMs?: number): Promise<void>` | id 省略=全非表示 |
| `flash?` | `(durationMs?: number): Promise<void>` | |
| `fadeBlack?` | `(durationMs?: number): Promise<void>` | |
| `fadeWhite?` | `(durationMs?: number): Promise<void>` | |
| `blackIn?` | `(durationMs?: number): Promise<void>` | |
| `whiteIn?` | `(durationMs?: number): Promise<void>` | |
| `clearBg?` | `(fadeMs?: number): Promise<void>` | |
| `waitVoiceEnd?` | `(): Promise<void>` | |

**注:** `ch_move` は既に `moveChar()` として定義済みだが Interpreter 未実装。

```typescript
// ========== オーバーレイ ==========
overlaySet?(id: string, fadeMs?: number): Promise<void>;
overlayHide?(id?: string, fadeMs?: number): Promise<void>;

// ========== 画面演出（追加） ==========
flash?(durationMs?: number): Promise<void>;
fadeBlack?(durationMs?: number): Promise<void>;
fadeWhite?(durationMs?: number): Promise<void>;
blackIn?(durationMs?: number): Promise<void>;
whiteIn?(durationMs?: number): Promise<void>;

// ========== 背景（追加） ==========
clearBg?(fadeMs?: number): Promise<void>;

// ========== ボイス（追加） ==========
waitVoiceEnd?(): Promise<void>;
```

### Phase F-2: Interpreter.executeBuiltin 拡張

`packages/interpreter/src/core/Interpreter.ts` の `executeBuiltin` switch 文に 10 件の case を追加。
既存 `filter` / `shake` のパターン（optional chaining `?.`）に合わせる。

```typescript
// オーバーレイ
case "overlay":
  if (this.engine.overlaySet) {
    await this.engine.overlaySet(
      String(args[0]),
      args[1] !== undefined ? Number(args[1]) : undefined
    );
  }
  return true;

case "overlay_hide":
  if (this.engine.overlayHide) {
    await this.engine.overlayHide(
      args[0] !== undefined ? String(args[0]) : undefined,
      args[1] !== undefined ? Number(args[1]) : undefined
    );
  }
  return true;

// 画面演出
case "flash":
  if (this.engine.flash) {
    await this.engine.flash(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

case "fade_black":
  if (this.engine.fadeBlack) {
    await this.engine.fadeBlack(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

case "fade_white":
  if (this.engine.fadeWhite) {
    await this.engine.fadeWhite(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

case "black_in":
  if (this.engine.blackIn) {
    await this.engine.blackIn(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

case "white_in":
  if (this.engine.whiteIn) {
    await this.engine.whiteIn(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

// 背景消去
case "bg_clear":
  if (this.engine.clearBg) {
    await this.engine.clearBg(
      args[0] !== undefined ? Number(args[0]) : undefined
    );
  }
  return true;

// キャラ移動（IEngineAPI に moveChar は既存）
case "ch_move":
  await this.engine.moveChar(
    String(args[0]),
    String(args[1]),
    args[2] !== undefined ? Number(args[2]) : 500
  );
  return true;

// ボイス終了待ち
case "wait_voice_end":
  if (this.engine.waitVoiceEnd) {
    await this.engine.waitVoiceEnd();
  }
  return true;
```

### Phase F-3: TestEngine 実装追加

`packages/interpreter/src/engine/TestEngine.ts` に不足メソッドを追加。
テスト用なので状態を記録し、検証可能にする。

```typescript
// 状態フィールド追加
overlays: Map<string, boolean> = new Map();
screenEffects: string[] = [];

// メソッド追加
async overlaySet(id: string, fadeMs?: number): Promise<void> {
  this.overlays.set(id, true);
}

async overlayHide(id?: string, fadeMs?: number): Promise<void> {
  if (id) { this.overlays.delete(id); }
  else { this.overlays.clear(); }
}

async flash(durationMs?: number): Promise<void> {
  this.screenEffects.push('flash');
}

async fadeBlack(durationMs?: number): Promise<void> {
  this.screenEffects.push('fade_black');
}

async fadeWhite(durationMs?: number): Promise<void> {
  this.screenEffects.push('fade_white');
}

async blackIn(durationMs?: number): Promise<void> {
  this.screenEffects.push('black_in');
}

async whiteIn(durationMs?: number): Promise<void> {
  this.screenEffects.push('white_in');
}

async clearBg(fadeMs?: number): Promise<void> {
  this.currentBg = null;
}

async waitVoiceEnd(): Promise<void> {}
```

`reset()` にも `this.overlays.clear()` / `this.screenEffects = []` を追加。

### Phase F-4: ConsoleEngine 実装追加

`packages/interpreter/src/engine/ConsoleEngine.ts` に不足メソッドを追加。
コンソール出力のみ。

```typescript
async overlaySet(id: string, fadeMs?: number): Promise<void> {
  const suffix = fadeMs !== undefined ? ` ${fadeMs}ms` : "";
  this.out(`[オーバーレイ] ${id}${suffix}`);
}

async overlayHide(id?: string, fadeMs?: number): Promise<void> {
  const target = id ?? "全て";
  this.out(`[オーバーレイ非表示] ${target}`);
}

async flash(durationMs?: number): Promise<void> {
  this.out(`[フラッシュ] ${durationMs ?? 500}ms`);
}

async fadeBlack(durationMs?: number): Promise<void> {
  this.out(`[暗転] ${durationMs ?? 500}ms`);
}

async fadeWhite(durationMs?: number): Promise<void> {
  this.out(`[白転] ${durationMs ?? 500}ms`);
}

async blackIn(durationMs?: number): Promise<void> {
  this.out(`[暗転復帰] ${durationMs ?? 500}ms`);
}

async whiteIn(durationMs?: number): Promise<void> {
  this.out(`[白転復帰] ${durationMs ?? 500}ms`);
}

async clearBg(fadeMs?: number): Promise<void> {
  const suffix = fadeMs !== undefined ? ` ${fadeMs}ms` : "";
  this.out(`[背景消去]${suffix}`);
}

async waitVoiceEnd(): Promise<void> {
  this.out("[ボイス終了待ち]");
}
```

### Phase F-5: Interpreter テスト追加

`packages/interpreter/test/` に各コマンドの統合テストを追加。
TestEngine の状態を検証する。

**テストケース（10件）:**

| # | テスト | 検証内容 |
|---|-------|---------|
| 1 | `@overlay rain` | `engine.overlays.has("rain") === true` |
| 2 | `@overlay_hide rain` | `engine.overlays.has("rain") === false` |
| 3 | `@flash 300` | `engine.screenEffects` に `"flash"` が含まれる |
| 4 | `@fade_black 1000` | `engine.screenEffects` に `"fade_black"` が含まれる |
| 5 | `@fade_white 800` | `engine.screenEffects` に `"fade_white"` が含まれる |
| 6 | `@black_in 600` | `engine.screenEffects` に `"black_in"` が含まれる |
| 7 | `@white_in 700` | `engine.screenEffects` に `"white_in"` が含まれる |
| 8 | `@bg_clear` | `engine.currentBg === null` |
| 9 | `@ch_move hero center 500` | `engine.getCharPosition("hero") === "center"` |
| 10 | `@wait_voice_end` | エラーなく実行が完了する |

---

### Phase G: メタデータ駆動コマンドレジストリ（再発防止）

Phase F-1〜F-5 は「今ある穴を埋める」作業。Phase G は「二度と穴が生まれない構造」への変更。

#### 現状の問題: 8 箇所の独立した switch-case

| # | ファイル | 関数 | switch 対象 | case 数 |
|---|---------|------|-----------|---------|
| 1 | `commandRegistry.ts` | COMMAND_PARSERS | コマンド名 | 27 |
| 2 | `OpRunner.ts` | execute() | Op.op | 32 |
| 3 | `Interpreter.ts` | executeBuiltin() | コマンド名 | 19→29 |
| 4 | `useEditorStore.ts` | buildPreviewScript() | block.type | 13 |
| 5 | `useEditorStore.ts` | buildPageScript() | block.type | 13 |
| 6 | `useEditorStore.ts` | buildSnapshotScript() | block.type | 5 |
| 7 | `preview.ts` | generateKSCScript() | block.type | 13 |
| 8 | `IOpHandler.ts` | interface | メソッド定義 | 30+ |

新コマンド追加時に 8 箇所を手動で同期する必要があり、漏れが構造的に発生する。

#### G-1: COMMAND_DEFINITIONS レジストリ作成

`packages/core/src/registry/commandDefinitions.ts` に全コマンドのメタデータを一元定義。

```typescript
export interface CommandDefinition {
  /** @コマンド名（例: "overlay"） */
  name: string;
  /** Op 型名（例: "OVERLAY_SET"） */
  opType: string;
  /** Interpreter の IEngineAPI メソッド名（例: "overlaySet"） */
  engineMethod?: string;
  /** エディタのブロック種別（例: "overlay"） */
  blockType?: string;
  /** カテゴリ */
  category: 'background' | 'character' | 'audio' | 'effect' | 'overlay' | 'control' | 'text' | 'gameplay';
  /** optional handler か（未実装でもエラーにしない） */
  optional: boolean;
  /** 引数定義 */
  args: ArgDef[];
}

export interface ArgDef {
  name: string;
  type: 'string' | 'number';
  required: boolean;
  default?: unknown;
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    name: 'overlay',
    opType: 'OVERLAY_SET',
    engineMethod: 'overlaySet',
    blockType: 'overlay',
    category: 'overlay',
    optional: true,
    args: [
      { name: 'id', type: 'string', required: true },
      { name: 'fadeMs', type: 'number', required: false },
    ],
  },
  {
    name: 'overlay_hide',
    opType: 'OVERLAY_HIDE',
    engineMethod: 'overlayHide',
    blockType: 'overlay',
    category: 'overlay',
    optional: true,
    args: [
      { name: 'id', type: 'string', required: false },
      { name: 'fadeMs', type: 'number', required: false },
    ],
  },
  // ... 全コマンド（30+件）を定義
];

/** コマンド名 → 定義 の lookup map */
export const COMMAND_BY_NAME = new Map(
  COMMAND_DEFINITIONS.map(d => [d.name, d])
);

/** Op型名 → 定義 の lookup map */
export const COMMAND_BY_OP = new Map(
  COMMAND_DEFINITIONS.map(d => [d.opType, d])
);

/** ブロック種別 → 定義 の lookup map */
export const COMMAND_BY_BLOCK = new Map(
  COMMAND_DEFINITIONS.filter(d => d.blockType).map(d => [d.blockType!, d])
);

/** 全コマンド名リスト（コンパイラの KNOWN_COMMANDS に使用） */
export const ALL_COMMAND_NAMES = COMMAND_DEFINITIONS.map(d => d.name);
```

#### G-2: 層間同期テスト

`packages/core/test/command-sync.test.ts` にレジストリと各層の整合性を検証するテストを追加。

```typescript
import { COMMAND_DEFINITIONS, ALL_COMMAND_NAMES } from '../src/registry/commandDefinitions';
import { COMMAND_PARSERS } from '@kaedevn/compiler/registry';

describe('コマンドレジストリ同期', () => {
  test('全コマンドが Compiler に登録されている', () => {
    for (const def of COMMAND_DEFINITIONS) {
      expect(COMMAND_PARSERS).toHaveProperty(def.name,
        `${def.name} が COMMAND_PARSERS に未登録`);
    }
  });

  test('Compiler に未知のコマンドがない', () => {
    const registryNames = new Set(ALL_COMMAND_NAMES);
    for (const name of Object.keys(COMMAND_PARSERS)) {
      expect(registryNames.has(name)).toBe(true,
        `${name} が COMMAND_DEFINITIONS に未定義`);
    }
  });

  test('全コマンドの engineMethod が IEngineAPI に存在する', () => {
    // TypeScript の型チェックに加え、ランタイムで検証
    // IEngineAPI の prototype keys と突き合わせ
  });
});
```

**検証対象:**

| テスト | 検証内容 |
|-------|---------|
| Compiler 同期 | `COMMAND_DEFINITIONS` の全 name が `COMMAND_PARSERS` に存在 |
| Compiler 逆引き | `COMMAND_PARSERS` の全 key が `COMMAND_DEFINITIONS` に存在 |
| OpRunner 同期 | `COMMAND_DEFINITIONS` の全 opType が OpRunner の switch に存在 |
| IOpHandler 同期 | `COMMAND_DEFINITIONS` の全 opType に対応する handler メソッドが存在 |
| IEngineAPI 同期 | `COMMAND_DEFINITIONS` の全 engineMethod が IEngineAPI に存在 |

これにより、新コマンド追加時に COMMAND_DEFINITIONS に登録すれば、漏れがあるとテストが失敗する。

#### G-3: Compiler レジストリの統合

現在の `commandRegistry.ts` の `KNOWN_COMMAND_NAMES` を `COMMAND_DEFINITIONS` から自動生成に変更。

```typescript
// Before (commandRegistry.ts)
export const KNOWN_COMMAND_NAMES = Object.keys(COMMAND_PARSERS);

// After
import { ALL_COMMAND_NAMES } from '@kaedevn/core/registry';
// COMMAND_PARSERS は引き続き独自定義（パーサー関数は層固有）
// ただし KNOWN_COMMAND_NAMES は core から取得
export const KNOWN_COMMAND_NAMES = ALL_COMMAND_NAMES;
```

#### G-4: エディタ・API のスクリプト生成共通化（将来）

`buildPreviewScript` / `buildPageScript` / `generateKSCScript` の 3 関数は block.type の switch が重複している。
`COMMAND_DEFINITIONS` の `blockType` を使い、共通の `blockToKsc(block, context): string` ユーティリティに統合可能。

**ただし、各関数のコンテキスト（slug 解決方法等）が異なるため、段階的に進める。**

```
G-4a: 共通ユーティリティ blockToKsc() を packages/core に作成
G-4b: preview.ts (API) で採用（最もシンプル）
G-4c: useEditorStore.ts (Editor) で採用
```

---

## 3. 実装順序

```
Phase F: Interpreter 層の穴埋め（即効性）
  F-1 → F-2, F-3, F-4（並行可）→ F-5

Phase G: メタデータ駆動（再発防止）
  G-1 → G-2 → G-3 → G-4（段階的）
  │      │      │      └─ エディタ・API 共通化（将来）
  │      │      └──────── Compiler 統合
  │      └─────────────── 層間同期テスト
  └────────────────────── COMMAND_DEFINITIONS 作成

Phase F と Phase G は独立して進行可能。
F を先に完了させて即時の断絶を解消し、G で再発を防ぐ。
```

---

## 4. 対象ファイル一覧

### Phase F（Interpreter 穴埋め）

| ファイル | 操作 | Phase |
|---------|------|-------|
| `packages/interpreter/src/engine/IEngineAPI.ts` | インターフェース拡張（+9メソッド） | F-1 |
| `packages/interpreter/src/core/Interpreter.ts` | executeBuiltin 拡張（+10 case） | F-2 |
| `packages/interpreter/src/engine/TestEngine.ts` | テスト実装追加（+9メソッド） | F-3 |
| `packages/interpreter/src/engine/ConsoleEngine.ts` | コンソール実装追加（+9メソッド） | F-4 |
| `packages/interpreter/test/Interpreter.test.ts` | テスト追加（+10件） | F-5 |

### Phase G（メタデータ駆動）

| ファイル | 操作 | Phase |
|---------|------|-------|
| `packages/core/src/registry/commandDefinitions.ts` | 新規作成（全コマンド定義） | G-1 |
| `packages/core/src/index.ts` | エクスポート追加 | G-1 |
| `packages/core/test/command-sync.test.ts` | 層間同期テスト追加 | G-2 |
| `packages/compiler/src/registry/commandRegistry.ts` | KNOWN_COMMAND_NAMES を core から取得に変更 | G-3 |

---

## 5. 検証手順

```bash
# Phase F: Interpreter テスト
npm test -w @kaedevn/interpreter

# Phase G: 層間同期テスト
npm test -w @kaedevn/core

# Compiler 同期テスト（G-3 後）
npm test -w @kaedevn/compiler

# 型チェック
npx tsc --noEmit

# ビルド
npm run build
```

---

## 6. リスク評価

| リスク | 影響 | 対策 |
|-------|------|------|
| IEngineAPI 変更の影響範囲 | 低 | 全メソッド optional (`?`) なので既存実装に影響なし |
| WebEngine (deprecated) との整合性 | なし | WebEngine は `_deprecated/` に移動済み、OpRunner 経由に移行済み |
| Interpreter テストの KNF パーサー依存 | 低 | 既存テストと同じパターンで `.ks` スクリプト文字列を直接渡す |
| COMMAND_DEFINITIONS の導入コスト | 中 | G-1 は core のみの変更。G-2 で同期テスト追加後、G-3 は小さな変更 |
| エディタ・API 共通化（G-4）の影響 | 中 | 段階的に適用。各関数のコンテキストが異なるため慎重に進める |

---

## 7. スコープ外

| 項目 | 理由 |
|------|------|
| native-engine (C++) の同期 | 別パッケージ・別言語。別タスクで対応 |
| OpRunner の switch をレジストリ駆動に変更 | TypeScript の exhaustive check が有効なため、switch のままでよい |
| G-4（エディタ・API 共通化）の即時実施 | コンテキスト差異の整理が必要。将来タスクとして記載 |
