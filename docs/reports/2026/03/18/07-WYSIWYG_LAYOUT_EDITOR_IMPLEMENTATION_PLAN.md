# WYSIWYG UI レイアウトエディタ 実装計画書

> **作成日**: 2026-03-18
> **担当**: Claude Code (Opus 4.6)
> **前提設計書**: `06-WYSIWYG_LAYOUT_EDITOR_DETAILED_DESIGN.md`
> **前提要件**:
> - `23-CLAUDE_CODE_STRATEGIC_DIRECTIVES.md` — スマホ縦持ち・脱ツクール・テンプレート
> - `24-UI_LAYOUT_SPEC_REVISIONS_SUMMARY.md` — options 型安全・9:16 制約・zIndex 責務

---

## 0. スコープ

ツクールエディタの第 4 タブ「🖼 レイアウト」を、WYSIWYG の UI レイアウトエディタとして完成させる。

**含む:**
- ドラッグ & リサイズによるパーツ配置（react-rnd）
- 解像度切替（16:9 / 9:16 / 4:3 / 1:1）
- 公式プリセット選択 + エクスポート/インポート
- スタイリング自由度（背景透明・枠なし・角丸・フォント選択）
- テストプレイへの反映（PlayLayout → 絶対配置）
- screen-overlay パーツ
- smartphone-portrait プリセット

**含まない:**
- カスタムパーツの追加機能
- アニメーション設定
- レイアウト共有マーケット

---

## 1. 既存コードの変更点

### 1.1 packages/core — 型 + プリセット

| ファイル | 変更 |
|---------|------|
| `types/PlayLayout.ts` | `UiElementType` に `"screen-overlay"` 追加 |
| `presets/smartphone-portrait.json` | **新規**: 9:16 縦持ちプリセット |
| `presets/index.ts` | smartphone-portrait を `UI_PRESETS` に登録 |

### 1.2 apps/editor — ストア + ページ

| ファイル | 変更 |
|---------|------|
| `store/useTsukuruStore.ts` | `layout`, `setLayout`, `updateElement`, `updateElementRect`, `selectedElementId` 追加 |
| `pages/TsukuruEditorPage.tsx` | レイアウトタブを `LayoutEditor` に差し替え |

### 1.3 apps/editor — 新規コンポーネント (6 ファイル)

| ファイル | 行数 | 内容 |
|---------|------|------|
| `components/layout/LayoutEditor.tsx` | ~120 | 3 カラムシェル + ツールバー（解像度/プリセット/保存/読込） |
| `components/layout/LayoutCanvas.tsx` | ~150 | react-rnd キャンバス + グリッドスナップ + スケール表示 |
| `components/layout/LayoutElement.tsx` | ~80 | 個別パーツの枠 + モック表示 + 選択状態 |
| `components/layout/LayoutElementTree.tsx` | ~100 | 左パネル: パーツ一覧 + 目玉アイコン + z-index D&D |
| `components/layout/LayoutPropertyPanel.tsx` | ~150 | 右パネル: 座標/サイズ + opacity + UiElementOptions フォーム |
| `components/layout/elementMocks.tsx` | ~180 | 各パーツのモック表示 (message, name, choice, gold, party, minimap, overlay 等) |

### 1.4 apps/editor — テストプレイ改修

| ファイル | 変更 |
|---------|------|
| `components/testplay/TestPlayOverlay.tsx` | ハードコード Tailwind → PlayLayout 座標の absolute 配置 |

---

## 2. 実装タスク一覧

### Step 1: 基盤（ストア + 型 + プリセット）

| # | タスク | ファイル | 見積 |
|---|--------|---------|------|
| 1.1 | `PlayLayout.ts` に `screen-overlay` 追加 | packages/core | 5 min |
| 1.2 | `smartphone-portrait.json` 作成 | packages/core/presets | 15 min |
| 1.3 | `UI_PRESETS` に登録 | packages/core/presets/index.ts | 5 min |
| 1.4 | `useTsukuruStore` に layout 状態追加 | apps/editor/store | 20 min |
| 1.5 | `UiElementOptions` 型定義（エディタ側） | apps/editor/types | 10 min |
| 1.6 | `LayoutEditor.tsx` シェル + ツールバー | apps/editor/components/layout | 30 min |
| 1.7 | `TsukuruEditorPage.tsx` のレイアウトタブ差し替え | apps/editor/pages | 10 min |

**完了条件**: レイアウトタブに 3 カラムシェルが表示される。解像度/プリセット選択ドロップダウンが動作する。

### Step 2: キャンバス（react-rnd ドラッグ & リサイズ）

| # | タスク | ファイル | 見積 |
|---|--------|---------|------|
| 2.1 | `npm install react-rnd -w apps/editor` | — | 2 min |
| 2.2 | `LayoutCanvas.tsx` 作成 | apps/editor/components/layout | 45 min |
| 2.3 | `LayoutElement.tsx` 作成（react-rnd ラップ） | apps/editor/components/layout | 30 min |
| 2.4 | グリッドスナップ (8px) | LayoutCanvas.tsx | 15 min |
| 2.5 | resolution 変更時のキャンバスアスペクト比切替 | LayoutCanvas.tsx | 15 min |
| 2.6 | 9:16 選択時の警告バッジ | LayoutEditor.tsx | 10 min |

**完了条件**: キャンバス上でパーツをドラッグ移動・四隅リサイズでき、座標がストアに反映される。9:16 切替時にキャンバスが縦長になる。

