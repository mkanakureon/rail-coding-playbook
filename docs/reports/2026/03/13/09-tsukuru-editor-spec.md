# ツクール型エディタ仕様書

- **作成日**: 2026-03-13
- **ステータス**: 検討段階（既存ブロックエディタとは別プロダクト）
- **情報源**: `ツクール、Next.js コンポーネント用語.md`（ChatGPT 会話ログ 9,754行）

---

## 1. 位置づけ

| 項目 | 既存エディタ（apps/editor） | ツクール型エディタ（本仕様） |
|------|--------------------------|--------------------------|
| 対象 | シナリオ（ブロック編集） | プレイ画面UI（レイアウト編集） |
| 編集単位 | ブロック（14型） | UI部品（配置・サイズ・表示） |
| 出力 | JSON（blocks/pages） | JSON（UIレイアウト定義） |
| ランタイム | PixiJS（Web）/ SDL2（Switch） | 同左 |
| 混ぜない | ブロックエディタはそのまま維持 | UIレイアウト専用の別エディタ |

---

## 2. コンセプト

**「ブラウザ UIエディタ → JSON → ランタイム」の3層分離**

```
Browser Editor（作者が編集）
    ↓ JSON（UIレイアウト定義）
PixiJS Runtime（Web プレビュー）
    ↓ 同じ JSON
SDL2 Runtime（Switch / 固定座標で描画）
```

- エディタはブラウザで可変レイアウト編集
- SDL2 に持っていく時は固定レイアウトに書き出し
- SDL2 側にエディタ機能は持たせない（座標を受け取って並べるだけ）

### 設計の強み（Unity/ツクールとの差別化）

| 観点 | Unity UGUI | RPGツクール | kaedevn（本仕様） |
|------|-----------|-----------|-----------------|
| エディタ | デスクトップ専用 | Windows 専用 | **ブラウザ（OS不問）** |
| レイアウト管理 | Prefab（diff困難） | 固定 | **JSON（git diff 可能）** |
| AI 生成 | Prefab 生成困難 | 不可 | **JSON なので AI 生成可能** |
| レスポンシブ | 必要（多解像度） | 不要 | **不要（1280×720固定）** |

---

## 3. 画面構造（PixiJS レイヤー）

```
PlayRoot
├ SceneLayer         ← 演出用（既存エンジンが管理）
│   ├ BackgroundLayer
│   ├ CharacterLayer
│   └ EffectLayer
└ UiLayer            ← ツクール型エディタの編集対象
    ├ MessageWindow
    ├ NameBox
    ├ ChoiceWindow
    ├ ClickWaitIcon
    ├ QuickMenuBar
    │   ├ AutoButton
    │   ├ SkipButton
    │   ├ LogButton
    │   ├ HideUiButton
    │   └ MenuButton
    ├ ToastNotification
    ├ AreaNamePlate
    ├ ObjectivePanel
    ├ GoldWindow
    ├ PartyStatusPanel
    ├ MiniMap
    ├ SaveIndicator
    └ InteractHint
```

- **SceneLayer** は既存エンジンが管理（変更なし）
- **UiLayer** がツクール型エディタの編集対象

---

## 4. UI 部品一覧（3系統）

### 4-1. ノベル基本 UI

| ID | 名前 | 説明 | 段階 |
|----|------|------|------|
| `message-window` | メッセージウィンドウ | テキスト表示領域 | 1 |
| `name-box` | 名前欄 | 話者名 | 1 |
| `choice-window` | 選択肢ウィンドウ | 分岐選択 | 1 |
| `click-wait-icon` | クリック待ちマーク | テキスト送り | 1 |
| `auto-button` | オートボタン | 自動送り | 1 |
| `skip-button` | スキップボタン | 既読スキップ | 1 |
| `log-button` | ログボタン | バックログ | 1 |
| `hide-ui-button` | 非表示ボタン | UI一時消し | 1 |
| `menu-button` | メニューボタン | システムメニュー | 1 |

### 4-2. 通知・補助 UI

| ID | 名前 | 説明 | 段階 |
|----|------|------|------|
| `quick-menu-bar` | クイックメニュー | ボタン群まとめ | 2 |
| `toast-notification` | 通知 | トースト表示 | 2 |
| `objective-panel` | 目的表示 | クエスト目的 | 2 |
| `save-indicator` | セーブ表示 | 保存状態 | 2 |
| `loading-overlay` | ローディング | 読み込み中 | 2 |

