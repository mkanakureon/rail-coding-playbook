# 11-RAG_DEVELOPMENT_UTILITY_TEST_RESULTS

## 概要
エージェントが過去の実装詳細や複雑な設計意図を検索し、開発を加速できるかを検証した10件のテスト結果。

## Query: "IEngineAPI Switch portability"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/09_reports/2026/03/01/01-multi-genre-api-gap-analysis.md`
- **Context**: マルチジャンル API 設計書 vs 実装 ギャップ分析 > 4. 実装アーキテクチャの実態 > 設計書の想定
- **Excerpt**: "``` IEngineAPI (統一インターフェース) ├── Universal Core (showImage, drawUI, getVar...) ├── Novel API (showDialogue, setBacklog) ├── Battle API (battleStart, playBattleEffect) ├── RPG API (loadMap, moveEntity) ├── Roguelike API (setGridMap, processTurn) ├── Idle API (calculateOfflineProgress) └── Training API..."
- **Agent Action**: `read_file("docs/09_reports/2026/03/01/01-multi-genre-api-gap-analysis.md")`
### [Rank 2] Score: 0.5990 (vector)
- **Path**: `docs/09_reports/2026/02/24/05-zenn-article-ideas.md`
- **Context**: Zenn 投稿ネタ一覧 > D: Claude Code 実践ログ > D-01: 実践ログ — ConsoleEngine + TestEngine を 1 セッションで実装・テスト・ドキュメント (8,000字)
- **Excerpt**: "IEngineAPI の 2 実装を作成、59 テスト、6 ドキュメント更新。 ソース: 本セッションのログ..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/24/05-zenn-article-ideas.md")`
### [Rank 3] Score: 0.5648 (vector)
- **Path**: `docs/zenn/drafts/01kj6xw100-ienginapi-platform-abstraction.md`
- **Context**: Top
- **Excerpt**: "--- title: "IEngineAPI（17メソッド）でWeb/Console/Switch/Testを統一した理由" emoji: "🔌" type: "tech" topics: ["claudecode", "typescript", "設計", "ゲーム開発"] published: false ---..."
- **Agent Action**: `read_file("docs/zenn/drafts/01kj6xw100-ienginapi-platform-abstraction.md")`

## Query: "Tween keyframe seek logic"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/04_plans/TIMELINE-V1.1-PLAN.md`
- **Context**: Timeline JSON v1.1 強化計画書 > ⚙️ 評価アルゴリズム > Channel評価（補間計算）
- **Excerpt**: "```typescript function evaluateChannel(channel, clip, currentTimeMs) {   const clipLocalTime = currentTimeMs - clip.startMs;   const keyframes = sortByClipOffsetMs(channel.keyframes);    // 最初のkeyframe以前   if (clipLocalTime <= keyframes[0].clipOffsetMs) {     return keyframes[0].value;   }    // 最後の..."
- **Agent Action**: `read_file("docs/04_plans/TIMELINE-V1.1-PLAN.md")`
### [Rank 2] Score: 0.5745 (vector)
- **Path**: `docs/09_reports/2026/02/21/05-timeline-playback-fix.md`
- **Context**: タイムラインパネル再生・スクロール同期の修正 > 機能追加: キーフレームスナップ
- **Excerpt**: "カーソルドラッグ終了時、50ms以内にキーフレームがあれば吸い付く。  ```tsx const snapToKeyframe = (time: number): number => {   // keyframeTimes: editorData から全KFの絶対時刻を収集（useMemo）   // 閾値内で最も近いKFの時刻を返す };  <Timeline onCursorDragEnd={(time) => {   const snapped = snapToKeyframe(time);   if (snapped !== time) timelineRef.current?.se..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/21/05-timeline-playback-fix.md")`
### [Rank 3] Score: 0.5405 (vector)
- **Path**: `docs/01_in_specs/HANDOFF_TWEEN_v0.2.md`
- **Context**: 申し送り：Tween v0.2 改善タスク > タスク6: カメラ座標系のドキュメント追加
- **Excerpt**: "**場所**: `docs/in_specs/Tween v0.1（Seekable Timeline Evaluator）仕様.md` に追記  **やること**: 以下を明記する - カメラ座標系の原点（左上? 中央?） - ズームの基準点（画面中央? カメラ位置?） - 回転の中心点 - dollyZoom 時の x/y とズームの関係 - dutchAngle の回転が何を中心に回るか  コードの実装（`TimelinePlayer` のカメラトランスフォーム適用部分）を読んで、実際の挙動を正確に記述すること。  ---..."
- **Agent Action**: `read_file("docs/01_in_specs/HANDOFF_TWEEN_v0.2.md")`

## Query: "Character class asset mapping"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/09_reports/2026/02/27/07-asset-management-implementation-plan.md`
- **Context**: アセット管理 実装計画書 v3 > 4. タスク B — CharacterPanel → CharacterClassPanel 変換 > 検証
- **Excerpt**: "- [ ] ch-class 一覧が CharacterPanel に表示される - [ ] 新規作成 → ch-class Asset が作成される - [ ] 表情追加 → AssetSelectModal で画像選択 → metadata に反映 - [ ] 表情削除 → metadata から削除 - [ ] ch-class 削除 → Asset から削除 - [ ] 旧 Character API を呼んでいないこと (Network タブで確認)  ---..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/27/07-asset-management-implementation-plan.md")`
### [Rank 2] Score: 0.5956 (vector)
- **Path**: `docs/09_reports/2026/02/24/14-zenn-asset-management-7phases.md`
- **Context**: 新体系: 3 つの原則 > 原則 1: 全てアセット
- **Excerpt**: "画像、音声、キャラクター定義をすべて `Asset` テーブルに統合する。キャラクターは `kind: "ch-class"` のアセットとして扱い、JSON メタデータで表情マッピングを保持する。..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/24/14-zenn-asset-management-7phases.md")`
### [Rank 3] Score: 0.5956 (vector)
- **Path**: `docs/zenn/drafts/01kj6z4whe-asset-management-7phases.md`
- **Context**: 新体系: 3 つの原則 > 原則 1: 全てアセット
- **Excerpt**: "画像、音声、キャラクター定義をすべて `Asset` テーブルに統合する。キャラクターは `kind: "ch-class"` のアセットとして扱い、JSON メタデータで表情マッピングを保持する。..."
- **Agent Action**: `read_file("docs/zenn/drafts/01kj6z4whe-asset-management-7phases.md")`

