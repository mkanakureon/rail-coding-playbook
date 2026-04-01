# ツクール型エディタ — プリセット JSON 定義

- **作成日**: 2026-03-13
- **親文書**: `tsukuru-editor-spec.md`
- **用途**: 実装時にそのまま `packages/core` に配置できる完全な PlayLayout JSON

---

## 1. ノベル標準（novel-standard）

ADV 形式の標準レイアウト。メッセージウィンドウが画面下部、クイックメニューが右上。

```json
{
  "version": 1,
  "resolution": { "width": 1280, "height": 720 },
  "presetName": "novel-standard",
  "elements": [
    {
      "id": "message-window",
      "rect": { "x": 40, "y": 520, "width": 1200, "height": 180 },
      "visible": true,
      "opacity": 0.85,
      "zIndex": 100,
      "options": {
        "style": "adv",
        "padding": 20,
        "fontSize": 24,
        "nameFontSize": 20,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.7)",
        "borderRadius": 8
      }
    },
    {
      "id": "name-box",
      "rect": { "x": 60, "y": 490, "width": 200, "height": 30 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 110,
      "options": {
        "fontSize": 20,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.8)",
        "borderRadius": 4,
        "padding": 6
      }
    },
    {
      "id": "choice-window",
      "rect": { "x": 390, "y": 200, "width": 500, "height": 300 },
      "visible": false,
      "opacity": 1.0,
      "zIndex": 200,
      "options": {
        "buttonWidth": 400,
        "buttonHeight": 50,
        "buttonGap": 12,
        "buttonColor": "rgba(40,40,80,0.9)",
        "buttonHoverColor": "rgba(60,60,120,0.9)",
        "textColor": "#ffffff",
        "fontSize": 22,
        "dimBackground": true,
        "dimColor": "rgba(0,0,0,0.4)"
      }
    },
    {
      "id": "click-wait-icon",
      "rect": { "x": 1200, "y": 680, "width": 24, "height": 24 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 115,
      "options": {
        "animationType": "pulse",
        "animationSpeed": 0.05,
        "shape": "triangle",
        "color": "#ffffff"
      }
    },
    {
      "id": "quick-menu-bar",
      "rect": { "x": 1000, "y": 8, "width": 272, "height": 36 },
      "visible": true,
      "opacity": 0.8,
      "zIndex": 150,
      "options": {
        "layout": "horizontal",
        "buttonGap": 4,
        "backgroundColor": "rgba(0,0,0,0.5)",
        "borderRadius": 18,
        "padding": 4
      }
    },
    {
      "id": "auto-button",
      "rect": { "x": 1004, "y": 10, "width": 48, "height": 32 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 151,
      "options": {
        "label": "AUTO",
        "fontSize": 12,
        "activeColor": "#4fc3f7",
        "inactiveColor": "#888888"
      }
    },
    {
      "id": "skip-button",
      "rect": { "x": 1056, "y": 10, "width": 48, "height": 32 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 151,
      "options": {
        "label": "SKIP",
        "fontSize": 12,
        "activeColor": "#ff8a65",
        "inactiveColor": "#888888"
      }
    },
    {
      "id": "log-button",
      "rect": { "x": 1108, "y": 10, "width": 48, "height": 32 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 151,
      "options": {
        "label": "LOG",
        "fontSize": 12,
        "color": "#aaaaaa"
      }
    },
    {
      "id": "hide-ui-button",
      "rect": { "x": 1160, "y": 10, "width": 48, "height": 32 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 151,
      "options": {
        "label": "HIDE",
        "fontSize": 12,
        "color": "#aaaaaa"
      }
    },
    {
      "id": "menu-button",
      "rect": { "x": 1212, "y": 10, "width": 48, "height": 32 },
      "visible": true,
      "opacity": 1.0,
      "zIndex": 151,
      "options": {
        "label": "MENU",
        "fontSize": 12,
        "color": "#aaaaaa"
      }
    },
    {
      "id": "toast-notification",
      "rect": { "x": 440, "y": 16, "width": 400, "height": 48 },
      "visible": false,
      "opacity": 0.0,
      "zIndex": 300,
      "options": {
        "fontSize": 16,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.8)",
        "borderRadius": 24,
        "showDuration": 3000,
        "fadeInMs": 300,
        "fadeOutMs": 500
      }
    },
    {
      "id": "save-indicator",
      "rect": { "x": 1200, "y": 8, "width": 64, "height": 24 },
      "visible": false,
      "opacity": 0.0,
      "zIndex": 310,
      "options": {
        "icon": "spinner",
        "text": "Saving...",
        "fontSize": 12,
        "color": "#ffffff"
      }
    },
    {
      "id": "loading-overlay",
      "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 },
      "visible": false,
      "opacity": 0.0,
      "zIndex": 500,
      "options": {
        "backgroundColor": "rgba(0,0,0,0.9)",
        "spinnerSize": 48,
        "spinnerColor": "#ffffff",
        "text": "Loading..."
      }
    }
  ]
}
```

