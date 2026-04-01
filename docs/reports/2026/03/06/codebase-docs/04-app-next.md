# apps/next - Next.js 認証・管理画面

## 概要

Next.js App Router ベースの Web アプリケーション。ユーザー認証（登録・ログイン・パスワードリセット）、マイページ、プロジェクト管理、管理画面を提供する。エディタ（apps/editor）へのエントリポイントとして機能する。

## ディレクトリ構成

```
apps/next/
├── src/
│   ├── app/                     # App Router ページ
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── page.tsx             # トップページ
│   │   ├── login/               # ログインページ
│   │   ├── register/            # 登録ページ
│   │   ├── forgot-password/     # パスワードリセット
│   │   ├── reset-password/      # パスワードリセット実行
│   │   ├── mypage/              # マイページ
│   │   ├── projects/            # プロジェクト管理
│   │   ├── works/               # 作品一覧
│   │   ├── users/               # ユーザープロフィール
│   │   ├── admin/               # 管理画面
│   │   ├── contact/             # お問い合わせ
│   │   ├── guide/               # ガイド
│   │   ├── privacy/             # プライバシーポリシー
│   │   └── terms/               # 利用規約
│   ├── components/              # 共通コンポーネント
│   │   ├── Header.tsx           # グローバルヘッダー
│   │   ├── Footer.tsx           # フッター
│   │   ├── AuthForm.tsx         # 認証フォーム
│   │   ├── ProjectCard.tsx      # プロジェクトカード
│   │   └── ...
│   ├── contexts/                # React Context
│   │   └── AuthContext.tsx       # 認証状態管理
│   ├── lib/                     # ユーティリティ
│   │   ├── api.ts               # API クライアント
│   │   └── auth.ts              # トークン管理
│   └── middleware.ts            # Next.js ミドルウェア
├── public/                      # 静的ファイル
├── next.config.js               # Next.js 設定
├── tailwind.config.js           # Tailwind 設定
└── package.json
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| `src/app/layout.tsx` | ~80 | ルートレイアウト、AuthProvider ラップ |
| `src/contexts/AuthContext.tsx` | ~200 | 認証状態管理、トークン検証、自動リフレッシュ |
| `src/middleware.ts` | ~60 | ルート保護、未認証時リダイレクト |
| `src/lib/api.ts` | ~100 | API クライアント、認証付き fetch |
| `src/app/admin/page.tsx` | ~300 | 管理画面ダッシュボード |

## 依存関係

### 内部パッケージ
- なし（独立）

### 主要外部ライブラリ
- `next` 15 — フレームワーク
- `react` 19 / `react-dom` — UI
- `tailwindcss` — CSS
- `clsx` — クラス名ユーティリティ

## ページ構成

| パス | ページ | 認証 | 説明 |
|------|--------|------|------|
| `/` | トップページ | 不要 | サービス紹介、ログインへの導線 |
| `/login` | ログイン | 不要 | メール + パスワード認証 |
| `/register` | 登録 | 不要 | アカウント作成 |
| `/forgot-password` | パスワードリセット要求 | 不要 | リセットメール送信 |
| `/reset-password` | パスワードリセット実行 | 不要 | 新パスワード設定 |
| `/mypage` | マイページ | 必要 | プロジェクト一覧、プロフィール |
| `/projects` | プロジェクト管理 | 必要 | 作成、編集、削除 |
| `/works` | 作品一覧 | 不要 | 公開作品ギャラリー |
| `/users/:id` | ユーザープロフィール | 不要 | 公開プロフィール |
| `/admin` | 管理画面 | admin | ユーザー管理、アセット管理 |
| `/contact` | お問い合わせ | 不要 | 問い合わせフォーム |
| `/guide` | ガイド | 不要 | 使い方ガイド |
| `/privacy` | プライバシーポリシー | 不要 | 静的ページ |
| `/terms` | 利用規約 | 不要 | 静的ページ |

## 認証フロー

### ログイン
1. ユーザーが `/login` でメール + パスワードを入力
2. `POST /api/auth/login` (Hono API) でJWT トークン取得
3. `localStorage` に `authToken` と `currentUserId` を保存
4. `AuthContext` が状態を更新
5. `/mypage` にリダイレクト

### エディタへの遷移
1. マイページでプロジェクトカードをクリック
2. `window.location.href` で Editor SPA (`http://localhost:5176/projects/editor/{projectId}`) に遷移
3. Editor 側で `localStorage` の `authToken` を使って API 認証

### OAuth フロー (Code Exchange)
1. Next.js から `POST /api/auth/code` でワンタイムコード生成
2. Editor SPA に `?code=xxx` パラメータ付きで遷移
3. Editor が `POST /api/auth/exchange-code` でトークン取得

## ミドルウェア

- 保護ルート (`/mypage`, `/projects`, `/admin`) への未認証アクセスを `/login` にリダイレクト
- 認証済みユーザーの `/login`, `/register` アクセスを `/mypage` にリダイレクト
- クッキーまたは `Authorization` ヘッダーからトークンを取得

## 管理画面 (/admin)

- ダッシュボード（ユーザー数、プロジェクト数、作品数）
- ユーザー管理（一覧、ロール変更、停止/復帰）
- 公式アセット管理（アップロード、カテゴリ、削除）
- メッセージ送信（ユーザーへの通知）
- システム設定

## テスト

- `apps/next` 単体のテストは限定的
- 主に E2E テスト（`tests/auth-flow.spec.ts`, `tests/auth-redirect.spec.ts`）で認証フローを検証
- `npm run lint` で ESLint チェック（CI/CD で実行）