## Query: "JWT refresh token implementation"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/AUTH_IMPLEMENTATION.md`
- **Context**: 認証システム実装ドキュメント > 🚀 今後の拡張 > 改善候補
- **Excerpt**: "- [ ] JWT の refresh token 対応 - [ ] セッション管理 UI (アクティブセッション一覧) - [ ] ログイン試行回数制限 - [ ] IP アドレスベースの不正アクセス検知  ---..."
- **Agent Action**: `read_file("docs/AUTH_IMPLEMENTATION.md")`
### [Rank 2] Score: 0.5909 (vector)
- **Path**: `docs/09_reports/2026/02/18/auth-industry-standards.md`
- **Context**: Web 認証設計の業界標準と現状の位置づけ > 4. 現在の kaedevn の認証設計の位置づけ > 現在の設計判断（「決め打ち」した部分）
- **Excerpt**: "| 判断項目 | 採用した方式 | 根拠 | |----------|------------|------| | トークン保管 | localStorage | 実装の単純さ（Phase 2 で改善予定） | | Access Token 有効期限 | 24時間 | 7日から短縮。ユーザー体験とのバランス | | Refresh Token | なし | 現段階では過剰。Phase 2 で導入予定 | | サーバー側ログアウト | なし | ユーザー規模が小さい段階では不要 | | アプリ間認証 | Auth Code Exchange | URL トークン漏洩を防止 | | BFF | H..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/18/auth-industry-standards.md")`
### [Rank 3] Score: 0.5888 (vector)
- **Path**: `docs/09_reports/2026/02/28/19-mobile-guest-mode-spec.md`
- **Context**: モバイル ゲストモード設計書 > API エンドポイント > 2. ゲスト復帰: `POST /api/auth/guest/restore`
- **Excerpt**: "**認証不要。** localStorage の guestToken で復帰を試みる。  ```typescript // Request: { token: string }   // 保存していた guestToken  // Response (成功): {   token: string;       // 新しい JWT   userId: string;   projectId: string;   expiresAt: number;   // 延長された期限 }  // Response (期限切れ): { error: "expired", status: 410 } ``..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/28/19-mobile-guest-mode-spec.md")`

