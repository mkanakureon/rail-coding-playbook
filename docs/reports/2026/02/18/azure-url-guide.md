# Azure Container Apps URL 説明書

- **日時**: 2026-02-18
- **環境**: Azure Container Apps (Japan East)
- **リソースグループ**: rg-next-aca-min

---

## サービス一覧

| サービス | 役割 | URL |
|---------|------|-----|
| **Next.js** | フロントエンド（認証・プロジェクト管理） | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| **API (Hono)** | バックエンド API | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| **Editor** | ビジュアルノベルエディタ | https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| **Preview** | 作品プレビュー（PixiJS） | https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io |

---

## ユーザー操作フロー

### 1. トップページ
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io

- 「ログイン」ボタン → ログインページへ
- 「無料で始める」ボタン → 新規登録ページへ

### 2. 新規登録
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/register

- ユーザー名・メール・パスワードを入力して登録
- 登録成功 → ログインページへリダイレクト

### 3. ログイン
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/login

- メール・パスワードでログイン
- ログイン成功 → マイページへリダイレクト

### 4. マイページ
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/mypage

- プロジェクト一覧のサマリ表示
- 「すべて見る →」→ プロジェクト一覧
- 「作品を見る」→ 作品一覧
- 「作品を作る」→ プロジェクト一覧
- 「ログアウト」→ ログインページへ

### 5. プロジェクト一覧
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/projects

- 作成済みプロジェクトの一覧
- 「新規作成」ボタン → 作成ダイアログ → プロジェクト詳細へ
- カードクリック → プロジェクト詳細へ

### 6. プロジェクト詳細
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/projects/{projectId}

- 3つのアクションボタン:
  - **エディタで開く** → Editor アプリへ遷移
  - **プレビュー** → Preview アプリへ遷移
  - **公開する** → 公開ダイアログ
- 「← プロジェクト一覧に戻る」→ プロジェクト一覧

### 7. エディタ
https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io/projects/editor/{projectId}

- ビジュアルノベルのブロックエディタ
- 背景画像・テキスト・選択肢などのブロックを編集
- アセット（画像）のアップロード
- 未認証の場合はログインページへリダイレクト

### 8. プレビュー
https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io/ksc-demo.html?work={projectId}

- PixiJS (WebGL) による作品プレビュー
- 背景画像・キャラクター・テキスト表示
- API からプロジェクトデータを取得して KSC スクリプトを実行

### 9. 作品公開
プロジェクト詳細ページの「公開する」ボタンから

- タイトル・説明を入力して公開
- 公開後 → 作品一覧ページへ遷移

### 10. 作品一覧（公開済み）
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/works

- 全ユーザーの公開作品一覧（認証不要）
- カードクリック → 作品プレイページへ

### 11. 作品プレイ
https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/play/{workId}

- 公開された作品をプレイ

---

## API エンドポイント

### ヘルスチェック
```
GET https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health
```
→ `{ "status": "ok" }` が返れば正常

### 認証
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /api/auth/register | 新規登録 |
| POST | /api/auth/login | ログイン |
| POST | /api/auth/logout | ログアウト |
| GET | /api/auth/me | 現在のユーザー情報 |

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

---

## 手動確認手順

### 基本動作確認（5分）

1. **トップページ** を開く → ページが表示される
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

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| ページが表示されない | Container App が停止中 | Azure Portal でリビジョン状態を確認 |
| API エラー (CORS) | オリジン未許可 | Hono の CORS 設定を確認 |
| ログインできない | API 接続先が違う | `NEXT_PUBLIC_API_URL` 環境変数を確認 |
| エディタで401エラー | トークン未受渡し | Editor の認証フローを確認 |
| プレビューで Loading のまま | API URL が違う / アセット未保存 | `VITE_API_URL` と project data を確認 |
| 画像が表示されない | アセットパスが相対 | API URL がプレフィックスされているか確認 |
| 公開時 [object Object] | Zod バリデーションエラー | thumbnail 空文字の除外を確認 |
