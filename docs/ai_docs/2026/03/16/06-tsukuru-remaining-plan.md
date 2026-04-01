# ツクール残タスク実装計画

**作成日**: 2026-03-16
**対象**: Phase 2〜6 完了後の追加 UI・機能

---

## 実装順序と担当分担

| # | タスク | 規模 | 担当 | テスト |
|---|--------|:----:|:----:|--------|
| 1 | トループ（敵グループ）編集 UI | 小 | Claude Opus | typecheck |
| 2 | エンカウント設定 UI | 小 | Claude Opus | typecheck |
| 3 | マップ接続設定 UI | 小 | Claude Opus | typecheck |
| 4 | プリセット切り替え UI | 小 | Claude Opus | typecheck |
| 5 | バトルのターゲット選択 UI | 中 | Claude Opus | typecheck + battle ユニットテスト |
| 6 | マップテストプレイ機能 | 中 | Claude Opus | typecheck |
| 7 | シーンフロー可視化 | 大 | Claude Opus | typecheck |

**テスト方針:**
- こちら（Claude Opus）: `npm run typecheck` + サーバー不要のユニットテスト（vitest）
- main（Claude Code）: ブラウザ E2E テスト（Playwright）

---

## 1. トループ（敵グループ）編集 UI

**対象**: `apps/editor/src/components/panels/GameDbPanel.tsx`

GameDb タブにアクター/敵/スキル/アイテムの4サブタブがあるが、トループ（敵グループ）がない。
バトルブロックで `troopId` を指定するには、トループの定義が必要。

**実装内容:**
- DbTab に `'troops'` を追加
- トループ一覧（名前 + メンバー数）
- トループ詳細: 名前編集 + メンバー追加/削除（enemyId のドロップダウン）
- gameDb.enemies から敵キャラ選択

**変更ファイル:** `GameDbPanel.tsx`

---

## 2. エンカウント設定 UI

**対象**: `apps/editor/src/components/map/MapEditor.tsx`

マップにエンカウント（ランダム敵出現）を設定する UI。
MapData の `encounterRate` と `encounters[]` を編集する。

**実装内容:**
- マップエディタのツールバーまたはサイドバーに「エンカウント」セクション追加
- エンカウント率（歩数）のスライダー
- 敵グループの追加/削除（troopId ドロップダウン + weight 入力）

**変更ファイル:** `MapEditor.tsx`

---

## 3. マップ接続設定 UI

**対象**: `apps/editor/src/components/map/MapEditor.tsx`

マップ間の移動先を設定する UI。
MapData の `connections[]` を編集する。

**実装内容:**
- マップエディタのサイドバーに「接続」セクション追加
- 方向（北/南/東/西）+ 移動先マップ ID + 座標

**変更ファイル:** `MapEditor.tsx`

---

## 4. プリセット切り替え UI

**対象**: `apps/editor/src/components/panels/SettingsPanel.tsx`

PlayLayout のプリセット（novel-standard / rpg-classic / message-top / message-center）を切り替える UI。

**実装内容:**
- SettingsPanel に「UI プリセット」セクション追加
- 4プリセットのラジオボタン or セレクト
- 選択結果をプロジェクト JSON に保存
- プレビューに反映

**変更ファイル:** `SettingsPanel.tsx`, `SidebarPreview.tsx`

---

## 5. バトルのターゲット選択 UI

**対象**: `packages/web/src/renderer/ui/BattleScene.ts`

「たたかう」選択後に敵一覧から攻撃先を選択する UI。
現状は常に最初の生存敵を攻撃する。

**実装内容:**
- 「たたかう」押下 → 敵一覧をボタンで表示
- 各敵ボタンに名前 + HP バーを表示
- 選択された敵のインデックスで resolve

**変更ファイル:** `BattleScene.ts`

---

## 6. マップテストプレイ機能

**対象**: `apps/editor/src/components/map/MapEditor.tsx` + 新規コンポーネント

マップエディタ内でプレイヤーを操作してマップを歩ける機能。
保存前の動作確認（通行判定、イベント配置）に使う。

**実装内容:**
- ツールバーに「テストプレイ」ボタン追加
- MapCanvas 内に PixiJS の MapSystem を起動
- キーボード操作でプレイヤー移動
- イベントに触れたらイベント情報をポップアップ表示
- ESC でテストプレイ終了

**変更ファイル:** `MapEditor.tsx`, `MapCanvas.tsx`（または新規 `MapTestPlay.tsx`）

---

## 7. シーンフロー可視化

**対象**: 新規コンポーネント

ページ間遷移のグラフを表示する機能。
jump ブロックと choice ブロックの分岐先を線でつなぐ。

**実装内容:**
- 各ページをノード、jump/choice をエッジとしてグラフ描画
- Canvas ベースまたは SVG ベースのシンプルな描画
- ノードクリックでそのページに移動
- 自動レイアウト（簡易的な左→右フロー）

**変更ファイル:** 新規 `apps/editor/src/components/SceneFlowGraph.tsx`
- EditorPage に新タブ or モーダルとして追加

---

## 実装順序の根拠

1-4 は小規模（各 1 ファイル変更）で独立しており、順に片付けられる
5 はバトル UX の改善で、1 の敵グループ定義が前提
6 はマップの動作確認で、2-3 のエンカウント/接続設定が前提
7 は最大規模だが、他に依存しない（最後に回しても問題なし）
