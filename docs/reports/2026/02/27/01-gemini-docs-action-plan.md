# Gemini CLI ドキュメント評価・実装計画書

**作成日**: 2026-02-27
**対象**: `docs/10_ai_docs/2026/02/26/` 全64ファイル

---

## 概要

Gemini CLI が生成した64文書を精査し、以下に分類した。

| 分類 | 件数 | 説明 |
|------|------|------|
| **A: 実装対象** | 35件 | 具体的なコード実装・改善につながる |
| **B: 参考資料** | 29件 | アーキテクチャ理解・意思決定の参考 |
| **C: 不要** | 0件 | — |

---

## Phase 1: エンジン QOL 機能（プレイヤー向け・最優先）

商用VNに必須の機能群。Web エンジン (packages/web) に実装後、ネイティブにも展開。

### 1-1. バックログ（メッセージ履歴）

| 項目 | 内容 |
|------|------|
| **参照文書** | `35-BACKLOG_SYSTEM_IMPLEMENTATION.md`, `51-BACKLOG_UI_DESIGN.md` |
| **概要** | 直近100件のダイアログ履歴表示、ボイス再生、スクロール |
| **実装箇所** | `packages/core` (LogEntry型), `packages/web` (LogOverlay) |
| **入力** | マウスホイール上 / PageUp / L ボタン |

### 1-2. セーブ・ロード

| 項目 | 内容 |
|------|------|
| **参照文書** | `36-SAVE_LOAD_SYSTEM_BLUEPRINT.md` |
| **概要** | GameSnapshot インターフェース（PC/変数/BGM/背景/立ち絵の状態保存）、IStorage 統合 |
| **実装箇所** | `packages/core` (GameSnapshot型), `packages/web` (Save/Load UI) |
| **制約** | セーブはダイアログ待機中のみ（アニメーション中は不可）、既存 save_schema_version 準拠 |

### 1-3. オート・スキップ

| 項目 | 内容 |
|------|------|
| **参照文書** | `37-AUTO_SKIP_LOGIC_BLUEPRINT.md`, `52-SKIP_SYSTEM_LOGIC.md` |
| **概要** | オート: 文字数ベースの待機時間計算、スキップ: wait/アニメーション即時完了 |
| **実装箇所** | `packages/core` (isSkipping/isAuto フラグ), IEngineAPI 拡張 |
| **追加** | 既読判定 (`readLines: Set<string>`) を IStorage に永続化 |

### 1-4. システム UI テンプレート

| 項目 | 内容 |
|------|------|
| **参照文書** | `32-ENGINE_QOL_SPECIFICATION.md` |
| **概要** | タイトル画面 / セーブ画面 / 設定画面の PixiJS テンプレート |
| **実装箇所** | `packages/web/src/ui/` |

---

## Phase 2: AI 執筆支援の改善

既存 ai-gateway パッケージの品質向上。

### 2-1. プロンプト改善（反復抑制・演出指示）

| 項目 | 内容 |
|------|------|
| **参照文書** | `08-GLOBAL_IMPROVEMENT_PLAN.md`, `09-IMPLEMENTATION_REPORT.md` |
| **概要** | Stage 3 プロンプトに反復抑制ルール追加、SE/表情メタデータ埋め込み指示 |
| **実装箇所** | `packages/ai-gateway/src/prompts.ts`, `_default.yaml` |
| **検証** | 全ジャンルで再生成テスト → 反復率・演出密度を評価 |

### 2-2. ks-generator メタデータ変換

| 項目 | 内容 |
|------|------|
| **参照文書** | `08-GLOBAL_IMPROVEMENT_PLAN.md` |
| **概要** | `[se: footstep]` → `@se tag=footstep` 自動変換 |
| **実装箇所** | `packages/ai-gateway/src/ks-generator.ts` |

### 2-3. 長編メモリシステム

| 項目 | 内容 |
|------|------|
| **参照文書** | `15-AI_MEMORY_SYSTEM_LOGIC.md` |
| **概要** | Plot Thread Registry (未解決伏線管理)、階層的コンテキスト (直近→要約→骨格→伏線)、キャラ知識グラフ |
| **実装箇所** | `packages/ai-gateway/src/memory/` (新規) |
| **優先度** | 10章以上の長編で必要 → 短編完成後に着手 |

---

## Phase 3: Web UI/UX 改善

### 3-1. マイページ・マイアセットの刷新

| 項目 | 内容 |
|------|------|
| **参照文書** | `24-MYPAGE_MODERNIZATION_BLUEPRINT.md`, `25-MY_ASSETS_NEW_IMPLEMENTATION.md`, `26-MYPAGE_ENHANCED_IMPLEMENTATION.md` |
| **概要** | Tailwind 移行、Glassmorphism デザイン、フローティング統計カード、AI 進捗バッジ |
| **実装箇所** | `apps/next/app/mypage/`, `apps/next/app/my-assets/` |
| **注意** | コンポーネントコードが提供されているが、既存 API 関数名との整合確認が必要 |

