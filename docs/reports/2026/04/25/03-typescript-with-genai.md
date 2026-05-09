# 生成 AI で実装するときに TypeScript が有利な理由

作成日: 2026-04-25  
シリーズ: [01-guardrails-reproduction](./01-guardrails-reproduction.md) / [02-guardrails-ts-techniques](./02-guardrails-ts-techniques.md) / 本書

## はじめに（読者へ）

生成 AI（Claude Code・Copilot・Cursor 等）にコードを書かせるとき、**型がある言語**は **型がない言語**に比べて圧倒的に成功率が高い。本書では:

1. **第 1 部**: なぜそうなるか、一般論として
2. **第 2 部**: このリポジトリで実際に効いた具体例

の順で説明する。各節の冒頭に **【一行で言うと】** を置いた。

---

# 第 1 部 — 一般論

## 1. 型は「AI への暗黙の指示書」になる

【一行で言うと】型注釈は、人間が書かなくても AI が読めるドキュメント。

JS で次のように書いたとき:

```js
function calculatePrice(item, user) { ... }
```

AI は `item` や `user` の中身が分からない。コードを書こうとするたび「これフィールド何だっけ？」と AI が **推測（=ハルシネーション）** する。実在しない `user.subscriptionTier` などを平気で呼ぶ。

TS だとこうなる:

```ts
type Item = { id: string; price: number; taxRate: number };
type User = { id: string; isPremium: boolean };
function calculatePrice(item: Item, user: User): number { ... }
```

AI が `user.subscriptionTier` を書いた瞬間に **`tsc` が "Property 'subscriptionTier' does not exist on type 'User'" と返す**。AI はそのエラーを読んで自分で直せる。

要点: 型は「**AI のハルシネーションを機械的に否定する装置**」として機能する。

## 2. AI ↔ tsc のループで自動修正が回る

【一行で言うと】「AI 書く → tsc が文句を言う → AI 直す」のループが何回も回るのが TS。

JS でのループ:
```
AI 書く → 実行する → エラー → AI 直す
                ↑ ここが遅い・不安定（実行に DB / API / 環境が要る）
```

TS でのループ:
```
AI 書く → tsc 実行 → エラー → AI 直す
                ↑ ここが速い（数秒、依存ゼロ）
```

実行しなくても **静的に** 大半の不整合が出るので、ループの周回時間が短い = AI の試行錯誤回数が増やせる = 最終的な品質が高い。

## 3. リファクタが安全 — AI に「全部直して」と頼める

【一行で言うと】型のあるコードベースは、AI に大規模変更を任せても怖くない。

TS 上での「`User.email` を `User.emailAddress` にリネームしてくれ」:

- AI が型定義を変える
- 全使用箇所で `tsc` がエラー
- AI がエラーを読んで一括で直す
- **使用箇所を 1 つでも漏らすと型エラーが残る**ため、人間がレビューで気づける

JS では「とりあえず全部直したと AI が言うが、本当に直っているか分からない」という状態になりがち。

## 4. 型定義は「AI への 100 倍効くプロンプト」

【一行で言うと】コメント 100 行よりも、型 1 行の方が AI に伝わる。

```ts
// 悪い: 自然言語コメントだけ
// この関数は「ユーザーが購入済みの作品」を返す
function getOwned(userId, workId) { ... }

// 良い: 型で意図を表現
type WorkId = string & { __brand: 'WorkId' };  // ID の混同を型で防ぐ
type OwnedWork = { workId: WorkId; purchasedAt: Date; refunded: boolean };
function getOwned(userId: UserId, workId: WorkId): Promise<OwnedWork | null> { ... }
```

AI はこの関数を呼ぶコードを書くとき:
- `WorkId` と `UserId` を取り違えない（branded type で型エラー）
- 戻り値が `null` になりうると分かる（`null` チェックを書く）
- `purchasedAt` が `Date` だと分かる（`.toISOString()` を呼べる）

## 5. 列挙的 API は **「足し忘れ」** が AI の最頻ミス — TS なら検出できる

【一行で言うと】「機能を追加するとき、関連箇所を全部更新する」が AI は苦手。TS の網羅性チェックがそれを補う。

判別共用体 + `switch` の `default: never`（前書 §2）が効くシナリオ:

