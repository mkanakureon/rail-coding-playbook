# Azure E2E テスト手順書

- **作成日**: 2026-02-18
- **対象環境**: Azure Container Apps (rg-next-aca-min / japaneast)
- **テストファイル**: `tests/azure-full-flow.spec.ts`

## URL 一覧

| サービス | URL |
|---------|-----|
| API | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Next.js | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Editor | https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Preview | https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io |

## テスト実行方法

### Playwright E2E テスト（32テスト）

```bash
# 全テスト実行
npx playwright test tests/azure-full-flow.spec.ts --reporter=list

# 特定テストのみ
npx playwright test tests/azure-full-flow.spec.ts -g "01:" --reporter=list

# デバッグモード（ブラウザ表示）
npx playwright test tests/azure-full-flow.spec.ts --headed --reporter=list

# トレース付き（失敗時の詳細分析）
npx playwright test tests/azure-full-flow.spec.ts --trace on

# トレースの確認
npx playwright show-trace test-results/<trace-folder>/trace.zip
```

### curl ベーステスト

```bash
# 1. 全サービス稼働確認
curl -s https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health
curl -s -o /dev/null -w "%{http_code}" https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/
curl -s -o /dev/null -w "%{http_code}" https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io/
curl -s -o /dev/null -w "%{http_code}" https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io/

# 2. 認証フロー
TS=$(date +%s)
# 登録
curl -s -X POST https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"test${TS}\",\"email\":\"test${TS}@example.com\",\"password\":\"Password123\"}"

# ログイン（トークン取得）
LOGIN=$(curl -s -X POST https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test${TS}@example.com\",\"password\":\"Password123\"}")
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 認証確認
curl -s https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. プロジェクト CRUD
# 作成
PROJECT=$(curl -s -X POST https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Test ${TS}\"}")
PID=$(echo "$PROJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('project',{}).get('id',''))")

# 取得
curl -s https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/projects/$PID \
  -H "Authorization: Bearer $TOKEN"

# 一覧
curl -s https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/projects \
  -H "Authorization: Bearer $TOKEN"

# 4. CORS 確認
curl -s -D - -o /dev/null https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health \
  -H "Origin: https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io" | head -10

curl -s -D - -o /dev/null https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health \
  -H "Origin: https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io" | head -10

# 5. CORS プリフライト
curl -s -D - -o /dev/null -X OPTIONS \
  https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/auth/me \
  -H "Origin: https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" | head -10

# 6. SPA ルーティング
curl -s -o /dev/null -w "%{http_code}" https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io/projects/editor/any-id
curl -s -o /dev/null -w "%{http_code}" https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io/any/deep/path

# 7. レスポンス速度
echo -n "API: " && curl -s -o /dev/null -w "%{time_total}s\n" https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io/api/health
echo -n "Next.js: " && curl -s -o /dev/null -w "%{time_total}s\n" https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io/
echo -n "Editor: " && curl -s -o /dev/null -w "%{time_total}s\n" https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io/
echo -n "Preview: " && curl -s -o /dev/null -w "%{time_total}s\n" https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io/
```

## Playwright テスト一覧（41テスト）

### Phase 1: 全サービス稼働確認 (4テスト)

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 01 | API /api/health が status:ok を返す | API 200 + `"status":"ok"` |
| 02 | Next.js が 200 を返す | Next.js トップ 200 |
| 03 | Editor が 200 を返す | Editor トップ 200 |
| 04 | Preview が 200 を返す | Preview トップ 200 |

### Phase 2: トップページ リンク遷移 (2テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 05 | トップ → nav「ログイン」→ /login | nav 内の `a[href="/login"]` をクリック | h1 に「ログイン」 |
| 06 | トップ → 「無料で始める」→ /register | `a:has-text("無料で始める")` をクリック | h1 に「新規登録」 |

### Phase 3: 認証フロー (2テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 07 | 登録フォーム → 送信 → /login | username/email/password 入力 → submit | /login にリダイレクト |
| 08 | ログインフォーム → 送信 → /mypage | email/password 入力 → submit | /mypage + localStorage に authToken + currentUserId |

