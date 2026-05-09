# このリポジトリのテスト全カタログ

## この文書の目的

`kaedevn-monorepo` には **162 個の `.test.ts`** + **75 個の `.spec.ts`（E2E）** + **C++ 単体テスト 89 件** が存在する。本書は **全テストの場所・目的・実行方法** をカタログ化し、**「どのテストが何を守っているか」** を一望できるようにする。

> 命名規則: `*.test.ts` = ユニット/統合（Vitest）, `*.spec.ts` = E2E（Playwright）

---

# 第 1 部 — テスト階層の全体像

```
kaedevn-monorepo/
├── tests/                             ← E2E (Playwright) 75 specs
│   ├── shared/                          ローカル/Azure 両対応
│   ├── local/                           ローカル専用 + 録画
│   ├── azure/                           Azure 本番専用（デプロイ後検証）
│   ├── next/                            Next.js 単体
│   ├── block-coverage/                  ブロック網羅
│   ├── snapshots/                       スクショ比較
│   └── configs/                         playwright config 6 種（docker 含む）
├── e2e/                               ← もう1つの E2E（KSC デモ用）
├── docker-compose.test.yml            ← Docker E2E 用フルスタック
├── scripts/test/docker-e2e.sh         ← ★ Azure NG を防ぐリリースゲート
│
├── apps/
│   ├── hono/test/                     ← API ユニット 63 ファイル
│   ├── editor/test/ + src/__tests__/  ← エディタ ユニット 15 ファイル
│   └── next/lib/                      ← Next.js ユニット 3 ファイル
│
├── packages/
│   ├── core/                          ← 抽象 + イベント + タイムライン
│   ├── compiler/                      ← .ks コンパイラ（コマンド同期含む）
│   ├── ksc-compiler/                  ← KSC コンパイラ + VM
│   ├── interpreter/                   ← インタプリタ（Phase 2〜A）
│   ├── web/                           ← PixiJS エンジン + システム
│   ├── ksc-vm-cpp/tests/              ← C++ 単体 + parity
│   ├── native-engine/tests/           ← C++ ネイティブ
│   ├── battle/                        ← バトル計算
│   ├── map/                           ← マップ検証
│   ├── i18n/                          ← 多言語
│   ├── ai-gateway/                    ← LLM 抽象
│   ├── entity-graph/                  ← ゲーム DB
│   └── tools/                         ← タイルセット生成
```

## 実行コマンド早見表

| コマンド | 走るもの |
|---|---|
| `npm test` | 全ユニット（core / compiler / interpreter / editor / next / hono） |
| `npm test -w {package}` | 1 パッケージのみ |
| `npm run test:e2e` | Playwright（`./e2e` の KSC デモ） |
| `npm run test:e2e:dev` | ローカル E2E（`tests/`） |
| **`bash scripts/test/docker-e2e.sh`** | **Docker E2E（Azure 相当の本番ビルド検証、リリースゲート）** |
| `npm run test:azure` | Azure 本番への E2E（デプロイ後検証） |
| `npm run test:demo` | 録画用 E2E |
| `npm run test:local` | `./scripts/test/local/e2e.sh`（CLI ラッパ） |
| `ctest --test-dir packages/ksc-vm-cpp/build` | C++ 単体 |

---

# 第 2 部 — Vitest ユニット/統合テスト

## 2-1. `apps/hono/test/` — API テスト（63 ファイル）

**責務**: 全 REST API エンドポイントの仕様検証、ミドルウェア、ライブラリ層、スキーマ同期。

### routes 系（API エンドポイント単位）

