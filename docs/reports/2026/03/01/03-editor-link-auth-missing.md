# プロジェクト詳細「エディタで編集」→ ログイン画面になるバグ

**日付**: 2026-03-01
**症状**: `localhost:3000/projects/{id}` の「エディタで編集」ボタン → エディタでログイン画面（GuestLanding）が表示される

---

## 原因: 正規ユーザーのトークン受け渡しが未実装

### プロジェクト詳細ページのリンク生成（Next.js 側）

`apps/next/app/(private)/projects/[id]/page.tsx:235`:
```
/projects/editor/{id}?userId={user.id}&token={authToken}
```

`?userId=X&token=Y` を渡しているが `guest=1` はない（正規ユーザーのため）。

### エディタの認証フロー（EditorPage.tsx useEffect）

```
Step 1: ?code=X あり → exchange API でJWT取得         ← 不一致（code じゃなく token）
Step 2: ?token=X&guest=1&userId=Y → ゲストトークン保存 ← 不一致（guest=1 がない）
Step 3: localStorage.authToken あり → そのまま使う     ← 空（別オリジン）
Step 4: localStorage.guestToken あり → 復帰を試みる   ← 空
Step 5: → showGuestLanding = true                      ← ★ここに到達
```

**どのステップにも一致しない。** `?userId=X&token=Y`（guest なし）を受け取るハンドラが存在しない。

### フロー図

```
Next.js (3000)                           Editor (5176)
┌────────────────────────┐               ┌──────────────────────────┐
│ projects/[id]/page.tsx │               │ EditorPage.tsx useEffect │
│                        │               │                          │
│ href = editor/...      │               │ Step1: ?code       → NO  │
│   ?userId=X            │──────────────►│ Step2: ?token+guest→ NO  │
│   &token=Y             │               │ Step3: localStorage→ 空  │
│                        │               │ Step4: guestToken → 空   │
│ (guest=1 なし)         │               │ Step5: GuestLanding 表示 │
└────────────────────────┘               └──────────────────────────┘
```

## 修正方針

EditorPage.tsx の Step 2 の後に、正規ユーザーのトークン受け渡しハンドラを追加する。

```typescript
// Step 2.5: URLパラメータで通常トークンが渡された場合（Next.js プロジェクト詳細からの遷移）
if (tokenFromUrl && userIdFromUrl && !guestFlag) {
  window.history.replaceState({}, '', window.location.pathname);
  clearGuestToken();        // ゲストトークンがあれば消す
  setAuthToken(tokenFromUrl);
  localStorage.setItem('currentUserId', userIdFromUrl);
  localStorage.removeItem('userRole');
  setUserId(userIdFromUrl);
  return;
}
```

## 教訓

- エディタの認証フローには3パターンある（exchange code / ゲストURL / localStorage）が、**通常ユーザーの URL 遷移パターンが抜けていた**
- Next.js → Editor のクロスオリジン遷移は全て URL パラメータ経由。新しいリンクを追加する際はエディタ側の受け取りハンドラも必ずセットで実装する
