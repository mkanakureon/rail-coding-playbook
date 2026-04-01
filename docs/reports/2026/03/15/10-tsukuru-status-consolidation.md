# ツクール型機能 — 現状整理・計画比較・実装状況

> 2026-03-15 / 新旧14本のツクール関連文書を整理し、最新の概念マップ（20-rpg-tkool-concept-map.md）を正として統合

## 文書一覧（新→旧、正→参考）

### 正（最新、計画の基準）

| # | ファイル | 内容 | 日付 |
|---|---------|------|------|
| 20 | `09_reports/03/13/20-rpg-tkool-concept-map.md` | **概念マップ（マスター文書）** — 4本柱、Phase 1-6、セーブスキーマ段階拡張 | 3/13 |
| 09 | `09_reports/03/13/09-tsukuru-editor-spec.md` | UIレイアウトエディタ仕様（PlayLayout） | 3/13 |
| 13 | `09_reports/03/13/13-tsukuru-runtime-integration.md` | ランタイム統合ガイド（UiLayoutContainer） | 3/13 |
| 11 | `09_reports/03/13/11-tsukuru-preset-json.md` | 4プリセットJSON定義 | 3/13 |

### 参考（情報源・検討ログ）

| # | ファイル | 内容 | 備考 |
|---|---------|------|------|
| 14 | `14-tsukuru-user-needs-v2.md` | ユーザーニーズ44項目 | 要件の裏付け |
| 12 | `12-tsukuru-ui-parts-design.md` | 20 UI要素デザイン仕様 | Phase 6 の詳細 |
| 18 | `18-game-creation-cli-design.md` | ゲーム制作スキル設計 | CLI 側の計画 |
| 10 | `10-tsukuru-layout-preview.html` | プレビューHTML | ブラウザで開ける |

### 旧（統合済み、個別参照不要）

| ファイル | 理由 |
|---------|------|
| `01_in_specs/03/0307/02_ツクール...` | 概念マップに統合済み |
| `01_in_specs/03/0313/ツクール...` | 同上（同内容の重複） |
| `09_reports/03/07/03-tsukuru-component-terminology-summary.md` | 概念マップ §1-2 に統合 |
| `09_reports/03/07/04-tsukuru-author-acquisition-strategy.md` | 14-user-needs-v2 に統合 |
| `15-tsukuru-claude-code-cli.md` | 18-game-creation-cli-design に統合 |
| `16-tsukuru-cli-catalog.md` | カタログのみ、計画とは別 |

## 計画 vs 実装の比較

### Phase 別の実装状況

| Phase | 計画内容 | 実装状況 | 詳細 |
|:-----:|---------|:--------:|------|
| **既存** | ノベル制作（text/bg/ch/choice/jump/effect/screen_filter/overlay） | ✅ 完了 | 14ブロック型全て動作 |
| **既存** | フラグシステム（set_var + if） | ✅ 完了 | 6比較演算子、&&/\|\| 対応 |
| **既存** | セーブ/ロード（schema v1） | ✅ 完了 | vars/read/node_id |
| **1** | ノベル完結 + CLI スキル | ⚠️ 部分的 | create-story PoC 済み、スキル未整備 |
| **2** | コモンイベント（templates + call） | ❌ 未実装 | 型定義・ブロック型・ランタイム全て未着手 |
| **3** | ゲームDB（actors/enemies/skills/items） | ❌ 未実装 | スキーマ設計済み（概念マップ §5）、コード未着手 |
| **4** | バトルランタイム | ⚠️ 部分的 | `battle` ブロック型あり、ランタイムはスタブ |
| **5** | マップ連携 | ⚠️ 部分的 | MapSystem/MapCharacter/EncounterSystem 実装済み、マップイベント（複数ページ+条件）未実装 |
| **6** | UIレイアウト自由配置 | ⚠️ 部分的 | UiLayoutContainer/applyPlayLayout/QuickMenuBar/4プリセット実装済み、20要素中数要素のみ |

### 実装済みファイル（ランタイム側）