| ファイル | 守るもの |
|---|---|
| `auth.test.ts` | 認証フロー（ログイン/登録/JWT） |
| `projects.test.ts` | プロジェクト CRUD |
| `assets.test.ts` / `user-assets.test.ts` / `official-assets.test.ts` | アセット 3 階層 |
| `characters.test.ts` / `my-characters.test.ts` / `character-class.test.ts` | キャラクター |
| `works.test.ts` / `works-purchase.test.ts` | 作品公開・購入 |
| `wallet.test.ts` | ウォレット（ポイント・購入履歴） |
| `billing.test.ts` / `billing-verifiers.test.ts` / `billing-webhook.test.ts` | 課金（レシート検証 + Webhook） |
| `stamina-daily.test.ts` | スタミナ + 日次ボーナス |
| `cloud-saves.test.ts` | クラウドセーブ |
| `pages.test.ts` / `preview.test.ts` | エディタページ + プレビュー |
| `messages.test.ts` / `contact.test.ts` | メッセージ・問い合わせ |
| `gamedb.test.ts` / `genre-rules.test.ts` | RPG ゲーム DB + ジャンルルール |
| `maps.test.ts` | マップ |
| `videos-api.test.ts` / `thumbnails-api.test.ts` | 動画・サムネ |
| `analytics-api.test.ts` | アナリティクス |
| `admin.test.ts` / `admin-api.test.ts` | 管理画面 |
| `mcp.test.ts` | MCP プロトコル（RAG 検索） |
| `editor-schema.test.ts` | AI Metadata 静的スキーマ |
| `health.test.ts` | ヘルスチェック |
| `export.test.ts` | エクスポート |

### lib 系（ヘルパ層）

| ファイル | 守るもの |
|---|---|
| `lib-auth.test.ts` | 認証ユーティリティ |
| `lib-editor-schema.test.ts` | エディタスキーマ生成 |
| `lib-email.test.ts` | メール送信 |
| `lib-id.test.ts` | ID 生成 |
| `lib-validation.test.ts` / `validation.test.ts` | Zod 検証 |
| `cli-configs.test.ts` | CLI 設定 |

### middleware 系

| ファイル | 守るもの |
|---|---|
| `middleware-auth.test.ts` | 認証ミドルウェア |
| `middleware-admin.test.ts` | 管理者権限チェック |
| `middleware-error.test.ts` | エラーハンドラ |
| `middleware-logger.test.ts` | アクセスログ |
| `middleware-rate-limit.test.ts` | レート制限 |

### AI 執筆支援系（assist）

| ファイル | 守るもの |
|---|---|
| `assist-api.test.ts` | 執筆支援 API |
| `assist-rag.test.ts` / `assist-rag-api.test.ts` | RAG 検索 |
| `rag-hybrid.test.ts` | ハイブリッド検索 |
| `assist-vector-store.test.ts` | ベクトル DB |
| `assist-chunker.test.ts` / `assist-md-parser.test.ts` | Markdown 分割 |
| `assist-parser.test.ts` / `assist-schemas.test.ts` | パーサー / スキーマ |
| `assist-prompts.test.ts` | プロンプト生成 |
| `assist-context.test.ts` | コンテキスト構築 |
| `assist-ks-generator.test.ts` | .ks 生成 |
| `assist-cli-e2e.test.ts` | 執筆支援 CLI E2E |

### 構造系（リポジトリ全体検証）

| ファイル | 守るもの |
|---|---|
| `api-structure.test.ts` | API 構造の整合性 |
| **`schema-sync.test.ts`** | **Prisma schema と DB の同期**（マイグレ忘れ検出） |
| `azure-live.test.ts` | Azure 本番接続テスト |

> `schema-sync.test.ts` は前書 01「ガードレール」の中核。`prisma.user.findFirst()` の resolves チェックで「型と DB の乖離」を機械検出する。

## 2-2. `apps/editor/` — エディタ ユニット（15 ファイル）

```
apps/editor/test/
  api-config.test.ts              API 設定
  blockHelpers.test.ts            ブロック操作
  ch-expr-usage-examples.test.ts  キャラ表情
  inline-tag-e2e.test.ts          インラインタグ
  ksConverter.test.ts             ブロック → .ks 変換
  ksConverter-inline-tags.test.ts インラインタグ変換
  store.test.ts                   Zustand ストア
  textSegments.test.ts            テキスト分割
  types.test.ts                   型定義

apps/editor/src/__tests__/
  layout/layoutHelpers.test.ts          レイアウト
  runtime/GameState.test.ts             ゲームステート
  runtime/EventInterpreter.test.ts      イベントインタプリタ
  types/eventCommand.test.ts            イベントコマンド型
  utils/commandTree.test.ts             コマンドツリー
  utils/filterCategories.test.ts        フィルター分類
```

