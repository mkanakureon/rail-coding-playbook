# ツクール型エディタ 実装計画書

> **作成日**: 2026-03-18
> **担当**: Claude Code (Opus 4.6)
> **前提設計書**:
> - `01-TSUKURU_DETAILED_DESIGN.md` — データモデル・API・コンポーネント階層
> - `02-TSUKURU_SCREEN_LAYOUT_SPEC.md` — 画面レイアウト詳細（Gemini レビュー承認済み）
> **ソース設計書** (docs/10_ai_docs/2026/03/18/):
> - `01-TSUKURU_SCREEN_REDESIGN_PLAN.md` — 画面設計マスタープラン
> - `02-TSUKURU_CREATOR_REVIEW.md` / `03-...RPG_SIMULATION.md` — レビュー 2 本

---

## 0. 前提条件

### 既存資産（実装済み・流用可能）

| コンポーネント | パス | 行数 | 品質 |
|---|---|---|---|
| バトルシミュレータ | `packages/battle/src/` | ~600 | 完成（決定論的・RNG-seeded） |
| GameDb 型定義 | `packages/core/src/types/GameDb.ts` | ~220 | 完成（7 テーブル + アニメーション） |
| マップデータ型 | `packages/map/src/types.ts` | ~200 | 完成（イベント・接続・天候・エンカウント） |
| MapEditor (3 パネル) | `apps/editor/src/components/map/MapEditor.tsx` | ~450 | 完成（undo/redo・テストプレイ付き） |
| MapCanvas (PixiJS) | `apps/editor/src/components/map/MapCanvas.tsx` | ~200 | 完成 |
| TilePalette | `apps/editor/src/components/map/TilePalette.tsx` | ~150 | 完成 |
| EventInspector | `apps/editor/src/components/map/EventInspector.tsx` | ~100 | 部分（セルフスイッチ・ページなし） |
| MapTestPlay | `apps/editor/src/components/map/MapTestPlay.tsx` | ~200 | 完成 |
| GameDbPanel (6 タブ) | `apps/editor/src/components/panels/GameDbPanel.tsx` | ~300 | 完成（Actor/Enemy/Troop/Anim/Skill/Item） |
| MapService (API) | `apps/editor/src/services/mapService.ts` | ~50 | 完成 |

### 技術スタック

- **フロントエンド**: React 19 + Vite + Tailwind CSS + Zustand
- **レンダリング**: PixiJS (マップキャンバス・テストプレイ)
- **バックエンド**: Hono (API) + Prisma (PostgreSQL)
- **デプロイ**: Azure Static Web Apps (エディタ) + Container Apps (API)

---

## Phase 1: シェル + マップエディタ接続

**期間**: 1〜2 週間
**ゴール**: ツクール風のエディタ外観でマップが描ける状態

### 1.1 DB スキーマ変更

| タスク | ファイル | 内容 |
|--------|---------|------|
| projects.type カラム追加 | `apps/hono/prisma/schema.prisma` | `type String @default("novel")` |
| マイグレーション作成 | — | `npx prisma migrate dev --name add-project-type` |
| GameDb JSON カラム追加 | `apps/hono/prisma/schema.prisma` | `gameDb Json?`, `variables Json?`, `switches Json?`, `system Json?` |

### 1.2 API

| タスク | ファイル | 内容 |
|--------|---------|------|
| プロジェクト type フィルタ | `apps/hono/src/routes/projects.ts` | POST に type パラメータ追加、GET でフィルタ |
| GameDb CRUD | `apps/hono/src/routes/gamedb.ts`（新規） | `GET/PUT /api/projects/:id/gamedb` |
| 変数・スイッチ CRUD | `apps/hono/src/routes/gamedb.ts` | `GET/PUT /api/projects/:id/variables` |

### 1.3 フロントエンド — シェル