---

## 2. RPG 寄り（rpg-classic）

ノベル標準の全要素 ＋ RPG固有UI。所持金・パーティ・ミニマップ等を表示。

```json
{
  "version": 1,
  "resolution": { "width": 1280, "height": 720 },
  "presetName": "rpg-classic",
  "elements": [
    { "id": "message-window",     "rect": { "x": 40, "y": 520, "width": 1200, "height": 180 }, "visible": true,  "opacity": 0.85, "zIndex": 100, "options": { "style": "adv", "padding": 20, "fontSize": 24, "nameFontSize": 20, "textColor": "#ffffff", "backgroundColor": "rgba(0,0,0,0.7)", "borderRadius": 8 } },
    { "id": "name-box",           "rect": { "x": 60, "y": 490, "width": 200, "height": 30 },   "visible": true,  "opacity": 1.0,  "zIndex": 110, "options": { "fontSize": 20, "textColor": "#ffffff", "backgroundColor": "rgba(0,0,0,0.8)", "borderRadius": 4, "padding": 6 } },
    { "id": "choice-window",      "rect": { "x": 390, "y": 200, "width": 500, "height": 300 }, "visible": false, "opacity": 1.0,  "zIndex": 200, "options": { "buttonWidth": 400, "buttonHeight": 50, "buttonGap": 12, "dimBackground": true } },
    { "id": "click-wait-icon",    "rect": { "x": 1200, "y": 680, "width": 24, "height": 24 },  "visible": true,  "opacity": 1.0,  "zIndex": 115, "options": { "animationType": "pulse", "shape": "triangle" } },
    { "id": "quick-menu-bar",     "rect": { "x": 1000, "y": 8, "width": 272, "height": 36 },   "visible": true,  "opacity": 0.8,  "zIndex": 150, "options": { "layout": "horizontal", "buttonGap": 4 } },
    { "id": "auto-button",        "rect": { "x": 1004, "y": 10, "width": 48, "height": 32 },   "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "AUTO" } },
    { "id": "skip-button",        "rect": { "x": 1056, "y": 10, "width": 48, "height": 32 },   "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "SKIP" } },
    { "id": "log-button",         "rect": { "x": 1108, "y": 10, "width": 48, "height": 32 },   "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "LOG" } },
    { "id": "hide-ui-button",     "rect": { "x": 1160, "y": 10, "width": 48, "height": 32 },   "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "HIDE" } },
    { "id": "menu-button",        "rect": { "x": 1212, "y": 10, "width": 48, "height": 32 },   "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "MENU" } },
    { "id": "toast-notification", "rect": { "x": 440, "y": 16, "width": 400, "height": 48 },   "visible": false, "opacity": 0.0,  "zIndex": 300, "options": { "showDuration": 3000 } },
    { "id": "save-indicator",     "rect": { "x": 1200, "y": 8, "width": 64, "height": 24 },    "visible": false, "opacity": 0.0,  "zIndex": 310, "options": {} },
    { "id": "loading-overlay",    "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 },    "visible": false, "opacity": 0.0,  "zIndex": 500, "options": {} },
    {
      "id": "gold-window",
      "rect": { "x": 16, "y": 660, "width": 160, "height": 44 },
      "visible": true,
      "opacity": 0.9,
      "zIndex": 140,
      "options": {
        "icon": "coin",
        "fontSize": 18,
        "textColor": "#ffd700",
        "backgroundColor": "rgba(0,0,0,0.7)",
        "borderRadius": 6,
        "format": "{value} G"
      }
    },
    {
      "id": "area-name-plate",
      "rect": { "x": 16, "y": 16, "width": 240, "height": 36 },
      "visible": true,
      "opacity": 0.9,
      "zIndex": 130,
      "options": {
        "fontSize": 16,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.6)",
        "borderRadius": 4,
        "showAnimation": "slideIn",
        "hideAfterMs": 5000
      }
    },
    {
      "id": "objective-panel",
      "rect": { "x": 16, "y": 60, "width": 240, "height": 120 },
      "visible": true,
      "opacity": 0.85,
      "zIndex": 125,
      "options": {
        "titleFontSize": 14,
        "bodyFontSize": 13,
        "textColor": "#ffffff",
        "titleColor": "#ffd700",
        "backgroundColor": "rgba(0,0,0,0.6)",
        "borderRadius": 6,
        "maxItems": 3
      }
    },
    {
      "id": "party-status-panel",
      "rect": { "x": 1060, "y": 560, "width": 200, "height": 140 },
      "visible": true,
      "opacity": 0.85,
      "zIndex": 135,
      "options": {
        "maxMembers": 4,
        "showHp": true,
        "showMp": true,
        "showLevel": false,
        "fontSize": 13,
        "hpColor": "#4caf50",
        "mpColor": "#42a5f5",
        "backgroundColor": "rgba(0,0,0,0.6)",
        "borderRadius": 6
      }
    },
    {
      "id": "mini-map",
      "rect": { "x": 1060, "y": 16, "width": 200, "height": 160 },
      "visible": true,
      "opacity": 0.9,
      "zIndex": 130,
      "options": {
        "borderColor": "rgba(255,255,255,0.3)",
        "borderWidth": 2,
        "borderRadius": 8,
        "playerMarkerColor": "#ff5722",
        "playerMarkerSize": 6,
        "backgroundColor": "rgba(0,0,0,0.5)",
        "zoomLevel": 1.0
      }
    },
    {
      "id": "quest-tracker",
      "rect": { "x": 16, "y": 188, "width": 240, "height": 80 },
      "visible": false,
      "opacity": 0.85,
      "zIndex": 124,
      "options": {
        "fontSize": 13,
        "textColor": "#cccccc",
        "activeColor": "#ffd700",
        "backgroundColor": "rgba(0,0,0,0.5)",
        "borderRadius": 4,
        "checkmarkColor": "#4caf50"
      }
    },
    {
      "id": "interact-hint",
      "rect": { "x": 580, "y": 460, "width": 120, "height": 36 },
      "visible": false,
      "opacity": 0.0,
      "zIndex": 160,
      "options": {
        "text": "話す",
        "keyIcon": "A",
        "fontSize": 14,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.7)",
        "borderRadius": 18,
        "fadeInMs": 200,
        "fadeOutMs": 200
      }
    }
  ]
}
```

