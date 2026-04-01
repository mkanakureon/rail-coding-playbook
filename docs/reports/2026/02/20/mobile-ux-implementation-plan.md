# エディタ モバイルUX改善 — 実装計画書

**作成日:** 2026-02-20
**参照:** `docs/09_reports/2026/02/20/mobile-ux-improvement.md`（仕様書）

---

## Phase 1: バグ修正・基盤整備（4タスク）

即効性が高く、既存機能の信頼性を向上させる修正。他 Phase の前提となる共通基盤。

---

### Task 1-1: `window.confirm()` → `DeleteConfirmSheet` 統一

**目的:** 全削除操作の UX をモバイルフレンドリーなボトムシートに統一

**リファレンス実装:** `ChBlockCard.tsx` が唯一 `DeleteConfirmSheet` を使用済み。このパターンを全ファイルに展開する。

**`DeleteConfirmSheet` の API:**
```typescript
// Props
isOpen: boolean
onClose: () => void
onConfirm: () => void
title?: string        // デフォルト: 'ブロックを削除'
message?: string      // デフォルト: 'このブロックを削除してもよろしいですか？'
blockType?: string    // '{blockType}ブロック' のサブタイトル表示
```

**変更対象と作業内容:**

#### 1. `BgBlockCard.tsx`（168行）
- 現状: `BlockMenu onDelete={onDelete}`（直接削除、確認なし）
- 変更:
  - `useState` で `showDeleteConfirm` 追加
  - `BlockMenu` の `onDelete` → `() => setShowDeleteConfirm(true)`
  - デスクトップの削除ボタン（L152）も同様に変更
  - `<DeleteConfirmSheet>` をコンポーネント末尾に追加
  - `blockType="背景"`

#### 2. `ChoiceBlockCard.tsx`（401行）
- 現状: `BlockMenu onDelete={onDelete}`（L96-102）、デスクトップ削除ボタン（L393-397）
- 変更: BgBlockCard と同パターン、`blockType="選択肢"`
- 注: 個別選択肢・アクションの削除（`removeOption`, `removeAction`）は軽量操作のため確認不要

#### 3. `IfBlockCard.tsx`（679行）
- 現状: `BlockMenu onDelete={onDelete}`（L136-142）、デスクトップ削除ボタン（L672-674）
- 変更: 同パターン、`blockType="条件分岐"`

#### 4. `JumpBlockCard.tsx`（82行）
- 現状: `BlockMenu onDelete={onDelete}`（L37-43）、デスクトップ削除ボタン（L77）
- 変更: 同パターン、`blockType="ジャンプ"`

#### 5. `SetVarBlockCard.tsx`（176行）
- 現状: `BlockMenu onDelete={onDelete}`（L63-69）、デスクトップ削除ボタン（L169-171）
- 変更: 同パターン、`blockType="変数設定"`

#### 6. `CharacterPanel.tsx`（131行）
- 現状: `window.confirm()` + `alert()`（L47-65）
- 変更:
  - `showDeleteConfirm` + `deleteTarget`（削除対象キャラ）の state 追加
  - `handleDeleteCharacter` を2段階に分割:
    - `requestDelete(character)` → state セット
    - `confirmDelete()` → API 呼び出し + `removeCharacter`
  - `<DeleteConfirmSheet title="キャラクターを削除" message="削除すると、このキャラクターを使用しているブロックも影響を受けます。">` 追加
  - `alert()` → `showToast.error()` に置換（toast が既存なら使用）

#### 7. `PageMenu.tsx`（136行）
- 現状: インライン `confirm()`（L43-48）
- 変更:
  - `showDeleteConfirm` state 追加
  - `<DeleteConfirmSheet title="ページを削除" message="このページを削除してもよろしいですか？">` 追加
  - ポップオーバーメニューの「ページ削除」 → `setShowDeleteConfirm(true)`

#### 8. `PageListModal.tsx`（161行）
- 現状: `confirm()`（L44-52）
- 変更:
  - `showDeleteConfirm` + `deleteTargetIndex` state 追加
  - `<DeleteConfirmSheet title="ページを削除">` 追加

