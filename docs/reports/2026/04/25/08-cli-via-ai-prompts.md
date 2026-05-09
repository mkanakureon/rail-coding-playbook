# 生成 AI 初心者向け — CLI 操作を全部 AI 経由でやる利点

親文書: 04 / 05 / 07 シリーズ  
前提: Claude Code、Cursor、Aider のような **CLI / エディタ統合型 AI** を使うこと

## この文書の狙い

このリポジトリでは **git / npm / npx / curl / node / prisma / playwright / gh（GitHub CLI）/ az（Azure CLI）/ docker** などを **ほぼすべて AI（Claude Code）経由で実行** している。人間が直接ターミナルに打ち込むのは、対話ログイン（`gcloud auth login`）など限られた場面のみ。

「CLI が打てる人ほど AI に任せるのが惜しい」と感じがちだが、**むしろ CLI に慣れている人ほど AI 経由のメリットが大きい**。本書はその理由を初心者向けに解説する。

---

# 第 1 部 — 何を AI 経由でやっているか

実観測のサンプル:

| 種類 | 人間が直接やらないコマンド例 | プロンプトでの呼び出し |
|---|---|---|
| **git 系** | `git add . && git commit -m "..."` | "コミットして" → `/commit` スキル |
| | `git push origin main` | "pushして" → `/push` スキル |
| | `git log --oneline -20` | "最近のコミット見て" |
| | `git rebase -i HEAD~5` | "整理して" |
| **npm / 開発** | `./scripts/dev-start.sh all` | "サーバー起動して" → `/dev-server` スキル |
| | `npm test -w @kaedevn/hono` | "Hono のテスト走らせて" → `/test` スキル |
| | `npm run typecheck` | "型チェックして" |
| | `npm run build -w apps/editor` | "エディタビルドして" |
| **DB / Prisma** | `npx prisma migrate dev --name xxx` | "スキーマ反映して" |
| | `psql -c "SELECT ..."` | "DB 確認して" |
| **検証・調査** | `curl -X POST .../api/...` | "API 叩いて確認して" |
| | `gh run list --workflow=deploy.yml` | "デプロイ状況見て" |
| | RAG 検索 curl | "Capacitor 却下理由を RAG で" |
| **テスト** | `npx playwright test ...` | "E2E 走らせて" → `/test` スキル |
| | playwright MCP で UI 確認 | "ブラウザで見て" → `/browser-verify` |
| **Azure / デプロイ** | `gh workflow run deploy.yml` | "デプロイして" → `/deploy-azure` スキル |
| | `az containerapp logs ...` | "ログ見て" |
| **アセット** | スクリプトでメタ生成 | "画像アップして" → `/asset` スキル |

このリポジトリは **31 スキル** 用意されており、ユーザーは **日本語のひと言** で複合 CLI 操作を呼び出せる。

---

# 第 2 部 — 利点（一般論）

## 1. CLI の構文を覚えなくていい

【一行で言うと】「やりたいこと」を日本語で書けば、AI が正しい呼び出しに翻訳してくれる。

人間が覚えるのが大変な例:

```bash
# Prisma + 環境変数 + 特定ワークスペース
DATABASE_URL="..." npx prisma migrate dev --name add_player_stamina --create-only --schema=apps/hono/prisma/schema.prisma

# Playwright を特定 config + grep で
npx playwright test -c tests/configs/playwright.local.config.ts -g "should login"

# gh で特定 workflow を特定パラメータで起動
gh workflow run deploy.yml -f targets=api -f reason="hotfix"
```

これらを **「スキーマ反映して」「ログインテスト走らせて」「API だけデプロイして」** で呼べる。AI が `CLAUDE.md` や skill 定義を読んで正しいフラグを組み立てる。

**初心者の利点**: 「CLI は怖いから GUI 使う」を卒業できる。プロのコマンドを真似しながら学習できる。

## 2. タイポしない・コピペミスしない

【一行で言うと】長いオプションフラグや UUID をコピペするときの事故が消える。

人間が間違えやすい例:

```bash
# UUID コピペで 1 文字違いで他人のレコードを更新
psql -c "UPDATE projects SET deleted=true WHERE id='5f4a2c-...'"

# --rebase と --merge を間違えて履歴汚染
git pull --rebase  # と書きたかったが --merge で打った

# rm -rf の対象パス間違い
rm -rf node_modules  # と書きたかったが node_modeles で全消し
```