---

## 3. メッセージ上（message-top）

メッセージウィンドウを画面上部に配置。立ち絵重視の構成。

```json
{
  "version": 1,
  "resolution": { "width": 1280, "height": 720 },
  "presetName": "message-top",
  "elements": [
    { "id": "message-window",     "rect": { "x": 40, "y": 20, "width": 1200, "height": 160 },  "visible": true,  "opacity": 0.85, "zIndex": 100, "options": { "style": "adv", "padding": 20, "fontSize": 24, "backgroundColor": "rgba(0,0,0,0.7)", "borderRadius": 8 } },
    { "id": "name-box",           "rect": { "x": 60, "y": 180, "width": 200, "height": 30 },   "visible": true,  "opacity": 1.0,  "zIndex": 110, "options": { "position": "below-window" } },
    { "id": "choice-window",      "rect": { "x": 390, "y": 250, "width": 500, "height": 300 }, "visible": false, "opacity": 1.0,  "zIndex": 200, "options": { "dimBackground": true } },
    { "id": "click-wait-icon",    "rect": { "x": 1200, "y": 160, "width": 24, "height": 24 },  "visible": true,  "opacity": 1.0,  "zIndex": 115, "options": { "animationType": "pulse" } },
    { "id": "quick-menu-bar",     "rect": { "x": 1000, "y": 676, "width": 272, "height": 36 }, "visible": true,  "opacity": 0.8,  "zIndex": 150, "options": { "layout": "horizontal" } },
    { "id": "auto-button",        "rect": { "x": 1004, "y": 678, "width": 48, "height": 32 },  "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "AUTO" } },
    { "id": "skip-button",        "rect": { "x": 1056, "y": 678, "width": 48, "height": 32 },  "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "SKIP" } },
    { "id": "log-button",         "rect": { "x": 1108, "y": 678, "width": 48, "height": 32 },  "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "LOG" } },
    { "id": "hide-ui-button",     "rect": { "x": 1160, "y": 678, "width": 48, "height": 32 },  "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "HIDE" } },
    { "id": "menu-button",        "rect": { "x": 1212, "y": 678, "width": 48, "height": 32 },  "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "MENU" } },
    { "id": "toast-notification", "rect": { "x": 440, "y": 660, "width": 400, "height": 48 },  "visible": false, "opacity": 0.0,  "zIndex": 300, "options": { "showDuration": 3000 } },
    { "id": "save-indicator",     "rect": { "x": 1200, "y": 688, "width": 64, "height": 24 },  "visible": false, "opacity": 0.0,  "zIndex": 310, "options": {} },
    { "id": "loading-overlay",    "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 },    "visible": false, "opacity": 0.0,  "zIndex": 500, "options": {} }
  ]
}
```

