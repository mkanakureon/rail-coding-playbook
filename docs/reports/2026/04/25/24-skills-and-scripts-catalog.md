# スキル + スクリプトカタログ — 全 31 スキル + scripts/ リファレンス

シリーズ: 11-documentation-plan / 関連: 13-skill-design-patterns / 23-operations-collection

## この文書の狙い

このリポジトリの **31 個の `.claude/skills/`** と **scripts/ 配下の各ディレクトリ** をカタログ化する。各エントリは **トリガー / 用途 / 場所** の 3 行で要約。

> 詳細手順は各 `.claude/skills/{name}/SKILL.md` を直接参照。本書は **「何があるか」の索引**。

---

# 第 1 部 — 全 31 スキル

## Git 系（3）

### `/commit`
- **トリガー**: "コミットして", "commit", "変更をコミット"
- **用途**: `git add` → `git commit`、Co-Authored-By + 感想 + Design Change Note 自動付与
- **詳細文書**: 06-commit-message-conventions

### `/push`
- **トリガー**: "pushして", "プッシュ", "GitHubに上げて", "リモートに反映"
- **用途**: 現在ブランチを origin に push、未コミット時は commit スキルを誘導

### `/pr`
- **トリガー**: "PR作って", "プルリクエスト"
- **用途**: 現在ブランチからの PR 作成、テンプレート埋め

## 開発サーバー / テスト（4）

### `/dev-server`
- **トリガー**: "サーバー起動", "dev-server", "開発サーバー", "起動して"
- **用途**: `./scripts/dev-start.sh` 経由で開発サーバー一括起動
- **詳細文書**: 23-operations-collection §1

### `/test`
- **トリガー**: "テストして", "test", "テスト回して"
- **用途**: 変更を分析して関連テストだけ自動選択・実行

### `/test-azure`
- **トリガー**: "azureテスト", "本番テスト", "ヘルスチェック"
- **用途**: Azure 本番に対して E2E + ヘルスチェック

### `/docker-test`
- **トリガー**: "dockerテスト", "本番テスト", "リリース前テスト"
- **用途**: Docker Compose で本番相当環境を立てて E2E、Azure NG 防止
- **詳細文書**: 09-all-tests-overview §3-4

## デプロイ（1）

### `/deploy-azure`
- **トリガー**: "デプロイして", "デプロイ", "Azure deploy", "本番に反映"
- **用途**: GitHub Actions 経由のデプロイトリガー

## ドキュメント / 報告（4）

### `/save-report`
- **トリガー**: "レポート書いて", "保存して", "振り返り文書", "ドキュメント保存"
- **用途**: 文書を `docs/09_reports/{date}/` に正しく保存

### `/devlog`
- **トリガー**: "開発日誌", "devlog", "日誌", "今日の振り返り"
- **用途**: git log + 感想ブロックから読み物形式の日誌生成
- **詳細文書**: 18-devlog-from-git-log

### `/qiita`
- **トリガー**: "Qiita記事書いて", "Qiitaにまとめて", "Qiita投稿"
- **用途**: 最近のコミット → 記事化 → Qiita 投稿

### `/zenn`
- **トリガー**: "Zenn記事書いて", "Zennにまとめて", "Zenn投稿"
- **用途**: 同上、Zenn 用

## AI 機能（2）

### `/rag-search`
- **トリガー**: "設計意図", "過去の実装", "仕様書検索", "RAG更新", "インデックス更新"
- **用途**: docs/ をハイブリッド検索、または再インデックス
- **詳細文書**: 05-rag-search-system

### `/narrate`
- **トリガー**: "実況オン", "実況モード", "しゃべって", "黙って"
- **用途**: 作業中に実況コメントを出すモード切り替え（テキスト VTuber）

## コンテンツ作成（6）

### `/create-project`
- **トリガー**: "プロジェクト作って", "新しいプロジェクト", "台本を投入", "ストーリーをインポート"
- **用途**: 新規プロジェクト作成、台本（.txt）からインポート

### `/edit-blocks`
- **トリガー**: "シナリオを書いて", "ブロック追加", "セリフ変更", "ページ追加", "ブロック一覧"
- **用途**: ビジュアルノベルブロックの CLI 編集

### `/character`
- **トリガー**: "キャラ作って", "キャラクター追加", "キャラ一覧", "表情追加", "公式キャラ"
- **用途**: キャラクター作成・管理（公式アセット → my-character）

### `/asset`
- **トリガー**: "画像アップロード", "アセット一覧", "アセット追加", "マイアセット", "背景を追加"
- **用途**: アセット管理（画像音声アップ・一覧・削除）

### `/map`
- **トリガー**: "マップを作って", "マップ編集", "地形配置", "マップ一覧", "マッププレビュー"
- **用途**: マップ作成・編集・プレビュー・PNG レンダリング