**テスト方法:**
- 各ブロックの削除ボタン押下 → ボトムシート表示 → キャンセルで戻る → 確認で削除実行
- スワイプダウンでシート閉じるか確認
- デスクトップでも同様に動作するか確認

---

### Task 1-2: BlockMenu / PageMenu のタッチイベント対応

**目的:** タッチデバイスでメニュー外タップ時に確実にメニューが閉じるようにする

**変更対象:**

#### 1. `BlockMenu.tsx`（107行）— L23-34
```typescript
// 現状（L26）
document.addEventListener('mousedown', handleClickOutside);
// 追加
document.addEventListener('touchstart', handleClickOutside, { passive: true });

// クリーンアップ（L31-32）にも追加
document.removeEventListener('touchstart', handleClickOutside);
```

#### 2. `PageMenu.tsx`（136行）— L12-23
- 同じパターンで `touchstart` リスナーを追加

**テスト方法:**
- モバイル実機で BlockMenu を開き、メニュー外をタップして閉じるか確認
- デスクトップでの動作に変化がないか確認

---

### Task 1-3: iOS Safari ファイルアップロード修正

**目的:** iOS Safari でファイル選択ダイアログが確実に開くようにする

**変更対象:**

#### `AssetSelectModal.tsx`（434行）— L157-196 `handleUploadInModal`

現状:
```typescript
const input = document.createElement('input');
input.type = 'file';
input.accept = 'image/*';
input.click(); // iOS Safari で失敗する場合あり
```

改善:
```typescript
// コンポーネントのトップレベルに ref を追加
const fileInputRef = useRef<HTMLInputElement>(null);

// JSX に hidden input を追加
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  className="hidden"
  onChange={handleFileChange}
/>

// アップロードボタンの onClick
const handleUploadClick = () => {
  fileInputRef.current?.click();  // ユーザージェスチャーコンテキスト内
};
```

**同様の修正が必要な箇所の確認:**
- `CharacterEditModal.tsx` の `handleFileUpload`（L465-471）— 表情静止画アップロード
- `CharacterEditModal.tsx` の `handleFrameSetUpload`（L480-486）— ZIPアップロード
- 同じ `createElement('input')` パターンを使用している場合は同様に修正

**テスト方法:**
- iOS Safari 実機で「アップロード」ボタンタップ → ファイル選択ダイアログが開くか
- Android Chrome でも正常動作するか
- デスクトップでの動作に変化がないか

---

### Task 1-4: スクロール検出の修正

**目的:** `StickyHeader` の hideOnScroll が正しく動作するようにする

**変更対象:**

#### `useScrollDirection.ts`（81行）

現状（L17, 36, 57-60）:
```typescript
const scrollY = window.scrollY;
window.addEventListener('scroll', onScroll);
```

改善: `editor-main` 要素のスクロールイベントを監視するように変更
```typescript
// scrollContainerId を引数で受け取るか、
// デフォルトで 'editor-main' を使用する
function useScrollDirection(containerId?: string) {
  useEffect(() => {
    const container = containerId
      ? document.getElementById(containerId)
      : window;
    const getScrollY = () =>
      containerId
        ? (document.getElementById(containerId)?.scrollTop ?? 0)
        : window.scrollY;
    // ...
    container?.addEventListener('scroll', onScroll, { passive: true });
    return () => container?.removeEventListener('scroll', onScroll);
  }, [containerId]);
}
```

**テスト方法:**
- モバイルでブロックリストをスクロール → ヘッダーが隠れるか確認
- 上スクロールでヘッダーが再表示されるか確認

---

## Phase 2: 主要UX改善（4タスク）

ユーザー操作の体験を大きく向上させる機能改善。

---

### Task 2-1: ChBlockCard ビジュアルキャラクターピッカー

**目的:** テキストのみの `<select>` をアバター付きビジュアルピッカーに置換

**変更対象:** `ChBlockCard.tsx`（295行）

**モバイル版（≤640px）の変更:**

