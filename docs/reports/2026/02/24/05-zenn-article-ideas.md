# Zenn 投稿ネタ一覧

278 コミット・68 レポートから抽出。タイトルと概要のみ。
この文書自体の作成手順も G パターンとして収録。
ソースコード・ドキュメントは全てリポジトリに存在する。

---

## A: 実装レポート

### A-01: .ksc インタプリタを TypeScript で 7 フェーズに分けて実装した全記録 (12,000字)
Phase 1（Parser・セリフ）→ Phase 7（デバッグ・統合テスト）まで。193 テスト。
ソース: `packages/interpreter/`, `docs/09_reports/2026/02/24/02-interpreter-implementation-report.md`

### A-02: Stack-based VM を TypeScript で実装した — .ksc コンパイラ Phase 4 (8,000字)
Lexer → Parser → IR Emitter → VM の 4 段パイプライン。69 テスト追加で全 315 テスト通過。
ソース: `packages/compiler/`, コミット `6d61053`

### A-03: ブラウザで動くビジュアルノベルエンジンを PixiJS + TypeScript で作った (10,000字)
WebEngine（IEngineAPI 実装 384 行）。背景・キャラ・セリフ・選択肢が全部ブラウザで動く。
ソース: `packages/web/`, `docs/2026/02/09/Browser_Integration_Phase1-2_Complete.md`

### A-04: コマンドバトルシステムを VN エンジンに組み込んだ設計と実装 (8,000字)
RPG 風バトルをノベルゲームエンジンに統合。仕様書 → 設計書 → UI 設計 → 実装。
ソース: `docs/09_reports/2026/02/21/01-battle-spec.md` 〜 `04-battle-ui-design.md`

### A-05: Tween ベースのシーク可能タイムラインシステムを実装した (6,000字)
カメラワーク・エフェクトを JSON で定義して再生。シーク・ループ対応。
ソース: コミット `2e664c6`, `docs/09_reports/2026/02/19/timeline-spec.md`

### A-06: Asset 管理システムを Phase 1-7 で実装した — 3 階層分類・ユーザーアセット (10,000字)
カテゴリ → サブカテゴリ → タグの 3 段階フィルター。公式アセットインポート機能。
ソース: コミット `fe2ee1c`, `docs/09_reports/2026/02/23/09-asset-management-spec.md`

### A-07: FlagSystem + InventorySystem を .ksc ランタイムに追加した (5,000字)
ゲーム進行フラグとアイテム管理。Phase 6.1 実装。
ソース: コミット `ecb4308`

### A-08: ブロックカード形式のノベルゲームエディタを React で作った (10,000字)
テキスト → 選択肢 → IF 文 → 変数設定をカード UI で編集。ドラッグ&ドロップ対応。
ソース: `apps/editor/`, コミット `7f67775`

### A-09: エディタのダークモード完全対応 — 全コンポーネントの色トークン統一 (6,000字)
カラートークン一元化 + CardShell 共通化 + 3 段階レスポンシブ対応。
ソース: コミット `8967cd2`, `dc80d90`

### A-10: KSC コンパイラを Phase 0 から Phase 5 まで一気に実装した (15,000字)
Lexer → Parser → TypeChecker → IR Emitter → VM → WebOpHandler。315 テスト。
ソース: `packages/compiler/`, コミット `19a2d53` 〜 `ea3e4d3`

### A-11: ConsoleEngine + TestEngine — OSS 利用者向け IEngineAPI 実装 2 種 (6,000字)
ConsoleEngine（コンソール出力）と TestEngine（状態管理テスト用）。計 59 テスト。
ソース: `packages/interpreter/src/engine/`

### A-12: 選択肢ブロックと IF 文ブロックをエディタに実装した (6,000字)
ChoiceBlock + SetVarBlock + IF 文のネスト編集。モバイルでも編集可能。
ソース: コミット `e1e3863`, `a2e480f`

---

## B: 設計解説

### B-01: IEngineAPI — 17 メソッドのプラットフォーム抽象化層を設計した理由 (8,000字)
Web / Console / Switch / Test の 4 実装を同じインターフェースで動かす設計判断。
ソース: `packages/interpreter/docs/spec-engine-api.md`

### B-02: Monorepo で VN エンジンを設計した — editor + API + interpreter + compiler + web (10,000字)
6 パッケージの依存関係、ビルド順序、Azure デプロイまでの全体設計。
ソース: `CLAUDE.md`, `package.json`

### B-03: .ksc 言語を設計した — VN 専用スクリプト言語の文法とトレードオフ (10,000字)
セリフブロック `#speaker...#`、choice 構文、def/sub 分離、文字列補間の設計意図。
ソース: `packages/interpreter/docs/spec-ksc-language.md`

