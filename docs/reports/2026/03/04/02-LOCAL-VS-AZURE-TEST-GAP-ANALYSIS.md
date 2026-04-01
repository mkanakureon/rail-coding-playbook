# ローカルと Azure でテスト結果が異なるケースの考察

## 背景

過去のデプロイ障害・テスト不一致の記録（`docs/09_reports/2026/02/25/` 配下、MEMORY.md 等）を元に、ローカルと Azure 本番環境でテスト結果が乖離する原因パターンと対策を整理する。

---

## パターン 1: ビルドツールの検証レベル差

### 症状
ローカルでは動くのに、Docker ビルド / Azure デプロイで初めてエラーが出る。

### 根本原因
| 開発ツール | 本番ツール | 差分 |
|-----------|-----------|------|
| `vite dev` (esbuild) | `tsc -b` | **型チェックをスキップ**。未使用 import、型不一致が検出されない |
| `next dev` | `next build` | **ESLint を実行しない**。`use*` プレフィックス違反等 |
| `npm install` (symlink) | Docker `COPY` | **monorepo 全パッケージが暗黙的に利用可能** → Dockerfile に漏れると not found |

### 過去の事例
- `CharacterEditModal.tsx` の未使用 import (`useRef`, `AssetRef`) → `tsc` で TS6133
- `useOfficialAsset` → API 関数なのに `use` プレフィックス → `react-hooks/rules-of-hooks` 違反
- `packages/ksc-compiler` の Dockerfile COPY 漏れ → Preview ビルド失敗

### 対策
```bash
# デプロイ前チェックリスト
npx tsc --noEmit                    # 型チェック
npx next lint -w apps/next          # ESLint
docker build --platform linux/amd64 # ローカル Docker ビルド
```

**参照**: `docs/09_reports/2026/02/25/02-zenn-deploy-5traps.md`

---

## パターン 2: DB スキーマ同期漏れ

### 症状
ローカルは正常、本番で 500 エラー。カラムやテーブルが存在しない。

### 根本原因
| 開発 | 本番 | 差分 |
|------|------|------|
| `prisma db push` | `prisma migrate deploy` | push は **マイグレーションファイルを作らない** |

開発で schema.prisma を変更 → `db push` でローカル DB に即反映 → マイグレーションファイルが無い → 本番 DB に適用されない。

### 過去の事例
- `assets.slug`, `subcategory`, `source_type`, `frame_set_id` が本番 DB に存在しない → マイページ → プロジェクトタップで 500

### 対策
1. schema 変更後は `npx prisma migrate dev` でマイグレーション作成
2. 本番適用は `npx prisma migrate deploy`
3. 検出テスト: `apps/hono/test/schema-sync.test.ts` — 全テーブルの SELECT が通るか検証

**参照**: `docs/09_reports/2026/02/25/01-production-migration-report.md`

---

## パターン 3: ネットワーク・インフラ固有の差分

### 症状
ローカルテストは全通過、Azure E2E で特定テストだけ失敗する。

### 根本原因

| 要因 | ローカル | Azure | 影響 |
|------|---------|-------|------|
| **CORS** | 同一オリジン or localhost 許可 | `ALLOWED_ORIGINS` 環境変数が必要 | Editor → API 呼び出しがブロック |
| **SPA ルーティング** | Vite/nginx が全パスを index.html に返す | SWA は `staticwebapp.config.json` が必要 | ディープパスが 404 |
| **コールドスタート** | サーバー常時起動 | Container Apps `minReplicas=0` | 初回リクエストが 30 秒超タイムアウト |
| **URL 差分** | `localhost:5175` | SWA URL (azurestaticapps.net) | ハードコード URL の不一致 |
| **レートリミット** | 接続が速い・1 クライアント | 並列 E2E で API 呼び出し集中 | `apiLimiter` (200/min) 枯渇 → 429 → 認証失敗 |

### 過去の事例
- CORS 未設定 → Editor SWA からアセット管理パネルが空
- Preview SWA の SPA fallback 未設定 → `/ksc-demo.html` 以外が 404
- `VITE_PREVIEW_URL` が `ca-preview`（存在しない Container App）を指す → iframe 404
- `apiLimiter` 枯渇 → `/api/auth/me` が 429 → AuthContext がトークンクリア → `/login` リダイレクト → テスト失敗（非決定的）
- Next.js コールドスタート → テスト #02 が 30 秒タイムアウト（再実行で通過）

### 対策
1. CORS: `ALLOWED_ORIGINS` に全オリジンを設定、E2E で厳密検証（テスト #30-31.2）
2. SPA: `staticwebapp.config.json` を配置、E2E でディープパス 200 を検証（テスト #19）
3. コールドスタート: E2E 実行前に `curl` でウォームアップ、または `minReplicas=1` に設定
4. レートリミット: ローカルは `API_RATE_LIMIT=1000`、E2E はトークン注入パターンで `loginLimiter` を回避
5. URL: GitHub Actions の `vars.*` とコード内のハードコード URL を一致させる。`check-hardcoded-urls.yml` で検出