### 3-2. TSX リファクタリング

| 項目 | 内容 |
|------|------|
| **参照文書** | `28-COMPREHENSIVE_TSX_IMPROVEMENT_PLAN.md`, `29-TSX_REFACTORING_BLUEPRINTS.md` |
| **概要** | Phase 1: my-assets Tailwind化、Phase 2: Editor カスタムフック抽出、Phase 3: Server Components 移行 |
| **実装箇所** | `apps/next/`, `apps/editor/` |

### 3-3. State 管理の見直し

| 項目 | 内容 |
|------|------|
| **参照文書** | `20-STATE_LIFTING_GUIDELINES.md` |
| **概要** | Editor の state 配置監査、Context 境界の適正化 |
| **実装箇所** | `apps/editor/src/pages/EditorPage.tsx` |

---

## Phase 4: ネイティブエンジン (SDL2/C++)

macOS 開発環境でのプロトタイプ → Switch 展開。大量の文書があるが重複も多い。

### 4-1. コアエンジン実装

| 項目 | 内容 |
|------|------|
| **参照文書** | `40-SDL2_ENGINE_SPECIFICATION.md`, `41-SDL2_ENGINE_DESIGN.md`, `42-SDL2_MACOS_IMPLEMENTATION_PLAN.md` |
| **概要** | NativeEngine (60FPS メインループ)、SwitchOpHandler (レイヤー描画)、CppInterpreter |
| **実装箇所** | `packages/native-engine/` |
| **状況** | Steps 1-3 完了済み (`56-MACOS_IMPLEMENTATION_COMPLETION_REPORT.md`) |

### 4-2. C++ インタプリタ

| 項目 | 内容 |
|------|------|
| **参照文書** | `44-NATIVE_INTERPRETER_CPP_MAPPING.md`, `48-NATIVE_FLOW_CONTROL_LOGIC.md` |
| **概要** | TS→C++ 型マッピング (std::variant)、if/choice のブラケット解析 |
| **検証** | TS 版と C++ 版で同一入力→同一出力の自動比較テスト |

### 4-3. テキスト描画

| 項目 | 内容 |
|------|------|
| **参照文書** | `47-SDL2_TEXT_RENDERING_STRATEGY.md` |
| **概要** | SDL_ttf による FontManager / MessageWindow / TextSurface |

### 4-4. アセット管理・同期

| 項目 | 内容 |
|------|------|
| **参照文書** | `46-NATIVE_ASSET_RESOLUTION_LOGIC.md`, `45-NATIVE_ENGINE_FILE_SYNC_STRATEGY.md`, `53-EDITOR_NATIVE_SYNC_WORKFLOW.md`, `59-EDITOR_NATIVE_ASSET_DEPLOYMENT.md`, `61-PROJECT_ASSET_MAPPING_GUIDE.md` |
| **概要** | AssetProvider クラス (slug→ファイル解決)、sync-native.sh、assets.json 生成 |
| **注意** | 5文書あるが内容重複多い → `53` を主参照、他は補足 |

### 4-5. シェーダー・トランジション

| 項目 | 内容 |
|------|------|
| **参照文書** | `49-ADVANCED_TRANSITION_SHADER_DESIGN.md`, `50-MASK_WIPE_IMPLEMENTATION_DETAIL.md` |
| **概要** | OpenGL マスクワイプ GLSL シェーダー (コード付き)、TransitionManager |

### 4-6. テスト基盤

| 項目 | 内容 |
|------|------|
| **参照文書** | `43-NATIVE_ENGINE_TEST_STRATEGY.md`, `64-NATIVE_AUTOMATED_VISUAL_TESTING.md` |
| **概要** | GTest/GMock、ヘッドレスモード (`SDL_VIDEODRIVER=dummy`)、ゴールドマスター画像比較 |

### 4-7. スクリーンショット機能

| 項目 | 内容 |
|------|------|
| **参照文書** | `63-SCREENSHOT_FEATURE_SPEC.md` |
| **概要** | P キーで `SDL_RenderReadPixels` → PNG 保存。小スコープ。 |

---

## Phase 5: DevOps / 品質基盤

### 5-1. CI/CD 改善

| 項目 | 内容 |
|------|------|
| **参照文書** | `22-CI_CD_WORKFLOW_ANALYSIS.md` |
| **概要** | E2E テストジョブ追加 (Playwright)、キャッシュ最適化、knip によるデッドコード検出 |
| **実装箇所** | `.github/workflows/` |

### 5-2. E2E テスト自動化

| 項目 | 内容 |
|------|------|
| **参照文書** | `16-E2E_TEST_AUTOMATION_BLUEPRINT.md` |
| **概要** | .ks → Playwright テスト自動生成、選択肢分岐網羅、ビジュアルリグレッション |
| **実装箇所** | `tests/` |

### 5-3. IStorage / ポータビリティ強化