## 2-3. `packages/compiler/` — `.ks` コンパイラ（10 ファイル）

```
tokenizer.test.ts          字句解析
lineClassifier.test.ts     行分類（テキスト/コマンド/標準命令）
phase2.test.ts             パーサー Phase 2
phase3.test.ts             Phase 3
phase5.test.ts             Phase 5
ksConverter.test.ts        変換器
validator.test.ts          検証
integration.test.ts        統合
map.test.ts                マップ命令
command-sync.test.ts       ★ コマンド同期テスト
```

> **`command-sync.test.ts`** は前書 01 の中核。`COMMAND_PARSERS` レジストリに登録されている全コマンドが `compile()` で正しい `Op` を返すか E2E 検証。**未登録コマンドは即失敗** する仕掛け。

## 2-4. `packages/ksc-compiler/` — KSC コンパイラ + VM（8 ファイル）

```
lexer.test.ts              字句解析
parser.test.ts             構文解析
checker.test.ts            型チェック
emitter.test.ts            IR 出力
vm.test.ts                 TS VM 実行
async-function.test.ts     async / Promise 構文
triple-equals.test.ts      === / !==
billing-builtins.test.ts   billing 組み込み関数
```

KSC は **作者向け言語**（プログラミング寄り）。lexer→parser→checker→emitter→VM の **5 段パイプライン** に対応する 1:1 テスト。

## 2-5. `packages/interpreter/` — インタプリタ（19 ファイル）

```
Interpreter.test.ts             メイン
Interpreter.rpg.test.ts         RPG 拡張
Parser.test.ts                  パーサー
ConsoleEngine.test.ts           コンソールエンジン
TestEngine.test.ts              テスト用エンジン
Persistent.test.ts              永続変数
Debug.test.ts                   デバッグモード
ErrorHandling.test.ts           エラー
Integration.test.ts             統合
IntegrationSimple.test.ts       簡易統合
Phase2.test.ts                  Phase 2 機能
Phase3.test.ts                  Phase 3
Phase4.test.ts                  Phase 4
Phase5.test.ts                  Phase 5
Phase6.test.ts                  Phase 6
Phase8.test.ts                  Phase 8
PhaseA.test.ts                  Phase A
```

Phase 単位で **段階的に追加された機能** をそれぞれテスト化。107 ケース以上（CLAUDE.md の文書より）。

## 2-6. `packages/core/` — 共有抽象（11 ファイル）

```
test/
  commandSync.test.ts        コマンド同期
  LipSyncDriver.test.ts      リップシンク
  OpRunner.test.ts           Op 実行
  presets.test.ts            プリセット
  SaveData.test.ts           セーブデータ schema

src/events/__tests__/events.test.ts            イベントシステム
src/timeline/__tests__/easing.test.ts          タイムライン easing
src/timeline/__tests__/evaluator.test.ts       評価器
src/timeline/__tests__/validator.test.ts       検証
src/timeline/__tests__/integration.test.ts     統合
src/engine/__tests__/OpRunner.test.ts          Op 実行
```

`SaveData.test.ts` は **frozen schema**（save_schema_version: 1）の不変性検証。

## 2-7. `packages/web/` — PixiJS エンジン（10 ファイル）

```
test/
  equivalence.test.ts            等価性
  FlagSystem.test.ts             フラグ
  game-systems.e2e.test.ts       ゲームシステム E2E
  InventorySystem.test.ts        インベントリ
  KscHostAdapter.test.ts         KSC ホストアダプタ
  KscRunner.e2e.test.ts          KSC 実行 E2E
  resolveScenarioConfig.test.ts  シナリオ解決
  ScreenFilter.test.ts           53 種フィルター
  WebOpHandler.bgch.test.ts      背景・キャラ Op

src/systems/__tests__/EncounterSystem.test.ts  エンカウンター
```

## 2-8. その他のパッケージ