| タスク | ファイル | 内容 |
|--------|---------|------|
| ツクール用ストア | `apps/editor/src/store/useTsukuruStore.ts`（新規） | プロジェクト・タブ・マップ・GameDb の状態管理 |
| メインページ | `apps/editor/src/pages/TsukuruEditorPage.tsx`（新規） | メニューバー + ツールバー + 3 カラム + ステータスバー |
| ルーティング追加 | `apps/editor/src/App.tsx` | `/projects/tsukuru/:id` → TsukuruEditorPage |
| メニューバー | `apps/editor/src/components/tsukuru/TsukuruMenuBar.tsx`（新規） | ファイル/編集/モード/描画/ツール/ゲーム/ヘルプ |
| ツールバー | `apps/editor/src/components/tsukuru/TsukuruToolbar.tsx`（新規） | 保存/Undo/Redo + 描画ツール + ズーム + テストプレイ + モード切替 |
| ステータスバー | `apps/editor/src/components/tsukuru/StatusBar.tsx`（新規） | マップ名・サイズ・カーソル位置・レイヤー |
| マップツリー | `apps/editor/src/components/tsukuru/MapTree.tsx`（新規） | ツリービュー + コンテキストメニュー + D&D 並替え |
| ダークテーマ CSS | `apps/editor/src/index.css` | ツクール MZ 風カラートークン追加 |

### 1.4 フロントエンド — マップエディタ接続

| タスク | ファイル | 内容 |
|--------|---------|------|
| マップタブ統合 | `TsukuruEditorPage.tsx` | 左パネル上部 = TilePalette、下部 = MapTree、中央 = MapCanvas |
| 右パネル (マップモード) | `apps/editor/src/components/tsukuru/MapRightPanel.tsx`（新規） | マッププロパティ + ミニマップ |
| 右クリックスポイト | `apps/editor/src/components/map/MapCanvas.tsx`（拡張） | 右クリック → タイル ID 取得 → パレット選択 |
| イベントモード半透明 | `MapCanvas.tsx`（拡張） | イベントモード時タイルレイヤー alpha=0.5 |
| レイヤーバー | `apps/editor/src/components/tsukuru/LayerBar.tsx`（新規） | 下層/中層/上層/影/R のチェックボックス + 不透明度スライダー |

### 1.5 マイページ連携

| タスク | ファイル | 内容 |
|--------|---------|------|
| プロジェクト作成 UI | `apps/next/app/(private)/mypage/page.tsx` | type 選択: ノベル / ツクール |
| プロジェクト一覧 | 同上 | type に応じてアイコン・リンク先を切替 |

### 1.6 完了条件

- [ ] `/projects/tsukuru/{id}` でツクール風 UI が表示される
- [ ] メニューバー・ツールバー・ステータスバーが機能する
- [ ] マップツリーからマップを選択して描画できる
- [ ] 右クリックスポイトが動作する
- [ ] レイヤー切替が動作する
- [ ] マイページからツクールプロジェクトを作成・開ける
- [ ] `npm run typecheck` パス

---

## Phase 2: データベース拡張

**期間**: 1〜2 週間
**ゴール**: ツクールの全 DB タブが揃い、データ定義が完結する
**依存**: Phase 1（シェル・ストア）

### 2.1 型定義

| タスク | ファイル | 内容 |
|--------|---------|------|
| GameDbExtended 型 | `packages/core/src/types/GameDb.ts` | ClassDef, WeaponDef, ArmorDef, TilesetConfig, CommonEvent, SystemConfig 追加 |
| TilePassability 型 | 同上 | pass, fourDir, star, counter, bush, ladder, damage |
| EventCommand 型 | `packages/core/src/types/EventCommand.ts`（新規） | 40 コマンド + MoveCommand + BranchCondition + ShopGood |
| エクスポート | `packages/core/src/index.ts` | 新規型のエクスポート追加 |

### 2.2 DB エディタ 13 タブ化

| タブ | ファイル | 既存/新規 | 備考 |
|------|---------|----------|------|
| アクター | `GameDbEditor.tsx` | 既存拡張 | 成長曲線グラフ (SVG) 追加 |
| 職業 | `tabs/ClassTab.tsx`（新規） | 新規 | レベルスキル習得テーブル |
| スキル | `GameDbEditor.tsx` | 既存拡張 | ダメージ計算式エディタ追加 |
| アイテム | `GameDbEditor.tsx` | 既存拡張 | 効果タイプ・使用回数追加 |
| 武器 | `tabs/WeaponTab.tsx`（新規） | 新規 | ステータス変化プレビュー |
| 防具 | `tabs/ArmorTab.tsx`（新規） | 新規 | 装備スロット・ステータス変化 |
| 敵キャラ | `GameDbEditor.tsx` | 既存拡張 | 行動パターンテーブル拡張 |
| トループ | `TroopPlacementEditor.tsx`（新規） | 新規 | ドラッグ配置エディタ (Canvas) |
| ステート | `tabs/StateTab.tsx`（新規） | 新規 | 持続ターン・自動解除 |
| アニメーション | `GameDbEditor.tsx` | 既存拡張 | フレームエディタ + プレビュー再生 |
| タイルセット | `TilesetPassEditor.tsx`（新規） | 新規 | タイル上クリック ○/×/☆ 切替 |
| コモンイベント | `tabs/CommonEventTab.tsx`（新規） | 新規 | トリガー + コマンドリスト |
| システム | `tabs/SystemTab.tsx`（新規） | 新規 | タイトル・初期パーティ・通貨 |

