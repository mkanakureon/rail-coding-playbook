# ツクール型エディタ — ランタイム統合ガイド

- **作成日**: 2026-03-13
- **親文書**: `tsukuru-editor-spec.md`
- **用途**: 既存エンジン（WebOpHandler / LayerManager / SDL2）に UiLayer を統合する手順

---

## 1. 現状のアーキテクチャ

### レイヤー構造（LayerManager.ts）

```
root (Container)
├ sceneLayer (Container)     ← カメラ制御対象
│   ├ backgroundLayer
│   ├ characterLayer
│   └ overlayLayer
└ uiLayer (Container)        ← 固定（カメラ非対象）
    ├ TextWindow              ← 現状はここに直接配置
    └ ChoiceOverlay           ← 現状はここに直接配置
```

### 問題点

1. **TextWindow / ChoiceOverlay が uiLayer に直接配置** — 座標がハードコードされている
2. **クイックメニューボタンが存在しない** — MenuScreen（フルスクリーン）のみ
3. **UI 部品が PlayLayout JSON と無関係** — レイアウト変更不可
4. **name-box が TextWindow 内部** — 独立して位置変更できない

---

## 2. 統合の全体像

```
Before:
uiLayer
├ TextWindow (hardcoded position)
└ ChoiceOverlay (hardcoded position)

After:
uiLayer
├ UiLayoutContainer (new)          ← PlayLayout JSON で制御
│   ├ messageWindow (TextWindow)
│   ├ nameBox (NameBox)            ← TextWindow から分離
│   ├ choiceWindow (ChoiceOverlay)
│   ├ clickWaitIcon (ClickWaitIcon)
│   ├ quickMenuBar (QuickMenuBar)
│   │   ├ autoButton
│   │   ├ skipButton
│   │   ├ logButton
│   │   ├ hideUiButton
│   │   └ menuButton
│   ├ toastNotification (ToastNotification)
│   ├ saveIndicator (SaveIndicator)
│   └ loadingOverlay (LoadingOverlay)
└ GameUI (existing, unchanged)     ← メニュー画面群はそのまま
```

---

## 3. 実装手順（Phase 1）

### Step 1: 型定義を packages/core に追加

**ファイル**: `packages/core/src/types/PlayLayout.ts`

```typescript
export type UiElementType =
  | "message-window"
  | "name-box"
  | "choice-window"
  | "click-wait-icon"
  | "auto-button"
  | "skip-button"
  | "log-button"
  | "hide-ui-button"
  | "menu-button"
  | "quick-menu-bar"
  | "toast-notification"
  | "objective-panel"
  | "save-indicator"
  | "loading-overlay"
  | "gold-window"
  | "party-status-panel"
  | "mini-map"
  | "quest-tracker"
  | "interact-hint"
  | "area-name-plate";

export type UiLayoutElement = {
  id: UiElementType;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  opacity: number;
  zIndex: number;
  options?: Record<string, unknown>;
};

export type PlayLayout = {
  version: 1;
  resolution: { width: 1280; height: 720 };
  presetName: string;
  elements: UiLayoutElement[];
};
```

**エクスポート追加**: `packages/core/src/index.ts`

```typescript
export type { PlayLayout, UiLayoutElement, UiElementType } from "./types/PlayLayout";
```

---

### Step 2: プリセット JSON を配置

**ディレクトリ**: `packages/core/src/presets/`

```
packages/core/src/presets/
├ novel-standard.json
├ rpg-classic.json
├ message-top.json
└ message-center.json
```

JSON の内容は `tsukuru-preset-json.md` を参照。

---

### Step 3: applyPlayLayout 関数を実装

**ファイル**: `packages/web/src/renderer/applyPlayLayout.ts`

```typescript
import type { PlayLayout } from "@kaedevn/core";
import type { Container } from "pixi.js";

type UiLayoutMap = Record<string, Container>;

export function applyPlayLayout(
  layoutMap: UiLayoutMap,
  layout: PlayLayout,
): void {
  for (const element of layout.elements) {
    const target = layoutMap[element.id];
    if (!target) continue;

    target.x = element.rect.x;
    target.y = element.rect.y;
    target.visible = element.visible;
    target.alpha = element.opacity;
    target.zIndex = element.zIndex;

    // サイズ変更対応（UI部品が resize メソッドを持っている場合）
    if ("resize" in target && typeof target.resize === "function") {
      target.resize(element.rect.width, element.rect.height);
    }

    // options の適用（UI部品が applyOptions メソッドを持っている場合）
    if (
      element.options &&
      "applyOptions" in target &&
      typeof target.applyOptions === "function"
    ) {
      target.applyOptions(element.options);
    }
  }
}
```

---

### Step 4: UiLayoutContainer を作成

**ファイル**: `packages/web/src/renderer/UiLayoutContainer.ts`