| 項目 | 内容 |
|------|------|
| **参照文書** | `14-INTERFACE_COMPLIANCE_REPORT.md` |
| **概要** | ESLint で `window`/`document` の packages/web 外使用を禁止、IStorage の IndexedDB 実装強化 |

### 5-4. ドキュメント整理

| 項目 | 内容 |
|------|------|
| **参照文書** | `12-DOC_AUDIT_REPORT.md` |
| **概要** | `docs/archive/` 作成、obsolete docs 移動、`apps/api` 参照の修正 |

---

## Phase 6: ビジュアルエフェクト（後回し可）

### 6-1. Web 版エフェクト

| 項目 | 内容 |
|------|------|
| **参照文書** | `33-VISUAL_EFFECTS_ROADMAP.md` |
| **概要** | シェーダートランジション、フルスクリーンフィルタ、パーティクル、瞬き/リップシンク |

### 6-2. PixiJS パフォーマンス最適化

| 項目 | 内容 |
|------|------|
| **参照文書** | `17-PIXIJS_SWITCH_PERFORMANCE_RESEARCH.md` |
| **概要** | KTX2 テクスチャ圧縮パイプライン、オブジェクトプーリング |

---

## Phase 7: エディタ拡張（後回し可）

### 7-1. デバッグ機能強化

| 項目 | 内容 |
|------|------|
| **参照文書** | `34-EDITOR_DEBUGGING_ENHANCEMENT.md` |
| **概要** | リアルタイム変数インスペクタ、AI 生成の承認ゲート UI、アセット自動提案 |

---

## 参考資料一覧（実装不要・知識として保持）

| # | 文書 | 用途 |
|---|------|------|
| 01 | CODE_REVIEW | アーキテクチャ品質検証 |
| 02 | ARCH_ANALYSIS | AI 執筆支援の実装確認 |
| 03 | TECH_VERIFICATION | 設計↔実装の整合性監査 |
| 04-07 | STORY_REVIEW (4種) | 生成ストーリーの品質評価 |
| 10 | AGENT_CAPABILITIES | Gemini/Claude 役割分担 |
| 13 | SOURCE_OF_TRUTH | 正規アーキテクチャ定義（生きてる文書） |
| 18 | KSC_LANGUAGE_SPECIFICATION | 言語仕様リファレンス |
| 19 | DATABASE_SCHEMA_MODELING | Prisma スキーマ設計解説 |
| 21 | AUTHENTICATION_SECURITY_FLOW | JWT 認証フロー文書 |
| 23 | ASSET_UPLOAD_PIPELINE | アセットアップロード全体像 |
| 27 | EDITOR_BLUEPRINT_REVIEW | エディタ設計適合度評価 |
| 30 | SWITCH_PORTING_RESOURCES | Switch 移植リソース目録 |
| 31 | VN_PLATFORM_GAP_ANALYSIS | 商用VN対比ギャップ分析 |
| 38 | SDL2_NATIVE_INTEGRATION_STRATEGY | デュアルエンジン戦略 |
| 39 | ABSTRACTION_LAYER_DEEP_DIVE | 抽象化レイヤー設計哲学 |
| 54 | ASSET_WEBP_CONVERSION_STRATEGY | WebP 変換方針（実装済み） |
| 55 | WEBP_AUTO_CONVERSION_VERIFICATION | WebP 変換の検証結果 |
| 56 | MACOS_IMPLEMENTATION_COMPLETION_REPORT | macOS 実装完了マイルストーン |
| 57 | NATIVE_ENGINE_OPERATION_MANUAL | ネイティブエンジン操作マニュアル |
| 58 | PLAYER_FEATURE_COMPARISON | Web/Native 機能比較表 |
| 60 | STANDALONE_DISTRIBUTION_SPEC | スタンドアロン配布仕様 |
| 62 | WEB_NATIVE_COMPATIBILITY_REPORT | Web/Native 互換性監査 |

---

## 推奨実装順序

```
Phase 1 (エンジン QOL)    ← 商用レベルに必須、最優先
  ↓
Phase 2-1,2-2 (AI 改善)  ← 即座に品質向上可能、小スコープ
  ↓
Phase 5-3,5-4 (品質基盤)  ← 開発効率に直結
  ↓
Phase 3 (Web UI)          ← ユーザー体験向上
  ↓
Phase 4 (ネイティブ)      ← 継続的に進行
  ↓
Phase 5-1,5-2 (CI/E2E)   ← プロジェクト規模拡大時
  ↓
Phase 6,7 (エフェクト/エディタ) ← 余裕があれば
```

---

## 重複文書の整理メモ

以下のグループは内容が重複しており、実装時は **主参照** を使えばよい。

| テーマ | 主参照 | 補足（重複） |
|--------|--------|-------------|
| バックログ | `35` | `51` (UI 詳細) |
| スキップ | `37` | `52` (コマンド仕様) |
| SDL2 エンジン設計 | `41` | `40` (仕様), `42` (macOS 計画) |
| アセット同期 | `53` | `45`, `59`, `61` |
| シェーダー | `49` | `50` (GLSL コード) |