### 2.3 ダイアログ

| タスク | ファイル | 内容 |
|--------|---------|------|
| 変数・スイッチ管理 | `dialogs/VarSwitchManager.tsx`（新規） | 番号リスト + 名前編集 + 検索 |
| 素材管理 | `dialogs/ResourceManager.tsx`（新規） | カテゴリツリー + プレビュー + インポート |

### 2.4 完了条件

- [ ] 13 タブ全てで CRUD が動作する
- [ ] タイルセット通行判定がクリックで設定できる
- [ ] トループの敵配置がドラッグで操作できる
- [ ] 変数・スイッチ管理ダイアログが開ける
- [ ] 素材管理ダイアログが開ける
- [ ] `npm run typecheck` パス

---

## Phase 3: イベントコマンドシステム

**期間**: 2〜3 週間
**ゴール**: イベント内容をコマンドで構築できる
**依存**: Phase 2（EventCommand 型）

### 3.1 コアコンポーネント

| タスク | ファイル | 内容 |
|--------|---------|------|
| シナリオエディタ | `components/scenario/ScenarioEditor.tsx`（新規） | コマンドパレット + コマンドリスト の 2 カラム |
| コマンドパレット | `components/scenario/CommandPalette.tsx`（新規） | 6 カテゴリ、左側にタブ + コマンド一覧 |
| コマンドリスト | `components/scenario/CommandListView.tsx`（新規） | ◆ 表記、インデント、ダブルクリック編集 |
| コマンド編集ダイアログ | `components/scenario/CommandEditDialog.tsx`（新規） | コマンド種別に応じた編集フォーム |

### 3.2 コマンド編集フォーム（MVP: 6 コマンド）

| コマンド | ファイル | 優先度 | 備考 |
|---------|---------|--------|------|
| show_text | `commands/ShowTextForm.tsx` | **MVP** | 話者名・顔画像・テキスト + プレビュー |
| show_choices | `commands/ShowChoicesForm.tsx` | **MVP** | 選択肢テキスト + 各分岐のコマンド列 |
| control_switches | `commands/ControlSwitchesForm.tsx` | **MVP** | スイッチ番号 + ON/OFF |
| conditional_branch | `commands/ConditionalBranchForm.tsx` | **MVP** | 条件タイプ選択 + then/else |
| transfer_player | `commands/TransferPlayerForm.tsx` | **MVP** | マップ選択 + 座標 + フェード |
| battle_processing | `commands/BattleProcessingForm.tsx` | **MVP** | トループ選択 + 逃走/敗北可否 |
| control_variables | `commands/ControlVariablesForm.tsx` | 高 | 変数番号 + 演算子 + 値 |
| control_self_switch | `commands/ControlSelfSwitchForm.tsx` | 高 | A/B/C/D + ON/OFF |
| play_bgm / play_se | `commands/AudioForm.tsx` | 高 | 音声選択 + 音量 + 試聴ボタン |
| change_gold | `commands/ChangeGoldForm.tsx` | 中 | 増減 + 値 |
| change_items | `commands/ChangeItemsForm.tsx` | 中 | アイテム選択 + 増減 + 個数 |
| set_move_route | `commands/SetMoveRouteForm.tsx` | 中 | 移動コマンドリスト編集 |
| shop_processing | `commands/ShopProcessingForm.tsx` | 中 | 商品リスト編集 |
| 残り 27 コマンド | `commands/*.tsx` | 低 | Phase 3 以降で順次 |

### 3.3 MapEventDialog

