# 壊れない仕組み・ガードレール再現手順

作成日: 2026-04-25

## 目的

このリポジトリで「壊れにくさ」を支えている仕組み（hooks / CI / sync test / 設計境界 / forbidden patterns）を、別リポジトリでもそのまま再現できる粒度で記述する。`CLAUDE.md` の Rules セクションが「規約」、本書が「実装の見取り図」。

## ガードレール一覧

| 層 | 仕組み | 実体 | 防ぐ事故 |
|---|---|---|---|
| commit 前 | ハードコード URL 検出 | `.husky/pre-commit` | `localhost:8080` の本番混入 |
| commit 前 | UI ↔ E2E 同期チェック | `scripts/test/check-e2e-sync.sh` | UI 変更でテスト未更新（warn のみ） |
| commit メッセージ | スキル経由必須 | `.husky/commit-msg` | `Co-Authored-By` / 感想区切り欠落 |
| push 前 | 型チェック + lint | `.husky/pre-push` | 型エラーの main 流入 |
| push 前 | dist 起動テスト | `.husky/pre-push` (3) | tsx で動くが node dist で動かない混入 |
| push 前 | アーキテクチャ検査 | `scripts/lint/architecture-check.sh` | localStorage 直叩き / cross-app import / `waitForTimeout` / C ゾーン無断変更 |
| CI | 型・lint・unit・schema | `.github/workflows/ci.yml` | ローカル素通り後の差し戻し |
| CI | ハードコード URL（ビルド出力含む） | `.github/workflows/check-hardcoded-urls.yml` | env 未適用ビルドのデプロイ |
| 単体テスト | コマンド同期テスト | `packages/compiler/test/command-sync.test.ts` | `@xxx` 追加時の登録漏れ |
| 単体テスト | スキーマ同期テスト | `apps/hono/test/schema-sync.test.ts` | Prisma migrate 漏れ |
| 規約 | 設計境界（C ゾーン） | `architecture-check.sh` Rule 4 | 抽象や frozen schema の無言改変 |
| 規約 | Forbidden patterns | `CLAUDE.md` | `localStorage` / ピクセル直書き / UI 層 fetch / `waitForTimeout` |

## 1. Husky hooks

### 1-1. インストール

```jsonc
// package.json
{
  "scripts": { "prepare": "husky" },
  "devDependencies": { "husky": "^9.1.7" }
}
```

`npm install` 時に `prepare` が走り `.husky/_/` を生成する。

### 1-2. `.husky/pre-commit`

役割: コミットを止める「軽量ゲート」。重い処理は pre-push に置く。

```sh
#!/bin/sh
echo "🔍 Pre-commit checks..."

# 1. ハードコード URL チェック（編集アプリ限定）
HARDCODED=$(grep -r "localhost:8080" apps/editor/src/ \
  --exclude="api.ts" --exclude-dir="node_modules" 2>/dev/null || true)
if [ -n "$HARDCODED" ]; then
  echo "❌ Hardcoded localhost:8080 found"
  echo "$HARDCODED"
  echo "💡 Use API config: apps/editor/src/config/api.ts"
  exit 1
fi

# 2. UI 変更時の E2E 同期チェック（warn のみ、ブロックしない）
sh "$(dirname "$0")/../scripts/test/check-e2e-sync.sh"
```

設計意図:
- API クライアント (`apps/editor/src/config/api.ts`) を強制し、URL 散在を防ぐ。
- E2E 同期は **警告のみ**。ブロックすると小修正コミットを阻害するため、判断は人間に委ねる。

### 1-3. `.husky/commit-msg`

役割: `/commit` スキル経由でしか作れない構造（感想 + Co-Authored-By）を強制。

```sh
#!/bin/sh
MSG_FILE="$1"
MSG=$(cat "$MSG_FILE")

case "$MSG" in
  Merge*|merge*) exit 0 ;;
esac

if ! echo "$MSG" | grep -q "Co-Authored-By:"; then
  echo "❌ Co-Authored-By がありません — /commit を使ってください"
  exit 1
fi

if ! echo "$MSG" | grep -q "^---$"; then
  echo "❌ 感想区切り（---）がありません — /commit を使ってください"
  exit 1
fi
```

意図: AI コミットの透明性（誰が書いたか・何を考えたか）を全コミットで担保する。

### 1-4. `.husky/pre-push`

役割: push 前に「壊れた状態が main に届く」確率を下げる。重い 4 段。

```sh
#!/bin/sh
echo "🚀 Pre-push checks..."

# 1. 型チェック
npm run typecheck || { echo "❌ Typecheck failed"; exit 1; }

# 2. Next.js lint（use* 等の React 違反を検出）
npm run lint -w apps/next || { echo "❌ Lint failed"; exit 1; }

# 3. dist 起動テスト — tsx で動くが node dist では動かない問題を検出
npm run build -w apps/hono 2>/dev/null
LOG=$(mktemp)
DATABASE_URL="postgresql://dummy:d@localhost:5432/d" JWT_SECRET=test STORAGE_MODE=local \
  node apps/hono/dist/index.js > "$LOG" 2>&1 &
PID=$!
sleep 3
kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
if grep -qE "ERR_|SyntaxError|Cannot find module|ReferenceError|TypeError" "$LOG"; then
  echo "❌ API dist startup failed:"
  grep -E "ERR_|SyntaxError|Cannot find|ReferenceError|TypeError" "$LOG" | head -5
  rm -f "$LOG"; exit 1
fi
rm -f "$LOG"

# 4. 設計ルール違反（架空アーキ違反検出）
npm run architecture:check || exit 1
```

