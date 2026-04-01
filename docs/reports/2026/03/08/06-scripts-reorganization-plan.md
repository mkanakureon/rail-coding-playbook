# scripts/ 整理計画

作成日: 2026-03-08

## 現状の問題

- scripts/ 直下に **73個** のファイルがフラットに並んでいる
- テスト用(21個)、デバッグ用(8個)、マップ用(6個)、配信用(3個) 等がすべて混在
- `test-local-editor.sh` に旧テストパスが28個残っている
- `check-e2e-sync.sh` のマッピングが全て旧パス

## 現状の全ファイル分類（73個）

### テスト — Azure（10個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/azure-env.sh` | Azure 共有定数（URL・認証情報） |
| `scripts/test-azure.sh` | Azure 統合テスト（Phase 1→7） |
| `scripts/test-azure-health.sh` | Phase 1: 4サービス死活確認 (curl) |
| `scripts/test-azure-api.sh` | Phase 2: API 疎通 8項目 (curl) |
| `scripts/test-azure-editor-api.sh` | Phase 3: エディタ用 API 23項目 (curl) |
| `scripts/test-azure-security.sh` | Phase 4: セキュリティ ~30項目 (curl) |
| `scripts/test-azure-e2e.sh` | Phase 5: Playwright E2E |
| `scripts/test-azure-auth.sh` | Phase 6: Playwright 認証 |
| `scripts/test-azure-ks-editor.sh` | Phase 7: Playwright KS エディタ |
| `scripts/deploy-verify.sh` | git push → Actions 待ち → test-azure.sh |

### テスト — Local（9個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/local-env.sh` | ローカル共有定数（URL・認証情報） |
| `scripts/test-local.sh` | ローカル統合テスト（Phase 1→8） |
| `scripts/test-local-health.sh` | Phase 1: ローカルサービス死活 + pg_isready |
| `scripts/test-local-unit.sh` | Phase 2: Vitest ユニットテスト |
| `scripts/test-local-api.sh` | Phase 3: API 疎通 8項目 (curl) |
| `scripts/test-local-security.sh` | Phase 4: セキュリティ ~30項目 (curl) |
| `scripts/test-local-e2e.sh` | Phase 5: Playwright E2E |
| `scripts/test-local-editor.sh` | Phase 6: Playwright エディタ + ゲスト（**旧パス28個**） |
| `scripts/test-local-auth.sh` | Phase 7: Playwright 認証 |
| `scripts/test-local-ks-editor.sh` | Phase 8: Playwright KS エディタ |

### テスト — 共通（1個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/check-e2e-sync.sh` | UI変更→E2Eテスト同期チェック（**旧パス21個**） |

### デバッグ・AI テスト（10個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/debug-google-ai.ts` | Google AI デバッグ |
| `scripts/debug-google-genai.ts` | Google GenAI デバッグ |
| `scripts/debug-google-genai-v2.ts` | Google GenAI v2 デバッグ |
| `scripts/debug-vertex.ts` | Vertex AI デバッグ |
| `scripts/debug-vertex-3.ts` | Vertex AI デバッグ (3) |
| `scripts/debug-vertex-east.ts` | Vertex AI East リージョン |
| `scripts/debug-vertex-full.ts` | Vertex AI フル |
| `scripts/debug-vertex-full-res.ts` | Vertex AI フルレスポンス |
| `scripts/test-gemini-2.ts` | Gemini 2 テスト |
| `scripts/verify-gemini2.ts` | Gemini 2 検証 |

### AI ツール（3個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/test-api-key.ts` | API キー検証 |
| `scripts/list-models.ts` | モデル一覧取得 |
| `scripts/verify-ks-spec.ts` | KS 仕様検証 |

> `assist-cli.ts` は CLI カテゴリに移動

### RAG（3個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/init-rag-db.ts` | RAG DB 初期化 |
| `scripts/rag-index.ts` | RAG インデックス作成 |
| `scripts/test-rag-search.ts` | RAG 検索テスト |

### CLI — Claude Code 操作用（10個）

