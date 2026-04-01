# アセット管理ページ改修案

## 現状の問題

### 1. 不要なタブ構成
- 「公式アセット」と「マイアセット」の 2 タブがあるが、マイアセットは使われていない
- ユーザーの主操作は公式アセットの閲覧とプロジェクトへの追加

### 2. サブカテゴリ（ファンタジー・三国志等）が見えない
taxonomy 修正後の DB 構造:
```
kind=image, category=bg,     subcategory=ファンタジー (40件)
kind=image, category=bg,     subcategory=中国短尺ドラマ (8件)
kind=image, category=bg,     subcategory=basic (1件)
kind=image, category=ch-img, subcategory=ファンタジー (68件)
kind=image, category=ch-img, subcategory=三国志 (39件)
kind=image, category=ch-img, subcategory=学園 (65件)
kind=image, category=ch-img, subcategory=政治 (39件)
kind=image, category=ch-img, subcategory=シルクロード (28件)
kind=image, category=ch-img, subcategory=中国短尺ドラマ (12件)
kind=image, category=ch-img, subcategory=BL (9件)
...
合計: 316件
```

API は subcategory を正しく返すが、画面側のフィルタ UI が 3 階層（kind → category → subcategory）で、ユーザーが category を選択しないと subcategory が表示されない。

### 3. アップロード機能がない
公式アセットタブにアップロード機能がない（管理画面 `/admin/official-assets` にしかない）。

## 改修内容

### A. ページ構成の簡素化
- 「マイアセット」タブを削除、公式アセット一覧のみ表示
- ページタイトルを「公式アセット」に変更

### B. フィルタ UI の改善
現在の 3 階層フィルタ:
```
[すべて] [画像] [音声] [キャラクラス]  ← kind
  [すべて] [背景] [キャラクター] [演出] [UI]  ← category
    [すべて] [ファンタジー] [三国志] ...  ← subcategory
```

改善案: category 選択時にサブカテゴリを自動表示
- kind フィルタ行: `[すべて] [画像] [音声]`
- category フィルタ行: `[すべて] [背景] [キャラクター]`  ← kind=image 時のみ表示
- subcategory フィルタ行: `[すべて] [ファンタジー] [三国志] ...`  ← category 選択時に API から取得して表示

### C. アップロード機能の追加
管理者権限ユーザー向けに、公式アセットページにアップロード UI を追加:
- 「個別アップロード」ボタン: 1 ファイル選択 → kind/category 指定 → アップロード
- 「一括アップロード」ボタン: 複数ファイル選択 → 同一 kind/category でまとめてアップロード

### D. 画像サムネイル表示
- 画像 URL は API が `/uploads/bg/xxx.webp` 形式で返却 → `resolveAssetUrl()` で完全 URL に変換
- 動作確認済み（HTTP 200）

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/next/app/(private)/my-assets/page.tsx` | ページ全体の改修 |
| `apps/next/lib/api.ts` | 必要に応じて API 関数追加 |

## API エンドポイント（既存・変更なし）

| エンドポイント | 用途 |
|--------------|------|
| `GET /api/official-assets` | 公式アセット一覧（kind/category/subcategory フィルタ対応） |
| `GET /api/official-assets/categories` | カテゴリ/サブカテゴリ一覧取得 |
| `POST /api/admin/official-assets/upload` | アップロード（管理者のみ） |