```ts
type Action =
  | { kind: 'login' }
  | { kind: 'logout' }
  | { kind: 'signup' };  // ← AI がここに 'signup' を足したとする

function handle(a: Action) {
  switch (a.kind) {
    case 'login':  return doLogin();
    case 'logout': return doLogout();
    // signup の case を AI が足し忘れた
    default: const _: never = a;  // ← ここで型エラー！
  }
}
```

人間レビューでは見落としがちな「分岐の足し忘れ」を、**型システムが必ず見つける**。AI は型エラーを読んで自分で直せる。

## 6. ライブラリの API も型でわかる

【一行で言うと】ライブラリの `.d.ts` を AI が読めるので、ドキュメント検索なしで正しい API を使える。

```ts
import { z } from 'zod';
const schema = z.object({ email: z.string().email(), age: z.number().min(0) });
type User = z.infer<typeof schema>;  // { email: string; age: number } が自動導出
```

AI が `z.string().email()` を書いた時点で「`zod` の `string` メソッドのチェーンに `email` がある」と LSP / `.d.ts` から分かる。誤った API を呼ぶ確率が劇的に減る。

JS では「`zod` の API、ドキュメントは…」という確認が必要。

## 7. テストの型が効く — モックの形を間違えない

【一行で言うと】「モックがちょっと違って本物と互換性がない」AI 失敗パターンを型が止める。

```ts
const mockUser: User = { id: 'u1', email: 'a@b.com' /* age を入れ忘れ */ };
//                       ^^^^^^ Property 'age' is missing
```

`User` 型で `age` が必須なら、モック作成時点で型エラー。AI が「動きそうな雑なモック」を量産しても、型が形を強制する。

## 8. 型推論で「書く量」が減る = AI も人間も読みやすい

【一行で言うと】AI も人間も、型注釈を全部書く必要はない。型推論が補う。

```ts
const users = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
// users: { id: number; name: string }[] が自動推論
const ids = users.map(u => u.id);  // ids: number[]
```

AI は型を全部書こうとして冗長になりがちだが、推論を信じれば最小限で済む。コードが短い = AI のコンテキスト消費が少ない = 大規模なリファクタも 1 ターンで済む。

## 9. エディタ統合（LSP）で AI が「賢くなる」

【一行で言うと】Cursor / Claude Code は、TS の LSP を AI のコンテキストに食わせている。

エディタの「定義へジャンプ」「使用箇所一覧」「ホバーでの型表示」は、すべて TS Server（`tsserver`）が提供する。AI ベースのエディタはこれらを自動で AI に渡す。

つまり AI が `user.` と書いた瞬間、エディタは:
- `User` 型の全フィールド
- それぞれのフィールドの型
- 関連する utility 関数

を AI のプロンプトに混ぜている。**AI が賢いのではなく、TS のおかげで賢く見える**。

## 10. ランタイムエラーを **コンパイル時に前倒し** できる

【一行で言うと】「実行してから気づく」を「書いてる時に気づく」に変える。AI のテスト試行回数が減る。

```ts
function getName(user: User | null): string {
  return user.name;  // ← 'user' is possibly 'null'
}
```

JS だとこのバグはランタイムに `Cannot read property 'name' of null` で初めて分かる。AI は「動かして」「ログを見て」「直す」を回す必要がある。

TS だとコンパイル時に止まる → AI は **実行せずに** 直せる → 速い・安い。

---

# 第 2 部 — このリポジトリでの成功例

第 1 部の理屈が **実際このリポジトリでどう効いたか** を、具体的に振り返る。

## A. コマンドレジストリ — 「単一情報源 + 型 + 同期テスト」の三点セット

### 状況

`@xxx` という新しいスクリプトコマンドを追加するとき、**8 ファイルの追従** が必要（`CLAUDE.md`「Adding New Script Commands」参照）:

1. `commandRegistry.ts` — パーサー追加
2. `Op.ts` — Op 型追加
3. `IOpHandler.ts` — ハンドラ型追加
4. `OpRunner.ts` — dispatch case
5. `WebOpHandler.ts` — Web 実装
6. `useEditorStore.ts` — getBlockScript / buildSnapshotScript
7. `preview.ts` — generateKSCScript
8. テスト同期確認

### TS が効く理由

`Op` 型は判別共用体:

```ts
export type Op =
  | { op: "BG_SET"; id: string; fadeMs?: number }
  | { op: "BG_CLEAR"; fadeMs?: number };
  // ...
```

AI に「`@blur` コマンドを追加して」と頼むと:

