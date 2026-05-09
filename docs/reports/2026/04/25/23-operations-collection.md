# 運用パターン集 — dev-start.sh / Prisma 二段 / i18n / scheduled & loop

シリーズ: 11-documentation-plan / 関連: 01-guardrails-reproduction / 09-all-tests-overview

## この文書の狙い

このリポジトリで **「壊れずに開発を回す」** ために実装している運用パターンを、4 つの代表例で紹介する:

1. **dev-start.sh** — 開発環境起動の自動化
2. **Prisma 二段運用** — migrate dev / deploy / status の使い分け
3. **i18n 戦略** — Next.js + Hono で ja / en / zh-TW
4. **scheduled & loop** — AI 自身がタイマー処理

---

# 1. dev-start.sh — 開発環境起動の自動化

## 1-1. 目的

ローカル開発の起動を **「`./scripts/dev-start.sh` 1 行」** で完結させる。手動で `npm run dev -w ...` を打つ場面をゼロにする。

## 1-2. やっていること

スクリプト先頭から（`scripts/dev-start.sh`）:

```bash
# 1. 前提条件チェック
command -v node >/dev/null    || err "node が見つかりません"
command -v psql >/dev/null    || err "psql が見つかりません"

# 2. 必須ファイル確認
[ -f apps/hono/.env ]         || err "apps/hono/.env が必要"
[ -f apps/next/.env.local ]   || err "apps/next/.env.local が必要"

# 3. 既存プロセス停止（5 ポート）
for PORT in 3000 5175 5176 5177 8080; do
  PID=$(lsof -ti :$PORT)
  [ -n "$PID" ] && kill $PID
done

# 4. PostgreSQL 確認 + 自動起動
pg_isready -h localhost -p 5432 || brew services start postgresql@16

# 5. DB 接続確認
psql "postgresql://..." -c "SELECT 1;"

# 6. npm install（必要時）

# 7. 全サーバー起動（バックグラウンド）
```

## 1-3. 起動オプション

```bash
./scripts/dev-start.sh           # API + Next.js（最小）
./scripts/dev-start.sh all       # 全 5 サーバー
./scripts/dev-start.sh api next editor preview  # 指定のみ
```

## 1-4. なぜスクリプトに集約するか

「**手動起動の余地を残さない**」ことで:
- 各人が違う方法で起動する事故ゼロ
- 「ポート競合で起動失敗」を自動で解消
- DB 起動忘れを自動検出
- 環境変数ファイル欠落をエラーで止める

`/dev-server` スキル（前書 13）からも呼ばれ、AI が「サーバー起動して」のひと言で正しいスクリプトを叩く。

## 1-5. 教訓

- **「個々のコマンドを覚える」ではなく「1 つのスクリプトを覚える」**
- ヘルスチェック付きで「起動したつもり」を防ぐ
- スキル経由で AI と共有

---

# 2. Prisma 二段運用 — migrate dev / deploy / status

## 2-1. 結論

```
ローカル開発: prisma migrate dev      （履歴付きマイグレ生成）
本番デプロイ: prisma migrate deploy   （履歴を本番に適用）
CI 検出:      prisma migrate status   （未適用検出）
```

## 2-2. 各コマンドの役割

| コマンド | 用途 | 履歴 |
|---|---|---|
| `migrate dev --name xxx` | ローカルでスキーマ変更時 | 新規生成 |
| `migrate deploy` | CI / 本番で履歴を適用 | 既存を読む |
| `migrate status` | 未適用マイグレを検出 | 読み取り |
| `db push` | seed や検証で即反映 | **履歴なし** |

## 2-3. ローカル開発フロー

```
1. prisma/schema.prisma を編集（カラム追加など）
2. npx prisma migrate dev --name add_player_stamina
   → migrations/20260422.../migration.sql が生成される
   → 自動でローカル DB に適用
   → prisma generate で型再生成
3. コード側を直す（型エラーで導かれる）
4. テスト pass
5. コミット（migration ファイル含む）
```

## 2-4. CI フロー（`.github/workflows/ci.yml`）

```yaml
- run: npx prisma migrate deploy
- name: Check for pending migrations
  run: |
    STATUS=$(npx prisma migrate status 2>&1)
    if echo "$STATUS" | grep -q "have not yet been applied"; then
      echo "::error::Pending Prisma migrations detected."
      exit 1
    fi
- run: npm test -w @kaedevn/hono
```

`migrate deploy` の **後に migrate status** を確認する。これで:
- 既存マイグレが全部適用された
- 「ローカルで `migrate dev` を忘れた」差分を検出

## 2-5. schema-sync テストとの二重防衛

`apps/hono/test/schema-sync.test.ts`（前書 09）:

```ts
await expect(prisma.user.findFirst()).resolves.not.toThrow();
```

`findFirst()` は schema に書かれた **全カラムを SELECT** する。DB に無ければ実行時エラー。これが **migrate 漏れを実際に動かして検出**。

migrate status（静的検出）+ schema-sync（動的検出）の **二重防衛**。

## 2-6. なぜ二段なのか

`prisma migrate dev` を本番で打つと:
- ローカル変更の **shadow DB** を勝手に作る → 危険
- 履歴が壊れる可能性

`migrate deploy` は:
- **既存の migrations/ を読むだけ**
- 副作用を最小化

開発時 = `dev`、本番時 = `deploy`、と **コマンドを分ける** ことで事故を防ぐ。

---

# 3. i18n 戦略 — Next.js + Hono で ja / en / zh-TW

