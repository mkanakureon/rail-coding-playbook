---
description: Use when the user asks to sync packages/interpreter/ to the kaedevn OSS repository. Triggers on "OSSに同期", "kaedevnにコピー", "sync oss".
---

# OSS リポジトリ同期

monorepo の `packages/interpreter/` を kaedevn OSS リポジトリにフォルダーごとコピーする。

## パス

| 項目 | パス |
|---|---|
| コピー元 | `<PROJECT_ROOT>/packages/interpreter/` |
| コピー先 | `/Users/kentaromukunasi/Documents/git/kaedevn/packages/interpreter/` |

## コマンド

```bash
rsync -av --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='tsconfig.tsbuildinfo' \
  <PROJECT_ROOT>/packages/interpreter/ \
  /Users/kentaromukunasi/Documents/git/kaedevn/packages/interpreter/
```

## 実行手順

1. **機密チェック**: コピー元に `.env*`、credential、パスワードがないことを確認する
   ```bash
   grep -rl "password\|secret\|api_key\|credential\|DevPass\|<YOUR_DB_PASSWORD>" \
     <PROJECT_ROOT>/packages/interpreter/src/ \
     <PROJECT_ROOT>/packages/interpreter/test/ \
     <PROJECT_ROOT>/packages/interpreter/examples/ \
     <PROJECT_ROOT>/packages/interpreter/scripts/ \
     || echo "OK: 機密情報なし"
   ```
2. **rsync 実行**: 上記コマンドでフォルダーごとコピー
3. **差分確認**: kaedevn 側で `git diff --stat` を確認
4. **コミット・プッシュ**（commit スキルのルールに従う）:
   ```bash
   cd /Users/kentaromukunasi/Documents/git/kaedevn
   git add packages/interpreter/
   git commit -m "コミットメッセージ（下記ルール参照）"
   git push
   ```

## コミットメッセージのルール

commit スキル（`.claude/skills/commit/skill.md`）に準拠する。

### フォーマット

```
{プレフィックス}: {日本語の説明}

- 変更点の箇条書き

---
Claude Code の感想（1〜3行、ゆるいトーンでOK）

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### プレフィックス

| プレフィックス | 使う場面 |
|---|---|
| `feat:` | 新機能・大きな同期 |
| `sync:` | 定期的な同期 |
| `fix:` | バグ修正の反映 |
| `docs:` | ドキュメントのみの同期 |

### Claude の感想（必須）

`---` で区切り、今回の同期作業についての正直な感想を 1〜3 行書く。

## 注意事項

- `--delete` 付き: monorepo 側で削除されたファイルは kaedevn 側でも削除される
- `node_modules/` と `dist/` は除外: kaedevn 側で個別に `npm install` / `npm run build` する
- monorepo 側でコミット・プッシュした後に同期する
- `token` 等のプログラミング用語は誤検知。Tokenizer 関連は問題ない

## kaedevn ルートの保護ファイル（絶対に上書き・削除しない）

以下は kaedevn OSS リポジトリ独自のファイル。monorepo には存在しない。
rsync のスコープ外（`packages/interpreter/` のみ同期）なので通常は影響しないが、
**`git add -A` や手動コピーで誤って上書きしないこと。**

| ファイル | 用途 |
|---|---|
| `README.md` | OSS リポジトリのトップ README |
| `CONTRIBUTING.md` | コントリビューションガイド |
| `SECURITY.md` | セキュリティポリシー |
| `LICENSE` | MIT ライセンス |
| `package.json` | ルート package.json |
| `tsconfig.base.json` | 共有 TypeScript 設定 |
| `.gitignore` | Git 除外設定 |

コミット時は **`git add packages/interpreter/`** のみ使う。`git add -A` は禁止。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "OSSに同期して" | 同期実行 |
| "kaedevnにコピーして" | 同期実行 |
| "OSSリポジトリ更新して" | 同期実行 |
| "interpreterをOSSに反映して" | 同期実行 |
| "sync oss" | 同期実行 |
