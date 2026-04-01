# 認証・セキュリティフロー解説書

**作成日**: 2026-02-26
**対象**: セキュリティ監査、フロントエンド・バックエンド開発者

## 1. 認証アーキテクチャ
kaedevn は、Next.js (フロントエンド) と Hono (API) の間で **JWT (JSON Web Token)** を使用したステートレスな認証を採用しています。

### 1.1 ログイン・トークン発行フロー
1.  ユーザーが `apps/next` のログイン画面から資格情報を送信。
2.  `apps/hono` がデータベース（Prisma）を参照し、パスワード（bcryptハッシュ）を検証。
3.  検証成功時、Hono は `userId` をペイロードに含む JWT を生成し、レスポンス。
4.  Next.js は受け取った JWT を **HttpOnly Cookie** として保存。

## 2. セキュリティ実装の詳細

### 2.1 クッキーの共有 (Cross-Application Auth)
Next.js (3000) と Editor (5176) は同一ドメイン（localhost）上で動作しているため、クッキーを共有できます。
- **属性**: `HttpOnly`, `Secure` (本番環境), `SameSite=Lax`。
- **利点**: エディタへ遷移する際、再ログインなしで API (8080) への認証リクエストが可能。

### 2.2 API リクエストの認可
Hono 側のミドルウェアで、すべての `/api/private/*` へのリクエストを検証します。
```typescript
// イメージ：Hono jwt middleware
app.use('/api/*', jwt({ secret: process.env.JWT_SECRET }));
```

## 3. 追加のセキュリティ機能
- **パスワードリセット**: `resetToken` および `resetTokenExpiry` を DB で管理し、1時間限定の有効期限付き URL を発行。
- **メール確認**: `emailVerified` フラグと `verificationToken` による新規登録時の本人確認。
- **ロールベースアクセス制御 (RBAC)**: `User.role` (user, admin) に基づき、`apps/next/app/(private)/admin` 以下の管理者機能へのアクセスを制限。

## 4. 運用上の注意
- **秘密鍵の管理**: `JWT_SECRET` は必ず環境変数として管理し、リポジトリに含めないこと。
- **BigInt 処理**: タイムスタンプに `BigInt` を使用しているため、JSON 化の際のシリアライズエラーに注意（Hono 側で適切に変換が必要）。

---
*Created by Gemini CLI Security Specialist.*
