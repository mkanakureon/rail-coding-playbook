---
title: "選択肢ブロックと IF 文ブロックをエディタに実装した"
emoji: "🔀"
type: "tech"
topics: ["claudecode", "typescript", "React", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のブロックカード形式エディタに、選択肢ブロック（ChoiceBlock）と IF 文ブロック（IfBlock）を実装した。どちらも「内部に子要素を持つ」複合ブロックで、モバイルでの編集体験にも配慮した設計になっている。

## 選択肢ブロック：ChoiceBlockCard

選択肢ブロックは「プレイヤーに提示する複数の選択肢と、各選択肢に対応するアクション」を編集するカードだ。

### データ構造

```typescript
// 選択肢ブロックの型
interface ChoiceBlock {
  id: string;
  type: 'choice';
  options: ChoiceOption[];
}

interface ChoiceOption {
  id: string;
  text: string;          // 選択肢のテキスト
  condition?: string;    // 表示条件（例: "affection >= 3"）
  actions: ChoiceAction[];
}

type ChoiceAction =
  | { type: 'set_var'; varName: string; operator: '=' | '+=' | '-='; value: string }
  | { type: 'text'; body: string; speaker?: string };
```

各選択肢は複数のアクションを持てる。アクションは「変数操作」か「セリフ表示」の 2 種類。

### モバイル UI：ボトムシート方式

モバイルでは選択肢ブロックの詳細編集にボトムシート（react-modal-sheet）を使う。

```tsx
// apps/editor/src/components/blocks/ChoiceBlockCard.tsx
if (isMobile) {
  return (
    <CardShell blockId={block.id} blockType="choice"
      onMove={onMove} onDelete={onDelete}
      canMoveUp={canMoveUp} canMoveDown={canMoveDown}
      after={
        <Sheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}
          snapPoints={[0.85]} initialSnap={0}>
          <Sheet.Container>
            <Sheet.Header />
            <Sheet.Content>
              <div className="p-4 overflow-y-auto"
                style={{ maxHeight: 'calc(85vh - 40px)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold dark:text-gray-100">
                    選択肢を編集
                  </h3>
                  <button onClick={() => setIsSheetOpen(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>
                {/* 選択肢の編集 UI */}
              </div>
            </Sheet.Content>
          </Sheet.Container>
          <Sheet.Backdrop onTap={() => setIsSheetOpen(false)} />
        </Sheet>
      }
    >
      <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
        {block.options.length} 個の選択肢
      </div>
      <button onClick={() => setIsSheetOpen(true)}
        className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
        編集
      </button>
    </CardShell>
  );
}
```

CardShell の `after` プロパティにボトムシートを配置する設計がポイント。カード本体はコンパクトに「3 個の選択肢」とだけ表示し、「編集」ボタンでボトムシートを開く。

### デスクトップ UI：インライン展開方式

デスクトップでは折りたたみ/展開の 2 状態を持つ。

```tsx
// デスクトップ・折りたたみ時
if (!isExpanded) {
  return (
    <CardShell blockId={block.id} blockType="choice"
      onClick={() => setIsExpanded(true)} ...>
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300
        truncate min-w-0">
        {block.options.length} 個の選択肢
        {block.options.length > 0 &&
          `: ${block.options.map(o => o.text || '(空)').join(', ')}`}
      </p>
    </CardShell>
  );
}
```

折りたたみ時は選択肢テキストをカンマ区切りで表示し、クリックで展開する。

### 選択肢内のアクション編集

各選択肢にはアクションを追加できる。

```tsx
<div className="flex gap-2">
  <button onClick={() => addAction(option.id, 'set_var')}
    className="px-3 py-1 text-sm bg-purple-100 text-purple-700
      rounded-lg hover:bg-purple-200
      dark:bg-purple-900/30 dark:text-purple-300">
    変数操作
  </button>
  <button onClick={() => addAction(option.id, 'text')}
    className="px-3 py-1 text-sm bg-blue-100 text-blue-700
      rounded-lg hover:bg-blue-200
      dark:bg-blue-900/30 dark:text-blue-300">
    セリフ
  </button>
</div>
```

変数操作アクションでは「変数名」「演算子（=, +=, -=）」「値」の 3 つのフィールドを横並びで編集する。

```tsx
{action.type === 'set_var' ? (
  <>
    <input type="text" value={action.varName}
      onChange={(e) => updateAction(option.id, actIndex,
        { varName: e.target.value })}
      placeholder="変数名" className="w-32 px-2 py-1 ..." />
    <select value={action.operator}
      onChange={(e) => updateAction(option.id, actIndex,
        { operator: e.target.value })}>
      <option value="=">=</option>
      <option value="+=">+=</option>
      <option value="-=">-=</option>
    </select>
    <input type="text" value={action.value}
      onChange={(e) => updateAction(option.id, actIndex,
        { value: e.target.value })}
      placeholder="値" className="w-24 px-2 py-1 ..." />
  </>
) : (
  <>
    <input type="text" value={action.body}
      onChange={(e) => updateAction(option.id, actIndex,
        { body: e.target.value })}
      placeholder="セリフ" className="flex-1 px-2 py-1 ..." />
  </>
)}
```

### 状態更新のヘルパー関数

選択肢ブロックはネストが深いため、更新用のヘルパー関数を用意した。

```typescript
const updateOption = (optionId: string, updates: Partial<ChoiceOption>) => {
  const newOptions = block.options.map((opt) =>
    opt.id === optionId ? { ...opt, ...updates } : opt
  );
  updateBlock(block.id, { options: newOptions });
};

const addAction = (optionId: string, actionType: 'set_var' | 'text') => {
  const option = block.options.find((opt) => opt.id === optionId);
  if (!option) return;

  const newAction: ChoiceAction =
    actionType === 'set_var'
      ? { type: 'set_var', varName: '', operator: '+=', value: '1' }
      : { type: 'text', body: '' };

  updateOption(optionId, {
    actions: [...option.actions, newAction],
  });
};

const removeAction = (optionId: string, actionIndex: number) => {
  const option = block.options.find((opt) => opt.id === optionId);
  if (!option) return;
  const newActions = option.actions.filter((_, idx) => idx !== actionIndex);
  updateOption(optionId, { actions: newActions });
};
```

## IF 文ブロック：IfBlockCard

IF 文ブロックは「条件式」「TRUE の場合のブロック」「FALSE の場合のブロック」の 3 セクションを持つ複合ブロック。

### データ構造

```typescript
interface IfBlock {
  id: string;
  type: 'if';
  conditions: IfCondition[];
  thenBlocks: Block[];
  elseBlocks?: Block[];
}

interface IfCondition {
  id: string;
  varName: string;
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
  value: string;
  logicalOp?: '&&' | '||';  // 次の条件との論理演算子
}
```

複数の条件を AND/OR で結合できる設計。

### モバイル UI：タブ + スワイプ切り替え

IF 文ブロックはモバイルでの編集が最も難しい要素だ。3 つのセクション（条件 / TRUE / FALSE）をタブとスワイプで切り替える設計にした。

```tsx
// IfBlockCard.tsx
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => {
    const idx = TABS.indexOf(activeTab);
    if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1]);
  },
  onSwipedRight: () => {
    const idx = TABS.indexOf(activeTab);
    if (idx > 0) setActiveTab(TABS[idx - 1]);
  },
  trackMouse: false,
  preventScrollOnSwipe: true,
});
```

タブバーは 3 つのボタンで構成され、各タブにバッジで要素数を表示する。

```tsx
<div className="flex gap-1 border-b border-gray-200 dark:border-gray-700
  pb-2 mb-3">
  <button onClick={() => setActiveTab('conditions')}
    className={`flex-1 py-2 text-xs rounded-lg font-medium ${
      activeTab === 'conditions'
        ? 'bg-cyan-600 text-white'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }`}>
    条件
    {condCount > 0 && (
      <span className="inline-flex items-center justify-center
        w-5 h-5 rounded-full text-[10px] font-bold">
        {condCount}
      </span>
    )}
  </button>
  <button onClick={() => setActiveTab('then')}
    className={`... ${activeTab === 'then'
      ? 'bg-green-600 text-white' : '...'}`}>
    TRUE
  </button>
  <button onClick={() => setActiveTab('else')}
    className={`... ${activeTab === 'else'
      ? 'bg-red-600 text-white' : '...'}`}>
    FALSE
  </button>
</div>
```

色分けは直感的。条件 = シアン、TRUE = 緑、FALSE = 赤。

### 条件式エディタ

条件式は GUI で組み立てる。変数名はプロジェクト内の既存変数からドロップダウンで選択できる。

```tsx
const availableVariables = getAllVariables();

{block.conditions.map((cond, idx) => (
  <div key={cond.id} className="space-y-2 p-3 bg-gray-50 rounded-lg
    dark:bg-gray-800">
    <select value={cond.varName}
      onChange={(e) => updateCondition(cond.id,
        { varName: e.target.value })}>
      <option value="">変数を選択</option>
      {availableVariables.map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
    <div className="flex gap-2">
      <select value={cond.operator}
        onChange={(e) => updateCondition(cond.id,
          { operator: e.target.value })}>
        <option value=">=">以上</option>
        <option value="<=">以下</option>
        <option value="==">等しい</option>
        <option value="!=">等しくない</option>
        <option value=">">より大きい</option>
        <option value="<">より小さい</option>
      </select>
      <input type="text" value={cond.value}
        onChange={(e) => updateCondition(cond.id,
          { value: e.target.value })}
        placeholder="値" />
    </div>
    {idx < block.conditions.length - 1 && (
      <select value={cond.logicalOp || '&&'}
        onChange={(e) => updateCondition(cond.id,
          { logicalOp: e.target.value })}>
        <option value="&&">かつ (AND)</option>
        <option value="||">または (OR)</option>
      </select>
    )}
  </div>
))}

<button onClick={addCondition}
  disabled={availableVariables.length === 0}>
  {availableVariables.length === 0
    ? '変数が定義されていません'
    : '+ 条件を追加'}
</button>
```

変数が 1 つも定義されていない場合は「変数が定義されていません」と表示し、ボタンを無効化する。

### then/else ブロックの編集

TRUE/FALSE の各セクションにはブロックを追加できる。追加可能なブロックタイプは「背景」「テキスト」「ジャンプ」の 3 種類。

```tsx
const addBlockToSection = (
  section: 'then' | 'else',
  blockType: 'bg' | 'text' | 'jump'
) => {
  const id = `${blockType}-${Date.now()}`;
  let newBlock: Block;

  switch (blockType) {
    case 'bg':
      newBlock = { id, type: 'bg', assetId: '' };
      break;
    case 'text':
      newBlock = { id, type: 'text', body: '' };
      break;
    case 'jump':
      newBlock = { id, type: 'jump', toPageId: '' };
      break;
  }

  if (section === 'then') {
    updateBlock(block.id, {
      thenBlocks: [...block.thenBlocks, newBlock],
    });
  } else {
    updateBlock(block.id, {
      elseBlocks: [...(block.elseBlocks || []), newBlock],
    });
  }
};
```

### デスクトップ UI：セクション展開方式

デスクトップでは 3 セクションを縦に並べ、各セクションの「編集」ボタンで展開/折りたたみを切り替える。

```tsx
{/* TRUE 時のブロック */}
<div className="p-3 bg-green-50 rounded-lg border border-green-200
  dark:bg-green-900/20 dark:border-green-700">
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
      TRUE の場合
    </h4>
    <button onClick={() => setExpandedSection(
      expandedSection === 'then' ? null : 'then'
    )}>
      {expandedSection === 'then' ? '閉じる' : '編集'}
    </button>
  </div>
  {expandedSection === 'then' ? (
    <div className="space-y-2">
      {/* ブロックの編集 UI */}
    </div>
  ) : (
    <p className="text-xs text-gray-600 dark:text-gray-400">
      {block.thenBlocks.length} 個のブロック
    </p>
  )}
</div>
```

TRUE セクションは緑系、FALSE セクションは赤系の背景色で視覚的に区別している。

### 折りたたみ時の表示

デスクトップ・折りたたみ時には条件式のサマリーと TRUE/FALSE のブロック数を表示する。

```tsx
const conditionsToString = (conditions: IfCondition[]): string => {
  if (conditions.length === 0) return '条件未設定';
  return conditions
    .map((cond, idx) => {
      const base = `${cond.varName || '変数'} ${cond.operator || '>='} ${cond.value || '値'}`;
      if (idx < conditions.length - 1 && cond.logicalOp) {
        return `${base} ${cond.logicalOp}`;
      }
      return base;
    })
    .join(' ');
};

// 表示例: if (affection >= 5 && flag_seen_prologue == true) → T:2 / F:1
<p className="font-mono">
  if ({conditionsToString(block.conditions)})
  → T:{block.thenBlocks.length} / F:{(block.elseBlocks || []).length}
</p>
```

## SetVarBlock との連携

変数ブロック（SetVarBlockCard）は IF 文の条件で参照する変数を定義するために使う。

```tsx
// apps/editor/src/components/blocks/SetVarBlockCard.tsx
export default function SetVarBlockCard({ block, ... }: Props) {
  return (
    <CardShell blockId={block.id} blockType="set_var" ...>
      <div className="flex-1 flex items-center gap-1 text-sm font-mono">
        <input type="text" value={block.varName}
          onChange={(e) => updateBlock(block.id,
            { varName: e.target.value })}
          placeholder="変数名" className="w-24 ..." />
        <select value={block.operator}
          onChange={(e) => updateBlock(block.id,
            { operator: e.target.value })}>
          <option value="=">=</option>
          <option value="+=">+=</option>
          <option value="-=">-=</option>
        </select>
        <input type="text" value={block.value}
          onChange={(e) => updateBlock(block.id,
            { value: e.target.value })}
          placeholder="値" className="w-20 ..." />
      </div>
    </CardShell>
  );
}
```

`getAllVariables()` はエディタストア内のすべての SetVarBlock と ChoiceBlock のアクションから変数名を収集し、IF 文ブロックの条件エディタに候補として提供する。

## まとめ

| ブロック | モバイル UI | デスクトップ UI | 子要素 |
|---------|-----------|---------------|--------|
| ChoiceBlock | ボトムシート | 折りたたみ/展開 | 選択肢 + アクション |
| IfBlock | タブ + スワイプ | セクション展開 | 条件 + then/else ブロック |
| SetVarBlock | インライン | インライン | なし |

選択肢ブロックと IF 文ブロックは、単純なテキストブロックとは異なり「ブロックの中にブロックがある」入れ子構造を持つ。この入れ子構造をモバイルの狭い画面で編集可能にするため、ChoiceBlock はボトムシート、IfBlock はタブ+スワイプという異なるアプローチを採用した。

---

選択肢ブロックと IF 文ブロックは、ノベルゲームエディタの核心部分だ。「プログラミング不要で分岐ロジックを組める」という目標に対して、GUI の条件式エディタとドロップダウンによる変数選択が解答になった。モバイルでの編集体験は特に難しく、IfBlock のタブ+スワイプ切り替えは試行錯誤の末にたどり着いた形だ。条件セクション・TRUE セクション・FALSE セクションを色分けしたことで、狭い画面でも現在位置を見失わずに編集できるようになった。

　　　　　　　　　　Claude Opus 4.6
