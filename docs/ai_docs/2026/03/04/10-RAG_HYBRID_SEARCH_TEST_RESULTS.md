# 10-RAG_HYBRID_SEARCH_TEST_RESULTS

## Query: "Author Assist"
### Result 1 (Score: 0.6000)
- **Path**: docs/09_reports/2026/02/25/09-openai-rag-ts-spec.md
- **Heading**: TS/Node だけで OpenAI API + RAG を実装する設計 > API 設計（3 機能、共通基盤） > Phase 2: 作者向け執筆支援
- **Match Type**: vector
- **Excerpt**: "``` POST /author/assist ```  - シーンの整合性チェック - 登場人物の口調統一 - 伏線・設定の参照（RAG） - scope: `work` のみ（作品内限定）..."

### Result 2 (Score: 0.4703)
- **Path**: docs/01_in_specs/0225/TS_Node だけで OpenAI API 呼び出し.md
- **Heading**: **機能別に“入口”だけ作る（優先順）** > **Phase 2：作者向け執筆支援（RAGの価値が出る）**
- **Match Type**: vector
- **Excerpt**: "* 入口：`POST /author/assist`  * 典型機能：    * 「このシーンの整合性チェック」    * 「登場人物の口調を揃える」    * 「伏線/設定の参照（RAG）」  * RAGのscope：`work` のみ（まずは作品内限定）..."

### Result 3 (Score: 0.4648)
- **Path**: docs/myasset-spec.md
- **Heading**: マイアセット仕様書 > カテゴリ仕様 > 定義者
- **Match Type**: vector
- **Excerpt**: "- 作者（ユーザー）が自由に命名する。 - 事前定義リストは不要。入力形式は自由テキスト。..."

## Query: "認証の仕組み"
### Result 1 (Score: 0.6000)
- **Path**: docs/09_reports/2026/02/18/auth-industry-standards.md
- **Heading**: Web 認証設計の業界標準と現状の位置づけ > 5. 設計判断が難しい理由 > トレードオフの構造
- **Match Type**: vector
- **Excerpt**: "認証設計はセキュリティ・利便性・実装コストの三方トレードオフになる。  ```         セキュリティ            ▲           / \          /   \         /     \        /  理想  \       /   だが   \      /  実装困難  \     ▼─────────────▼ 利便性           実装コス..."

### Result 2 (Score: 0.5752)
- **Path**: docs/implementation-plan.md
- **Heading**: kaedevn 実装計画書 > Phase 2: 認証システム（2週間） > 目的
- **Match Type**: vector
- **Excerpt**: "ユーザー登録・ログイン・メール認証を実装..."

### Result 3 (Score: 0.5685)
- **Path**: docs/email-verification-spec.md
- **Heading**: メール認証機能 仕様書 > 4. API エンドポイント > 4.2 GET /api/auth/verify/:token
- **Match Type**: vector
- **Excerpt**: "メールアドレス認証  **リクエスト** ``` GET /api/auth/verify/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d ```  **レスポンス（成功）** ```html <!-- リダイレクト: /verify/success --> <!DOCTYPE html> <html>   <body>     <h1>✅ メールアドレス認証完了</h1..."

## Query: "中国短尺ドラマ"
### Result 1 (Score: 0.6000)
- **Path**: docs/10_ai_docs/2026/02/26/04-STORY_EVALUATION.md
- **Heading**: ストーリー評価報告書：コメディプロジェクト > 2. 項目別分析 > 2.3 文章品質と演出
- **Match Type**: vector
- **Excerpt**: "- **五感描写**: 視覚だけでなく、「古い紙の匂い」「お菓子の甘い香り」「吹奏楽部の壁を突き抜ける練習音」など、部室の空気感を伝える描写が豊富です。 - **コメディのテンポ**: 1シーンが短く、会話主体で進むため、飽きさせない構成になっています。..."

### Result 2 (Score: 0.5885)
- **Path**: docs/10_ai_docs/2026/03/03/83-GENRE_OPTIMIZATION_EVALUATION.md
- **Heading**: ジャンル別プロンプト最適化：Gemini 2.5 Flash 生成結果評価報告書 > 2. ジャンル別評価 > C. Longstory (長編)
- **Match Type**: vector
- **Excerpt**: "- **大河ドラマ的重厚さ**: 歴史的背景や因縁を匂わせる「饒舌な地の文」が特徴的です。 - **伏線管理**: `PendingMysteries` により、序盤に提示した「運命の因縁」が後の話でも中心的な動機として扱われています。..."

### Result 3 (Score: 0.5807)
- **Path**: docs/09_reports/2026/02/25/13-coherence-limit-analysis-report.md
- **Heading**: AI 執筆支援システム — 破綻なく生成できる文字数の分析 > 生成量の試算 > 規模別の総文字数
- **Match Type**: vector
- **Excerpt**: "| 規模 | 構成 | シーン数 | 総文字数 | |------|------|---------|---------| | 小 | 3 章 × 3 話 × 3 シーン | 27 | ~21,600 | | 中 | 5 章 × 3 話 × 3 シーン | 45 | ~36,000 | | 大 | 7 章 × 3 話 × 3 シーン | 63 | ~50,400 | | 特大 | 10 章 × 3..."

