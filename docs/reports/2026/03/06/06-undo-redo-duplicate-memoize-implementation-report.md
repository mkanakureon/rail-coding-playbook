# 実装報告書: Undo/Redo, ブロック複製, メモ化

**日付**: 2026-03-06
**設計書**: `04-undo-redo-duplicate-memoize-spec.md`
**計画書**: `05-undo-redo-duplicate-memoize-plan.md`

## 変更概要

| 指標 | 値 |
|------|-----|
| 変更ファイル数 | 21 |
| 追加行数 | +694 |
| 削除行数 | -92 |
| 新規テスト | 12 件 (Undo/Redo 7 + ブロック複製 5) |
| 全テスト結果 | 158 pass / 0 fail |
| typecheck | 全パッケージ通過 |

---

## Phase 1: Undo / Redo

### 仕組み

Zustand ストアに `_history: { past: HistoryEntry[], future: HistoryEntry[] }` を追加。各変更アクション実行前にスナップショットを past スタックに push し、undo 時に復元する。

- **スナップショット対象**: `pages` 配列 + `currentPageIndex`（JSON deep copy）
- **最大履歴数**: 50 エントリ
- **デバウンス**: `updateBlock`（スライダー/テキスト入力）は 500ms デバウンスで履歴を記録
- **履歴リセット**: `setProject` 呼び出し時に past/future を空にリセット

### 履歴記録を追加したアクション (8個)

| アクション | 履歴タイプ |
|-----------|-----------|
| `addBlock` | 即時 |
| `setBlocks` | 即時 |
| `updateBlock` | デバウンス (500ms) |
| `moveBlock` | 即時 |
| `reorderBlocks` | 即時 |
| `removeBlock` | 即時 |
| `addPage` | 即時 |
| `removePage` | 即時 |

### UI

| 操作 | デスクトップ | モバイル |
|------|------------|---------|
| Undo | `Ctrl+Z` / `Cmd+Z` | ヘッダー ↩ ボタン |
| Redo | `Ctrl+Shift+Z` / `Ctrl+Y` | ヘッダー ↪ ボタン |

ボタンは `canUndo()` / `canRedo()` で disabled 制御。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `store/useEditorStore.ts` | `HistoryEntry` 型, `takeSnapshot()`, `_pushHistory()`, `_pushHistoryDebounced()`, `undo()`, `redo()`, `canUndo()`, `canRedo()` 追加。8 アクションに履歴記録挿入 |
| `pages/EditorPage.tsx` | `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` キーバインド追加 (useEffect) |
| `components/Header.tsx` | ↩ / ↪ ボタン追加 (disabled 制御付き) |

### テスト (7件)

1. `canUndo / canRedo は初期状態で false`
2. `addBlock 後に undo で元に戻る`
3. `undo → redo で再度やり直し`
4. `removeBlock の undo で復元`
5. `moveBlock の undo で位置が戻る`
6. `新しいアクション実行で redo 履歴がクリアされる`
7. `setProject で履歴がリセットされる`

---

## Phase 2: ブロック複製

### 仕組み

`deepCloneBlock()` ヘルパーで JSON deep copy + 新規 ID 生成。`if` ブロックの `thenBlocks` / `elseBlocks`、`choice` ブロックの `options` も再帰的に新 ID を振り直す。

- **ID 形式**: `{type}-{Date.now()}-{random4chars}`
- **挿入位置**: 元ブロックの直後
- **start ブロック**: 複製不可（早期 return）
- **履歴**: 複製前に `_pushHistory()` → undo 可能

### UI

| 操作 | デスクトップ | モバイル |
|------|------------|---------|
| 複製 | カード上の ⧉ ボタン / `Ctrl+D` | (非表示 — BlockMenu 経由で今後追加可能) |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `store/useEditorStore.ts` | `deepCloneBlock()` ヘルパー, `duplicateBlock` アクション追加 |
| `components/blocks/CardShell.tsx` | `onDuplicate?: () => void` prop 追加, デスクトップ表示で ⧉ ボタン |
| `components/BlockList.tsx` | `duplicateBlock` を store から取得, `renderBlock` 内で `onDuplicate` を全13カードに渡す |
| `pages/EditorPage.tsx` | `Ctrl+D` キーバインド追加 |
| 全13ブロックカード | `onDuplicate` prop 受け取り → CardShell に転送 |

