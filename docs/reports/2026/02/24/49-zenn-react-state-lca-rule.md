---
title: "State の配置ルール — React の共通最小祖先を徹底する"
emoji: "🌳"
type: "tech"
topics: ["claudecode", "react", "typescript", "設計"]
published: false
---

## はじめに

React アプリケーションで state をどこに配置するかは、パフォーマンスと保守性に直結する設計判断です。ビジュアルノベルエンジン「kaedevn」のエディタ（`apps/editor`）は、3 カラムレイアウト + タイムラインパネル + タブナビゲーションを持つ複雑な UI で、十数個の state が `EditorPage.tsx` に集約されています。

この記事では、CLAUDE.md に明文化した「共通最小祖先（LCA: Lowest Common Ancestor）ルール」と、その実践を解説します。

## LCA ルールとは

### CLAUDE.md での定義

```markdown
### State の配置（React）

共有 state を追加・移動するときは、必ず以下を確認する。

1. その state を**参照または更新するコンポーネントを全てリストアップ**する
2. リストアップしたコンポーネントの**共通の最小祖先**を特定し、そこに state を置く
3. 判断材料として `EditorPage.tsx` の render 構造を確認する

兄弟コンポーネント間で値を共有する必要があるなら、片方の内部に state を置かず、共通の親に引き上げる。
```

このルールは、React の state 管理における「持ち上げ（lifting state up）」の原則を、具体的な手順として定義したものです。

### なぜ明文化が必要なのか

Claude Code と協働する際、AI は知識として「state は必要な場所に配置する」ことを知っています。しかし、具体的なコンポーネントツリーを見ずに「ここに state を置きます」と判断してしまうことがあります。特に以下のケースで問題が発生します。

1. **兄弟コンポーネント間の共有**: `SidebarOutline` と `SidebarInspector` が同じ `selectedBlockId` を参照する場合、どちらか一方に state を置くと、もう一方にはバケツリレー（prop drilling）で渡す必要がある
2. **パネル間の連動**: タイムラインパネルとプロパティパネルが同じ `currentTimeMs` を参照する場合
3. **レイアウト切り替え**: デスクトップとモバイルで異なるコンポーネント構造になる場合

## EditorPage.tsx の render 構造

実際のエディタページのコンポーネントツリーを見てみましょう。

### デスクトップレイアウト（1024px 以上）

```
EditorPage
  ├── ToastContainer
  ├── StickyHeader
  │     └── Header
  ├── [3カラムレイアウト]
  │     ├── [左エリア]
  │     │     ├── SidebarOutline     ← selectedBlockId を参照
  │     │     ├── resize-handle
  │     │     ├── BlockList          ← ブロック一覧
  │     │     └── TimelinePanel      ← tlCurrentTimeMs, selectedKeyframe を参照
  │     ├── resize-handle
  │     └── [右サイドバー]
  │           └── SidebarInspector   ← selectedBlockId, tlCurrentTimeMs を参照
  └── PageNavigator
```

### モバイルレイアウト（640px 以下）

```
EditorPage
  ├── ToastContainer
  ├── StickyHeader
  │     └── Header
  ├── [editor-main (スワイプ対応)]
  │     ├── TabNavigation
  │     └── [activeTab に応じた表示]
  │           ├── BlockList      (editor タブ)
  │           ├── CharacterPanel (character タブ)
  │           ├── AssetPanel     (asset タブ)
  │           └── SettingsPanel  (settings タブ)
  └── PageNavigator
```

デスクトップでは 3 カラムに並ぶコンポーネントが、モバイルではタブ切り替えになります。しかし、どちらのレイアウトでも `EditorPage` が共通の祖先です。

## State の配置分析

`EditorPage.tsx` に配置されている主な state を分析します。

### selectedBlockId

```typescript
const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
```

| 参照するコンポーネント | 用途 |
|---|---|
| `SidebarOutline` | 選択中のブロックをハイライト |
| `SidebarInspector` | 選択中のブロックのプロパティを表示 |
| `TimelinePanel` | 選択中のブロックのタイムラインを表示 |
| `EditorPage` 自身 | クリックイベントで `selectedBlockId` を更新 |

4 つのコンポーネントが参照しています。`SidebarOutline` と `SidebarInspector` は兄弟コンポーネントであり、`TimelinePanel` はさらに別の子コンポーネントです。これらの共通最小祖先は `EditorPage` です。

もし `selectedBlockId` を `SidebarOutline` 内部に持たせた場合、`SidebarInspector` と `TimelinePanel` に値を渡すために、`EditorPage` を経由するバケツリレーが必要になります。結局 `EditorPage` に上がってくるなら、最初から `EditorPage` に置く方がシンプルです。

