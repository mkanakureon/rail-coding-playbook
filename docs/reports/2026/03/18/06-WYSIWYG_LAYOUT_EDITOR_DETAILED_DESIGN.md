# WYSIWYG UI レイアウトエディタ 詳細設計書

> **作成日**: 2026-03-18
> **担当**: Claude Code (Opus 4.6)
> **前提文書**:
> - `20-NEXT_GEN_FEATURES_PRIORITY_PLAN.md` — 次世代機能優先度（1位: レイアウトエディタ）
> - `21-NEXT_GEN_UI_LAYOUT_EDITOR_DESIGN.md` — UI レイアウトエディタ概念設計
> - `23-CLAUDE_CODE_STRATEGIC_DIRECTIVES.md` — 戦略的要件（スマホ縦持ち・脱ツクール・テンプレート）
> - `24-UI_LAYOUT_SPEC_REVISIONS_SUMMARY.md` — L3 レビュー修正（options 型安全・9:16 制約・zIndex 責務）
> **目的**: 実装可能な粒度に落とし込む。戦略的要件 3 点 + L3 レビュー修正 3 点を全て設計に組み込む

---

## 0. 既存資産の棚卸し

| 資産 | パス | 状態 |
|------|------|------|
| `PlayLayout` 型 | `packages/core/src/types/PlayLayout.ts` | 完成（19 パーツ型 + rect/visible/opacity/zIndex/options） |
| `UiLayoutElement` 型 | 同上 | 完成 |
| プリセット 10 種 | `packages/core/src/presets/*.json` | 完成（rpg-classic 含む、各パーツの座標・options 定義済み） |
| `UI_PRESETS` レジストリ | `packages/core/src/presets/index.ts` | 完成 |
| レイアウトタブ（プレースホルダー） | `TsukuruEditorPage.tsx` の `layout` タブ | 空 UI（「Phase 5 で実装予定」表示） |
| `useTsukuruStore` | `apps/editor/src/store/useTsukuruStore.ts` | layout 状態未追加 |
| `TestPlayOverlay` | `apps/editor/src/components/testplay/TestPlayOverlay.tsx` | ハードコード配置（PlayLayout 未参照） |

**結論**: PlayLayout 型とプリセット JSON が完備されているため、主な作業は「エディタ UI」と「テストプレイへの反映」。

---

## A. 戦略的要件の設計への反映

`23-CLAUDE_CODE_STRATEGIC_DIRECTIVES.md` で指示された 3 つの必須要件を、設計の各所に組み込む。

### 要件 1: スマホ縦持ち（9:16）レイアウトの完全サポート

**ゴール**: PC（16:9）だけでなく、スマホ縦持ち（9:16）をプリセットから選択・編集できる。

| 反映箇所 | 変更内容 |
|---------|---------|
| PlayLayout.resolution | 既存の `1280×720` に加え `720×1280` (9:16) をサポート |
| キャンバス | resolution に応じてアスペクト比が自動切替（16:9 / 9:16 / 1:1） |
| プリセット追加 | `smartphone-portrait` (9:16) プリセットを新規作成 |
| パーツ配置 | 9:16 時、メッセージウィンドウを下部 1/3、仮想パッドを下部に自動配置 |
| 解像度セレクタ | ツールバーに `[1280×720 ▾]` ドロップダウンを追加 |

**解像度プリセット**:
```typescript
const RESOLUTION_PRESETS = [
  { label: 'PC 横 (16:9)', width: 1280, height: 720, platforms: ['web', 'switch', 'android'] },
  { label: 'PC ワイド (21:9)', width: 1680, height: 720, platforms: ['web'] },
  { label: 'スマホ 縦 (9:16)', width: 720, height: 1280, platforms: ['web', 'android'] },
  { label: 'タブレット (4:3)', width: 1024, height: 768, platforms: ['web', 'android'] },
  { label: '正方形 (1:1)', width: 720, height: 720, platforms: ['web', 'android'] },
];
```

**プラットフォーム制約**（L3 レビュー反映）:

