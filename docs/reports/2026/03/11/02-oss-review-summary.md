# kaedevn OSS 化検討 — 過去の議論と現状まとめ

> 2026-03-11 作成。過去にAI（Gemini / Claude）との対話で出てきたOSS公開の検討結果を一本にまとめる。

---

## 1. リポジトリの現在規模

| カテゴリ | ファイル数 | 行数 | 備考 |
|---------|-----------|------|------|
| **apps/editor** | 100 | 17,752 | GUIエディタ（React/Vite） |
| **apps/hono** | 142 | 35,711 | バックエンドAPI |
| **apps/next** | 82 | 11,461 | Auth/管理画面 |
| **apps/ksc-editor** | 17 | 1,298 | KSCスクリプトエディタ |
| **packages/core** | 34 | 5,605 | 型定義・インターフェース |
| **packages/web** | 71 | 11,676 | PixiJS描画エンジン |
| **packages/compiler** | 34 | 3,763 | KSコンパイラ |
| **packages/ksc-compiler** | 22 | 7,467 | KSCコンパイラ |
| **packages/interpreter** | 34 | 8,142 | KNFインタープリタ |
| **packages/ai-gateway** | 16 | 1,404 | LLM抽象化 |
| **packages/battle** | 14 | 836 | バトルエンジン |
| **scripts/** | 22 | 3,476 | 開発支援 |
| **tests/** | 72 | 15,025 | E2E/ユニットテスト |
| **TS/JS 合計** | **~660** | **~123,600** | |
| **packages/native-engine** | 6,637 | ~500,000 | C++/SDL2（Switch/iOS/Android） |
| **docs/ (Markdown)** | 986 | ~208,000 | 設計書・レポート・記事 |

- **コミット数**: 714（2026-02-07 開始、約1ヶ月）
- **開発者**: 1名（+ AI: Claude Code / Gemini）

---

## 2. 過去の検討文書一覧

| 文書 | 日付 | 内容 |
|------|------|------|
| `docs/11_old/CODE_REUSABILITY_ANALYSIS.md` | 02-17 | コード再利用可能性分析（30,000行時代） |
| `docs/10_ai_docs/2026/03/02/12-OSS_FOLDER_STRUCTURE_DEFINITION.md` | 03-02 | OSS版 `kaedevn-studio` のディレクトリ構造定義 |
| `docs/10_ai_docs/2026/03/02/14-AI_CENTRIC_MONOREPO_STRATEGY.md` | 03-02 | 統合モノレポ＋OSSミラー戦略 |
| `docs/10_ai_docs/2026/03/02/15-COMMIT_LOG_SYNC_STRATEGY.md` | 03-02 | コミットログの公開範囲管理 |
| `docs/10_ai_docs/2026/03/02/17-CODE_SECURITY_STRATEGY.md` | 03-02 | ソースコード流出防止の物理分離戦略 |
| `docs/10_ai_docs/2026/03/02/18-CLOUD_EDITOR_STRATEGY.md` | 03-02 | Cloud Editor の公開/非公開分離 |
| `docs/10_ai_docs/2026/03/02/34-OSS_STRUCTURAL_ISSUES_REPORT.md` | 03-02 | OSS公開に向けた構造的課題レポート |
| `docs/09_reports/2026/03/10/11-switch-porting-estimate.md` | 03-10 | Switch移植コード量見積もり |

---

## 3. 議論の要約

### 3-A. リポジトリ構成の選択肢

3つのアプローチが検討された。

#### (1) 統合モノレポ + OSSミラー（文書14）
- 開発は非公開モノレポで一元管理
- `oss-dist/` ディレクトリだけを公開リポジトリに自動同期
- **利点**: AIエージェントが全体を把握したまま横断修正できる
- **欠点**: 同期スクリプトの保守、機密漏洩リスクの管理

#### (2) 物理分離（文書17）
- `kaedevn-oss`（Public）と `kaedevn-cloud`（Private）を完全に分離
- 非公開→公開の一方向依存のみ
- **利点**: 機密漏洩が物理的に不可能
- **欠点**: AI開発時のコンテキスト分断

#### (3) 現状維持（非公開モノレポのまま）
- 今のまま `kaedevn-monorepo` を Private で開発続行
- OSS化は部分的に（interpreterだけ等）
- **利点**: 開発効率最大、移行コストゼロ
- **欠点**: コミュニティ貢献を受けられない

### 3-B. OSS化の構造的課題（文書34）

| 課題 | 深刻度 | 状況（3/11時点） |
|------|--------|----------------|
| 5層パイプラインの垂直断絶 | 高 | **改善済み**: `commandRegistry.ts` でレジストリ・ドリブン化 |
| バックエンドのクラウド密結合 | 高 | **未着手**: Azure Blob / PostgreSQL 直結のまま |
| スクリプト生成ロジック重複 | 中 | **部分改善**: `getBlockScript` / `buildSnapshotScript` に集約中 |
| サイレント失敗するコンパイラ | 中 | **改善済み**: Levenshtein 提案・スタック追跡つきエラー |

### 3-C. OSS版の公開範囲（文書12）

`kaedevn-studio` として公開する予定のパッケージ:

| 公開対象 | 内容 |
|---------|------|
| `apps/editor` | GUIエディタ |
| `apps/hono-local` | ローカルファイルAPI（Azure依存なし） |
| `packages/core` | 型定義・インターフェース |
| `packages/web` | PixiJS描画エンジン |
| `packages/interpreter` | KNFインタープリタ |
| `packages/compiler` | KSコンパイラ |
| `packages/ksc-compiler` | KSCコンパイラ |
| `packages/battle` | バトルエンジン |

**非公開のまま**:

| 非公開 | 理由 |
|--------|------|
| `apps/hono`（クラウド版） | Azure/Prisma/認証ロジック |
| `apps/next` | プラットフォーム管理画面 |
| `packages/native-engine` | Switch/iOS/Android ネイティブ |
| `packages/ai-gateway` | LLM API キー・プロンプト |

### 3-D. コミットログの扱い（文書15）

3つの選択肢が提案された:

1. **Squash**: 複数コミットを1つに集約。安全だが経緯が消える
2. **Subtree Split**: ディレクトリ単位で履歴を分離。透明だが漏洩リスク
3. **AI-Summarized**（推奨）: AIがコミットメッセージを監査・書き換え

### 3-E. コード再利用率（文書 CODE_REUSABILITY_ANALYSIS）

| プラットフォーム | 再利用率 | 新規作成 |
|-----------------|---------|---------|
| Web本番 | 95% | 5%（設定・最適化のみ） |
| Nintendo Switch | 63% | 17%（レンダリング層） |

コアロジック（core / compiler / interpreter）は **100% 再利用可能**。Switch で新規作成が必要なのはレンダリング層のみ。

---

## 4. 現時点の判断

### やったこと

- コマンドレジストリのシングルソース化（`commandRegistry.ts`）
- コンパイラのエラーメッセージ改善（Levenshtein提案）
- `sync-oss` スキル作成（`packages/interpreter` → OSS リポジトリへの同期）
- OSS リポジトリ `kaedevn`（Public）に interpreter を公開済み

### まだやっていないこと

- `apps/hono-local`（ローカル専用API）の作成
- ストレージ・DB のアダプターパターン化（SQLite / ファイルシステム対応）
- エディタコアの抽出（`packages/editor-core`）
- Cloud Editor / OSS Editor の正式な分離
- コミットログ監査の自動化

### 判断の現状

**「部分公開」路線を採用中。** interpreter は既にOSS化済み。残りのパッケージは、`hono-local`（ローカルAPI）の作成が前提条件。フル OSS 化は Switch 移植が一段落してからの方が合理的。

---

## 5. 次のアクション（優先順）

| 優先度 | タスク | 見積もり |
|--------|-------|---------|
| 高 | `hono-local` 作成（SQLite + ファイルシステム） | 1-2週間 |
| 高 | エディタ → `hono-local` 接続確認 | 2-3日 |
| 中 | `editor-core` パッケージ抽出 | 2-3週間 |
| 中 | OSS リポジトリに editor + packages を同期 | 1週間 |
| 低 | コミットログAI監査スクリプト | 3日 |
| 低 | CONTRIBUTING.md / 開発ガイド整備 | 1週間 |
