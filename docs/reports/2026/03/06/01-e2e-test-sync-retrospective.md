# E2E テスト同期 振り返り — 2026-03-05/06

## 概要

UI（Next.js / Editor）を変更した際に対応する E2E テストを同時に更新しなかったため、**13 テストが一斉に壊れた**。修正に約 3 時間を要した。

## タイムライン

| 時刻 | 作業 |
|------|------|
| — | UI 変更が複数コミットにわたって蓄積（login セレクタ、mypage タブ化、エディタ target=_blank 化 等） |
| 03-05 | テスト実行で 13/93 failed を検出 |
| 03-05 | 1 回目修正: セレクタ更新、認証方式変更、URL 修正 → 7 failed に減少 |
| 03-05 | 2 回目修正: DB ポート、新タブ対応、レートリミット → **91/91 passed** |
| 03-05 | 再発防止策として `check-e2e-sync.sh` + pre-commit hook を導入 |

## 検出された不整合（13 件）

### カテゴリ A: セレクタ変更（5 件）

| テスト | 原因 | 修正 |
|--------|------|------|
| editor-blocks (5件) | `input[name=...]` → `input[id=...]`、`text=エディタを開く` → `text=エディタで編集`、`text=新規プロジェクト作成` → `button:has-text("新規作成")` | セレクタ更新 |

**根本原因**: フォーム input の `name` 属性を `id` 属性に変更した際、テストを更新しなかった。ボタンテキストの変更も同様。

### カテゴリ B: ページ構造変更（3 件）

| テスト | 原因 | 修正 |
|--------|------|------|
| admin-panel (1件) | `main h1` が mypage の h1（ユーザー名）にマッチ | `h1:has-text("ダッシュボード")` に変更 |
| full-flow (1件) | `/projects` ページが `/mypage` にリダイレクトされるようになった | マイページのプロジェクトタブ経由に変更 |
| verify-cookie (1件) | Cookie 認証から localStorage トークン認証に移行 | localStorage 検証に変更 |

**根本原因**: ページのルーティング変更（/projects → /mypage リダイレクト）や認証方式変更がテストに反映されていなかった。

### カテゴリ C: ブラウザ挙動変更（2 件）

| テスト | 原因 | 修正 |
|--------|------|------|
| editor-blocks (全件) | エディタリンクが `target="_blank"` で新タブを開くようになった | `context.waitForEvent('page')` で新タブをキャッチ |
| full-flow (1件) | 登録後 `/login?registered=true` にリダイレクトされるが `waitForURL('**/login')` が完全一致でタイムアウト | `**/login**` に変更 |

**根本原因**: `<a target="_blank">` への変更がテストの `waitForURL` を壊す。Playwright はデフォルトで現在のタブの URL しか監視しない。

### カテゴリ D: 環境差異（2 件）

| テスト | 原因 | 修正 |
|--------|------|------|
| admin-panel (1件) | `setAdminRole` が DB ポート 5432 を使用、API は 5433 → 別 DB に書き込み | ポートを 5433 に統一 |
| mypage (5件) | register API のレートリミット（3回/時）がテスト 5 件で枯渇 | `REGISTER_RATE_LIMIT` 環境変数化 + 既存ユーザー利用 |

**根本原因**: テストが暗黙的に環境設定に依存している。DB URL やレートリミットのハードコード。

### カテゴリ E: ドキュメント変更（1 件）

| テスト | 原因 | 修正 |
|--------|------|------|
| docs-verify (1件) | ドキュメントページの slug 追加・削除（terms-of-service/privacy-policy 削除、ksc-script-spec 追加） | テストのスラグ一覧を更新 |

## 根本原因分析

```
UI を変更する
  └→ テストを同時に修正しない
      └→ なぜ？ → テストが壊れていることに気づかない
          └→ なぜ？ → CI がない / ローカルでテストを実行する習慣がない
              └→ なぜ？ → テスト実行に 3-6 分かかり、dev server 起動も必要
```

**真の根本原因**: UI 変更時にテスト修正を促す仕組みがなかった。

## 再発防止策

### 導入済み

| 施策 | ファイル | 効果 |
|------|---------|------|
| **UI→E2E 同期チェッカー** | `scripts/check-e2e-sync.sh` | pre-commit で UI ファイル変更時に対応テスト未更新を警告 |
| **pre-commit hook 統合** | `.husky/pre-commit` | コミット時に自動チェック |
| **レートリミット環境変数化** | `apps/hono/src/middleware/rate-limit.ts` | `REGISTER_RATE_LIMIT` でテスト時の枯渇を防止 |

### 推奨（未導入）

| 施策 | 優先度 | 効果 |
|------|--------|------|
| **CI で E2E テスト実行** | 高 | PR マージ前にテスト不整合を検出 |
| **テスト用 DB URL の統一** | 中 | `DATABASE_URL` を `.env.test` に一元管理、ハードコード禁止 |
| **セレクタの安定化** | 中 | `data-testid` 属性を導入し、CSS クラスやテキストに依存しない |
| **テスト用ユーザーの事前作成** | 中 | register API を毎回叩かず、seed データで固定ユーザーを用意 |
| **ローカルテスト実行の簡易化** | 低 | `npm run test:e2e` で dev server 起動 + テスト実行を一発で |

## マッピングテーブル（check-e2e-sync.sh に定義済み）

| UI パス | 関連テスト |
|---------|-----------|
| `apps/next/app/(public)/login/` | auth-flow, local-auth, auth-redirect |
| `apps/next/app/(public)/register/` | auth-flow, full-flow, verify-cookie |
| `apps/next/app/(private)/mypage/` | mypage, full-flow |
| `apps/next/app/(private)/admin/` | admin-panel |
| `apps/next/app/(public)/docs/` | docs-verify |
| `apps/next/app/(private)/projects/` | full-flow, editor-blocks |
| `apps/next/components/` | comprehensive-nav |
| `apps/editor/src/pages/EditorPage` | editor-blocks, editor-mobile, ksc-block, timeline-* |
| `apps/editor/src/components/blocks/` | editor-blocks, guest-editor-blocks |
| `apps/editor/src/components/panels/` | asset-selection, asset-management, timeline-panel |
| `packages/web/src/engine/` | visual-logic-verify, ovl-preview, ksc-demo |

## 教訓

1. **UI 変更は必ずテストとセットでコミットする** — 「あとでまとめて」は負債が膨らむ
2. **`target="_blank"` の追加は E2E テストを壊す** — Playwright は新タブを自動追跡しない
3. **`waitForURL` の glob パターンはクエリパラメータに注意** — `**/login` は `/login?registered=true` にマッチしない
4. **レートリミットはテストの敵** — テスト環境では緩和するか、API 直接ログイン + トークン注入パターンを使う
5. **DB ポートのハードコードは事故の元** — 環境変数 or `.env` 経由で統一する
6. **`button:has-text("X")` は部分一致** — 「作成」が「+ 新規作成」にもマッチする。`button[type="submit"]:has-text("X")` や `getByRole` で絞る
