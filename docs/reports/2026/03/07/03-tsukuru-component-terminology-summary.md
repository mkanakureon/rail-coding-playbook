# ChatGPT 壁打ち要約: ツクール・Next.js コンポーネント用語

元ファイル: `docs/01_in_specs/2026/03/0307/02_ツクール、Next.js コンポーネント用語.md` (9754行)

---

## 1. React/Next.js コンポーネント用語 (L1-400)

### コンポーネントの props パターン

| パターン | 説明 | 例 |
|---------|------|-----|
| children | 子要素を受け取る | `<Layout>{content}</Layout>` |
| Named slots | 名前付きスロット | `header`, `sidebar`, `footer` を props で渡す |
| Config object | 設定オブジェクト | `config={{ title, items }}` |
| Grid/Dashboard | 配列で構造定義 | `widgets: Widget[]` |
| Next.js layout | ファイルベース | `layout.tsx` + `page.tsx` |

### SPA レイアウト構成 (L320-640)

- Container + Panel 構成が基本
- レスポンシブ対応は grid/flex で制御
- 状態管理は共通の親（または store）に置く

---

## 2. ツクール UI の SPA 設計 (L645-1220)

### ツクールの画面構成を SPA で表現する方法

- ツクール = 固定UIパーツの組み合わせ
- SPA では「ページ遷移」ではなく「パネル切り替え」
- プレイ画面は1つの Container に Scene + UI を重ねる

### ノベルゲームツクールの UI パーツ

- メッセージウィンドウ、名前欄、選択肢、操作ボタン
- 配置は固定 → プリセット → 制約付き自由 の段階で進化

---

## 3. PixiJS/Three.js/Phaser 比較 (L1240-1400)

- **PixiJS**: 2D 特化、軽量、ノベルゲーム向き
- **Three.js**: 3D 向け、ノベルゲームには過剰
- **Phaser**: ゲームフレームワーク、フル機能だが大きい
- **結論**: ノベルゲーム PF には PixiJS が最適

---

## 4. プレイ画面レイヤー構造 (L1400-1920)

### PlayStage アーキテクチャ

```
PlayRoot
├ SceneLayer
│   ├ BackgroundLayer
│   ├ CharacterLayer
│   └ EffectLayer
└ UiLayer
    ├ MessageWindow
    ├ NameBox
    ├ ChoiceWindow
    ├ QuickMenuBar
    ├ ToastNotification
    └ AreaNamePlate
```

### スロット配置システム

- **完全自由配置は危険**: 立ち絵とUI重なり、スマホ崩れ、長文見切れ
- **推奨**: 制約付きスロット配置
- 作者が変更できるのは: 位置、サイズ、表示/非表示、アンカー、透明度、スキン
- 変更できないもの: 背景・立ち絵・演出レイヤー、UI部品の機能

### 実装フェーズ

1. **Phase 1**: ツクール標準風の固定UI
2. **Phase 2**: プリセット切り替え（`UiThemeConfig`）
3. **Phase 3**: 制約付き座標（`BoundedRect` + anchor + offset）

---

## 5. UI レイアウト JSON 設計 (L1920-5400)

### 核心設計: エディタ → JSON → ランタイム

```
ブラウザエディタ → 編集用レイアウトJSON → SDL用固定レイアウトJSON → SDL2ランタイム
```

### 主要型定義

- `UiAnchor`: 9方向アンカー（top-left 〜 bottom-right）
- `UiElementType`: 20種のUI部品（dialog/control/info/support/system の5カテゴリ）
- `UiElementLayout`: 各部品の配置情報（rect, visible, opacity, zIndex, skinId）
- `PlayUiLayout`: 全体レイアウト（version, baseWidth/Height, safeArea, elements）
- `UiConstraint`: 制約定義（moveBounds, min/maxWidth, allowedAnchors）

### UI 部品カテゴリ

| カテゴリ | 部品 |
|---------|------|
| dialog | messageWindow, nameBox, choiceWindow, clickWaitIcon |
| control | quickMenuBar, autoButton, skipButton, logButton, hideUiButton, menuButton |
| info | objectivePanel, questTracker, areaNamePlate, goldWindow, partyStatusPanel, miniMap |
| support | toastNotification, saveIndicator, interactHint |
| system | loadingOverlay, debugOverlay |

### 標準プリセット

- `tsukuru-like-default`: ノベルゲーム標準（メッセージ下、選択肢中央、メニュー右上）
- `rpg-field-default`: RPG フィールド風（goldWindow/partyStatus/miniMap を visible に）

