# ドキュメント監査報告書：設計の矛盾と整理勧告

**作成日**: 2026-02-26
**対象**: `docs/` 直下の全 40+ ドキュメント

## 1. 核心的な矛盾点 (Critical Conflicts)

### 1.1 バックエンドの定義
- **矛盾**: `BACKEND_MIGRATION_PLAN.md` (2026-02-17策定) では「`apps/hono` への統一が完了し、`apps/api` は廃止済み」とされていますが、一部の運用ドキュメントや `APPLICATION_ARCHITECTURE.md` では依然として `apps/api` への言及が残っています。
- **実態**: 物理ディレクトリとしては `apps/hono` が主軸ですが、ドキュメント上の用語が統一されておらず、混乱を招いています。

### 1.2 フロントエンドの責任範囲
- **矛盾**: `ARCHITECTURE-SIMPLE.md` では「`apps/editor` はエディタ機能のみ、`apps/next` は管理画面」という分離戦略が強調されていますが、古い機能仕様書では `apps/next` 内にエディタ機能がある前提の記述が見られます。
- **リスク**: 「1つのアプリに1つの責任」という原則がドキュメントによって曖昧になっています。

## 2. カテゴリ別整理状況と整理勧告

| カテゴリ | 該当ファイル例 | 状態 | 処置案 |
| :--- | :--- | :--- | :--- |
| **基本設計** | `APPLICATION_ARCHITECTURE.md`, `ARCHITECTURE-SIMPLE.md` | 重複 | 統合・一本化 |
| **移行記録** | `BACKEND_MIGRATION_PLAN.md`, `migration-guide.md` | 完了済み | `docs/03_implementation_reports/` へ移動 |
| **古い仕様** | `multi-user-spec.md`, `multi-user-impact-analysis.md` | 旧版 | アーカイブ |
| **環境設定** | `server-urls.md`, `LOCAL_TESTING.md` | ポート番号不一致 | 内容更新または廃止 |

## 3. 物理整理の提案 (File Relocation)

以下のディレクトリ構造への物理的な整理を提案します。

- `docs/01_in_specs/`: AI 執筆支援などの進行中の機能仕様
- `docs/03_implementation_reports/`: 過去の移行や実装の完了報告
- `docs/07_deployment/`: Azure / Docker 等のインフラ設定
- `docs/archive/`: **(新規作成)** 参照不要となった古いドキュメント

## 4. 結論

本リポジトリのドキュメントは、**「歴史的経緯（apps/api → apps/hono）」** の過渡期に書かれたものが多く、最新の真実（Source of Truth）がどれであるかが不明瞭です。

物理的なファイル整理（アーカイブ移動）と、`GEMINI.md` による「新規ドキュメント作成ルールの厳格化」を早期に実施することを推奨します。

---
*Created by AI Agent during Phase 1.2 Execution.*
