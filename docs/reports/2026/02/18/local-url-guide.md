# ローカル開発環境 URL 説明書

- **日時**: 2026-02-18
- **環境**: ローカル開発 (localhost)

---

## サービス一覧

| サービス | 役割 | URL | ポート |
|---------|------|-----|--------|
| **Next.js** | フロントエンド（認証・プロジェクト管理） | http://localhost:3000 | 3000 |
| **API (Hono)** | バックエンド API | http://localhost:8080 | 8080 |
| **Editor** | ビジュアルノベルエディタ | http://localhost:5176 | 5176 |
| **Preview** | 作品プレビュー（PixiJS） | http://localhost:5175 | 5175 |

### 起動コマンド

```bash
# リポジトリルートから全サーバー起動
npm run dev

# 個別起動
cd apps/next && npm run dev      # Next.js  :3000
cd apps/hono && npm run dev      # Hono API :8080
cd apps/editor && npm run dev    # Editor   :5176
cd packages/web && npm run dev   # Preview  :5175
```

---

## ユーザー操作フロー

### 1. トップページ
http://localhost:3000

- 「ログイン」ボタン → ログインページへ
- 「無料で始める」ボタン → 新規登録ページへ

### 2. 新規登録
http://localhost:3000/register

- ユーザー名・メール・パスワードを入力して登録
- 登録成功 → ログインページへリダイレクト

### 3. ログイン
http://localhost:3000/login

- メール・パスワードでログイン
- ログイン成功 → マイページへリダイレクト

### 4. マイページ
http://localhost:3000/mypage

- プロジェクト一覧のサマリ表示
- メッセージカード（未読件数表示）
- 「すべて見る →」→ プロジェクト一覧
- 「作品を見る」→ 作品一覧
- 「作品を作る」→ プロジェクト一覧
- 「ログアウト」→ ログインページへ

### 5. メッセージ（受信ボックス）
http://localhost:3000/mypage/messages

- 運営からのメッセージ一覧
- 未読メッセージは青背景で表示
- クリック → メッセージ詳細（自動既読）

### 6. メッセージ詳細
http://localhost:3000/mypage/messages/{messageId}

- メッセージの件名・本文・日時を表示

### 7. プロジェクト一覧
http://localhost:3000/projects

- 作成済みプロジェクトの一覧
- 「新規作成」ボタン → 作成ダイアログ → プロジェクト詳細へ
- カードクリック → プロジェクト詳細へ

### 8. プロジェクト詳細
http://localhost:3000/projects/{projectId}

- 3つのアクションボタン:
  - **エディタで開く** → Editor アプリへ遷移
  - **プレビュー** → Preview アプリへ遷移
  - **公開する** → 公開ダイアログ
- 「← プロジェクト一覧に戻る」→ プロジェクト一覧

### 9. エディタ
http://localhost:5176/projects/editor/{projectId}

- ビジュアルノベルのブロックエディタ
- 背景画像・テキスト・選択肢などのブロックを編集
- アセット（画像）のアップロード
- 未認証の場合はログインページへリダイレクト

### 10. プレビュー
http://localhost:5175/ksc-demo.html?work={projectId}

- PixiJS (WebGL) による作品プレビュー
- 背景画像・キャラクター・テキスト表示
- API からプロジェクトデータを取得して KSC スクリプトを実行

### 11. 作品公開
プロジェクト詳細ページの「公開する」ボタンから

- タイトル・説明を入力して公開
- 公開後 → 作品一覧ページへ遷移

### 12. 作品一覧（公開済み）
http://localhost:3000/works

- 全ユーザーの公開作品一覧（認証不要）
- カードクリック → 作品プレイページへ

### 13. 作品プレイ
http://localhost:3000/play/{workId}

- 公開された作品をプレイ

---

## 管理画面

### アクセス方法

管理者ユーザーのみアクセス可能。ヘッダーに「管理画面」リンクが表示される。

```sql
-- 管理者に昇格（psql で実行）
UPDATE users SET role='admin' WHERE email='your@email.com';
```

### 管理画面ページ一覧

| ページ | URL | 状態 |
|--------|-----|------|
| ダッシュボード | http://localhost:3000/admin | 実装済み |
| ユーザー管理 | http://localhost:3000/admin/users | 実装済み |
| ユーザー詳細 | http://localhost:3000/admin/users/{userId} | 実装済み |
| アセット審査 | http://localhost:3000/admin/assets | 実装済み |
| メッセージ管理 | http://localhost:3000/admin/messages | 実装済み |
| 作品管理 | http://localhost:3000/admin/works | 準備中 |
| レポート | http://localhost:3000/admin/reports | 準備中 |
| お知らせ管理 | http://localhost:3000/admin/announcements | 準備中 |
| 通報管理 | http://localhost:3000/admin/reports-abuse | 準備中 |
| 監査ログ | http://localhost:3000/admin/audit-log | 準備中 |
| ストレージ管理 | http://localhost:3000/admin/storage | 準備中 |
| 管理設定 | http://localhost:3000/admin/settings | 準備中 |

---

## API エンドポイント

ベース URL: `http://localhost:8080`

### ヘルスチェック
```
GET http://localhost:8080/api/health
```
→ `{ "status": "ok" }` が返れば正常