| タスク | ファイル | 内容 |
|--------|---------|------|
| ダイアログ本体 | `dialogs/MapEventDialog.tsx`（新規） | 80vw×85vh モーダル、左(35%):設定 / 右(65%):コマンドリスト |
| ページ切替 | 同上 | ページタブ [1][2][3] + 新規/コピー/削除 |
| 出現条件 | 同上 | スイッチ×2 + セルフSW + 変数 + アイテム + アクター |
| オプション | 同上 | 歩行アニメ / 足踏み / 向き固定 / すり抜け / 最前面 |
| 自律移動 | 同上 | タイプ + 速度 + 頻度 + カスタムルート |
| トリガー・優先度 | 同上 | action / player_touch / event_touch / auto / parallel |
| ScenarioEditor 埋込 | 同上 | 右側にコマンドリストコンポーネントを埋め込む |

### 3.4 マッププロパティダイアログ

| タスク | ファイル | 内容 |
|--------|---------|------|
| ダイアログ本体 | `dialogs/MapPropertyDialog.tsx`（新規） | 50vw×60vh モーダル |
| 基本設定 | 同上 | 名前・サイズ・タイルセット・スクロール |
| BGM/BGS | 同上 | 音声選択 + 音量 + ピッチ |
| エンカウント | 同上 | 敵グループ + 重み テーブル |
| 背景/演出 | 同上 | 遠景・天候・色調 |

### 3.5 完了条件

- [ ] コマンドパレットから 6 MVP コマンドを追加できる
- [ ] コマンドリストに ◆ 表記で表示される
- [ ] ダブルクリックで編集ダイアログが開く
- [ ] MapEventDialog でページ切替・セルフスイッチが動作する
- [ ] マッププロパティでエンカウント設定ができる
- [ ] コマンドのコピー・ペースト・並べ替えが動作する
- [ ] `npm run typecheck` パス

---

## Phase 4: ランタイム統合

**期間**: 2〜3 週間
**ゴール**: テストプレイでゲームが動く
**依存**: Phase 3（イベントコマンド）

### 4.1 イベントコマンドインタプリタ

| タスク | ファイル | 内容 |
|--------|---------|------|
| インタプリタ本体 | `packages/core/src/runtime/EventInterpreter.ts`（新規） | EventCommand[] を逐次実行するステートマシン |
| ゲーム状態 | `packages/core/src/runtime/GameState.ts`（新規） | 変数・スイッチ・所持品・パーティ・セルフスイッチの管理 |
| マップ移動 | 同上 | transfer_player → マップ読込 + プレイヤー配置 |
| 条件分岐評価 | EventInterpreter.ts | BranchCondition の全種別対応 |
| 並列処理 | EventInterpreter.ts | parallel トリガーの tick ループ |

### 4.2 バトル統合

| タスク | ファイル | 内容 |
|--------|---------|------|
| バトル UI | `packages/web/src/renderer/ui/BattleScene.ts`（既存拡張） | GameDb のデータ → BattleScenario 変換 |
| ランダムエンカウント | `packages/core/src/runtime/EncounterManager.ts`（新規） | 歩数カウント → 確率判定 → トループ選択 |
| 戦闘結果反映 | EventInterpreter.ts | 経験値・ゴールド・ドロップアイテム → GameState |

### 4.3 システム画面

| タスク | ファイル | 内容 |
|--------|---------|------|
| ショップ画面 | `packages/web/src/renderer/ui/ShopScreen.ts`（新規） | 商品リスト・売買・所持金表示 |
| セーブ画面 | `packages/web/src/renderer/ui/SaveScreen.ts`（新規） | スロット選択 → IStorage に保存 |
| メニュー画面 | `packages/web/src/renderer/ui/MenuScreen.ts`（新規） | パーティ・アイテム・装備・セーブ |
| 装備画面 | `packages/web/src/renderer/ui/EquipmentScreen.ts`（既存拡張） | GameDb 連携 |

### 4.4 テストプレイ + デバッガ

| タスク | ファイル | 内容 |
|--------|---------|------|
| テストプレイオーバーレイ | `components/testplay/TestPlayOverlay.tsx`（新規） | 1280×720 ゲーム画面 + 操作ボタン |
| デバッガパネル | `components/testplay/DebuggerPanel.tsx`（新規） | F9 トグル、変数/スイッチ/マップ タブ |
| 変数リアルタイム編集 | 同上 | 値クリック → インライン編集 |
| 現在地からテストプレイ | TsukuruEditorPage.tsx | Ctrl+Shift+R で現在マップ・座標から開始 |

### 4.5 完了条件

