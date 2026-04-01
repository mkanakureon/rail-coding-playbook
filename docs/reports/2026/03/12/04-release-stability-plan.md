# リリース前安定化計画書

**作成日**: 2026-03-12
**目的**: リリース前にコードベース全体を調査し、不安要素を洗い出して対処する

---

## 調査結果サマリ

| 領域 | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| API (Hono) | 2 | 5 | 4 | 1 |
| Editor | 3 | 4 | 5 | 1 |
| Web Engine | 1 | 4 | 4 | 2 |
| Next.js | 3 | 4 | 4 | 0 |
| Deploy/Infra | 1 | 2 | 2 | 3 |
| **合計** | **10** | **19** | **19** | **7** |

---

## Phase 1: Critical（リリースブロッカー）

### 1-1. AuthContext — 429 レートリミットで意図しないログアウト
- **場所**: `apps/next/lib/contexts/AuthContext.tsx:40-52`
- **問題**: `/api/auth/me` が 429 を返すと、有効なトークンなのにユーザーをログアウトさせてしまう
- **修正**: 429/503 の場合はトークンをクリアせず、リトライまたはエラーメッセージ表示
- **工数**: 小

### 1-2. プロジェクト作成のトランザクション欠如
- **場所**: `apps/hono/src/routes/projects.ts:104-220`
- **問題**: プロジェクト作成 → アセット追加 → プロジェクト更新がトランザクションなしで実行。途中で失敗すると不完全なプロジェクトが残る
- **修正**: `prisma.$transaction()` で全体をラップ
- **工数**: 小

### 1-3. WebOpHandler — reset() で textureCache 未クリア
- **場所**: `packages/web/src/renderer/WebOpHandler.ts:254-286`
- **問題**: エンジンリセット時にテクスチャキャッシュをクリアしないため、GPU メモリリーク。長時間プレイやプレビュー繰り返しで蓄積
- **修正**: `reset()` に `this.textureCache.clear()` 追加
- **工数**: 小

### 1-4. Editor — autosave のエラー握りつぶし
- **場所**: `apps/editor/src/pages/EditorPage.tsx:100-102`
- **問題**: `.catch(() => {})` でオートセーブ失敗が無視される。ユーザーは保存されたと思い込む
- **修正**: catch でトーストエラー表示
- **工数**: 小

### 1-5. Editor — useScrollPosition のイベントリスナーリーク
- **場所**: `apps/editor/src/hooks/useScrollDirection.ts:72-96`
- **問題**: cleanup 時の関数参照が addEventListener 時と異なり、removeEventListener が効かない
- **修正**: onScroll を useCallback でメモ化、または ref で保持
- **工数**: 小

### 1-6. フェードオーバーレイの二重 destroy
- **場所**: `packages/web/src/renderer/WebOpHandler.ts:1016-1037`
- **問題**: fadeBlack/fadeWhite を連続実行すると、destroyed な Graphics オブジェクトを再度 destroy しようとしてクラッシュ
- **修正**: destroy 後に null を代入するガード追加
- **工数**: 小

---

## Phase 2: High（安定性に影響）

### 2-1. Battle — waitForPlayerCommand の Promise が解決されないケース
- **場所**: `packages/web/src/renderer/WebOpHandler.ts:1375-1449`
- **問題**: `commandsEl` や `hero` が null の場合、Promise が永遠に解決されずエンジンがハング
- **修正**: null 時に reject またはデフォルト値で resolve
- **工数**: 小

### 2-2. Ticker ハンドラのクリーンアップ漏れ
- **場所**: `packages/web/src/renderer/WebOpHandler.ts:970-994, 1489-1513`
- **問題**: カメラアニメーション・タイムラインのアニメーション中にリセットされると ticker ハンドラが残る
- **修正**: アクティブな ticker ハンドラを配列で管理し、reset() で一括解除
- **工数**: 中

### 2-3. Audio — デコードエラーの未処理
- **場所**: `packages/web/src/audio/AudioManager.ts:36-53`
- **問題**: 壊れた音声ファイルの fetch-decode チェーンでエラーが握りつぶされる
- **修正**: catch で console.warn + 呼び出し元に通知
- **工数**: 小

### 2-4. pages.ts — PrismaClient の重複インスタンス
- **場所**: `apps/hono/src/routes/pages.ts:12`
- **問題**: `new PrismaClient()` で独立した接続プールを作成。共有の db.ts インスタンスを使うべき
- **修正**: `import { prisma } from '../lib/db.js'` に変更
- **工数**: 小

### 2-5. assets.ts — 削除時のエラー握りつぶし
- **場所**: `apps/hono/src/routes/assets.ts:357-358`
- **問題**: `.catch(() => {})` で DB 削除エラーが無視される
- **修正**: catch でログ出力
- **工数**: 小

