# ツクール実装マスタープラン

**作成日**: 2026-03-16
**目的**: 散在する設計書を統合し、Phase 2〜6 の実装順序・依存関係・完了条件を一覧化する

---

## 現状サマリー（2026-03-16 時点）

### 実装完了済み（Phase 1 + α）

| 機能 | パッケージ | 完了度 |
|------|-----------|:------:|
| ノベル基盤（text/bg/ch/choice/jump/effect/screen_filter） | compiler, core, web, editor | 100% |
| フラグ・変数（set_var / if） | compiler, core, web, editor | 100% |
| タイムライン演出（timeline） | compiler, core, web, editor | 100% |
| KSC スクリプト（ksc ブロック） | compiler, core, web, editor | 100% |
| セーブ/ロード（schema v1） | core, web | 100% |
| バトルコア（simulate/damage/rng/victory/AI） | battle | 100% |
| バトル UI（DOM オーバレイ） | web | 70% |
| マップ型定義・バリデーション | map | 100% |
| マップ描画（タイル/オートタイル/カメラ） | web (MapSystem) | 90% |
| プレイヤー移動・衝突判定 | web (MapCharacter) | 85% |
| エンカウントシステム | web (EncounterSystem) | 95% |
| インベントリシステム | web (InventorySystem) | 80% |
| PlayLayout 型定義 + 適用 | core, web | 100% |
| UiLayoutContainer（10/20 要素） | web | 50% |
| マップ API（CRUD + 認証） | hono | 90% |
| マップエディタ（基礎） | editor | 40% |

### 未実装（Phase 2〜6）

| 機能 | Phase | 規模 | 依存 |
|------|:-----:|:----:|------|
| `call` ブロック + `templates[]` | 2 | 小 | なし |
| `gameDb` 統合スキーマ | 3 | 中 | なし |
| セーブスキーマ v2（一括置換） | 3 | 小 | gameDb |
| バトル拡張（onWin/onLose ジャンプ、gameDb 連携） | 4 | 中 | gameDb |
| マップ拡張（複数ページイベント、NPC移動ルート） | 5 | 中 | なし |
| `map_jump` ブロック | 5 | 小 | マップ拡張 |
| PlayLayout 残り 10 要素 | 6 | 中 | なし |
| `scroll_text` ブロック | 6 | 小 | なし |

---

## 実装順序（依存関係グラフ）

```
Phase 3 ─── gameDb スキーマ ──→ セーブ v2（一括） ─────────────────→ テスト
                │                                                     │
Phase 2 ─── call + templates ──────────────────────────────────────→ テスト
                                                                      │
Phase 4 ─── バトル拡張 ────────→ バトル UI 改善 ──────────────────→ テスト
                                                                      │
Phase 5 ─── マップ拡張 ────────→ map_jump ────────────────────────→ テスト
                                                                      │
Phase 6 ─── PlayLayout 残り ──→ scroll_text ──────────────────────→ テスト
```

**セーブスキーマ方針**: リリース前のため後方互換は不要。v1 を v2 に一括置換する（inventory + party + mapState を最初から含む）。段階的マイグレーション（v1.1→v1.2→v1.3）は行わない。リリース後にスキーマ変更が必要になった場合のみマイグレーション関数を実装する。

**並行可能な組み合わせ:**
- Phase 2 と Phase 3 は独立（同時着手可）
- Phase 5 と Phase 6 は独立（同時着手可）
- Phase 4 は Phase 3（gameDb）に依存

---

## Phase 別の完了条件

### Phase 2: コモンイベント

- [ ] `templates[]` 配列がプロジェクト JSON に追加される
- [ ] `call` ブロック型が compiler / core / web / editor で動作する
- [ ] エディタでテンプレートの作成・編集・呼び出しができる
- [ ] 既存のノベルプロジェクトに影響がない（テンプレートは空配列）
- [ ] `npm run typecheck` + `npm test -w @kaedevn/compiler` 通過

### Phase 3: ゲームDB + セーブスキーマ v2

- [ ] `gameDb` スキーマが `packages/core/src/types/GameDb.ts` に定義される
- [ ] 既存の `packages/battle/src/data/` が gameDb を参照するように変更される
- [ ] セーブスキーマを v2 に一括置換（inventory + party + mapState を含む完成形）
- [ ] エディタに gameDb 編集タブが追加される

### Phase 4: バトル拡張

- [ ] `BATTLE_START` の `onWin` / `onLose` でラベルジャンプが動作する
- [ ] プレイヤーステータスが gameDb の actors から読み込まれる（ハードコード排除）
- [ ] スキル選択・ターゲット選択が動作する
- [ ] ステータス効果（毒・麻痺・気絶）が戦闘に影響する
- [ ] バトル UI が PixiJS ベースに移行される（DOM オーバレイ廃止）

### Phase 5: マップ拡張

- [ ] イベントの複数ページ + 条件切り替えが動作する
- [ ] NPC の移動ルート（fixed/random/path/chase/flee）が動作する
- [ ] `map_jump` ブロックでシナリオ↔マップ遷移ができる
- [ ] マップエディタでタイルペイント（ドラッグ描画）ができる

### Phase 6: UI カスタマイズ

- [ ] PlayLayout の残り 10 要素が UiLayoutContainer に登録される
- [ ] `scroll_text` ブロックが動作する（スタッフロール等）
- [ ] プリセット切り替え（novel-standard / rpg-classic 等）が動作する

---

## ブランチ戦略

```
main
 ├── feature/tsukuru-phase2-call       # call + templates
 ├── feature/tsukuru-phase3-gamedb     # gameDb + セーブ v2
 ├── feature/tsukuru-phase4-battle     # バトル拡張
 ├── feature/tsukuru-phase5-map        # マップ拡張 + map_jump
 └── feature/tsukuru-phase6-ui         # PlayLayout + scroll_text
```

- 各 Phase は独立ブランチで作業し、完了後に main へマージ
- Phase 2 と 3 は並行作業可能
- Phase 4 は Phase 3 マージ後に着手

---

## 関連設計書

| # | ファイル | 内容 |
|---|---------|------|
| 02 | `02-phase2-call-block-design.md` | call ブロック + templates 実装設計 |
| 03 | `03-phase3-gamedb-design.md` | gameDb 統合スキーマ設計 |
| 04 | `04-phase4-battle-expansion-design.md` | バトルランタイム拡張設計 |
| 05 | `05-save-schema-v2-design.md` | セーブスキーマ v2 設計（一括置換、後方互換不要） |

## 既存参考資料

| ファイル | 内容 |
|---------|------|
| `docs/09_reports/2026/03/13/20-rpg-tkool-concept-map.md` | ツクール概念の再構成（全体設計） |
| `docs/09_reports/2026/03/15/12-tsukuru-code-review-and-plan.md` | コードレビュー + 次期計画 |
| `docs/10_ai_docs/2026/03/13/09-IMPLEMENTATION_RISK_MANAGEMENT.md` | 実装リスク管理 |
| `docs/09_reports/2026/03/13/09-tsukuru-editor-spec.md` | エディタ仕様 |
| `docs/09_reports/2026/03/13/12-tsukuru-ui-parts-design.md` | UI パーツ設計（20要素） |
| `docs/09_reports/2026/03/13/13-tsukuru-runtime-integration.md` | ランタイム統合手順 |