| パッケージ | テスト数 | 主な内容 |
|---|---|---|
| `packages/battle/__tests__/` | 5 | damage / experience / rng / simulate / status-effects |
| `packages/map/` | 2 | validate / autotile |
| `packages/i18n/src/__tests__/` | 4 | core / react / server / store |
| `packages/ai-gateway/__tests__/` | 4 | embedding / factory / mock |
| `packages/entity-graph/src/__tests__/` | 7 | analysis / balance / compiler / editor-api / runtime / validate / store |
| `packages/tools/test/` | 2 | tileset 生成 |

## 2-9. `apps/next/lib/` — Next.js ユニット（3 ファイル）

```
ad-config.test.ts        広告設定
ad-helpers.test.ts       広告ヘルパ
id.test.ts               ID 生成
```

---

# 第 3 部 — Playwright E2E テスト

## 3-1. 設定ファイル（5 種類）

| 設定 | 対象 | baseURL | 用途 |
|---|---|---|---|
| `playwright.config.ts` | `./e2e` | localhost:5175 | KSC デモ |
| `playwright.local.config.ts` | `./tests` | localhost:3000 | ローカル E2E |
| `playwright.azure.config.ts` | `./tests` | Azure Next.js | Azure 本番 |
| `playwright.azure-full.config.ts` | `./tests` | Azure | フル E2E |
| `playwright.docker.config.ts` | `./tests` | Docker | Docker 環境 |
| `playwright.recording.config.ts` | `./tests/local/recording` | local | デモ録画 |

## 3-2. `tests/shared/` — ローカル/Azure 両対応（41 specs）

| カテゴリ | spec | 守るもの |
|---|---|---|
| **auth** (4) | auth-flow / local-auth / verify-cookie / auth-redirect | ログイン・登録・Cookie・リダイレクト |
| **admin** (1) | admin-panel | 管理画面 |
| **assets** (5) | asset-selection / asset-management / admin-official-assets(-check) / asset-search-ui | アセット 3 階層 + 検索 |
| **battle** (4) | battle-admin / battle-gamedb / battle-block / battle-play | バトル |
| **camera** (1) | camera-block | カメラ操作 |
| **editor** (n) | editor-blocks / editor-mobile / ksc-block | エディタ各機能 |
| **flow** (n) | full-flow / mypage / docs-verify / comprehensive-nav | エンドツーエンド導線 |
| **guest** (7) | guest-editor-blocks / guest-fantasy-assets / guest-verify / guest-empty-debug / guest-direct-url / guest-multi-session / guest-upgrade | 未登録ユーザー体験 |
| **integration** (1) | frontend-separation | フロント分離 |
| **ksc-editor** (4) | ksc-editor / ksc-inline-commands / ks-editor-sync / ksc-default-script | KSC エディタ |
| **timeline** (n) | tl-keyframe-ui / timeline-panel / timeline-block / timeline-block-real / timeline-props-seek | タイムライン編集 |
| **other** (2) | visual-logic-verify / test-import | 視覚論理 / インポート |

## 3-3. `tests/local/` — ローカル専用（16 specs）

```
editor-import-verify.spec.ts       インポート検証
editor-verify-01KKDX2W.spec.ts     特定プロジェクト検証

docs/                              ドキュメント用スクショ撮影 7 specs
  capture-block-guide.spec.ts
  capture-asset-management.spec.ts
  capture-mypage-guide.spec.ts
  capture-ogp-images.spec.ts
  capture-project-page-guide.spec.ts
  capture-timeline-guide.spec.ts

recording/                         デモ動画録画 8 specs
  bg-showcase / block-showcase / camera-operations / create-add-blocks /
  edit-character-properties / effect-showcase / press-demo /
  press-preview-only / record-demo / timeline-operations /
  block-coverage-showcase
```

`docs/` 配下は **ドキュメント自動生成**（playwright が画面撮影 → docs に挿入）。`recording/` 配下は **YouTube 投稿用デモ動画**を録画する。

## 3-4. **Docker E2E テスト — Azure で NG にならないための事前検証**（最重要）

**`scripts/test/docker-e2e.sh` + `tests/configs/playwright.docker.config.ts` + `docker-compose.test.yml`**