## Query: "Azure Container Apps vs SWA deployment"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/09_reports/2026/03/03/07-app-service-vs-container-apps.md`
- **Context**: preview 用 > 参考リンク
- **Excerpt**: "- [Azure App Service vs Container Apps - Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1337789/azure-app-service-vs-azure-container-apps-which-to) - [Comparing Container Apps with other Azure container options - Microsoft Learn](https://learn.microsoft.com/en-us/azure/container-..."
- **Agent Action**: `read_file("docs/09_reports/2026/03/03/07-app-service-vs-container-apps.md")`
### [Rank 2] Score: 0.5872 (vector)
- **Path**: `docs/09_reports/2026/03/03/07-app-service-vs-container-apps.md`
- **Context**: Azure App Service 移行検討: Container Apps との比較 > 8. 構成最適化: 静的 SPA を Container Apps から分離する > 移行による効果
- **Excerpt**: "| 項目 | 現在 (Container Apps × 4) | 推奨 (CA × 2 + SWA × 2) | |------|--------------------------|--------------------------| | **コンテナビルド数** | 4 | 2 | | **Docker build 時間** | 4 アプリ分 | 2 アプリ分（半減） | | **ACR push** | 4 イメージ | 2 イメージ（半減） | | **デプロイ所要時間** | 20〜40 分 (ローカル) | コンテナ: 10〜20 分 + SWA: 2〜3 分 | | **Con..."
- **Agent Action**: `read_file("docs/09_reports/2026/03/03/07-app-service-vs-container-apps.md")`
### [Rank 3] Score: 0.5695 (vector)
- **Path**: `docs/10_ai_docs/2026/03/02/69-HYBRID_CLOUD_STRATEGY.md`
- **Context**: ハイブリッド・クラウド戦略：Azure ＋ Google Cloud による最適化 > 2. 積極的に GCP を活用すべき領域 > ③ 開発用一時環境（Cloud Run）
- **Excerpt**: "- **理由**: Azure Container Apps よりも起動が速く、設定がシンプル。 - **役割**: PRごとのプレビュー環境、開発者用の一時的なモックAPI。..."
- **Agent Action**: `read_file("docs/10_ai_docs/2026/03/02/69-HYBRID_CLOUD_STRATEGY.md")`

