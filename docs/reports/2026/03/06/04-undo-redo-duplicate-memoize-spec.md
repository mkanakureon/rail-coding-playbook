# 設計書: Undo/Redo、ブロック複製、メモ化

**日付**: 2026-03-06
**対象**: apps/editor

---

## 1. Undo / Redo

### 概要

ブロック編集操作の取り消し・やり直し機能。Zustand の状態スナップショットを履歴スタックで管理する。

### 方針

**zustand/middleware の `temporal` は使わない**（パッケージ追加を避ける）。自前のミドルウェアを useEditorStore に組み込む。

### データ構造

```typescript
type HistoryEntry = {
  pages: EditorPage[];       // ページ全体のスナップショット
  currentPageIndex: number;
};

type HistoryState = {
  past: HistoryEntry[];      // 最大 50 エントリ
  future: HistoryEntry[];
};
```

- `past` は最大50件（メモリ制約）。超過時は古いものから削除
- `future` は新しい操作が発生した時点でクリア
- `project.assets` / `project.characters` は履歴に含めない（API との同期が複雑になるため）

### ストア変更

```typescript
// useEditorStore.ts に追加
type EditorState = {
  // ... 既存
  _history: HistoryState;
  undo: () => void;
  redo: () => void;
  _pushHistory: () => void;  // 内部用
};
```

### 履歴記録タイミング

以下のアクションの**実行前**に `_pushHistory()` を呼ぶ:

| アクション | 記録 |
|-----------|------|
| addBlock | Yes |
| removeBlock | Yes |
| updateBlock | Yes（デバウンス 500ms） |
| moveBlock | Yes |
| reorderBlocks | Yes |
| addPage / removePage / renamePage | Yes |
| setBlocks（KSEditor からの一括更新） | Yes |
| setProject（初回ロード） | No（履歴リセット） |
| setCurrentPage | No（表示切替のみ） |

### updateBlock のデバウンス

テキスト入力やスライダー操作は高頻度で `updateBlock` を呼ぶ。毎回スナップショットを取ると履歴が汚れる。

```typescript
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: HistoryEntry | null = null;

function pushHistoryDebounced(get: () => EditorState) {
  if (!pendingSnapshot) {
    // 最初の変更時点のスナップショットを保持
    pendingSnapshot = takeSnapshot(get());
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (pendingSnapshot) {
      get()._history.past.push(pendingSnapshot);
      get()._history.future = [];
      pendingSnapshot = null;
    }
  }, 500);
}
```

### undo / redo 実装

```typescript
undo: () => {
  const state = get();
  const { past, future } = state._history;
  if (past.length === 0) return;

  const current = takeSnapshot(state);
  const previous = past[past.length - 1];

  set({
    project: {
      ...state.project!,
      pages: previous.pages,
    },
    currentPageIndex: previous.currentPageIndex,
    _history: {
      past: past.slice(0, -1),
      future: [current, ...future],
    },
  });
},

redo: () => {
  const state = get();
  const { past, future } = state._history;
  if (future.length === 0) return;

  const current = takeSnapshot(state);
  const next = future[0];

  set({
    project: {
      ...state.project!,
      pages: next.pages,
    },
    currentPageIndex: next.currentPageIndex,
    _history: {
      past: [...past, current],
      future: future.slice(1),
    },
  });
},
```

### キーボードショートカット