Claude Code のスキルから呼び出される CLI ツール群。今後増える想定。

| 現在のパス | サブ分類 | 内容 | 対応スキル |
|-----------|---------|------|-----------|
| `scripts/editor-cli.mjs` | block | ブロックエディタ CLI（API 経由） | `edit-blocks` |
| `scripts/test-editor-cli-e2e.mjs` | block | ブロック CLI E2E テスト | - |
| `scripts/map-cli.mjs` | map | マップ CLI（ローカルファイル操作） | `map` |
| `scripts/open-map-editor.mjs` | map | マップエディタ起動 | `map` |
| `scripts/render-map.mjs` | map | マップ描画 | `map` |
| `scripts/gen-placeholder-tilesets.mjs` | map | プレースホルダータイルセット生成 | `map` |
| `scripts/test-map-canvas.mjs` | map | マップ Canvas テスト | - |
| `scripts/test-map-cli-e2e.mjs` | map | マップ CLI E2E テスト | - |
| `scripts/test-map-editor.mjs` | map | マップエディタテスト | - |
| `scripts/assist-cli.ts` | ai | AI 執筆支援 CLI | - |

### 配信・録画（4個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/obs-stream.mjs` | OBS WebSocket 制御（録画開始/停止） |
| `scripts/obs-stream.sh` | OBS 配信スクリプト（旧） |
| `scripts/stream-ending.sh` | 配信エンディング |
| `scripts/auto-record.sh` | 自動録画 |

### 録画・スクリーンショット（3個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/record-demo.ts` | デモ録画 |
| `scripts/pc98-screenshot.mjs` | PC98 スクリーンショット |
| `scripts/filter-screenshot.mjs` | フィルタースクリーンショット |

### YouTube（1個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/youtube-upload.mjs` | YouTube アップロード |

### ビルド・デプロイ（5個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/build-title.sh` | タイトルビルド |
| `scripts/deploy-azure.sh` | Azure デプロイ（**使用禁止** — CLAUDE.md） |
| `scripts/pre-deploy-check.sh` | デプロイ前チェック |
| `scripts/build-sdl.sh` | SDL ビルド |
| `scripts/download-sdl2-sources.sh` | SDL2 ソースダウンロード |

### 開発・同期（4個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/dev-start.sh` | ローカル開発サーバー起動 |
| `scripts/sync-demo-title.mjs` | デモタイトル同期 |
| `scripts/sync-oss.sh` | OSS リポジトリ同期 |
| `scripts/sync-native.sh` | ネイティブ同期 |

### DB（6個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/migrate-to-projects.ts` | プロジェクトマイグレーション |
| `scripts/backup-setup.sh` | バックアップセットアップ |
| `scripts/backup-status.sh` | バックアップ状態確認 |
| `scripts/backup-dump.sh` | バックアップダンプ |
| `scripts/backup-restore-test.sh` | バックアップ復元テスト |
| `scripts/backup-daily-check.sh` | 日次バックアップチェック |

### ドキュメント（1個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/verify-doc-links.ts` | ドキュメントリンク検証 |

### インフラ（1個）

| 現在のパス | 内容 |
|-----------|------|
| `scripts/setup-frontdoor.sh` | Front Door セットアップ |

---

## 整理計画

### ディレクトリ構造（案）

