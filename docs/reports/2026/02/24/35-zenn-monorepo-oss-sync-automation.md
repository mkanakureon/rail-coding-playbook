---
title: "monorepo → OSS リポジトリの同期を Claude Code スキルで自動化した"
emoji: "🔄"
type: "idea"
topics: ["claudecode", "ai", "OSS", "自動化"]
published: false
---

## はじめに

プロダクトが monorepo で、そこから一部パッケージだけ OSS リポジトリに公開したい。よくある構成だ。

```
monorepo (private)
└── packages/interpreter/  ← これだけ公開したい

kaedevn (public, OSS)
└── packages/interpreter/  ← ここに同期
```

手動で rsync してコミットすればいい話だが、問題は 3 つある。

1. **機密情報の混入リスク**: monorepo には DB パスワードや API キーが `.env` にある
2. **ルートファイルの上書きリスク**: OSS リポジトリ独自の `README.md` や `LICENSE` を壊したくない
3. **手順の属人化**: 「どのコマンドだっけ？」を毎回調べるのが面倒

これを Claude Code のスキル 1 つで解決した。

## スキルの全体像

`.claude/skills/sync-oss/skill.md` に定義されている。核心部分を見ていこう。

### パス定義

```markdown
## パス

| 項目 | パス |
|---|---|
| コピー元 | `packages/interpreter/` (monorepo内) |
| コピー先 | `/Users/.../git/kaedevn/packages/interpreter/` |
```

パスが明示されているので、Claude Code が間違えて別のパッケージを同期することはない。

### rsync コマンド

```bash
rsync -av --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='tsconfig.tsbuildinfo' \
  /path/to/monorepo/packages/interpreter/ \
  /path/to/kaedevn/packages/interpreter/
```

ポイントは `--delete` だ。monorepo 側で削除されたファイルは、OSS 側でも削除される。不要ファイルが残り続けるのを防ぐ。

`node_modules/` と `dist/` は除外する。OSS 側で個別に `npm install` / `npm run build` するからだ。

### 機密チェック

ここがこのスキルの要だ。

```bash
grep -rl "password\|secret\|api_key\|credential\|DevPass\|<YOUR_DB_PASSWORD>" \
  /path/to/monorepo/packages/interpreter/src/ \
  /path/to/monorepo/packages/interpreter/test/ \
  /path/to/monorepo/packages/interpreter/examples/ \
  /path/to/monorepo/packages/interpreter/scripts/ \
  || echo "OK: 機密情報なし"
```

rsync を実行する **前に** 必ず機密チェックを行う。検索対象は `src/`, `test/`, `examples/`, `scripts/` の 4 ディレクトリ。

検索キーワードには、このプロジェクト固有のものも含めている。

- `DevPass` — ローカル開発環境のパスワード
- `<YOUR_DB_PASSWORD>` — PostgreSQL のパスワード

汎用的な `password`, `secret` だけでなく、プロジェクト固有の機密キーワードを入れることで、検出率が上がる。

#### 注意事項

```markdown
## 注意事項

- `token` 等のプログラミング用語は誤検知。Tokenizer 関連は問題ない
```

コンパイラのコードに `token`, `Tokenizer` という単語が大量にある。これを誤検知しないよう、検索キーワードには `token` を含めていない。こういう例外を明文化しておくことで、Claude Code が「機密情報が見つかりました！」と誤警告を出すのを防ぐ。

### ルートファイル保護

```markdown
## kaedevn ルートの保護ファイル（絶対に上書き・削除しない）

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
```

rsync のスコープは `packages/interpreter/` なので、通常はルートファイルに影響しない。しかし、Claude Code が `git add -A` を使ってしまうと、うっかり変更が混ざる可能性がある。

だから **`git add -A` は禁止** と明記する。Claude Code は `git add packages/interpreter/` だけを使う。

### 実行手順

全体の手順はこうなっている。

```markdown
## 実行手順

1. **機密チェック**: コピー元に `.env*`、credential、パスワードがないことを確認
2. **rsync 実行**: 上記コマンドでフォルダーごとコピー
3. **差分確認**: kaedevn 側で `git diff --stat` を確認
4. **コミット・プッシュ**:
   cd /path/to/kaedevn
   git add packages/interpreter/
   git commit -m "コミットメッセージ"
   git push
```

4 ステップ。Claude Code はこの順序を守る。

### コミットメッセージルール

同期のコミットメッセージにも専用のルールがある。

```markdown
### プレフィックス

| プレフィックス | 使う場面 |
|---|---|
| `feat:` | 新機能・大きな同期 |
| `sync:` | 定期的な同期 |
| `fix:` | バグ修正の反映 |
| `docs:` | ドキュメントのみの同期 |
```

通常の commit スキルには `sync:` プレフィックスはない。OSS 同期専用だ。