### 何のためのテストか

Azure（Container Apps + Static Web Apps）にデプロイすると、ローカルの `tsx` / `vite dev` ではなく **`node dist/index.js`** と **`next start`** が動く。**この差で本番だけ落ちる**事故を防ぐのが Docker E2E。

> 「ローカルで動いた」が「Azure で動かない」になる典型ケース:
> - tsx が拾う `import './foo'` を `node dist/foo.js` が拒否する（ESM 解決）
> - Vite dev のホットリロードで隠れていたビルド時エラー
> - `next dev` で見えていたが `next build` 後の SSR / SSG で割れるページ
> - 環境変数の `NEXT_PUBLIC_*` がビルド時置換されていない

これらは pre-push の dist 起動テスト（API のみ）では捕まえきれない統合層の事故。**Azure に上げる前にローカルで本番相当環境を立てて確認する** のが Docker E2E の役割。

### 起動構成

`docker-e2e.sh` が以下を **自動オーケストレーション**:

```
1. ポート競合解消（3000 / 8080 / 5176 / 5175 を kill）
2. PostgreSQL を Docker で起動（ankane/pgvector port 5433）
3. ビルド:
   - core + battle ブートストラップ（Dockerfile と同手順）
   - npm run build -w apps/hono   → apps/hono/dist/
   - npm run build -w apps/next   → apps/next/.next/
4. DB マイグ + シード（prisma db push + db seed）
5. サービス起動:
   - API:     node apps/hono/dist/index.js  port 8080  NODE_ENV=production
   - Next.js: next start                    port 3000  NODE_ENV=production
6. ヘルスチェック（/api/health, /）
7. ウォームアップ:
   主要ページ（/ /login /register /mypage /docs /mypage/wallet /my-assets /privacy）に
   curl して SSR を事前コンパイル
8. Playwright 実行（playwright.docker.config.ts）
9. クリーンアップ（API/Next kill, postgres stop）
```

### Azure と何が同じで何が違うか

| 項目 | Azure 本番 | Docker E2E（このテスト） | ローカル dev |
|---|---|---|---|
| API 起動 | `node dist/index.js` | **`node dist/index.js`** | `tsx watch` |
| Next.js | `next start` | **`next start`** | `next dev` |
| DB | Azure Postgres | Docker pgvector | ローカル Postgres |
| 環境変数置換 | ビルド時 | **ビルド時** | dev サーバ動的 |
| **これで捕まる事故** | — | **Azure と同じ事故が出る** | 出ない |

つまり Docker E2E は **「Azure 環境のミニチュア」**。テストが緑なら **Azure でも高確率で緑**。

### 除外しているテスト（`testIgnore`）

リリースブロッカーになり得ない / 不安定なテストは除外:

```
RPG/ツクール系 (gamedb-editor, map-editor, tsukuru-blocks, template-editor, layout-editor)
ゲスト系 (multi-session, upgrade, verify, direct-url, editor-blocks, empty-debug)
   ↑ レートリミットで flaky
バトル系 (battle-admin, battle-gamedb, battle-block)
課金 (purchase-flow)
サムネイル API (seed 依存で不安定)
管理画面 (admin-panel)
WIP (live2d-block, live2d-run)
```

「リリースには不要」「flaky」「seed 依存」「未実装」を **明示的に隔離** している。残ったテストが緑なら本番投入可。

### 期待値

- **約 72 テスト / 0 failed / 約 60 秒**
- ALL PASSED が出れば **本番デプロイ可能**

### 呼び出し方

```bash
bash scripts/test/docker-e2e.sh                    # 全実行
bash scripts/test/docker-e2e.sh -g "auth"          # フィルタ
```

Claude Code 経由なら **`/docker-test`** スキル（"dockerテスト" / "リリース前テスト" / "本番テスト" 等のトリガー）。

### 他のテストとの使い分け

| 目的 | コマンド | 所要時間 |
|---|---|---|
| **リリース前確認（推奨）** | `bash scripts/test/docker-e2e.sh` | **~60 秒** |
| Azure 本番への E2E | `npm run test:azure` | ~20 分 |
| ローカル dev テスト（毎日の開発時） | `npm run test:e2e:dev` | ~27 分 |

