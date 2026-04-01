# タイムラインパネル実装計画（react-timeline-editor 採用）

## 概要

エディタに演出タイムラインパネルを追加する。`@xzdarcy/react-timeline-editor` v1.0.0 を採用し、クリップ操作・シーク・ズーム・再生をライブラリに任せる。キーフレーム編集は Phase 2 でカスタムUI。

## 技術選定

| 項目 | 選定 | 理由 |
|------|------|------|
| タイムラインUI | `@xzdarcy/react-timeline-editor` v1.0.0 | クリップ操作・シーク・ズーム・再生エンジン内蔵 |
| 再生エンジン | `@xzdarcy/timeline-engine`（自動依存） | Timeline コンポーネントに統合済み |
| データモデル | `@kaedevn/core` の TimelineRoot をアダプターで変換 | 既存型を変更しない |

### データモデル対応表

```
@kaedevn/core                    react-timeline-editor
─────────────────────────────    ─────────────────────
TimelineRoot.tracks[]        →   TimelineRow[]
  Track.id                   →   TimelineRow.id
  Track.clips[]              →   TimelineRow.actions[]
    Clip.id                  →   TimelineAction.id
    Clip.startMs / 1000      →   TimelineAction.start (秒)
    Clip.endMs / 1000        →   TimelineAction.end (秒)
    Track.kind               →   TimelineAction.effectId
  Track.kind + targetId      →   トラックヘッダー（カスタム描画）
  Clip.channels[].keyframes  →   getActionRender でドット表示
```

## Phase 1: タイムライン表示・操作パネル

### 1. パッケージインストール

```bash
cd apps/editor
npm install @xzdarcy/react-timeline-editor
```

### 2. アダプター `apps/editor/src/utils/timelineAdapter.ts`（新規）

TimelineRoot ⇔ react-timeline-editor 形式の変換。

```typescript
import type { TimelineRoot, Track, Clip } from '@kaedevn/core';

// ライブラリの型
interface TimelineRow {
  id: string;
  actions: TimelineAction[];
}
interface TimelineAction {
  id: string;
  start: number;  // 秒
  end: number;     // 秒
  effectId: string;
  data?: { clip: Clip; track: Track };  // 元データ参照
}

// TimelineRoot → ライブラリ形式
export function toEditorRows(timeline: TimelineRoot): TimelineRow[] {
  return timeline.tracks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(track => ({
      id: track.id,
      actions: track.clips.map(clip => ({
        id: clip.id,
        start: clip.startMs / 1000,
        end: clip.endMs / 1000,
        effectId: track.kind,
        data: { clip, track },
      })),
    }));
}

// ライブラリ形式 → TimelineRoot へ反映（Phase 2 で使用）
export function applyEditorChanges(
  timeline: TimelineRoot,
  rows: TimelineRow[]
): TimelineRoot { ... }
```

### 3. タイムラインパネル `apps/editor/src/components/timeline/TimelinePanel.tsx`（新規）

```
┌─ ツールバー ───────────────────────────────────────┐
│ [▶再生] [■停止] [⏪先頭] 0:02.500 / 0:08.000      │
│ [🔍−] [🔍+] ズーム   TL: [ドロップダウン] [＋新規]  │
├─ トラックヘッダ ─┬─ react-timeline-editor ─────────┤
│ 📷 camera       │                                  │
│ 🖼 bg-main      │  ← Timeline コンポーネント       │
│ 👤 hero         │     クリップ表示・シーク・操作    │
│ 👤 villain      │                                  │
└─────────────────┴──────────────────────────────────┘
```

**Props:**
```typescript
type Props = {
  height: number;
};
```

**内部実装:**
- `useRef<TimelineState>` でライブラリの再生・シーク制御
- `effects` マップ: camera / entity / audio / event の4種
- `getActionRender` でクリップ内にキーフレームドットを描画
- `scale` state でズーム操作
- ツールバー: 再生/停止/先頭、時間表示、ズーム±、タイムライン選択
- トラックヘッダー: ライブラリ左側にオーバーレイ or 別カラム

**サンプルデータ読み込み:**
- `packages/web/public/samples/timeline.sample.full.json` を fetch
- `toEditorRows()` で変換して表示

### 4. ヘッダー `apps/editor/src/components/Header.tsx`

- props 追加: `showTimeline: boolean`, `onToggleTimeline: () => void`
- PC のみ「TL」ボタン追加（isWideScreen 条件内）

### 5. エディタページ `apps/editor/src/pages/EditorPage.tsx`

- state: `showTimeline` (default false), `timelineHeight` (default 200)
- `editor-layout` の height を `showTimeline` 時に調整
- 下部にリサイズハンドル + `<TimelinePanel>`
- リサイズ: 既存の col-resize と同じ mousedown/mousemove パターン（row-resize）

```
<div className="editor-container">
  <StickyHeader />
  <div className="editor-layout" style={{
    height: showTimeline
      ? `calc(100vh - 56px - 56px - ${timelineHeight}px)`
      : 'calc(100vh - 56px - 56px)'
  }}>
    {3カラム}
  </div>
  {showTimeline && (
    <>
      <div className="timeline-resize-handle" onMouseDown={startTimelineResize} />
      <TimelinePanel height={timelineHeight} />
    </>
  )}
  <PageNavigator />
</div>
```

### 6. CSS `apps/editor/src/index.css`

```css
/* タイムラインリサイズハンドル */
.timeline-resize-handle {
  height: 4px;
  cursor: row-resize;
  background: var(--border-color);
  /* hover で青く */
}

/* タイムラインパネル */
.timeline-panel { ... }
.timeline-toolbar { ... }
.timeline-track-labels { ... }

/* react-timeline-editor のカスタマイズ */
.timeline-panel .timeline-editor {
  width: 100%;
  background-color: #1e1e2e;
}
.timeline-panel .timeline-editor-action {
  border-radius: 4px;
}
/* エフェクト別の色分け */
.timeline-editor-action-effect-camera { background-color: #e74c3c; }
.timeline-editor-action-effect-entity { background-color: #3498db; }
.timeline-editor-action-effect-audio  { background-color: #2ecc71; }
.timeline-editor-action-effect-event  { background-color: #f39c12; }
```

### 7. ストア `apps/editor/src/store/useEditorStore.ts`

既に追加済み:
- `timelines: TimelineRoot[]`
- `currentTimelineIndex: number`
- `setTimelines`, `addTimeline`, `removeTimeline`

## Phase 2（次回実装）

- クリップのドラッグ移動・リサイズ → `onChange` + `applyEditorChanges` で TimelineRoot 更新
- キーフレーム追加・削除 → クリップ選択時の詳細パネル（カスタムUI）
- シーク → プレビュー連携（`evaluateTimeline()` → postMessage → iframe）
- タイムラインの保存/読み込み API
- `WebEngine.playTimeline()` 実装

## 検証方法

1. `npm run typecheck` で型チェック
2. 既存テスト `test-three-column.spec.ts` が引き続きパス
3. 手動確認:
   - ヘッダーの「TL」ボタンでタイムラインパネルが開閉
   - サンプルタイムラインの4トラック・クリップが表示される
   - ライブラリの再生ボタンでカーソルが動く
   - ズーム操作で横軸スケールが変わる
   - リサイズハンドルでパネル高さが変わる
   - 3カラムレイアウトが正常動作する