---

## 6. ドラッグ配置エディタ設計 (L1920-2415)

### Unity/IDE 風のドラッグ配置

- GizmoLayer（選択枠 + リサイズハンドル + アンカーマーカー）を UiLayer の上に重ねる
- 制約付き: 各部品に moveBounds、最小/最大サイズ、許可アンカー
- 段階的実装: 選択 → 移動 → リサイズ → スナップ → アンカー

### ブラウザとSDLの役割分担

- **ブラウザ**: 編集（ドラッグ、プロパティ入力、プレビュー）
- **SDL2**: 描画のみ（確定座標を読むだけ、編集機能なし）
- 変換関数 `compileLayoutForSdl()` でエディタ用 → ランタイム用に変換

---

## 7. PixiJS 実装パターン (L5400-6900)

### 固定レイアウト（1280x720）

- `FixedPlayLayout` 型で全部品の x, y, width, height を定義
- `applyPlayLayout()` で LayoutMap に一括適用
- 各 UI クラスに `resize(w, h)` メソッドを実装（Container.width 直接操作は避ける）

### リストUI（ツクール型）

- `ListView` クラス: items, selectedIndex, scrollOffset, visibleRows
- 表示範囲の行だけ描画（仮想スクロール）
- `BaseListView` → `ChoiceListView` / `SaveSlotListView` / `CommandListView` で汎用化

---

## 8. Unity UGUI との比較 (L7647-8040)

### Unity が大変な理由

- RectTransform + Anchor + Pivot + Offset + Stretch の組み合わせが複雑
- LayoutGroup / ContentSizeFitter の自動レイアウトと手動レイアウトの混在
- Canvas Scaler によるスケーリング問題

### kaedevn 方式の利点

- Anchor不要（1280x720固定）
- JSON でレイアウト管理 → git diff 可能、AI 生成と相性良い
- SDL は描画だけ担当、ブラウザエディタが自由に進化可能
- 固定解像度ゲーム（SNES/PS1/RPGツクール）と同じ安定した方式

### 一番大変なのは

UI 配置ではなく **テキストレイアウト**（改行、禁則処理、ruby、ボイス同期、クリック待ち）

---

## 9. ツクール複雑 UI の対応 (L8044-9010)

### ツクール UI は2種類

1. **固定配置UI**: メッセージ、名前欄、HP表示 → 絶対座標で OK
2. **リストUI**: アイテム一覧、スキル、セーブスロット → ListView コンポーネント

### SDL2 で必要な UI 部品は4種類

- Window、List、Button、Panel → これでツクール UI はほぼ再現可能

### 最初に作るべきリスト

1. ChoiceListView（選択肢）
2. CommandListView（メニュー/タイトル）
3. SaveSlotListView（セーブ/ロード）

---

## 10. Switch 解像度・画像設計 (L9010-9600)

### Switch の解像度

| モード | 出力 |
|-------|------|
| 携帯モード | 1280x720 |
| TV モード | 最大 1920x1080 |

### 推奨構成

- **内部解像度**: 1280x720 固定
- **背景画像**: 1920x1080（カメラパン・ズーム演出用）
- **立ち絵**: 高さ 2048px 前後（顔アップ 1.2-1.5倍まで OK）
- **TV モード**: GPU スケーリングで 1080p に拡大
- **4K は不要**: Switch の VRAM が少ないため

### カメラ演出

- PixiJS Container にカメラを入れ、`camera.x/y` でパン、`camera.scale` でズーム
- 背景が 1920x1080 なら横 640px 分のカメラ移動が可能

### UI サイズ目安（TV モードで読みやすく）

| 要素 | 推奨サイズ |
|-----|-----------|
| メッセージ文字 | 28-36px |
| メニュー文字 | 24-32px |
| ボタン高さ | 40px 以上 |

---

## 核心まとめ

この壁打ちから得られた kaedevn の設計方針:

1. **ブラウザエディタ + JSON + SDL2 ランタイム** の3層構造
2. **制約付きスロット配置** で作者に「ある程度の自由」を提供（完全自由配置は避ける）
3. **UI 部品は固定、配置だけ変更可能** にする設計
4. **1280x720 固定** で Switch 携帯モードに最適化、TV は GPU スケーリング
5. **ツクール UI = 固定配置UI + リストUI** の2種類で対応可能
6. **Unity UGUI より実装コストが低い**（Anchor 不要、JSON 管理、AI 生成向き）
