# UI レイアウトエディタ 設計書

**作成日**: 2026-03-16
**目的**: PlayLayout JSON をビジュアルに編集するエディタコンポーネント

---

## 概要

ハンドオーバー資料で「UIレイアウトエディタでメニュー・ウィンドウをノーコードで再設計可能」と記載されているが未実装。
プリセット選択（4→10種）に加えて、各要素の位置・サイズ・表示を GUI で編集できるビジュアルエディタを提供する。

---

## コンポーネント構成

```
LayoutEditor.tsx
├── LayoutPreview（左: 1280x720 Canvas プレビュー）
│   ├── 各 UI 要素を矩形で描画
│   ├── クリックで要素選択
│   └── 選択中の要素をハイライト
├── LayoutPropertyPanel（右: プロパティパネル）
│   ├── プリセット選択ドロップダウン
│   ├── 選択中要素のプロパティ
│   │   ├── x, y（数値入力）
│   │   ├── width, height（数値入力）
│   │   ├── visible（チェックボックス）
│   │   ├── opacity（スライダー 0.0〜1.0）
│   │   └── zIndex（数値入力）
│   └── 要素一覧（全20要素のリスト、クリックで選択）
└── 保存ボタン → project.data.playLayout に JSON 保存
```

---

## 実装詳細

### LayoutEditor.tsx

```typescript
// State
const [layout, setLayout] = useState<PlayLayout>(novelStandard);
const [selectedElement, setSelectedElement] = useState<string | null>(null);

// プリセット変更
const handlePresetChange = (presetName: string) => {
  const preset = UI_PRESETS[presetName];
  if (preset) setLayout(structuredClone(preset));
};

// 要素プロパティ変更
const handleElementChange = (id: string, updates: Partial<UiLayoutElement>) => {
  setLayout(prev => ({
    ...prev,
    elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el),
  }));
};

// 保存
const handleSave = () => {
  // project.data.playLayout に保存
  setProject({ ...project, playLayout: layout } as any);
};
```

### LayoutPreview

Canvas 2D で 1280x720 のプレビュー領域を描画:
- 背景: ダークグレー
- 各要素: 半透明の色付き矩形 + 要素名ラベル
- 選択中の要素: 黄色のボーダー
- クリックイベント: 座標から要素を特定して選択

```typescript
// 要素の色マッピング
const ELEMENT_COLORS: Record<string, string> = {
  'message-window': '#4466aa',
  'name-box': '#44aa66',
  'choice-window': '#aa6644',
  'quick-menu-bar': '#666666',
  // ...
};
```

### LayoutPropertyPanel

選択中の要素のプロパティを数値入力/スライダーで編集:
- rect.x, rect.y: 0〜1280/720 の範囲
- rect.width, rect.height: 10〜1280/720
- visible: チェックボックス
- opacity: 0.0〜1.0 のスライダー（ステップ 0.05）
- zIndex: 0〜200

---

## タブ追加

TabNavigation に「レイアウト」タブ（🎨）を追加:
- Tab 型に `'layout'` を追加
- EditorPage の renderContent に `<LayoutEditor />` を追加

---

## 保存方式

プロジェクト JSON に `playLayout` フィールドとして保存:
```json
{
  "data": {
    "pages": [...],
    "templates": [...],
    "gameDb": {...},
    "playLayout": { ... PlayLayout JSON ... }
  }
}
```

プレビュー時に postMessage で playLayout を渡し、WebOpHandler が applyLayout で適用。

---

## 変更ファイル

| ファイル | 変更 |
|---------|------|
| **新規** `apps/editor/src/components/panels/LayoutEditor.tsx` | メインコンポーネント |
| `apps/editor/src/components/TabNavigation.tsx` | `layout` タブ追加 |
| `apps/editor/src/pages/EditorPage.tsx` | renderContent に追加 |
| `apps/editor/src/store/useEditorStore.ts` | Tab 型に `layout` 追加 |
