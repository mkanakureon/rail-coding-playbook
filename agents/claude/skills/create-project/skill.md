---
description: Use when the user asks to create a new visual novel project or import a story script. Triggers on "プロジェクト作って", "新しいプロジェクト", "台本を投入", "ストーリーをインポート", "ファンタジーのプロジェクト".
---

# プロジェクト作成 Skill

テンプレートからプロジェクトを作成する、またはテキスト台本をプロジェクトに投入する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "プロジェクトを作って" | テンプレートから作成 |
| "ファンタジーのプロジェクト" | --config fantasy で作成 |
| "ホラーのプロジェクトを作って" | --config horror で作成 |
| "新しいプロジェクト" | ジャンル確認 → 作成 |
| "台本を投入して" | import-story で投入 |
| "ストーリーをインポート" | import-story で投入 |
| "プロジェクト一覧" | editor-cli list |

## 前提条件

- API サーバーが起動していること
- Azure に接続する場合は `--azure` フラグを付ける

## テンプレートからプロジェクト作成

```bash
# 利用可能なジャンル一覧
npx tsx scripts/cli/project/init-project.ts --list

# 作成（背景・キャラ自動インポート、初期ブロック付き）
npx tsx scripts/cli/project/init-project.ts --config <genre>
npx tsx scripts/cli/project/init-project.ts --config <genre> --title "タイトル"
```

**対応ジャンル**: fantasy / horror / school / romance / mystery / comedy / longstory

### 作成後にやること

1. **キャラクター追加**（character スキル）
   ```bash
   npx tsx scripts/cli/character/character-cli.ts create-from-official <projectId> \
     --slug kaede --name 楓 --subcategory 楓
   npx tsx scripts/cli/character/character-cli.ts bind <projectId>
   ```

2. **シナリオ確認**（edit-blocks スキル）
   ```bash
   npx tsx scripts/cli/block/editor-cli.ts blocks <projectId>
   ```

## テキスト台本からの投入

```bash
# プレビュー（API 不要・変換結果の確認のみ）
npx tsx scripts/cli/project/import-story.ts --preview <file>

# プロジェクトに投入
npx tsx scripts/cli/project/import-story.ts <projectId> <file>
```

### 台本フォーマット

```
# 第1章 出発
@bg forest
@ch kaede normal C
[楓] 今日から旅に出よう。
[楓] 準備はいい？

--- 選択肢 ---
- はい
- もう少し待って

@jump page-2
```

| 記法 | 変換先 |
|------|--------|
| `# ページ名` | 新しいページ |
| `[キャラ名] セリフ` | text ブロック |
| `@bg <assetId>` | bg ブロック |
| `@ch <slug> <表情> <位置>` | ch ブロック |
| `@effect <type>` | effect ブロック |
| `@filter <type>` | screen_filter ブロック |
| `@overlay <assetId>` | overlay ブロック |
| `@jump <pageId>` | jump ブロック |
| `@set <var> = <value>` | set_var ブロック |
| `--- 選択肢 ---` + `- 項目` | choice ブロック |
| `// コメント` | 無視 |

## 典型的なワークフロー

```bash
# 1. プロジェクト作成
npx tsx scripts/cli/project/init-project.ts --config fantasy --title "冒険の始まり"

# 2. キャラクター追加
npx tsx scripts/cli/character/character-cli.ts create-from-official <projectId> \
  --slug kaede --name 楓 --subcategory 楓
npx tsx scripts/cli/character/character-cli.ts bind <projectId>

# 3. 台本を投入
npx tsx scripts/cli/project/import-story.ts <projectId> story.txt

# 4. 確認
npx tsx scripts/cli/block/editor-cli.ts blocks <projectId>
npx tsx scripts/cli/block/editor-cli.ts validate <projectId>
```

## Azure 接続

```bash
npx tsx scripts/cli/project/init-project.ts --azure --config fantasy
npx tsx scripts/cli/project/import-story.ts --azure <projectId> story.txt
```
