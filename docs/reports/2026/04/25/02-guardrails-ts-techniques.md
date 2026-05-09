# TypeScript 初心者向け補足 — ガードレールで使われている TS の技

作成日: 2026-04-25  
前提資料: [01-guardrails-reproduction.md](./01-guardrails-reproduction.md)

## この文書の狙い

ガードレール（hooks / CI / sync テスト）は **「TypeScript の型システムと tsc の機能を最大限使うこと」** で初めて効く。本書は「なぜそう書くのか」を初心者向けに 1 つずつ解説する。

> 読み方: 各節の冒頭に **【初心者向け要約】** を置いた。コードに自信がない人はそこだけ読めば全体像はつかめる。

## 1. `strict: true` — 「型のゆるさ」を全部閉じる

【初心者向け要約】TS の安全機能を全部 ON にするスイッチ。これを切ると、ガードレールの半分は意味を失う。

`tsconfig.base.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`strict: true` は 7 つのフラグを一括 ON する複合フラグ:

| フラグ | 何を防ぐか |
|---|---|
| `noImplicitAny` | 型注釈漏れ（`function f(x) {}` の `x: any` を許さない） |
| `strictNullChecks` | `null` / `undefined` を勝手に他の型と混ぜさせない |
| `strictFunctionTypes` | 関数引数の互換性チェック厳密化 |
| `strictBindCallApply` | `.bind/.call/.apply` の型を厳密に |
| `strictPropertyInitialization` | クラスのフィールドが必ず初期化されているか |
| `noImplicitThis` | `this: any` を許さない |
| `alwaysStrict` | 出力 JS に `"use strict"` を付ける |

**なぜガードレールに必要か**: pre-push の `npm run typecheck` がここで弾く。`strict: false` だと「動くけど壊れている」コードが通り抜ける。

## 2. Discriminated Union（判別共用体）— `Op` 型の中核

【初心者向け要約】「`type` というラベル付きのいろんな形のオブジェクトを 1 つの型として扱う」書き方。`switch` で書くと TS が自動で「ここに来たら必ずこの形」と推論してくれる。

`packages/core/src/types/Op.ts`:

```ts
export type Op =
  | { op: "TEXT_APPEND"; who?: string; text: string }
  | { op: "WAIT_MS"; ms: number }
  | { op: "BG_SET"; id: string; fadeMs?: number; effect?: "fade" | "slide_left" }
  | { op: "CH_SET"; name: string; pose: string; pos: "left" | "center" | "right" };
```

これを **判別共用体（discriminated union）** と呼ぶ。`op` フィールド（discriminator = 判別子）が「どの形のオブジェクトか」を表す。

利用側ではこう書く:

```ts
function run(op: Op) {
  switch (op.op) {
    case "TEXT_APPEND":
      // ここでは op.text が string と推論される（op.ms は存在しない）
      console.log(op.text);
      break;
    case "WAIT_MS":
      // ここでは op.ms が number と推論される（op.text は無い）
      sleep(op.ms);
      break;
    // case の漏れは exhaustiveness check で検出（後述）
  }
}
```

### 2-1. 網羅性チェック（exhaustiveness check）

`Op` に新しい種類を足したら、`switch` を直し忘れないようにしたい。これは `never` 型で実現できる:

```ts
function run(op: Op) {
  switch (op.op) {
    case "TEXT_APPEND": return handleText(op);
    case "WAIT_MS":     return handleWait(op);
    // ... 全 case ...
    default: {
      const _exhaustive: never = op;  // 漏れがあるとここで型エラー
      throw new Error(`Unhandled op: ${(_exhaustive as Op).op}`);
    }
  }
}
```

新しい `op` を `Op` に足したのに `case` を足し忘れると、`_exhaustive: never` の代入で **コンパイル時に止まる**。これが「壊れない仕組み」の核。

## 3. リテラル型 — 「文字列の自由」を制限する

【初心者向け要約】`string` だと何でも入るが、`"left" | "center" | "right"` と書くと **3 通りしか入らない**。タイポを型で潰せる。

```ts
{ op: "CH_SET"; pos: "left" | "center" | "right" }
```

これがあるおかげで:

```ts
{ op: "CH_SET", name: "hero", pose: "smile", pos: "rihgt" }
                                                  // ^^^^^ 型エラー（タイポ即検出）