---

## パターン 4: テスト自体の品質問題

### 症状
テストは全通過なのに、本番で障害が起きる。

### 根本原因
テストの assertion が緩すぎて、失敗すべきケースでも通過してしまう。

### 過去の事例

| アンチパターン | 問題 | 修正 |
|--------------|------|------|
| `expect([200, 500]).toContain(res.status)` | DB エラー (500) でもテスト通過 | `expect(res.status).toBe(200)` |
| `if (acao) { expect(acao).toBe(...) }` | CORS 未設定 (null) でもテスト通過 | `expect(acao).toBe(EDITOR_URL)` |
| `expect([200, 404]).toContain(res.status)` | SPA fallback 未設定 (404) でもテスト通過 | `expect(res.status).toBe(200)` |
| `toHaveProperty('error')` | エラーメッセージの内容を検証しない | メッセージ文字列も検証 |

### 対策
- 期待する状態を **1 つだけ** 明示する（複数 status を許容しない）
- 条件分岐 (`if`) で検証をスキップしない
- Prisma モックで DB 依存を排除し、正確な status code を検証

**参照**: `docs/09_reports/2026/02/25/07-test-audit-report.md`, `docs/09_reports/2026/02/25/06-zenn-never-fail-test.md`

---

## パターン 5: テストのタイムアウト設定

### 症状
ローカルでは通過するが、Azure 向けテストがタイムアウトで失敗する。

### 根本原因
| レイヤー | デフォルト | 必要な値 |
|---------|-----------|---------|
| vitest テストタイムアウト | 5,000ms | 20,000ms (azure-live) |
| fetch `AbortSignal.timeout` | 設定次第 | 15,000ms |
| Playwright `navigationTimeout` | 30,000ms | コールドスタート考慮で十分 |
| Playwright `actionTimeout` | 15,000ms | Azure のレイテンシ考慮 |

### 過去の事例
- `azure-live.test.ts`: vitest デフォルト 5 秒 < fetch 15 秒 → vitest 側が先にタイムアウト
- Next.js コールドスタート: Container Apps が起動するまで 30 秒以上 → テスト #02 失敗

### 対策
- Azure 接続テストには `vi.setConfig({ testTimeout: 20000 })` を明示
- コールドスタートが予想される場合、事前にウォームアップリクエスト

---

## 今回 (2026-03-04) の修正で解消した乖離

| 乖離 | 修正内容 | 検証 |
|------|---------|------|
| CORS テストが条件付き | `if (acao)` を `expect(acao).toBe(...)` に厳密化 | E2E #30-31.2 |
| Preview SPA fallback テストが緩い | `[200, 404]` を `200` に厳密化 | E2E #19 |
| Editor プレビュー URL 未検証 | `ca-preview` 禁止テスト追加 | E2E #19.5.1 |
| azure-live URL が古い | `ca-editor/ca-preview` → SWA URL に更新 | vitest 20/20 |
| azure-live タイムアウト | `vi.setConfig({ testTimeout: 20000 })` 追加 | vitest 20/20 |
| Editor テストの命名不一致 | `API.characters` → `API.chClass` に修正 | vitest 24/24 |

---

## まとめ: 乖離を防ぐ原則

1. **ローカルでも本番と同じ検証を走らせる**: `tsc --noEmit`, `next lint`, `docker build`
2. **テストは厳密に**: 複数 status 許容や条件付き assertion は禁止
3. **環境変数とURLは一元管理**: GitHub Actions `vars.*` と Dockerfile の ARG を同期
4. **DB スキーマ変更はマイグレーション必須**: `db push` だけで満足しない
5. **タイムアウトは明示的に**: ネットワーク越しのテストはデフォルト値に頼らない
6. **CI 導入が根本解決**: ローカル → 本番のギャップは CI で自動検出すべき

**参照ドキュメント一覧**:
- `docs/09_reports/2026/02/25/02-zenn-deploy-5traps.md` — 5 つの罠
- `docs/09_reports/2026/02/25/03-azure-deploy-troubleshooting-report.md` — トラブルシューティング
- `docs/09_reports/2026/02/25/01-production-migration-report.md` — DB マイグレーション障害
- `docs/09_reports/2026/02/25/07-test-audit-report.md` — テスト品質監査
- `docs/09_reports/2026/02/25/06-zenn-never-fail-test.md` — 絶対失敗しないテストのアンチパターン
- `docs/09_reports/2026/03/04/01-RELEASE-TEST-REPORT.md` — 今回のリリーステスト
