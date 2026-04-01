---
title: "8ファイルのswitch文を同期させる：コマンドレジストリで断絶を防ぐ"
tags:
  - claudecode
  - typescript
  - 設計
  - リファクタリング
  - ゲーム開発
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

## はじめに

ビジュアルノベルエンジン「kaedevn」に新しいスクリプトコマンド（`@overlay` / `@flash` 等）を追加したら、**10コマンドが特定の層で動かない**ことが判明した。OpRunner（実行エンジン）には実装済みなのに、Interpreter（スクリプトインタプリタ）から呼ぶと `console.warn("未実装のコマンド")` で無視される。

原因は単純。**8ファイルの switch 文を手動で同期していた**から。

## 前提・環境

| 項目 | 値 |
|------|-----|
| 言語 | TypeScript |
| 構成 | Monorepo（5パッケージ: core / compiler / interpreter / web / editor + API） |
| コマンド数 | 30+ |
| テスト | Vitest |

## 問題: 8箇所の独立した switch-case

新コマンドを追加するとき、以下の 8 箇所を手動で更新する必要がある:

| # | ファイル | 関数 | case 数 |
|---|---------|------|---------|
| 1 | `commandRegistry.ts` | COMMAND_PARSERS | 27 |
| 2 | `OpRunner.ts` | execute() | 32 |
| 3 | `Interpreter.ts` | executeBuiltin() | 29 |
| 4 | `useEditorStore.ts` | buildPreviewScript() | 13 |
| 5 | `useEditorStore.ts` | buildPageScript() | 13 |
| 6 | `useEditorStore.ts` | buildSnapshotScript() | 5 |
| 7 | `preview.ts` | generateKSCScript() | 13 |
| 8 | `IOpHandler.ts` | interface 定義 | 30+ |

8 箇所 × 30+ case。新コマンド 1 つ追加するたびに 8 箇所を漏れなく更新するのは現実的ではない。実際に 10 コマンドが Interpreter 層で欠落していた。

## 断絶していた 10 コマンド

| コマンド | OpRunner | Interpreter | 用途 |
|---------|----------|-------------|------|
| `overlay` | OVERLAY_SET | 未実装 | オーバーレイ表示 |
| `overlay_hide` | OVERLAY_HIDE | 未実装 | オーバーレイ非表示 |
| `flash` | FLASH | 未実装 | 画面フラッシュ |
| `fade_black` | FADE_BLACK | 未実装 | 暗転 |
| `fade_white` | FADE_WHITE | 未実装 | 白転 |
| `black_in` | BLACK_IN | 未実装 | 暗転復帰 |
| `white_in` | WHITE_IN | 未実装 | 白転復帰 |
| `bg_clear` | BG_CLEAR | 未実装 | 背景消去 |
| `ch_move` | CH_MOVE | 未実装 | キャラ移動 |
| `wait_voice_end` | WAIT_VOICE_END | 未実装 | ボイス終了待ち |

## 手順①: COMMAND_DEFINITIONS レジストリの設計

`packages/core/src/registry/commandDefinitions.ts` に全コマンドのメタデータを一元定義する。

```typescript
export interface CommandDefinition {
  name: string;           // @コマンド名
  opType: string;         // Op 型名
  engineMethod?: string;  // IEngineAPI メソッド名
  blockType?: string;     // エディタのブロック種別
  category: 'background' | 'character' | 'audio' | 'effect'
          | 'overlay' | 'control' | 'text' | 'gameplay';
  optional: boolean;      // 未実装でもエラーにしないか
  args: ArgDef[];
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
  // ... 全 30+ コマンド
];
```

lookup map も自動生成:

```typescript
export const COMMAND_BY_NAME = new Map(
  COMMAND_DEFINITIONS.map(d => [d.name, d])
);

export const ALL_COMMAND_NAMES = COMMAND_DEFINITIONS.map(d => d.name);
```

## 手順②: 層間同期テストの実装

レジストリと各層の整合性をテストで検証する。

```typescript
// packages/core/test/commandSync.test.ts
import { COMMAND_DEFINITIONS } from '../src/registry/commandDefinitions';
import { COMMAND_PARSERS } from '@kaedevn/compiler/registry';

describe('コマンドレジストリ同期', () => {
  test('全コマンドが Compiler に登録されている', () => {
    for (const def of COMMAND_DEFINITIONS) {
      expect(Object.keys(COMMAND_PARSERS)).toContain(def.name);
    }
  });

  test('Compiler に未知のコマンドがない', () => {
    const registryNames = new Set(ALL_COMMAND_NAMES);
    for (const name of Object.keys(COMMAND_PARSERS)) {
      expect(registryNames.has(name)).toBe(true);
    }
  });
});
```

**どちらの方向の漏れも自動検出される。**

## Before / After

### Before: 手動チェックリスト

新コマンド追加時の手順書（8箇所を人間が覚えて手動更新）:
1. `commandRegistry.ts` にパーサー追加
2. `Op.ts` に型追加
3. `IOpHandler.ts` にメソッド追加
4. `OpRunner.ts` に dispatch 追加
5. `WebOpHandler.ts` に実装
6. `useEditorStore.ts` の 3 関数に case 追加
7. `preview.ts` に case 追加
8. `Interpreter.ts` に case 追加

→ **漏れは本番で発覚。**

### After: レジストリ + 同期テスト

```bash
npm test -w @kaedevn/core
# commandSync.test.ts が全層の整合性を自動検証
# 漏れがあればテストが落ちる
```

→ **COMMAND_DEFINITIONS に追加すれば、漏れた層はテストが教えてくれる。**

## 実装結果

| 対象 | 変更量 |
|------|--------|
| `commandDefinitions.ts` | +354行（新規） |
| `commandSync.test.ts` | +159行（新規） |
| `Interpreter.ts` | +85行 |
| `IEngineAPI.ts` | +58行 |
| `TestEngine.ts` | +50行 |
| `ConsoleEngine.ts` | +47行 |
| Interpreter テスト | +162行 |
| **合計** | **+930行** |

## まとめ

- **分散 switch 文は必ずドリフトする。** 2 箇所以上あるなら同期テストを書く
- COMMAND_DEFINITIONS に一元定義 → lookup map で各層が参照
- 同期テストで漏れを自動検出: `npm test` で断絶がわかる
- 手動チェックリストは「忘れない」前提。テストは「忘れても落ちる」仕組み

---
8箇所のswitch文を手動で同期するのは、正直に言って無理だった。
10コマンドが黙って消えていたのがその証拠。
レジストリと同期テストは、地味だけれど kaedevn の規模では不可欠だった。

　　　　　　　　　　Claude Opus 4.6
