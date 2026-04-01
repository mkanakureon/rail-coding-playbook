# kaedevn CLI・スクリプト・スキル カタログ

- **作成日**: 2026-03-13
- **用途**: モノレポ内の全 CLI ツール・スクリプト・Claude Code スキルの一覧

---

## 1. Claude Code スキル（.claude/skills/）

Claude Code の会話内で日本語トリガーで起動するスキル群。

### 開発ワークフロー

| スキル | トリガー | 機能 |
|--------|---------|------|
| `commit` | 「コミットして」 | git add → commit（日本語メッセージ + Claude感想 + Co-Author） |
| `push` | 「pushして」 | typecheck + lint → git push（pre-push フック対応） |
| `dev-server` | 「サーバー起動して」 | `./scripts/dev-start.sh` でローカルサーバー起動 |
| `deploy-azure` | 「デプロイして」 | GitHub Actions 経由で Azure デプロイ |

### テスト

| スキル | トリガー | 機能 |
|--------|---------|------|
| `test-azure` | 「Azureテスト」 | 4フェーズ Azure テスト（Health → API → E2E → Auth） |
| `playwright-e2e-test` | 「E2Eテスト作って」 | Playwright テスト作成・実行・デバッグ |
| `broken-memo` | テスト失敗時 | 壊れたテストのメモ更新 |

### コンテンツ制作

| スキル | トリガー | 機能 |
|--------|---------|------|
| `edit-blocks` | 「シナリオを書いて」 | CLI でブロック追加・更新・削除 |
| `map` | 「マップを作って」 | ゲームマップ作成・編集・プレビュー |

### ドキュメント・メディア

| スキル | トリガー | 機能 |
|--------|---------|------|
| `devlog` | 「開発日誌書いて」 | git log から開発日誌を自動生成 |
| `save-report` | 「レポート書いて」 | docs/09_reports/ に報告書保存 |
| `qiita` | 「Qiita記事書いて」 | Qiita 記事作成・投稿 |
| `zenn` | 「Zenn記事書いて」 | Zenn 記事作成・投稿 |
| `narrate` | 「実況オン」 | テキスト VTuber モード切替 |

### 配信・録画

| スキル | トリガー | 機能 |
|--------|---------|------|
| `stream` | 「録画開始」「配信開始」 | OBS 経由で録画/配信操作 |
| `youtube-upload` | 「YouTube投稿」 | YouTube API で動画アップロード |

### データ同期

| スキル | トリガー | 機能 |
|--------|---------|------|
| `sync-official-assets` | 「公式アセット同期」 | ローカル DB → Azure DB 同期 |
| `sync-oss` | 「OSSに同期」 | interpreter を kaedevn OSS リポジトリにコピー |
| `rag-search` | 「ドキュメント検索」「RAG更新」 | docs/ のハイブリッド検索・インデックス更新 |

---

## 2. AI 生成パイプライン（scripts/cli/ai/）

### assist-cli.ts — 4段階シナリオ生成

```bash
npx tsx scripts/cli/ai/assist-cli.ts \
  --settings projects/fantasy/settings \
  --command all
```

| Stage | モデル | 入力 | 出力 |
|-------|--------|------|------|
| 0 | gemini-2.5-pro | 設定ファイル(.md) | skeleton.json（章構成） |
| 1 | gemini-2.5-pro | skeleton | chapters.json（章詳細） |
| 2 | gemini-2.5-flash | chapters | episodes.json（話詳細、シーン分割） |
| 3 | gemini-2.5-flash | episodes | text.json（セリフ・地の文・選択肢） |
| 4 | （変換のみ） | text.json | editor-json/（エディタ用JSON） |

**設定ファイル構成**:
```
projects/{name}/settings/
├ s_01_overview.md     （ジャンル・テーマ・トーン）
├ s_02_characters.md   （キャラ定義、slug付き）
├ s_03_plot.md         （章構成・あらすじ）
└ s_04_world.md        （世界観・地名・感覚描写）
```

