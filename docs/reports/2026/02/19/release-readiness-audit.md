# リリース・運用 準備状況監査レポート

**作成日**: 2026-02-19
**対象**: kaedevn-monorepo 全体

---

## 目次

1. [総合評価](#1-総合評価)
2. [セキュリティ](#2-セキュリティ)
3. [デプロイ・インフラ](#3-デプロイインフラ)
4. [データベース](#4-データベース)
5. [テスト・品質管理](#5-テスト品質管理)
6. [SEO・フロントエンド](#6-seoフロントエンド)
7. [運用・監視](#7-運用監視)
8. [その他の構造的問題](#8-その他の構造的問題)
9. [対応優先度まとめ](#9-対応優先度まとめ)

---

## 1. 総合評価

| 領域 | 状態 | 備考 |
|------|------|------|
| セキュリティ | **要対応** | レートリミット未実装、JWT秘密鍵フォールバック |
| デプロイ | **一部完了** | スクリプトあり、CI/CDなし、ロールバック未整備 |
| データベース | **概ね良好** | Prisma管理、インデックス一部不足、PrismaClient重複あり |
| テスト | **一部完了** | editor/web/uiにテストなし、E2EがCIに未組込 |
| SEO・UX | **一部完了** | 法務ページあり、favicon/OGP/メタデータ不足、`next/image`未使用 |
| パフォーマンス | **要改善** | 公開ページが`'use client'`でSSR無効、画像lazy loadingなし |
| 運用・監視 | **未対応** | エラートラッキング・アラート未設定 |

---

## 2. セキュリティ

### 2.1 P0（リリース前に必須）

#### レートリミット未実装
- **影響**: 全APIエンドポイントが無制限アクセス可能
- **リスク**: ログイン総当たり攻撃、メールスパム（contact/forgot-password）、プレイ数水増し
- **対象ファイル**: `apps/hono/src/index.ts`
- **対策**: Honoのレートリミットミドルウェア導入（ログイン: 5回/分、登録: 3回/時、コンタクト: 5回/時）

#### JWT秘密鍵のハードコードフォールバック
- **影響**: `JWT_SECRET`環境変数が未設定の場合、予測可能な固定値が使用される
- **リスク**: 本番環境で環境変数設定漏れ時、全トークン偽造が可能
- **対象ファイル**: `apps/hono/src/lib/auth.ts:5`
```typescript
// 現在
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
// あるべき姿
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
```

#### 管理者SQLクエリエンドポイント
- **影響**: `$queryRawUnsafe`でSELECT文を直接実行可能
- **リスク**: キーワードフィルタ回避でPostgreSQL関数(`pg_read_file`等)による情報漏洩
- **対象ファイル**: `apps/hono/src/routes/admin.ts:382-434`
- **対策**: 本番環境では無効化、または許可リスト方式に変更

### 2.2 P1（リリース前推奨）

| 項目 | 対象ファイル | 内容 |
|------|-------------|------|
| セキュリティヘッダー未設定 | `apps/hono/src/index.ts`, `apps/next/next.config.ts` | CSP, X-Frame-Options, HSTS, X-Content-Type-Options が未設定。クリックジャッキング脆弱性 |
| ファイルアップロードサイズ制限なし | `apps/hono/src/routes/assets.ts` | 巨大ファイルによるメモリ/ディスク枯渇の可能性 |
| アセットの所有者検証なし | `apps/hono/src/routes/assets.ts` | 認証済みユーザーが他人のプロジェクトにアップロード/削除可能 |
| ZIP爆弾対策なし | `apps/hono/src/routes/assets.ts` | framesetアップロードで展開後サイズ無制限 |

### 2.3 P2（リリース後対応可）

| 項目 | 内容 |
|------|------|
| JWT を localStorage に保存 | XSS攻撃に脆弱。HttpOnly Cookieの方が安全 |
| ログアウトがサーバー側でno-op | トークン無効化なし（24h有効のまま） |
| メール認証未強制 | `emailVerified`フラグ存在するがログイン時チェックなし |
| コンタクトフォームにZodバリデーションなし | 手動バリデーションのみ |
| エラーメッセージがクライアントに漏洩 | `apps/hono/src/middleware/error.ts` で`err.message`をそのまま返却 |
| ページネーション上限なし | `limit=999999`で大量データ取得可能 |
| プレビューエンドポイント認証なし | プロジェクトIDが分かれば全データ閲覧可能（ULID推測可能） |

### 2.4 良好な点

- Zodバリデーションがほぼ全ルートで適用済み
- bcrypt（10ラウンド）でパスワードハッシュ化
- Prisma ORMによるSQLインジェクション防止
- CORS設定は適切（ワイルドカード不使用、本番は`ALLOWED_ORIGINS`環境変数）
- `.gitignore`で`.env`ファイルが正しく除外
- 認可コードの30秒TTL（クロスアプリ認証）
- ULIDによるID生成

---

## 3. デプロイ・インフラ

### 3.1 現状

| 項目 | 状態 |
|------|------|
| デプロイスクリプト | `scripts/deploy-azure.sh` あり（Docker build → push → update） |
| Docker構成 | 全4アプリにMulti-stage Dockerfile あり |
| Azure Container Apps | 4アプリ稼働中（japaneast） |
| CDN | Azure Front Door スクリプトあり（blob + API） |
| CI/CD | `.github/workflows/ci.yml` あり（テスト・型チェックのみ、デプロイなし） |

### 3.2 要対応

#### CI/CDパイプラインにデプロイステップがない
- 現状: テスト/型チェックのみ。デプロイは手動スクリプト実行
- **対策**: GitHub Actions にデプロイジョブ追加（main ブランチ push 時）

#### ロールバック手順・スクリプトなし
- イメージタグ（git hash + timestamp）は保持されるが、ロールバックスクリプトがない
- DBマイグレーションのロールバック手順もない
- **対策**: `scripts/rollback.sh` 作成、デプロイ履歴ログ

#### Infrastructure as Code なし
- 全リソースが`az` CLIの手動実行で作成。Bicep/Terraform なし
- **対策**: Bicepテンプレート作成で再現性確保

#### ステージング環境なし
- 本番環境のみ。テスト→即本番
- **対策**: Container Apps Environment をもう1つ作成

#### Dockerfileの問題点

| 問題 | 影響 |
|------|------|
| `npm install` → `npm ci` に変更すべき | 非決定的ビルド |
| `apps/hono` に `.dockerignore` なし | ビルドコンテキストに不要ファイル含む |
| 本番Azure URLがDockerfileにハードコード | 環境変更時にDockerfile修正が必要 |
| Honoの本番イメージにdevDependencies含む | イメージサイズ肥大 |

#### Container Apps設定

| 問題 | 影響 |
|------|------|
| 全アプリ `min-replicas=0` | コールドスタートで10-30秒の遅延 |
| オートスケールルール未定義 | Azure デフォルト依存 |
| ヘルスチェックプローブ未設定（コード上） | デプロイスクリプトで`--probe-*`フラグ未指定 |
| Nginx系アプリ（editor/preview）にヘルスエンドポイントなし | コンテナレベルの死活監視不可 |

### 3.3 良好な点

- Multi-stage ビルドで非rootユーザー実行
- Next.js standalone出力でイメージ軽量化
- Nginx for 静的SPA（editor/preview）
- gzip圧縮有効
- Cache-Controlヘッダー適切設定
- Front Doorスクリプト整備

---

## 4. データベース

### 4.1 現状

- **ORM**: Prisma 5.22（PostgreSQL 16）
- **マイグレーション**: Prisma Migrations で管理（9つのマイグレーション）
- **テーブル**: users, projects, pages, assets, characters, expressions, works, likes, categories, tags, work_tags, messages, contacts

### 4.2 要対応

#### インデックス不足
- `projects.userId` にインデックスなし（ユーザーのプロジェクト一覧取得で頻用）
- `works.userId` にインデックスなし（作者ページで使用）
- `works.projectId` にインデックスなし（作品公開時のルックアップ）
- `works.status` にインデックスなし（公開作品一覧で `status = 'published'` フィルタ）
- `works.category` にインデックスなし（カテゴリフィルタで使用）
- **対策**: Prismaスキーマに `@@index` 追加 + マイグレーション生成

#### PrismaClient重複インスタンス
- `apps/hono/src/routes/users.ts:14` で独自に `new PrismaClient()` を作成
- `lib/db.ts` の共有シングルトンを使用していない → コネクションプールが二重化
- **対策**: `import { prisma } from '../lib/db.js'` に変更

#### バックアップ
- Azure PostgreSQL の7日間自動バックアップに依存
- 手動バックアップスクリプト/手順なし
- デプロイ前のバックアップステップなし
- **対策**: `pg_dump` 定期実行スクリプト作成（特に本番リリース前）

#### コネクションプーリング
- Prisma Clientを直接使用、PgBouncer等なし
- `connection_limit` パラメータ未設定
- Container Apps 3レプリカ時にコネクション枯渇の可能性
- **対策**: Prisma `connection_limit` 設定、またはPgBouncer導入

#### シードスクリプトなし
- `prisma/seed.ts` が存在しない
- テストデータは手動作成が必要
- **対策**: 開発用シードスクリプト作成（最低限のユーザー・プロジェクト・作品データ）

#### マイグレーションのロールバック不可
- Prisma は forward-only マイグレーション（down migration なし）
- 失敗時の手動介入が必要
- **対策**: 重要なマイグレーション前に `pg_dump` 実行を手順化

### 4.3 良好な点

- Prismaで型安全なクエリ
- マイグレーション履歴が管理されている
- `likes`テーブルに複合ユニークインデックス (`work_id, user_id`)
- `messages`テーブルに `to_user_id` インデックス
- シードスクリプト（`prisma/seed.ts`）あり
- トランザクション使用（いいね作成/削除）

---

## 5. テスト・品質管理

### 5.1 テストカバレッジ

| パッケージ | テストファイル数 | 状態 |
|-----------|-----------------|------|
| `packages/core` | 5 | OK |
| `packages/compiler` | 6 | OK |
| `packages/interpreter` | 11 | OK（最も充実） |
| `apps/hono` | 8 | OK（ヘルパー・セットアップあり） |
| `apps/next` | 4 | 最低限（広告・ユーティリティのみ） |
| `apps/editor` | **0** | **テストなし** (`passWithNoTests: true` で隠蔽) |
| `packages/web` | **0** | **テストなし**（vitest.configもなし） |
| `packages/ui` | **0** | **テストなし** |
| `packages/tools` | **0** | **テストなし** |

### 5.2 E2Eテスト（Playwright）

- 11テストファイルあり（auth, navigation, editor, admin等）
- **CIに未組込**（GitHub Actionsワークフローにない）
- `webServer` 自動起動コメントアウト（手動サーバー起動が必要）
- 一部テストで `waitForTimeout` 使用（CLAUDE.mdルール違反）

### 5.3 コード品質ツール

| ツール | 状態 |
|--------|------|
| ESLint | `apps/editor` + `apps/next` のみ。他パッケージなし。ルートは`echo "No linter..."` |
| Prettier/Biome | **未導入** |
| lint-staged | **未導入** |
| Husky | あり（ハードコードURL検出のみ、lint/test/typecheckなし） |
| TypeCheck | `packages/core` + `packages/web` のみ（他6パッケージ未チェック） |
| カバレッジ | `apps/hono` のみc8設定あり。閾値未設定 |

### 5.4 CI/CDパイプライン（`.github/workflows/ci.yml`）

- typecheckジョブ: core + web のみ
- ユニットテスト: core, compiler, interpreter, editor, next, hono
- **欠落**: E2Eテスト、lint、フォーマット、カバレッジ閾値

### 5.5 要対応

| 項目 | 優先度 |
|------|--------|
| `apps/editor` にテスト追加 | P1 |
| `npm run typecheck` を全パッケージ対象に拡大 | P1 |
| ESLintをルートレベルで統一設定 | P2 |
| Prettier導入（コードフォーマット統一） | P2 |
| pre-commitフックにlint + typecheck追加 | P2 |
| Vitest バージョン統一（^1.2.0 と ^4.0.18 混在） | P2 |
| E2EテストをCIに組込 | P2 |
| カバレッジ閾値設定 | P3 |

---

## 6. SEO・フロントエンド

### 6.1 現状

| 項目 | 状態 |
|------|------|
| メタタグ | `app/layout.tsx` に基本メタ情報あり |
| sitemap.xml | **なし** |
| robots.txt | **なし** |
| OGP画像 | **なし**（`opengraph-image` ファイル不在） |
| favicon | **なし**（`favicon.ico` / `icon.png` 不在） |
| 構造化データ（JSON-LD） | **なし** |
| 404ページ | `app/not-found.tsx` あり |
| 500ページ | `app/error.tsx` あり / `app/global-error.tsx` **なし** |
| PWA | **なし**（manifest.json なし） |
| アナリティクス | Google AdSense のみ（GA未設定） |
| Cookie同意 | **なし** |
| プライバシーポリシー | `app/(public)/privacy/page.tsx` あり |
| 利用規約 | `app/(public)/terms/page.tsx` あり |
| モバイルナビゲーション | **なし**（ハンバーガーメニューなし、sm以下でリンク非表示） |
| `next/image` 使用 | **なし**（全て生の`<img>`タグ、lazy loadingなし） |
| ページ別メタデータ | **なし**（ルートlayout.tsxのみ、各ページに`generateMetadata`なし） |
| レスポンシブ対応 | Tailwind CSS で対応済み |
| ダークモード | 対応済み（`dark:` クラス使用） |

### 6.2 要対応

| 項目 | 優先度 | 備考 |
|------|--------|------|
| Cookie同意バナー | P0 | AdSense + 日本の改正個人情報保護法対応 |
| favicon.ico | P1 | ブランディング基本要素。未設定でブラウザタブにアイコンなし |
| OGP画像 + OGPメタタグ | P1 | SNS共有時の表示。`openGraph`メタデータが全ページで未設定 |
| sitemap.xml | P1 | SEO基本要素。`app/sitemap.ts` 作成 |
| robots.txt | P1 | クロール制御。`app/robots.ts` 作成 |
| global-error.tsx | P1 | ルートlayoutのエラー時のフォールバック |
| ページ別メタデータ | P1 | `/works`, `/play/[id]`, `/users/[id]` 等に`generateMetadata`追加 |
| `next/image` 導入 | P1 | 画像最適化・lazy loading・WebP変換。全`<img>`を置き換え |
| 公開ページのサーバーコンポーネント化 | P1 | ホームページ等が`'use client'`でSSR無効。SEO・FCP悪化 |
| モバイルナビゲーション（ハンバーガーメニュー） | P2 | sm以下でナビリンクが非表示 |
| Google Analytics | P2 | アクセス解析 |
| スキップナビゲーション + ARIA改善 | P2 | a11y: スクリーンリーダー対応 |
| loading.tsx | P2 | ルートレベルのルート遷移フィードバック |
| 構造化データ | P3 | 検索結果リッチスニペット |

### 6.3 エディタ（`apps/editor`）

- Vite + React SPA（Nginx配信）
- ログインページ（`/login`）あり
- SEO考慮は不要（認証後のツール）
- **モバイル対応**: Playwright E2Eテストあり（iPhone 12）
- **問題**: `lang="en"` → `lang="ja"` に修正すべき（UIは日本語）
- **問題**: `<title>editor</title>` → プロジェクト名を反映すべき
- **問題**: faviconがViteデフォルト（`/vite.svg`）→ ブランドアイコンに変更すべき
- **良好**: `focus-trap-react`でモーダルのフォーカス管理、aria属性89箇所

### 6.4 良好な点

- Tailwind CSSによるレスポンシブ＋ダークモード
- Next.js App Router使用（SSR対応）
- プライバシーポリシー・利用規約ページ作成済み
- フッターからリンク済み
- `<Suspense>` によるローディング状態管理
- フォームの `disabled` 状態管理
- `<label>` + `htmlFor` による基本的なa11y

---

## 7. 運用・監視

### 7.1 現状

| 項目 | 状態 |
|------|------|
| ヘルスチェック | `/api/health` エンドポイントあり（※DB接続確認なし、uptimeのみ） |
| 構造化ログ | `apps/hono/src/middleware/logger.ts` あり（JSON形式、Azure Log Analytics対応） |
| エラーログ | `apps/hono/src/middleware/error.ts` あり（構造化JSON + スタックトレース） |
| フロントエンドログ | `packages/web/src/utils/Logger.ts` あり（リングバッファ1000件） |
| エラートラッキング（Sentry等） | **なし** |
| APM | **なし** |
| アラート | **なし**（ドキュメントに例あるが未実装） |
| ダッシュボード | **なし** |
| ログ集約 | Azure Log Analytics（Container Apps標準） |
| バックアップ | Azure PostgreSQL 7日間自動バックアップのみ |

### 7.2 要対応

| 項目 | 優先度 | 備考 |
|------|--------|------|
| エラートラッキング導入 | P1 | Sentry推奨（Hono + Next.js両方） |
| 起動時の環境変数バリデーション | P1 | 必須変数（DATABASE_URL, JWT_SECRET等）未設定時に即停止 |
| Azure Monitor アラート設定 | P2 | CPU > 80%, エラー率 > 5%, レスポンスタイム > 2s |
| 定期バックアップスクリプト | P2 | pg_dump + Azure Blob Storage保存 |
| インメモリ認可コードストアのスケーラビリティ | P2 | 複数レプリカで認可コード共有不可（Redis等に移行） |
| ヘルスチェック改善 | P2 | DB接続・Azure Storage等の依存サービスも確認するよう拡張 |
| リクエストトレーシング | P3 | Correlation ID による複数サービス間のリクエスト追跡 |
| フロントエンドエラー監視 | P3 | React Error Boundary + サーバーへのレポーティング |

---

## 8. その他の構造的問題

| 項目 | 詳細 | 優先度 |
|------|------|--------|
| `packages/schemas` が空 | `src/` ディレクトリは存在するがファイルなし。使用するか削除すべき | P3 |
| `packages/ui` が React 18、他アプリは React 19 | バージョン不一致による互換性リスク | P2 |
| ルートの `test-mobile-ui.spec.ts` が misplaced | `tests/` ディレクトリに移動すべき | P3 |
| ルート `package.json` に editor 用依存 | `focus-trap-react`, `react-hot-toast` 等がルートに誤配置 | P3 |
| `apps/next/.env.example` なし | 他アプリにはあるが Next.js だけテンプレートなし | P2 |
| `apps/hono/src/routes/users.ts` の PrismaClient 重複 | `lib/db.ts` シングルトンを使わず独自インスタンス | P1 |

---

## 9. 対応優先度まとめ

### P0: リリース前に必須

| # | 項目 | 領域 |
|---|------|------|
| 1 | レートリミット導入（ログイン、登録、コンタクト、パスワードリセット） | セキュリティ |
| 2 | JWT_SECRET フォールバック削除 + 起動時バリデーション | セキュリティ |
| 3 | 管理者SQLエンドポイントの本番無効化 | セキュリティ |
| 4 | Cookie同意バナー | 法務 |

### P1: リリース前推奨

| # | 項目 | 領域 |
|---|------|------|
| 5 | セキュリティヘッダー追加（CSP, X-Frame-Options, HSTS） | セキュリティ |
| 6 | ファイルアップロードサイズ制限 | セキュリティ |
| 7 | アセット所有者検証 | セキュリティ |
| 8 | PrismaClient重複修正（`users.ts`） | DB |
| 9 | エラートラッキング（Sentry）導入 | 運用 |
| 10 | favicon / OGP画像 / OGPメタタグ追加 | SEO |
| 11 | sitemap.xml / robots.txt 生成 | SEO |
| 12 | ページ別メタデータ（`generateMetadata`） | SEO |
| 13 | `next/image` 導入（全`<img>`置き換え） | パフォーマンス |
| 14 | 公開ページのサーバーコンポーネント化 | パフォーマンス |
| 15 | global-error.tsx 作成 | UX |
| 16 | `npm run typecheck` 全パッケージ対象化 | 品質 |
| 17 | Container Apps API の min-replicas=1 に変更 | インフラ |
| 18 | DBインデックス追加（projects.userId, works.userId等） | DB |

### P2: リリース後対応可

| # | 項目 | 領域 |
|---|------|------|
| 19 | CI/CDにデプロイステップ追加 | インフラ |
| 20 | ステージング環境構築 | インフラ |
| 21 | ロールバックスクリプト作成 | インフラ |
| 22 | Dockerfile改善（npm ci, .dockerignore, devDeps除外） | インフラ |
| 23 | ESLint統一設定 + Prettier導入 | 品質 |
| 24 | pre-commitフック強化（lint, typecheck） | 品質 |
| 25 | E2EテストCI組込 | 品質 |
| 26 | モバイルナビゲーション（ハンバーガーメニュー） | UX |
| 27 | スキップナビゲーション + ARIA改善 | a11y |
| 28 | loading.tsx（ルート遷移フィードバック） | UX |
| 29 | Google Analytics導入 | SEO |
| 30 | Azure Monitor アラート設定 | 運用 |
| 31 | コネクションプーリング導入 | DB |
| 32 | メール認証強制 | セキュリティ |
| 33 | エラーメッセージのサニタイズ | セキュリティ |
| 34 | エディタ `lang="ja"` 修正 + favicon変更 | エディタ |

### P3: 将来対応

| # | 項目 | 領域 |
|---|------|------|
| 35 | Infrastructure as Code (Bicep) | インフラ |
| 36 | カバレッジ閾値設定 | 品質 |
| 37 | 構造化データ（JSON-LD） | SEO |
| 38 | PWA対応 | UX |
| 39 | フォント最適化（サブセット化） | パフォーマンス |
| 40 | バンドルサイズ監視 | パフォーマンス |

---

## 付録: ファイル対応表

主な対応が必要なファイル:

```
apps/hono/src/index.ts            → レートリミット、セキュリティヘッダー
apps/hono/src/lib/auth.ts         → JWT_SECRET バリデーション
apps/hono/src/routes/admin.ts     → SQL実行エンドポイント制限
apps/hono/src/routes/assets.ts    → サイズ制限、所有者検証
apps/hono/src/routes/users.ts     → PrismaClient重複修正（lib/db.ts使用に変更）
apps/hono/src/middleware/error.ts  → エラーメッセージサニタイズ
apps/next/next.config.ts          → セキュリティヘッダー、images設定
apps/next/app/layout.tsx          → メタデータ強化（OGP）
apps/next/app/global-error.tsx    → 新規作成
apps/next/app/sitemap.ts        → 新規作成
apps/next/app/robots.ts         → 新規作成
package.json                    → typecheck/lint スクリプト修正
.github/workflows/ci.yml       → lint, E2E, デプロイジョブ追加
scripts/deploy-azure.sh         → pre-deploy validation追加
```