| プラットフォーム | 9:16 対応 | 備考 |
|----------------|----------|------|
| **PixiJS (Web / Android)** | ✅ 対応 | Viewport スケーリングで 9:16 レンダリング |
| **SDL2 (Switch / ネイティブ)** | ❌ 非対応 | Switch は横長固定（1280×720） |

**警告表示**: 縦持ちレイアウト（height > width）選択時にバッジを表示:
```
⚠️ このレイアウトは Web / Android 専用です（Switch では利用できません）
```
```

**スマホ向けパーツ**:
- `interact-hint` を大きめの仮想ボタンとして配置（親指操作圏 = 画面下部 1/4）
- `message-window` を画面上部 1/3 に配置（下部はコントロール領域）

### 要件 2: 「脱・ツクール」スタイリング自由度

**ゴール**: 量産型 UI から脱却し、モダンなインディーゲーム風の画面を作れる。

| 反映箇所 | 変更内容 |
|---------|---------|
| options 拡張 | 全パーツに `borderWidth`, `borderColor`, `borderRadius`, `borderStyle` を追加 |
| 背景透明化 | `backgroundColor: 'transparent'` を選択可能に |
| 全画面オーバーレイ | `screen-overlay` パーツを追加（画面全体に半透明の黒幕等を敷ける） |
| フォント選択 | `fontFamily` オプション（ゴシック / 明朝 / 手書き風 / カスタム） |
| プロパティ UI | カラーピッカーに alpha チャンネル対応 |

**`UiElementOptions` 型定義**（L3 レビューに基づく型安全化）:
```typescript
/** 全パーツ共通の型安全なオプション（Record<string, unknown> の具体化） */
type UiElementOptions = {
  // 背景
  backgroundColor?: string;       // 'rgba(0,0,0,0.7)' or 'transparent'
  backgroundOpacity?: number;     // 0.0〜1.0（背景のみの不透明度）
  // 枠線
  borderVisible?: boolean;        // false = 枠なし（ウィンドウスキン非表示）
  borderWidth?: number;           // 0 = 枠なし
  borderColor?: string;
  borderRadius?: number;          // 0 = 角なし
  borderStyle?: 'solid' | 'dashed' | 'none';
  // テキスト
  fontFamily?: string;            // 'gothic' | 'mincho' | 'handwriting' | string
  textColor?: string;
  fontSize?: number;
  // レイアウト
  padding?: number;
  shadow?: string;                // CSS box-shadow 値
  // パーツ固有（下位互換）
  [key: string]: unknown;
};
```

> **注**: `UiLayoutElement.options` の型は `Record<string, unknown>` のまま維持し、
> エディタ側で `as UiElementOptions` にキャストして使用する。
> これにより既存プリセット JSON との互換性を保ちつつ、エディタ UI では型安全に操作できる。

### 要件 3: テンプレート（プリセット）の保存と展開

**ゴール**: 公式テンプレートをワンクリック適用 + ユーザーが自作レイアウトを保存・共有できる。

| 反映箇所 | 変更内容 |
|---------|---------|
| プリセット選択 UI | ツールバーにドロップダウン + サムネイルプレビュー |
| エクスポート | 「レイアウトを保存」ボタン → PlayLayout JSON をダウンロード |
| インポート | 「レイアウトを読込」ボタン → JSON ファイルアップロード → layout に適用 |
| 公式プリセット拡張 | 既存 10 種 + `smartphone-portrait` + `modern-minimal` + `cinematic-wide` |
| `presetName` 活用 | プリセット適用時に `presetName` を記録。カスタム時は `'custom'` |

**ツールバー UI**:
```
[解像度: 1280×720 ▾] [プリセット: RPGクラシック ▾] [💾 保存] [📂 読込] [↺ リセット]
```

---

## 1. データモデル

### 1.1 PlayLayout（拡張）

```typescript
// packages/core/src/types/PlayLayout.ts
// 既存型はそのまま維持。UiElementType に screen-overlay を追加。
type PlayLayout = {
  version: 1;
  resolution: { width: number; height: number };  // 1280×720 or 720×1280 等（要件1）
  presetName: string;                              // 'custom' = カスタム（要件3）
  elements: UiLayoutElement[];
};