### 4-3. RPG 寄り拡張 UI

| ID | 名前 | 説明 | 段階 |
|----|------|------|------|
| `gold-window` | 所持金表示 | 通貨表示 | 3 |
| `party-status-panel` | パーティ表示 | HP/MP等 | 3 |
| `mini-map` | ミニマップ | 現在地 | 3 |
| `quest-tracker` | クエスト追跡 | 進行状況 | 3 |
| `interact-hint` | インタラクトボタン | 操作ガイド | 3 |
| `area-name-plate` | 現在地表示 | エリア名 | 3 |

---

## 5. 型定義

### 5-1. UiElementType

```typescript
export type UiElementType =
  // ノベル基本
  | "message-window"
  | "name-box"
  | "choice-window"
  | "click-wait-icon"
  | "auto-button"
  | "skip-button"
  | "log-button"
  | "hide-ui-button"
  | "menu-button"
  // 通知・補助
  | "quick-menu-bar"
  | "toast-notification"
  | "objective-panel"
  | "save-indicator"
  | "loading-overlay"
  // RPG 拡張
  | "gold-window"
  | "party-status-panel"
  | "mini-map"
  | "quest-tracker"
  | "interact-hint"
  | "area-name-plate";
```

### 5-2. レイアウト要素

```typescript
export type UiLayoutElement = {
  id: UiElementType;
  rect: {
    x: number;      // 左上原点、絶対座標
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  opacity: number;   // 0.0〜1.0
  zIndex: number;
  options?: Record<string, unknown>;  // 部品固有の設定
};
```

### 5-3. レイアウト定義（プロジェクト単位で保存）

```typescript
export type PlayLayout = {
  version: 1;
  resolution: { width: 1280; height: 720 };
  presetName: string;  // "novel-standard" | "rpg-classic" | "custom"
  elements: UiLayoutElement[];
};
```

---

## 6. 標準プリセット

### 6-1. ノベル標準（1280×720）

| UI部品 | x | y | width | height | 配置 |
|--------|---|---|-------|--------|------|
| message-window | 40 | 520 | 1200 | 180 | 下中央 |
| name-box | 60 | 490 | 200 | 30 | メッセージ左上 |
| choice-window | 390 | 200 | 500 | 300 | 中央 |
| click-wait-icon | 1200 | 680 | 24 | 24 | メッセージ右下 |
| quick-menu-bar | 1000 | 8 | 272 | 36 | 右上 |
| toast-notification | 440 | 16 | 400 | 48 | 上中央 |

### 6-2. RPG 寄りプリセット（1280×720）

ノベル標準に加えて：

| UI部品 | x | y | width | height | 配置 |
|--------|---|---|-------|--------|------|
| gold-window | 16 | 660 | 160 | 44 | 左下 |
| area-name-plate | 16 | 16 | 240 | 36 | 左上 |
| objective-panel | 16 | 60 | 240 | 120 | 左上下 |
| party-status-panel | 1060 | 560 | 200 | 140 | 右下 |
| mini-map | 1060 | 16 | 200 | 160 | 右上 |

---

## 7. フェーズ計画

### Phase 1: ツクール風固定 UI

**目標**: 標準レイアウトを1つ作って動かす

- [ ] `PlayLayout` 型定義を `packages/core` に追加
- [ ] ノベル標準プリセット JSON を作成
- [ ] PixiJS `UiLayer` に `applyPlayLayout()` を実装
- [ ] 各 UI 部品を PIXI.Container サブクラスとして実装
  - messageWindow, nameBox, choiceWindow, clickWaitIcon
  - autoButton, skipButton, logButton, hideUiButton, menuButton
- [ ] 既存エンジン（WebOpHandler）に UiLayer 統合
- [ ] `resize(width, height)` メソッドを全 UI 部品に実装

### Phase 2: プリセット切り替え

**目標**: 作者が複数レイアウトから選べる

- [ ] RPG 寄りプリセット追加
- [ ] プロジェクト設定にプリセット選択 UI 追加
- [ ] toastNotification, objectivePanel, saveIndicator 実装
- [ ] レイアウト切り替えプレビュー

### Phase 3: 制約付きレイアウト設定

**目標**: 作者が「ある程度」自由に UI を配置できる

制約の考え方（完全自由配置ではない）：