1. AI が `Op.ts` に `{ op: "BLUR_SET"; radius: number }` を足す
2. AI が `OpRunner.ts` の switch を更新しないと **`default: never` で型エラー**
3. AI が `WebOpHandler.ts` の `IOpHandler` を実装し損ねると **`implements` で型エラー**
4. AI が `commandRegistry.ts` への登録を忘れると **`command-sync.test.ts` が失敗**

→ **8 箇所のうち何箇所か忘れても、必ず壊れて止まる**。AI は止まった所を読んで直す。

### この設計のキモ

「`COMMAND_PARSERS: Record<string, CommandParser>` を **単一情報源** にする」と決めた瞬間、

```ts
export const KNOWN_COMMAND_NAMES = Object.keys(COMMAND_PARSERS);
```

で「コマンド一覧」が **手書き不要** になる。AI が `COMMAND_PARSERS` を更新するだけで、`lineClassifier` も自動的に追従する。

**型による単一情報源化 = AI への巨大な省力化**。

## B. dist 起動テスト — AI の典型的失敗パターンを 3 秒で潰す

### 状況

AI（Claude Code）は `tsx` で動かしてテストする。`tsx` は `import './foo'` を勝手に `.ts` 解決してくれる寛容なツール。

ところが本番は `node dist/index.js`、こちらは厳格 ESM で **`import './foo.js'` と書かないと解決できない**。

AI が書いたコード:

```ts
import { foo } from './foo';   // tsx では動く、node dist では Cannot find module
```

### TS + フックが効く理由

`isolatedModules: true` と `moduleResolution: "bundler"` が組み合わさっても、なお漏れる。これを pre-push の dist 起動テストが 3 秒で捕まえる:

```sh
node apps/hono/dist/index.js > "$LOG" 2>&1 &
sleep 3 && kill ...
grep -qE "ERR_|Cannot find module|SyntaxError" "$LOG" && exit 1
```

### 効いたポイント

- 型だけでは検出できない「ESM 解決」の失敗を、**ローカル実行で型チェックの直後に最終検出**
- AI は「typecheck 通ったから OK」とよく言うが、`node dist` は別物
- 失敗するとログに `Cannot find module './foo'` が残る → AI が読んで `'./foo.js'` に直す

**TS の限界を、TS の出力を実行することで補う**。

## C. Schema Sync Test — Prisma の型と DB の整合性

### 状況

AI が Prisma schema に新しいカラムを足すとき、`npx prisma migrate dev` を **忘れる** ことがある。schema.prisma の型は更新されるが、DB に反映されないと:

- ローカルでは `prisma generate` 済の型で TS は通る
- 実行時に「カラムが無い」エラー

### TS が効く理由（と限界）

```ts
await expect(prisma.user.findFirst()).resolves.not.toThrow();
```

`findFirst()` は schema に書かれた **全カラムを SELECT** する。型は `prisma generate` 由来で「カラムがある前提」、DB に無ければ実行時エラー。

これを `schema-sync.test.ts` で囲っているので:
- ローカルで `npm test` を走らせれば検出
- CI でも `services.postgres` で実 DB 立てて再検出

AI は「型が通った = 動く」と思いがちだが、**Prisma は型と DB の二重管理**。型と DB のずれを **テストで検出する** 仕組みが必要。

### このリポジトリの工夫

CI で `prisma migrate status | grep "have not yet been applied"` も並走させ、**マイグレ実行忘れ** すら検出している（前書 §4-1）。

AI が schema 変更タスクを完了したと言っても、これらが緑になるまで信じない。

## D. C ゾーン + Design Change Note — 「無断で抽象を壊さない」を AI に守らせる

### 状況

AI に「ちょっとパフォーマンス改善して」と頼むと、平気で `IStorage` インターフェースに引数を増やしたり、`SaveData.ts` のフィールドをリネームしたりする。

これが起きると:
- Switch 移植時に全実装書き換え
- セーブデータ後方互換性が壊れる

### TS + フックが効く理由

`packages/core/src/interfaces/IStorage.ts` を変更すると:

1. **TS 側**: `implements IStorage` の全実装クラス（Web 実装等）でメソッドシグネチャ不一致が型エラー → AI は「全部直さなきゃ」と気づく
2. **シェル側**: `architecture-check.sh` Rule 4 が「C ゾーン変更には Design Change Note が必要」と push でブロック

AI は **コミットメッセージか docs に Design Change Note を書く**ことを強制される:

