# 追加すべき実施例リスト — IT 経験者・生成 AI 初心者向け

## この文書の位置付け

`docs/09_reports/2026/04/25/01〜09` で書いたシリーズで触れていない、**このリポジトリで実装されている AI 連携・自動化・運用パターン** を一覧化する。各項目について **「なぜ追加すべきか」+「具体的に書ける実例」** を示し、必要に応じて個別文書化できるようにする。

> 想定読者: **IT 経験者だが生成 AI 開発は初心者** — 「コード書ける人が AI を真剣に使うとここまで変わる」を見せる事例集。

## 既存文書のカバー範囲

| # | 文書 | 主題 |
|---|---|---|
| 01 | guardrails-reproduction | ガードレール再現手順 |
| 02 | guardrails-ts-techniques | TS 特有の技法 |
| 03 | typescript-with-genai | TS が AI と相性が良い理由 |
| 04 | document-implementation-workflow | 設計→計画→実装→テスト |
| 05 | rag-search-system | RAG 検索の自前実装 |
| 06 | commit-message-conventions | コミット慣行 |
| 07 | workflow-actual-elapsed-time | 実所要時間 |
| 08 | cli-via-ai-prompts | CLI を AI 経由で |
| 09 | all-tests-overview | 全テスト + Docker E2E |

未カバーの実例を **優先度別** にリストアップする。

---

# A 級 — 単独文書を書く価値あり（10 件）

## A-1. **MCP サーバーを自前で立てる方法**

**実体**: `apps/hono/src/routes/mcp.ts`（`POST /mcp`、認証不要）

### なぜ書くべきか

RAG 検索の文書（05）では「MCP 経由で Claude Code が呼ぶ」と触れたが、**MCP サーバーを自分で立てて Claude Code から使う手順** は単独文書化の価値がある。Cursor / Claude Code を使う多くの人が「MCP を自分で作る」を未踏のまま。

### 書ける実例

- `tools/list` と `tools/call` の最小実装（80 行）
- 認証不要で Claude Code に登録する設定
- ツール返答フォーマット（`{type:'text', text:...}`）の作法
- Recommended パターン：応答に `read_file("...")` を埋めて Claude を誘導
- 自分のリポジトリに「`search_docs`」「`get_project`」「`run_test`」などを足す指針

## A-2. **31 個のスキル設計パターン**

**実体**: `.claude/skills/` 配下 31 ディレクトリ

### なぜ書くべきか

文書 08（CLI を AI 経由で）でスキル一覧を表で出したが、**「自分のプロジェクトでスキルをどう設計するか」** の方法論を書いた文書がない。スキルは Claude Code を **「お抱えのオペレーター」** に変える鍵。

### 書ける実例

- スキルの YAML frontmatter（`description` / `triggers` 設計）
- **トリガー語の良い例 / 悪い例**（"コミットして" は OK、"やって" は NG）
- 手順を「**箇条書き → 実行コマンド**」で書く構造
- `Design Change Note` のような **自動的に挿入させる定型文** の埋め方
- スキル間の連携（`/commit` → `/push` → `/deploy-azure`）
- スキルが既存スクリプト（`scripts/dev-start.sh`）を呼ぶ層別化

## A-3. **Hooks による安全弁**

**実体**: `.claude/settings.json` の `PreToolUse` / `PostToolUse`

### なぜ書くべきか

このリポジトリは Claude Code 自身に対して **PreToolUse フックで `.env` 書き換えを拒否**、**PostToolUse で oxlint 自動実行**している。「AI に任せたいが事故が怖い」人への核心テクニック。

### 書ける実例

```jsonc
"PreToolUse": [{
  "matcher": "Write|Edit",
  "hooks": [{ "command": "case $FILE in *.env|*.env.*) echo BLOCKED; exit 2;; esac" }]
}],
"PostToolUse": [{
  "matcher": "Write|Edit",
  "hooks": [{ "command": "npx oxlint $FILE" }]
}]
```

- AI への「物理的な禁止」の作り方（`exit 2` で拒否）
- 編集後に lint を自動 → AI が結果を読んで自己修正
- Bash 実行に対するフックで destructive 防御

## A-4. **AI Metadata API（`_ai_context`）— ハルシネーションを構造的に防ぐ**

**実体**: `GET /api/projects/:id` の `_ai_context`、`GET /api/editor-schema`

### なぜ書くべきか

文書 03 で 1 節触れたが、これは **AI 時代の API 設計の中核** で単独文書化の価値が高い。「LLM に正しい ID を使わせる」唯一の方法は、**静的型 + ランタイムデータ提供** の合わせ技だと示せる。

### 書ける実例

