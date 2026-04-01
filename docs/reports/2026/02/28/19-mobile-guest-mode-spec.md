# モバイル ゲストモード設計書

## 概要

スマホユーザーが **ログインなし** で作品を作成し、プレビューURLを発行できる仕組み。
ブラウザを閉じても **短期間（72時間）** は同じ作品に戻れる。

## 目的

- 新規ユーザーの参入障壁を下げる（「まず触ってみる」体験）
- スマホで気軽に短編ノベルを作って共有
- 気に入ったら72時間以内にメール認証 → 正規ユーザーに昇格（データ引き継ぎ）

## 対象

| 項目 | 値 |
|------|-----|
| 対象デバイス | モバイルのみ（`window.innerWidth < 768`） |
| 有効期間 | 72時間（最終アクセスから起算） |
| 制限 | 3プロジェクトまで、アセットアップロードなし |

---

## アーキテクチャ

### 方式: サーバーサイド Guest User + JWT

```
[スマホブラウザ]                    [API サーバー]
     │                                  │
     │  POST /api/auth/guest            │
     │ ────────────────────────────────→ │
     │                                  │  ① User レコード作成
     │                                  │     role: "guest"
     │                                  │     expiresAt: now + 72h
     │  { token, userId, projectId }    │  ② Project 自動作成
     │ ←──────────────────────────────── │  ③ JWT 発行
     │                                  │
     │  localStorage に保存              │
     │  - guestToken                    │
     │  - guestProjectId               │
     │  - guestExpiresAt               │
     │                                  │
     │  GET /api/projects/:id           │
     │  Authorization: Bearer <token>   │
     │ ────────────────────────────────→ │  通常の認証フローで処理
     │                                  │
```

### なぜ Guest User 方式か

| 方式 | メリット | デメリット |
|------|----------|------------|
| **A. localStorage のみ** | サーバー変更なし | URL発行不可、デバイス間共有不可 |
| **B. 匿名セッション（Cookie）** | 実装簡単 | 既存JWT方式と競合、CORS問題 |
| **C. Guest User + JWT（採用）** | 既存API完全互換、アカウント移行容易 | DB にゲストレコードが増える |

**方式C を採用する理由:**
1. 既存の認証ミドルウェア・プロジェクトAPIがそのまま使える
2. プレビューURL（`/api/preview/:id`）は既に公開APIなのでそのまま動く
3. アカウント移行はメール認証完了で `user.role` を `"guest"` → `"user"` に変更するだけ
4. 期限切れゲストの一括削除が容易（`WHERE role='guest' AND expiresAt < now()`）

---

## DB スキーマ変更

### User テーブル

```prisma
model User {
  // 既存フィールド...
  role       String   @default("user")    // "user" | "admin" | "guest"  ← guest 追加
  expiresAt  BigInt?                       // ← 新規: ゲスト有効期限（Unix ms）
}
```

- `role: "guest"` でゲストユーザーを識別
- `expiresAt` は guest のみ使用（通常ユーザーは null）

### 変更は最小限

- Project テーブル変更なし（既存の `userId` FK でそのまま紐づく）
- Asset テーブル変更なし（ゲストはアップロード不可なので使わない）

---

## API エンドポイント

### 1. ゲスト作成: `POST /api/auth/guest`

**認証不要。** モバイル判定はクライアント側で行う。

```typescript
// Request: なし（ボディ不要）
// Response:
{
  token: string;       // JWT（24h有効、通常と同じ）
  userId: string;
  projectId: string;   // 自動作成されたプロジェクトID
  expiresAt: number;   // ゲスト有効期限（72h後）
}
```

**サーバー処理:**
1. Guest User を作成（`role: "guest"`, ランダム username, ダミー email）
2. デフォルトプロジェクトを自動作成（タイトル: 「無題の作品」）
3. JWT を発行して返す

### 1b. 追加プロジェクト作成: `POST /api/projects`（既存API）

- ゲストは最大 **3プロジェクト** まで作成可能
- サーバー側でゲストのプロジェクト数をチェック（3件超えたら 403）
- 既存の `POST /api/projects` をそのまま使い、ミドルウェアで制限するだけ

