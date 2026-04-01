# 公式アセット・マイアセット選択不可 — 調査報告

## 結論（先に）

**2つの根本原因が判明:**

1. **`official_assets` テーブルにデータが0件** — 公式アセットが1件も登録されていないため、公式アセットタブに表示されるものがない
2. **エディタの `project.data.assets` が空のプロジェクトがある** — 最新プロジェクト「動画テスト」のアセット数は0件。マイアセットタブにも表示されるものがない

つまり「選択できない」ではなく「選択するアセットが存在しない」が正しい状態。

---

## 詳細調査

### 1. DB 状態の確認

#### official_assets テーブル
```
SELECT COUNT(*) FROM official_assets;
→ 0 件（空）
```
管理画面 (`/admin/official-assets`) から公式アセットを1件もアップロードしていない。

#### assets テーブル（プロジェクトアセット）
```
bg: 6件（4プロジェクトに分散）
ch: 3件
frame: 80件（フレームセット用、アセット選択には無関係）
```

#### プロジェクト別アセット数（project.data JSON）
| プロジェクト | data.assets 件数 |
|---|---|
| 動画テスト（最新） | **0** |
| 画像test | 2 |
| New Project | 2 |
| Azure Test | 4 |

→ ユーザーが最新プロジェクトで操作しているなら、マイアセットも0件。

### 2. コードフロー分析

#### マイアセット選択フロー
```
BgBlockCard
  → project.assets.filter(a => a.kind === 'bg')  ← project.data.assets から
  → AssetSelectModal(assets=bgAssets)
  → 0件なら「アセットがありません」表示
  → ユーザーは何も選択できない ✓ 再現
```

**data.assets の元データ:** `project.data` はプロジェクトの JSON フィールド。
- エディタ起動時に `GET /api/projects/:id` で取得
- `apiProject.data.assets` をそのまま使用（DB assets テーブルではない）
- アップロード時に AssetPanel が `addAsset()` → `autoSaveProject()` で JSON に保存

#### 公式アセット選択フロー
```
AssetSelectModal → 「公式アセット」タブクリック
  → fetch(GET /api/official-assets?kind=bg)
  → official_assets テーブルから取得
  → 0件 → 「公式アセットがありません」表示
  → ユーザーは何も選択できない ✓ 再現
```

### 3. UI コードの問題点

AssetSelectModal のコード自体には致命的なバグなし。選択ロジック：
- デスクトップ: クリック → selectedId 設定 → 「選択」ボタン → onSelect → onClose
- モバイル: クリック → 直接 onSelect → onClose

ただし以下の改善点あり:

#### 問題 A: アセットが0件の場合の導線が不十分
マイアセットが0件の場合「アセット管理タブからアップロードしてください」と表示するが、
モーダル内からアップロードする方法がない。公式アセットも同様。

#### 問題 B: 公式アセット追加後のプロジェクト保存漏れ
`handleOfficialSelect` で `addAsset()` はストアに追加するが、
`autoSaveProject()` を呼んでいない。次回エディタ起動時にアセットが消える。

#### 問題 C: URL解決の不整合
一部のアセットの `url` が `/uploads/` prefix なし（例: `bg/368bfa1c7aa6e671.webp`）。
`getAssetUrl()` は `API_BASE_URL + path` で結合するが、
`API_BASE_URL` = `http://localhost:8080` で path に `/` がないと
`http://localhost:8080bg/xxx` となり画像が表示されない。

---

## 修正方針

### 修正 1: テスト用公式アセットをシードする
管理画面での手動アップロードを待たず、既存プロジェクトのアセット画像を公式アセットとして登録する DB シードスクリプトを実行。

### 修正 2: AssetSelectModal 内にアップロード機能を追加
マイアセットが0件の場合、モーダル内から直接アップロードできるようにする。
これにより「アセットがないから選べない」問題を解消。

### 修正 3: 公式アセット追加後のプロジェクト保存
`handleOfficialSelect` 内で `autoSaveProject()` を呼び、
次回起動時もアセットが維持されるようにする。

### 修正 4: getAssetUrl の `/` 修正
`getAssetUrl` で `path` が `/` で始まらない場合に `/` を挿入する。

---

## 変更ファイル

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | DB シード | `official_assets` にテストデータ投入 |
| 2 | `AssetSelectModal.tsx` | マイアセット0件時のアップロードボタン追加 + 保存漏れ修正 |
| 3 | `config/api.ts` | `getAssetUrl` の URL 結合修正 |