### tlCurrentTimeMs（タイムラインシーク位置）

```typescript
const [tlCurrentTimeMs, setTlCurrentTimeMs] = useState(0);
const [tlIsPlaying, setTlIsPlaying] = useState(false);
```

| 参照するコンポーネント | 用途 |
|---|---|
| `TimelinePanel` | シークバーの位置表示・操作 |
| `SidebarInspector` | 現在時刻のプロパティ値表示 |

`TimelinePanel` と `SidebarInspector` は兄弟です。「タイムラインのシーク位置」と「プロパティパネルの現在時刻表示」を同期するために、共通の親である `EditorPage` に state を置いています。

```typescript
// EditorPage.tsx
<TimelinePanel
  onTimeChange={setTlCurrentTimeMs}  // タイムラインから時刻変更を受け取る
  // ...
/>

<SidebarInspector
  currentTimeMs={tlCurrentTimeMs}     // インスペクタに時刻を渡す
  onTimeChange={setTlCurrentTimeMs}   // インスペクタからも時刻変更可能
  // ...
/>
```

タイムラインのシークバーを動かすと `setTlCurrentTimeMs` が呼ばれ、`SidebarInspector` の表示が連動します。逆に、`SidebarInspector` から数値入力で時刻を変更すると、タイムラインのシークバーも動きます。

### selectedKeyframe

```typescript
const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframe | null>(null);
```

| 参照するコンポーネント | 用途 |
|---|---|
| `TimelinePanel` | 選択中のキーフレームをハイライト |
| `SidebarInspector` | 選択中のキーフレームのプロパティ編集 |

これも `TimelinePanel` と `SidebarInspector` の兄弟間共有です。キーフレームを選択すると、プロパティパネルに値が表示され、プロパティを編集するとタイムライン上の表示が更新されます。

### selectedBlockId と selectedKeyframe の連動

```typescript
// Reset timeline seek and keyframe selection when selected block changes
useEffect(() => {
  setTlCurrentTimeMs(0);
  setTlIsPlaying(false);
  setSelectedKeyframe(null);
}, [selectedBlockId]);
```

`selectedBlockId` が変わると、タイムラインの再生位置とキーフレーム選択がリセットされます。これは「異なるブロックのタイムラインが前のブロックのシーク位置を引き継いでしまう」問題を防ぐためです。

state が同じ `EditorPage` に配置されているからこそ、この連動ロジックを `useEffect` 1 つで書けます。

## リサイズ state の配置

```typescript
const [leftWidth, setLeftWidth] = useState(240);
const [rightWidth, setRightWidth] = useState(340);
const [showTimeline, setShowTimeline] = useState(false);
const [timelineHeight, setTimelineHeight] = useState(200);
```

リサイズ関連の state は `EditorPage` にまとまっています。

| state | 参照するコンポーネント |
|---|---|
| `leftWidth` | 左サイドバーの CSS `width` |
| `rightWidth` | 右サイドバーの CSS `width` |
| `timelineHeight` | タイムラインパネルの CSS `height` |
| `showTimeline` | タイムラインパネルの表示/非表示 |

これらは CSS レイアウトに直結するため、レイアウトを制御する `EditorPage` に配置するのが自然です。リサイズハンドルは `EditorPage` の render 内に直接書かれています。

```typescript
const startResize = (side: 'left' | 'right', e: React.MouseEvent) => {
  isDragging.current = side;
  startX.current = e.clientX;
  startWidth.current = side === 'left' ? leftWidth : rightWidth;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};
```

## レイアウト条件の管理

```typescript
const isMobile = useMediaQuery('(max-width: 640px)');
const isWideScreen = useMediaQuery('(min-width: 1024px)');
```

`useMediaQuery` の結果は state ではなく hooks の戻り値ですが、レイアウト切り替えに使われる重要な値です。

```typescript
if (isWideScreen) {
  return (
    // 3 カラムレイアウト
    // SidebarOutline + BlockList + SidebarInspector
  );
}

return (
  // タブナビゲーション
  // TabNavigation + renderContent()
);
```

`isWideScreen` が `true` なら 3 カラムレイアウト、`false` ならタブナビゲーションを render します。この分岐が `EditorPage` のトップレベルにあるため、全ての子コンポーネントのレイアウトが統一的に制御されます。

## スワイプ state の配置