### 認証
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /api/auth/register | 新規登録 |
| POST | /api/auth/login | ログイン（レスポンスに `role` 含む） |
| POST | /api/auth/logout | ログアウト |
| GET | /api/auth/me | 現在のユーザー情報（`role` 含む） |

### プロジェクト（要認証）
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | /api/projects | プロジェクト一覧 |
| POST | /api/projects | 新規作成 |
| GET | /api/projects/:id | 詳細取得 |
| PUT | /api/projects/:id | 更新 |
| DELETE | /api/projects/:id | 削除 |

### アセット（要認証）
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /api/assets/:projectId/upload | 画像アップロード（multipart/form-data） |

### 作品
| メソッド | エンドポイント | 認証 | 説明 |
|---------|---------------|------|------|
| GET | /api/works | 不要 | 公開作品一覧 |
| GET | /api/works/:id | 不要 | 作品詳細 |
| POST | /api/works/:projectId/publish | 要 | 作品公開 |
| PUT | /api/works/:id | 要 | 作品更新 |
| DELETE | /api/works/:id | 要 | 作品削除 |

### プレビュー
| メソッド | エンドポイント | 認証 | 説明 |
|---------|---------------|------|------|
| GET | /api/preview/:id | 不要 | KSC スクリプト + アセット情報取得 |

### 管理 API（要認証 + 管理者権限）
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | /api/admin/stats | ダッシュボード統計（ユーザー数・PJ数・作品数） |
| GET | /api/admin/users | ユーザー一覧（?page=&limit=&search=&status=） |
| GET | /api/admin/users/:id | ユーザー詳細 |
| PUT | /api/admin/users/:id/status | ユーザー停止/復帰（`{ status: "active" | "suspended" }`） |
| GET | /api/admin/assets | アセット一覧（?page=&limit=） |
| DELETE | /api/admin/assets/:id | アセット削除 |
| POST | /api/admin/messages | メッセージ送信（`{ toUserId, subject, body }`） |
| GET | /api/admin/messages | 送信済みメッセージ一覧 |

### ユーザーメッセージ API（要認証）
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | /api/messages | 受信メッセージ一覧 |
| GET | /api/messages/unread | 未読件数 |
| GET | /api/messages/:id | メッセージ詳細（自動既読） |
| PUT | /api/messages/:id/read | 既読マーク |

---

## 手動確認手順

### 基本動作確認（5分）

1. **トップページ** http://localhost:3000 を開く → ページが表示される
2. **「無料で始める」** をクリック → 登録ページへ
3. ユーザー名・メール・パスワードを入力して **登録**
4. ログインページで **ログイン**
5. **マイページ** が表示される

### プロジェクト作成〜プレビュー（10分）

6. 「作品を作る」→ **プロジェクト一覧**
7. 「新規作成」→ タイトル入力 → **プロジェクト作成**
8. プロジェクト詳細 → **「エディタで開く」**
9. エディタで **背景画像をアップロード**
10. **テキストブロックを追加**
11. **保存**
12. プロジェクト詳細に戻る → **「プレビュー」**
13. プレビューで **背景画像が表示される** ことを確認（最重要）

### 作品公開〜プレイ（5分）

14. プロジェクト詳細 → **「公開する」**
15. タイトル入力 → **公開**
16. **作品一覧** に表示される
17. カードクリック → **プレイページ** で動作確認

### 管理画面確認（5分）

18. DB で `role='admin'` に設定
19. 再ログイン → ヘッダーに **「管理画面」** リンクが表示される
20. http://localhost:3000/admin → **ダッシュボード**（統計カード）
21. **ユーザー管理** → ユーザー一覧・検索・停止/復帰
22. **アセット審査** → アセットグリッド表示
23. **メッセージ** → ユーザーへメッセージ送信
24. 一般ユーザーでログイン → **マイページ** にメッセージカード表示

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| ページが表示されない | サーバー未起動 | `npm run dev` で起動 |
| API エラー (CORS) | ポート番号が不一致 | Hono の CORS 設定（3000, 5173, 5175, 5176）を確認 |
| ログインできない | API 接続先が違う | `NEXT_PUBLIC_API_URL` 環境変数を確認（空 or http://localhost:8080） |
| エディタで401エラー | トークン未受渡し | Editor の認証フローを確認 |
| プレビューで Loading のまま | API URL が違う / アセット未保存 | `VITE_API_URL` と project data を確認 |
| 画像が表示されない | アセットパスが相対 | API URL がプレフィックスされているか確認 |
| 公開時 [object Object] | Zod バリデーションエラー | thumbnail 空文字の除外を確認 |
| 管理画面にアクセスできない | role が user のまま | DB で `UPDATE users SET role='admin' WHERE email='...'` |
| 停止ユーザーがログインできる | ブラウザに古いトークン残存 | localStorage をクリアして再ログイン |
| メッセージバッジが出ない | 未ログイン or API エラー | ログイン状態と /api/messages/unread を確認 |

---

## 環境変数

### apps/hono/.env
```
DATABASE_URL="postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev"
JWT_SECRET="your-secret"
PORT=8080
```

### apps/next/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### apps/editor/.env
```
VITE_API_URL=http://localhost:8080
```

### packages/web/.env
```
VITE_API_URL=http://localhost:8080
```
