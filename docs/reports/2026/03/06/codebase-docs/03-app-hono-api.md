# apps/hono - Hono API サーバー

## 概要

Hono 4 ベースの REST API サーバー。認証、プロジェクト管理、アセット管理、プレビュー生成、AI 執筆支援、管理画面機能を提供する。Prisma ORM で PostgreSQL に接続し、Azure Blob Storage にアセットを格納する。

## ディレクトリ構成

```
apps/hono/
├── src/
│   ├── index.ts              # エントリポイント (151行)
│   ├── routes/               # 20 ルートファイル
│   ├── middleware/            # 5 ミドルウェア
│   ├── lib/                  # 共通ライブラリ
│   │   ├── assist/           # AI 執筆支援モジュール (12ファイル)
│   │   └── logging/          # ログシステム
│   ├── types/                # 型定義
│   └── scripts/              # DB マイグレーションスクリプト
├── test/                     # 43 テストファイル (6,814行)
├── prisma/
│   ├── schema.prisma         # 22 モデル (392行)
│   └── migrations/           # マイグレーションファイル
├── Dockerfile                # マルチステージビルド
└── package.json
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| `src/index.ts` | 151 | エントリポイント、ミドルウェアチェーン、ルート登録 |
| `src/routes/assets.ts` | 987 | アセット管理（アップロード、公式インポート、キャラクタークラス） |
| `src/routes/admin.ts` | 970 | 管理画面（ユーザー、アセット、バックアップ、DB マイグレーション） |
| `src/routes/assist.ts` | 799 | AI 執筆支援（4段階 LLM パイプライン） |
| `src/routes/auth.ts` | 750 | 認証（登録、ログイン、パスワードリセット、ゲスト） |
| `src/routes/works.ts` | 573 | 公開作品（公開/非公開、いいね、再生数） |
| `src/routes/projects.ts` | 505 | プロジェクト CRUD + AI コンテキスト |
| `prisma/schema.prisma` | 392 | DB スキーマ (22 モデル) |

## ミドルウェアチェーン (適用順)

1. **CORS** — `ALLOWED_ORIGINS` 環境変数で許可オリジン設定
2. **Logger** — JSON 形式アクセスログ (Azure Log Analytics 向け)
3. **Compress** — gzip レスポンス圧縮
4. **Analytics** — 分析ログシンク
5. **Security Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS
6. **Rate Limit** — `/api/*` ルートに適用

### レートリミッター

| リミッター | 上限 | ウィンドウ | 環境変数 |
|-----------|------|----------|----------|
| apiLimiter | 200 | 1分 | API_RATE_LIMIT |
| loginLimiter | 5 | 1分 | LOGIN_RATE_LIMIT |
| registerLimiter | 3 | 1時間 | REGISTER_RATE_LIMIT |
| contactLimiter | 5 | 1時間 | — |
| forgotPasswordLimiter | 3 | 1時間 | — |
| aiAssistLimiter | 20 | 1分 | — |
| guestLimiter | 10 | 1時間 | — |

## ルート一覧

### 認証 (auth.ts)

| メソッド | パス | 認証 | 説明 |
|---------|------|------|------|
| POST | /api/auth/register | 不要 | ユーザー登録 + メール認証送信 |
| POST | /api/auth/login | 不要 | ログイン (JWT トークン返却) |
| POST | /api/auth/logout | 不要 | ログアウト |
| GET | /api/auth/me | 必要 | 現在のユーザー情報 |
| POST | /api/auth/verify-email | 必要 | メール認証 |
| POST | /api/auth/forgot-password | 不要 | パスワードリセットメール送信 |
| POST | /api/auth/reset-password | 不要 | パスワードリセット実行 |
| POST | /api/auth/code | 必要 | ワンタイム認証コード生成 (OAuth) |
| POST | /api/auth/exchange-code | 不要 | コード → トークン交換 |
| POST | /api/auth/guest | 不要 | ゲストアカウント作成 (7日有効) |
| POST | /api/auth/guest/restore | 不要 | ゲストデータ復元 |
| POST | /api/auth/change-password | 必要 | パスワード変更 |

### プロジェクト (projects.ts)

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/projects | ユーザーのプロジェクト一覧 |
| POST | /api/projects | プロジェクト作成 |
| GET | /api/projects/:id | 詳細取得 (+ `_ai_context` 付与) |
| PUT | /api/projects/:id | 更新 |
| DELETE | /api/projects/:id | 削除 |

### アセット (assets.ts)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/assets/:projectId/upload | 画像/音声アップロード |
| GET | /api/assets/:projectId | プロジェクトアセット一覧 |
| PATCH | /api/assets/:projectId/:assetId | アセット更新 (slug, カテゴリ) |
| DELETE | /api/assets/:projectId/:assetId | アセット削除 |
| POST | /api/assets/:projectId/use-official | 公式アセットインポート |
| POST | /api/assets/:projectId/character-class | キャラクタークラス作成 |
| PUT | /api/assets/:projectId/character-class/:slug | キャラクタークラス更新 |
| POST | /api/assets/:projectId/upload-frameset | スプライトシートアップロード |

### 作品 (works.ts)

| メソッド | パス | 認証 | 説明 |
|---------|------|------|------|
| GET | /api/works | 不要 | 公開作品一覧 |
| POST | /api/works | 必要 | 作品公開 |
| GET | /api/works/:id | 不要 | 作品詳細 |
| PUT | /api/works/:id | 必要 | 公開/非公開切替 |
| POST | /api/works/:id/play | 不要 | 再生数インクリメント |
| GET/POST/DELETE | /api/works/:id/like | 必要 | いいね管理 |

### AI 執筆支援 (assist.ts)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | /api/assist/work-setting | 作品設定保存 |
| POST | /api/assist/generate/chapters | Stage 1: 章プロット生成 |
| POST | /api/assist/generate/episodes | Stage 2: 話プロット生成 |
| POST | /api/assist/generate/text | Stage 3: 本文生成 |
| POST | /api/assist/generate/ks | Stage 4: .ks スクリプト変換 |
| POST | /api/assist/regenerate | 再生成 |
| GET | /api/assist/result/:stage/:stageKey | 生成結果取得 |

### その他ルート

| パス | 説明 |
|------|------|
| GET /api/health | ヘルスチェック |
| GET /api/editor-schema | ブロック型定義 (24h キャッシュ) |
| GET /api/preview/:id | KS プレビュースクリプト生成 |
| GET /api/users/:id | 公開ユーザープロフィール |
| GET /api/official-assets | 公式アセット検索 |
| GET /api/messages | 通知一覧 |
| POST /api/contact | お問い合わせ |
| POST /mcp | Model Context Protocol エンドポイント |
| /api/admin/* | 管理画面 API (admin ロール必要) |

## Prisma スキーマ (22 モデル)

### コアモデル

| モデル | 役割 |
|--------|------|
| User | アカウント (username, email, role: user/admin/guest, status: active/suspended) |
| Project | 編集可能プロジェクト (title, data: JSON) |
| Work | 公開作品 (playCount, likeCount, category, status) |
| Tag / WorkTag | タグ (多対多) |

### アセットモデル

| モデル | 役割 |
|--------|------|
| Asset | プロジェクトアセット (slug, kind, category, blobPath, sourceType) |
| OfficialAsset | 管理者管理の共有アセット |
| UserAsset | ユーザー個人ライブラリ |

### キャラクターモデル

| モデル | 役割 |
|--------|------|
| Character | レガシーキャラクター (per project) |
| Expression | キャラクター表情 |
| FrameSet | アニメーションスプライトシート |
| UserCharacter / UserExpression | ユーザー所有クロスプロジェクトキャラクター |

### AI / ソーシャル

| モデル | 役割 |
|--------|------|
| AiRequest | LLM 呼び出し監査ログ |
| WorkSetting | 作品設定 (JSON) |
| GenerationResult | 生成結果 (stage, stageKey, result) |
| RagChunk | RAG ベクトルインデックス |
| Like | いいね (userId, workId) |
| Message | 管理者 → ユーザー通知 |

## 共通ライブラリ (src/lib/)

| ファイル | 役割 |
|---------|------|
| auth.ts | JWT 生成/検証、bcrypt |
| db.ts | Prisma シングルトン |
| id.ts | ULID 生成・検証・タイムスタンプ抽出 |
| config.ts | ランタイム設定、ストレージモード、アセット URL 解決 |
| validation.ts | Zod スキーマ (register, login) |
| email.ts | メール送信 (Azure or コンソール) |
| azure.ts | Azure Email/Blob Storage クライアント |
| image.ts | sharp による画像最適化 |
| editor-schema.ts | ブロック型定義 (14 ブロック) |

## テスト

- **43 テストファイル、6,814 行**
- ルートテスト (17 ファイル): 全エンドポイントの CRUD テスト
- ミドルウェアテスト (5 ファイル): auth, admin, error, logger, rate-limit
- ライブラリテスト (5 ファイル): auth, id, validation, email, editor-schema
- AI テスト (14 ファイル): 4段階パイプライン、RAG、プロンプト、パーサー
- 構造テスト (2 ファイル): api-structure, schema-sync
- 統合テスト (2 ファイル): MCP, Azure live

## セキュリティ

- JWT 認証 (Authorization: Bearer)
- ロールベースアクセス制御 (user/admin/guest)
- ゲストアカウント有効期限 (7日)
- 停止ユーザー拒否
- エンドポイント別レートリミッティング
- SQL インジェクション防止 (Prisma)
- XSS/クリックジャッキング防止ヘッダー
- CORS ホワイトリスト