**60 秒で 20 分相当の本番リスクを潰せる** のが Docker E2E の費用対効果。

### なぜこれが「壊れない仕組み」の中核なのか

Phase 1 完了レポートや Phase 2 で繰り返し効いている流れ:

```
コード変更
   ↓
git push (pre-push)
   ├─ typecheck
   ├─ lint
   ├─ dist 起動テスト (API のみ、3 秒)
   └─ architecture-check
   ↓
GitHub Actions CI（unit + schema-sync）
   ↓
[ Docker E2E ]  ← ここで Azure 相当を確認
   ↓
git push origin main
   ↓
Azure 自動デプロイ
   ↓
post-deploy: tests/azure/* ← 念押し
```

Docker E2E は **デプロイ前最後の砦**。これがあるから Azure に出してから「動かない」が起きにくい。

## 3-5. `tests/azure/` — Azure 本番専用（8 specs、デプロイ後検証）

```
azure-asset-selection.spec.ts
azure-create-and-play.spec.ts
azure-full-flow.spec.ts
azure-ks-editor.spec.ts
azure-landing-links.spec.ts
azure-manual-verify.spec.ts
azure-project-init.spec.ts
check-azure-editor.spec.ts
```

**本番デプロイ後に走らせる health check**。Azure 固有の挙動（CORS / SPA fallback / SWA リダイレクト / Front Door 経由）を検証。Docker E2E が「事前検証」なら Azure E2E は「事後検証」。

補助スクリプト群（`scripts/test/azure/`）:

```
api.sh           API 単体ヘルスチェック
auth.sh          認証フロー
e2e.sh           E2E ラッパ
editor-api.sh    エディタ API
env.sh           環境変数確認
health.sh        全サービスヘルス
ks-editor.sh     KSC エディタ
landing-links.sh ランディング全リンク
run-all.sh       全部走らせる（~20 分）
security.sh      セキュリティ
```

## 3-5. `tests/next/` — Next.js 単体（7 specs）

```
smoke/landing.spec.ts          ランディング基本
smoke/public-pages.spec.ts     公開ページ
auth/login.spec.ts             ログイン
auth/register.spec.ts          登録
auth/redirect.spec.ts          リダイレクト
private/projects.spec.ts       プロジェクト一覧
private/mypage.spec.ts         マイページ
```

## 3-6. `tests/block-coverage/` — ブロック網羅

```
phase2-compiler/blocks-to-ksc.test.ts   全ブロック型 → KSC への変換網羅
```

エディタが扱う **14 ブロック型** を全て KSC に変換できることを検証。

## 3-7. `tests/snapshots/` — スクショ比較

```
diffs/  ビフォー・アフタースクショ差分
```

UI のリグレッション検出。

## 3-8. `e2e/` — KSC デモ用 E2E

```
capture-map-editor.spec.ts
run-map-success.spec.ts
run-map-victory.spec.ts
test-mobile-ui.spec.ts
```

`localhost:5175/ksc-demo.html` 上で動作するデモゲームの動作確認。

---

# 第 4 部 — C++ テスト（packages/ksc-vm-cpp + native-engine）

## 4-1. `packages/ksc-vm-cpp/tests/` — KSC VM C++（87 + 21 ケース）

### unit（89 ケース、Google Test）

| ファイル | 件数 | 守るもの |
|---|---|---|
| `IRLoaderTest.cpp` | 13 | IR JSON / CBOR ロード、自動判別、双方向変換 |
| `ValueTest.cpp` | 16 | Value 型（number / string / array / object / null） |
| `KscVMTest.cpp` | 60 | 全 37 opcode、制御フロー、シリアライズ |

### parity（21 ケース、TS/C++ bit-exact 比較）

```
fixtures/      IR JSON 12 件（loop / arrays / switch / nested-calls 等）
sources/       .ksc ソース 7 件（algebra / billing / loop / object / array / function）
run_cpp.cpp    C++ ランナー
```