1. **コンパクト表示の強化（既存のまま）:**
   - 現状: `[キャラ] 主人公 (hero)` テキスト
   - キャラのデフォルト表情サムネイル（32×42px）を左端に追加

2. **展開時のキャラクター選択UI:**
   - ネイティブ `<select>`（L150-163）を削除
   - 代わりに横スクロールのアバターリストを表示
   - 各アバター: 60×80px、キャラ名下部テキスト、選択中は青枠 + ✓

3. **展開時の表情選択UI:**
   - ネイティブ `<select>`（L179-193）を削除
   - 横スクロールのサムネイルリスト（表情4個以下）or 4列グリッド（5個以上）
   - 各セル: 56×74px、表情名下部テキスト、選択中は青枠 + ✓

**新規コンポーネント（`ChBlockCard.tsx` 内部に定義、切り出しはしない）:**

```typescript
// キャラクター横スクロールリスト（モバイル専用）
const CharacterScrollList = ({ characters, selectedId, onSelect }) => (
  <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
    {characters.map(ch => (
      <button key={ch.id} onClick={() => onSelect(ch.id)}
        className={`flex-shrink-0 snap-start w-[60px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
        <img src={getDefaultExpressionUrl(ch)} className="w-[60px] h-[80px] object-cover rounded" />
        <span className="text-xs truncate block mt-1">{ch.name}</span>
        {selected && <span className="text-blue-500 text-xs">✓</span>}
      </button>
    ))}
  </div>
);