AI は **構造化された入力**（プロンプト + ファイルパス + 状況）から組み立てるので、こういう人為的ミスが激減する。

**初心者の利点**: 「打ち間違えで何かが壊れる」恐怖が減り、CLI に手を伸ばしやすくなる。

## 3. ベストプラクティスが「スキル」として強制される

【一行で言うと】AI 経由なら、**正しい手順** が毎回守られる。

例: `/commit` スキルは以下を **強制**する:
- `Co-Authored-By` 行と感想 `---` を必ず入れる（pre-commit が弾く）
- C ゾーン変更があれば Design Change Note を求める
- 機密ファイル（`.env` など）はステージしない
- ハードコード URL チェックを通す

人間が `git commit -m "fix"` で済ませる場面でも、AI 経由なら **規約準拠の長文メッセージ + Co-Author + 感想** を 5 秒で生成して付けてくれる。

**初心者の利点**: 「正しい運用」を意識せず守れる。先輩の作法が skill として再利用される。

## 4. 状況を読んで適応する

【一行で言うと】AI は「今のリポジトリの状態」を見て、コマンドを変える。

人間: 「コミットして」と言われたら、自分で `git status` 見て、何を入れるか判断、メッセージを考える。

AI: プロンプト 1 つで:
1. `git status` 自動実行
2. `git diff --stat` で変更を要約
3. `git log --oneline -5` で過去のメッセージ調を確認
4. プレフィックス（`feat:` `fix:` `docs:`）を選択
5. 機密ファイルが混ざっていないかチェック
6. C ゾーンに触れていれば Design Change Note を生成
7. 感想を書いて Co-Author を付けてコミット

この **判断 + 実行のセット** が AI で 1 ターン。

**初心者の利点**: 「次に何をすればいいか」を AI が組み立てるので、思考の踏み台になる。

## 5. エラー回復が AI で自動化される

【一行で言うと】コマンドが失敗したとき、エラーログを読んで自分で直してくれる。

例: `npm install` で peer dependency 警告が出た:

```
npm ERR! peer react@"^18.0.0" from @some/lib
npm ERR! Found: react@19.0.0
```

人間: ググる → npm の docs 読む → `--legacy-peer-deps` か `--force` か判断する → 試す → 別エラー → ループ

AI: エラーを読み → 「このプロジェクトは React 19 なので peer 警告は ignored で OK」と判断 → CLAUDE.md に該当ルールがあるか確認 → 適切なフラグで再実行

**初心者の利点**: エラーで詰まる時間が劇的に減る。ループから脱出できる。

## 6. 全部「会話ログ」に残る

【一行で言うと】何をやったか、なぜやったか、結果がどうだったかが全部チャットに記録される。

人間が直接 CLI を叩くと:
- ターミナルのスクロールバッファに残るが、整理されていない
- Slack に貼ったログは検索しにくい
- 「何のために打ったか」の意図がない

AI 経由だと:
- プロンプト（やりたかったこと）
- AI の判断・実行コマンド
- 結果（出力 + 解釈）

が **ペア** で残る。後から `claude code` のセッション履歴を読み返せば、**「あの日なぜそうしたか」が再現可能**。

**初心者の利点**: 「先輩のターミナル操作を覗き見」みたいに学べる。先週の自分の作業も読み返せる。

## 7. 複数ツールをまたぐ操作が 1 ターンで済む

【一行で言うと】git + curl + node + Prisma + Playwright を組み合わせる「複合作業」を 1 つのプロンプトで指示できる。

例: 「機能を実装してテストして PR を作って」

人間がやる場合:
```
1. ブランチ切る:    git checkout -b feature/...
2. コードを書く
3. テスト走らせる:  npm test -w @kaedevn/hono
4. lint:           npm run lint -w apps/next
5. typecheck:      npm run typecheck
6. コミット:        git commit -m "..."
7. push:           git push -u origin feature/...
8. PR 作成:        gh pr create --title "..." --body "..."
9. CI 確認:        gh run list --branch feature/...
```

