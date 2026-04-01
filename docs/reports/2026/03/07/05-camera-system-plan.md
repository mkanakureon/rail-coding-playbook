# カメラシステム実装計画書

## 背景と目的

現在、背景やキャラクターの移動・拡大縮小はタイムラインで実現できるが、同じシーン内で素早く視点を変える手段がない。タイムラインはトラック・クリップ・キーフレームの作成が必要で、「ちょっとカメラを寄せたい」程度の演出には重い。

ツクール作者向けの壁打ち（ChatGPT）で得た知見:
- 背景画像を 1920x1080 で作成し、1280x720 のビューポートで切り出し表示する
- カメラ（= sceneLayer）を動かしてパン・ズーム演出を実現する
- UI は固定のまま、シーンだけが動く

**目的**: `@camera` コマンド1行で、パン・ズーム・揺れなどの演出を即座に適用できるようにする。

---

## 現状の構造と課題

### 現在のレイヤー構造（LayerManager.ts）

```
root (Container)
├── backgroundLayer   ← cover スケーリングで 1280x720 に縮小
├── characterLayer
├── overlayLayer
└── uiLayer
```

### 課題

1. **タイムラインのカメラは `root` を操作する** → UI も一緒に動く
2. **背景は cover スケーリング** → 1920x1080 の画像も 1280x720 にクロップ表示され、パンの余地がない
3. **シーン全体を動かす手段がない** → 背景とキャラを個別に動かすしかない

---

## 新しいレイヤー構造

```
root (Container)
├── sceneLayer (Container)  ← NEW: カメラの対象
│   ├── backgroundLayer
│   ├── characterLayer
│   └── overlayLayer
└── uiLayer                 ← カメラの影響を受けない
```

### 変更のポイント

- `sceneLayer` を新設し、bg / ch / overlay をその子にする
- カメラ操作 = `sceneLayer` の position / scale / pivot を変更
- `uiLayer` は `root` 直下のまま → メッセージウィンドウ等は固定
- `root` にマスク（1280x720）を設定し、パン時に画面外がはみ出さないようにする

---

## @camera コマンド仕様

### 構文

```
@camera x=<number> y=<number> zoom=<number> time=<number> easing=<string>
@camera shake=<number> time=<number>
@camera reset time=<number>
```

### パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `x` | number | 0 | 水平オフセット（px、負=左にパン、正=右にパン） |
| `y` | number | 0 | 垂直オフセット（px、負=上にパン、正=下にパン） |
| `zoom` | number | 1.0 | ズーム倍率（1.0=等倍、1.5=1.5倍拡大） |
| `pivotX` | number | 640 | ズーム中心X（デフォルト画面中央） |
| `pivotY` | number | 360 | ズーム中心Y（デフォルト画面中央） |
| `time` | number | 0 | アニメーション時間（ms、0=即時） |
| `easing` | string | easeInOut | イージング関数 |
| `shake` | number | - | 揺れ強度（px） |
| `reset` | flag | - | 初期状態（x=0, y=0, zoom=1.0）に戻す |

### 使用例

```ksc
; シーン: 教室で会話中
@bg file="classroom_1920x1080"
@ch name="hero" pos=C
@text "何か視線を感じる..."

; カメラ演出: 右側に注目
@camera x=-200 time=800

@ch name="heroine" pos=R
@text "あ、あの子がこっちを見ている"

; 顔にズーム
@camera x=-200 y=-80 zoom=1.4 pivotX=960 pivotY=300 time=600

@text "目が合った。心臓が跳ねる。"

; 元に戻す
@camera reset time=500

; 画面揺れ（衝撃演出）
@camera shake=8 time=400
@text "突然、大きな音が響いた。"
```

---

## 2K 背景の活用

### 解像度の関係

```
背景画像: 1920 x 1080
          ┌──────────────────────────────────┐
          │                                  │
          │    ┌────────────────────┐         │
          │    │                    │         │
          │    │   1280 x 720      │         │
          │    │   (表示領域)       │         │
          │    │                    │         │
          │    └────────────────────┘         │
          │                                  │
          └──────────────────────────────────┘

パン可能範囲:
  横: (1920 - 1280) / 2 = ±320px
  縦: (1080 - 720) / 2 = ±180px
```

### 背景描画モードの追加

| モード | 説明 | 用途 |
|--------|------|------|
| `cover`（現在） | 1280x720 にスケーリング | カメラ不使用時 |
| `full`（新規） | 元解像度で描画、ビューポートで切り出し | カメラ使用時 |

`@bg` コマンドに `mode=full` を追加:

```ksc
@bg file="classroom_1920x1080" mode=full
```

`mode=full` の場合:
- 画像を 1280x720 基準でセンタリング配置
- sceneLayer にマスクを設定し、はみ出しをクリッピング
- カメラでパンすると、画像の隠れていた部分が見える

### ズーム時の画質

| ズーム倍率 | 1920x1080 画像 | 1280x720 画像 |
|-----------|---------------|---------------|
| 1.0x | 余裕あり | ちょうど |
| 1.2x | 問題なし | やや粗い |
| 1.5x | 問題なし | 粗い |
| 2.0x | やや粗い | 使えない |

→ 2K 背景なら 1.5 倍ズームまで劣化なし

---

## Op 定義

### CAMERA_SET

```typescript
// packages/core/src/types/Op.ts

interface CameraSetOp {
  type: 'CAMERA_SET';
  x?: number;
  y?: number;
  zoom?: number;
  pivotX?: number;
  pivotY?: number;
  time?: number;
  easing?: string;
  shake?: number;
  reset?: boolean;
}
```