// 表情グリッド/スクロールリスト（モバイル専用）
const ExpressionPicker = ({ expressions, selectedId, onSelect }) => {
  const useGrid = expressions.length >= 5;
  return (
    <div className={useGrid ? 'grid grid-cols-4 gap-2' : 'flex gap-3 overflow-x-auto pb-2'}>
      {expressions.map(expr => (
        <button key={expr.id} onClick={() => onSelect(expr.id)}
          className={`${useGrid ? '' : 'flex-shrink-0'} w-[56px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <img src={expr.imageUrl} className="w-[56px] h-[74px] object-cover rounded" />
          <span className="text-xs truncate block mt-1">{expr.name}</span>
        </button>
      ))}
    </div>
  );
};
```

**デスクトップ版（＞640px）:**
- 現状のネイティブ `<select>` を維持（デスクトップでは十分使いやすい）
- 変更なし

**データ取得:**
- `useEditorStore` の `characters` 配列から取得（既存ロジック）
- 各キャラの表情画像URL は `character.expressions[].imageUrl` から取得

**テスト方法:**
- モバイルでキャラブロックをタップ展開 → アバター一覧が表示されるか
- キャラタップ → 表情一覧に切り替わるか
- 表情タップ → 選択が反映されるか
- キャラが0人のとき、「キャラタブでキャラクターを追加してください」表示

---

### Task 2-2: AssetSelectModal カテゴリチップ化

**目的:** ドロップダウンを横スクロールチップに変更して一覧性を向上

**変更対象:** `AssetSelectModal.tsx`（434行）— L271-285

**変更内容:**

現状: ネイティブ `<select>` ドロップダウン
```html
<select value={officialCategory} onChange={...}>
  <option value="">すべて</option>
  <option value="basic">基本</option>
  ...
</select>
```

改善: 横スクロールチップ（モバイル/デスクトップ共通）
```html
<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x scrollbar-hide">
  {CATEGORIES.map(cat => (
    <button key={cat.key}
      className={`flex-shrink-0 snap-start px-3 py-1.5 rounded-full text-sm whitespace-nowrap
        ${active ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
      onClick={() => setOfficialCategory(cat.key)}>
      {cat.label}
    </button>
  ))}
</div>
```

**CSS追加（`index.css`）:**
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

**テスト方法:**
- 公式アセットタブでチップが横スクロールで表示されるか
- チップタップでフィルタが切り替わるか
- 選択中チップがハイライトされるか

---

### Task 2-3: ChoiceBlock 全画面シート化（モバイル）

**目的:** モバイルでの選択肢編集をフル幅で操作しやすくする

**変更対象:** `ChoiceBlockCard.tsx`（401行）

**変更方針:**
- モバイル（≤640px）で「編集」タップ時 → `react-modal-sheet` のボトムシート（`snapPoints={[window.innerHeight * 0.85, 0]}`）を開く
- デスクトップではインライン展開を維持（変更なし）

**ボトムシートの内容:**

```typescript
<Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}
  snapPoints={[window.innerHeight * 0.85, 0]} initialSnap={0}>
  <Sheet.Container>
    <Sheet.Header />
    <Sheet.Content>
      <div className="p-4">
        <h3 className="text-lg font-bold mb-4">選択肢を編集</h3>

        {options.map((option, index) => (
          <div key={option.id} className="mb-6 pb-4 border-b border-gray-200">
            <label className="text-sm text-gray-500">選択肢 {index + 1}</label>
            <input value={option.text} onChange={...}
              className="w-full px-3 py-2 border rounded mt-1" />
            <label className="text-sm text-gray-500 mt-2 block">ジャンプ先</label>
            <select className="w-full px-3 py-2 border rounded mt-1">...</select>

            {/* アクション（変数操作）— フル幅で表示 */}
            {option.actions?.map((action, actIndex) => (
              <div className="mt-2 flex gap-2">
                <input placeholder="変数名" className="flex-1 ..." />  {/* w-16 → flex-1 */}
                <select className="w-20 ...">...</select>
                <input placeholder="値" className="flex-1 ..." />      {/* w-12 → flex-1 */}
              </div>
            ))}
          </div>
        ))}

        <button onClick={addOption} className="w-full ...">＋ 選択肢を追加</button>
      </div>
    </Sheet.Content>
  </Sheet.Container>
  <Sheet.Backdrop onTap={() => setIsSheetOpen(false)} />
</Sheet>
```

**ポイント:**
- `w-16` → `flex-1`、`w-12` → `flex-1` で入力幅をフル活用
- シート内はスクロール可能（選択肢が多い場合）
- シートの閉じ方: ✕ボタン、バックドロップタップ、スワイプダウン

**テスト方法:**
- モバイルで選択肢ブロックの「編集」タップ → シート表示
- 各入力フィールドがフル幅で表示されるか
- 選択肢追加・削除が動作するか
- スワイプダウンでシートが閉じるか

---

### Task 2-4: ContextMenu + useLongPress の接続

**目的:** ブロック長押しで移動・複製・削除メニューを表示

**変更対象:**

#### 1. `BlockList.tsx` — ブロックカードのラッパー

各ブロックカードのラッパー `<div>` に `useLongPress` を適用:

```typescript
const blockLongPress = useLongPress({
  onLongPress: () => {
    hapticFeedback('medium');
    setContextMenuState({ isOpen: true, blockIndex: index });
  },
  onClick: undefined,  // タップは各カードの内部ハンドラに委譲
});
```

#### 2. ContextMenu のメニュー項目

```typescript
const contextMenuItems: MenuItem[] = [
  { label: '上に移動', icon: '⬆', onClick: () => moveBlock(index, 'up'),
    disabled: index === 0 },
  { label: '下に移動', icon: '⬇', onClick: () => moveBlock(index, 'down'),
    disabled: index === blocks.length - 1 },
  { label: '複製', icon: '📋', onClick: () => duplicateBlock(index) },
  { label: '削除', icon: '🗑', onClick: () => requestDeleteBlock(index),
    variant: 'danger' },
];
```

#### 3. `useEditorStore` への追加

`duplicateBlock` アクションが未実装の場合:
```typescript
duplicateBlock: (pageIndex, blockIndex) => {
  const block = pages[pageIndex].blocks[blockIndex];
  const newBlock = { ...structuredClone(block), id: generateId() };
  // blockIndex + 1 に挿入
}
```

**注意:**
- `StartBlock` には長押しメニューを適用しない（削除・移動不可）
- 長押し中の視覚フィードバック: `scale(0.97)` + `opacity(0.9)` の CSS transition
- 通常のタップ（展開/折りたたみ）との干渉防止は `useLongPress` の `isLongPressRef` で制御済み

**テスト方法:**
- ブロックを長押し → コンテキストメニュー表示
- 「上に移動」「下に移動」が動作するか
- 先頭ブロックで「上に移動」が disabled か
- 「削除」→ DeleteConfirmSheet 表示（Task 1-1 と連携）
- 通常のタップで展開/折りたたみが妨害されないか

---

## Phase 3: 発展的改善（4タスク）

中〜高コストだが、エディタの完成度を引き上げる改善。

---

### Task 3-1: ページ一覧リッチ化

**目的:** ページ一覧にサムネイル・ページ名編集を追加

**変更対象:**

#### 1. `types/index.ts` — `EditorPage` 型にページ名を追加

```typescript
interface EditorPage {
  // 既存フィールド...
  name?: string;  // ユーザー定義のページ名
}
```

#### 2. `PageListModal.tsx`（161行）

- `getPageLabel` の修正: `(startBlock as any).label` → `page.name || \`ページ ${index + 1}\``
- サムネイル表示: ページ内の最初の BgBlock の `assetId` からURL取得
- ページ名のインライン編集: タップで `<input>` に切替、blur で保存

```
各行のレイアウト:
┌──────┬─────────────────────────────────┐
│ 60×34│ ページ名（タップで編集）         │
│ BG   │ 5ブロック              ● 現在   │
└──────┴─────────────────────────────────┘
```

#### 3. `useEditorStore` — `renamePage` アクション追加

```typescript
renamePage: (pageIndex: number, name: string) => set(state => {
  state.project.pages[pageIndex].name = name;
})
```

**テスト方法:**
- ページ一覧モーダルにサムネイルが表示されるか
- 背景がないページではプレースホルダー（グレー）表示
- ページ名をタップ → 編集 → blur で保存

---

### Task 3-2: CharacterEditModal モバイル最適化

**目的:** 表情差分の管理をモバイルで操作しやすくする

**変更対象:** `CharacterEditModal.tsx`（583行）

**変更内容:**

1. **表情カード化（モバイル、L402-503）:**
   - 現状: slug入力 + name入力 + 4つのボタンが横並び
   - 改善: 左にプレビュー（80×106px）、右に名前、下にアクションボタン

2. **アクションボタンの集約（モバイル）:**
   - 現状: 「静止画アップロード」「既存から選択」「ZIP(アニメ)」「削除」の4ボタン
   - 改善: 「画像変更」1ボタン → タップでアクションシート（ボトムシート）
     - 静止画をアップロード
     - 既存アセットから選択
     - ZIP（アニメ）をアップロード
   - 「削除」は別の赤いアイコンボタン（右上 or 右下）

3. **表情削除の確認（L182-185）:**
   - `alert()` → `DeleteConfirmSheet` に置換

**テスト方法:**
- モバイルでキャラクター編集モーダルが全画面表示されるか
- 表情カードのレイアウトが崩れないか
- 「画像変更」→ アクションシート → 各操作が動作するか

---

### Task 3-3: IfBlock スワイプタブ化

**目的:** 条件式/TRUE/FALSE セクションの切替をスワイプ対応タブに変更

**変更対象:** `IfBlockCard.tsx`（679行）

**変更内容:**

1. **タブUI（モバイル + デスクトップ共通）:**
   ```
   [条件式]  [TRUE (3)]  [FALSE (1)]
   ─────────────────────────────────
   ```
   - 各セクションのブロック数をバッジ表示
   - アクティブタブに下線インジケータ

2. **スワイプ切替（モバイルのみ）:**
   - `react-swipeable` を使用（既に `package.json` に含まれている）
   - `expandedSection` を `'conditions'` → `'then'` → `'else'` の順にスワイプで遷移

3. **セクション内容の表示:**
   - 条件式: 既存のフォーム（変更なし）
   - TRUE/FALSE: ブロックリスト + 追加ボタン（既存のまま）

**テスト方法:**
- タブタップで各セクションに切り替わるか
- スワイプで左右に遷移するか
- バッジ数が正しいか（ブロック追加/削除で更新されるか）

---

### Task 3-4: ブロック並び替え（dnd-kit）

**目的:** ブロックのドラッグ&ドロップ並び替えを実装

**新規依存パッケージ:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**変更対象:**

#### 1. `BlockList.tsx` — DnD コンテナ

```typescript
import { DndContext, closestCenter, TouchSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// タッチセンサー: 250ms 長押しで起動（通常タップと区別）
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
);
```

#### 2. 各ブロックカード — `useSortable` フック

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: block.id,
});
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : 1,
};
```

#### 3. `useEditorStore` — `reorderBlocks` アクション

```typescript
reorderBlocks: (pageIndex: number, oldIndex: number, newIndex: number) => set(state => {
  const blocks = state.project.pages[pageIndex].blocks;
  const [moved] = blocks.splice(oldIndex, 1);
  blocks.splice(newIndex, 0, moved);
})
```

#### 4. 並び替えモードのUI

- ContextMenu（Task 2-4）に「並び替え」項目を追加
- または FABMenu に「並び替え」ボタンを追加
- 並び替えモード中: 各カードにドラッグハンドル（≡）表示、カードはコンパクト表示に統一
- 「完了」ボタンでモード終了

**制約:**
- `StartBlock`（index 0）は移動不可 — `sortable` の `disabled` で制御
- 並び替えモード中はブロックのタップ展開を無効化

**テスト方法:**
- 並び替えモード起動 → ドラッグハンドルが表示されるか
- ブロックをドラッグして順序変更できるか
- StartBlock が移動不可か
- 並び替え結果がストアに反映されるか
- 完了ボタンで通常モードに戻るか

---

## 実装順序と依存関係

```
Phase 1（基盤）
├── Task 1-1: DeleteConfirmSheet 統一  ←── 他タスクの前提
├── Task 1-2: タッチイベント追加       ←── 独立
├── Task 1-3: ファイルアップロード修正  ←── 独立
└── Task 1-4: スクロール検出修正       ←── 独立

