# ゲスト復帰優先テスト計画

**日付**: 2026-03-03
**ステータス**: ローカル全テスト合格 (5 passed, 12.2s)

## 背景

同じPCで「ログインせずに始める」を2回押すと、毎回新規ゲストアカウントが作成され、前回のデータにアクセスできなくなる問題があった。

### 変更内容

| ファイル | 変更 |
|---------|------|
| `apps/next/app/page.tsx` (GuestStartButton) | 既存 `guestToken` があれば `guest/restore` で復帰を優先。失敗時のみ新規作成 |
| `apps/next/lib/contexts/AuthContext.tsx` | ログアウト時に `guestToken` を削除しない（復帰用に残す） |

### フロー（変更後）

```
「ログインせずに始める」クリック
  ├─ guestToken あり → POST /api/auth/guest/restore
  │   ├─ 200 OK → 既存セッション復帰（同じユーザー・プロジェクト）
  │   └─ 401/エラー → guestToken クリア → 新規作成へフォールバック
  └─ guestToken なし → POST /api/auth/guest（新規作成）
```

## テストケース

### Test 1: 初回ゲストログイン（guestToken なし）

- **前提**: localStorage に guestToken がない状態
- **操作**: 「ログインせずに始める」ボタンをクリック
- **期待**: `POST /api/auth/guest` が呼ばれ、新規アカウント作成 → エディタにリダイレクト
- **検証**: `guest/restore` は呼ばれない

### Test 2: 2回目のゲストログイン → 既存セッション復帰

- **前提**: 1回目のゲストログインでguestTokenがlocalStorageに存在
- **操作**: トップページに戻り「ログインせずに始める」を再クリック
- **期待**: `POST /api/auth/guest/restore` が呼ばれ、既存ユーザーで復帰
- **検証**:
  - `guest/restore` が200を返す
  - userId が1回目と同じ
  - エディタにリダイレクトされるURLに同じprojectIdが含まれる
  - `POST /api/auth/guest`（新規作成）は呼ばれない

### Test 3: ログアウト後もguestTokenが残る

- **前提**: ゲストログイン済み
- **操作**: ログアウト実行
- **期待**: `authToken`, `currentUserId`, `userRole` は削除されるが `guestToken` は残る
- **検証**: `localStorage.getItem('guestToken')` が非null

### Test 4: ログアウト → guestToken で /api/auth/me が同じユーザーを返す

- **前提**: ゲストログイン → ログアウト済み（guestToken は残っている）
- **操作**: guestToken を使って `/api/auth/me` と `guest/restore` を呼ぶ
- **期待**: 同じ userId が返る
- **検証**: `/api/auth/me` → 200 + 同じ userId、`guest/restore` → 200 + 同じ userId

### Test 5: 期限切れトークン → 新規作成にフォールバック

- **前提**: localStorage に無効な guestToken がセットされている
- **操作**: 「ログインせずに始める」をクリック
- **期待**: `guest/restore` が401 → 古いトークンがクリアされ → `POST /api/auth/guest` で新規作成
- **検証**:
  - `guest/restore` が401を返す
  - その後 `POST /api/auth/guest` が呼ばれる
  - 新しいguestTokenがlocalStorageに保存される

## 実装

**ファイル**: `tests/guest-restore-priority.spec.ts`

## 実行方法

```bash
./scripts/dev-start.sh api next editor
npx playwright test tests/guest-restore-priority.spec.ts --config tests/playwright.config.ts --headed
```

## 実行結果

```
  ✓ Test 1: 初回ゲストログイン — 新規作成、restore は呼ばれなかった
  ✓ Test 2: 2回目 — restore 成功、同じ userId 保持、新規作成なし
  ✓ Test 3: ログアウト後も guestToken が残っている
  ✓ Test 4: /api/auth/me + guest/restore が同じゲストユーザーを返した
  ✓ Test 5: restore 401 → 新規作成フォールバック → 新しい guestToken 保存
  5 passed (12.2s)
```

## 注意事項

- ゲスト作成 API は **10回/時** のレートリミットあり（`guestLimiter`）
- テスト連続実行時に 429 が出る場合は API サーバー再起動でリセット可能（インメモリ管理のため）
- テストは 429 を受けた場合 `test.skip()` で graceful にスキップする設計