```typescript
import { Container } from "pixi.js";
import type { PlayLayout } from "@kaedevn/core";
import { applyPlayLayout } from "./applyPlayLayout";
// 各 UI 部品の import は省略

export class UiLayoutContainer extends Container {
  readonly layoutMap: Record<string, Container> = {};

  private _layout: PlayLayout | null = null;

  // 各 UI 部品インスタンスへの直接参照
  readonly messageWindow: TextWindow;
  readonly nameBox: NameBox;
  readonly choiceWindow: ChoiceOverlay;
  readonly clickWaitIcon: ClickWaitIcon;
  readonly quickMenuBar: QuickMenuBar;

  constructor() {
    super();
    this.sortableChildren = true;

    // 各 UI 部品を生成して登録
    this.messageWindow = new TextWindow();
    this.nameBox = new NameBox();
    this.choiceWindow = new ChoiceOverlay();
    this.clickWaitIcon = new ClickWaitIcon();
    this.quickMenuBar = new QuickMenuBar();

    // layoutMap に登録
    this.layoutMap["message-window"] = this.messageWindow;
    this.layoutMap["name-box"] = this.nameBox;
    this.layoutMap["choice-window"] = this.choiceWindow;
    this.layoutMap["click-wait-icon"] = this.clickWaitIcon;
    this.layoutMap["quick-menu-bar"] = this.quickMenuBar;
    // ... ボタン群も同様

    // Container に追加
    for (const child of Object.values(this.layoutMap)) {
      this.addChild(child);
    }
  }

  /** PlayLayout を適用 */
  applyLayout(layout: PlayLayout): void {
    this._layout = layout;
    applyPlayLayout(this.layoutMap, layout);
  }

  /** 現在のレイアウトを取得 */
  get layout(): PlayLayout | null {
    return this._layout;
  }
}
```

---

### Step 5: WebOpHandler に統合

**変更ファイル**: `packages/web/src/renderer/WebOpHandler.ts`

```typescript
// Before:
export class WebOpHandler implements IOpHandler {
  private textWindow: TextWindow;
  private choiceOverlay: ChoiceOverlay;
  // ...

  constructor(layers: LayerManager) {
    this.textWindow = new TextWindow();
    this.choiceOverlay = new ChoiceOverlay();
    layers.uiLayer.addChild(this.textWindow);
    layers.uiLayer.addChild(this.choiceOverlay);
  }
}

// After:
export class WebOpHandler implements IOpHandler {
  private uiLayout: UiLayoutContainer;
  // textWindow / choiceOverlay は uiLayout 経由でアクセス

  constructor(layers: LayerManager, layout?: PlayLayout) {
    this.uiLayout = new UiLayoutContainer();
    layers.uiLayer.addChild(this.uiLayout);

    // デフォルトレイアウトを適用
    if (layout) {
      this.uiLayout.applyLayout(layout);
    } else {
      this.uiLayout.applyLayout(novelStandardPreset);
    }
  }

  // 既存メソッドは uiLayout 経由に書き換え
  async textAppend(who: string | undefined, text: string): Promise<void> {
    this.uiLayout.messageWindow.appendText(who, text);
  }

  async choice(options: string[]): Promise<number> {
    return this.uiLayout.choiceWindow.show(options);
  }
}
```

**既存コードへの影響を最小化するポイント**:
- `textWindow` → `this.uiLayout.messageWindow` に置換
- `choiceOverlay` → `this.uiLayout.choiceWindow` に置換
- 外部 API（IOpHandler メソッド）は変更なし

---

### Step 6: LayerManager の変更

**変更ファイル**: `packages/web/src/renderer/LayerManager.ts`

変更は最小限。`uiLayer` はそのまま使い、`UiLayoutContainer` を子として追加するだけ。

```typescript
// LayerManager は変更なし。
// WebOpHandler が UiLayoutContainer を uiLayer に addChild する。
```

---

### Step 7: プロジェクト設定に PlayLayout を追加

**API 側**:

```typescript
// PUT /api/projects/:id のリクエストボディに playLayout を追加
{
  "data": {
    "pages": [...],       // 既存（ブロックエディタ）
    "playLayout": {...},  // 新規（ツクール型エディタ）
    "characters": [...]   // 既存
  }
}
```

**DB 側**: `data` カラム（JSON型）に格納。スキーマ変更不要。

---

## 4. TextWindow の分離リファクタリング

現在の TextWindow は name-box と click-wait-icon を内部に持っている。Phase 1 では PlayLayout で位置を上書きできるようにする。

### 方針A: 段階的分離（推奨）

```
Phase 1:
  TextWindow は現行のまま。PlayLayout の rect で TextWindow 全体を移動。
  name-box / click-wait-icon の位置は TextWindow 内部の相対座標で自動計算。

Phase 2:
  NameBox を独立 Container に分離。
  TextWindow.nameText → 外部の NameBox に移行。
  click-wait-icon は TextWindow 内部のまま（仕様上、常にウィンドウ内）。
```

### 方針B: 一括分離（非推奨）

- 全 UI 部品を一度に Container 化すると影響範囲が大きい
- name-box 分離は message-window との位置関係の再計算が必要
- Phase 1 では方針 A を採用し、動くものを先に作る