## 3-1. 結論

`packages/i18n/` に共通実装、`apps/next/lib/i18n/` と `apps/hono/src/lib/i18n.ts` が両方使う。

```
apps/next/lib/i18n/
├── ja.json
├── en.json
├── zh-TW.json
└── index.ts
```

## 3-2. キーベースの翻訳

```json
{
  "landing": {
    "subtitle": "ノベル × RPG × 3D 統合プラットフォーム",
    "tagline": "ブラウザで作る、ブラウザで遊ぶ"
  }
}
```

UI コードからは `t('landing.subtitle')` で参照。**ハードコード文字列禁止**。

## 3-3. なぜ `apps/next` と `apps/hono` の両方で

- **Next.js**: ランディング・ポータル UI の文言
- **Hono**: API エラーメッセージ（`「セッションが切れました」` を ja/en/zh-TW で）

両者で同じ翻訳源を使うため、`packages/i18n/` に共通実装。

## 3-4. AI による多言語追従

実観測（4/20 ランディング更新時）:

```
ユーザー: 「ランディングを VRM/Live2D 訴求に追従して」
   ↓
AI が ja.json を更新
   ↓
AI が en.json / zh-TW.json も同時に翻訳して更新
   ↓
1 コミットで 3 言語反映
```

**多言語のばらつきを生まない** のは AI が一括処理するから。手作業だと「ja だけ更新、en は数日遅れ」が起きる。

## 3-5. テストでの言語チェック

`tests/shared/auth/auth-flow.spec.ts` などが **ja-JP** で動く。Playwright config で:

```ts
use: { locale: 'ja-JP' }
```

これがないと Chromium デフォルト（en-US）で日本語セレクタが見つからずテストが落ちる（前書 09 D の項参照）。

---

# 4. scheduled / loop パターン — AI 自身がタイマー処理

## 4-1. 結論

Claude Code には `/schedule` `/loop` スキルがあり、**AI が自分でカレンダーやタイマーを管理** できる。

```
ユーザー: 「2 週間後に Capacitor フラグ削除 PR を出して」
   ↓
/schedule が cron 式で予約
   ↓
2 週間後、自動で Claude Code エージェントが起動 → PR 作成
```

```
ユーザー: 「5 分ごとにデプロイ状況を確認して」
   ↓
/loop が定期実行
   ↓
5 分ごとに Claude Code が `gh run list` 等を実行 → 状況をチャットに報告
```

## 4-2. ユースケース

- **フィーチャーフラグ削除のリマインダ**: 2 週間後の自動 PR
- **長時間ビルドの監視**: 5 分ごとに進捗確認
- **データ集計の定期実行**: 毎週月曜の朝に集計レポート
- **TODO の期限到来**: 「remove once X」の自動消化

## 4-3. 自律性の境界

`/schedule` は **専用の安全境界** が用意されている:
- 認証 token の管理
- 実行ログの保存
- destructive 操作の制限

ただし完全自律ではなく、**重要操作は人間確認** を求める設計。

## 4-4. CLAUDE.md の指針

「終わった作業に**自然な future follow-up**があれば、`/schedule` を提案」と AI が誘導される（システムプロンプト内）:

> Strong signals: a feature flag / gate / experiment / staged rollout was just shipped (offer a one-time agent in ~2 weeks to open a cleanup PR or evaluate results), a new alert/monitor was created (offer a recurring agent to triage it), ...

つまり **「何かをリリースした → 2 週間後にクリーンアップ」** のような時間性を持つ作業を、AI が自発的に提案する。

---

# 5. 4 つの運用パターンの共通点

| 観点 | パターン |
|---|---|
| **手動を撲滅** | dev-start.sh で起動コマンド統一 |
| **二重防衛** | migrate status + schema-sync テスト |
| **同時更新** | i18n 3 言語を AI 一括で |
| **時間性のある作業** | scheduled / loop で予約・反復 |

共通テーマ: **「人間が忘れるところを仕組みで守る」**。dev-start.sh はポート停止忘れ、Prisma 二段はマイグレ忘れ、i18n は翻訳忘れ、scheduled は将来の作業忘れを救う。

---

# 6. 自分のプロジェクトへの移植

### dev 起動スクリプト
- `scripts/dev-start.sh` を作る
- 前提チェック → ポート停止 → DB 起動 → npm install → サーバー起動
- スキル経由で AI が呼べる形に

### Prisma 二段
- ローカル: `migrate dev`
- CI: `migrate deploy` + `migrate status` チェック
- schema-sync テストで実 DB 検証

### i18n
- 翻訳ファイル `{ja, en, ...}.json` をリポジトリに置く
- API も同じ仕組みで多言語化
- 翻訳追従は AI に任せる（プロンプトで「3 言語同時に」と頼む）

### scheduled / loop
- Claude Code の `/schedule` を使う
- 「フラグ削除」「長期間処理の監視」を提案する文化

---

## まとめ

- **dev-start.sh** で起動コマンド統一、5 ポート自動停止 + DB 起動 + 環境変数チェック
- **Prisma 二段運用** で migrate dev / deploy / status を使い分け、CI で migrate 漏れ検出
- **i18n 戦略** で Next.js + Hono 両方を `packages/i18n/` で共通化、AI が 3 言語同時更新
- **scheduled / loop** で AI 自身が時間性のある作業をハンドル

「**自動化 + 二重防衛 + AI 連動**」が本リポジトリの運用思想。**人間が覚えなくて良いことを増やす**ことが運用品質の鍵。