- [ ] テストプレイでマップ歩行 + NPC 会話が動作する
- [ ] 場所移動（別マップ遷移）が動作する
- [ ] ランダムエンカウント → バトル → 結果反映が動作する
- [ ] ショップで買い物ができる
- [ ] セーブ/ロードが動作する
- [ ] F9 デバッガで変数・スイッチを確認・編集できる
- [ ] `npm run typecheck` パス

---

## Phase 5: 仕上げ + デプロイ

**期間**: 1 週間
**ゴール**: 本番環境で使える状態
**依存**: Phase 4

### 5.1 残コマンド実装

Phase 3 MVP 以外の残り 34 コマンドの編集フォームを順次実装。

### 5.2 UX 仕上げ

| タスク | 内容 |
|--------|------|
| 右クリックコンテキストメニュー | マップ上のイベント右クリック → 編集/コピー/削除 |
| Ctrl+C/V | マップタイル範囲コピー、イベントコピー |
| 描画ツール | 四角形・楕円・塗りつぶし（ペンは Phase 1 で完了） |
| A〜E タイルセットタブ | TilePalette のタブ切替対応 |
| オートタイル | ビットマスク方式 47 パターン（将来最適化） |
| F1 ヘルプ | ショートカット一覧 + 基本操作ガイド |

### 5.3 デプロイ

| タスク | 内容 |
|--------|------|
| SWA config | ツクールルートのフォールバック追加 |
| Vite ビルド確認 | 新規コンポーネントのバンドルサイズ確認 |
| DB マイグレーション | 本番 DB に `projects.type` + JSON カラム適用 |
| E2E テスト | ツクールエディタの基本操作テスト |

### 5.4 完了条件

- [ ] 全 40 コマンドの編集フォームが実装済み
- [ ] Azure 上でツクールエディタにアクセスできる
- [ ] E2E テストが通過する
- [ ] `npm run build` がエラーなく完了する

---

## タイムライン

```
Week 1-2   ████████████████  Phase 1: シェル + マップ接続
Week 3-4   ████████████████  Phase 2: DB 拡張 (13 タブ)
Week 5-7   ████████████████████████  Phase 3: イベントコマンド
Week 8-10  ████████████████████████  Phase 4: ランタイム統合
Week 11    ████████          Phase 5: 仕上げ + デプロイ
```

**合計: 約 11 週間（1 人作業前提）**

### マイルストーン

| 週 | マイルストーン | デモ可能な状態 |
|-----|-------------|--------------|
| Week 2 | Phase 1 完了 | ツクール風 UI でマップが描ける |
| Week 4 | Phase 2 完了 | 全 DB タブでデータ定義ができる |
| Week 7 | Phase 3 完了 | イベントにコマンドを組める |
| Week 10 | Phase 4 完了 | テストプレイでゲームが動く |
| Week 11 | Phase 5 完了 | 本番デプロイ |

---

## リスク管理

| リスク | 影響 | 対策 |
|--------|------|------|
| オートタイルの実装が複雑 | Phase 1 遅延 | MVP では単純タイル配置のみ、オートタイルは Phase 5 |
| コマンド数が多い (40 種) | Phase 3 遅延 | MVP 6 コマンド → 段階的に追加 |
| バトル UI の PixiJS 実装が重い | Phase 4 遅延 | 既存 BattleScene.ts を活用、最小限のビジュアル |
| 並列処理のパフォーマンス | Phase 4 品質 | requestAnimationFrame ベースで実装、重い処理は Web Worker 検討 |
| ダメージ計算式の JS 評価 | セキュリティ | Function コンストラクタ + ホワイトリスト制限 |
| マップサイズ上限 | パフォーマンス | 200×200 タイル上限、PixiJS の viewport culling |

---

## 未決定事項（実装開始前に確定が必要）

| # | 項目 | 選択肢 | 推奨 |
|---|------|--------|------|
| 1 | バトル表示形式 | フロントビュー / サイドビュー | **フロントビュー**（実装が軽い、ツクール MV デフォルト） |
| 2 | タイルセット画像フォーマット | ツクール MV 規格 / 独自 | **独自**（PNG、48×48、列数自由）MVP 優先 |
| 3 | プラグインシステム | 対応 / スコープ外 | **スコープ外**（Phase 5 以降に検討） |
| 4 | オートタイルアルゴリズム | 47 パターン / 簡易 4 方向 | **簡易 4 方向** → 後で 47 パターンに拡張 |