### `/rpg-preview`
- **トリガー**: 内部スキル（テスト用）
- **用途**: RPG プレビュー

## メディア / 配信（4）

### `/stream`
- **トリガー**: "配信開始", "録画開始", "撮って", "録画停止", "配信ステータス"
- **用途**: OBS WebSocket 経由の配信制御

### `/youtube-upload`
- **トリガー**: "動画アップロード", "YouTubeに投稿", "YouTube認証"
- **用途**: YouTube 認証 + アップロード + 公開設定

### `/browser-verify`
- **トリガー**: "画面確認", "UI検証", "ブラウザ確認", "表示チェック", "browser verify", "目視確認"
- **用途**: Playwright MCP 直結で AI が画面を見ながら検証

### `/playwright-e2e-test`
- **トリガー**: "E2Eテスト作って", "Playwrightテスト", "ブラウザテスト"
- **用途**: E2E テスト spec の生成

## 同期（2）

### `/sync-oss`
- **トリガー**: "OSSに同期", "kaedevnにコピー", "sync oss"
- **用途**: `packages/interpreter/` を OSS リポへ rsync 片方向同期
- **詳細文書**: 22-design-principles-collection §1

### `/sync-official-assets`
- **トリガー**: "公式アセット同期", "アセット同期", "official assets sync", "ローカルをAzureに反映"
- **用途**: ローカル DB の公式アセットを Azure DB へ片方向同期

## メモ / 状態管理（1）

### `/broken-memo`
- **トリガー**: "壊れたメモ更新", "broken memo"（自動 also）
- **用途**: テスト失敗時に壊れたメモを更新（自動トリガーあり）
- **詳細文書**: 17-broken-memo-pattern

## ガイドライン参照（4）

### `/web-design-guidelines`
- **トリガー**: "review my UI", "check accessibility", "audit design", "review UX"
- **用途**: UI コードを Web Interface Guidelines でレビュー

### `/vercel-react-best-practices`
- **トリガー**: React/Next.js コード変更時
- **用途**: Vercel エンジニアの React 性能ガイド参照

### `/vercel-composition-patterns`
- **トリガー**: コンポーネント設計時
- **用途**: Compound Components / boolean prop 排除

### `/vercel-react-native-skills`（あれば）
- **用途**: React Native ガイド

---

# 第 2 部 — scripts/ ディレクトリカタログ

## scripts/ ルート

| スクリプト | 用途 |
|---|---|
| `dev-start.sh` | 開発サーバー一括起動（前書 23 §1） |
| `dev-start-secondary.sh` | サブ開発環境 |
| `oss-setup.sh` / `oss-start.sh` | OSS リポのセットアップ |
| `sync-oss.sh` / `sync-oss-studio.sh` | OSS 同期 |
| `sync-native.sh` | ネイティブビルド同期 |
| `test-pre-release.sh` | リリース前テスト |
| `import-editor-json.ts` | エディタ JSON のインポート |
| `screenshot-all-filters.mjs` | 53 種フィルター比較画像生成 |
| `sync-demo-title.mjs` | デモタイトル同期 |
| `check-pro-model.mjs` / `list-available-models.mjs` / `test-models.mjs` | LLM モデル確認 |

## scripts/ai/

```
list-models.ts        利用可能 LLM モデル列挙
test-api-key.ts       API key 動作確認
verify-ks-spec.ts     .ks 仕様検証
```

## scripts/cli/

CLI ツール群（`scripts/cli/_template.mjs` がテンプレ）。

| サブディレクトリ | 用途 |
|---|---|
| `ai/` | AI 統合 CLI（`assist-cli.ts`, `upstream-cli.ts`） |
| `asset/` | アセット操作 |
| `block/` | ブロック操作 |
| `character/` | キャラクター操作 |
| `configs/` | 設定操作 |
| `lib/` | 共通ライブラリ |
| `map/` | マップ操作 |
| `native/` | ネイティブ関連（`fetch-assets.mjs`） |
| `project/` | プロジェクト操作 |
| `rag/` | RAG インデックス（`rag-index.ts`, `init-rag-db.ts`） |
| `ranking/` | ランキング処理 |
| `video/` | 動画処理 |

ルートには `ks-convert.mjs`, `ks-to-project-{genre}.mjs`（romance / mystery / horror / comedy / drama / longstory）, `ks-upload.mjs`, `record-demo.ts`, `test-all-cli.ts`。

## scripts/db/

```
analyze-all-assets.mjs        アセット全 Vision 解析
apply-vision-metadata.mjs     Vision メタデータを DB 反映
asset-search.mjs              アセット検索
generate-asset-embeddings.mjs アセット embedding 生成
parse-asset-metadata.mjs      メタデータ解析
backup-daily-check.sh         日次バックアップ確認
backup-dump.sh                ダンプ
backup-restore-test.sh        リストアテスト
backup-setup.sh               セットアップ
backup-status.sh              状態確認
sync-official-assets.mjs      公式アセット同期
migrate-to-projects.ts        マイグレ
test-vision-analyze.mjs       Vision API テスト
```