| ファイル | 行数 | Phase | 内容 |
|---------|:----:|:-----:|------|
| `packages/web/src/systems/MapSystem.ts` | 393 | 5 | マップ描画・タイル移動・衝突判定 |
| `packages/web/src/systems/MapCharacter.ts` | 180 | 5 | キャラクター移動・アニメーション |
| `packages/web/src/systems/EncounterSystem.ts` | 73 | 5 | ランダムエンカウント |
| `packages/web/src/systems/InventorySystem.ts` | 49 | 3 | アイテム所持管理（基礎のみ） |
| `packages/web/src/systems/FlagSystem.ts` | 33 | 既存 | フラグ管理 |
| `packages/web/src/renderer/UiLayoutContainer.ts` | 75 | 6 | UIレイアウトコンテナ |
| `packages/web/src/renderer/applyPlayLayout.ts` | 37 | 6 | PlayLayout JSON 適用 |
| `packages/web/src/renderer/ui/QuickMenuBar.ts` | 66 | 6 | クイックメニューバー |
| `packages/core/src/presets/` | 4ファイル | 6 | novel-standard / rpg-classic / message-center / message-top |
| `packages/core/src/types/PlayLayout.ts` | — | 6 | PlayLayout 型定義 |

### エディタ側

| ファイル | Phase | 内容 |
|---------|:-----:|------|
| `apps/editor/src/components/map/MapEditor.tsx` | 5 | マップエディタ本体 |
| `apps/editor/src/components/map/MapCanvas.tsx` | 5 | マップ描画キャンバス |
| `apps/editor/src/components/map/TilePalette.tsx` | 5 | タイルパレット |
| `apps/editor/src/components/map/EventInspector.tsx` | 5 | イベントインスペクタ |
| `apps/editor/src/services/mapService.ts` | 5 | マップAPI連携 |
| `apps/hono/src/routes/maps.ts` | 5 | マップCRUD API |

### 未実装の重要機能

| 機能 | Phase | 概念マップの節 | 必要な作業 |
|------|:-----:|:------------:|-----------|
| `call` ブロック + `templates[]` | 2 | §4 | 型定義、ブロックカード、ランタイム dispatch |
| `gameDb` スキーマ | 3 | §5 | プロジェクト JSON に `gameDb` 追加、エディタにDB編集UI |
| バトルランタイム | 4 | §6 | ダメージ計算（formula eval）、行動AI、勝敗分岐、バトルUI |
| マップイベント（複数ページ+条件） | 5 | §7 | イベントページの条件切り替え、NPC 会話 |
| `map_jump` ブロック | 5 | §7 | シナリオ↔マップ遷移 |
| セーブ v1.1-1.3 | 3-5 | §9 | inventory/party/mapState のセーブ・ロード |
| PlayLayout 全20要素 | 6 | 09/12 | 残り要素の PixiJS 実装 |

## テスト不安定の原因（「さっきはOKだったなぜ？」）

E2E テストが通ったり落ちたりする原因:

| 原因 | 説明 | 対策状況 |
|------|------|---------|
| `from=editor` でプレビュー黒画面 | postMessage モードになりシナリオが届かない | ✅ 修正済み（本日） |
| 公式アセット未同期 | ローカル DB に `official_assets` がないとアセット選択が失敗 | ✅ 620件同期済み（本日） |
| OVL アセットなし | overlay 選択時にモーダルが閉じない | ✅ フォールバック追加済み（本日） |
| `waitForTimeout` 依存 | 固定時間待ちで環境差により不安定 | ⚠️ 7箇所未置換 |
| ch/effect/camera 設定なし | ブロック追加後プロパティ未設定 | ✅ ヘルパー5種追加済み（本日） |
| Gemini CLI のブランチ作業残り | `feat/gemini-skills` ブランチの変更が main に部分的にしか反映されていない | ⚠️ 要整理 |

**「さっきはOKだった」のは `from=editor` 除去後のテスト。それ以前は黒画面でタイムアウトしていた。**

## 推奨する次のアクション

### 短期（今すぐ）

1. **Phase 1 完了宣言** — ノベル制作機能は全て実装済み。CLI スキルを整備すればリリース可能
2. **E2E テスト安定化** — `waitForTimeout` 7箇所の条件待ち置換

### 中期（Phase 2-3）

3. **`call` ブロック + `templates[]`** — コモンイベント（Phase 2、規模: 小）
4. **`gameDb` スキーマ** — actors/enemies/skills/items（Phase 3、規模: 中）

### 長期（Phase 4-6）

5. **バトルランタイム** — Phase 4、規模: 大。Gemini CLI が RPG 系を担当しているので連携
6. **マップイベント完成** — Phase 5、規模: 大。MapSystem は基礎あり
7. **PlayLayout 全要素** — Phase 6、規模: 中。UiLayoutContainer の拡張
