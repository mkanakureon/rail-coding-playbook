# Azure E2E テスト結果報告書

- **日時**: 2026-02-18 10:06 JST (最終実行)
- **テストファイル**: `tests/azure-full-flow.spec.ts`
- **実行コマンド**: `npx playwright test tests/azure-full-flow.spec.ts --reporter=list`
- **所要時間**: 1m18s
- **ブラウザ**: Chromium

## サマリ

| 項目 | 数 |
|------|---|
| 合計テスト数 | 41 |
| **PASS** | **41** |
| FAIL | 0 |
| 未実行 | 0 |

## テスト結果一覧

### Phase 1: 全サービス稼働確認 (4/4 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 01 | API /api/health が status:ok を返す | PASS | 646ms |
| 02 | Next.js が 200 を返す | PASS | 547ms |
| 03 | Editor が 200 を返す | PASS | 1.1s |
| 04 | Preview が 200 を返す | PASS | 801ms |

### Phase 2: トップページ リンク遷移 (2/2 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 05 | トップ → nav「ログイン」→ /login | PASS | 791ms |
| 06 | トップ → 「無料で始める」→ /register | PASS | 786ms |

### Phase 3: 認証フロー (2/2 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 07 | 登録フォーム → 送信 → /login | PASS | 8.9s |
| 08 | ログインフォーム → 送信 → /mypage | PASS | 1.6s |

### Phase 4: 認証済みページ (6/6 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 09 | マイページ →「プロジェクト一覧」→ /projects | PASS | 1.6s |
| 10 | プロジェクト一覧 →「新規作成」→ ダイアログ → 作成 | PASS | 1.8s |
| 11 | プロジェクト詳細に3つのアクションボタン | PASS | 1.7s |
| 12 | エディタリンクが Azure URL を指す | PASS | 1.3s |
| 13 | 「← プロジェクト一覧に戻る」→ /projects | PASS | 1.9s |
| 14 | プロジェクトカードクリック → 詳細 | PASS | 2.1s |

### Phase 5: エディタ (3/3 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 15 | 未認証 → /login リダイレクト | PASS | 1.7s |
| 16 | 認証付き → エディタ表示 | PASS | 6.7s |
| 17 | SPA ルーティング | PASS | 1.8s |

### Phase 5.5: エディタ API — アセットアップロード + プロジェクトデータ保存 (4/4 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 17.1 | API で背景画像アップロード → アセット情報が返る | PASS | 332ms |
| 17.2 | アップロード画像が API 経由で取得できる | PASS | 76ms |
| 17.3 | プロジェクトデータに bg + text ブロック保存 | PASS | 74ms |
| 17.4 | Preview API が正しい KSC スクリプトとアセット返却 | PASS | 97ms |

### Phase 6: Preview 基本 (2/2 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 18 | Preview トップ 200 | PASS | 1.2s |
| 19 | SPA ルーティング | PASS | 337ms |

### Phase 6.5: Preview 画像表示テスト (5/5 PASS) ★最重要

| # | テスト名 | 結果 | 所要時間 | 検証内容 |
|---|---------|------|---------|---------|
| 19.1 | Preview で PixiJS canvas 表示 | PASS | 1.1s | canvas 要素が表示される |
| 19.2 | 背景画像レンダリング確認 | PASS | 4.5s | Loading 画面でない、Error なし |
| 19.3 | canvas にピクセル描画確認 | PASS | 7.2s | WebGL readPixels で背景色以外を検出 |
| 19.4 | コンソールにアセットエラーなし | PASS | 5.9s | Failed to load 等のエラーが0件 |
| 19.5 | Editor でブロック一覧表示 | PASS | 4.0s | /login リダイレクトなし |

### Phase 7: 作品公開 → 一覧 → プレイ (3/3 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 20 | 作品を公開 → /works | PASS | 2.0s |
| 21 | 作品一覧に公開作品が表示 | PASS | 980ms |
| 22 | 作品クリック → /play/[id] | PASS | 976ms |

### Phase 8: マイページ リンク確認 (5/5 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 23 | 「すべて見る →」→ /projects | PASS | 1.5s |
| 24 | 「作品を見る」→ /works | PASS | 1.2s |
| 25 | 「作品を作る」→ /projects | PASS | 1.5s |
| 26 | プロジェクトカード → /projects/[id] | PASS | 1.9s |
| 27 | ログアウト → /login | PASS | 1.5s |