### Phase 4: 認証済みページ (6テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 09 | マイページ →「プロジェクト一覧」→ /projects | `a:has-text("プロジェクト一覧")` クリック | h1 に「プロジェクト一覧」 |
| 10 | プロジェクト一覧 →「新規作成」→ ダイアログ → 作成 | 「+ 新規作成」→ タイトル入力 → 作成ボタン | /projects/[id] にリダイレクト |
| 11 | プロジェクト詳細に3つのアクションボタン | 詳細ページ表示 | 「エディタで編集」「プレビュー」「作品を公開」が全て表示 |
| 12 | エディタリンクが Azure URL を指す | エディタリンクの href 確認 | `ca-editor.icymeadow` を含む、`localhost` を含まない |
| 13 | 「← プロジェクト一覧に戻る」→ /projects | `a[href="/projects"]` クリック | h1 に「プロジェクト一覧」 |
| 14 | プロジェクトカードクリック → 詳細 | `a[href="/projects/{id}"]` クリック | h1 にプロジェクト名 |

### Phase 5: エディタ (3テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 15 | 未認証 → /login リダイレクト | Editor に直アクセス（トークンなし） | /login にリダイレクト + from パラメータ |
| 16 | 認証付き → エディタ表示 | `?token=xxx&userId=xxx` 付きでアクセス | /login にリダイレクトされない |
| 17 | SPA ルーティング | 任意パスにアクセス | 200 を返す |

### Phase 5.5: エディタ API — アセットアップロード + データ保存 (4テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 17.1 | 背景画像アップロード | `POST /api/assets/:id/upload` (multipart) | 201 + asset.id/kind/url |
| 17.2 | アップロード画像取得 | `GET /uploads/bg/{id}.png` | 200 + content-type: image |
| 17.3 | プロジェクトデータ保存 | `PUT /api/projects/:id` (bg + text ブロック) | 200 |
| 17.4 | Preview API 確認 | `GET /api/preview/:id` | script に `@bg` + assets 配列 |

### Phase 6: Preview 基本 (2テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 18 | Preview トップ | トップページアクセス | 200 |
| 19 | SPA ルーティング | ディープパスにアクセス | 200 |

### Phase 6.5: Preview 画像表示テスト (5テスト) ★最重要

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 19.1 | PixiJS canvas 表示 | `ksc-demo.html?work={id}` を開く | canvas 要素が visible |
| 19.2 | 背景レンダリング確認 | canvas 表示後3秒待機 | Loading/Error テキストなし |
| 19.3 | ピクセル描画確認 | WebGL readPixels で分析 | 背景色 (0x1a1a2e) 以外 > 50px |
| 19.4 | アセットエラーなし | console エラー監視 | "Failed to load" 等が 0 件 |
| 19.5 | Editor ブロック表示 | 認証付きでエディタ表示 | /login リダイレクトなし |

### Phase 7: 作品公開 → 一覧 → プレイ (3テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 20 | 「作品を公開」→ ダイアログ → 公開 → /works | 公開ボタン → ダイアログ入力 → 公開する | /works にリダイレクト |
| 21 | 作品一覧に公開作品が表示 | /works にアクセス | 作品名が表示 |
| 22 | 作品クリック → /play/[id] | 作品名クリック | /play/[id] に遷移 |

### Phase 8: マイページ リンク確認 (5テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 23 | 「すべて見る →」→ /projects | リンククリック | /projects に遷移 |
| 24 | 「作品を見る」カード → /works | カードクリック | /works に遷移 |
| 25 | 「作品を作る」カード → /projects | カードクリック | /projects に遷移 |
| 26 | プロジェクトカード → /projects/[id] | カードクリック | 詳細ページ表示 |
| 27 | 「ログアウト」→ /login | ボタンクリック | /login にリダイレクト |