## Query: "Mobile UI safe area CSS"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/smartphone-optimization-plan.md`
- **Context**: スマートフォン縦画面最適化計画書 > 15. 実装ガイドライン > 15.1 レスポンシブ分岐
- **Excerpt**: "**メディアクエリ**: ```typescript const isMobile = useMediaQuery('(max-width: 640px)'); const isLandscape = useMediaQuery('(orientation: landscape)');  return isMobile ? <MobileUI /> : <DesktopUI />; ```  **Tailwind CSS**: ```css /* モバイル向け (デフォルト) */ .block-card { padding: 8px; }  /* デスクトップ向け (640px以上) */ ..."
- **Agent Action**: `read_file("docs/smartphone-optimization-plan.md")`
### [Rank 2] Score: 0.5958 (vector)
- **Path**: `docs/smartphone-optimization-plan.md`
- **Context**: スマートフォン縦画面最適化計画書 > 15. 実装ガイドライン > 15.3 タッチターゲット
- **Excerpt**: "**最小サイズ**: 48x48px (Material Design)  **チェックリスト**: - [ ] すべてのボタンが 48x48px 以上 - [ ] タップ領域が視覚的な要素より大きい (padding で調整) - [ ] 隣接するタッチターゲット間に 8px 以上の余白  ---..."
- **Agent Action**: `read_file("docs/smartphone-optimization-plan.md")`
### [Rank 3] Score: 0.5839 (vector)
- **Path**: `docs/09_reports/2026/02/24/27-zenn-three-column-preview-sync.md`
- **Context**: モバイル対応: タブ切り替えへのフォールバック
- **Excerpt**: "画面幅が狭い場合（640px 未満）は、3 カラムではなくタブ切り替え式の UI にフォールバックします。  ```tsx if (isWideScreen) {   return (     // 3 カラムレイアウト   ); }  return (   <div className="editor-container">     <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />     {renderContent()} {/* editor | character | asset | settings ..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/24/27-zenn-three-column-preview-sync.md")`

## Query: "Command battle system logic"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/qiita/drafts/01kj6z4w46-command-battle-system-vn.md`
- **Context**: 拡張順序
- **Excerpt**: "機能の追加順序は厳守とした。  ``` 1. 基本戦闘完成（attack/skill/item + 勝敗） 2. 状態異常（poison/paralyze/stun） 3. トリガー演出（戦闘中テキスト差込み） 4. AI拡張（Utility + Expectimax） 5. スキル拡張（複数対象、属性など） ```  順番を変えると設計が破綻する。特に状態異常をトリガー演出より先に実装するのは、トリガー条件に状態異常を含められるようにするためだ。  ---  ノベルゲームエンジンにコマンドバトルを組み込むという、一見無茶な要件に対して、純粋関数ベースの BattleCore と IO 抽象に..."
- **Agent Action**: `read_file("docs/qiita/drafts/01kj6z4w46-command-battle-system-vn.md")`
### [Rank 2] Score: 0.6000 (vector)
- **Path**: `docs/09_reports/2026/02/24/12-zenn-command-battle-system-vn.md`
- **Context**: 拡張順序
- **Excerpt**: "機能の追加順序は厳守とした。  ``` 1. 基本戦闘完成（attack/skill/item + 勝敗） 2. 状態異常（poison/paralyze/stun） 3. トリガー演出（戦闘中テキスト差込み） 4. AI拡張（Utility + Expectimax） 5. スキル拡張（複数対象、属性など） ```  順番を変えると設計が破綻する。特に状態異常をトリガー演出より先に実装するのは、トリガー条件に状態異常を含められるようにするためだ。  ---  ノベルゲームエンジンにコマンドバトルを組み込むという、一見無茶な要件に対して、純粋関数ベースの BattleCore と IO 抽象に..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/24/12-zenn-command-battle-system-vn.md")`
### [Rank 3] Score: 0.6000 (vector)
- **Path**: `docs/zenn/drafts/01kj6z4w46-command-battle-system-vn.md`
- **Context**: 拡張順序
- **Excerpt**: "機能の追加順序は厳守とした。  ``` 1. 基本戦闘完成（attack/skill/item + 勝敗） 2. 状態異常（poison/paralyze/stun） 3. トリガー演出（戦闘中テキスト差込み） 4. AI拡張（Utility + Expectimax） 5. スキル拡張（複数対象、属性など） ```  順番を変えると設計が破綻する。特に状態異常をトリガー演出より先に実装するのは、トリガー条件に状態異常を含められるようにするためだ。  ---  ノベルゲームエンジンにコマンドバトルを組み込むという、一見無茶な要件に対して、純粋関数ベースの BattleCore と IO 抽象に..."
- **Agent Action**: `read_file("docs/zenn/drafts/01kj6z4w46-command-battle-system-vn.md")`

## Query: "KSC compiler op code mapping"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/command-table.md`
- **Context**: コマンド対応表 — KS / KSC
- **Excerpt**: "作成: 2026-02-22  KS はコンパイラ形式（`@kaedevn/compiler`）。 KSC はインタープリタ形式（`@kaedevn/interpreter`）。 両形式は共存し、作者が選択して使用する。  ---..."
- **Agent Action**: `read_file("docs/command-table.md")`
### [Rank 2] Score: 0.5568 (vector)
- **Path**: `docs/09_reports/2026/02/27/06-test-plan.md`
- **Context**: ksc-compiler パッケージのテスト
- **Excerpt**: "npm test -w @kaedevn/ksc-compiler..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/27/06-test-plan.md")`
### [Rank 3] Score: 0.5521 (vector)
- **Path**: `docs/zenn/drafts/01kj1fytet-kaedevn-ks-ksc-interpreter.md`
- **Context**: インタープリタの実装記録
- **Excerpt**: "KSC を動かすインタープリタ（`packages/interpreter`）を Claude Code と一緒に実装した。..."
- **Agent Action**: `read_file("docs/zenn/drafts/01kj1fytet-kaedevn-ks-ksc-interpreter.md")`

## Query: "BigQuery logging schema"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/10_ai_docs/2026/03/02/64-LOGGING_INFRA_COMPLETED.md`
- **Context**: ログ出力先の切り替え (bigquery | mock)
- **Excerpt**: "LOG_SINK_TYPE=bigquery..."
- **Agent Action**: `read_file("docs/10_ai_docs/2026/03/02/64-LOGGING_INFRA_COMPLETED.md")`
### [Rank 2] Score: 0.5820 (vector)
- **Path**: `docs/10_ai_docs/2026/03/02/59-DATA_DRIVEN_PLATFORM_OPERATIONS.md`
- **Context**: データドリブンなプラットフォーム運営戦略：BigQuery MLの知見を活かしたログ活用 > 4. kaedevn モノレポへの適用ステップ > A. ログ出力の標準化 (`apps/hono`)
- **Excerpt**: "- 現在の `middleware/logger.js` を拡張し、BigQuery へのストリーミング挿入に適した構造化 JSON (Cloud Logging 経由等) を出力するように統一します。..."
- **Agent Action**: `read_file("docs/10_ai_docs/2026/03/02/59-DATA_DRIVEN_PLATFORM_OPERATIONS.md")`
### [Rank 3] Score: 0.5803 (vector)
- **Path**: `docs/10_ai_docs/2026/03/02/64-LOGGING_INFRA_COMPLETED.md`
- **Context**: サービスアカウントキー (JSON) の絶対パスを指定 > 3. 次のステップ：BigQuery 側のテーブル作成
- **Excerpt**: "BigQuery 上で以下のスキーマ（または互換性のあるスキーマ）で `events_raw` テーブルを作成してください。  - `timestamp`: TIMESTAMP (Partitioning column) - `event_type`: STRING - `user_id`: STRING - `project_id`: STRING - `payload`: JSON - `context`: RECORD (REPEATED or NULLABLE)   - `ua`: STRING   - `version`: STRING   - `path`: STRING   - ..."
- **Agent Action**: `read_file("docs/10_ai_docs/2026/03/02/64-LOGGING_INFRA_COMPLETED.md")`