### Phase 9: 未認証リダイレクト (2/2 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 28 | /mypage → /login | PASS | 686ms |
| 29 | /projects → /login | PASS | 738ms |

### Phase 10: CORS (2/2 PASS)

| # | テスト名 | 結果 | 所要時間 |
|---|---------|------|---------|
| 30 | Editor オリジン CORS | PASS | 53ms |
| 31 | Next.js オリジン CORS | PASS | 53ms |

### Phase 11: レスポンス速度 (1/1 PASS)

| # | テスト名 | 結果 | 応答時間 |
|---|---------|------|---------|
| 32 | 全サービス 5 秒以内 | PASS | API:188ms, Next:359ms, Editor:711ms, Preview:372ms |

## 修正したバグ

### BUG-1: publishWork API の URL ミスマッチ (修正済み)

- **原因**: クライアントが `POST /api/projects/{id}/publish` を呼んでいたが、サーバーは `POST /api/works/{id}/publish`
- **修正**: `apps/next/lib/api.ts` — URL を `/api/works/` に修正
- **コメント修正**: `apps/hono/src/routes/works.ts` — コメントを実態に合わせて修正

### BUG-2: 空文字 thumbnail の Zod バリデーションエラー (修正済み)

- **原因**: 公開ダイアログで thumbnail フィールドが空文字 `""` のまま送信 → Zod `.url()` バリデーション失敗 → エラーオブジェクトが `[object Object]` として表示
- **修正 (サーバー)**: `apps/hono/src/routes/works.ts` — `z.string().url().optional().or(z.literal(''))`
- **修正 (クライアント)**: `apps/next/lib/api.ts` — 空文字フィールド除外 + エラーオブジェクトの文字列化

### BUG-3 (テスト不備): テスト用 PNG が不正 (修正済み)

- **原因**: 手動生成した PNG バイナリが破損しており PixiJS がデコード不可
- **修正**: Python zlib で有効な 100x100 赤色 PNG を生成

## デプロイ履歴

| 時刻 (UTC) | 対象 | ACR Run ID | 修正内容 |
|-----------|------|-----------|---------|
| 00:27 | ca-nextjs | ce15 | publishWork URL 修正 |
| 01:03 | ca-api | ce17 | thumbnail Zod バリデーション修正 |
| 01:04 | ca-nextjs | ce16 | 空文字除外 + エラーハンドリング修正 |

## スクリーンショット一覧 (23枚)

保存先: `test-results/screenshots/`

| ファイル名 | テスト# | 内容 |
|-----------|--------|------|
| flow-05-top.png | 05 | トップページ |
| flow-05-login.png | 05 | ログインページ |
| flow-06-register.png | 06 | 新規登録ページ |
| flow-07-register-filled.png | 07 | 登録フォーム入力済み |
| flow-07-registered.png | 07 | 登録完了 |
| flow-08-mypage.png | 08 | マイページ |
| flow-09-projects.png | 09 | プロジェクト一覧 |
| flow-10-create-dialog.png | 10 | 新規作成ダイアログ |
| flow-10-project-detail.png | 10 | プロジェクト詳細 |
| flow-11-detail-buttons.png | 11 | 詳細ページボタン群 |
| flow-14-project-via-card.png | 14 | カードからの詳細遷移 |
| flow-15-editor-noauth.png | 15 | Editor 未認証リダイレクト |
| flow-16-editor-loaded.png | 16 | Editor 認証済み |
| flow-18-preview.png | 18 | Preview トップ |
| flow-19.1-preview-canvas.png | 19.1 | Preview canvas 表示 |
| flow-19.2-preview-rendered.png | 19.2 | Preview レンダリング完了 |
| flow-19.3-preview-pixels.png | 19.3 | Preview ピクセル確認 |
| flow-19.5-editor-with-blocks.png | 19.5 | Editor ブロック表示 |
| flow-20-publish-dialog.png | 20 | 公開ダイアログ |
| flow-20-works-after-publish.png | 20 | 公開完了 → 作品一覧 |
| flow-21-works-list.png | 21 | 作品一覧 |
| flow-22-play.png | 22 | プレイページ |
| flow-24-works-from-mypage.png | 24 | マイページから作品一覧 |

## テスト環境情報

| 項目 | 値 |
|------|---|
| API URL | https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Next.js URL | https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Editor URL | https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Preview URL | https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io |
| Playwright | Chromium, serial mode |
| テストファイル | tests/azure-full-flow.spec.ts (41テスト) |
