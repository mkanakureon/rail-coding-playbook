# モバイル ゲストモード 実装レポート

設計書: `19-mobile-guest-mode-spec.md`

## 実装日

2026-02-28

## 概要

スマホユーザーがログインなしで作品を作成し、72時間以内にメール認証すれば正規ユーザーに昇格できるゲストモードを実装した。Phase 1 + Phase 2 の全12ステップを一括実装。

---

## 変更ファイル一覧

### Backend（apps/hono）

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `prisma/schema.prisma` | User モデルに `expiresAt BigInt? @map("expires_at")` 追加。role コメントに `guest` 追記 |
| 1 | `prisma/migrations/20260228…_add_guest_expires_at/` | `ALTER TABLE "users" ADD COLUMN "expires_at" BIGINT` |
| 2 | `src/middleware/rate-limit.ts` | `guestLimiter` 追加（10リクエスト/時間） |
| 3 | `src/middleware/auth.ts` | `expiresAt` を select に追加。suspended チェックの後にゲスト期限チェック追加 |
| 4 | `src/routes/auth.ts` | ゲスト用エンドポイント3つ + verify 修正 + 期限切れゲスト自動削除 |
| 5 | `src/routes/projects.ts` | ゲストのプロジェクト作成時に3件上限チェック |
| 6 | `src/routes/assets.ts` | ゲストの upload / upload-frameset を 403 で拒否 |

### Frontend（apps/editor）

| # | ファイル | 変更内容 |
|---|---------|---------|
| 8 | `src/config/api.ts` | ゲストトークン管理関数 + guest API エンドポイント追加 |
| 9 | `src/components/GuestLanding.tsx` | 新規作成 — ゲスト開始画面 |
| 10 | `src/components/GuestUpgradeBanner.tsx` | 新規作成 — 残り時間表示 + アカウント登録フォーム |
| 11 | `src/pages/EditorPage.tsx` | 4分岐の認証フロー + ゲストバナー表示 |
| 12 | `src/App.tsx` | `/projects/editor`（workId なし）ルート追加 |

---

## API エンドポイント詳細

### `POST /api/auth/guest`（認証不要）

ゲストアカウントとデフォルトプロジェクトをトランザクションで同時作成。

- **Rate limit**: `guestLimiter`（10回/時間、IP単位）
- **User**: `role: "guest"`, `email: guest_{ulid}@guest.local`, `expiresAt: now + 72h`
- **Project**: タイトル「マイプロジェクト」、第1話（start ブロック付き）
- **JWT**: 72時間有効

```json
// Response 201
{
  "token": "eyJhbG...",
  "user": { "id": "...", "username": "guest_abc12345", "role": "guest", "expiresAt": 1740000000000 },
  "project": { "id": "...", "title": "マイプロジェクト" }
}
```

### `POST /api/auth/guest/restore`（認証不要）

Bearer トークンでゲスト復帰を試みる。成功時は期限を72h延長し、新トークンとプロジェクト一覧を返す。

- トークン検証 → User 検索 → `role === "guest"` かつ `expiresAt > now` を確認
- `expiresAt` を72h延長、新JWT発行

```json
// Response 200
{
  "token": "eyJhbG...",
  "user": { "id": "...", "username": "guest_abc12345", "role": "guest", "expiresAt": 1740000000000 },
  "projects": [{ "id": "...", "title": "マイプロジェクト", "createdAt": ..., "updatedAt": ... }]
}
```

### `POST /api/auth/guest/upgrade`（要認証）

ゲストユーザーにメールアドレス・パスワードを紐づけ、確認メールを送信する。

- `authMiddleware` + `registerSchema`（Zod バリデーション）
- `role === "guest"` チェック、email 重複チェック
- `username`, `email`, `passwordHash` を更新（role は "guest" のまま）
- 確認メール送信

### `POST /api/auth/verify`（既存修正）

メール認証時にゲストなら正規ユーザーに昇格:

```typescript
if (user.role === 'guest') {
  updateData.role = 'user';
  updateData.expiresAt = null;
}
```

---

## 認証フロー（EditorPage）