```typescript
// EditorPage.tsx の useEffect
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      useEditorStore.getState().undo();
    }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      useEditorStore.getState().redo();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

### UI

- ヘッダーに Undo / Redo ボタン追加（矢印アイコン）
- `past.length === 0` → Undo 無効化
- `future.length === 0` → Redo 無効化
- ツールチップ: 「元に戻す (Ctrl+Z)」「やり直し (Ctrl+Shift+Z)」

### テスト

```
1. addBlock → undo → ブロックが消える → redo → ブロックが戻る
2. updateBlock(text) → undo → 元のテキストに戻る
3. removeBlock → undo → ブロックが復活
4. reorderBlocks → undo → 元の順序
5. 50回操作 → 51回目で最古の履歴が消える
6. undo 後に新操作 → future がクリアされる
7. デバウンス: スライダー連続操作 → undo 1回で操作前に戻る
```

---

## 2. ブロック複製

### 概要

選択中のブロックを複製して直下に挿入する。

### ストア変更

```typescript
type EditorState = {
  // ... 既存
  duplicateBlock: (blockId: string) => void;
};
```

### 実装

```typescript
duplicateBlock: (blockId) => {
  const state = get();
  if (!state.project) return;

  const page = state.project.pages[state.currentPageIndex];
  if (!page) return;

  const blockIndex = page.blocks.findIndex((b) => b.id === blockId);
  if (blockIndex === -1) return;

  const original = page.blocks[blockIndex];

  // start ブロックは複製不可
  if (original.type === 'start') return;

  // 履歴に記録
  state._pushHistory();

  // ディープコピー + 新 ID 生成
  const clone = deepCloneBlock(original);

  const newBlocks = [...page.blocks];
  newBlocks.splice(blockIndex + 1, 0, clone);

  // ストア更新
  set({
    project: {
      ...state.project,
      pages: state.project.pages.map((p, i) =>
        i === state.currentPageIndex ? { ...p, blocks: newBlocks } : p
      ),
    },
  });
},
```

### deepCloneBlock

```typescript
function deepCloneBlock(block: Block): Block {
  const ts = Date.now();
  const newId = `${block.type}-${ts}`;
  const clone = JSON.parse(JSON.stringify(block));
  clone.id = newId;

  // ネストブロック（if の then/else）も ID を再生成
  if (clone.type === 'if') {
    clone.thenBlocks = clone.thenBlocks.map((b: Block) => deepCloneBlock(b));
    if (clone.elseBlocks) {
      clone.elseBlocks = clone.elseBlocks.map((b: Block) => deepCloneBlock(b));
    }
    clone.conditions = clone.conditions.map((c: any) => ({
      ...c,
      id: `${newId}-cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
  }

  // choice のオプションも ID 再生成
  if (clone.type === 'choice') {
    clone.options = clone.options.map((opt: any) => ({
      ...opt,
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
  }

  return clone;
}
```

### UI

- ブロックカードの右上メニュー（既存の削除ボタン横）に複製ボタン追加
- アイコン: コピーアイコン（2枚の四角）
- キーボード: `Ctrl+D`（選択ブロックを複製）
- 複製後、新ブロックが選択状態になる

### テスト

```
1. text ブロック複製 → 同内容の新ブロックが直下に挿入
2. bg ブロック複製 → assetId, x, y, s が保持される
3. if ブロック複製 → thenBlocks/elseBlocks の ID が全て新規
4. choice ブロック複製 → options の ID が全て新規
5. start ブロック → 複製不可（何も起きない）
6. 複製後 undo → 複製が取り消される
```

---

## 3. 大規模プロジェクト対応メモ化

### 問題

現状、168箇所のインライン関数と useMemo 7箇所のみ。100ブロック超のプロジェクトで描画パフォーマンスが劣化する。

### 原因分析

| 箇所 | 問題 | 影響 |
|------|------|------|
| SidebarInspector (1,121行) | React.memo なし、インライン関数多数 | ブロック選択のたびに全体再レンダー |
| BlockList (349行) | SortableContext が全ブロック再レンダー | ドラッグ開始時に全子コンポーネント再生成 |
| AssetSelectModal (629行) | フィルタリングロジックが毎レンダー実行 | モーダル開閉時にラグ |
| buildSnapshotScript | 毎回全ブロック走査 | プロジェクト変更時に O(n) |
| getAllVariables | 毎回全ページ全ブロック走査 | 変数ドロップダウン表示時に O(pages * blocks) |

### 対策

#### Phase 1: コンポーネントメモ化（即効性高）

**ブロックカード全14種を React.memo 化**

```typescript
// 例: TextBlockCard.tsx
const TextBlockCard = React.memo(function TextBlockCard({ block, ...props }: Props) {
  // ...
});
```

適用対象:
- `blocks/` 配下の全14コンポーネント
- `SidebarInspector` 内の BgProps, ChProps, TextProps 等
- `TransformSliders`, `SliderRow`

**効果**: 親の BlockList が再レンダーされても、props が変わっていないブロックカードは再レンダーをスキップ。

#### Phase 2: コールバックの安定化

**インライン関数 → useCallback 化**

優先度高（頻繁に呼ばれる）:
```typescript
// BlockList.tsx
const handleSelect = useCallback((blockId: string) => {
  onSelectBlock(blockId);
}, [onSelectBlock]);

const handleDelete = useCallback((blockId: string) => {
  removeBlock(blockId);
}, [removeBlock]);
```

優先度中（モーダル内）:
```typescript
// AssetSelectModal.tsx
const filteredAssets = useMemo(() => {
  return assets.filter(a => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (searchQuery && !a.name.includes(searchQuery)) return false;
    return true;
  });
}, [assets, categoryFilter, searchQuery]);
```

#### Phase 3: 算出値のキャッシュ

**buildSnapshotScript の結果キャッシュ**

```typescript
// ストアに追加
_snapshotCache: Map<string, { script: string; projectHash: number }>;

buildSnapshotScript: (blockId) => {
  const state = get();
  if (!state.project) return '';

  // プロジェクト変更のハッシュ（updatedAt で簡易判定）
  const hash = state.project.updatedAt;
  const cached = state._snapshotCache.get(blockId);
  if (cached && cached.projectHash === hash) return cached.script;

  const script = /* 既存ロジック */;
  state._snapshotCache.set(blockId, { script, projectHash: hash });
  return script;
},
```

**getAllVariables のメモ化**

```typescript
_variablesCache: { variables: string[]; hash: number } | null;

getAllVariables: () => {
  const state = get();
  if (!state.project) return [];

  const hash = state.project.updatedAt;
  if (state._variablesCache?.hash === hash) return state._variablesCache.variables;

  const variables = /* 既存ロジック */;
  set({ _variablesCache: { variables, hash } });
  return variables;
},
```

#### Phase 4: 仮想スクロール（500ブロック超対応）

500ブロックを超えるプロジェクトでは DOM ノード数がボトルネックになる。

```typescript
// BlockList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function BlockList({ blocks, ... }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: blocks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // ブロックカードの概算高さ
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <BlockCard key={blocks[item.index].id} block={blocks[item.index]} />
        ))}
      </div>
    </div>
  );
}
```

**注意**: @dnd-kit との組み合わせで仮想スクロール内ドラッグが複雑になる。Phase 4 は 500ブロック超の実プロジェクトが出てから着手する。

### 実装順序

| Phase | 対象 | 工数目安 | 効果 |
|-------|------|---------|------|
| 1 | React.memo 化（14ブロック + サブコンポーネント） | 小 | 高 |
| 2 | useCallback / useMemo 追加（20〜30箇所） | 小 | 中 |
| 3 | buildSnapshotScript / getAllVariables キャッシュ | 小 | 中 |
| 4 | 仮想スクロール（@tanstack/react-virtual） | 中 | 高（大規模時） |

### パフォーマンス計測

最適化の前後で計測する:

```typescript
// React DevTools Profiler で計測
// または手動計測:
console.time('render-blocklist');
// ... render
console.timeEnd('render-blocklist');
```

目標:
- 100ブロック: ブロック選択 < 16ms（60fps 維持）
- 500ブロック: ブロック選択 < 50ms
- スライダー操作: 連続ドラッグ中 < 16ms
