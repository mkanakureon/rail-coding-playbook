# タイムラインパネル再生・スクロール同期の修正

## 問題1: 左右パネルのスクロールずれ

左パネル（トラックラベル）と右パネル（react-timeline-editor）が独立スクロール。

### 原因

- ライブラリの `onScroll` コールバックが未使用
- ヘッダースペーサー（32px）がライブラリの実際のオフセット（32px header + 10px margin-top = 42px）と不一致

### 修正

| 修正 | 内容 |
|------|------|
| スクロール同期 | `<Timeline onScroll>` → 左パネルの `scrollTop` を追従 |
| 左パネル | `overflow-y: hidden` で独立スクロール無効化 |
| スペーサー | 32px → 42px に修正 |
| 境界線 | `border-right` を `#2a2a3e` に薄く |

## 問題2: カーソル線がキーフレームのクリックを妨害

### 原因

ライブラリのカーソル `cursor-area`（16px幅）がキーフレームのダイヤモンド上に重なる。

### 修正

```css
.timeline-editor-cursor { pointer-events: none; }
.timeline-editor-cursor-top { pointer-events: auto; cursor: ew-resize; }
```

上部ハンドル（▼）のみドラッグ可能。カーソル線本体はクリックを透過。

## 問題3: クリップラベルが生ID表示

### 原因

`data.targetId` が ULID（`01KHV3D6ZMBRGS0G0ZRMN03J2A`）で表示されていた。

### 修正

```tsx
// Before
{data.trackKind}

// After
{data.channelProperty ? getPropertyLabel(data.channelProperty) : data.trackKind}
```

プロパティ行: `X`, `Y`, `Alpha` 等。トラック行: `camera`, `entity` 等。

## 機能追加: キーフレームスナップ

カーソルドラッグ終了時、50ms以内にキーフレームがあれば吸い付く。

```tsx
const snapToKeyframe = (time: number): number => {
  // keyframeTimes: editorData から全KFの絶対時刻を収集（useMemo）
  // 閾値内で最も近いKFの時刻を返す
};

<Timeline onCursorDragEnd={(time) => {
  const snapped = snapToKeyframe(time);
  if (snapped !== time) timelineRef.current?.setTime(snapped);
}} />
```

## 設計判断: 再生の時間ソース分離

### 問題の経緯

TimelinePanelとTimelinePreviewの再生システムが同一の `tlCurrentTimeMs` を上書きし合い、
TimelinePreviewの画像が動かなくなる二重ループ問題が発生。

### 調査の結果

TimelinePreviewの自前RAFループ（`performance.now()` ベース）は正常に動作しており、
タイムライン通りのアニメーションを実現していた。問題はTimelinePanelの `onPlayChange` が
`tlIsPlaying` をセットすることで、TimelinePreviewのRAFループが意図せず起動される点。

### 最終的な設計

**2つの独立した再生システム**として分離：

```
[TimelinePanel]                  [TimelinePreview]
  独自のエンジン再生               独自のRAFループ再生
  ├ play → engine.play()          ├ play → RAFループ開始
  ├ tick → onTimeChange(ms)       ├ tick → onTimeChange(ms)
  └ UI: ローカル isPlaying        └ UI: tlIsPlaying
       ↓                               ↓
       └───── tlCurrentTimeMs ←─────────┘
              （共通の時間 state）
```

| 項目 | TimelinePanel | TimelinePreview |
|-----|---------------|-----------------|
| 再生エンジン | ライブラリ内蔵エンジン | `requestAnimationFrame` |
| 時間ソース | エンジンの `setTimeByTick` | `performance.now()` |
| play state | ローカル `isPlaying` | EditorPage `tlIsPlaying` |
| 出力 | `onTimeChange(ms)` | `onTimeChange(ms)` |

- TimelinePanelは `onPlayChange` を呼ばない（`tlIsPlaying` に干渉しない）
- TimelinePreviewのRAFループはTimelinePanelの再生と独立
- 両方の出力先は同じ `tlCurrentTimeMs`（片方しか再生しない前提）

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `TimelinePanel.tsx` | スクロール同期、スペーサー修正、KFスナップ、`onPlayChange` 削除 |
| `TimelinePreview.tsx` | RAFループ復元（元通り） |
| `EditorPage.tsx` | TimelinePanelの `isPlaying`/`onPlayChange` props 削除 |
| `index.css` | 左パネル overflow-y、境界線色、カーソル pointer-events |
