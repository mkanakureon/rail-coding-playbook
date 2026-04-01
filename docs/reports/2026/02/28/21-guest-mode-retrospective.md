# ゲストモード実装 振り返り

**日付**: 2026-02-28
**対象**: モバイル／デスクトップ ゲストモード（ログインなし作品制作）

---

## 実装概要

ログインなしで作品制作を開始でき、72時間以内にアカウント登録すれば永久保存される仕組み。

| レイヤー | 主な変更 |
|----------|----------|
| Hono API | ゲスト作成・復帰・アップグレード API、期限チェック、レートリミット、期限切れ自動削除 |
| Editor (Vite) | ゲスト認証フロー、GuestLanding、GuestUpgradeBanner、URLパラメータ受け取り |
| Next.js | GuestStartButton、guestToken フォールバック、Header の guestToken 対応 |
| Prisma | User に `expiresAt` カラム追加 |

---

## 特に難しかったポイント

### 1. Cross-Origin の localStorage 問題（最大のハマりポイント）

**症状**: Next.js（`localhost:3000`）で「ログインせずに始める」→ エディタ（`localhost:5176`）に遷移 → **プロジェクトが空**

**原因**: `localStorage` はオリジン単位で隔離される。Next.js 側で `guestToken` を保存しても、別オリジンのエディタ側からは読めない。

**解決策**: エディタへのリダイレクト URL に `?userId=...&token=...&guest=1` パラメータを付与し、エディタ側の `useEffect` で受け取って自身の `localStorage` に保存する。受け取り後は `history.replaceState` で URL からトークンを消去する。

**教訓**: **別オリジン間では localStorage は共有できない**。この認識が最初からあればすぐ解決できた。

```
Next.js (3000)                    Editor (5176)
┌──────────────┐                  ┌──────────────┐
│ localStorage │  ← 別世界 →     │ localStorage │
│ guestToken=X │                  │ (空)         │
└──────┬───────┘                  └──────────────┘
       │ window.location.href
       │ = editor/...?token=X&guest=1
       └──────────────────────────────► URLパラメータで渡す
                                        → localStorage に保存
                                        → URL からパラメータ消去
```

### 2. 複数ゲスト作成時のトークン上書き問題

**症状**: 同じブラウザで2回「ログインせずに始める」を押すと、1回目のプロジェクトが空になる

**原因**:
1. Guest1 作成 → `guestToken=A` を保存
2. Guest2 作成 → `guestToken=B` で上書き
3. Guest1 のプロジェクト URL に**パラメータなし**でアクセス
4. `guestToken=B`（Guest2 のトークン）で認証 → Guest1 のプロジェクトにアクセス → **403**
5. catch で**サンプルプロジェクト（空のブロック）**が表示される

**解決策**: プロジェクト取得で 401/403 の場合、ゲストモードなら `guestToken` をクリアして GuestLanding を表示するように修正。

**教訓**: **ゲストは「使い捨て」アカウント**。同じブラウザでの複数ゲスト作成は想定すべきシナリオ。エラー時のフォールバック先が「空プロジェクト表示」ではなく「再ログイン促進」であるべき。

### 3. ch ブロックの `characterId` が slug なのか ID なのか

**症状**: ブロック一覧でキャラブロックが「未選択 / 未選択」と表示される

**原因**: `ChBlockCard.tsx` ではキャラクターの**検索を `slug` で行っている**のに、ゲスト作成時のブロックには ULID（DB の ID）をセットしていた。

```typescript
// ChBlockCard.tsx — slug で検索
const currentCharacter = characters.find((c) => c.slug === block.characterId);

// auth.ts（修正前）— ID をセット ← 不一致！
{ type: 'ch', characterId: chClassAssetId, expressionId: firstChImgAssetId }

// auth.ts（修正後）— slug をセット
{ type: 'ch', characterId: 'chara1', expressionId: 'default' }
```

**教訓**: **ブロックのフィールドが参照するのが ID なのか slug なのか、既存コンポーネントを必ず読んで確認する**。命名が `characterId` でも実態は slug を期待していることがある。

### 4. キャラクターデータの格納場所（data.characters vs ch-class アセット）

**症状**: ゲスト作成時にプロジェクトの `data.characters` にキャラクター定義を入れたが、API レスポンスでは `characters: []` になる

**原因**: プロジェクト取得API（`GET /api/projects/:id`）は `data.characters` を無視して、**DB の `ch-class` 種別アセットまたは Character テーブル**からキャラクター情報を構築する。