```
## Design Change Note
- 何を変えるか: IStorage に list() を追加
- なぜ必要か: セーブスロット一覧 UI で必要
- 依存方向は変わるか: No
- 既存抽象を再利用できない理由: 既存メソッドでは取得手段がない
- 破壊的変更か: Yes — 全 IStorage 実装に list() 実装が必要
```

これにより、**AI が「ついで」で抽象を壊すのを止めて、明示的な合意プロセスに乗せる**。

## E. Forbidden Patterns の機械化 — `localStorage` / `waitForTimeout` を AI に書かせない

### 状況

AI は知っている言語機能を平気で使う。`localStorage.setItem` も `await page.waitForTimeout(2000)` も書く。

### TS + 静的解析が効く理由

TS だけでは検出できない（どちらも有効な API）。`architecture-check.sh` の git diff grep で **新規追加分のみ Error**:

```sh
git diff HEAD --unified=0 | grep '^+' \
  | grep -E '(localStorage|sessionStorage)\.(getItem|setItem)' \
  && exit 1
```

AI は禁止パターンを書いた瞬間 push でブロックされる → エラーメッセージに「IStorage を使え」と書いてあるので AI は自動で直す。

### このリポジトリの工夫

「**新規追加のみエラー、既存はワーニング**」が秀逸。これがないと AI に「全箇所直して」とお願いする羽目になり、コンテキストが膨らむ。

## F. 型 + JSDoc + AI Metadata API — AI への「動的プロンプト」

### 状況

`apps/editor` のブロックを AI に編集させるとき、AI は:
- どんな asset がプロジェクトにあるか
- どんなページが既にあるか
- どんな変数が宣言されているか

を知る必要がある。

### TS + API 設計が効く理由

`GET /api/editor-schema` が **静的な型情報**（全 14 ブロック型・制約・enum）を返し、`GET /api/projects/:id` の `_ai_context` が **動的な利用可能リソース** を返す。

```ts
// AI Metadata の型例（CLAUDE.md 参照）
type AIContext = {
  availableAssets: Array<{ id: string; name: string; category: string }>;
  availableCharacters: Array<{ id: string; name: string }>;
  availablePages: Array<{ id: string; title: string }>;
  knownVariables: Record<string, 'number' | 'string' | 'boolean'>;
};
```

AI は `_ai_context.availableAssets[0].id` を呼べば **実在する** ID を必ず使える → ハルシネーションが構造的に起きない。

これは「**型 + ランタイムデータ提供**」の合わせ技で、純粋な静的型では実現できない。AI 時代の API 設計指針として再現価値が高い。

---

# まとめ — 初心者へのアドバイス

## なぜ AI 時代に TS なのか（短く）

1. **型 = AI への一次仕様書**。コメントより強い
2. **`tsc` のエラーループで AI が自己修正**。実行不要
3. **判別共用体 + 網羅性チェック**で、AI の足し忘れが必ず検出される
4. **`implements` インターフェース**で、AI が抽象を壊しても気づける
5. **dist 起動テスト・sync テストなど「TS の外側」**で TS の限界を補う

## 始めるときに最初にやるべきこと

1. **`strict: true` を有効に**（これが全前提）
2. **`Op` のような中心データ構造を判別共用体で定義**
3. **`Record<string, T>` でレジストリを作り、`Object.keys` で派生**（手書き列挙を撲滅）
4. **インターフェース（`I*`）で実装を抽象化**、実装は `implements` を必ず付ける
5. **pre-push に `tsc --noEmit` を仕込む**（AI に「型通る前に push するな」を強制）
6. **段階的にチェックを追加**。最初から完璧を目指さず、新規違反のみ Error にする

## AI に任せる前のチェックリスト

- [ ] `strict: true` がオン
- [ ] 中心ドメインが判別共用体になっている
- [ ] 単一情報源（registry）が型で表現されている
- [ ] テストが「型が通る = 動く」のずれを埋めている（schema-sync 相当）
- [ ] dist / 本番ビルドの起動テストがある
- [ ] CLAUDE.md / AGENTS.md に「禁止パターン」と「変更境界」が明文化されている

これが揃えば、AI に **大幅な実装** を任せても壊れにくい。本リポジトリの 14 コミット分の Phase 2 機能（KSC VM C++ 移植・課金・スタミナ）は、上記のセットアップがあったから AI で実装できた。

> 結論: **TS は AI と組むときの最強の言語**。理由は速度でも構文でもなく、「**型エラーが AI への自動フィードバック**」になるから。
