# 実装計画: Undo/Redo、ブロック複製、メモ化

**日付**: 2026-03-06
**設計書**: `04-undo-redo-duplicate-memoize-spec.md`

## 実装順序

Phase 1〜3 を順番に実装。各 Phase 完了後にテスト通過を確認。

---

## Phase 1: Undo / Redo

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/editor/src/store/useEditorStore.ts` | `_history`, `undo`, `redo`, `_pushHistory` 追加。既存アクションに `_pushHistory()` 呼び出し挿入 |
| `apps/editor/src/pages/EditorPage.tsx` | `Ctrl+Z` / `Ctrl+Shift+Z` キーバインド追加 |
| `apps/editor/src/components/Header.tsx` | Undo/Redo ボタン追加 |
| `apps/editor/test/store.test.ts` | Undo/Redo テスト 7件追加 |

### 手順

1. ストアに `HistoryEntry`, `HistoryState` 型定義
2. `takeSnapshot()` / `_pushHistory()` ヘルパー実装
3. `undo()` / `redo()` アクション実装
4. 既存アクション（addBlock, removeBlock, updateBlock, moveBlock, reorderBlocks, addPage, removePage, setBlocks）に `_pushHistory()` 挿入
5. `updateBlock` にデバウンス（500ms）適用
6. EditorPage にキーバインド追加
7. Header に Undo/Redo ボタン追加
8. テスト作成・実行

---

## Phase 2: ブロック複製

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/editor/src/store/useEditorStore.ts` | `duplicateBlock` アクション追加、`deepCloneBlock` ヘルパー |
| `apps/editor/src/components/BlockList.tsx` | 複製ボタン追加（各ブロックカード） |
| `apps/editor/src/pages/EditorPage.tsx` | `Ctrl+D` キーバインド追加 |
| `apps/editor/test/store.test.ts` | ブロック複製テスト 5件追加 |

### 手順

1. `deepCloneBlock()` ヘルパー実装（ネスト対応）
2. `duplicateBlock` アクション実装（_pushHistory → clone → splice）
3. BlockList に複製ボタン UI 追加
4. EditorPage に `Ctrl+D` 追加
5. テスト作成・実行

---

## Phase 3: メモ化（Phase 1-2）

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/editor/src/components/blocks/*.tsx` | 全14ブロックカードを `React.memo` 化 |
| `apps/editor/src/components/sidebar/SidebarInspector.tsx` | TransformSliders, SliderRow を `React.memo` 化 |
| `apps/editor/src/components/BlockList.tsx` | コールバックを `useCallback` 化 |
| `apps/editor/src/store/useEditorStore.ts` | buildSnapshotScript / getAllVariables にキャッシュ追加 |

### 手順

1. 14ブロックカードに `React.memo` 適用
2. TransformSliders, SliderRow に `React.memo` 適用
3. BlockList のコールバックを `useCallback` 化
4. buildSnapshotScript に updatedAt ベースキャッシュ追加
5. getAllVariables にキャッシュ追加
6. 既存テスト全通過を確認

---

## 完了基準

- 全既存テスト（177件）通過
- 新規テスト（12件）通過
- `npm run typecheck` 通過