```
EditorPage マウント
  │
  ├─ 1. URL に ?code= あり → POST /api/auth/exchange（既存の認可コード交換）
  │
  ├─ 2. localStorage に authToken あり → 通常ユーザーフロー（既存）
  │
  ├─ 3. localStorage に guestToken あり → POST /api/auth/guest/restore
  │     ├─ 成功 → isGuest=true、トークン更新、エディタ表示
  │     └─ 失敗 → guestToken クリア → 4 へ
  │
  └─ 4. トークンなし
        ├─ モバイル → GuestLanding 表示
        └─ デスクトップ → ログインリダイレクト（既存）
```

---

## ゲスト制限の実装

### サーバーサイド

| 制限 | 実装箇所 | レスポンス |
|------|---------|-----------|
| ゲスト期限切れ | `auth.ts` ミドルウェア | `401 { code: "GUEST_EXPIRED" }` |
| プロジェクト3件上限 | `projects.ts` POST / | `403 { code: "GUEST_PROJECT_LIMIT" }` |
| ファイルアップロード禁止 | `assets.ts` upload / upload-frameset | `403 { code: "GUEST_UPLOAD_DENIED" }` |

- `use-official`（公式アセット利用）と `import-from-library`（マイアセット利用）は許可

### クライアントサイド

- GuestUpgradeBanner: 残り時間をリアルタイム表示（○時間○分）
- モバイルFABメニュー: 既存のモバイル制限がそのまま適用（テキスト/キャラ/背景のみ）

---

## 期限切れゲスト自動削除

`auth.ts` のモジュール読み込み時に `setInterval` で1時間ごとに実行:

```typescript
prisma.user.deleteMany({
  where: { role: 'guest', expiresAt: { lt: BigInt(Date.now()) } }
});
```

User → Project は `onDelete: Cascade` 設定済みのため、User 削除で Project も自動削除される。

---

## localStorage キー

| キー | 管理関数 | 用途 |
|------|---------|------|
| `authToken` | `getAuthToken()` / `setAuthToken()` | 正規ユーザーの JWT |
| `guestToken` | `getGuestToken()` / `setGuestToken()` | ゲストの JWT |
| `currentUserId` | — | 現在のユーザー ID |
| `userRole` | — | ユーザーロール（`"guest"` / `"user"`） |

`getAuthToken()` は `authToken || guestToken` をフォールバックするため、`authFetch()` はゲスト・正規ユーザーの両方で動作する。

---

## UI コンポーネント

### GuestLanding（`src/components/GuestLanding.tsx`）

モバイル限定のゲスト開始画面。

- 「ログインせずに始める」ボタン → `POST /api/auth/guest` → トークン保存 → エディタ遷移
- ローディング状態とエラー表示

### GuestUpgradeBanner（`src/components/GuestUpgradeBanner.tsx`）

エディタ上部のバナー（デスクトップ・モバイル共通）。

- 残り時間表示（「ゲストモード — 残り ○時間○分」）
- 「アカウント登録」ボタン → 展開フォーム（username / email / password）
- 成功時はグリーンバナーに切り替え（「確認メールを送信しました」）

---

## 型チェック結果

- `apps/hono`: `npx tsc --noEmit` — エラー 0
- `apps/editor`: `npx tsc --noEmit` — エラー 0

---

## 検証手順

1. マイグレーション確認: `npx prisma migrate status` で `add_guest_expires_at` が Applied
2. モバイル幅（DevTools）でエディタ URL `/projects/editor` にアクセス → GuestLanding 表示
3. 「ログインせずに始める」→ プロジェクト自動作成 → エディタ表示
4. ブラウザ閉じて再アクセス → ゲスト復帰（トークン延長）
5. GuestUpgradeBanner の「アカウント登録」→ フォーム入力 → メール送信
6. メール内リンクで認証 → role: guest → user、expiresAt: null
7. デスクトップ幅ではゲストモードなし（ログインリダイレクト）

---

## 未実装（Phase 3）

- 期限切れ前の通知（「まもなく削除されます」）
- SNS 共有ボタン（プレビューURL）
- ゲスト制限のクライアント側 UI 反映（アップロードボタン非表示 etc.）