type UiLayoutElement = {
  id: UiElementType;       // 既存 19 種 + "screen-overlay"（要件2）
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
  opacity: number;         // 0.0〜1.0
  zIndex: number;
  options?: Record<string, unknown>;  // パーツ固有 + CommonStyleOptions（要件2）
};
```

**変更点（既存型への追加）**:
- `UiElementType` に `"screen-overlay"` を追加（画面全体の半透明オーバーレイ）
- `resolution` に 9:16 等の縦長解像度を許容（型は変更なし、値の範囲が拡大）
- `options` に `CommonStyleOptions` のプロパティを格納（型は `Record<string, unknown>` のまま）

### 1.2 ストア拡張

```typescript
// useTsukuruStore.ts に追加
type TsukuruState = {
  // ... 既存
  layout: PlayLayout;
  setLayout: (layout: PlayLayout) => void;
  updateElement: (id: UiElementType, updates: Partial<UiLayoutElement>) => void;
  updateElementRect: (id: UiElementType, rect: Partial<UiLayoutElement['rect']>) => void;
  selectedElementId: UiElementType | null;
  setSelectedElementId: (id: UiElementType | null) => void;
};
```

初期値は `UI_PRESETS['rpg-classic']`。

---

## 2. コンポーネント構成

```
TsukuruEditorPage [tab=layout]
├── LayoutElementTree     ← 左パネル (w-52): パーツ一覧 + 表示切替 + z-index 並替
├── LayoutCanvas          ← 中央: 1280×720 プレビュー + ドラッグ & リサイズ
│   ├── LayoutCanvasGrid  ← グリッドスナップ (8px / 16px)
│   └── LayoutElement[]   ← 各パーツの矩形（react-rnd）
└── LayoutPropertyPanel   ← 右パネル (w-72): 座標・サイズ・opacity・options 編集
```

### 2.1 ファイル一覧

| ファイル | 種別 | 行数見込 | 内容 |
|---------|------|---------|------|
| `components/layout/LayoutEditor.tsx` | Page | ~120 | 3 カラムシェル + 解像度セレクタ + プリセット選択 + エクスポート/インポート |
| `components/layout/LayoutElementTree.tsx` | UI | ~100 | パーツ一覧 + 目玉アイコン + D&D 並替 |
| `components/layout/LayoutCanvas.tsx` | UI | ~150 | 1280×720 キャンバス + react-rnd 統合 |
| `components/layout/LayoutElement.tsx` | UI | ~80 | 個別パーツの枠描画 + モック表示 |
| `components/layout/LayoutPropertyPanel.tsx` | UI | ~120 | 座標/サイズ/opacity/options フォーム |
| `components/layout/elementMocks.tsx` | UI | ~150 | 各パーツのモック表示コンポーネント |

---

## 3. 画面レイアウト

### 3.1 全体

```
┌──────────────────────────────────────────────────────────────┐
│ 🖼 レイアウト  [1280×720 ▾] [RPGクラシック ▾] [💾保存][📂読込][↺リセット] │
├────────────┬────────────────────────────────┬─────────────────┤
│            │                                │                 │
│  パーツ一覧 │    1280 × 720 キャンバス        │  プロパティ      │
│  (w-52)    │    (中央、スケール表示)           │  (w-72)         │
│            │                                │                 │
│ 👁 message │  ┌──────────────────────────┐  │  ■ 座標・サイズ  │
│ 👁 name-box│  │                          │  │  X: [40]        │
│ 👁 choice  │  │     ゲーム画面            │  │  Y: [520]       │
│ 👁 gold    │  │                          │  │  W: [1200]      │
│ 👁 party   │  │  ┌────────────────────┐  │  │  H: [180]       │
│ 👁 mini-map│  │  │  メッセージウィンドウ │  │  │                │
│ 👁 interact│  │  └────────────────────┘  │  │  ■ 表示          │
│            │  │                          │  │  不透明度: ██░ 85%│
│ [＋ 追加]   │  └──────────────────────────┘  │  zIndex: [100]   │
│            │                                │                 │
│            │  グリッド: [☑ 8px] ズーム: [75%]  │  ■ オプション    │
│            │                                │  スタイル: [ADV▾] │
│            │                                │  余白: [20]      │
│            │                                │  文字サイズ: [24] │
└────────────┴────────────────────────────────┴─────────────────┘
```

### 3.2 キャンバス上のパーツ表示

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──────┐                                              │
│  │ 🎮 G │ ← gold-window (160×44)                       │
│  └──────┘                                              │
│                         ┌──────────┐                   │
│                         │  HP ████ │ ← party-status    │
│                         │  MP ████ │    (250×120)       │
│                         └──────────┘                   │
│                                                        │
│               ┌──────────────┐                         │
│               │ はい          │ ← choice-window        │
│               │ いいえ        │    (500×300, hidden)    │
│               └──────────────┘                         │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [勇者]                                           │  │
│  │ 宝箱を開けた！ポーションを手に入れた！             │  │  ← message-window
│  │                                          ▼       │  │    (1200×180)
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 3.3 選択状態

選択中のパーツは:
- **青い枠線** (2px solid #4488ff)
- **四隅にリサイズハンドル** (8×8 の白い四角)
- 右パネルに詳細プロパティが表示

非選択パーツは:
- **灰色の点線枠** (1px dashed rgba(255,255,255,0.3))
- ホバーで枠が白くなる

非表示パーツ (visible=false):
- **赤い点線枠** + 半透明 (opacity 0.2)
- 「非表示」ラベル表示

---

## 4. 操作仕様

### 4.1 キャンバス操作

| 操作 | 動作 |
|------|------|
| パーツをクリック | 選択（右パネルにプロパティ表示） |
| パーツをドラッグ | 移動（グリッドスナップ適用） |
| 四隅をドラッグ | リサイズ（グリッドスナップ適用） |
| キャンバスの空白クリック | 選択解除 |
| Delete キー | 選択パーツを非表示にする（削除ではなく visible=false） |
| Ctrl+Z / Ctrl+Y | Undo / Redo |

### 4.2 グリッドスナップ

```typescript
const SNAP_SIZE = 8; // or 16