### 2. ゲスト復帰: `POST /api/auth/guest/restore`

**認証不要。** localStorage の guestToken で復帰を試みる。

```typescript
// Request:
{ token: string }   // 保存していた guestToken

// Response (成功):
{
  token: string;       // 新しい JWT
  userId: string;
  projectId: string;
  expiresAt: number;   // 延長された期限
}

// Response (期限切れ):
{ error: "expired", status: 410 }
```

**サーバー処理:**
1. JWT を検証（署名チェック、期限は JWT 自体の exp で判定）
2. User を検索し `role === "guest"` かつ `expiresAt > now` を確認
3. `expiresAt` を最終アクセスから72h後に延長
4. 新しい JWT を返す

### 3. アカウント移行（メール認証方式）

ゲストが72時間以内にメール認証を完了すると正規ユーザーに昇格する。

#### Step 1: メール登録 `POST /api/auth/guest/upgrade`

**要認証（ゲストトークン）。**

```typescript
// Request:
{
  username: string;
  email: string;
  password: string;
}

// Response:
{
  message: "確認メールを送信しました";
}
```

**サーバー処理:**
1. email の重複チェック
2. `username`, `email`, `passwordHash` を User に保存（role は "guest" のまま）
3. `verificationToken` を生成して DB に保存
4. 確認メールを送信（リンク: `/verify?token=xxx`）

#### Step 2: メール認証 `GET /api/auth/verify?token=xxx`

**既存のメール認証エンドポイントを拡張。**

```typescript
// Response (成功):
リダイレクト → エディタ画面（正規ユーザーとして）
```

**サーバー処理:**
1. `verificationToken` で User を検索
2. `emailVerified = true` に設定
3. `role` を `"guest"` → `"user"` に変更
4. `expiresAt` を null に変更（無期限化、データ永久保存）
5. 新しい JWT を発行してリダイレクト

#### フロー図

```
ゲスト状態（72h制限）
  │
  │  ユーザーが「アカウント登録」をタップ
  │
  ├─ username / email / password を入力
  │
  │  POST /api/auth/guest/upgrade
  │  → 確認メール送信
  │
  │  ユーザーがメール内のリンクをタップ
  │
  │  GET /api/auth/verify?token=xxx
  │  → role: "guest" → "user"
  │  → expiresAt: null（永久保存）
  │
  ▼
正規ユーザー（制限なし、データ引き継ぎ）
```

#### 認証しなかった場合

- 72時間経過 → ゲストデータ（User + Project）自動削除
- 途中まで入力していた email/password もクリーンアップで消える
- 再度ゲストとして始めることは可能

---

## クライアント実装

### エディタ起動フロー（モバイル）

```
EditorPage マウント
  │
  ├─ localStorage に guestToken あり？
  │   ├─ YES → POST /api/auth/guest/restore
  │   │         ├─ 成功 → エディタ表示（既存プロジェクト）
  │   │         └─ 失敗（410）→ localStorage クリア → ゲスト作成画面へ
  │   │
  │   └─ NO → authToken あり？（正規ユーザー）
  │            ├─ YES → 通常フロー
  │            └─ NO → モバイル？
  │                     ├─ YES → ゲスト開始画面を表示
  │                     └─ NO  → ログイン画面へリダイレクト
  │
```

### ゲスト開始画面

```
┌─────────────────────────┐
│                         │
│    📱 かえでVN          │
│                         │
│  ログインなしで          │
│  作品をつくる            │
│                         │
│  ┌───────────────────┐  │
│  │   はじめる         │  │
│  └───────────────────┘  │
│                         │
│  72時間保存されます      │
│  メール認証で永久保存     │
│                         │
│  ─── または ───         │
│                         │
│  ログインする →          │
│                         │
└─────────────────────────┘
```

### localStorage 保存キー

| キー | 値 | 用途 |
|------|----|------|
| `guestToken` | JWT 文字列 | API 認証用（authToken と排他） |
| `guestProjectId` | プロジェクトID | エディタ直接遷移用 |
| `guestExpiresAt` | Unix ms | クライアント側の期限表示用 |

