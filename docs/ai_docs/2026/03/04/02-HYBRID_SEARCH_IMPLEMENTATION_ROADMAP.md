# 99-HYBRID_SEARCH_IMPLEMENTATION_ROADMAP

## 1. Phase 1: インフラ & DB構築 (Day 1)
- [x] `docker-compose.yml` への `rag-postgres` サービス追加、または初期化SQLの実装。
- [x] `.env` への `RAG_DATABASE_URL` 設定。
- [x] データベース初期化スクリプト (`scripts/init-rag-db.ts`) の作成。
    - `CREATE EXTENSION vector;`
    - `CREATE TABLE rag_chunks ...`

## 2. Phase 2: インデクサ CLI 実装 (Day 1-2)
- [x] Markdownパースロジックの構築（H2/H3ベース）。
- [x] 差分更新（git diff / content_hash）の実装。
- [x] 10万行ドキュメントの初期インデックス実行テスト。

## 3. Phase 3: ハイブリッド検索エンジン実装 (Day 2)
- [x] ベクトル検索 + 全文検索の統合関数の作成。
- [x] スコア正規化 & リランクアルゴリズムの実装。
- [x] 単体テスト（特定のキーワードでのヒット精度検証）。

## 4. Phase 4: API 公開 & エージェント連携 (Day 3)
- [x] Hono `/api/rag/hybrid-search` エンドポイントの実装。
- [x] エージェント用「ツール定義」ドキュメントの作成。
- [x] Claude Code / Gemini CLI からの動作検証。

---

## 成功の定義
1.  **精度**: 「Author Assist」というキーワードで検索した際、関連する全ドキュメントが上位3件以内に表示される。
2.  **速度**: 検索レスポンスが 500ms 以内に完了する。
3.  **効率**: インデックスの差分更新が 10秒 以内に完了する。