**TS VM と C++ VM の出力が bit-exact 一致** することを検証。**Phase 1 の中核ガードレール**。

## 4-2. `packages/native-engine/tests/` — ネイティブエンジン（32 ケース）

```
OpRunnerTest.cpp              9 ケース   Op 実行
PakReaderTest.cpp             7 ケース   pak ファイル読み込み
BillingHostBindingTest.cpp   12 ケース   KSC ↔ IBilling 配線
AssetProviderTest.cpp         3 ケース   アセット供給
ScreenshotTest.cpp            1 ケース   スクショ
```

`ctest --test-dir build` で実行。Switch / Android / iOS の共通基盤を検証。

---

# 第 5 部 — テストの種類別分類

## 5-1. ガードレール系（壊れない仕組みの一部）

| テスト | 役割 | 詳細 |
|---|---|---|
| `command-sync.test.ts` | コマンドレジストリ整合性 | 8 箇所追従の検出 |
| `core/test/commandSync.test.ts` | core 側のコマンド同期 | 同上の Op 型側 |
| `schema-sync.test.ts` | Prisma schema ↔ DB | migrate dev 忘れ検出 |
| `parity/run_cpp.cpp` | TS/C++ bit-exact 一致 | 移植誤差ゼロ |
| **`docker-e2e.sh`** | **Azure NG の事前検出** | **本番相当ビルドで Playwright 72 件を ~60 秒で走らせる** |

## 5-2. ユニットテスト（純ロジック）

- `packages/battle/__tests__/` — ダメージ計算、確率、状態異常
- `packages/interpreter/test/` — 言語仕様の確認
- `apps/hono/test/lib-*.test.ts` — ヘルパ層
- `apps/editor/src/__tests__/` — エディタロジック

## 5-3. 統合テスト

- `Integration.test.ts`（interpreter）
- `game-systems.e2e.test.ts`（web、Vitest だが E2E 名）
- `KscRunner.e2e.test.ts`
- `*.test.ts` のうち API ルート系全般

## 5-4. E2E テスト（Playwright）

- `tests/shared/` — メインの E2E
- `tests/azure/` — 本番検証
- `tests/next/` — Next.js 専用

## 5-5. リグレッション系（自動化された確認）

- `tests/snapshots/` — スクショ差分
- `tests/local/docs/` — ドキュメント自動撮影
- `block-coverage/` — 14 ブロック全網羅

## 5-6. デモ/録画系

- `tests/local/recording/` — YouTube デモ動画録画
- `e2e/capture-*.spec.ts` — マップエディタデモ

---

# 第 6 部 — テスト実行のレイヤ構造

## ローカル開発時

```
コード変更
   ↓
保存（pre-commit フックは走らない）
   ↓
git commit
   ↓ pre-commit
   ├─ ハードコード URL チェック
   └─ E2E 同期チェック（warn）
   ↓
git push
   ↓ pre-push
   ├─ npm run typecheck（全パッケージ）
   ├─ npm run lint -w apps/next
   ├─ dist 起動テスト（apps/hono）
   └─ architecture:check
```

## CI（GitHub Actions `.github/workflows/ci.yml`）

| Job | テスト |
|---|---|
| typecheck | 全パッケージ tsc -b |
| lint | apps/next |
| unit-tests | core / compiler / interpreter |
| unit-tests-apps | editor / next |
| unit-tests-hono | hono（Postgres service container 立てて migrate deploy → schema-sync 含む全テスト） |

## デプロイ前（Docker E2E — リリースゲート）

```
ローカルで本番相当環境を立てる:
  ├─ docker compose で postgres
  ├─ apps/hono を build → node dist/index.js
  ├─ apps/next を build → next start
  └─ Playwright（docker config）で 72 テスト

緑になったら main へ push → Azure 自動デプロイ
```

`bash scripts/test/docker-e2e.sh` 1 発で約 60 秒。**Azure で NG にならないための事前検証**。

## デプロイ後

| 種類 | テスト |
|---|---|
| post-deploy-checks | `tests/azure/` の 8 specs + ヘルスチェック |
| 補助スクリプト | `scripts/test/azure/run-all.sh`（~20 分） |
| 手動 | `npm run test:azure` |

