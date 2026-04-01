---
generated_by: Gemini CLI (CAO Mode)
date: 2026-04-01
type: playbook-chapter
target: General TypeScript Projects
chapter: Appendix (AI Configuration & Skills)
---

# 【決定版】汎用・超自律型「AI日産1万行」実現プレイブック (第3部: AI設定・スキル完全リファレンス)

本ドキュメントは、「1日1万行」の自律開発を支える2体のAIエージェント（Claude Code / Gemini CLI）の**具体的な設定（憲法）と、付与されているカスタムスキルの一覧**である。
他プロジェクトで再現する際、これらの設定ファイルとスキル群を移植することで、同等の自律環境を構築できる。

---

## 1. AIエージェントの憲法（System Prompts）

AIエージェントは起動時に必ず特定のマークダウンファイルを読み込み、それを「絶対の掟（憲法）」として行動する。

### 1.1 `CLAUDE.md`（実装担当：The Doer）
Claude Code（実装エージェント）の行動を縛るファイル。**「どう実装すべきか」**と**「触ってはいけない領域」**を定義する。

**【現在の主要な設定項目】**
- **Core Abstractions**: `IInput`, `IAudio`, `IStorage` などの抽象化レイヤーのリスト。これらを直接叩くコード（例：`localStorage.setItem`）を書くことを固く禁ずる。
- **Change Zones（変更境界）**: 
  - **Aゾーン（自由）**: UIの見た目、文言、テスト。
  - **Bゾーン（条件付き）**: APIクライアント、Store。型チェックとテストが必須。
  - **Cゾーン（設計境界）**: コアエンジン、抽象化インターフェース。変更時は「Design Change Note（設計変更理由）」の明記を必須とする。
- **New Abstraction Rules**: 新しい共通関数やフックを作る際の条件（3箇所以上にあるか、名がつく概念か等）。勝手な独自ルールの乱立を防ぐ。

### 1.2 `GEMINI.md`（監査担当：The Auditor / CAO）
Gemini CLI（監査エージェント）の行動を縛るファイル。**「どう疑うべきか」**を定義する。

**【現在の主要な設定項目】**
- **CAO (Chief Audit Officer) Mandate**: AIは「人間は自分のコードを一行も読まない」という前提に立ち、論理、数学、構造の正しさを自律的に証明・報告する義務を負う。
- **3-Layer Audit**:
  - Layer 1 (数学的・性能): 計算量の爆発（O(n^2)など）やリソースの非効率を告発する。
  - Layer 2 (アーキテクチャ): レイヤー間の不適切な依存（UIから直接DBを触るなど）を排除する。
  - Layer 3 (自己批判的リスク分析): 実装完了後、「自らのコードの弱点（負のパターン）」を最低3項目挙げる。
- **Strict Write Restriction**: 監査レポートを保存する `docs/10_ai_docs/` ディレクトリ以外へのファイル書き込みを**厳格に禁止**する。

---

## 2. カスタムスキル完全リファレンス (Exhaustive Skill List)

このプロジェクトには、AIが自律的に開発・運用を行うための**40種類以上のカスタムスキル**が配備されている。これらを役割別に分類し、全リストを掲載する。

### 2.1 開発・コア操作系 (Development & Core Ops)
日常的なコーディングとバージョン管理を自動化する。

- **`commit` / `safe-commit`**: 変更解析、メッセージ自動生成、Lint/型チェックを伴うコミット。
- **`push`**: リモートリポジトリへの同期。
- **`pr`**: プルリクエストの自動作成・説明文生成。
- **`sync-main`**: 最新の main ブランチの同期とマージ。
- **`dev-server` / `kaedevn-dev-server`**: ローカル開発環境の起動・管理。
- **`test` / `playwright-test` / `playwright-e2e-test`**: 単体・結合・E2Eテストの実行とエラー分析。
- **`browser-verify`**: 実際にブラウザで描画を確認する。
- **`prisma-migrate`**: DBスキーマ変更の適用。

### 2.2 監査・ドキュメント系 (Audit & Documentation)
知見の永続化と品質の保証を行う。

- **`save-report`**: CAO監査結果、調査報告の `docs/10_ai_docs/` への保存。
- **`rag` / `rag-ops` / `rag-search`**: 膨大な仕様書や障害履歴からの高度な情報検索。
- **`review-and-issue`**: コードレビューを行い、改善点を GitHub Issue として起票。
- **`devlog` / `progress-log`**: 日次開発履歴（日記）の自動生成。
- **`broken-memo`**: 解決が必要な「TODO」「設計の歪み」のメモ管理。

### 2.3 プロダクト・ドメイン系 (RPG/Novel Specific)
プロジェクト固有のデータ（アセット、マップ、シナリオ）を操作する。

- **`asset` / `sync-official-assets`**: 画像・音声アセットの管理と公式同期。
- **`character`**: キャラクター設定・表情差分の管理。
- **`map`**: マップデータの構造解析と編集。
- **`edit-blocks`**: シナリオブロックの論理編集。
- **`ks-editor`**: スクリプトエディタとの同期ロジック。
- **`rpg-preview`**: RPGツクール的なプレビュー機能の起動。
- **`create-project`**: 新規作品のテンプレート展開。

### 2.4 インフラ・デプロイ系 (Cloud & Infra)
クラウド環境（Azure等）への配備を自動化する。

- **`deploy-azure`**: Azure Container Apps 等への本番デプロイ。
- **`test-azure`**: クラウド環境での疎通確認・スモークテスト。
- **`sync-oss`**: OSS公開用リポジトリへの同期。

### 2.5 専門ガイドライン・ベストプラクティス (Guideline Enforcement)
特定のタスク時にAIが追加ロードする知識ベース。

- **`web-design-guidelines`**: アクセシビリティ・UX制約の遵守。
- **`vercel-react-best-practices`**: パフォーマンス最適化。
- **`vercel-composition-patterns`**: コンポーネント設計の保守性。
- **`check-layout`**: 1280x720 画面レイアウト制約の検証。

### 2.6 広報・外部連携系 (External Outreach)
開発した成果を外部へ発信する。

- **`qiita` / `zenn`**: 開発知見の技術記事投稿（下書き生成）。
- **`youtube-upload`**: デモ動画のアップロード管理。
- **`stream`**: 実況モードや配信連携。
- **`narrate`**: 作業内容のテキスト実況（VTuberモード）。

---

## 3. なぜこれほど多くの「スキル」が必要なのか？
...（以下、既存の解説へ続く）

---
*設計・整理：Gemini CLI (CAO)*
*Authorized by kaedevn-monorepo Project Base*
