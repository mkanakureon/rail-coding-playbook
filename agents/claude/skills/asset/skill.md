---
description: Use when the user asks to manage assets (upload images, list assets, delete). Triggers on "画像アップロード", "アセット一覧", "アセット追加", "マイアセット", "背景を追加", "画像を追加".
---

# アセット管理 Skill

プロジェクトへの画像・音声アップロード、マイアセット（個人ライブラリ）の操作を行う。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "画像をアップロードして" | プロジェクトにアップロード |
| "背景を追加して" | category=bg でアップロード |
| "アセット一覧" | プロジェクトアセット一覧 |
| "マイアセット見せて" | マイアセット一覧 |
| "マイアセットに追加" | マイアセットにアップロード |
| "アセット削除" | プロジェクトアセット削除 |

## 前提条件

- API サーバーが起動していること
- Azure に接続する場合は `--azure` フラグを付ける

## CLI

```bash
ACLI="npx tsx scripts/cli/asset/asset-cli.ts"
```

## プロジェクトアセット

```bash
# アセット一覧（カテゴリ絞り込み可）
$ACLI list <projectId>
$ACLI list <projectId> --category bg
$ACLI list <projectId> --category ch-img

# アセット詳細
$ACLI show <projectId> <assetId>

# ローカル画像をプロジェクトにアップロード
$ACLI upload <projectId> <filePath> --category bg
$ACLI upload <projectId> <filePath> --category bg --slug my_forest

# ディレクトリ内の画像を一括アップロード
$ACLI upload-dir <projectId> <dirPath> --category ch-img

# slug 変更
$ACLI rename <projectId> <assetId> --slug new_name

# アセット削除
$ACLI delete <projectId> <assetId>

# 公式アセットをプロジェクトにインポート
$ACLI import-official <projectId> <officialAssetId>

# マイアセットからプロジェクトにインポート
$ACLI import-library <projectId> <userAssetId>
```

## マイアセット（個人ライブラリ）

プロジェクトに依存しない個人の画像ライブラリ。複数プロジェクトで使い回せる。

```bash
# マイアセット一覧
$ACLI my-list
$ACLI my-list --category bg

# ローカル画像をマイアセットに追加
$ACLI my-upload <filePath> --category bg
$ACLI my-upload <filePath> --category bg --subcategory outdoor

# ディレクトリ一括追加
$ACLI my-upload-dir <dirPath> --category ch-img --subcategory 楓

# マイアセットから削除
$ACLI my-delete <userAssetId>
```

## カテゴリ一覧

| カテゴリ | 用途 |
|---------|------|
| `bg` | 背景画像 |
| `ch-img` | キャラクター画像 |
| `effect` | エフェクト |
| `ui` | UI 素材 |
| `bgm` | BGM |
| `se` | 効果音 |
| `voice` | ボイス |

## 対応フォーマット

画像: png / jpg / jpeg / webp / gif
音声: mp3 / ogg / wav / m4a

## Azure 接続

```bash
$ACLI --azure list <projectId>
$ACLI --azure my-list
```
