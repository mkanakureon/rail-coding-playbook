# ゲスト開始 → ログインページにリダイレクトされるバグ

**日付**: 2026-03-01
**症状**: トップページの「ログインせずに始める」→ エディタに遷移せず `localhost:3000/login?from=...` にリダイレクト

---

## 再現手順

1. ブラウザで `localhost:3000` を開く（ログアウト状態）
2. 「ログインせずに始める」をクリック
3. 期待: エディタ (5176) でプロジェクトが開く
4. 実際: `localhost:3000/login?from=http://localhost:5176/projects/editor/{id}` に遷移

## 原因

### 直接原因: エディタの localStorage に古い `authToken` が残っている

```
Next.js (3000)                     Editor (5176) localStorage
┌──────────────────┐               ┌──────────────────────────┐
│ authToken: なし   │               │ authToken: eyJ...(期限切れ) │ ← 前回ログイン時の残骸
│ → ゲストボタン表示 │               │ guestToken: なし           │
└──────┬───────────┘               └──────────────────────────┘
       │
       │ POST /api/auth/guest → 成功
       │ redirect: /projects/editor/{id}?token=X&guest=1&userId=Y
       │
       ▼
Editor useEffect (EditorPage.tsx:154-166)
  ├── URL パラメータ検出 → guestToken=X を localStorage に保存 ✓
  ├── authToken はクリアしない ← ★ここが問題
  └── return
       │
       ▼
Editor useEffect (EditorPage.tsx:236-319) — プロジェクト取得
  ├── authFetch() → getAuthToken() → authToken || guestToken
  │                                   ^^^^^^^^
  │                                   古い期限切れ authToken を返す
  ├── GET /api/projects/{id} + Bearer {古いauthToken} → 401
  │
  ├── isGuestMode() → !authToken && !!guestToken
  │                    ^^^^^^^^^
  │                    authToken が存在するので false
  │
  └── 通常ユーザー分岐 → window.location.href = login?from=...
```

### 根本原因

`EditorPage.tsx:158-166` のゲストパラメータ受け取り処理で、古い `authToken` をクリアしていない。

```typescript
// 現状 (EditorPage.tsx:158-166)
if (tokenFromUrl && guestFlag === '1' && userIdFromUrl) {
  window.history.replaceState({}, '', window.location.pathname);
  setGuestToken(tokenFromUrl);                    // guestToken は設定
  localStorage.setItem('currentUserId', userIdFromUrl);
  localStorage.setItem('userRole', 'guest');
  setUserId(userIdFromUrl);
  setIsGuest(true);
  return;
  // ← authToken をクリアしていない！
}
```

### 影響範囲

| 条件 | 発生 |
|------|------|
| 初めてエディタを使う（authToken なし） | 問題なし |
| 以前ログインしたことがある（authToken 残存） | **必ず発生** |
| authToken が有効期限内 | 古い authToken でプロジェクトにアクセス → 403（別ユーザーのため） |
| authToken が有効期限切れ | 古い authToken でアクセス → 401 |

## 修正

`EditorPage.tsx:158-166` でゲストパラメータ受け取り時に `authToken` をクリアする。

```typescript
if (tokenFromUrl && guestFlag === '1' && userIdFromUrl) {
  window.history.replaceState({}, '', window.location.pathname);
  clearAuthToken();  // ★ 追加: 古い authToken を消す
  setGuestToken(tokenFromUrl);
  localStorage.setItem('currentUserId', userIdFromUrl);
  localStorage.setItem('userRole', 'guest');
  setUserId(userIdFromUrl);
  setIsGuest(true);
  return;
}
```

## 教訓

- **オリジンごとに localStorage が独立**していることの二次被害。Next.js 側でログアウトしてもエディタ側の `authToken` は消えない
- `getAuthToken()` が `authToken || guestToken` のフォールバック構造のため、**authToken が存在する限り guestToken は使われない**
- ゲストモード遷移時は「クリーンな状態」にリセットしてからトークンを設定すべき