### 2-6. Editor — プロジェクト読み込み時の null チェック不足
- **場所**: `apps/editor/src/pages/EditorPage.tsx:339-374`
- **問題**: `response.project` が undefined の場合にクラッシュ
- **修正**: null チェック追加
- **工数**: 小

### 2-7. Next.js — メッセージページのエラー表示なし
- **場所**: `apps/next/app/(private)/mypage/messages/page.tsx:18-22`
- **問題**: API エラーが console.error のみ。ユーザーにフィードバックなし
- **修正**: エラーステート追加
- **工数**: 小

### 2-8. Next.js — mypage の並列 fetch でクリーンアップなし
- **場所**: `apps/next/app/(private)/mypage/page.tsx:33-49`
- **問題**: 4つの非同期処理が独立して走り、ナビゲーション後も完了を待つ
- **修正**: AbortController でクリーンアップ
- **工数**: 中

### 2-9. Next.js — プロジェクト作成エラーハンドリング不正確
- **場所**: `apps/next/app/(private)/mypage/page.tsx:256-276`
- **問題**: プロジェクト作成成功後の getProject/updateProject 失敗時に「作成失敗」と表示。実際は作成済みだが不完全
- **修正**: ステップ別エラーメッセージ
- **工数**: 小

---

## Phase 3: Medium（品質向上）

### 3-1. official-assets.ts — SQL インジェクションリスク
- **場所**: `apps/hono/src/routes/official-assets.ts:234-241`
- **問題**: メタデータキーのサニタイズが不十分。ホワイトリスト方式に変更すべき
- **修正**: 許可キーリストでバリデーション
- **工数**: 小

### 3-2. cloud-saves.ts — slotId の入力バリデーション不足
- **場所**: `apps/hono/src/routes/cloud-saves.ts:49-91`
- **問題**: slotId の長さ・形式、body のサイズに制限なし
- **修正**: Zod バリデーション追加
- **工数**: 小

### 3-3. assets.ts — キャラ表情の N+1 クエリ
- **場所**: `apps/hono/src/routes/assets.ts:141-159`
- **問題**: 表情ごとに個別クエリ。`findMany` + `where: { id: { in: [...] } }` に変更
- **工数**: 小

### 3-4. spriteBaseScales のメモリリーク
- **場所**: `packages/web/src/renderer/WebOpHandler.ts:1810-1818`
- **問題**: removeSprite で `spriteBaseScales.delete(id)` が漏れている
- **工数**: 小

### 3-5. Editor — debounce タイマーのクリーンアップ
- **場所**: `apps/editor/src/store/useEditorStore.ts:31-33, 944-960`
- **問題**: モジュールレベルのタイマーがコンポーネントアンマウント後も実行可能
- **工数**: 小

### 3-6. Next.js — Works ページのページネーションにローディング表示なし
- **場所**: `apps/next/app/(public)/works/page.tsx:44-66`
- **工数**: 小

### 3-7. Next.js — UserProfile のエラーハンドリング不完全
- **場所**: `apps/next/app/(public)/users/[id]/page.tsx:43-68`
- **工数**: 小

### 3-8. auth.ts — エラーレスポンス形式の不統一
- **場所**: `apps/hono/src/routes/auth.ts` 全体
- **問題**: `{ error }` と `{ error, code }` が混在
- **工数**: 中（影響範囲が広い）

---

## Phase 4: Low / Infra（余裕があれば）

### 4-1. web/Dockerfile — ksc-compiler ビルドステップ漏れ
- **場所**: `packages/web/Dockerfile:40-47`
- **問題**: ksc-compiler のビルドが web ビルド前に実行されていない可能性
- **工数**: 小

### 4-2. .env.example の不足
- **場所**: `apps/hono/.env.example`
- **問題**: 本番で使う環境変数（GOOGLE_API_KEY, RAG_DATABASE_URL 等）が未記載
- **工数**: 小

### 4-3. admin.ts — SQL ホワイトリスト不完全
- **場所**: `apps/hono/src/routes/admin.ts:399-410`
- **問題**: WITH 句等がブロックされていない
- **工数**: 小

---

## 作業優先順位

```
Phase 1 (Critical)  → 6件 — 全て工数小、即対応
Phase 2 (High)      → 9件 — ほぼ工数小、2件が中
Phase 3 (Medium)    → 8件 — 品質向上、1件が中
Phase 4 (Low/Infra) → 3件 — 余裕があれば
```

**推奨**: Phase 1 → Phase 2 を優先対応。Phase 3 は時間の許す範囲で。

---

## 対象外（機能追加にあたるため今回はスキップ）

- ゲストトークンの自動クリーンアップ強化
- Admin パネルのリアルタイム権限チェック
- AI Assist の同時リクエスト制限
- トークンを URL から排除する認証フロー変更