```
scripts/
  test/                                 # テスト用
    azure/                              #   Azure テスト
      env.sh                            #   共有定数
      health.sh
      api.sh
      editor-api.sh
      security.sh
      e2e.sh
      auth.sh
      ks-editor.sh
      run-all.sh                        #   統合（旧 test-azure.sh）
    local/                              #   ローカルテスト
      env.sh                            #   共有定数
      health.sh
      unit.sh
      api.sh
      security.sh
      e2e.sh
      editor.sh                         #   ★旧パス28個を修正
      auth.sh
      ks-editor.sh
      run-all.sh                        #   統合（旧 test-local.sh）
    check-e2e-sync.sh                   #   ★旧パス21個を修正
    deploy-verify.sh
  debug/                                # デバッグ・AI テスト（削除候補）
    debug-google-ai.ts
    debug-google-genai.ts
    debug-google-genai-v2.ts
    debug-vertex.ts
    debug-vertex-3.ts
    debug-vertex-east.ts
    debug-vertex-full.ts
    debug-vertex-full-res.ts
    test-gemini-2.ts
    verify-gemini2.ts
  cli/                                  # Claude Code から使う CLI（今後増加想定）
    block/                              #   ブロックエディタ CLI
      editor-cli.mjs                    #   ← scripts/editor-cli.mjs
      test-editor-cli-e2e.mjs           #   ← scripts/test-editor-cli-e2e.mjs
    map/                                #   マップ CLI
      map-cli.mjs                       #   ← scripts/map-cli.mjs
      open-map-editor.mjs              #   ← scripts/open-map-editor.mjs
      render-map.mjs                    #   ← scripts/render-map.mjs
      gen-placeholder-tilesets.mjs      #   ← scripts/gen-placeholder-tilesets.mjs
      test-map-canvas.mjs              #   ← scripts/test-map-canvas.mjs
      test-map-cli-e2e.mjs             #   ← scripts/test-map-cli-e2e.mjs
      test-map-editor.mjs              #   ← scripts/test-map-editor.mjs
    ai/                                 #   AI 執筆支援 CLI
      assist-cli.ts                     #   ← scripts/assist-cli.ts
  ai/                                   # AI ツール（CLI 以外）
    test-api-key.ts
    list-models.ts
    verify-ks-spec.ts
  rag/                                  # RAG
    init-rag-db.ts
    rag-index.ts
    test-rag-search.ts
  stream/                               # 配信・録画
    obs-stream.mjs
    obs-stream.sh
    stream-ending.sh
    auto-record.sh
    record-demo.ts
    youtube-upload.mjs
  screenshot/                           # スクリーンショット
    pc98-screenshot.mjs
    filter-screenshot.mjs
  build/                                # ビルド
    build-title.sh
    build-sdl.sh
    download-sdl2-sources.sh
  deploy/                               # デプロイ
    deploy-azure.sh                     #   使用禁止（CLAUDE.md）
    pre-deploy-check.sh
    setup-frontdoor.sh
  db/                                   # DB
    migrate-to-projects.ts
    backup-setup.sh
    backup-status.sh
    backup-dump.sh
    backup-restore-test.sh
    backup-daily-check.sh
  docs/                                 # ドキュメント
    verify-doc-links.ts
  dev-start.sh                          # 直下に残す（頻繁に使う）
  sync-demo-title.mjs                   # 直下に残す
  sync-oss.sh                           # 直下に残す
  sync-native.sh                        # 直下に残す
```

### 集計

| ディレクトリ | ファイル数 |
|-------------|-----------|
| `test/azure/` | 9 |
| `test/local/` | 10 |
| `test/` (直下) | 2 |
| `debug/` | 10 |
| `cli/block/` | 2 |
| `cli/map/` | 7 |
| `cli/ai/` | 1 |
| `ai/` | 3 |
| `rag/` | 3 |
| `stream/` | 6 |
| `screenshot/` | 2 |
| `build/` | 3 |
| `deploy/` | 3 |
| `db/` | 6 |
| `docs/` | 1 |
| 直下に残す | 4 |
| **合計** | **73** |

### 要修正箇所

#### テストスクリプト（前回計画から移動）

| 対象 | 修正内容 |
|------|---------|
| `test/local/editor.sh` | テストファイルパス 28箇所を新パスに修正 |
| `test/check-e2e-sync.sh` | マッピング 21箇所を新パスに修正 |
| `test/local/e2e.sh` | 引数→パス変換を新ディレクトリに対応 |
| `test/azure/run-all.sh` | サブスクリプトの呼出パス修正 |
| `test/local/run-all.sh` | サブスクリプトの呼出パス修正 |
| `test/deploy-verify.sh` | test-azure.sh → test/azure/run-all.sh |
| 各 `health.sh`, `api.sh` 等 | `source` パスを `env.sh` に修正 |

#### 外部参照

