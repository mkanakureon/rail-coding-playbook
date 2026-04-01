---
name: sync-main
description: Fetch and merge the latest main branch into the current branch. Use when asked to "merge main", "sync with main", "最新を取り込んで", "mainをマージして".
---
# Sync Main Skill

現在の作業ブランチに、リモートの `main` ブランチの最新状態を取り込み（マージし）ます。
作業ブランチが `main` から乖離した際や、定期的に最新の変更を反映させたい場合に使用します。

## 手順

### Step 1: 状態の確認
`git status` で未コミットの変更がないか確認します。
もし変更が存在する場合は、コンフリクトを防ぐため、マージの前にコミット（`safe-commit` スキルを推奨）またはスタッシュを行うようユーザーに提案してください。

### Step 2: 現在のブランチの確認
`git branch --show-current` で現在のブランチを確認します。`main` ブランチにいる場合は、「既に main ブランチにいます」と伝えて終了します。

### Step 3: フェッチとマージ
リモートの `main` ブランチから最新情報を取得し、現在のブランチにマージします。
```bash
git fetch origin main
git merge origin/main
```

### Step 4: 結果の報告
- **Successfully merged / Already up to date**: その旨をユーザーに報告します。
- **コンフリクトが発生した場合**: マージが一時停止していることを伝え、どのファイルでコンフリクトが起きているか（`git status` 等で）をユーザーに報告し、手動での解決を促してください。自動でコードを書き換えようとしてはいけません。