### URL 設計

| 画面 | URL |
|------|-----|
| ゲストエディタ | `/projects/editor/{projectId}`（通常と同じ） |
| プレビュー | `https://{domain}/ksc-demo.html?work={projectId}`（通常と同じ） |

URL は正規ユーザーと同じ。ゲスト判定はトークン内の role で行う。

---

## ゲスト制限

| 機能 | ゲスト | 正規ユーザー |
|------|--------|-------------|
| プロジェクト数 | 3 | 無制限 |
| アセットアップロード | 不可 | 可 |
| プリセット背景の使用 | 可（公式アセット） | 可 |
| キャラクター追加 | 不可 | 可 |
| テキスト・選択肢 | 可 | 可 |
| FX・フィルター | 可 | 可 |
| プレビューURL発行 | 可 | 可 |
| タイムライン | 不可 | 可 |
| バトル | 不可 | 可 |
| 作品公開（Work） | 不可 | 可 |
| データ有効期限 | 72時間（メール認証で永久化） | 無期限 |

**ゲストが使えるブロック（モバイルFABメニューと同じ）:**
- テキスト / キャラ / 背景

**制限の実装箇所:**
- クライアント: FABメニュー（既にモバイル制限済み）+ アップロードボタン非表示
- サーバー: `auth.ts` ミドルウェアでゲストの POST /api/assets を 403 で拒否
- サーバー: `projects.ts` でゲストのプロジェクト作成時に3件上限チェック

---

## クリーンアップ

### 期限切れゲストの自動削除

```typescript
// Cron ジョブ or API起動時の定期実行（1日1回）
async function cleanupExpiredGuests() {
  const now = Date.now();

  // 期限切れゲストのプロジェクトに紐づくアセットを削除
  // （ゲストはアップロード不可なので基本0件）

  // ゲストユーザーと紐づくプロジェクトを CASCADE 削除
  await prisma.user.deleteMany({
    where: {
      role: 'guest',
      expiresAt: { lt: now },
    },
  });
}
```

- User → Project は CASCADE 設定済みなので User 削除で Project も消える
- ゲストはアセットアップロード不可なのでストレージ容量の心配なし

---

## セキュリティ考慮

| リスク | 対策 |
|--------|------|
| ゲスト大量作成（DoS） | IP ベースレートリミット（10回/時間） |
| ゲストトークン窃取 | 通常 JWT と同じセキュリティレベル |
| 不適切コンテンツ | プレビューは既に公開。将来的に報告機能追加 |
| DB 肥大化 | 72h TTL + 自動削除で制御 |

---

## 実装ステップ

### Phase 1: 最小構成（MVP）

1. **Prisma schema**: User に `expiresAt` フィールド追加
2. **API**: `POST /api/auth/guest` エンドポイント追加
3. **API**: `POST /api/auth/guest/restore` エンドポイント追加
4. **API**: auth ミドルウェアにゲスト期限チェック追加
5. **Editor**: モバイル時のゲスト開始画面
6. **Editor**: guestToken による自動ログインフロー

### Phase 2: 移行 & 制限

7. **API**: `POST /api/auth/guest/upgrade` エンドポイント（メール送信）
8. **API**: 既存メール認証エンドポイントをゲスト昇格に対応
9. **API**: ゲストのアセットアップロード制限 + プロジェクト3件上限
10. **Editor**: 「メール認証で永久保存」バナー + 登録フォーム
11. **API**: 期限切れゲスト自動削除ジョブ

### Phase 3: 改善

11. 残り時間の表示（「あと48時間」）
12. 期限切れ前の通知（「まもなく削除されます」）
13. SNS 共有ボタン（プレビューURL）

---

## 工数見積もり

| フェーズ | 内容 | 想定 |
|----------|------|------|
| Phase 1 | ゲスト作成・復帰・エディタ連携 | 中 |
| Phase 2 | アカウント移行・制限・クリーンアップ | 中 |
| Phase 3 | UX 改善 | 小 |