AI 経由:「`feature/foo` ブランチで実装して、テスト通して PR 出して」

→ 上記 9 ステップを **1 セッション内で連続実行**。各ステップの出力を AI が読んで次に進む。

**初心者の利点**: ワークフロー全体を 1 行で指示できる。各ステップの「次は何だっけ」を覚えなくていい。

## 8. ガードレールと相性が良い

【一行で言うと】AI は CLAUDE.md の「禁止パターン」「Change Zones」を読んでから実行するので、人間より規律正しい。

このリポジトリの仕組み:

```
ユーザー:「localStorage 使ってログイン状態を保存して」
   ↓
AI: CLAUDE.md を読む → "Forbidden Patterns" に "localStorage 直叩き禁止" を発見
   ↓
AI:「localStorage 直接アクセスは禁止されています。IStorage 抽象を使います」
   ↓
正しい実装を提案・実行
```

人間が手で打つと:
- ルールを覚えていないと localStorage を平気で使う
- pre-push でブロックされて初めて気づく
- 直すために実装をやり直す

**初心者の利点**: 「このプロジェクトのお作法」を AI が代わりに覚えていてくれる。

## 9. 反復作業が 1 行で済む

【一行で言うと】定型的な「あれを毎週やる」が、AI への 1 行で完結する。

例:
- 「壊れたメモを更新して」 → `/broken-memo` スキル
- 「開発日誌書いて」 → `/devlog` スキル（git log を整形）
- 「Qiita 記事書いて」 → `/qiita` スキル（最近の作業をネタに）
- 「OSS リポに同期して」 → `/sync-oss` スキル

これらを人間がやると **30 分〜2 時間**。AI 経由で **数分**。

**初心者の利点**: 「面倒だから後回し」が減り、運用品質が一定に保たれる。

## 10. 「このプロジェクト固有のコマンド」を AI が知っている

【一行で言うと】このリポジトリ独自の `./scripts/dev-start.sh` のような shell script の使い方も、Skill 経由で正しく呼ばれる。

```bash
# プロジェクト独自スクリプト
./scripts/dev-start.sh all      # 全サーバー起動
./scripts/dev-start.sh api      # API だけ
./scripts/test/local/e2e.sh     # E2E テストのローカル版
./scripts/lint/architecture-check.sh --warn-existing
```

人間: 各 script の使い方を README で読まないと使えない。  
AI: Skill 定義に書いてあるので **「サーバー起動して」で正しい flag つきで呼んでくれる**。

**初心者の利点**: プロジェクト独自の作法を覚えなくていい。

---

# 第 3 部 — 注意点（生成 AI 初心者が陥りがちな罠）

「全部 AI 任せ」で済むわけではない。以下に注意:

## 注意 1. 破壊的操作は確認させる

`rm -rf`, `git push --force`, `prisma migrate reset`, `DROP TABLE` のような **元に戻せない操作** は、AI 単独で走らせず **必ず確認** を取る。

このリポジトリの Claude Code は、これらに対して **デフォルトで確認を求める** 設計（システムプロンプトに明記）。

> 「実行してから後悔する」を避けるため、たまに「本当に実行しますか？」と AI が聞いてくる。これに **「Y」と即答せず読む** 癖をつける。

## 注意 2. 出力を「斜め読み」しない

AI が `npm test` を実行して「全テスト pass」と報告したとき、本当に全部 pass したか:
- 失敗が画面外に流れていないか
- `if` で囲まれてスキップされていないか
- そもそも対象テストが実行されたか

を **テスト数で確認** する習慣をつける。CLAUDE.md でも「フォールバック・エラー握りつぶし禁止」と明記。

## 注意 3. 認証は人間が直接やる

`gcloud auth login`、`az login`、`gh auth login` のような **対話ログイン** は AI に任せず、自分でやる。

このリポジトリでは、システムプロンプトに「ログインが必要なら `! <command>` を提案する」と明記されており、AI は **ユーザーに代行を促す** 動きをする。

## 注意 4. 認証情報を AI に渡さない

API キー・パスワードを **プロンプトに直接書かない**。`.env` ファイルに置いて、AI には「`.env` を読んで使え」と指示する。

