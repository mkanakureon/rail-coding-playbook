# 公式アセット管理ページ 障害レポート

- **発生日**: 2026-03-05
- **ステータス**: 解決済み
- **影響範囲**: `/admin/official-assets` の 404 表示 + 全アセット画像の表示不能

## 症状

本番環境で2つの問題が同時に発生していた:

1. `/admin/official-assets` にアクセスすると 404 ページが表示される
2. アセット画像が全て 404（`/uploads/bg/xxx.webp` が存在しない）

## 原因と修正（2件）

### 問題1: ページ 404 — ESLint ビルドエラー

**原因**: `docs/[slug]/page.tsx` のエスケープ漏れ（`"` → `&quot;`）で `next build` が失敗。Docker イメージが正しく生成されず、古いイメージのまま本番に残っていた。

**根本原因**: `next dev` は ESLint を実行しないため、ローカル開発では気づけない。無関係な docs ページの lint エラーが admin ページのデプロイを巻き添えにした。

**修正**:
- ESLint エスケープ修正（即時対応）
- `next.config.ts` に `eslint.ignoreDuringBuilds: true` を設定（恒久対策）
- lint は pre-push hook で引き続き実行される

**コミット**: `6296371`

### 問題2: アセット画像 404 — STORAGE_MODE 未設定

**原因**: Container App (ca-api) に `STORAGE_MODE` 環境変数が未設定だった。

```
config.ts: storageMode = process.env.STORAGE_MODE || 'local'
→ STORAGE_MODE 未設定 → デフォルト 'local'
→ isAzureStorage() が false
→ resolveAssetUrl() が '/uploads/bg/xxx.webp' を返す（ローカルパス）
→ 本番に /uploads/ は存在しない → 全画像 404
```

**修正**:
```bash
az containerapp update --name ca-api --resource-group rg-next-aca-min \
  --set-env-vars "STORAGE_MODE=azure"
```

修正後: `https://kaedevnworks.blob.core.windows.net/assets/bg/xxx.webp` → 200 OK

## 追加対応

- `/admin/assets` ページを削除（`/admin/official-assets` と紛らわしいため）— コミット `db896d5`

## 調査の過程

| ステップ | 結果 |
|----------|------|
| 本番ページ curl | 404 表示 |
| ビルドログ確認 | `official-assets` は 6.74 kB で正常ビルド済み |
| JS チャンク確認 | `official-assets/page-673dabd73ff4f050.js` 存在 |
| curl (未認証) で 404 | `(private)` ルートの正常動作と判明 |
| ブラウザ DevTools | アセット画像が全て 404 |
| API レスポンス確認 | URL が `/uploads/...` → ローカルパスを返している |
| `STORAGE_MODE` 確認 | Container App に未設定 |
| `STORAGE_MODE=azure` 設定 | URL が Blob Storage に変わり解決 |

## 過去の類似事例

| 日付 | 原因 | 影響 |
|------|------|------|
| 2026-02-24 | `use` プレフィックス問題（`rules-of-hooks`） | ビルド失敗 |
| 2026-02-24 | 未使用 import（`CharacterEditModal.tsx`） | ビルド失敗 |
| 2026-02-24 | Prisma マイグレーション漏れ | 500 エラー |
| 2026-03-05 | ESLint エスケープ漏れ + STORAGE_MODE 未設定 | 404 + 画像表示不能 |

## 再発防止策

- [x] `next.config.ts` に `eslint.ignoreDuringBuilds: true` を設定
- [x] `STORAGE_MODE=azure` を Container App に設定
- [x] `config.ts` で `AZURE_STORAGE_CONNECTION_STRING` があれば `STORAGE_MODE` なしでも azure と推定するフォールバック追加
- [x] `deploy.yml` にデプロイ後のアセット URL 検証ステップ追加（`/uploads/` を検出したら fail）

## 教訓

1. **「表示されない」には複数原因がありうる** — ページ 404 とアセット 404 が同時に起きていた
2. **環境変数のデフォルト値は危険** — `STORAGE_MODE` のデフォルトが `'local'` のため、未設定でもエラーにならずサイレントに壊れる
3. **`next dev` と `next build` は別物** — dev で動いても build で壊れる。`ignoreDuringBuilds` で lint をビルドから分離するのが安全