そして、ここにも **Claude の感想** ルールがある。

```markdown
### Claude の感想（必須）

`---` で区切り、今回の同期作業についての正直な感想を 1〜3 行書く。
```

### トリガー

```markdown
## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "OSSに同期して" | 同期実行 |
| "kaedevnにコピーして" | 同期実行 |
| "OSSリポジトリ更新して" | 同期実行 |
| "interpreterをOSSに反映して" | 同期実行 |
| "sync oss" | 同期実行 |
```

「OSSに同期して」の一言で、機密チェック → rsync → 差分確認 → コミット → プッシュが全自動で実行される。

## 実際の運用フロー

### 1. monorepo で実装完了

```
ユーザー: コミットして
→ monorepo にコミット
```

### 2. OSS に同期

```
ユーザー: OSSに同期して
→ 機密チェック OK
→ rsync 実行
→ git diff --stat で差分確認
→ git add packages/interpreter/
→ git commit
→ git push
```

これだけ。人間がやるのは「OSSに同期して」と言うことだけだ。

## スキルの進化

最初のバージョンはシンプルだった。rsync コマンドと手順だけ。

その後、3 回のコミットで改善されている。

### v1: 初版

```
8600e16 docs: Zenn 記事パターン集と OSS 同期スキルを追加
```

rsync + 基本手順。

### v2: 感想コメントルール追加

```
ab89ae2 chore: sync-oss スキルに感想コメントルールを追加
```

commit スキルと同じ「感想ルール」を追加。32 行の変更。

### v3: ルートファイル保護ルール追加

```
94850b6 chore: sync-oss スキルにルートファイル保護ルールを追加
```

`git add -A` 禁止と保護ファイルリストを追加。18 行の変更。

スキルも段階的に育てている。最初から完璧を目指す必要はない。

## このアプローチの利点

### 1. 手順が再現可能

スキルに手順が書いてあるので、誰が実行しても（人間でも AI でも）同じ結果になる。

### 2. 機密漏洩の防止

人間が手動で rsync すると、機密チェックを忘れることがある。スキルにすれば、忘れることはない。

### 3. 部分的な git add

`git add -A` ではなく `git add packages/interpreter/` だけ使うルールが、ファイル保護として機能する。

### 4. コミットメッセージの統一

OSS リポジトリのコミットメッセージも一貫したフォーマットになる。

## 他のプロジェクトへの応用

この仕組みは monorepo → OSS 同期に限らない。以下のようなケースに応用できる。

### ステージング → 本番のデプロイ

```markdown
## 手順
1. ステージングのテスト結果を確認
2. 機密チェック（本番環境変数が混入していないか）
3. デプロイコマンド実行
4. ヘルスチェック
```

### マイクロサービス間の共有型同期

```markdown
## パス
| コピー元 | `packages/shared-types/` |
| コピー先 | `service-a/src/types/`, `service-b/src/types/` |
```

### ドキュメントサイトへの同期

```markdown
## パス
| コピー元 | `docs/` |
| コピー先 | `docs-site/content/` |

## 除外
- 内部設計書 (`docs/internal/`)
- 議事録 (`docs/meetings/`)
```

いずれのケースでも、「機密チェック → コピー → 差分確認 → コミット」のパターンは同じだ。

## スキルファイルのテンプレート

最小構成のテンプレートを示す。

```markdown
# {同期名} Skill

{何を} {どこから} {どこへ} コピーする。

## パス

| 項目 | パス |
|---|---|
| コピー元 | `{source}` |
| コピー先 | `{destination}` |

## 実行手順

1. 機密チェック
2. rsync (or cp) 実行
3. 差分確認
4. コミット

## 機密チェック

{プロジェクト固有のキーワード}

## 禁止事項

- `git add -A` 禁止（`git add {specific-path}` のみ使用）

## トリガー

| 表現 | 動作 |
|---|---|
| "{同期して}" | 同期実行 |
```

これをコピーして、パスとキーワードを自分のプロジェクトに合わせるだけだ。

## まとめ

rsync、機密チェック、git add の制限。それぞれは単純な操作だ。だが、これらを「毎回漏れなく、正しい順序で実行する」のは人間には難しい。

Claude Code のスキルは、この「毎回漏れなく」を保証する仕組みだ。

108 行のマークダウンファイル 1 つで、monorepo → OSS の同期が安全に自動化される。手順書を書くのと同じくらいの労力で、手順書を AI が毎回正確に実行してくれるようになる。

---

sync-oss スキルを書いたとき、一番悩んだのは機密チェックのキーワード選びだった。`token` を入れるとコンパイラのコードが全部引っかかる。プログラミング用語と機密情報の境界は意外と曖昧で、このあたりの例外管理がスキル設計の肝だと思った。

　　　　　　　　　　Claude Opus 4.6
