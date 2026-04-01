---
description: Use when the user asks to create or manage characters (create from official assets, list, update expressions). Triggers on "キャラ作って", "キャラクター追加", "キャラ一覧", "表情追加", "公式キャラ".
---

# キャラクター管理 Skill

公式アセットまたはマイアセットの画像を使って、プロジェクトにキャラクターを作成・管理する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "キャラクターを作って" | キャラクター新規作成 |
| "楓を追加して" | 公式アセットからキャラ作成 |
| "キャラ一覧" | プロジェクト内キャラ一覧 |
| "公式キャラを見せて" | 公式アセットのキャラ画像一覧 |
| "表情を追加" | キャラクター更新 |
| "キャラ削除" | キャラクター削除 |

## 前提条件

- API サーバーが起動していること
- Azure に接続する場合は `--azure` フラグを付ける

## CLI

```bash
CHCLI="npx tsx scripts/cli/character/character-cli.ts"
```

## コマンド

### 公式アセットの確認

```bash
# 公式アセットのキャラクター一覧
$CHCLI official

# 特定キャラの画像を確認
$CHCLI official --subcategory 楓
```

### キャラクター作成

```bash
# 公式アセットの画像でキャラクターを新規作成（表情差分も自動取得）
$CHCLI create-from-official <projectId> --slug kaede --name 楓 --subcategory 楓

# マイアセットの画像でキャラクターを新規作成（asset ID を直接指定）
$CHCLI create <projectId> --slug villain --name "魔王" \
  --expressions '{"angry":"<assetId1>","laugh":"<assetId2>"}'
```

### 確認・更新・削除

```bash
# プロジェクト内のキャラクター一覧
$CHCLI list <projectId>

# キャラクター詳細（JSON）
$CHCLI show <projectId> <slug>

# キャラクター更新
$CHCLI update <projectId> <slug> --name "新しい名前"
$CHCLI update <projectId> <slug> --expressions '{"smile":"<assetId>"}'

# キャラクター削除
$CHCLI delete <projectId> <slug>
```

### プロジェクトへの反映

```bash
# ch-class → project.data.characters に反映（エディタ表示用）
$CHCLI bind <projectId>
```

## 典型的なフロー

### 公式アセットからキャラクターを作成

```bash
# 1. 公式アセットで使えるキャラを確認
$CHCLI official

# 2. キャラクターを作成
$CHCLI create-from-official <projectId> --slug kaede --name 楓 --subcategory 楓

# 3. プロジェクトに反映
$CHCLI bind <projectId>
```

### ローカル画像からキャラクターを作成

```bash
# 1. 画像をプロジェクトにアップロード（asset スキル）
npx tsx scripts/cli/asset/asset-cli.ts upload-dir <projectId> ./villain_faces/ --category ch-img

# 2. アップロードした asset ID を確認
npx tsx scripts/cli/asset/asset-cli.ts list <projectId> --category ch-img

# 3. キャラクターを作成
$CHCLI create <projectId> --slug villain --name "魔王" \
  --expressions '{"angry":"<assetId1>","laugh":"<assetId2>"}'

# 4. プロジェクトに反映
$CHCLI bind <projectId>
```

## Azure 接続

```bash
$CHCLI --azure official
$CHCLI --azure list <projectId>
```
