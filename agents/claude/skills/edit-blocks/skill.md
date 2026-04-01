---
description: Use when the user asks to edit visual novel scenarios via CLI (add/update/delete blocks, pages). Triggers on "シナリオを書いて", "ブロック追加", "セリフ変更", "ページ追加", "ブロック一覧".
---

# ブロックエディタ CLI 操作 Skill

ブラウザを使わずに CLI でビジュアルノベルのシナリオ（ブロック）を編集する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "シナリオを書いて" | ブロック追加フロー |
| "ブロックを追加して" | 指定ブロック追加 |
| "セリフを変更して" | ブロック更新 |
| "プロジェクトの中身を見せて" | blocks 一覧表示 |
| "ページを追加して" | ページ追加 |
| "ブロック一覧" | blocks 一覧表示 |
| "整合性チェック" | validate 実行 |

## 前提条件

- API サーバーが起動していること（ローカル: `./scripts/dev-start.sh api`）
- Azure に接続する場合は `--azure` フラグを付ける

## CLI

```bash
CLI="npx tsx scripts/cli/block/editor-cli.ts"
```

## 作業フロー

### シナリオ確認

1. **プロジェクト一覧**
   ```bash
   $CLI list
   ```

2. **コンテキスト確認**（利用可能なアセット・キャラ・ページ・変数）
   ```bash
   $CLI context <projectId>
   ```

3. **ブロック一覧**
   ```bash
   $CLI blocks <projectId>
   ```

### ブロック追加

```bash
# テキスト（セリフ）
$CLI add <projectId> <pageId> text --body "こんにちは" --speaker "主人公"

# 背景
$CLI add <projectId> <pageId> bg --assetId <id>

# キャラクター表示（pos: L / LC / C / RC / R）
$CLI add <projectId> <pageId> ch --characterId <slug> --expressionId <expr> --pos C

# 選択肢
$CLI add <projectId> <pageId> choice --options '["はい","いいえ"]'

# ジャンプ
$CLI add <projectId> <pageId> jump --toPageId <pageId>

# 変数セット
$CLI add <projectId> <pageId> set_var --varName "flag" --operator "=" --value "1"

# エフェクト
$CLI add <projectId> <pageId> effect --effect "shake"

# オーバーレイ
$CLI add <projectId> <pageId> overlay --assetId <id>

# スクリーンフィルタ
$CLI add <projectId> <pageId> screen_filter --filterType "sepia"

# 特定ブロックの後に挿入
$CLI add <projectId> <pageId> text --body "挿入テキスト" --after <blockId>
```

### ブロック編集・削除・移動

```bash
$CLI update <projectId> <blockId> --body "変更後のセリフ"
$CLI remove <projectId> <blockId>
$CLI move <projectId> <blockId> up
$CLI move <projectId> <blockId> down
```

### ページ操作

```bash
$CLI add-page <projectId> "第3話"
$CLI rename-page <projectId> <pageId> "クライマックス"
$CLI remove-page <projectId> <pageIndex>
```

### スナップショット（バックアップ・復元）

```bash
$CLI snapshot <projectId> --tag "before-edit"
$CLI snapshots <projectId>
$CLI restore <projectId> <snapshotFile>
```

### テンプレート

```bash
$CLI template list
$CLI template preview <name>
$CLI template apply <projectId> <pageId> <name> --var key=value
```

### エクスポート / インポート / バリデーション

```bash
$CLI export <projectId> > project.json
$CLI import <projectId> <pageId> blocks.json
$CLI validate <projectId>
```

### Azure 接続

```bash
$CLI --azure list
$CLI --azure blocks <projectId>
```

## 制約

- `start` ブロックは各ページの先頭に1つだけ。削除・移動不可
- `assetId` / `characterId` / `expressionId` / `toPageId` は `context` コマンドで確認した実在 ID を使う
- `_ai_context` は読み取り専用