```

実コード（`commandRegistry.ts`）でも `posMap` を作って **動的な文字列を確実にこの 3 種に絞り込む** 形を取っている:

```ts
const posMap: Record<string, 'left' | 'center' | 'right'> = {
  'left': 'left', 'center': 'center', 'right': 'right',
  'L': 'left',    'C': 'center',      'R': 'right',
};
const pos = posMap[rawPos];
if (!pos) throw new CompilationException([...]);  // ここで絞り込み完了
```

**意味**: 外から来た文字列 (`rawPos: string`) を、`posMap` を通すことで `'left' | 'center' | 'right'` 型に **昇格** させる。以降のコードはタイポできない。

## 4. `Record<K, V>` — オブジェクトを「同じ形のキーバリュー集合」と宣言する

【初心者向け要約】「キーが文字列、値が全部 `CommandParser` 型」と書きたいときの定型。

```ts
export type CommandParser = (args: string[], line: number, raw: string) => Op;

export const COMMAND_PARSERS: Record<string, CommandParser> = {
  'bg': parseBgCommand,
  'ch': parseChCommand,
  // ... 数十個 ...
};
```

これにより:
- 値の型が違う関数を入れたら型エラー（`parseBg` が `Op` でなく `string` を返したら検出）
- `Object.keys(COMMAND_PARSERS)` が `string[]` で取れる → これを `lineClassifier` で再利用

```ts
export const KNOWN_COMMAND_NAMES = Object.keys(COMMAND_PARSERS);
```

**ガードレール上の意味**: 「コマンド一覧」が **手書きの配列** ではなく **`COMMAND_PARSERS` から自動導出**。同期テスト（`command-sync.test.ts`）が機能する前提。

## 5. `import type` — 型だけ import する

【初心者向け要約】「型情報だけ欲しい、実行時には消えてほしい」import 文。バンドル時に確実に剥がれる。

```ts
import type { Op } from '@kaedevn/core';
import type { CommandToken } from '../types/Token.js';
import { CompilationException } from '../types/CompilerError.js';  // これは値も使うので type 無し
```

なぜ重要か:
- **循環参照を切れる**（型は循環しても、値は循環してはいけない）
- **バンドルサイズが減る**（`Op` 型はランタイムには存在しない、消されて当然）
- **`isolatedModules: true` の前提**（後述）

## 6. `isolatedModules: true` — ファイル単位で完結させる

【初心者向け要約】「1 ファイルだけ見ても TS にコンパイルできるように書け」というルール。Vite や esbuild が高速に動くのはこのおかげ。

```jsonc
{ "compilerOptions": { "isolatedModules": true } }
```

これを ON にすると、こういうコードが **エラー** になる:

```ts
// NG: 型を re-export するときは type を明示する必要がある
export { Op } from '@kaedevn/core';