function snapToGrid(value: number, snap: number): number {
  return Math.round(value / snap) * snap;
}
```

オプションでトグル可能（デフォルト ON、8px）。

### 4.3 プリセット選択

ツールバーのドロップダウンからプリセットを切り替え:

```typescript
const presets = [
  { id: 'rpg-classic', label: 'RPGクラシック' },
  { id: 'rpg-battle', label: 'RPGバトル' },
  { id: 'rpg-field', label: 'RPGフィールド' },
  { id: 'novel-standard', label: 'ノベル標準' },
  { id: 'minimal', label: 'ミニマル' },
];
```

選択時は確認ダイアログ（「現在のレイアウトを上書きしますか？」）を表示。

---

## 5. 各パーツのモック表示

### 5.1 パーツタイプ別モック

| パーツ | モック表示 | options で制御 |
|--------|----------|---------------|
| `message-window` | 青黒半透明の角丸矩形 + ダミーテキスト 3 行 | style(adv/nvl), fontSize, padding, bgColor |
| `name-box` | 小さい角丸矩形 + 「勇者」テキスト | fontSize, bgColor |
| `choice-window` | ボタン 3 つ縦並び（はい/いいえ/キャンセル） | buttonWidth, buttonHeight, buttonGap |
| `gold-window` | コインアイコン + 「1,200 G」 | icon, fontSize, textColor |
| `party-status-panel` | HP/MP ゲージ × 4 人分 | gaugeColor, faceGraphic |
| `mini-map` | グレーの格子状プレースホルダー | — |
| `interact-hint` | 「Aボタンで話す」テキスト + アイコン | — |
| `click-wait-icon` | ▼ アニメーション（pulse） | animationType, shape |
| `quick-menu-bar` | AUTO / SKIP / LOG / HIDE / MENU ボタン並び | layout(horizontal/vertical) |
| その他 | パーツ名テキスト + 点線枠 | — |

### 5.2 elementMocks.tsx の構造

```typescript
export function renderElementMock(element: UiLayoutElement): React.ReactNode {
  switch (element.id) {
    case 'message-window': return <MessageWindowMock element={element} />;
    case 'name-box': return <NameBoxMock element={element} />;
    case 'gold-window': return <GoldWindowMock element={element} />;
    case 'party-status-panel': return <PartyStatusMock element={element} />;
    case 'choice-window': return <ChoiceWindowMock element={element} />;
    // ... 残りはジェネリック表示
    default: return <GenericMock element={element} />;
  }
}
```

---

## 6. 右パネル（プロパティインスペクタ）

### 6.1 共通プロパティ

全パーツ共通:

```
■ 座標・サイズ
  X: [___]  Y: [___]
  W: [___]  H: [___]