このリポジトリの設定:
```jsonc
// .claude/settings.json — .env 系を書き換えから保護
"PreToolUse": [{ "matcher": "Write|Edit", "hooks": [{
  "command": "case $FILE in *.env|*.env.*) echo BLOCKED; exit 2 ;; esac"
}]}]
```

AI が **誤って `.env` を書き換えたり読んで送信したりするのをフックで阻止**。

## 注意 5. 成果は「diff で」確認する

AI が「実装しました」と言っても、本当に意図通りか:
- `git diff` を読む
- ブラウザで見る（UI なら `/browser-verify`）
- API なら curl で叩く

**実物を確認するまで完了とみなさない**（CLAUDE.md「修正後に動作確認する」を踏襲）。

---

# 第 4 部 — 初心者向け始め方ガイド

## ステップ 1: スキルを使う

このリポジトリには `.claude/skills/` に 31 個のスキルがある。日本語トリガーで呼べる:

| やりたいこと | プロンプト | 動くスキル |
|---|---|---|
| サーバー起動 | "サーバー起動して" | `/dev-server` |
| コミット | "コミットして" | `/commit` |
| プッシュ | "プッシュして" | `/push` |
| デプロイ | "デプロイして" | `/deploy-azure` |
| テスト実行 | "テスト走らせて" | `/test` |
| RAG 検索 | "○○の設計意図を検索して" | `/rag-search` |
| 開発日誌 | "今日の開発日誌書いて" | `/devlog` |

## ステップ 2: スキルがない場合は自然言語で

```
「apps/hono の billing.test.ts だけ走らせて、結果を要約して」
「最近 5 コミットの差分を見て、共通する変更ファイルを教えて」
「prisma schema に updatedAt カラムが既存の全モデルに付いているか確認して」
```

AI がコマンドを組み立てる。失敗しても再度プロンプトで導ける。

## ステップ 3: 結果を「読む」習慣をつける

AI が出力した:
- コマンド（実行前に確認）
- 出力（成功 / 失敗）
- 解釈（AI の要約）

を **3 点セットで読む**。「失敗してるのに成功と要約された」を最初の 1 ヶ月は警戒する。

## ステップ 4: スキルを足す

頻繁にやる作業（毎週の集計・特定の lint 実行・特定の API 叩き）が見えたら、`.claude/skills/` に新しい SKILL.md を足す。

```markdown
---
description: Use when the user asks to ...
---

# {スキル名}

{手順}
```

これで次回から **「{トリガー語}」と打つだけ** で全部やってくれる。

---

# 第 5 部 — まとめ

## CLI 操作を AI 経由でやる利点（10 点）

1. **構文を覚えなくていい** — 日本語で OK
2. **タイポしない** — UUID やフラグの事故が減る
3. **ベストプラクティスが強制** — Skill が規約を守る
4. **状況を読んで適応** — `git status` を見て次を選ぶ
5. **エラー回復が自動** — エラーログを読んで直す
6. **会話ログに残る** — 何を・なぜ・結果が永続化
7. **複数ツール横断** — git + npm + curl + gh が 1 ターン
8. **ガードレールと相性が良い** — CLAUDE.md を AI が読む
9. **反復作業が 1 行** — `/devlog` `/sync-oss` 等
10. **プロジェクト独自スクリプト** — Skill が呼び方を知っている

## 初心者が最初に得られる体験

- **「コマンド怖くない」になる** — タイポと破壊が減る
- **「先輩の手元」を見るように学習** — Skill が手本
- **「環境構築でつまずく」が減る** — `./scripts/dev-start.sh` を AI が呼ぶ
- **「やったことの記録」が残る** — チャットログがそのまま作業履歴

## 注意点（4 つ覚える）

1. 破壊的操作は AI に確認させる
2. 出力を斜め読みしない
3. 認証ログインは自分でやる
4. 認証情報をプロンプトに書かない

## 結論

CLI 操作を全部 AI 経由でやると、**「コマンド習熟度の差」が縮まる**。  
ベテランの「これを `--no-verify` 付けずに `gh pr create` でやる」みたいな手作業が、初心者の「PR 作って」というプロンプトと同じ品質に着地する。

差がつくのは **「何をやらせるか」「結果をどう読むか」**。コマンドを覚える時間を、**判断と検証** に振り分けられるのが本当の利点。