```
GET /api/editor-schema
  → 全 14 ブロック型・制約・enum、24h キャッシュ、認証不要

GET /api/projects/:id
  → response.data + response._ai_context
     ├─ availableAssets[]: { id, name, category }
     ├─ availableCharacters[]: { id, name }
     ├─ availablePages[]: { id, title }
     └─ knownVariables: Record<string, type>
```

- AI が `availableAssets[0].id` を呼べば **必ず実在する**
- 「読み取り専用」と明示して AI に書き換えさせない
- 静的スキーマ（型）+ 動的コンテキスト（実データ）の二段構え
- これが無いと AI が `"asset-12345"` のような **存在しない ID** を平気で書く

## A-5. **Multi-AI 並列開発（Claude Code + Gemini CLI）**

**実体**: `docs/09_reports/` (Claude) + `docs/10_ai_docs/` (Gemini) の物理分離

### なぜ書くべきか

文書 04 で触れたが、**「2 AI を並列で走らせる」運用ノウハウ** を独立で書く価値がある。Claude / Gemini / Cursor を全部使う人にとっての実践ガイド。

### 書ける実例

- 計画は Claude、設計は Gemini に **役割分担**（強みの違い活用）
- 出力先を物理分離 → 同名衝突なし、後で `grep` で AI ごとに切り出せる
- `CLAUDE.md` と `GEMINI.md` を同期する仕組み（または共通参照）
- 「Gemini が書いたものを Claude がレビュー」の **AI ↔ AI クロスレビュー**
- 価格・コンテキスト窓・速度のトレードオフ表

## A-6. **broken-memo パターン — 失敗を集約する**

**実体**: `.claude/skills/broken-memo/`、`docs/09_reports/.../*-broken-items.md`

### なぜ書くべきか

テスト失敗を **「同日のメモファイル」に集約** し、修正時に消し込む運用。**AI が手を伸ばしやすいデバッグの足場** として優秀なパターン。

### 書ける実例

- 自動トリガー: テスト失敗で skill が発動、メモに追記
- 「原因 A / B / C / D」のような **複数仮説をメモに併記**（VRM 増殖問題で実観測）
- 修正済みになったら同じ skill が「✅ 修正済み」に更新
- 別セッションでも `Read` してすぐ続きから再開できる
- postmortem との違い（broken-memo は WIP、postmortem は完了後）

## A-7. **devlog — git log から開発日誌を生成**

**実体**: `.claude/skills/devlog/`、`docs/landing/devlog/{YYMM}/`

### なぜ書くべきか

**「コミットを公開ブログ的な文章に変換する」** ノウハウ。コミットメッセージの感想ブロック（文書 06）と組み合わせると、**毎日の開発が自動でストーリー化** される。

### 書ける実例

- `git log --since="今日" --pretty=format:...` のフォーマット
- 感想ブロックを抜き出して並べる
- 各コミットの subject + 感想 = 一次草稿
- AI がそれを整形して **読み物** にする
- `docs/landing/devlog/` に保存 → Next.js が自動公開
- このリポジトリは **数十本の devlog** が生まれている実績あり

## A-8. **Phase 単位の段階実装パターン（A → B → C → D → E）**

**実体**: VRM 実装の Phase A〜E、Phase 1 の Day 1〜26

### なぜ書くべきか

「**1 セッションで完走する**」ための分解法。VRM が 1 日で 14 表情まで動いたのは、Phase A（最小ロード）→ B（シェーダー）→ C（表情）→ D（物理）→ E（歩行）と **「動く状態を保ちながら段階的に積む」** 戦略のおかげ。

### 書ける実例

- 各 Phase は **直前で「動く」状態にする**
- 各 Phase ごとに 1 commit、各 commit が緑
- Phase B+ のような「強化」段階を後付けできる構造
- ふりかえり（postmortem）が Phase 単位で書ける
- AI が「次の Phase」を自然に把握できる

## A-9. **assist パッケージ — AI 執筆支援を自前実装する**

**実体**: `apps/hono/src/lib/assist/` (chunker / md-parser / parser / hybrid-rag / vector-store / ks-generator / prompts / schemas / context)

### なぜ書くべきか

「**LLM をユーザー向け機能に組み込む方法**」の参考実装。設定ファイル（YAML frontmatter md）→ chunk → embedding → DB → 検索 → プロンプト合成 → Claude API → `.ks` 生成 のフルパイプライン。

### 書ける実例

- `WorkSetting` 型（overview / world / characters / history / plot / episodes）
- chunk 化の戦略（character ごとに 1 chunk）
- 設定ファイル parser（md frontmatter + body）
- `genre-rules` で genre 別の生成制約
- prompts.ts のテンプレート設計
- ks-generator が **構造化出力**（@bg / @ch / @text）を返す

## A-10. **`@kaedevn/ai-gateway` — LLM プロバイダ抽象**