**Vision API パイプライン**（asset 解析）と **バックアップ系** が中心。

## scripts/lint/

```
architecture-check.sh   設計ルール違反検出（前書 01）
architecture-report.sh  全メトリクスレポート
```

## scripts/test/

```
_template.sh           新規テストスクリプトのテンプレ
azure/                 Azure 本番テスト群（10 スクリプト）
local/                 ローカルテスト
check-e2e-sync.sh      UI 変更 → E2E 同期チェック（pre-commit）
deploy-verify.sh       デプロイ後検証
docker-e2e.sh          Docker E2E（前書 09 §3-4）
```

### scripts/test/azure/

```
api.sh           API 単体ヘルス
auth.sh          認証
e2e.sh           E2E
editor-api.sh    エディタ API
env.sh           環境変数
health.sh        全ヘルス
ks-editor.sh     KSC エディタ
landing-links.sh ランディング全リンク
run-all.sh       全部（~20 分）
security.sh      セキュリティ
```

## scripts/screenshot/

```
filter-screenshot.mjs   フィルター効果比較画像
pc98-screenshot.mjs     PC-98 風画像生成
```

## scripts/stream/

```
auto-record.sh         自動録画
obs-stream.mjs/sh      OBS 連携
record-demo.ts         デモ録画
stream-ending.sh       配信終了
youtube-upload.mjs     YouTube アップロード
```

## scripts/rpg-batch/

```
buff-enemies.ts        敵パラメータ調整
```

## scripts/build/

`build-title.sh` 等のビルド補助。

## scripts/debug/ / scripts/deploy/ / scripts/docs/

それぞれデバッグ / デプロイ / ドキュメント生成補助。

---

# 第 3 部 — 補助ツール / 設定

## TypeScript / lint

| ツール | 役割 | 設定 |
|---|---|---|
| `tsc` | 型チェック | `tsconfig.base.json` 継承 |
| `oxlint` | 高速 lint（PostToolUse hook） | デフォルト設定 |
| `eslint` | apps/next の本格 lint | `.eslintrc` |

`tsconfig.base.json` の `strict: true` + `isolatedModules: true` + `moduleResolution: "bundler"` が全パッケージで継承。

## Husky hooks

```
.husky/pre-commit    ハードコード URL + E2E 同期
.husky/commit-msg    Co-Authored-By + 感想区切り強制
.husky/pre-push      typecheck + lint + dist 起動 + architecture-check
```

詳細は前書 01-guardrails-reproduction。

## GitHub Actions

```
.github/workflows/
├── ci.yml                              PR で typecheck/lint/test
├── deploy.yml                          Container Apps デプロイ
├── deploy-swa.yml                      Static Web Apps デプロイ
├── check-hardcoded-urls.yml            ビルド出力に localhost が混じってないか
├── azure-static-web-apps-*.yml         SWA 自動 PR デプロイ（3 種）
└── setup-frontdoor.yml                 Front Door 設定
```

## Claude / AI 設定

```
.claude/settings.json    Hooks（PreToolUse / PostToolUse）
.claude/skills/          31 スキル
CLAUDE.md                Claude Code 用ガイダンス
GEMINI.md                Gemini CLI 用ガイダンス
```

## RAG 系

```
PostgreSQL (kaedevn_rag DB) + pgvector
apps/hono/src/routes/mcp.ts              MCP エンドポイント
apps/hono/src/routes/rag-hybrid.ts       認証付き REST
apps/hono/src/lib/assist/hybrid-rag.ts   検索本体
scripts/cli/rag/rag-index.ts             インデクサ
scripts/cli/rag/init-rag-db.ts           DB 初期化
```

詳細は前書 05-rag-search-system, 12-mcp-server-implementation。

---

# まとめ

| カテゴリ | 数 |
|---|---|
| Claude スキル | **31** |
| `scripts/` ルート | ~15 |
| `scripts/cli/` 配下 | ~30 |
| `scripts/db/` 配下 | ~12 |
| `scripts/test/` 配下 | ~15 |
| GitHub Actions | 7 |
| Husky hooks | 3 |

合わせて **100 以上の自動化資産** がリポジトリに蓄積されている。これらが **AI（Claude / Gemini）と人間** の双方の作業を支える。

「**スキル / スクリプト / hooks / Actions が同じ資産プールに乗っている**」のがこのリポジトリの強み。新規参加者は本カタログから興味のある領域を選び、各エントリの詳細文書または実体（`.claude/skills/{name}/SKILL.md` / `scripts/...`）を直接読むのが推奨。