| UI部品 | 変更可能な項目 |
|--------|-------------|
| message-window | 位置（下/上/中央下）、幅、透明度 |
| name-box | 位置（メッセージ左上/上中央/内埋め込み） |
| choice-window | 位置（中央/左寄り/右寄り） |
| quick-menu-bar | 位置（右上/右下/左上）、表示ボタン選択 |
| toast-notification | 位置（上中央/右上）、表示時間 |

変更不可（固定のまま）：
- click-wait-icon（常にメッセージウィンドウ内）
- save-indicator（常に右上隅）
- loading-overlay（常に全画面）

実装方針：
- エディタ上で選択式（ドロップダウン / トグル）
- 座標の直接入力は Phase 4 以降
- ドラッグ配置は Phase 4 以降

### Phase 4: 制約付きドラッグ配置（将来）

- [ ] 配置変更対象の UI 部品をドラッグ可能にする
- [ ] スナップグリッド（8px 単位）
- [ ] 配置制約（画面外はみ出し禁止、最小サイズ保証）
- [ ] undo/redo
- [ ] 編集結果のプレビュー

---

## 8. データフロー

```
[ツクール型エディタ（ブラウザ）]
    │
    │ 作者が UI 配置を編集
    │
    ▼
[PlayLayout JSON]  ← プロジェクトに保存（PUT /api/projects/:id）
    │
    ├──→ [PixiJS Web Runtime]  座標を読んで UiLayer に適用
    │
    └──→ [SDL2 Switch Runtime]  同じ JSON を固定座標として適用
```

### ランタイム側の適用コード（共通）

```typescript
export function applyPlayLayout(
  layoutMap: Record<string, PIXI.Container>,
  layout: PlayLayout,
) {
  for (const element of layout.elements) {
    const target = layoutMap[element.id];
    if (!target) continue;
    target.x = element.rect.x;
    target.y = element.rect.y;
    target.visible = element.visible;
    target.alpha = element.opacity;
    target.zIndex = element.zIndex;
    if (typeof (target as any).resize === "function") {
      (target as any).resize(element.rect.width, element.rect.height);
    }
  }
}
```

- SDL2 側はこの関数相当のロジックだけ持つ
- エディタ機能は SDL2 に持たせない

---

## 9. 既存エディタとの関係

| 観点 | 既存ブロックエディタ | ツクール型エディタ |
|------|-------------------|-----------------|
| 編集対象 | シナリオ（ストーリー構造） | プレイ画面 UI（見た目） |
| URL | `/projects/editor/:id` | `/projects/ui-editor/:id`（予定） |
| 保存先 | `data.pages[].blocks[]` | `data.playLayout`（予定） |
| 依存関係 | 独立 | 独立（同一プロジェクト内で共存） |
| 実装場所 | `apps/editor` | `apps/editor` 内に別ページ、または新アプリ |

両エディタは同じプロジェクトの別側面を編集する。混ぜない。

---

## 10. 制約・前提

- **解像度固定**: 1280×720（レスポンシブ不要、アンカー不要）
- **座標系**: 左上原点、絶対座標（Phase 1〜3）
- **完全自由配置は避ける**: 破綻しやすいため、段階的に自由度を上げる
- **テキストレイアウト**: 改行・禁則処理・ruby は別課題（最も実装コストが高い）
- **立ち絵解像度**: 2K（高さ 2048px 前後）推奨、顔アップは 1.5倍まで安全
- **ウィンドウスキン**: Phase 2 以降で差し替え対応を検討

---

## 11. 実装優先順位（UI 部品）

| 優先度 | UI 部品 | 理由 |
|--------|--------|------|
| 1 | messageWindow | ノベルの核 |
| 2 | nameBox | セリフに必須 |
| 3 | choiceWindow | 分岐に必須 |
| 4 | quickMenuBar | 操作の基本 |
| 5 | autoButton / skipButton | プレイ体験 |
| 6 | logButton / menuButton | システム機能 |
| 7 | toastNotification | フィードバック |
| 8 | areaNamePlate | 演出 |
| 9 | goldWindow / partyStatusPanel | RPG 拡張 |
| 10 | miniMap / questTracker | RPG 拡張（後回し） |

---

## 参照元

- `docs/01_in_specs/2026/03/0313/ツクール、Next.js コンポーネント用語.md` — 9,754行の検討会話
- `docs/09_reports/2026/03/07/04-tsukuru-author-acquisition-strategy.md` — ツクール作者獲得戦略
- `docs/01_in_specs/2026/03/0307/03_handoff_editor_appeal_phase1.md` — エディタ戦略 Phase 1