---

## 4. メッセージ中央（message-center）

NVL風のフルスクリーンテキスト表示。小説的な演出向け。

```json
{
  "version": 1,
  "resolution": { "width": 1280, "height": 720 },
  "presetName": "message-center",
  "elements": [
    { "id": "message-window",     "rect": { "x": 140, "y": 60, "width": 1000, "height": 600 }, "visible": true,  "opacity": 0.80, "zIndex": 100, "options": { "style": "nvl", "padding": 32, "fontSize": 22, "lineHeight": 1.8, "textColor": "#ffffff", "backgroundColor": "rgba(0,0,0,0.75)", "borderRadius": 12 } },
    { "id": "name-box",           "rect": { "x": 160, "y": 68, "width": 200, "height": 30 },   "visible": true,  "opacity": 1.0,  "zIndex": 110, "options": { "position": "inside-top", "fontSize": 18 } },
    { "id": "choice-window",      "rect": { "x": 390, "y": 200, "width": 500, "height": 300 }, "visible": false, "opacity": 1.0,  "zIndex": 200, "options": { "dimBackground": true } },
    { "id": "click-wait-icon",    "rect": { "x": 1100, "y": 636, "width": 24, "height": 24 },  "visible": true,  "opacity": 1.0,  "zIndex": 115, "options": { "animationType": "pulse" } },
    { "id": "quick-menu-bar",     "rect": { "x": 8, "y": 8, "width": 272, "height": 36 },      "visible": true,  "opacity": 0.6,  "zIndex": 150, "options": { "layout": "horizontal" } },
    { "id": "auto-button",        "rect": { "x": 12, "y": 10, "width": 48, "height": 32 },     "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "AUTO" } },
    { "id": "skip-button",        "rect": { "x": 64, "y": 10, "width": 48, "height": 32 },     "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "SKIP" } },
    { "id": "log-button",         "rect": { "x": 116, "y": 10, "width": 48, "height": 32 },    "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "LOG" } },
    { "id": "hide-ui-button",     "rect": { "x": 168, "y": 10, "width": 48, "height": 32 },    "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "HIDE" } },
    { "id": "menu-button",        "rect": { "x": 220, "y": 10, "width": 48, "height": 32 },    "visible": true,  "opacity": 1.0,  "zIndex": 151, "options": { "label": "MENU" } },
    { "id": "toast-notification", "rect": { "x": 440, "y": 668, "width": 400, "height": 48 },  "visible": false, "opacity": 0.0,  "zIndex": 300, "options": { "showDuration": 3000 } },
    { "id": "save-indicator",     "rect": { "x": 1200, "y": 8, "width": 64, "height": 24 },    "visible": false, "opacity": 0.0,  "zIndex": 310, "options": {} },
    { "id": "loading-overlay",    "rect": { "x": 0, "y": 0, "width": 1280, "height": 720 },    "visible": false, "opacity": 0.0,  "zIndex": 500, "options": {} }
  ]
}
```

