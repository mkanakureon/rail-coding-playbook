---
title: "ブロックカード形式のノベルゲームエディタを React で作った"
emoji: "🃏"
type: "tech"
topics: ["claudecode", "typescript", "React", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のエディタを React で構築した。テキスト、選択肢、IF 文、変数設定などのゲームロジックを「ブロックカード」として視覚的に編集できる UI を設計・実装した話を書く。

## ブロックカード形式とは

ノベルゲームのシナリオは「テキスト表示 → 選択肢 → 分岐 → 変数設定」の繰り返しで構成される。これらの要素をそれぞれ独立したカードとして表現し、上下に並べてドラッグ&ドロップで順序を変更できるようにした。

対応するブロックタイプは13種類。

```typescript
// apps/editor/src/config/blockTheme.ts
export type BlockType =
  | 'start' | 'bg' | 'ch' | 'text' | 'set_var' | 'choice'
  | 'if' | 'effect' | 'jump' | 'battle' | 'overlay' | 'timeline' | 'ksc';

export const BLOCK_THEME: Record<BlockType, BlockThemeEntry> = {
  start:    { badgeColor: 'bg-gray-600',    label: 'START',    icon: '▶' },
  bg:       { badgeColor: 'bg-green-600',   label: '背景',     icon: '🖼️' },
  ch:       { badgeColor: 'bg-blue-600',    label: 'キャラ',   icon: '👤' },
  text:     { badgeColor: 'bg-purple-600',  label: 'テキスト', icon: '💬' },
  set_var:  { badgeColor: 'bg-indigo-600',  label: '変数',     icon: '📊' },
  choice:   { badgeColor: 'bg-yellow-600',  label: '選択肢',   icon: '🔀' },
  if:       { badgeColor: 'bg-cyan-600',    label: 'IF文',     icon: '❓' },
  effect:   { badgeColor: 'bg-amber-600',   label: 'FX',       icon: '✨' },
  jump:     { badgeColor: 'bg-orange-600',  label: 'ジャンプ', icon: '➡️' },
  battle:   { badgeColor: 'bg-red-600',     label: 'バトル',   icon: '⚔' },
  overlay:  { badgeColor: 'bg-fuchsia-600', label: 'OVL',      icon: '🌧️' },
  timeline: { badgeColor: 'bg-rose-600',    label: '演出TL',   icon: '🎬' },
  ksc:      { badgeColor: 'bg-teal-600',    label: 'スクリプト', icon: '📝' },
};
```

各ブロックタイプに固有の色・ラベル・アイコンを `blockTheme.ts` で一元管理している。

## CardShell：全ブロックの共通シェル

すべてのブロックカードは `CardShell` コンポーネントを共通の外殻として使う。

```tsx
// apps/editor/src/components/blocks/CardShell.tsx
export default function CardShell({
  blockId,
  blockType,
  onMove,
  onDelete,
  canMoveUp,
  canMoveDown,
  children,
  onClick,
  after,
}: CardShellProps) {
  const bp = useBreakpoint();
  const theme = BLOCK_THEME[blockType];

  return (
    <div className="block-card" data-block-id={blockId}>
      <div
        className={`flex items-center gap-2 py-2${onClick ? ' cursor-pointer' : ''}`}
        onClick={onClick}
      >
        <span className={`block-type ${theme.badgeColor} text-xs px-2 py-1`}>
          {theme.label}
        </span>
        {children}
        {bp === 'mobile' ? (
          <>
            <InlineDeleteConfirm onConfirm={onDelete} />
            <BlockMenu onMoveUp={() => onMove('up')} onMoveDown={() => onMove('down')}
              onDelete={onDelete} canMoveUp={canMoveUp} canMoveDown={canMoveDown} />
          </>
        ) : (
          <>
            <InlineDeleteConfirm onConfirm={onDelete} />
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onMove('up')} disabled={!canMoveUp}
                className="control-btn text-xs px-1.5 py-1 disabled:opacity-30">↑</button>
              <button onClick={() => onMove('down')} disabled={!canMoveDown}
                className="control-btn text-xs px-1.5 py-1 disabled:opacity-30">↓</button>
            </div>
          </>
        )}
      </div>
      {after}
    </div>
  );
}
```

CardShell の設計上のポイントは以下の 3 点。

1. **レスポンシブ分岐**: `useBreakpoint()` でモバイル/デスクトップを判定し、モバイルではハンバーガーメニュー（BlockMenu）、デスクトップでは上下ボタンを直接表示
2. **`children` で中身を差し替え**: テキストブロックなら本文プレビュー、選択肢ブロックなら「3 個の選択肢」のようなサマリーを表示
3. **`after` スロット**: モーダルやインラインセレクタなど、カード本体の外に描画したいコンテンツを配置

## テキストブロック：折りたたみ/展開パターン

テキストブロックは最も基本的なカードで、折りたたみ（collapsed）と展開（expanded）の 2 状態を持つ。

```tsx
// apps/editor/src/components/blocks/TextBlockCard.tsx（折りたたみ時）
if (!isExpanded) {
  return (
    <CardShell blockId={block.id} blockType="text"
      onMove={handleMove} onDelete={onDelete}
      canMoveUp={canMoveUp} canMoveDown={canMoveDown}
      onClick={() => setIsExpanded(true)}>
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate min-w-0">
        {block.body || 'テキストを入力…'}
      </p>
    </CardShell>
  );
}
```

折りたたみ時はテキスト内容を1行で `truncate` 表示し、クリックで展開する。展開時は `textarea` で自由に編集でき、枠色のカスタマイズも可能だ。

モバイルではキーボードツールバー（`KeyboardToolbar`）も表示され、iOS のソフトキーボード上に「完了」ボタンが出る。

## ドラッグ&ドロップ：dnd-kit の導入

ブロックの並び替えには `@dnd-kit/core` と `@dnd-kit/sortable` を使っている。

```tsx
// apps/editor/src/components/BlockList.tsx
export default function BlockList() {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // START ブロックはドラッグ不可
  const sortableBlocks = currentPage.blocks.slice(1);

  return (
    <div className="block-list" ref={blockListRef}>
      {currentPage.blocks[0] && renderBlock(currentPage.blocks[0], 0)}
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds}
          strategy={verticalListSortingStrategy}>
          {sortableBlocks.map((block, sortableIndex) => (
            <SortableBlockWrapper key={block.id} id={block.id}>
              {renderBlock(block, sortableIndex + 1)}
            </SortableBlockWrapper>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

設計判断のポイント。

- **START ブロックは固定**: `blocks[0]` は常に START で、ドラッグ対象から除外
- **activationConstraint**: `distance: 8` と `delay: 200` を設定し、通常のクリック/タッチと誤判定しないようにする
- **TouchSensor の tolerance**: モバイルでは指がわずかに動くことがあるため、5px の許容範囲を設定

## 変数ブロック：インラインコンパクト編集

変数設定ブロック（`SetVarBlockCard`）は展開せずにインラインで編集できる。

```tsx
// apps/editor/src/components/blocks/SetVarBlockCard.tsx
export default function SetVarBlockCard({ block, ... }: Props) {
  const { updateBlock } = useEditorStore();

  return (
    <CardShell blockId={block.id} blockType="set_var" ...>
      <div className="flex-1 flex items-center gap-1 text-sm font-mono
        dark:text-gray-300 min-w-0">
        <input type="text" value={block.varName}
          onChange={(e) => updateBlock(block.id, { varName: e.target.value })}
          placeholder="変数名"
          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded" />
        <select value={block.operator}
          onChange={(e) => updateBlock(block.id, { operator: e.target.value })}>
          <option value="=">=</option>
          <option value="+=">+=</option>
          <option value="-=">-=</option>
        </select>
        <input type="text" value={block.value}
          onChange={(e) => updateBlock(block.id, { value: e.target.value })}
          placeholder="値" className="w-20 px-2 py-1 text-xs border ..." />
      </div>
    </CardShell>
  );
}
```

`変数名` `演算子` `値` の 3 つの入力を横一列に並べたコンパクトなレイアウト。CardShell の `children` に直接 input を並べるだけで実現している。

## ブロック追加：モバイルは FAB、デスクトップはボタン

新しいブロックを追加する UI もデバイスによって切り替わる。

```tsx
// BlockList.tsx
{!isMobile && (
  <button onClick={() => setShowBottomSheet(true)}
    className="add-block-btn">
    + ブロック追加
  </button>
)}
{isMobile && <FABMenu onAddBlock={handleAddBlock} />}
```

モバイルでは画面右下の FAB（Floating Action Button）をタップするとメニューが展開し、デスクトップではブロック一覧の末尾にあるボタンからボトムシート形式でブロック種別を選べる。

ブロック追加後は自動スクロールで追加位置まで移動する。

```tsx
useEffect(() => {
  if (lastAddedBlockId) {
    setTimeout(() => {
      const blockElement = document.querySelector(
        `[data-block-id="${lastAddedBlockId}"]`
      );
      if (blockElement) {
        blockElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setLastAddedBlockId(null);
    }, 100);
  }
}, [lastAddedBlockId]);
```

## renderBlock：ブロックタイプごとのディスパッチ

ブロックの描画は `renderBlock` 関数で type に応じたコンポーネントにディスパッチされる。

```tsx
const renderBlock = (block: Block, index: number) => {
  const onMove = (direction: 'up' | 'down') => moveBlock(block.id, direction);
  const onDelete = () => removeBlock(block.id);
  const canMoveUp = index > 1;
  const canMoveDown = index < currentPage.blocks.length - 1;

  switch (block.type) {
    case 'start':
      return <StartBlockCard key={block.id} block={block} />;
    case 'text':
      return <TextBlockCard key={block.id} block={block}
        onMove={onMove} onDelete={onDelete}
        canMoveUp={canMoveUp} canMoveDown={canMoveDown} />;
    case 'choice':
      return <ChoiceBlockCard key={block.id} block={block}
        onMove={onMove} onDelete={onDelete}
        canMoveUp={canMoveUp} canMoveDown={canMoveDown} />;
    case 'if':
      return <IfBlockCard key={block.id} block={block}
        onMove={onMove} onDelete={onDelete}
        canMoveUp={canMoveUp} canMoveDown={canMoveDown} />;
    // ... 他のブロックタイプも同様
  }
};
```

## 長押しコンテキストメニュー（モバイル専用）

モバイルではブロックを長押しするとコンテキストメニューが表示される。

```tsx
function BlockLongPressWrapper({ children, index, isMobile, onLongPress }) {
  const longPressHandlers = useLongPress({
    onLongPress: () => onLongPress(index),
  });

  if (!isMobile || isStartBlock) {
    return <>{children}</>;
  }

  return <div {...longPressHandlers}>{children}</div>;
}
```

`useLongPress` カスタムフックで長押しを検出し、`hapticFeedback('medium')` で振動フィードバックを返す。

## 状態管理：Zustand ストア

エディタの状態管理には Zustand を使っている。`useEditorStore` から `addBlock`, `updateBlock`, `moveBlock`, `removeBlock`, `reorderBlocks` などの操作関数を取得して各コンポーネントに渡す。

この設計は CLAUDE.md の「State の配置（React）」ルールに従っている。

> 共有 state を追加・移動するときは、必ず以下を確認する。
> 1. その state を参照または更新するコンポーネントを全てリストアップする
> 2. リストアップしたコンポーネントの共通の最小祖先を特定し、そこに state を置く

ブロックの CRUD は全コンポーネントから参照されるためグローバルストアに置き、折りたたみ状態のようなローカルな UI 状態は各カードコンポーネント内の `useState` に閉じている。

## まとめ

ブロックカード形式のエディタは、以下の設計原則で構築した。

- **CardShell による統一**: 全ブロック共通の外殻で、テーマ・操作ボタン・レスポンシブ対応を一元管理
- **折りたたみ/展開**: 折りたたみ時は 1 行サマリー、展開時に詳細編集
- **dnd-kit によるドラッグ&ドロップ**: タッチ・マウス両対応の並び替え
- **モバイルファースト**: FAB、長押し、ボトムシート、キーボードツールバー

ノベルゲームのシナリオ構造を「カードの並び」に抽象化することで、プログラミング知識がなくてもゲームロジックを構築できるエディタになった。

---

ブロックカード形式のエディタを作る中で、ノベルゲームのシナリオ構造と React コンポーネントの構造が自然に対応することに気づいた。CardShell という共通シェルを最初に設計したことが、その後の13種類のブロック実装を一貫したものにしてくれた。モバイルとデスクトップの UI 分岐は `useBreakpoint` に集約することで、各カードコンポーネントの複雑さを抑えられた。

　　　　　　　　　　Claude Opus 4.6