| 対象 | 修正内容 |
|------|---------|
| `package.json` | `test:local`, `test:azure`, `build:title`, `sync:demo` 等のパス更新 |
| `.claude/skills/test-azure/skill.md` | スクリプトパスを `scripts/test/azure/*` に更新 |
| `.claude/skills/deploy-azure/skill.md` | `deploy-verify.sh` パス更新 |
| `.claude/skills/stream/skill.md` | `obs-stream.mjs` → `scripts/stream/obs-stream.mjs` |
| `.claude/skills/map/skill.md` | `map-cli.mjs` → `scripts/cli/map/map-cli.mjs` 等に更新 |
| `.claude/skills/edit-blocks/skill.md` | `editor-cli.mjs` → `scripts/cli/block/editor-cli.mjs` に更新 |
| `.claude/skills/dev-server/skill.md` | `dev-start.sh` は直下に残すので変更不要 |
| `CLAUDE.md` | `dev-start.sh` は直下に残すので変更不要 |

#### 削除候補

| ファイル | 理由 |
|---------|------|
| `scripts/debug/debug-*.ts` (8個) | 一時的なデバッグ用。使い捨てなら削除 |
| `scripts/deploy/deploy-azure.sh` | CLAUDE.md で使用禁止。削除してもよい |
| `scripts/stream/obs-stream.sh` | `.mjs` 版に置き換え済みなら削除 |

### AI ヘッダー

全スクリプトに生成 AI が読みやすいメタデータヘッダーを追加する。

#### タグ定義

| タグ | 必須 | 値 | 説明 |
|------|------|-----|------|
| `@file` | ○ | ファイル名 | ファイル識別子 |
| `@category` | ○ | `test` / `cli` / `debug` / `ai` / `rag` / `stream` / `build` / `deploy` / `db` / `docs` / `dev` | ディレクトリに対応する分類 |
| `@subcategory` | △ | `azure` / `local` / `block` / `map` / `ai` 等 | サブディレクトリに対応する副分類 |
| `@description` | ○ | 日本語 1 行 | スクリプトの目的 |
| `@run` | ○ | 実行コマンド例 | そのまま CLI にコピペできるコマンド |
| `@skill` | △ | スキル名 | 対応する Claude Code スキル（あれば） |
| `@deps` | △ | ファイルパス（カンマ区切り） | source / import する依存スクリプト |

#### シェルスクリプト（`.sh`）のヘッダー例

```bash
#!/bin/bash
# @file health.sh
# @category test
# @subcategory azure
# @description Azure 4サービスの死活確認（curl）
# @run ./scripts/test/azure/health.sh
# @skill test-azure
# @deps scripts/test/azure/env.sh
```

#### Node スクリプト（`.mjs` / `.ts`）のヘッダー例

```javascript
#!/usr/bin/env node
/**
 * @file editor-cli.mjs
 * @category cli
 * @subcategory block
 * @description ブロックエディタを API 経由で操作する CLI
 * @run node scripts/cli/block/editor-cli.mjs list
 * @skill edit-blocks
 */
```

```typescript
#!/usr/bin/env tsx
/**
 * @file assist-cli.ts
 * @category cli
 * @subcategory ai
 * @description AI 執筆支援 CLI（章プロット → 話テキスト → .ks 変換）
 * @run npx tsx scripts/cli/ai/assist-cli.ts
 */
```

#### 既存ヘッダーとの関係

- 既存の `#!/bin/bash` や `#!/usr/bin/env node` の直後に追加する
- 既存のコメント/JSDoc がある場合は、AI タグを先頭に統合し、既存の説明文は `@description` にまとめる
- 既存の Usage セクション等はタグの後に残してよい

### 実施順序

1. `scripts/` にサブディレクトリ作成（14個）
2. ファイルを移動
3. 各スクリプトに AI ヘッダーを追加
4. テストスクリプト内のパス修正（source, サブスクリプト呼出, テストファイルパス）
5. package.json のスクリプトパス更新
6. skills のパス更新
7. 動作確認
8. 旧ファイル削除（git が rename として検出するはず）