---

## 5. プリセット比較

| 特徴 | novel-standard | rpg-classic | message-top | message-center |
|------|:---:|:---:|:---:|:---:|
| メッセージ位置 | 下 | 下 | 上 | 中央（全画面） |
| メッセージ高さ | 180px | 180px | 160px | 600px |
| スタイル | ADV | ADV | ADV | NVL |
| 名前欄位置 | ウィンドウ上 | ウィンドウ上 | ウィンドウ下 | ウィンドウ内上部 |
| クイックメニュー | 右上 | 右上 | 右下 | 左上 |
| 所持金表示 | - | 左下 | - | - |
| エリア名 | - | 左上 | - | - |
| ミニマップ | - | 右上 | - | - |
| パーティ状態 | - | 右下 | - | - |
| 目標パネル | - | 左 | - | - |
| 要素数 | 13 | 20 | 13 | 13 |
| 推奨ジャンル | 恋愛ADV、学園 | ファンタジーRPG | 立ち絵重視ADV | 文学小説、ホラー |

---

## 6. options フィールドの型定義（補足）

```typescript
/** message-window 固有オプション */
type MessageWindowOptions = {
  style: "adv" | "nvl";
  padding: number;
  fontSize: number;
  nameFontSize?: number;
  lineHeight?: number;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
};

/** choice-window 固有オプション */
type ChoiceWindowOptions = {
  buttonWidth: number;
  buttonHeight: number;
  buttonGap: number;
  buttonColor?: string;
  buttonHoverColor?: string;
  textColor?: string;
  fontSize?: number;
  dimBackground: boolean;
  dimColor?: string;
};

/** toast-notification 固有オプション */
type ToastNotificationOptions = {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  showDuration: number;   // ミリ秒
  fadeInMs: number;
  fadeOutMs: number;
};

/** mini-map 固有オプション */
type MiniMapOptions = {
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  playerMarkerColor: string;
  playerMarkerSize: number;
  backgroundColor: string;
  zoomLevel: number;
};

/** gold-window 固有オプション */
type GoldWindowOptions = {
  icon: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  format: string;   // "{value} G" のようなテンプレート
};

/** area-name-plate 固有オプション */
type AreaNamePlateOptions = {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  showAnimation: "slideIn" | "fadeIn" | "none";
  hideAfterMs: number;   // 0 = 自動非表示なし
};

/** party-status-panel 固有オプション */
type PartyStatusPanelOptions = {
  maxMembers: number;
  showHp: boolean;
  showMp: boolean;
  showLevel: boolean;
  fontSize: number;
  hpColor: string;
  mpColor: string;
  backgroundColor: string;
  borderRadius: number;
};
```

---

## 7. 使い方

### 実装時

```typescript
import novelStandard from "./presets/novel-standard.json";
import rpgClassic from "./presets/rpg-classic.json";
import messageTop from "./presets/message-top.json";
import messageCenter from "./presets/message-center.json";

const PRESETS: Record<string, PlayLayout> = {
  "novel-standard": novelStandard,
  "rpg-classic": rpgClassic,
  "message-top": messageTop,
  "message-center": messageCenter,
};

// プロジェクト設定からプリセット名を取得して適用
const layout = PRESETS[project.playLayout?.presetName ?? "novel-standard"];
applyPlayLayout(layoutMap, layout);
```

### プレビューHTML で確認

`tsukuru-layout-preview.html` をブラウザで開くと、4プリセットの切り替えとドラッグ編集が可能。