---

## 5. SDL2 側の対応

### 5-1. SDL2 が受け取る JSON

Web と完全に同じ `PlayLayout` JSON を使う。差分なし。

### 5-2. SDL2 側の実装方針

```c
// C 言語 / SDL2 の疑似コード

typedef struct {
    const char* id;
    int x, y, width, height;
    bool visible;
    float opacity;
    int zIndex;
} UiElement;

void apply_play_layout(UiElement* elements, int count, GameUI* ui) {
    for (int i = 0; i < count; i++) {
        SDL_Rect* target = find_ui_rect(ui, elements[i].id);
        if (!target) continue;
        target->x = elements[i].x;
        target->y = elements[i].y;
        target->w = elements[i].width;
        target->h = elements[i].height;
        // visible / opacity は描画時に参照
    }
}
```

### 5-3. Web → SDL2 の座標変換

**変換不要**。両方とも 1280×720 の絶対座標。

- Web: PixiJS の `Container.x/y` に直接代入
- SDL2: `SDL_Rect.x/y/w/h` に直接代入

Switch の画面解像度（1920×1080 等）へのスケーリングは SDL2 レンダラー側で行う（JSON の値は変えない）。

---

## 6. エディタ（ブラウザ）→ ランタイム のデータフロー

```
[ブラウザエディタ]
    │
    │ 1. 作者がプリセット選択 or ドラッグ編集
    │
    ▼
[PlayLayout JSON]
    │
    │ 2. PUT /api/projects/:id  { data: { playLayout: {...} } }
    │
    ▼
[API サーバー]
    │
    │ 3. DB に保存（data JSON カラム内）
    │
    ▼
[ランタイム読み込み]
    │
    ├── 4a. Web: GET /api/projects/:id → playLayout を取得
    │         → applyPlayLayout(layoutMap, playLayout)
    │
    └── 4b. SDL2: ビルド時に JSON をバンドル
              → apply_play_layout() で適用
```

---

## 7. テスト計画

### Unit テスト

| テスト | 内容 |
|--------|------|
| applyPlayLayout | 全要素の x/y/visible/opacity/zIndex が正しく適用されるか |
| プリセットJSON | 全プリセットが PlayLayout 型に適合するか（Zod バリデーション） |
| UiLayoutContainer | layoutMap に全キーが登録されているか |

### E2E テスト

| テスト | 内容 |
|--------|------|
| プリセット適用 | ノベル標準プリセットで TextWindow が y=520 に配置されるか |
| プリセット切替 | RPG プリセットに切り替えて gold-window が表示されるか |
| 保存・復元 | PlayLayout を保存 → 再読み込みで同じレイアウトが復元されるか |
| プレビュー | レイアウト変更がプレビュー画面に反映されるか |

---

## 8. 影響範囲チェックリスト

### 変更するファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/core/src/types/PlayLayout.ts` | 新規：型定義 |
| `packages/core/src/index.ts` | 追加：export |
| `packages/core/src/presets/*.json` | 新規：プリセット JSON |
| `packages/web/src/renderer/applyPlayLayout.ts` | 新規：適用関数 |
| `packages/web/src/renderer/UiLayoutContainer.ts` | 新規：コンテナ |
| `packages/web/src/renderer/WebOpHandler.ts` | 変更：UiLayoutContainer 経由に |
| `apps/hono/src/routes/projects.ts` | 変更：playLayout の保存・返却 |

### 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `LayerManager.ts` | uiLayer はそのまま使う |
| `TextWindow.ts` | Phase 1 では内部構造を変えない |
| `ChoiceOverlay.ts` | Phase 1 では内部構造を変えない |
| `GameUI.ts` | メニュー画面群はそのまま |
| `OpRunner.ts` | Op の dispatch ロジックは変更なし |
| `IOpHandler.ts` | インターフェースは変更なし |

---

## 9. 移行スケジュール

```
Phase 1（最小構成）:
  ├ Step 1-2: 型定義 + プリセット JSON          ← 影響なし、先に入れられる
  ├ Step 3:   applyPlayLayout 関数             ← 影響なし
  ├ Step 4:   UiLayoutContainer                ← 影響なし（使わなければ動かない）
  ├ Step 5:   WebOpHandler 統合                ← ★ ここが最大の変更点
  ├ Step 6:   LayerManager（変更なし）
  └ Step 7:   API に playLayout 保存            ← DB スキーマ変更なし

Phase 2（プリセット切替）:
  ├ プロジェクト設定 UI にプリセット選択を追加
  └ 通知系 UI 部品の実装

Phase 3（RPG 拡張 + 制約付き設定）:
  ├ RPG 系 UI 部品の実装
  ├ name-box の独立化
  └ エディタ UI（ドロップダウン / トグル）
```

**Phase 1 の核心**: Step 5（WebOpHandler 統合）だけが既存コードに影響する変更。
それ以外は全て新規追加なので、段階的に入れられる。