### B-04: インタプリタのパイプライン設計 — テキスト→行分類→パース→評価の 4 段階 (8,000字)
Parser（行分類 6 種別）→ Tokenizer → Evaluator（再帰下降）→ Engine 呼び出し。
ソース: `packages/interpreter/docs/design-architecture.md`

### B-05: エラーハンドリング設計 — Levenshtein 距離で「もしかして: xxx」を出す (6,000字)
5 種のエラー、修正候補アルゴリズム、スタックトレース、コンテキスト表示。
ソース: `packages/interpreter/docs/spec-error-handling.md`

### B-06: デバッグシステム設計 — ブレークポイント・変数ウォッチ・ステップ実行 (7,000字)
Debugger クラスのイベントシステム、条件付きブレークポイント、トレースログ。
ソース: `packages/interpreter/docs/design-debug-system.md`

### B-07: セーブデータスキーマを凍結した設計判断 (5,000字)
参照 ID のみ（画像/音声を埋め込まない）、`save_schema_version` でバージョン管理。
ソース: `CLAUDE.md` の Save Schema セクション

### B-08: 3 カラムレイアウト + ブロック選択時プレビュー連動の設計 (7,000字)
エディタの UI 設計。ブロック選択 → プロパティパネル → エンジンプレビューの連動。
ソース: コミット `5098b65`, `docs/09_reports/2026/02/20/three-column-layout.md`

### B-09: Op[] 統一ランタイム設計 — ScriptCommand 形式を完全廃止した理由 (6,000字)
旧形式から Op 配列への移行。コンパイラとインタプリタの出力統一。
ソース: コミット `a14c0ab`

### B-10: Asset 分類リストラクチャ — カテゴリ→サブカテゴリ→タグの 3 階層設計 (6,000字)
フラットなタグから 3 階層へ。フィルター UI の設計判断。
ソース: `docs/09_reports/2026/02/23/11-asset-taxonomy-restructure-spec.md`

---

## C: Claude Code 協働メソッド

### C-01: CLAUDE.md でコンテキストを設計する — AI 出力品質を左右する 1 ファイル (8,000字)
プロジェクト概要、アーキテクチャ、ルール、ポート設定を 1 ファイルに集約。
ソース: `CLAUDE.md`

### C-02: 24 ファイル・5,000 行のドキュメントを依存順に生成した方法 (10,000字)
用語集 → 要求仕様 → 言語仕様 → 設計書 → ガイドの順で Phase A〜E で生成。
ソース: `packages/interpreter/docs/oss-docs-plan.md`, コミット `7db78c5`

### C-03: 「進んで」「テストして」で AI を自走させる — 短い指示の技術 (6,000字)
指示の粒度と出力品質の関係。コンテキストが整っていれば 2 文字で動く実例。
ソース: 本セッションのログ

### C-04: Claude Code skills を設計して開発を自動化した (7,000字)
commit / deploy-azure / save-report / sync-oss / zenn の 5 スキル。
ソース: `.claude/skills/`

### C-05: フライホイール効果 — ドキュメントが AI 精度を上げ、AI がドキュメントを生成する (8,000字)
docs/ のファイル数と生成速度・正確性の相関。67 ファイル → 600KB の成長過程。
ソース: `packages/interpreter/docs/`, `docs/09_reports/`

### C-06: 278 コミット・1 週間・人間のコード 0 行 — Claude Code だけで PF を作った (12,000字)
全コミットが Claude Code 生成。15 万行のビジュアルノベル PF。
ソース: `docs/09_reports/2026/02/23/08-zenn-1week-145commits-zero-human-code.md`

### C-07: Claude Code のコミットメッセージに「感想」を書かせる仕組み (5,000字)
commit スキルに「Claude の一言（必須）」ルールを追加。ゆるいトーンで正直な感想。
ソース: `.claude/skills/commit/skill.md`

### C-08: monorepo → OSS リポジトリの同期を Claude Code スキルで自動化した (5,000字)
rsync + 機密チェック + git add 制限を 1 スキルに集約。
ソース: `.claude/skills/sync-oss/skill.md`

---

## D: Claude Code 実践ログ

### D-01: 実践ログ — ConsoleEngine + TestEngine を 1 セッションで実装・テスト・ドキュメント (8,000字)
IEngineAPI の 2 実装を作成、59 テスト、6 ドキュメント更新。
ソース: 本セッションのログ

### D-02: 実践ログ — サンプルスクリプト 8 本を整理・新規作成 (5,000字)
ファイル名リネーム + 4 本新規作成 + 全参照更新。
ソース: 本セッションのログ