### テスト (5件)

1. `ブロックを複製して直後に挿入`
2. `複製されたブロックは新しい ID を持つ`
3. `if ブロックの複製でネストされたブロックも新しい ID を持つ`
4. `start ブロックは複製できない`
5. `duplicateBlock の undo で複製が取り消される`

---

## Phase 3: メモ化

### React.memo 適用 (14コンポーネント)

全ブロックカードコンポーネントを `React.memo` でラップ。props が変わらない限り再レンダリングをスキップする。

| コンポーネント | ファイル |
|--------------|---------|
| StartBlockCard | `blocks/StartBlockCard.tsx` |
| BgBlockCard | `blocks/BgBlockCard.tsx` |
| ChBlockCard | `blocks/ChBlockCard.tsx` |
| TextBlockCard | `blocks/TextBlockCard.tsx` |
| SetVarBlockCard | `blocks/SetVarBlockCard.tsx` |
| ChoiceBlockCard | `blocks/ChoiceBlockCard.tsx` |
| IfBlockCard | `blocks/IfBlockCard.tsx` |
| EffectBlockCard | `blocks/EffectBlockCard.tsx` |
| ScreenFilterBlockCard | `blocks/ScreenFilterBlockCard.tsx` |
| TimelineBlockCard | `blocks/TimelineBlockCard.tsx` |
| BattleBlockCard | `blocks/BattleBlockCard.tsx` |
| OverlayBlockCard | `blocks/OverlayBlockCard.tsx` |
| JumpBlockCard | `blocks/JumpBlockCard.tsx` |
| KscBlockCard | `blocks/KscBlockCard.tsx` |

### 変更パターン

```tsx
// Before
export default function XxxBlockCard(props: Props) { ... }

// After
import { memo } from 'react';
function XxxBlockCard(props: Props) { ... }
export default memo(XxxBlockCard);
```

### 見送り事項

- **BlockList の useCallback 化**: `renderBlock` 内のコールバック (`onMove`, `onDelete`, `onDuplicate`) は `block.id` に依存するためブロックごとに異なる。useCallback で安定化するには BlockList の構造を大幅に変更する必要があり、費用対効果が低いため見送り
- **buildSnapshotScript / getAllVariables キャッシュ**: 現状パフォーマンス問題が報告されておらず、過剰最適化のため見送り

---

## 全変更ファイル一覧

| # | ファイル | Phase | 変更概要 |
|---|---------|-------|---------|
| 1 | `store/useEditorStore.ts` | 1,2 | 履歴管理 + ブロック複製 (+238行) |
| 2 | `pages/EditorPage.tsx` | 1,2 | Ctrl+Z/Shift+Z/Y/D キーバインド |
| 3 | `components/Header.tsx` | 1 | Undo/Redo ボタン |
| 4 | `components/blocks/CardShell.tsx` | 2 | onDuplicate prop + ⧉ ボタン |
| 5 | `components/BlockList.tsx` | 2 | duplicateBlock 連携 |
| 6 | `blocks/StartBlockCard.tsx` | 3 | memo |
| 7 | `blocks/BgBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 8 | `blocks/ChBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 9 | `blocks/TextBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 10 | `blocks/SetVarBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 11 | `blocks/ChoiceBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 12 | `blocks/IfBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 13 | `blocks/EffectBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 14 | `blocks/ScreenFilterBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 15 | `blocks/TimelineBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 16 | `blocks/BattleBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 17 | `blocks/OverlayBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 18 | `blocks/JumpBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 19 | `blocks/KscBlockCard.tsx` | 2,3 | onDuplicate + memo |
| 20 | `test/store.test.ts` | 1,2 | テスト 12件追加 |

### 同セッションの関連修正 (本実装の前提)

| ファイル | 変更内容 |
|---------|---------|
| `store/useEditorStore.ts` | `buildSnapshotScript` に x/y/s 反映 |
| `sidebar/SidebarInspector.tsx` | TransformSliders にブロック種別ごとのスライダー範囲 |
| `apps/hono/src/routes/preview.ts` | サーバーサイド KSC 生成に x/y/s 反映 |
| `apps/hono/src/middleware/error.ts` | HTTPException 正常返却修正 |