### Phase 9: 未認証リダイレクト (2テスト)

| # | テスト名 | 操作 | 検証 |
|---|---------|------|------|
| 28 | /mypage → /login | 未認証で /mypage アクセス | /login にリダイレクト |
| 29 | /projects → /login | 未認証で /projects アクセス | /login にリダイレクト |

### Phase 10: CORS (2テスト)

| # | テスト名 | 検証 |
|---|---------|------|
| 30 | Editor オリジン CORS | `access-control-allow-origin` が Editor URL |
| 31 | Next.js オリジン CORS | `access-control-allow-origin` が Next.js URL |

### Phase 11: レスポンス速度 (1テスト)

| # | テスト名 | 検証 |
|---|---------|------|
| 32 | 全サービス 5 秒以内 | API, Next.js, Editor, Preview の応答時間 < 5000ms |

## テスト結果（2026-02-18 09:18 JST 実行）

### Playwright 結果: 19 passed / 1 failed / 12 skipped (serial のため)

| テスト | 結果 | 所要時間 |
|-------|------|---------|
| 01-04: サービス稼働 | PASS | 0.6-1.0s |
| 05-06: トップページ遷移 | PASS | 0.7s |
| 07: 登録 | PASS | 4.3s |
| 08: ログイン | PASS | 1.5s |
| 09: マイページ→プロジェクト | PASS | 1.5s |
| 10: プロジェクト作成 | PASS | 1.7s |
| 11: 詳細ボタン確認 | PASS | 1.8s |
| 12: エディタリンク Azure URL | PASS | 1.3s |
| 13: 戻るリンク | PASS | 1.9s |
| 14: プロジェクトカード遷移 | PASS | 2.1s |
| 15: Editor 未認証リダイレクト | PASS | 1.4s |
| 16: Editor 認証アクセス | PASS | 6.2s |
| 17: Editor SPA | PASS | 1.4s |
| 18-19: Preview | PASS | 0.3-0.8s |
| **20: 作品公開** | **FAIL** | 17.1s |
| 21-32 | 未実行 (serial) | - |

### curl テスト結果: 20/20 PASS

全項目パス（API レベルでは問題なし）。

## 発見されたバグ

### BUG-1: 作品公開 API で Not Found エラー

- **テスト**: #20「作品を公開」
- **症状**: 公開ダイアログで「公開する」ボタンを押すと、バックグラウンドに `Not Found` エラーが表示され、/works へのリダイレクトが行われない
- **スクリーンショット**: `test-results/` 内の失敗時スクリーンショット参照
- **観察**:
  - ダイアログは正常に表示される
  - タイトル・説明の入力も正常
  - 「公開する」ボタンクリック後に API からエラー
  - ナビバーが未認証状態に戻っている（セッション切れの可能性）
- **影響**: テスト 21-27 も連鎖的に未実行
- **調査対象**: `publishWork` API (`POST /api/works` or similar)、認証トークンの保持

## テスト原則

- **スキップ禁止**: 全テストは `expect` で厳密に検証する
- **フォールバック禁止**: localhost フォールバックや `if` で迂回しない
- **失敗 = バグ**: テストを通すためにテストを変えない。コードを直す
- **スクリーンショット**: 各ステップで `test-results/flow-*.png` に保存

## デプロイ後の再テスト手順

```bash
# 1. イメージ再ビルド（ACR 上、amd64）
az acr build --registry acrnextacamin --image <name>:latest \
  --platform linux/amd64 <app-dir>

# 2. Container App 更新（新リビジョン強制）
TIMESTAMP=$(date +%Y%m%d%H%M%S)
az containerapp update --name <name> --resource-group rg-next-aca-min \
  --set-env-vars "DEPLOY_VERSION=$TIMESTAMP"

# 3. テスト実行
npx playwright test tests/azure-full-flow.spec.ts --reporter=list

# 4. 結果確認
# スクリーンショット: test-results/flow-*.png
# トレース: npx playwright show-trace test-results/<folder>/trace.zip
```