Phase 2（主要UX）
├── Task 2-1: ビジュアルピッカー       ←── 独立
├── Task 2-2: カテゴリチップ           ←── 独立
├── Task 2-3: ChoiceBlock シート       ←── 独立
└── Task 2-4: ContextMenu 接続        ←── Task 1-1 に依存（削除確認）

Phase 3（発展）
├── Task 3-1: ページ一覧リッチ化       ←── 独立
├── Task 3-2: CharacterEditModal 最適化 ←── Task 1-1 に依存
├── Task 3-3: IfBlock スワイプタブ     ←── 独立
└── Task 3-4: ブロック並び替え         ←── Task 2-4 に依存（ContextMenu）
```

**Phase 1 内は全て並列実施可能。**
**Phase 2 は Task 1-1 完了後に開始（Task 2-4 が依存）。Task 2-1〜2-3 は並列可。**
**Phase 3 は Phase 2 完了後に開始。Task 3-1, 3-3 は並列可。**

---

## 各 Phase 完了時の確認事項

### Phase 1 完了チェック
- [ ] 全ブロックの削除操作でボトムシートが表示される
- [ ] `window.confirm()` / `alert()` がエディタ内に残っていない
- [ ] モバイルでメニュー外タップが効く
- [ ] iOS Safari でファイルアップロードが動作する
- [ ] スクロールでヘッダーが隠れる

### Phase 2 完了チェック
- [ ] キャラブロックで画像付きピッカーが表示される
- [ ] 公式アセットのカテゴリがチップ表示
- [ ] 選択肢編集がシートで開く（モバイル）
- [ ] ブロック長押しでコンテキストメニューが開く

### Phase 3 完了チェック
- [ ] ページ一覧にサムネイルとページ名が表示される
- [ ] キャラ編集モーダルがモバイルで使いやすい
- [ ] IfBlock のセクションがスワイプで切替可能
- [ ] ブロックのドラッグ並び替えが動作する