### エディタブロック

```typescript
// apps/editor/src/types/index.ts

interface CameraBlock {
  id: string;
  type: 'camera';
  x?: number;       // -320 〜 320（2K背景の場合）
  y?: number;       // -180 〜 180
  zoom?: number;    // 0.5 〜 2.0
  pivotX?: number;  // 0 〜 1280
  pivotY?: number;  // 0 〜 720
  time?: number;    // ms
  easing?: string;
  shake?: number;   // 0 〜 20
  reset?: boolean;
}
```

---

## タイムラインとの関係

### 棲み分け

| | @camera | タイムライン |
|--|---------|------------|
| 対象 | sceneLayer 全体 | 個別スプライト or root |
| 粒度 | シーン単位 | フレーム単位 |
| 設定コスト | 1行 | トラック・クリップ・キーフレーム |
| 主な用途 | パン、ズーム、揺れ | 複雑な同時アニメーション |
| 状態の持続 | 次の @camera まで維持 | クリップ終了後は fillMode 次第 |

### 併用

- タイムラインの CameraTrack は `root` を操作（従来通り）
- `@camera` は `sceneLayer` を操作
- 両方同時に使うと効果が合成される（意図的に使う場面は少ないが、壊れない）

---

## 実装ファイルと変更内容

### Phase 1: 基盤（sceneLayer + @camera コマンド）

| ファイル | 変更内容 |
|---------|---------|
| `packages/core/src/types/Op.ts` | `CameraSetOp` 型追加 |
| `packages/compiler/src/registry/commandRegistry.ts` | `@camera` パーサー追加 |
| `packages/web/src/renderer/LayerManager.ts` | `sceneLayer` 追加、bg/ch/overlay をその子に |
| `packages/web/src/renderer/WebOpHandler.ts` | `cameraSet()` 実装、sceneLayer のアニメーション |
| `packages/web/src/engine/OpRunner.ts` | `CAMERA_SET` dispatch 追加 |
| `packages/core/src/engine/IOpHandler.ts` | `cameraSet()` メソッド追加 |

### Phase 2: エディタ対応

| ファイル | 変更内容 |
|---------|---------|
| `apps/editor/src/types/index.ts` | `CameraBlock` 型追加 |
| `apps/editor/src/store/useEditorStore.ts` | `getBlockScript` / `buildSnapshotScript` に camera 追加 |
| `apps/editor/src/components/sidebar/SidebarInspector.tsx` | camera ブロックのプロパティ UI |
| `apps/editor/src/components/BlockList.tsx` | ブロック追加メニューに camera 追加 |

### Phase 3: 背景 full モード

| ファイル | 変更内容 |
|---------|---------|
| `packages/core/src/types/Op.ts` | `BgSetOp` に `mode?: 'cover' \| 'full'` 追加 |
| `packages/web/src/renderer/WebOpHandler.ts` | `bgSet()` で full モード描画対応 |
| `apps/editor/src/types/index.ts` | `BgBlock` に `mode` 追加 |
| `apps/hono/src/routes/preview.ts` | `generateKSCScript` に mode 対応 |

### Phase 4: テスト

| ファイル | 内容 |
|---------|------|
| `packages/compiler/test/camera.test.ts` | @camera パーサーテスト |
| `npm test -w @kaedevn/compiler` | 同期テスト通過確認 |

---

## 実装順序

```
Phase 1-1: Op.ts に CameraSetOp 追加
Phase 1-2: commandRegistry.ts に @camera パーサー追加
Phase 1-3: compiler テスト通過確認
Phase 1-4: LayerManager.ts に sceneLayer 追加
Phase 1-5: IOpHandler / OpRunner に cameraSet 追加
Phase 1-6: WebOpHandler.cameraSet() 実装（position / scale / shake）
Phase 1-7: 動作確認（ksc-demo.html で @camera テスト）

Phase 2-1: CameraBlock 型追加
Phase 2-2: エディタ UI（スライダー + プレビュー）
Phase 2-3: getBlockScript / buildSnapshotScript 対応

Phase 3-1: BgSetOp に mode 追加
Phase 3-2: WebOpHandler.bgSet() で full モード実装
Phase 3-3: sceneLayer マスク設定
Phase 3-4: 2K 背景でのパン動作確認
```

---

## 注意事項

- **CLAUDE.md ルール**: 新コマンド追加時は commandRegistry.ts → Op.ts → IOpHandler → OpRunner → WebOpHandler → エディタ → preview の順で全箇所を更新
- **KNOWN_COMMANDS**: `lineClassifier.ts` の `KNOWN_COMMANDS` に `camera` を追加しないと TEXT に分類される（OVL 追加時の教訓）
- **セーブ互換**: カメラ状態はセーブデータに含めない（シーン復元時に @camera コマンドが再実行される）
- **Skip モード**: `time` は skipMode 時に 0 になる（タイムラインと同じ挙動）
- **SDL2 移植**: sceneLayer の transform は x, y, zoom の3値なので SDL2 側の実装も簡単

---

## 参考

- 壁打ち要約: `docs/09_reports/2026/03/07/03-tsukuru-component-terminology-summary.md` セクション10
- 元ファイル: `docs/01_in_specs/2026/03/0307/02_ツクール、Next.js コンポーネント用語.md` L9270-9500
- 既存タイムライン: `packages/core/src/timeline/types.ts`
- レイヤー管理: `packages/web/src/renderer/LayerManager.ts`
