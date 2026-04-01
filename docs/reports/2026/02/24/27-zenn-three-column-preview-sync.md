---
title: "3 カラムレイアウト + ブロック選択時プレビュー連動の設計"
emoji: "🖥"
type: "tech"
topics: ["claudecode", "React", "UI設計", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエディタを開発するにあたり、最も悩んだのが「編集画面のレイアウト」でした。シナリオの構成を俯瞰しつつ、個々のブロックのプロパティを詳細に編集し、さらにその結果をリアルタイムにプレビューで確認する。この 3 つの要求を同時に満たすために、3 カラムレイアウトを採用し、ブロック選択をトリガーにしてプロパティパネルとエンジンプレビューを連動させる設計にしました。

本記事では、実際のコードを交えながら、この設計の Why と How を解説します。

## 全体構成: EditorPage の 3 カラム

エディタのメインページ `EditorPage.tsx` は、画面幅 1024px 以上（`isWideScreen`）のとき 3 カラムレイアウトに切り替わります。

```
+-------------------+---+---------------------+---+------------------+
| SidebarOutline    | R | BlockList (center)   | R | SidebarInspector |
| (左サイドバー)     | e |                      | e | (右サイドバー)    |
|                   | s |                      | s |                  |
| - ページ構成       | i | ブロックカード一覧     | z | - プロパティ      |
| - 変数一覧         | z |                      | e | - プレビュー      |
| - キャラ管理       | e |                      |   |                  |
| - アセット管理      |   |                      |   |                  |
+-------------------+---+---------------------+---+------------------+
                         | TimelinePanel (下部)                       |
                         +-------------------------------------------+
```

左カラムはアウトライン（ブロック一覧のサマリー表示）、中央はブロックの詳細編集カード、右カラムはプロパティインスペクタとプレビューです。

## selectedBlockId: 3 カラムを繋ぐ状態

この設計の核心は、`selectedBlockId` という単一の state です。

```tsx
// EditorPage.tsx
const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
```

この state が 3 つのコンポーネントを連動させます。

1. **SidebarOutline**: ブロックをクリックすると `onSelectBlock(blockId)` が発火し、`selectedBlockId` が更新される
2. **BlockList (center)**: `data-block-id` 属性を使い、クリックされたブロックの ID を取得
3. **SidebarInspector**: `selectedBlockId` に対応するブロックのプロパティを表示し、下部でプレビューを描画

## 左サイドバー: SidebarOutline

左サイドバーはページ内の全ブロックをコンパクトに一覧表示します。

```tsx
// SidebarOutline.tsx
export default function SidebarOutline({ selectedBlockId, onSelectBlock }: Props) {
  const { project, currentPageIndex } = useEditorStore();
  const currentPage = project?.pages[currentPageIndex];

  const handleClick = (blockId: string) => {
    onSelectBlock(blockId);
    // 中央カラムの該当ブロックまでスクロール
    const el = document.querySelector(`[data-block-id="${blockId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* キャラクター管理、アセット管理ボタン */}
      {/* ... */}
      <div className="flex-1 overflow-y-auto">
        {currentPage?.blocks.map((block, index) => {
          const isSelected = block.id === selectedBlockId;
          return (
            <button
              key={block.id}
              onClick={() => handleClick(block.id)}
              className={`... ${
                isSelected
                  ? 'bg-blue-100 border-l-2 border-blue-600'
                  : 'hover:bg-gray-100 border-l-2 border-transparent'
              }`}
            >
              <span>{index}</span>
              <span className="badge">{theme.label}</span>
              <span className="truncate">{summary}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

重要なのは `scrollIntoView` です。アウトラインでブロックを選択すると、中央カラムの対応するブロックカードまで自動スクロールし、視覚的にも「どのブロックを編集しているか」が明確になります。

## 中央カラム: クリックイベントの委譲

中央カラムでは、ブロックカード全体を囲む `div` にクリックハンドラーを設定し、イベント委譲（event delegation）でブロック ID を取得します。

```tsx
// EditorPage.tsx
<div
  id="editor-main"
  className="editor-center"
  onClick={(e) => {
    const blockEl = (e.target as HTMLElement).closest('[data-block-id]');
    if (blockEl) {
      setSelectedBlockId(blockEl.getAttribute('data-block-id'));
    }
  }}
>
  <BlockList />
</div>
```

各ブロックカードは `data-block-id` 属性を持ちます。`closest()` でバブリングしてきたイベントから最も近い `data-block-id` 要素を見つけることで、個々のブロックカードにクリックハンドラーを設定する必要がなくなります。これはブロック数が多い場合のパフォーマンスに貢献します。

## 右サイドバー: SidebarInspector

右サイドバーは上下に分割されています。上部がプロパティインスペクタ、下部がプレビューです。

```tsx
// SidebarInspector.tsx
export default function SidebarInspector({ selectedBlockId, ... }: Props) {
  const { project, currentPageIndex } = useEditorStore();
  const currentPage = project?.pages[currentPageIndex];
  const block = currentPage?.blocks.find((b) => b.id === selectedBlockId);

  return (
    <div className="flex flex-col h-full">
      {/* 上部: プロパティインスペクタ */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="header">プロパティ</div>
        {block ? (
          <BlockPropertyEditor block={block} />
        ) : (
          <div>ブロックを選択してください</div>
        )}
      </div>

      {/* 下部: プレビュー（16:9 アスペクト比で contain） */}
      <div ref={previewContainerRef} className="flex-1 min-h-0 bg-black">
        <div style={{ width: previewSize.width, height: previewSize.height }}>
          {block?.type === 'timeline' ? (
            <TimelinePreview block={block} currentTimeMs={currentTimeMs} />
          ) : (
            <SidebarPreview selectedBlockId={selectedBlockId} />
          )}
        </div>
      </div>
    </div>
  );
}
```

### ブロックタイプ別のプロパティエディタ

`BlockPropertyEditor` はブロックタイプに応じて異なるフォームを表示します。

```tsx
function BlockPropertyEditor({ block }: { block: Block }) {
  switch (block.type) {
    case 'bg':     return <BgProps block={block} />;
    case 'ch':     return <ChProps block={block} />;
    case 'text':   return <TextProps block={block} />;
    case 'effect': return <EffectProps block={block} />;
    case 'jump':   return <JumpProps block={block} />;
    // ... 他のタイプ
  }
}
```

たとえば背景ブロックでは、アセットのサムネイルとドロップダウンが表示されます。

```tsx
function BgProps({ block }) {
  const { project, updateBlock } = useEditorStore();
  const bgAssets = project?.assets.filter(isBgAsset) || [];
  const currentAsset = bgAssets.find((a) => a.id === block.assetId);

  return (
    <div>
      {currentAsset && (
        <div className="aspect-video rounded overflow-hidden">
          <img src={getAssetUrl(currentAsset.url)} alt="" />
        </div>
      )}
      <select
        value={block.assetId}
        onChange={(e) => updateBlock(block.id, { assetId: e.target.value })}
      >
        {bgAssets.map((a) => (
          <option key={a.id} value={a.id}>{a.name || a.id}</option>
        ))}
      </select>
    </div>
  );
}
```

## プレビュー連動: postMessage による iframe 通信

プレビューは iframe 内でビジュアルノベルエンジン（PixiJS）を動作させています。ブロック選択が変わると、そのブロックまでの「スナップショットスクリプト」を生成し、`postMessage` で iframe に送信します。

```tsx
// SidebarPreview.tsx
export default function SidebarPreview({ selectedBlockId }: Props) {
  const { project, buildSnapshotScript } = useEditorStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendPreviewMessage = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !project || !selectedBlockId) return;

    const script = buildSnapshotScript(selectedBlockId);
    if (!script) return;

    const assets = project.assets.map((a) => ({
      id: a.id, kind: a.kind, url: a.url,
    }));

    iframeRef.current.contentWindow.postMessage(
      { type: 'previewScript', script, assets, characters, timelines },
      '*'
    );
  }, [project, selectedBlockId, buildSnapshotScript]);

  useEffect(() => {
    if (iframeLoaded && selectedBlockId) {
      sendPreviewMessage();
    }
  }, [iframeLoaded, selectedBlockId, sendPreviewMessage]);

  return (
    <div className="flex flex-col h-full">
      <iframe
        ref={iframeRef}
        src={previewUrl}
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => setIframeLoaded(true)}
      />
    </div>
  );
}
```

この設計のポイントは:

1. **スナップショットスクリプト**: 選択されたブロックまでのすべての演出命令（背景設定、キャラ表示、テキスト表示など）を KSC スクリプトとして生成する
2. **iframe の sandbox**: `allow-scripts allow-same-origin` のみ許可。エンジン側のバグがエディタに波及しない
3. **ロード完了待ち**: `onLoad` で iframe のロードを検知し、ロード完了後にスクリプトを送信

## リサイズハンドル: ドラッグで幅を調整

3 カラムの幅は固定ではなく、ユーザーがドラッグで調整できます。

```tsx
// EditorPage.tsx
const [leftWidth, setLeftWidth] = useState(240);
const [rightWidth, setRightWidth] = useState(340);

const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!isDragging.current) return;
  const delta = e.clientX - startX.current;
  const newWidth = isDragging.current === 'left'
    ? Math.max(180, Math.min(400, startWidth.current + delta))
    : Math.max(200, Math.min(450, startWidth.current - delta));
  if (isDragging.current === 'left') setLeftWidth(newWidth);
  else setRightWidth(newWidth);
}, []);
```

CSS Grid の `gridTemplateColumns` で左カラムの幅を制御し、右カラムは `flexShrink: 0` の固定幅で配置しています。

```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: `${leftWidth}px 4px 1fr`,
  flex: 1,
  minHeight: 0,
}}>
  <div className="editor-sidebar-left">
    <SidebarOutline ... />
  </div>
  <div className="resize-handle" onMouseDown={(e) => startResize('left', e)} />
  <div className="editor-center">
    <BlockList />
  </div>
</div>
```

## State の配置: CLAUDE.md のルールに従う

CLAUDE.md には「共有 state は共通の最小祖先に置く」というルールがあります。

```
EditorPage (selectedBlockId をここに配置)
  ├── SidebarOutline     (参照 + 更新)
  ├── BlockList / center (更新)
  └── SidebarInspector   (参照)
       ├── BlockPropertyEditor (参照)
       └── SidebarPreview      (参照)
```

`selectedBlockId` は SidebarOutline、中央カラム、SidebarInspector の 3 箇所で使われます。これらの共通の最小祖先は `EditorPage` です。したがって `EditorPage` に state を配置し、props で下位コンポーネントに渡すのが正しい設計です。

## モバイル対応: タブ切り替えへのフォールバック

画面幅が狭い場合（640px 未満）は、3 カラムではなくタブ切り替え式の UI にフォールバックします。

```tsx
if (isWideScreen) {
  return (
    // 3 カラムレイアウト
  );
}

return (
  <div className="editor-container">
    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    {renderContent()} {/* editor | character | asset | settings */}
    <PageNavigator />
  </div>
);
```

モバイルではスワイプジェスチャーでページ間を移動でき、FAB（Floating Action Button）でブロックを追加します。

## タイムラインブロックの特殊処理

タイムラインブロックが選択された場合、プロパティパネルとプレビューはタイムライン専用の UI に切り替わります。

```tsx
const selectedTimelineBlock = selectedBlock?.type === 'timeline'
  ? (selectedBlock as TimelineBlock)
  : null;

// タイムラインブロック選択時は自動でタイムラインパネルを表示
const effectiveShowTimeline = showTimeline || !!selectedTimelineBlock;
```

タイムラインでは、シーク位置（`tlCurrentTimeMs`）と再生状態（`tlIsPlaying`）も EditorPage で管理し、プロパティパネル、プレビュー、タイムラインパネルの 3 者間で同期します。

```tsx
// EditorPage.tsx
const [tlCurrentTimeMs, setTlCurrentTimeMs] = useState(0);
const [tlIsPlaying, setTlIsPlaying] = useState(false);

// ブロック選択変更時にリセット
useEffect(() => {
  setTlCurrentTimeMs(0);
  setTlIsPlaying(false);
  setSelectedKeyframe(null);
}, [selectedBlockId]);
```

## まとめ: 設計判断の理由

| 判断 | Why |
|------|-----|
| 3 カラム | 俯瞰・編集・プレビューを同時に行うため |
| selectedBlockId を EditorPage に配置 | 3 コンポーネントの共通の最小祖先 |
| イベント委譲 | ブロック数が多い場合のパフォーマンス |
| iframe + postMessage | エンジンの隔離とセキュリティ |
| リサイズハンドル | ユーザーの画面サイズや好みに対応 |
| モバイルフォールバック | 狭い画面でも使えるように |

ビジュアルノベルエディタのように「構造化されたデータの編集」と「リアルタイムプレビュー」が必要なアプリケーションでは、3 カラムレイアウトは非常に有効なパターンです。重要なのは、カラム間の連動を担う state を適切な位置に配置し、データフローを一方向に保つことです。

---

3 カラムレイアウトの設計は、ビジュアルノベルエディタという用途に特化していますが、「アウトライン + 編集 + プレビュー」というパターンは多くのエディタ系アプリケーションに応用できます。EditorPage.tsx を起点に、state の配置ルールを守りながら、段階的に機能を追加していった過程を記事にまとめました。

　　　　　　　　　　Claude Opus 4.6