設計意図:
- **dist 起動テスト**は経験則の塊。`tsx` は CommonJS 互換の path 解決を許すが、`node dist/*.js` は厳格。本番デプロイ後に「import パス間違い」で起動失敗するのを完全に防ぐ。
- 起動 3 秒・SIGKILL でリソース解放を保証。
- 全部 `exit 1` で必ず止める。`continue-on-error` 的な妥協はしない。

## 2. アーキテクチャ検査

### 2-1. `scripts/lint/architecture-check.sh`

4 つのルールを **「新規追加分（git diff）のみ Error」** で見る。既存違反は `--warn-existing` でのみ Warning 表示。

| Rule | 検出 | 抽出方法 |
|---|---|---|
| 1. no-direct-localstorage | `localStorage.{getItem,setItem,removeItem,clear}` 等 | `git diff HEAD --unified=0` の `^+` 行を grep |
| 2. no-cross-app-import | `from '...apps/<other-app>/...'` | 各 `apps/*/src/` を全文 grep |
| 3. no-new-wait-for-timeout | テストの `waitForTimeout` 新規追加 | git diff の追加行 |
| 4. c-zone-requires-design-note | C ゾーンファイル変更時の note 必須 | `git diff HEAD --name-only` ↔ パターン照合 |

要点:
- `git diff HEAD --unified=0 ... | grep '^+' | grep -v '^+++'` が新規行のみ抜き出す定番イディオム。
- 既存負債を `Warning` に分けたことで「ルール追加 → 即 push 不能」を回避し、新規コードのみ厳しく扱う。

C ゾーン対象（`architecture-check.sh` 内 `C_ZONE_PATTERNS`）:

```
packages/core/src/interfaces/
packages/core/src/types/Op.ts
packages/core/src/types/SaveData.ts
packages/interpreter/src/core/
packages/web/src/renderer/
apps/hono/src/routes/auth.ts
prisma/schema.prisma
```

note 検出は「直近コミットメッセージ」「staged `.md` の diff」「unstaged `.md` の diff」のいずれかに `Design Change Note` 文字列があれば OK。

### 2-2. package.json への配線

```jsonc
{
  "scripts": {
    "architecture:check":  "bash scripts/lint/architecture-check.sh",
    "architecture:report": "bash scripts/lint/architecture-report.sh"
  }
}
```

## 3. Sync テスト（最重要）

実装の単一情報源化を **テスト失敗で強制** する仕組み。

### 3-1. コマンド同期 — `packages/compiler/test/command-sync.test.ts`

`@xxx` を追加するときに 8 箇所の追従が要る（`CLAUDE.md` 参照）。このテストは「`commandRegistry.ts` に登録 → `compile()` の Op 出力」までの E2E を全コマンドで張る。**未登録コマンドは `TEXT_APPEND` 化するため、ここで即座に失敗する**。

イディオム:

```ts
const commandTestCases: Array<{ command: string; input: string; expectedOp: string }> = [
  { command: 'bg',      input: '@bg room_day',  expectedOp: 'BG_SET' },
  { command: 'ch_hide', input: '@ch_hide hero', expectedOp: 'CH_HIDE' },
  // ...
];
```

設計意図: 中央レジストリ (`commandRegistry.ts`) を **唯一の真実** にしているからこそ、登録漏れを 1 ファイルの修正だけで全テストに伝播できる。

### 3-2. スキーマ同期 — `apps/hono/test/schema-sync.test.ts`

```ts
it('assets テーブルに slug カラムが存在する', async () => {
  const result = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'slug'`;
  expect(result.length).toBe(1);
});

// finalize: 全モデルの findFirst を投げる（schema にあるカラムを SELECT するため、
// DB 側にカラムが無ければ即エラー）
await expect(prisma.user.findFirst()).resolves.not.toThrow();
await expect(prisma.asset.findFirst()).resolves.not.toThrow();
```

設計意図: `prisma migrate dev` し忘れた状態で deploy を防ぐ。CI で実 DB（Postgres service container）に対して走らせるのが必須。

## 4. CI（GitHub Actions）

### 4-1. `.github/workflows/ci.yml`

PR トリガー。job 構成:

```yaml
jobs:
  typecheck:        # tsc -b 全パッケージ
  lint:             # apps/next の eslint
  unit-tests:       # @kaedevn/core, compiler, interpreter （typecheck 後）
  unit-tests-apps:  # apps/editor, @kaedevn/next
  unit-tests-hono:  # services.postgres を立ててマイグレ → schema-sync 含むテスト
