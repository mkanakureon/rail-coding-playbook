# 画像位置・スケール スライダー 設計書

## 概要

ブロックエディタの右サイドバー（SidebarInspector）で、画像を持つブロック（bg, ch, overlay）に **X / Y / S（スケール）** の3本スライダーを表示する。画像選択UIは削除し、ブロック側（中央カラム）で行う。スライダーの値はブロックのプロパティとして保存され、`@コマンド` 出力時に数値パラメータとして自動付与される。

## 対象ブロック

| ブロック型 | 現状の右サイドバーUI | 変更後 |
|-----------|-------------------|--------|
| `bg` | 画像プレビュー + 選択グリッド + モーダル | 画像プレビュー + **X/Y/S スライダー** |
| `ch` | キャラ選択 + 表情選択 + ポジション(L/C/R) | キャラ/表情/ポジション表示（読み取り） + **X/Y/S スライダー** |
| `overlay` | 画像プレビュー + 選択グリッド + 表示チェック | 画像プレビュー + 表示チェック + **X/Y/S スライダー** |

## スライダー仕様

### パラメータ定義

| パラメータ | キー | 範囲 | デフォルト | ステップ | 単位 |
|-----------|------|------|-----------|---------|------|
| X 座標 | `x` | -640 ~ 1920 | 0 | 1 | px（論理座標） |
| Y 座標 | `y` | -360 ~ 1080 | 0 | 1 | px（論理座標） |
| スケール | `s` | 0.1 ~ 3.0 | 1.0 | 0.01 | 倍率 |

- 論理解像度 1280x720 基準
- デフォルト値（0, 0, 1.0）の場合はコマンドにパラメータを付与しない（後方互換）
- X/Y の 0 はブロック型ごとの既定位置を意味する（bg: 左上原点、ch: ポジション基準、overlay: 左上原点）

### UI 構成

```
┌─ 右サイドバー ──────────────┐
│                              │
│  [画像プレビュー 16:9]       │
│  asset-name.png              │
│                              │
│  ── 位置・スケール ────────  │
│                              │
│  X  [-640 ====|==== 1920]  0 │
│  Y  [-360 ====|==== 1080]  0 │
│  S  [0.1 =====|===== 3.0] 1.0│
│                              │
│  [リセット]                  │
│                              │
└──────────────────────────────┘
```

- 各スライダーの右に現在値を数値表示（直接入力も可能）
- 「リセット」ボタンで全パラメータをデフォルトに戻す
- スライダー変更時にリアルタイムでプレビューに反映（デバウンス 100ms）

## Block 型の変更

### types/index.ts

```typescript
// 共通の位置・スケール型
export type ImageTransform = {
  x?: number;  // X座標オフセット (default: 0)
  y?: number;  // Y座標オフセット (default: 0)
  s?: number;  // スケール倍率 (default: 1.0)
};

export type BgBlock = {
  id: string;
  type: 'bg';
  assetId: string;
} & ImageTransform;

export type ChBlock = {
  id: string;
  type: 'ch';
  characterId: string;
  expressionId: string;
  pos: 'L' | 'C' | 'R';
  visible: boolean;
} & ImageTransform;

export type OverlayBlock = {
  id: string;
  type: 'overlay';
  assetId: string;
  visible: boolean;
} & ImageTransform;
```

## @コマンド出力（数値自動判定）

### ルール

ブロックの `x`, `y`, `s` が**デフォルト値でない場合のみ**、@コマンドの末尾にパラメータを追加する。

```
# デフォルト（変更なし）
@bg forest

# X=100, Y=-50, S=1.5 の場合
@bg forest x 100 y -50 s 1.5

# ch も同様
@ch hero normal left x 30 y -20 s 1.2

# overlay も同様
@overlay rain x 0 y 0 s 2.0
```

### useEditorStore.ts — getBlockScript 変更

```typescript
// 共通ヘルパー: x/y/s パラメータ文字列を生成
function buildTransformParams(block: ImageTransform): string {
  const parts: string[] = [];
  if (block.x != null && block.x !== 0) parts.push(`x ${block.x}`);
  if (block.y != null && block.y !== 0) parts.push(`y ${block.y}`);
  if (block.s != null && block.s !== 1) parts.push(`s ${block.s}`);
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

// bg ブロック
case 'bg': {
  const bgAsset = project.assets.find((a) => a.id === block.assetId);
  return `@bg ${bgAsset?.slug || block.assetId}${buildTransformParams(block)}`;
}

// ch ブロック
case 'ch':
  // ...existing validation...
  return `@ch ${charSlug} ${exprSlug} ${position}${buildTransformParams(block)}`;

// overlay ブロック
case 'overlay':
  if (!block.assetId) return '';
  return block.visible
    ? `@overlay ${block.assetId}${buildTransformParams(block)}`
    : `@overlay_hide ${block.assetId}`;
```

## コンパイラ変更（packages/compiler）

### Op.ts への追加