**実体**: `packages/ai-gateway/` (factory + 7 プロバイダ実装)

### なぜ書くべきか

OpenAI / Anthropic / Google を **同一インターフェース** で叩ける薄い抽象。コスト最適化（プロバイダ切り替え）を実装した好例。

### 書ける実例

```ts
import { createEmbeddingClient, createChatClient } from '@kaedevn/ai-gateway';

const embClient = createEmbeddingClient('openai', { apiKey });
const chatClient = createChatClient('anthropic', { apiKey });

// 切り替え 1 行で
const embClient2 = createEmbeddingClient('google', { apiKey });
```

- providers/{openai, anthropic, google, mock}
- mock 実装がテストで効く（`mock-embeddings.test.ts`）
- 戻り値型を統一（`EmbedResult` など）
- factory パターンの教科書例

---

# B 級 — 既存文書に節として追記、または短い文書（8 件）

## B-1. **Open Core OSS 戦略 — 商用 vs OSS の境界**

**実体**: `packages/interpreter/` のみ OSS、それ以外（エディタ・サーバー）は商用

### 書ける内容

- なぜ Apache 2.0（特許条項 + 企業採用率）
- DCO vs CLA の判断
- 別リポ（`kaedevn`）への rsync 同期方式（`/sync-oss` skill）
- 商標保護（Apache 2.0 は商標保護しない）

## B-2. **frozen schema 戦略（SaveData v1）**

**実体**: `packages/core/src/types/SaveData.ts`

### 書ける内容

- リテラル型 `save_schema_version: 1` で固定
- 後方互換のための設計（reference IDs only、no embedded media）
- C ゾーンに置いて Design Change Note を強制
- 「embed しない」ルールが Switch 移植性を確保した経緯

## B-3. **「IR が境界」原則**

**実体**: KSC コンパイラ（TS）+ KSC VM（C++）

### 書ける内容

- コンパイラを TS に固定、VM のみ C++ 移植
- IR JSON / CBOR が **唯一の境界**
- TS/C++ parity で bit-exact 保証
- Switch / Android / iOS で同じ IR が動く
- なぜコンパイラを移植しないか（移植コストが境界の場所で決まる）

## B-4. **抽象インターフェース 4 兄弟（IInput / IAudio / IStorage / IBilling）**

**実体**: `packages/core/src/interfaces/`

### 書ける内容

- 各インターフェースの責務
- Web 実装（PixiJS / WebAudio / IndexedDB）vs Native 実装（SDL2 / OpenSL / 各プラットフォーム）
- 「なぜ rendering（PixiJS）は抽象化しないか」の判断
- C ゾーンで保護されている理由

## B-5. **dev-start.sh の自動化オーケストレーション**

**実体**: `scripts/dev-start.sh`、`/dev-server` skill

### 書ける内容

- 既存プロセス停止 → DB 確認 → npm install → 全サーバー起動
- 5 サーバー（Next / Hono / Editor / KSC Editor / Web）の並列起動
- ヘルスチェック付き起動
- バックグラウンド起動 + ログ集約
- AI が「サーバー起動して」で済む理由

## B-6. **Prisma migrate の二段運用**

**実体**: `npx prisma migrate dev` (ローカル) + `migrate deploy` (本番) + `migrate status` (CI 検出)

### 書ける内容

- dev で履歴付きマイグレ生成、deploy で履歴を本番に適用
- `migrate status | grep "have not yet been applied"` で漏れ検出
- schema-sync テストとの二重防衛
- `db push` は seed 用（履歴なし）

## B-7. **i18n 戦略（ja / en / zh-TW）**

**実体**: `apps/next/lib/i18n/`、`packages/i18n/`

### 書ける内容

- Next.js + Hono 両方で i18n（API エラーメッセージも多言語）
- `landing.subtitle` のような **キーベース** 翻訳
- 翻訳ファイルの追従テスト（`tests/shared/...`）
- AI がランディング更新時に多言語を **同時更新** した事例

## B-8. **scheduled / loop パターン — AI 自身がタイマー処理**

**実体**: `/schedule` `/loop` スキル、ScheduleWakeup

### 書ける内容

- 「2 週間後に Capacitor フラグ削除 PR を出して」を予約
- ループで 5 分ごとに deploy 状況確認
- 自律実行のセキュリティ境界
- 「AI が自分でカレンダーを管理する」感覚

---

# C 級 — 1 ページコラム or FAQ 級（10 件）

## C-1. backup スクリプト群（`scripts/db/backup-*.sh`）

PostgreSQL 自動バックアップ + リストアテスト + 日次状態確認 + Azure Blob 保存。`/backup-test` のようなスキルは無いが、**運用自動化** の好例。

## C-2. asset 解析パイプライン