```

`unit-tests-hono` のキモ:

```yaml
services:
  postgres:
    image: postgres:16
    options: >-
      --health-cmd pg_isready --health-interval 10s
      --health-timeout 5s    --health-retries 5
steps:
  - run: npx prisma migrate deploy
  - name: Check for pending migrations
    run: |
      STATUS=$(npx prisma migrate status 2>&1)
      if echo "$STATUS" | grep -q "have not yet been applied"; then
        echo "::error::Pending Prisma migrations detected."
        exit 1
      fi
  - run: npm test -w @kaedevn/hono
```

- `migrate deploy` の後に `migrate status` を確認することで、**「ローカルで `migrate dev` 忘れ」** を CI でも検出できる（pre-push を抜けた場合の最終防衛線）。

### 4-2. `.github/workflows/check-hardcoded-urls.yml`

ソースだけでなく **ビルド成果物** も grep する。

```yaml
- run: |
    if grep -r "localhost:8080" apps/editor/src/ --exclude="api.ts" --exclude="frontend.ts"; then
      exit 1
    fi
- run: cd apps/editor && npm ci && npm run build
- run: |
    if grep -r "localhost:8080" apps/editor/dist/; then
      echo "❌ env vars not applied"
      exit 1
    fi
- run: |
    [ -f apps/editor/.env.production ] || { echo "❌ .env.production missing"; exit 1; }
```

設計意図: `.env.production` が CI に存在し、Vite の `import.meta.env` 置換が確かに走ったかを **ビルド後の dist の文字列で確認**。コードレビューで見落としがちな部分を機械化。

## 5. forbidden patterns（規約のみだがガードレールの一部）

`CLAUDE.md` で明文化、`architecture-check.sh` で部分的に機械化。

```ts
// NG → OK
localStorage.setItem(k, v)        →  await storage.set(k, v)         // IStorage 経由
sprite.position.set(320, 240)     →  sprite.position.set(layout.center.x, layout.center.y)
const r = await fetch('/api/...') →  const r = await apiClient.projects.list()
await page.waitForTimeout(2000)   →  await expect(locator).toBeVisible()
```

機械化済: localStorage（Rule 1）/ waitForTimeout（Rule 3）/ ハードコード URL（pre-commit + CI）。  
人間レビュー: ピクセル直書き / UI 層 fetch（パターンマッチが難しいため）。

## 6. Change Zones（責任の濃淡）

| ゾーン | 場所 | 求められるもの |
|---|---|---|
| A. 自由 | UI 文言、小コンポーネント、テスト追加、docs | 制限なし |
| B. 条件付き | store, api client, shared utils, route handler, command parser | 型チェック + テスト |
| C. 設計境界 | `packages/core/src/interfaces/`, `Op.ts`, `SaveData.ts`, `interpreter/core/`, `web/renderer/`, `auth.ts`, `prisma/schema.prisma` | Design Change Note 必須（push でブロック） |

Design Change Note のテンプレ:

```
## Design Change Note
- 何を変えるか:
- なぜ必要か:
- 依存方向は変わるか: Yes / No
- 既存抽象を再利用できない理由:
- 破壊的変更か: Yes / No
```

## 7. 別リポジトリへの再現手順

1. `husky` を `devDependencies` に入れて `"prepare": "husky"` を追加 → `npm install`。
2. `.husky/{pre-commit,commit-msg,pre-push}` を本書のスケルトンで作成し `chmod +x`。
3. `scripts/lint/architecture-check.sh` を持っていく。`C_ZONE_PATTERNS` をリポジトリの抽象境界に書き換える。
4. `package.json` に `architecture:check` / `typecheck` / `lint` / `test` を配線。
5. **コマンドや schema を抽象として持つ場合**、それぞれ `command-sync.test.ts` / `schema-sync.test.ts` 相当を書く（中央レジストリがあるなら、そこから自動展開できる形が理想）。
6. `.github/workflows/ci.yml` に `typecheck` / `lint` / `unit-tests` を分割して並列化。DB を使うテストは `services.postgres` を立てて `migrate deploy` + `migrate status` を含める。
7. ビルド出力にも grep をかける `check-hardcoded-urls.yml` を入れる（環境変数の事故防止）。
8. `CLAUDE.md`（または `AGENTS.md` / `.cursor/rules` 等）に **Forbidden patterns** と **Change Zones** を明文化する。
9. C ゾーンの実体（インターフェース・frozen schema）は、リポジトリで本当に変えたくないファイルだけに絞る。広げすぎると Note 疲労が起きる。

## 設計の指針（再現するときに失敗しないために）

- **新規違反のみエラー、既存はワーニング** に分ける（一気に直そうとすると進まない）。
- **dist 起動テストは安い割に効く**（3 秒で本番起動失敗の 9 割を捕まえる）。
- **「単一情報源 → 同期テスト」のセット**で抽象を守る。レジストリだけ作ってテストを書かないと結局散らかる。
- **ビルド成果物の grep** は env 起因の事故への最後の砦。ソース grep だけでは足りない。
- **commit-msg フックでメタ情報（Co-Authored-By・感想）を強制** すると、AI と人間の境目が後から追える。