### D-03: 実践ログ — KSC コンパイラ Phase 0→5 を連続実装 (12,000字)
Lexer → Parser → TypeChecker → IR → VM → WebOpHandler を数セッションで。
ソース: コミット `19a2d53` 〜 `ea3e4d3`

### D-04: 実践ログ — エディタ モバイル UX を Phase 1→3 で改善 (8,000字)
ボトムシート化 → タッチ最適化 → リッチ化。iOS Safari フルスクリーン対応含む。
ソース: コミット `c0ebade` 〜 `62f6f16`

### D-05: 実践ログ — Azure Container Apps に 4 サービスをデプロイ (7,000字)
api / editor / nextjs / preview の Docker ビルド → ACR → デプロイ自動化。
ソース: `scripts/deploy-azure.sh`, `docs/09_reports/2026/02/18/azure-container-apps-release.md`

### D-06: 実践ログ — セキュリティ強化を 1 セッションで実施 (6,000字)
レートリミット・JWT 検証・所有者検証・Cookie 同意を一括実装。
ソース: コミット `26735d8`, `docs/09_reports/2026/02/19/release-readiness-audit.md`

### D-07: 実践ログ — Asset 管理 Phase 1-7 を実装 (10,000字)
DB スキーマ → API → フロント → 3 階層フィルター → 公式インポートまで。
ソース: コミット `fe2ee1c`, `docs/09_reports/2026/02/23/12-asset-management-plan.md`

---

## E: OSS ドキュメント戦略

### E-01: 個人 OSS で 30 ファイルのドキュメントを AI と整備した戦略 (8,000字)
要求仕様 → 言語仕様 → 設計書 → ガイド → テスト → リファレンスの依存順生成。
ソース: `packages/interpreter/docs/`, `packages/interpreter/docs/oss-docs-plan.md`

### E-02: README を OSS の「顔」にする — スクショ・リンク・サンプルの配置設計 (5,000字)
日本語 README + デモスクショ + ドキュメントリンクテーブル + サンプル一覧。
ソース: kaedevn OSS リポジトリの `README.md`

### E-03: Fork 推奨・PR 拒否の OSS 公開スタイル (5,000字)
monorepo → OSS への一方通行同期。CONTRIBUTING.md を Fork ガイドに書き換え。
ソース: kaedevn OSS リポジトリの `CONTRIBUTING.md`

---

## F: Monorepo 運用

### F-01: 6 パッケージ・4 サーバーを 1 リポジトリで管理する Monorepo 運用 (8,000字)
editor(5176) + API(8080) + Next.js(3000) + preview(5175) の同時起動。
ソース: `CLAUDE.md`, `scripts/dev-start.sh`

### F-02: Azure Container Apps に Monorepo から 4 サービスをデプロイする自動化 (7,000字)
deploy-azure.sh 1 本で ACR ビルド → Container Apps 更新。
ソース: `scripts/deploy-azure.sh`, `.claude/skills/deploy-azure/skill.md`

### F-03: Playwright E2E テストと日付別スクリーンショット管理 (5,000字)
テスト失敗時のスクリーンショットを日付フォルダで自動保存。
ソース: コミット `53b10b1`, `.claude/skills/playwright-e2e-test/`

### F-04: State の配置ルール — React の共通最小祖先を徹底する (5,000字)
兄弟コンポーネント間の state 共有ルールを CLAUDE.md に明文化。
ソース: コミット `26e6f14`, `docs/09_reports/2026/02/20/todo.md`

---

## G: メタ（この文書自体の作り方）

### G-01: 278 コミットから 38 本の記事ネタを Claude Code で抽出した手順 (8,000字)
`git log` 全件 + `docs/09_reports/` 68 レポートを Claude Code に読ませてネタ一覧を生成。
パターン分類 → タイトル・概要 → ソースファイル紐付け → 予想文字数の順で作成。
ソース: `docs/09_reports/2026/02/24/05-zenn-article-ideas.md`（この文書自体）

---

## 合計: 39 ネタ・予想合計 343,000 字

| パターン | 本数 | 予想合計字数 |
|---|---|---|
| A: 実装レポート | 12 | 102,000 |
| B: 設計解説 | 10 | 73,000 |
| C: Claude Code 協働 | 8 | 61,000 |
| D: 実践ログ | 7 | 56,000 |
| E: OSS ドキュメント戦略 | 3 | 18,000 |
| F: Monorepo 運用 | 4 | 25,000 |
| G: メタ | 1 | 8,000 |
| **合計** | **39** | **343,000** |