**解決策**: `ch-class` 種別のアセットレコードを作成し、`metadata` に `{ name, defaultExpression, expressions: { slug: assetId } }` を格納。

**教訓**: **データの真のソースがどこか**を確認する。JSON フィールドに入れても API レイヤーで上書きされる場合がある。

### 5. レートリミットによるテスト失敗

**症状**: E2E テストで `POST /api/auth/guest` が `429 Too Many Requests` を返す

**原因**: `guestLimiter` が 1時間に10回の制限を設けており、テスト中に何度もゲスト作成を繰り返すと上限に達する。メモリベースなのでサーバー再起動でリセットされる。

**教訓**: **テスト環境ではレートリミットを緩くする**か、テスト間でサーバーを再起動する運用が必要。

---

## 間違いやすいパターン（チェックリスト）

### ブロック定義

| チェック項目 | 説明 |
|---|---|
| `characterId` は slug | ULID ではなく `c.slug` でマッチする |
| `expressionId` は slug | ULID ではなく `e.slug` でマッチする |
| `assetId` は ULID | こちらは `a.id` でマッチ（bg ブロック） |
| characters の格納先 | `data.characters` ではなく `ch-class` アセット |

### Cross-Origin 認証

| チェック項目 | 説明 |
|---|---|
| localStorage はオリジン単位 | `localhost:3000` と `:5176` は別世界 |
| トークン受け渡しは URL パラメータ | 受け取り後に `history.replaceState` で消す |
| `authToken` vs `guestToken` | `getAuthToken()` は `authToken || guestToken` のフォールバック |
| `isGuestMode()` | `!authToken && guestToken` で判定 |

### エラーハンドリング

| チェック項目 | 説明 |
|---|---|
| 403 のフォールバック先 | 空プロジェクト表示ではなく GuestLanding |
| 401 のゲスト対応 | ログインリダイレクトではなく GuestLanding |
| catch の万能フォールバック | 全エラーで同じ処理にしない。403 と 404 で対応を分ける |

### テスト

| チェック項目 | 説明 |
|---|---|
| レートリミット | 10回/h。テスト中は再起動でリセット |
| Playwright の cross-origin | `window.location.href` での別オリジン遷移は `waitForURL` で検知不可 |
| E2E は `addInitScript` で localStorage 注入 | `page.goto` 前に `addInitScript` を呼ぶ |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `apps/hono/prisma/schema.prisma` | User に `expiresAt BigInt?` 追加 |
| `apps/hono/src/middleware/rate-limit.ts` | `guestLimiter` 追加（10回/h） |
| `apps/hono/src/middleware/auth.ts` | ゲスト期限チェック追加 |
| `apps/hono/src/routes/auth.ts` | guest/guest-restore/guest-upgrade エンドポイント、verify 修正、期限切れ自動削除 |
| `apps/hono/src/routes/projects.ts` | ゲストプロジェクト上限（3件） |
| `apps/hono/src/routes/assets.ts` | ゲストアップロードブロック |
| `apps/editor/src/config/api.ts` | guestToken 管理関数群 |
| `apps/editor/src/pages/EditorPage.tsx` | ゲスト認証フロー（URLパラメータ、復帰、401/403 処理） |
| `apps/editor/src/components/GuestLanding.tsx` | 新規：ゲスト開始画面 |
| `apps/editor/src/components/GuestUpgradeBanner.tsx` | 新規：残り時間表示＋登録フォーム |
| `apps/editor/src/components/Header.tsx` | 「ホーム」→「マイページ」 |
| `apps/editor/src/App.tsx` | workId なしルート追加 |
| `apps/next/app/page.tsx` | GuestStartButton（URLパラメータ付きリダイレクト）、エラーモーダル |
| `apps/next/lib/api.ts` | `getAuthToken()` に guestToken フォールバック |
| `apps/next/lib/contexts/AuthContext.tsx` | logout 時に guestToken クリア |
| `apps/next/components/ui/Header.tsx` | guestToken でログイン判定 |

---

## 今後の改善候補

1. **テスト環境のレートリミット緩和**: 環境変数で制御可能にする
2. **セッションストレージ検討**: guestToken を sessionStorage に移すとブラウザ閉じで自動クリア
3. **ゲスト復帰時の自動遷移**: restore 成功時に自分のプロジェクトに自動遷移（現在は workId なし時のみ）
4. **期限切れ通知**: 残り6時間でプッシュ通知やバナー強調
5. **CI での自動テスト**: 現在はローカルのみ。deploy 前の E2E テスト自動化