## Query: "Author Assist multi-stage prompt pipeline"
### [Rank 1] Score: 0.6000 (vector)
- **Path**: `docs/01_in_specs/0225/stage0-proposal.md`
- **Context**: Stage 0 導入設計書：大規模章数対応 > Stage 1 の変更：篇単位生成に切り替え > 変更後
- **Excerpt**: "``` buildStage1Prompt(settings, arc, skeleton, prevArcSummary?) → 篇ごとに生成（例: 9章分） → 篇数分の API calls ```..."
- **Agent Action**: `read_file("docs/01_in_specs/0225/stage0-proposal.md")`
### [Rank 2] Score: 0.5901 (vector)
- **Path**: `docs/09_reports/2026/02/25/12-author-assist-step1-4-5-7-report.md`
- **Context**: 作者向け執筆支援 — Step 1/4/5/7 実装報告書 > 実装の詳細 > Step 4: 型定義 + Zod + .md パーサー + プロンプト
- **Excerpt**: "**5 ファイル**を `apps/hono/src/lib/assist/` に作成。  #### types.ts — 型定義  ``` WorkSetting          作品設定（overview, genre, characters, assetMapping 等） CharacterSetting     キャラ設定（name, slug, role, personality, speechStyle 等） AssetMapping         場所名 → bg slug のマッピング Stage1Result         章プロット配列 Stage2Result  ..."
- **Agent Action**: `read_file("docs/09_reports/2026/02/25/12-author-assist-step1-4-5-7-report.md")`
### [Rank 3] Score: 0.5772 (vector)
- **Path**: `docs/01_in_specs/0225/stage0-proposal.md`
- **Context**: Stage 0 導入設計書：大規模章数対応 > Stage 1 の変更：篇単位生成に切り替え > 変更前
- **Excerpt**: "``` buildStage1Prompt(settings) → 36章分を1回で生成 → 1 API call ```..."
- **Agent Action**: `read_file("docs/01_in_specs/0225/stage0-proposal.md")`