`scripts/db/analyze-all-assets.mjs` + `apply-vision-metadata.mjs` + `generate-asset-embeddings.mjs`。**Vision API でアセットを自動タグ付け**してベクトル検索可能にする一連の流れ。

## C-3. CLI スキャフォールダー (`scripts/cli/_template.mjs`)

新規 CLI スクリプトのテンプレート。env 読み込み + DB 接続 + ロギング統一。「スクリプトを書きたい」を 1 分で開始。

## C-4. ks-to-project (genre 別)

`ks-to-project-comedy.mjs` `-mystery.mjs` `-horror.mjs` 等。**ジャンル別プロンプト**で `.ks` を量産する仕組み。

## C-5. screenshot 自動撮影 + フィルター比較

`scripts/screenshot/filter-screenshot.mjs`。53 種フィルター全部の効果比較画像を生成。docs に貼る用。

## C-6. OBS 連携（録画 + ストリーミング）

`scripts/stream/obs-stream.mjs`。`/stream` skill で OBS WebSocket 経由の配信制御。

## C-7. YouTube 自動アップロード

`/youtube-upload` skill、`scripts/stream/youtube-upload.mjs`。録画 → 認証 → アップ → 公開設定が 1 ターン。

## C-8. Qiita / Zenn 記事自動投稿

`/qiita` `/zenn` skill。最近のコミット → 記事化 → 認証 → 投稿。

## C-9. 公式アセット同期（local → Azure）

`/sync-official-assets` skill。**ローカル DB を真実とし、Azure に片方向同期** するアセット運用。

## C-10. browser-verify（playwright MCP 直結）

`/browser-verify` skill。Claude Code が Playwright MCP を直接操作して **画面を見ながら確認** する。「目視確認」を AI に代行させる。

---

# D 級 — 簡易リファレンス（補足箇条書き）

- **`narrate` skill**: 作業中に「実況コメント」を出すモード（テキスト VTuber）
- **`/save-report` skill**: 文書を正しい場所（09_reports）に保存
- **`/pr` skill**: PR 作成のラッパ
- **`/character` skill**: キャラクター生成（公式アセット → my-character）
- **`/edit-blocks` skill**: シナリオ ブロック編集（CLI）
- **`/create-project` skill**: 台本 → プロジェクト変換
- **`/asset` skill**: 画像アップロード／一覧／削除
- **`/map` skill**: マップ作成・編集・プレビュー
- **`/deploy-azure` skill**: GitHub Actions 経由のデプロイ
- **`/test` skill**: テスト実行（package 自動判定）
- **`/test-azure` skill**: 本番ヘルスチェック
- **`/playwright-e2e-test` skill**: E2E テスト作成
- **`/web-design-guidelines` skill**: UI レビュー
- **`/vercel-react-best-practices` skill**: React 性能
- **`/vercel-composition-patterns` skill**: コンポーネント設計
- **`./scripts/lint/architecture-report.sh`**: 全メトリクスレポート（既存違反含む）
- **`tsconfig.base.json` の継承構造**: 全パッケージが共通設定を `extends`
- **`oxlint`**: PostToolUse hook で自動実行される **超高速 lint**（Rust 製）
- **TypeScript strict + isolatedModules + bundler resolution**: vite/esbuild 速度の前提

---

# 推奨される追加文書化の優先順位

## 最優先（次に書くなら）

1. **A-1. MCP サーバーを自前で立てる方法** — Claude Code 利用者の最大の関心事
2. **A-2. 31 個のスキル設計パターン** — 自分のプロジェクトに移植したい人多数
3. **A-3. Hooks による安全弁** — 「AI に任せて事故」を恐れる人の答え
4. **A-4. AI Metadata API** — AI 連携 API 設計のベストプラクティス

## 次点

5. A-5. Multi-AI 並列開発
6. A-8. Phase 単位の段階実装パターン
7. A-9. assist パッケージ
8. A-10. ai-gateway

## 長期

- B 級は既存文書のセクションとして追記が良い
- C / D 級は 1 ページコラムとしてまとめて 1 文書化が現実的

---

# 全体の感想

このリポジトリは「**AI と人間の協働パターン** が 30 種類以上、再現可能な形で実装されている」ことが特徴。文書 01〜09 でその基盤と思想を書いたが、**実装テクニックの個別カタログはまだ書ききれていない**。

特に:
- **MCP / スキル / フック** の三点セットは、Claude Code を「個人の道具」から「チームの自動化基盤」に変える鍵
- **AI Metadata API** は、AI が自分でデータを生成する時代の API 設計指針

この 2 つは独立で長文を書く価値があり、世の中で **同等のドキュメントが少ない** 領域。書けば「コードを書ける IT 経験者が AI を真剣に使うとこうなる」のショーケースになる。