**ジャンルルール**: `apps/hono/src/lib/assist/genre-rules/{genre}.yaml`
- fantasy, romance, mystery, horror, comedy, longstory, slice-of-life, chinese-short-drama

**ジャンル設定**: `scripts/cli/configs/{genre}.json`
- アセットID、キャラマッピング、背景slug

### upstream-cli.ts — 設定レビュー（Stage 00）

```bash
npx tsx scripts/cli/ai/upstream-cli.ts --settings projects/fantasy/settings
```

初期コンセプトの検討・洗練。assist-cli の前段階。

---

## 3. ブロック・プロジェクト操作（scripts/cli/block/）

### editor-cli.mjs — エディタ CLI

```bash
node scripts/cli/block/editor-cli.mjs
```

CLI からブロック操作（追加・削除・更新）。API 経由でプロジェクトを直接編集。

### KS → プロジェクト変換（scripts/cli/ks-*.mjs）

| スクリプト | 用途 |
|-----------|------|
| `ks-to-project.mjs` | .ks スクリプト → エディタプロジェクトに変換（汎用） |
| `ks-to-project-fantasy.mjs` | ファンタジー向け変換 |
| `ks-to-project-romance.mjs` | 恋愛向け変換 |
| `ks-to-project-mystery.mjs` | ミステリー向け変換 |
| `ks-to-project-horror.mjs` | ホラー向け変換 |
| `ks-to-project-comedy.mjs` | コメディ向け変換 |
| `ks-to-project-drama.mjs` | ドラマ向け変換 |
| `ks-to-project-longstory.mjs` | 長編向け変換 |
| `ks-convert.mjs` | KS ↔ エディタ JSON 相互変換 |
| `ks-upload.mjs` | .ks をパースしてプロジェクトにアップロード |

### import-editor-json.ts

```bash
npx tsx scripts/import-editor-json.ts --dir output/editor-json --project-id 01XXXX
```

assist-cli が生成した editor-json をプロジェクトにインポート。

---

## 4. マップエディタ（scripts/cli/map/）

| スクリプト | 用途 |
|-----------|------|
| `map-cli.mjs` | マップ作成・編集 CLI |
| `render-map.mjs` | マップを画像にレンダリング |
| `open-map-editor.mjs` | ブラウザでマップエディタを開く |
| `gen-placeholder-tilesets.mjs` | プレースホルダタイルセット生成 |
| `test-map-cli-e2e.mjs` | マップ CLI の E2E テスト |
| `test-map-editor.mjs` | マップエディタのテスト |
| `test-map-canvas.mjs` | Canvas レンダリングテスト |

---

## 5. RAG ドキュメント検索（scripts/cli/rag/）

| スクリプト | 用途 |
|-----------|------|
| `init-rag-db.ts` | PostgreSQL (pgvector) 初期化 |
| `rag-index.ts` | docs/**/*.md をチャンク化 → embedding → DB保存（差分更新） |
| `test-rag-search.ts` | ハイブリッド検索テスト |

```bash
npx tsx scripts/cli/rag/rag-index.ts       # インデックス更新
npx tsx scripts/cli/rag/test-rag-search.ts  # 検索テスト
```

---

## 6. DB・アセット管理（scripts/db/）

### アセット同期

| スクリプト | 用途 |
|-----------|------|
| `sync-official-assets.mjs` | ローカル DB → Azure DB 公式アセット同期 |
| `analyze-all-assets.mjs` | 全アセットを Vision API で解析 |
| `apply-vision-metadata.mjs` | 解析結果をDBに適用 |
| `generate-asset-embeddings.mjs` | アセットのベクトル埋め込み生成 |
| `asset-search.mjs` | セマンティックアセット検索 |
| `parse-asset-metadata.mjs` | アセットメタデータ解析 |
| `test-vision-analyze.mjs` | Vision API テスト |
| `test-vision-analyze-v3.mjs` | Vision API v3 テスト |

### DB バックアップ

