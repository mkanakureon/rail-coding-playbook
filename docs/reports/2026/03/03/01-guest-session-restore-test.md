# ゲストセッション復帰テスト — 実装レポート

**日付**: 2026-03-03
**ステータス**: ローカル・Azure 両環境で全テスト合格

## 概要

ゲストログイン後にブラウザを閉じ、再度同じプロジェクトURLを開いた時にセッションが復帰できるかを検証するE2Eテストを作成した。

## 対象機能の仕組み

### フロー

```
初回: Next.js → POST /api/auth/guest → token + projectId → エディタにURL param付きリダイレクト
保存: URL paramからtoken取得 → localStorage.setItem('guestToken', token) → URL param除去
復帰: localStorage.getItem('guestToken') → POST /api/auth/guest/restore → 新token → セッション復帰
```

### 関連コード

| ファイル | 役割 |
|---------|------|
| `apps/editor/src/pages/EditorPage.tsx` (L154-226) | ゲスト認証フロー（URL param処理 → localStorage保存 → restore呼び出し） |
| `apps/hono/src/routes/auth.ts` (L641-703) | `POST /api/auth/guest/restore` — トークン検証・期限延長・新トークン発行 |
| `apps/editor/src/config/api.ts` | `getGuestToken()`, `setGuestToken()`, `clearGuestToken()` |
| `apps/editor/src/components/GuestLanding.tsx` | 未認証時のランディングUI（「ログインせずに始める」ボタン） |

## テスト内容

**ファイル**: `tests/guest-session-restore.spec.ts`

### Test 1: ブラウザ再起動後のセッション復帰

1. `POST /api/auth/guest` でゲストアカウント作成（token + projectId取得）
2. URLパラメータ付きでエディタにアクセス → ブロック表示・localStorage確認
3. ブラウザコンテキストを閉じる（ブラウザ終了シミュレーション）
4. 新しいブラウザコンテキストを作成し、同じ `localStorage` 値（guestToken, currentUserId, userRole）を注入
5. URLパラメータなしでエディタURLを開く
6. `POST /api/auth/guest/restore` が200で成功することを確認
7. エディタが正常にロードされ、ブロックが表示されることを確認
8. GuestLanding が表示されないことを確認

### Test 2: 無効トークンの処理

1. 改ざんした guestToken（`invalid-tampered-token-xxx`）をlocalStorageに注入
2. エディタURLを開く
3. `guest/restore` が 401 を返すことを確認
4. GuestLanding（「ログインせずに始める」）が表示されることを確認
5. `guestToken` がlocalStorageからクリアされていることを確認

## 実行方法

```bash
# サーバー起動
./scripts/dev-start.sh api editor

# テスト実行
npx playwright test tests/guest-session-restore.spec.ts --config tests/playwright.config.ts --headed

# ヘッドレス実行
npx playwright test tests/guest-session-restore.spec.ts --config tests/playwright.config.ts
```

## テスト設計の判断

- **API直接呼び出し**: ゲスト作成はUI操作ではなくAPI直接呼び出しで行う（Next.jsサーバー不要）
- **localStorage注入**: `page.evaluate()` でlocalStorageを操作し、ブラウザ再起動をシミュレート
- **レスポンス監視**: `page.waitForResponse()` で `guest/restore` API の呼び出しと結果を検証
- **既存パターン踏襲**: `guest-direct-url.spec.ts` / `guest-verify.spec.ts` と同じ構造（API/EDITOR定数、browser.newContext、block-card確認）

## 実行結果

### ローカル (localhost:8080 / localhost:5176)

```
  ✓ ブラウザ再起動後にguestTokenでセッションが復帰する — blocks=4 → restore → blocks=4
  ✓ 無効なguestTokenではGuestLandingが表示される — 401, landing displayed, token cleared
  2 passed (13.0s)
```

### Azure (ca-api / ca-editor)

```
  ✓ ブラウザ再起動後にguestTokenでセッションが復帰する — blocks=4 → restore → blocks=4
  ✓ 無効なguestTokenではGuestLandingが表示される — 401, landing displayed, token cleared
  2 passed (19.4s)
```

### Azure向け実行コマンド

```bash
TEST_API_URL=https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io \
TEST_EDITOR_URL=https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io \
npx playwright test tests/guest-session-restore.spec.ts --config tests/playwright.config.ts
```