■ 表示
  不透明度: ████░░░░ [0.85]  (スライダー + 数値入力)
  zIndex:   [100]
  表示:     [☑ 表示する]
```

### 6.2 パーツ固有 options

パーツによって表示する options フォームが変わる:

**共通スタイル**（全パーツに表示 — 要件 2「脱ツクール」対応）:
```
■ スタイル（共通）
  背景色:    [        ] [🎨] [alpha ██░ 70%]  ← 'transparent' 選択可
  枠線:      [solid ▾] [1]px [#ffffff]         ← 'none' で枠なし
  角丸:      [8] px                           ← 0 = 四角
  影:        [☐ ドロップシャドウ]
  フォント:   [ゴシック ▾]                      ← gothic / mincho / handwriting
```

**message-window**:
```
■ メッセージウィンドウ設定
  スタイル: [ADV ▾]    (ADV / NVL / 透明)
  余白:     [20] px
  文字サイズ: [24] px
  文字色:    [#ffffff] (カラーピッカー)
  行間:      [1.6]
```

**party-status-panel**:
```
■ パーティステータス設定
  HP ゲージ色: [#22c55e]
  MP ゲージ色: [#3b82f6]
  顔グラフィック: [☑ 表示]
  表示人数:     [4]
```

**choice-window**:
```
■ 選択肢設定
  ボタン幅: [400] px
  ボタン高さ: [50] px
  ボタン間隔: [12] px
  背景暗転: [☑]
```

---

## 7. テストプレイへの反映（ランタイム統合）

### 7.1 現状の TestPlayOverlay

テキストダイアログと選択肢がハードコードの Tailwind クラスで配置:
```tsx
// 現状（ハードコード）
<div className={`absolute left-4 right-4 ... ${
  position === 'bottom' ? 'bottom-4' : ...
}`}>
```

### 7.2 改修後

PlayLayout の座標で絶対配置:
```tsx
// 改修後
const msgEl = layout.elements.find(e => e.id === 'message-window');
if (msgEl && msgEl.visible) {
  <div style={{
    position: 'absolute',
    left: msgEl.rect.x * scale,
    top: msgEl.rect.y * scale,
    width: msgEl.rect.width * scale,
    height: msgEl.rect.height * scale,
    opacity: msgEl.opacity,
    zIndex: msgEl.zIndex,
  }}>
    {/* テキスト表示 */}
  </div>
}
```

`scale` = キャンバス表示サイズ / resolution.width で計算。

### 7.2.1 zIndex のマスターデータ責務（L3 レビュー反映）

`UiLayoutElement.zIndex` は **PixiJS (WebGL) レンダリングにおける重なり順のマスターデータ**。

| レイヤー | 振る舞い |
|---------|---------|
| **エディタ（React）** | `zIndex` 値をそのまま CSS `z-index` に反映し、PixiJS での結果を WYSIWYG にシミュレーション |
| **ランタイム（PixiJS）** | `zIndex` 値を `pixi.displayObject.zIndex` にセットして実描画 |

これにより、エディタ上での見た目とテストプレイ時の見た目が**完全に一致**する。

### 7.3 対象パーツ（テストプレイで実際に動くもの）

| パーツ | Phase 4 で実装済み | 配置ソース |
|--------|------------------|-----------|
| message-window | ✅ textDialog | PlayLayout → absolute |
| name-box | ✅ (speaker 表示) | PlayLayout → absolute |
| choice-window | ✅ choicesDialog | PlayLayout → absolute |
| click-wait-icon | ✅ (▼ アニメ) | PlayLayout → absolute |
| gold-window | — | GameState.gold 表示 |
| party-status-panel | — | GameState.party + ActorDef 表示 |

---

## 7.5 新規プリセット: smartphone-portrait（要件 1）

```json
{
  "version": 1,
  "resolution": { "width": 720, "height": 1280 },
  "presetName": "smartphone-portrait",
  "elements": [
    {
      "id": "message-window",
      "rect": { "x": 20, "y": 40, "width": 680, "height": 200 },
      "visible": true, "opacity": 0.85, "zIndex": 100,
      "options": { "style": "adv", "padding": 16, "fontSize": 20,
                   "backgroundColor": "rgba(0,0,0,0.8)", "borderRadius": 12 }
    },
    {
      "id": "name-box",
      "rect": { "x": 30, "y": 15, "width": 180, "height": 28 },
      "visible": true, "opacity": 1.0, "zIndex": 110
    },
    {
      "id": "choice-window",
      "rect": { "x": 110, "y": 400, "width": 500, "height": 350 },
      "visible": false, "opacity": 1.0, "zIndex": 200,
      "options": { "buttonWidth": 460, "buttonHeight": 60, "buttonGap": 16 }
    },
    {
      "id": "interact-hint",
      "rect": { "x": 160, "y": 1080, "width": 400, "height": 160 },
      "visible": true, "opacity": 0.7, "zIndex": 90,
      "options": { "layout": "virtual-pad", "buttonSize": 64 }
    },
    {
      "id": "party-status-panel",
      "rect": { "x": 520, "y": 260, "width": 180, "height": 400 },
      "visible": true, "opacity": 0.8, "zIndex": 80,
      "options": { "layout": "vertical", "compact": true }
    },
    {
      "id": "gold-window",
      "rect": { "x": 540, "y": 680, "width": 160, "height": 40 },
      "visible": true, "opacity": 0.9, "zIndex": 85
    },
    {
      "id": "screen-overlay",
      "rect": { "x": 0, "y": 0, "width": 720, "height": 1280 },
      "visible": false, "opacity": 0.0, "zIndex": 50,
      "options": { "backgroundColor": "rgba(0,0,0,0.3)" }
    }
  ]
}
```

**レイアウト概念図（9:16 縦持ち）**:
```
┌──────────────────┐
│ [名前]            │ ← 上部 1/4: メッセージ領域
│ ┌──────────────┐ │
│ │ メッセージ     │ │
│ └──────────────┘ │
│                  │
│        ┌────┐   │ ← 中央: ゲーム画面
│        │パーティ│  │
│        │ステータス│ │
│        └────┘   │
│                  │
│ ┌──────────────┐ │ ← 下部 1/4: コントロール領域
│ │  仮想パッド    │ │    （親指操作圏）
│ │  ← ↑ → ↓     │ │
│ │  [A] [B]      │ │
│ └──────────────┘ │
└──────────────────┘
```

## 7.6 screen-overlay パーツ（要件 2: 新規）

全画面を覆う半透明レイヤー。モダンな UI 演出に使用:

- **用途**: シーン切替時の暗転、会話中の背景ぼかし風、ステータス画面の背景
- **デフォルト**: visible=false, opacity=0
- **テストプレイ**: visible=true + opacity>0 の場合、ゲーム画面全体に薄い色を敷く

## 7.7 エクスポート / インポート（要件 3）

```typescript
// エクスポート
function exportLayout(layout: PlayLayout): void {
  const json = JSON.stringify(layout, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `layout-${layout.presetName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// インポート
function importLayout(file: File): Promise<PlayLayout> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const layout = JSON.parse(reader.result as string) as PlayLayout;
        if (layout.version !== 1 || !layout.elements) throw new Error('Invalid layout');
        resolve(layout);
      } catch (e) { reject(e); }
    };
    reader.readAsText(file);
  });
}
```

---

## 8. 実装ステップ

### Step 1: ストア + シェル + 解像度/プリセット（0.5 日）

1. `useTsukuruStore.ts` に `layout` / `updateElement` / `selectedElementId` 追加
2. `LayoutEditor.tsx` 作成（3 カラムシェル + **解像度セレクタ** + プリセット選択 + エクスポート/インポート）
3. `TsukuruEditorPage.tsx` のレイアウトタブを `LayoutEditor` に差し替え
4. `UiElementType` に `"screen-overlay"` を追加
5. `smartphone-portrait` プリセット JSON を `packages/core/src/presets/` に追加

### Step 2: キャンバス + react-rnd（1 日）

1. `npm install react-rnd -w apps/editor`
2. `LayoutCanvas.tsx` 作成（**resolution に応じたアスペクト比**でスケール表示 + グリッドオーバーレイ）
3. `LayoutElement.tsx` 作成（react-rnd で各パーツを描画、ドラッグ & リサイズ）
4. ストアへの双方向バインド（ドラッグ → updateElementRect → 再描画）
5. `screen-overlay` パーツの全画面表示対応

### Step 3: パーツモック + ツリー + プロパティ（1 日）

1. `elementMocks.tsx` 作成（主要 7 パーツ + screen-overlay + interact-hint 仮想パッドのモック表示）
2. `LayoutElementTree.tsx` 作成（パーツ一覧 + 表示切替 + z-index D&D）
3. `LayoutPropertyPanel.tsx` 作成（座標 / opacity / **CommonStyleOptions** / パーツ固有 options フォーム）
4. カラーピッカー（alpha 対応）+ 枠線スタイル + フォント選択を追加

### Step 4: テストプレイ統合 + エクスポート/インポート（0.5 日）

1. `TestPlayOverlay.tsx` を改修（ハードコード → PlayLayout 参照）
2. layout が未設定の場合はデフォルトプリセット（rpg-classic）にフォールバック
3. 9:16 解像度時のテストプレイ画面サイズ自動調整（要件 1）
4. エクスポート/インポート機能（JSON ファイル保存・読込）（要件 3）
5. screen-overlay のランタイム描画対応（要件 2）

---

## 9. 依存パッケージ

| パッケージ | 用途 | サイズ |
|-----------|------|--------|
| `react-rnd` | ドラッグ & リサイズ | ~15KB gzip |

`react-rnd` は `react-draggable` + `re-resizable` のラッパーで、実績豊富（GitHub 3.8k stars）。

代替案: 自前実装（mousedown/mousemove/mouseup）。react-rnd の方が四隅リサイズ・境界制限・グリッドスナップが組み込み済みで工数削減。

---

## 10. テスト計画（サーバー不要）

| ファイル | ケース数 | 内容 |
|---------|---------|------|
| `LayoutEditor.test.tsx` | 5 | プリセット切替・要素選択・表示切替 |
| `layoutHelpers.test.ts` | 8 | snapToGrid・rect 更新・z-index 並替・プリセットロード |

---

## 11. 未決定事項

| # | 項目 | 選択肢 | 推奨 |
|---|------|--------|------|
| 1 | カラーピッカー | ネイティブ `<input type="color">` / 外部ライブラリ | **ネイティブ**（依存なし、十分） |
| 2 | Undo/Redo | 専用の layout history / 既存ストアの undo と統合 | **専用 history**（layout 変更頻度が高い） |
| 3 | カスタムパーツ | ユーザーが独自パーツを追加できるか | **スコープ外**（20 種で十分。将来は画像パーツとして対応検討） |
| 4 | アニメーション設定 | パーツの出現/退出アニメ | **スコープ外**（Phase 後に検討） |
| 5 | 仮想パッドの詳細設計 | ボタン配置・サイズ・感度 | **Step 3 で基本形**、詳細は Switch 移植時に決定 |
| 6 | レイアウト共有マーケット | ユーザー間でレイアウトを共有 | **将来**（エクスポート/インポートで JSON 共有は即日可能） |