// OK
export type { Op } from '@kaedevn/core';
```

理由: ファイル単位コンパイラ（esbuild など）は **`Op` が型か値か知らないと出力 JS で `export Op` を残すか削るか判断できない**。

**ガードレール上の意味**: pre-push の **dist 起動テスト** で、`tsx` が許す書き方と `node dist/*.js` が許す書き方の差を、最初から無くしておくため。

## 7. `tsc -b`（Project References）— モノレポの段階ビルド

【初心者向け要約】複数パッケージを「依存順に」ビルドする仕組み。`packages/core` を直してから `packages/web` をビルドしないと型が古い、を防ぐ。

```jsonc
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,    // これが project references の必須条件
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

`composite: true` は以下を強制する:
- 必ず `outDir` がある
- `declaration: true`（`.d.ts` を出す）
- 全ファイルが `include` で明示されている

実行:

```bash
tsc -b packages/core packages/web   # 依存順に build。差分が無ければスキップ
```

`tsc -b` は **増分ビルド** で、`.tsbuildinfo` をキャッシュとして使う。一度通ったら次回は変更ファイルだけ再チェック。

**ガードレール上の意味**: pre-push の `npm run typecheck` が秒で終わる。遅いと開発者がフックを `--no-verify` で迂回し始め、ガードレールが死ぬ。**速さもガードレールの一部**。

### 7-1. `tsc --noEmit` — 「型チェックだけ」モード

`apps/next` / `apps/hono` は Next.js / Hono のビルダーが JS を出すので、tsc は **型チェックだけ** したい。

```jsonc
// package.json
"typecheck": "tsc -b packages/core packages/web && tsc -b apps/editor && tsc -b apps/ksc-editor && tsc --noEmit -p apps/next/tsconfig.json && tsc --noEmit -p apps/hono/tsconfig.json"
```

- `-b` … project references モード（依存順ビルド + 増分）
- `-p` … 単一プロジェクト指定（`tsconfig.json` のパス）
- `--noEmit` … JS を出さず型エラーだけ報告

**`&&` で連結** している点に注目: 1 つでも失敗したら以降はスキップ。前に失敗を直さない限り次のチェックに進めない。

## 8. `moduleResolution: "bundler"` と `.js` 拡張子のクセ

【初心者向け要約】TS で書いた `.ts` ファイルを `import './foo.js'` と書く謎ルール。ESM の決まりに合わせるため。

```ts
import { COMMAND_PARSERS } from '../registry/commandRegistry.js';
//                                                              ^^^ 実体は .ts なのに .js
```

理由:
- `module: "ESNext"` + ESM 出力では、ブラウザや Node が **拡張子付きパス** を要求する
- TS は型解決時に `.js` を `.ts` として読んでくれる
- `tsx` は寛容で `.js` 無しでも動く（=バグの温床）

`isolatedModules: true` と組み合わさると、**「`tsx` で動いたが `node dist/*.js` で動かない」** がほぼ消える。

**ガードレール上の意味**: pre-push の **dist 起動テスト**（3 秒立ち上げてエラー grep）はこの差を本番直前に最終検出する仕組み。

## 9. Generic（ジェネリクス）— Prisma 生クエリの型付け

【初心者向け要約】関数やクラスに「使うときに型を渡せる穴」を開ける機能。`Array<string>` の `<>` がそれ。

`apps/hono/test/schema-sync.test.ts`:

```ts
const result = await prisma.$queryRaw<{ column_name: string }[]>`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'assets' AND column_name = 'slug'
`;
expect(result.length).toBe(1);
```

ここで `<{ column_name: string }[]>` が **型引数**。「この生 SQL は `column_name: string` を持つオブジェクトの配列を返すよ」と TS に教えている。

これがないと `result` は `unknown` になり、`result.length` でエラーになる。`as` で力ずくキャストすることもできるが、それより **読みやすく、誤りが起きにくい**。

## 10. Vitest の型推論を活かす書き方

【初心者向け要約】テストの `expect` は「値を 1 個」検査することで、TS の型情報が活きる。

```ts
// OK — 値が 1 個。型推論も明確
await expect(prisma.user.findFirst()).resolves.not.toThrow();
expect(result.length).toBe(1);

// NG — どっちが期待値か曖昧。CLAUDE.md でも禁止
expect([200, 500]).toContain(response.status);
```

`resolves` / `rejects` は `Promise` を unwrap する Vitest のチェーン。型は維持される:

```ts
const user = await prisma.user.findFirst();   // user: User | null
expect(user).not.toBeNull();
// この後の user は本当は User と絞れるが、Vitest は narrowing できないので
if (!user) throw new Error('unreachable');
expect(user.email).toBe('...');               // ここでは User
```

## 11. インライン型 `Array<{ ... }>` — テストデータの自己記述

`packages/compiler/test/command-sync.test.ts`:

```ts
const commandTestCases: Array<{
  command: string;
  input: string;
  expectedOp: string;
}> = [
  { command: 'bg', input: '@bg room_day', expectedOp: 'BG_SET' },
  // ...
];
```

`type Foo = { ... }` で別名を作らずに **その場で型を書く**。テストフィクスチャのような「ここでしか使わない型」はインラインの方が読みやすい。

**指針**: 2 箇所以上で使う型は `type` で命名、1 箇所だけならインライン（CLAUDE.md の「新規抽象の追加条件」と整合）。

## 12. Workspace 単位のスクリプト実行 — `npm run -w`

【初心者向け要約】`-w <package>` で 1 パッケージ内の `package.json` の script を実行する。

```bash
npm test -w @kaedevn/compiler                # @kaedevn/compiler の test
npm run lint -w apps/next                    # apps/next の lint
npm run build -w apps/hono                   # apps/hono の build
```

pre-push:

```sh
npm run typecheck                # ルート（全部）
npm run lint -w apps/next        # 1 パッケージのみ
npm run build -w apps/hono       # 1 パッケージのみ → dist 起動テスト
```

**ガードレール上の意味**: 「Editor の lint は既存エラーが多いから今は除外、Next.js だけ強制」のような **段階的厳格化** が `-w` で実現できる。

## 13. `import.meta.env`（Vite 限定）— ビルド時置換の落とし穴

【初心者向け要約】Vite はビルド時に `import.meta.env.VITE_API_URL` を **静的に文字列リテラルに置換** する。実行時環境変数ではない。

```ts
// apps/editor/src/config/api.ts
const baseURL = import.meta.env.VITE_API_URL;
```

`.env.production` が読まれていないと、ビルド済 JS に `localhost:8080` がそのまま残る。だから:

- **pre-commit**: ソースを grep（書く時の事故）
- **CI**: `apps/editor/dist/` も grep（ビルド時の事故）
- **CI**: `.env.production` の存在を `[ -f ... ]` で確認

3 段階で守っている。**TS の型システムでは捕まえられない種類の事故** なので、文字列 grep が最終防衛線。

## 14. Frozen Schema — 型は変えるが値の形は変えない

【初心者向け要約】「セーブデータの形は version で固定」というルールを TS でどう表現するか。

```ts
// packages/core/src/types/SaveData.ts (概念)
export interface SaveDataV1 {
  save_schema_version: 1;     // ← リテラル型 1 で固定
  engine_version: string;
  work_id: string;
  scenario_id: string;
  node_id: string;
  vars: Record<string, unknown>;
  read: Record<string, boolean>;
  timestamp: number;
}

export type SaveData = SaveDataV1;  // 将来 V2 を足したら union に
```

`save_schema_version: 1` は **値も 1 しか取れない型**。`{ save_schema_version: 2, ... }` を作ろうとすると型エラー。

**ガードレール上の意味**: `architecture-check.sh` Rule 4 で `SaveData.ts` は C ゾーン。Design Change Note なしで触ると push が止まる。**型による制約**と**フックによるレビュー強制**の二重ロック。

## 15. インターフェース抽象（`IStorage`）— 実装差し替え可能性

```ts
// packages/core/src/interfaces/IStorage.ts
export interface IStorage {
  save(slotId: string, data: SaveData): Promise<void>;
  load(slotId: string): Promise<SaveData | null>;
  delete(slotId: string): Promise<void>;
  list(): Promise<string[]>;
}
```

Web 実装（IndexedDB）も Switch 実装も同じ `IStorage` を実装する:

```ts
class WebStorage implements IStorage {
  async save(slotId: string, data: SaveData): Promise<void> { /* IndexedDB */ }
  // ...
}
```

`implements IStorage` を書いておくと、メソッド漏れ・引数違いを **クラス定義時点で検出**。

**ガードレール上の意味**: `architecture-check.sh` Rule 1（localStorage 直叩き禁止）と組み合わさると、「`IStorage` 経由でしかストレージを触れない」ことが **型 + 静的解析** の両面で保証される。

## まとめ — 「型を信じてフックは静的に守る」

| 仕組み | 守るもの | TS の役割 |
|---|---|---|
| `strict: true` | 暗黙の `any` / `null` | 全部の前提 |
| Discriminated Union | 命令の網羅性 | `never` で漏れ検出 |
| Literal types | 文字列タイポ | コンパイル時拒否 |
| `Record<K, V>` | レジストリの一貫性 | キー追加時の値型強制 |
| `import type` | 循環参照・バンドル肥大 | 実行時から消える保証 |
| `isolatedModules` | tsx と node の差 | ファイル単位の独立性 |
| `tsc -b` | モノレポの依存順 | 増分ビルドで速度確保 |
| `--noEmit -p` | 型チェック専用 | Next.js / Hono と共存 |
| Generic | 生 SQL の型付け | `unknown` を回避 |
| `implements I` | 実装漏れ | メソッド定義時点で検出 |

**ガードレールの哲学**: 静的に防げるものは型で、型で防げないもの（文字列・環境変数・git diff）は **シェルスクリプト + grep + フック** で。両方揃ってはじめて「壊れない」。

## 学習ロードマップ（初心者向け）

1. 基礎: `strict: true` を有効にして 1 つのプロジェクトを通す
2. Discriminated union → `switch` exhaustiveness（`never` 型）
3. リテラル型と `as const`
4. `Record<K, V>` でレジストリパターンを書く
5. `import type` と `isolatedModules: true` の意味を理解
6. `tsc -b` でモノレポを構築 → `composite: true` を導入
7. Vitest で `prisma.$queryRaw<T>` のようなジェネリクスを書く
8. インターフェース実装パターン（`implements IStorage`）

ここまで理解すれば、本書のガードレールはすべて読める。