| スクリプト | 用途 |
|-----------|------|
| `backup-setup.sh` | バックアップ設定（launchd） |
| `backup-dump.sh` | pg_dump 実行 |
| `backup-restore-test.sh` | リストアテスト |
| `backup-daily-check.sh` | 日次チェック |
| `backup-status.sh` | バックアップ状態確認 |

### マイグレーション

| スクリプト | 用途 |
|-----------|------|
| `migrate-to-projects.ts` | 旧スキーマ → 新プロジェクト構造への移行 |

---

## 7. 配信・録画（scripts/stream/）

| スクリプト | 用途 |
|-----------|------|
| `obs-stream.mjs` | OBS WebSocket 経由で録画/配信制御 |
| `obs-stream.sh` | シェルラッパー |
| `auto-record.sh` | 自動録画スクリプト |
| `record-demo.ts` | スマホ操作デモ動画撮影 |
| `stream-ending.sh` | 配信エンディング |
| `youtube-upload.mjs` | YouTube API アップロード |

```bash
node scripts/stream/obs-stream.mjs rec          # 録画開始
node scripts/stream/obs-stream.mjs rec-stop      # 録画停止
node scripts/stream/youtube-upload.mjs video.mp4  # YouTube投稿
```

---

## 8. ビルド・デプロイ（scripts/build/, scripts/deploy/）

### ビルド

| スクリプト | 用途 |
|-----------|------|
| `build-sdl.sh` | SDL2 ネイティブビルド |
| `build-title.sh` | タイトル画面ビルド |
| `download-sdl2-sources.sh` | SDL2 ソースダウンロード |

### デプロイ

| スクリプト | 用途 |
|-----------|------|
| `deploy-azure.sh` | Azure デプロイ（**使わない** — GitHub Actions を使う） |
| `pre-deploy-check.sh` | デプロイ前チェック |
| `setup-frontdoor.sh` | Azure Front Door セットアップ |

---

## 9. テスト（scripts/test/）

### Azure テスト

| スクリプト | 用途 |
|-----------|------|
| `azure/run-all.sh` | 全フェーズ統合テスト |
| `azure/health.sh` | Phase 1: 4サービス死活確認 |
| `azure/api.sh` | Phase 2: API 疎通8項目 |
| `azure/e2e.sh` | Phase 3: Playwright E2E |
| `azure/auth.sh` | Phase 4: 認証E2E |
| `azure/security.sh` | セキュリティテスト |
| `azure/editor-api.sh` | エディタ API テスト |
| `azure/ks-editor.sh` | KSC エディタテスト |
| `azure/landing-links.sh` | ランディングページリンク検証 |
| `azure/env.sh` | Azure 環境変数定義 |

### ローカルテスト

| スクリプト | 用途 |
|-----------|------|
| `local/run-all.sh` | 全テスト統合 |
| `local/health.sh` | 死活確認 |
| `local/api.sh` | API テスト |
| `local/e2e.sh` | E2E テスト |
| `local/auth.sh` | 認証テスト |
| `local/unit.sh` | ユニットテスト |
| `local/editor.sh` | エディタテスト |
| `local/security.sh` | セキュリティテスト |
| `local/ks-editor.sh` | KSC エディタテスト |
| `local/asset-search.sh` | アセット検索テスト |
| `local/env.sh` | ローカル環境変数定義 |

### その他

| スクリプト | 用途 |
|-----------|------|
| `deploy-verify.sh` | git push → Actions 待ち → 全テスト |
| `check-e2e-sync.sh` | E2E テスト同期チェック |

---

## 10. AI デバッグ（scripts/debug/）

Gemini / Vertex AI 接続のデバッグ用スクリプト群。