## C++ ビルド後

```
cmake --build build
ctest --test-dir build      ← unit + parity 全部走る
```

---

# 第 7 部 — 「テストを書く時のルール」（CLAUDE.md より）

このリポジトリでテストを書く時の鉄則:

1. **`expect` は期待する状態を 1 つだけ明示**（`expect([200, 500]).toContain()` 禁止）
2. **`if` で `expect` をスキップしない**（フォールバック・エラー握りつぶし禁止）
3. **`waitForTimeout` でごまかさず正しい条件を待つ**（`waitForSelector` / `expect().toBeVisible()`）
4. **失敗したら原因調査 → コード修正**。テストを緩めない
5. **Azure 向けは適切なタイムアウトを明示**

> これらは `.husky/pre-push` の `architecture-check.sh` で機械的に強制される（Rule 3: `waitForTimeout` 新規追加禁止 等）。

---

# 第 8 部 — 数値サマリ

## ファイル数

| 種類 | 数 |
|---|---|
| Vitest `.test.ts` | **162** |
| Playwright `.spec.ts` | **75** |
| C++ Google Test ファイル | **8**（unit 3 + native-engine 5） |

## 推定ケース数

| 領域 | ケース数（目安） |
|---|---|
| KSC VM C++ unit | 89 |
| KSC VM C++ parity | 21 |
| native-engine | 32 |
| hono API + lib | ~500（63 ファイル × 平均 8 ケース） |
| compiler | ~150 |
| interpreter | ~107（CLAUDE.md より） |
| ksc-compiler | ~80 |
| editor | ~100 |
| その他 packages | ~120 |
| Playwright E2E | 75 specs × 平均 2〜5 ケース |
| **合計（概算）** | **~1,500 ケース** |

---

# 第 9 部 — テストを「読む」順番（初心者向け）

新規参加者がリポジトリを理解する近道:

1. **`apps/hono/test/auth.test.ts`** — REST API テストの典型例
2. **`packages/compiler/test/command-sync.test.ts`** — 「単一情報源 + 同期テスト」の真髄
3. **`apps/hono/test/schema-sync.test.ts`** — Prisma 整合性
4. **`packages/ksc-vm-cpp/tests/parity/run_cpp.cpp`** — bit-exact 移植検証
5. **`tests/shared/auth/auth-flow.spec.ts`** — Playwright E2E の基本形
6. **`tests/azure/azure-full-flow.spec.ts`** — 本番 E2E
7. **`packages/interpreter/test/Phase5.test.ts`** — 機能の段階追加例

これらを順に読めば、**「何を、どの粒度で、どう守っているか」** が把握できる。

---

# 結論

このリポジトリのテストは **6 層 + 横断ガードレール** の構成:

1. **Unit（純ロジック）** — 各パッケージの `*.test.ts`
2. **Integration（API + lib）** — `apps/hono/test/`
3. **E2E（ブラウザ）** — `tests/`, `e2e/`
4. **Parity（言語間整合性）** — `packages/ksc-vm-cpp/tests/parity/`
5. **C++ Native** — `packages/native-engine/tests/`
6. **Docker E2E（リリースゲート）** — `scripts/test/docker-e2e.sh` ← **Azure で NG にならないための事前検証**

横断的には:
- **Sync テスト**（command-sync / schema-sync）が「単一情報源」を守る
- **dist 起動テスト**（pre-push）が ESM 解決の壁を越える
- **Docker E2E**（pre-deploy）が **本番ビルドの事故を 60 秒で潰す**
- **Azure E2E**（post-deploy）が本番健全性を担保

「ローカルで動いた」と「本番で動く」の間にある壁を、**Docker E2E がローカルに本番ミニチュアを再現**して埋めている。これが「Azure に出してから慌てる」を防いでいる中核の仕組み。

「テストを書く目的は **エラーの発見** と **正常動作の確認**」（CLAUDE.md）。  
**1,500 ケース** が `npm test` + `npm run test:e2e` + `ctest` の 3 コマンドで走る。これがリポジトリの「壊れない」を実装している。