```typescript
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => {
    if (isMobile && project && currentPageIndex < project.pages.length - 1) {
      setCurrentPage(currentPageIndex + 1);
    }
  },
  onSwipedRight: () => {
    if (isMobile && currentPageIndex > 0) {
      setCurrentPage(currentPageIndex - 1);
    }
  },
  trackMouse: false,
  trackTouch: true,
});
```

スワイプジェスチャーは `currentPageIndex`（Zustand store）を更新します。`useSwipeable` は `EditorPage` で呼び出し、モバイルレイアウトの `editor-main` div に `{...swipeHandlers}` を適用しています。

```typescript
<div id="editor-main" className="editor-main" {...(isMobile ? swipeHandlers : {})}>
```

`isMobile` が `true` の場合のみスワイプを有効にします。デスクトップでは 3 カラムレイアウトを使うため、スワイプは不要です。

## LCA ルールの適用フロー

新しい state を追加する場合の手順を、具体例で示します。

### 例: 「プレビューのズーム率」を追加する場合

1. **参照/更新するコンポーネントのリストアップ**

   - `TimelinePanel`: プレビュー表示のズーム率を参照
   - `SidebarInspector`: ズーム率の数値入力
   - `Header`: ズーム率のリセットボタン

2. **共通最小祖先の特定**

   ```
   EditorPage           ← ここが LCA
     ├── Header         ← ズーム率リセットボタン
     ├── TimelinePanel  ← プレビュー表示
     └── SidebarInspector ← 数値入力
   ```

   全て `EditorPage` の子なので、LCA は `EditorPage` です。

3. **state の配置**

   ```typescript
   // EditorPage.tsx
   const [previewZoom, setPreviewZoom] = useState(1.0);
   ```

### 例: 「インスペクタのタブ切り替え」を追加する場合

1. **参照/更新するコンポーネントのリストアップ**

   - `SidebarInspector`: タブの表示切り替え
   - （他のコンポーネントは参照しない）

2. **共通最小祖先の特定**

   `SidebarInspector` のみが参照するため、LCA は `SidebarInspector` 自身です。

3. **state の配置**

   ```typescript
   // SidebarInspector.tsx
   const [inspectorTab, setInspectorTab] = useState<'props' | 'style'>('props');
   ```

この場合は `EditorPage` に上げる必要はありません。1 つのコンポーネントだけが参照する state は、そのコンポーネント内部に置きます。

## Zustand store との使い分け

`EditorPage` には `useEditorStore`（Zustand）も使われています。

```typescript
const { project, setProject, currentPageIndex, setCurrentPage } = useEditorStore();
```

| 管理場所 | 対象 | 理由 |
|---|---|---|
| Zustand store | `project`, `currentPageIndex` | 複数ページにまたがるグローバル状態 |
| `EditorPage` の `useState` | `selectedBlockId`, `tlCurrentTimeMs` | ページ内の UI 状態 |
| 子コンポーネント内 | `inspectorTab` など | コンポーネント固有の UI 状態 |

Zustand store はページ遷移をまたいで保持すべきデータ（プロジェクト情報、ページインデックス）に使い、`useState` はページ内で完結する UI 状態に使います。

## AI との協働における効果

LCA ルールを CLAUDE.md に明文化してから、以下の変化がありました。

### Before

- Claude Code が `SidebarInspector` 内に `selectedBlockId` を追加しようとする
- 「他のコンポーネントでも使いますか？」と聞き返す必要がある
- 手戻りが発生する

### After

- Claude Code が自発的に「`selectedBlockId` は `SidebarOutline` と `SidebarInspector` の両方で参照するため、`EditorPage` に配置します」と判断する
- render 構造を確認してから state を配置する

ルールを書くだけで AI の出力品質が変わる好例です。

## まとめ

| ポイント | 内容 |
|---|---|
| LCA ルール | state を参照する全コンポーネントの共通最小祖先に配置 |
| 手順 | リストアップ → LCA 特定 → 配置 |
| 兄弟間共有 | 親に引き上げる（バケツリレーしない） |
| 連動 state | 同じコンポーネントに配置し、`useEffect` で連動 |
| Zustand 使い分け | グローバル状態は store、ページ内 UI は `useState` |
| AI 連携 | CLAUDE.md に明文化して判断精度を向上 |

---

「state をどこに置くか」は React 開発で最も頻繁に発生する設計判断です。LCA ルールを明文化することで、人間にとっても AI にとっても判断基準が明確になります。特に AI と協働する場合、「まずコンポーネントツリーを確認してから state を配置する」という手順を書いておくだけで、手戻りが大幅に減ります。ルールは短いほど守られやすい。3 ステップに凝縮したことが、このルールの一番の工夫かもしれません。

　　　　　　　　　　Claude Opus 4.6