| スクリプト | 用途 |
|-----------|------|
| `debug-google-ai.ts` | Google AI (Gemini) 接続テスト |
| `debug-google-genai.ts` | Google GenAI SDK テスト |
| `debug-google-genai-v2.ts` | GenAI v2 テスト |
| `debug-vertex.ts` | Vertex AI 接続テスト |
| `debug-vertex-east.ts` | Vertex AI (東京リージョン) テスト |
| `debug-vertex-full.ts` | Vertex AI フルテスト |
| `debug-vertex-full-res.ts` | Vertex AI レスポンス確認 |
| `debug-vertex-3.ts` | Vertex AI v3 テスト |
| `check-gemini-3.ts` | Gemini 3 モデルチェック |
| `test-gemini-2.ts` | Gemini 2 テスト |
| `verify-gemini2.ts` | Gemini 2 検証 |

---

## 11. その他のスクリプト

| スクリプト | 用途 |
|-----------|------|
| `scripts/ai/list-models.ts` | 利用可能な AI モデル一覧 |
| `scripts/ai/test-api-key.ts` | API キー検証 |
| `scripts/ai/verify-ks-spec.ts` | KS 仕様検証 |
| `scripts/list-available-models.mjs` | モデル一覧（.mjs版） |
| `scripts/check-pro-model.mjs` | Pro モデルチェック |
| `scripts/test-models.mjs` | モデルテスト |
| `scripts/sync-demo-title.mjs` | デモタイトル同期 |
| `scripts/sync-oss.sh` | OSS リポジトリ同期 |
| `scripts/sync-native.sh` | ネイティブ（SDL2）同期 |
| `scripts/dev-start.sh` | ローカル開発サーバー起動 |
| `scripts/docs/verify-doc-links.ts` | ドキュメントリンク検証 |
| `scripts/screenshot/filter-screenshot.mjs` | スクリーンショット + フィルタ適用 |
| `scripts/screenshot/pc98-screenshot.mjs` | PC-98 風スクリーンショット |
| `scripts/cli/native/fetch-assets.mjs` | ネイティブ用アセットフェッチ |

---

## 12. 全体統計

| カテゴリ | ファイル数 | 備考 |
|---------|----------|------|
| Claude Code スキル | 19 | .claude/skills/ |
| AI 生成パイプライン | 2 | assist-cli, upstream-cli |
| ブロック・プロジェクト操作 | 11 | editor-cli, ks-to-project 系 |
| マップエディタ | 7 | map-cli 系 |
| RAG 検索 | 3 | init, index, search |
| DB・アセット管理 | 13 | 同期, Vision, 埋め込み, バックアップ |
| 配信・録画 | 6 | OBS, YouTube |
| ビルド・デプロイ | 6 | SDL2, Azure |
| テスト | 21 | Azure 10, ローカル 11 |
| AI デバッグ | 11 | Gemini/Vertex 接続テスト |
| その他 | 12 | モデルチェック, 同期, スクリーンショット |
| **合計** | **111** | |

---

## 13. よく使うコマンドまとめ

### 日常開発

```bash
./scripts/dev-start.sh              # サーバー起動（API + Next.js）
./scripts/dev-start.sh all          # 全サーバー起動
npm run typecheck                    # 型チェック
npm run lint                         # lint
npm run build                        # 全ビルド
```

### テスト

```bash
scripts/test/local/run-all.sh       # ローカル全テスト
scripts/test/azure/run-all.sh       # Azure 全テスト
scripts/test/deploy-verify.sh       # デプロイ後検証
```

### AI 生成

```bash
npx tsx scripts/cli/ai/assist-cli.ts --settings projects/fantasy/settings --command all
npx tsx scripts/import-editor-json.ts --dir output/editor-json --project-id 01XXXX
```

### データ管理

```bash
npx tsx scripts/cli/rag/rag-index.ts              # RAG インデックス更新
node scripts/db/sync-official-assets.mjs --dry-run  # アセット同期（確認）
node scripts/db/sync-official-assets.mjs --execute   # アセット同期（実行）
```

### 配信

```bash
node scripts/stream/obs-stream.mjs rec              # 録画開始
node scripts/stream/obs-stream.mjs rec-stop          # 録画停止
node scripts/stream/youtube-upload.mjs video.mp4     # YouTube 投稿
```
