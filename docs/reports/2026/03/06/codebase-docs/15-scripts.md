# scripts/ - スクリプト一覧

## 概要

開発、テスト、デプロイ、バックアップ、ユーティリティのシェルスクリプトと TypeScript スクリプト。合計 39 ファイル。

## 開発 (5 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| dev-start.sh | 125 | 開発サーバー起動（既存プロセス停止→PostgreSQL確認→npm install→起動） |
| pre-deploy-check.sh | 32 | デプロイ前チェック |
| check-e2e-sync.sh | 24 | E2E セレクタ整合性チェック |
| local-env.sh | 4 | ローカル URL/設定表示 |
| azure-env.sh | 8 | Azure URL/認証情報表示 |

### dev-start.sh の使い方

```bash
./scripts/dev-start.sh             # API + Next.js (デフォルト)
./scripts/dev-start.sh all         # 全サーバー
./scripts/dev-start.sh api editor  # 指定のみ
```

## テストランナー - ローカル (8 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| test-local.sh | 145 | マスター（Phase 1-8 統合） |
| test-local-health.sh | 12 | Phase 1: curl ヘルスチェック |
| test-local-api.sh | 48 | Phase 2: API テスト (8項目) |
| test-local-unit.sh | 9 | Phase 3: ユニットテスト (core, compiler, interpreter) |
| test-local-e2e.sh | 16 | Phase 4: Playwright E2E |
| test-local-auth.sh | 12 | Phase 5: 認証 E2E |
| test-local-ks-editor.sh | 12 | Phase 6: KSC エディタ E2E |
| test-local-editor.sh | 8 | Editor ユニットテスト |
| test-local-security.sh | 18 | セキュリティチェック |

### test-local.sh の使い方

```bash
./scripts/test-local.sh              # 全 Phase
./scripts/test-local.sh --phase 3    # Phase 3 (ユニットテスト) まで
./scripts/test-local.sh --repeat 3   # 3回連続実行（安定性確認）
```

## テストランナー - Azure (6 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| test-azure.sh | 168 | マスター（Phase 1-7 統合） |
| test-azure-health.sh | 17 | Phase 1: 4サービスヘルスチェック |
| test-azure-api.sh | 56 | Phase 2: API テスト (8項目) |
| test-azure-e2e.sh | 10 | Phase 3: Playwright E2E |
| test-azure-auth.sh | 13 | Phase 4: 認証テスト (34テスト) |
| test-azure-ks-editor.sh | 9 | Phase 7: KSC エディタ |
| test-azure-editor-api.sh | 24 | Editor API テスト |
| test-azure-security.sh | 18 | セキュリティチェック |

## デプロイ (2 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| deploy-verify.sh | 184 | git push → Actions 待ち → 全テスト |
| deploy-azure.sh | — | **使用禁止**（ローカルデプロイ禁止、GitHub Actions を使う） |

### deploy-verify.sh の使い方

```bash
./scripts/deploy-verify.sh             # push → 待機 → テスト
./scripts/deploy-verify.sh --no-push   # push 済み → テストのみ
./scripts/deploy-verify.sh --skip-test # push のみ
```

## ビルド / ネイティブ (5 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| build-title.sh | 19 | ゲームタイトル/ロゴアセットビルド |
| build-sdl.sh | 48 | SDL2 ビルド |
| download-sdl2-sources.sh | 52 | SDL2/SDL_image ソースダウンロード |
| sync-native.sh | 14 | ネイティブエンジン更新同期 |
| sync-oss.sh | 22 | OSS ライセンス同期 |

## バックアップ / 監視 (6 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| backup-setup.sh | 41 | Azure Backup vault セットアップ |
| backup-status.sh | 22 | バックアップ健全性確認 |
| backup-dump.sh | 12 | PostgreSQL バックアップ |
| backup-restore-test.sh | 28 | 復元テスト |
| backup-daily-check.sh | 32 | 定期バックアップ検証 |
| setup-frontdoor.sh | 41 | Azure Front Door CDN セットアップ |

## 配信 / デバッグ (3 ファイル)

| ファイル | 行数 | 用途 |
|---------|------|------|
| obs-stream.sh | 34 | OBS WebSocket 配信制御 |
| stream-ending.sh | 18 | 配信終了 |
| auto-record.sh | 31 | ゲームプレイ自動録画 |

## TypeScript スクリプト (19 ファイル)

### AI / 執筆支援

| ファイル | 行数 | 用途 |
|---------|------|------|
| assist-cli.ts | 180 | AI 執筆支援 CLI (4段階パイプライン) |
| debug-google-ai.ts | — | Google AI デバッグ |
| debug-google-genai.ts | — | Google GenAI デバッグ |
| debug-google-genai-v2.ts | — | Google GenAI v2 デバッグ |
| debug-vertex-*.ts | 5種 | Google Vertex AI デバッグ/テスト |
| test-gemini-2.ts | — | Gemini 2.0 検証 |
| verify-gemini2.ts | — | Gemini 2.0 バリデーション |
| test-api-key.ts | 18 | API キー検証 |
| list-models.ts | 23 | LLM モデル一覧表示 |

### RAG

| ファイル | 行数 | 用途 |
|---------|------|------|
| init-rag-db.ts | 47 | RAG ベクトル DB 初期化 |
| rag-index.ts | 64 | RAG ドキュメントインデックス |
| test-rag-search.ts | 58 | RAG 検索検証 |

### ユーティリティ

| ファイル | 行数 | 用途 |
|---------|------|------|
| migrate-to-projects.ts | 35 | レガシー → プロジェクトデータ移行 |
| verify-doc-links.ts | 71 | ドキュメントリンク有効性チェック |
| verify-ks-spec.ts | 89 | KS コマンド仕様バリデーション |