### Step 3: パーツモック + ツリー + プロパティ

| # | タスク | ファイル | 見積 |
|---|--------|---------|------|
| 3.1 | `elementMocks.tsx` 作成 | apps/editor/components/layout | 45 min |
| 3.2 | `LayoutElementTree.tsx` 作成 | apps/editor/components/layout | 30 min |
| 3.3 | `LayoutPropertyPanel.tsx` 作成（共通 + パーツ固有） | apps/editor/components/layout | 45 min |
| 3.4 | カラーピッカー（alpha 対応） | LayoutPropertyPanel.tsx | 15 min |
| 3.5 | z-index の D&D 並替 | LayoutElementTree.tsx | 20 min |
| 3.6 | screen-overlay パーツのモック表示 | elementMocks.tsx | 10 min |

**完了条件**: 左パネルでパーツ一覧表示・表示切替。中央でモック付きパーツが表示。右パネルで座標/opacity/options 編集。

### Step 4: テストプレイ統合 + エクスポート/インポート

| # | タスク | ファイル | 見積 |
|---|--------|---------|------|
| 4.1 | `TestPlayOverlay.tsx` 改修（PlayLayout 参照） | apps/editor/components/testplay | 30 min |
| 4.2 | message-window / name-box / choice-window の座標バインド | TestPlayOverlay.tsx | 20 min |
| 4.3 | zIndex の CSS z-index 反映 | TestPlayOverlay.tsx | 10 min |
| 4.4 | 9:16 解像度時のテストプレイ画面サイズ調整 | TestPlayOverlay.tsx | 15 min |
| 4.5 | screen-overlay のランタイム描画 | TestPlayOverlay.tsx | 10 min |
| 4.6 | エクスポート（JSON ダウンロード） | LayoutEditor.tsx | 15 min |
| 4.7 | インポート（JSON アップロード → layout 反映） | LayoutEditor.tsx | 15 min |
| 4.8 | layout 未設定時のフォールバック（rpg-classic） | TestPlayOverlay.tsx | 5 min |

**完了条件**: レイアウトエディタで配置したパーツがテストプレイに反映される。エクスポート/インポートが動作する。

---

## 3. テスト計画（サーバー不要）

| ファイル | ケース数 | 内容 |
|---------|---------|------|
| `layoutHelpers.test.ts` | 10 | snapToGrid / updateElementRect / resolvePreset / export-import round-trip / zIndex 並替 / 9:16 検出 |
| `LayoutEditor.test.tsx` | 5 | プリセット切替 / 要素選択 / 表示切替 / 解像度変更 / 警告バッジ |
| **合計** | **15** | |

---

## 4. タイムライン

```
Step 1 (基盤)           ████████  ~1.5h
Step 2 (キャンバス)     ████████████  ~2h
Step 3 (モック/ツリー)  ████████████████  ~2.5h
Step 4 (統合)           ████████████  ~2h
テスト                  ████  ~0.5h
────────────────────────────────────
合計                    ~8.5h (1日)
```

---

## 5. 依存パッケージ

| パッケージ | バージョン | 用途 | サイズ |
|-----------|----------|------|--------|
| `react-rnd` | ^10.4 | ドラッグ & リサイズ | ~15KB gzip |

他の追加パッケージは不要。カラーピッカーはネイティブ `<input type="color">` + alpha 用スライダーで実装。

---

## 6. リスク管理

| リスク | 影響 | 対策 |
|--------|------|------|
| react-rnd と PixiJS の座標系不整合 | 配置ズレ | react-rnd は CSS ピクセル、PixiJS も論理ピクセル → スケール計算を統一 |
| 9:16 レイアウトでの既存プリセット崩れ | UX 低下 | 解像度変更時にパーツ位置の自動リスケール（rect * newRes / oldRes） |
| パーツ数が多い時のパフォーマンス | 操作遅延 | 最大 20 パーツ（既存 UiElementType 数）なので問題なし |
| エクスポート JSON のバージョン不整合 | インポート失敗 | `version: 1` チェック + 不正時にエラーメッセージ |

---

## 7. 完了条件チェックリスト

### 機能

- [ ] レイアウトタブで 3 カラム表示（ツリー / キャンバス / プロパティ）
- [ ] パーツをドラッグ移動・四隅リサイズできる
- [ ] グリッドスナップ (8px) が動作する
- [ ] 解像度切替（16:9 / 9:16 / 4:3 / 1:1）でキャンバスが変化する
- [ ] 9:16 選択時に「Web/Android 専用」警告が表示される
- [ ] プリセット選択でパーツ配置が一括変更される
- [ ] パーツの表示/非表示を左パネルの目玉アイコンで切替できる
- [ ] 右パネルで座標・opacity・zIndex・options を編集できる
- [ ] 背景色を transparent に設定できる（脱ツクール要件）
- [ ] 枠線を非表示にできる（borderVisible = false）
- [ ] screen-overlay パーツが全画面表示される
- [ ] エクスポート（JSON ダウンロード）が動作する
- [ ] インポート（JSON アップロード）が動作する
- [ ] テストプレイで PlayLayout の座標通りに UI が配置される
- [ ] zIndex がエディタとテストプレイで一致する

### 品質

- [ ] `npm run typecheck` パス
- [ ] 単体テスト 15 件パス
- [ ] 既存テスト（246 件）が壊れていない