```typescript
| { op: "BG_SET"; id: string; fadeMs?: number; effect?: "..."; x?: number; y?: number; s?: number }
| { op: "CH_SET"; name: string; pose: string; pos: "..."; fadeMs?: number; x?: number; y?: number; s?: number }
| { op: "OVERLAY_SET"; id: string; fadeMs?: number; x?: number; y?: number; s?: number }
```

### parseOptionalArgs.ts への追加

```typescript
// 既存の fade/vol に加えて x/y/s を認識
if (key === 'x') opts.x = parseFloat(value);
else if (key === 'y') opts.y = parseFloat(value);
else if (key === 's') opts.s = parseFloat(value);
```

数値の自動判定: `parseFloat` で変換し、`isNaN` なら無視する。

### commandRegistry.ts

bg, ch, overlay の各パーサーは既に `parseOptionalArgs` を呼んでいるため、`parseOptionalArgs` の拡張のみで対応可能。

## レンダラ変更（packages/web）

### WebOpHandler.ts

```typescript
// bgSet — x/y/s 対応
async bgSet(id: string, fadeMs?: number, effect?: string, x?: number, y?: number, s?: number) {
  // ...existing logic...
  if (x != null) sprite.x += x;
  if (y != null) sprite.y += y;
  if (s != null) {
    sprite.scale.x *= s;
    sprite.scale.y *= s;
  }
}

// chSet — x/y/s 対応
async chSet(name: string, pose: string, pos: string, fadeMs?: number, x?: number, y?: number, s?: number) {
  // ...existing position calculation (posX)...
  if (x != null) sprite.x += x;
  if (y != null) sprite.y += y;
  if (s != null) {
    sprite.scale.x *= s;
    sprite.scale.y *= s;
  }
}

// overlaySet — 同様
```

### OpRunner.ts

dispatch で Op の `x`, `y`, `s` を渡すだけ（追加引数）。

## SidebarInspector.tsx 変更

### 画像選択UIの削除

`BgProps`, `OverlayProps` から以下を削除:
- `PropertyImageGrid`（選択グリッド）
- `AssetSelectModal`（モーダル）

残す:
- 画像プレビュー（現在のアセット表示）
- アセット名表示

### スライダーコンポーネント追加

```tsx
function TransformSliders({ block }: { block: Block & ImageTransform }) {
  const { updateBlock } = useEditorStore();

  return (
    <div className="space-y-3">
      <Label>位置・スケール</Label>
      <SliderRow label="X" min={-640} max={1920} step={1}
        value={block.x ?? 0}
        onChange={(v) => updateBlock(block.id, { x: v })} />
      <SliderRow label="Y" min={-360} max={1080} step={1}
        value={block.y ?? 0}
        onChange={(v) => updateBlock(block.id, { y: v })} />
      <SliderRow label="S" min={0.1} max={3.0} step={0.01}
        value={block.s ?? 1.0}
        onChange={(v) => updateBlock(block.id, { s: v })} />
      <button onClick={() => updateBlock(block.id, { x: 0, y: 0, s: 1.0 })}>
        リセット
      </button>
    </div>
  );
}
```

## 実装ステップ

| # | 作業 | ファイル |
|---|------|---------|
| 1 | `ImageTransform` 型追加、BgBlock/ChBlock/OverlayBlock に mixin | `apps/editor/src/types/index.ts` |
| 2 | `TransformSliders` コンポーネント作成 | `apps/editor/src/components/sidebar/SidebarInspector.tsx` |
| 3 | `BgProps` — 画像選択UI削除、スライダー追加 | 同上 |
| 4 | `ChProps` — スライダー追加 | 同上 |
| 5 | `OverlayProps` — 画像選択UI削除、スライダー追加 | 同上 |
| 6 | `buildTransformParams` ヘルパー追加 | `apps/editor/src/store/useEditorStore.ts` |
| 7 | bg/ch/overlay の `getBlockScript` にパラメータ出力追加 | 同上 |
| 8 | `parseOptionalArgs` に x/y/s 追加 | `packages/compiler/src/parser/parseOptionalArgs.ts` |
| 9 | Op.ts に x/y/s フィールド追加 | `packages/core/src/types/Op.ts` |
| 10 | WebOpHandler の bgSet/chSet/overlaySet に x/y/s 適用 | `packages/web/src/renderer/WebOpHandler.ts` |
| 11 | OpRunner の dispatch に x/y/s 引数追加 | `packages/web/src/renderer/OpRunner.ts` |
| 12 | コンパイラテスト追加 | `packages/compiler/test/` |
| 13 | typecheck + lint 通過確認 | `npm run typecheck && npm run lint` |

## 後方互換性

- x/y/s が未定義または 0/1.0 の場合、@コマンドにパラメータを付与しない → 既存スクリプトはそのまま動作
- `parseOptionalArgs` は未知のキーを無視する設計のため、古いコンパイラでも x/y/s 付きコマンドはエラーにならない（無視される）
- 保存データの Block に x/y/s が無い場合はデフォルト値として扱う（`?? 0`, `?? 1.0`）
