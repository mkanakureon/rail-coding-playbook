---
generated_by: Gemini CLI (CAO Mode)
date: 2026-04-01
type: security-audit
target: docs/10_ai_docs, docs/09_reports
status: ACTION_REQUIRED_BEFORE_OSS
---

# OSS公開に向けたセキュリティ・プライバシー監査レポート

`docs/10_ai_docs` および `docs/09_reports` をOSSとして公開するにあたり、リポジトリ内のテキストデータを監査した結果、以下の修正が必要な項目を検出しました。
これらは致命的な本番キーの流出ではありませんが、ローカル環境の情報漏洩や、ベストプラクティス違反に該当するため、公開前に一括置換（サニタイズ）が必要です。

## 1. ローカル絶対パス（ユーザー名の漏洩）
AIが生成したレポートやパス指定の中に、開発者のローカルMacの絶対パスが多数含まれており、ユーザー名（`kentaromukunasi`）が露出しています。

**【検出されたパターン】**
- `<PROJECT_ROOT>/...`

**【修正方針】**
すべての該当箇所をプロジェクトルートからの相対パス、またはプレースホルダーに置換する。
- 修正後: `<PROJECT_ROOT>/...` または `./...`

**【主な該当ファイル】**
- `docs/10_ai_docs/2026/03/12/04-FINAL_HANDOVER_FOR_CLAUDE_CODE.md`
- `docs/10_ai_docs/2026/03/11/03-FEW_SHOT_TRANSITION_PLAN.md`
- `docs/10_ai_docs/2026/03/10/17-SETTING_REFINEMENT_REVIEW_REPORT.md`
- その他多数

## 2. データベース接続文字列とパスワード
ローカル開発用のダミーデータとはいえ、パスワードを含む接続文字列が平文でドキュメントに記載されています。

**【検出されたパターン】**
- `postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev`
- テスト用ログイン情報: `mynew@test.com` / `DevPass123!` (CLAUDE.md 等にも記載あり)

**【修正方針】**
パスワード部分をマスキングするか、環境変数の参照例に書き換える。
- 修正後: `postgresql://kaedevn:<YOUR_PASSWORD>@localhost:5432/kaedevn_dev`

**【主な該当ファイル】**
- `docs/10_ai_docs/2026/03/10/15-ASSET_SEARCH_CLI_GUIDE.md`
- `CLAUDE.md`

## 3. APIキーのダミー記載
設計書の中に、AIサービスのAPIキーのフォーマットが記載されています。実キーではありませんが、コピペミスを誘発する可能性があるためプレースホルダー化が推奨されます。

**【検出されたパターン】**
- `OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>...`
- `ANTHROPIC_API_KEY=<YOUR_ANTHROPIC_API_KEY>...`

**【修正方針】**
- 修正後: `OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>`

**【主な該当ファイル】**
- `docs/09_reports/2026/02/25/10-rag-implementation-plan.md`
- `docs/09_reports/2026/02/25/11-author-assist-multi-stage-spec.md`

## 4. Azure インフラ情報の記載
構成図や設計書に Azure のデプロイトークン名や、構成の詳細が記載されています。これ自体はアーキテクチャの解説として問題ありませんが、実際の `Tenant ID` や `Subscription ID` などが他のファイルに紛れ込んでいないか、公開前に再度 `az` コマンドの出力ログ等をチェックすることを推奨します。

---

## 公開前の修正スクリプト提案

公開用リポジトリに `push` する前に、以下のコマンドをルートディレクトリで実行することで、主要なパス漏洩を一括でサニタイズできます。

```bash
# ユーザー名の絶対パスを <PROJECT_ROOT> に置換 (macOS用 sed)
find docs -type f -name "*.md" -exec sed -i '' 's|<PROJECT_ROOT>|<PROJECT_ROOT>|g' {} +

# DBパスワードのサニタイズ
find docs -type f -name "*.md" -exec sed -i '' 's|<YOUR_DB_PASSWORD>|<YOUR_DB_PASSWORD>|g' {} +
```

---
*監査実行: Gemini CLI (CAO Mode)*
*Date: 2026-04-01*
