---
title: "実践ログ — エディタ モバイル UX を Phase 1→3 で改善"
emoji: "📱"
type: "idea"
topics: ["claudecode", "React", "モバイル", "UX"]
published: false
---

## はじめに

ビジュアルノベルエディタ「kaedevn」は、ブラウザ上でノベルゲームのシナリオを編集できるツールです。当初はデスクトップ（1024px 以上）を前提に設計していましたが、「移動中にスマホでちょっとセリフを直したい」というニーズに応えるため、モバイル UX を 3 つの Phase に分けて段階的に改善しました。

この記事では、Claude Code と協働しながら React + Tailwind CSS ベースのエディタにモバイル対応を組み込んでいった過程を、実際のコードとともに記録します。

## Phase 1: レスポンシブ分岐の土台を作る

### useMediaQuery フック

まず最初に作ったのは、画面幅を検知するカスタムフックです。

```typescript
// apps/editor/src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}
```

SSR 対応のため初期値は `window` の存在チェック付き。`addEventListener('change', ...)` で画面回転にもリアルタイムで追従します。

### 3 段階のブレークポイント

EditorPage では 3 つのブレークポイントを使い分けています。

```typescript
// apps/editor/src/pages/EditorPage.tsx
const isMobile = useMediaQuery('(max-width: 640px)');
const isWideScreen = useMediaQuery('(min-width: 1024px)');
```

| ブレークポイント | 値 | レイアウト |
|---|---|---|
| モバイル | `max-width: 640px` | タブ切替 + スワイプ |
| タブレット | 641px - 1023px | タブ切替（スワイプなし） |
| ワイドスクリーン | `min-width: 1024px` | 3 カラムレイアウト |

ワイドスクリーンでは左サイドバー（アウトライン）・中央（エディタ）・右サイドバー（インスペクタ）の 3 カラム。モバイルではタブ切替で 1 画面に 1 パネルだけ表示する構造です。

```typescript
if (isWideScreen) {
  return (
    <div className="editor-container">
      {/* 3カラムレイアウト: Outline | Editor | Inspector */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${leftWidth}px 4px 1fr`,
        flex: 1,
        minHeight: 0,
      }}>
        <SidebarOutline />
        <div className="resize-handle" />
        <BlockList />
      </div>
    </div>
  );
}

// モバイル・タブレット
return (
  <div className="editor-container">
    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    {renderContent()}
    <PageNavigator />
  </div>
);
```

## Phase 2: タッチ最適化

### スワイプによるページ遷移

モバイルでは左右スワイプでページを切り替えられるようにしました。`react-swipeable` を使用しています。

```typescript
import { useSwipeable } from 'react-swipeable';

// EditorPage 内
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

// JSX でスワイプハンドラを適用
<div id="editor-main" className="editor-main" {...(isMobile ? swipeHandlers : {})}>
```

ポイントは `trackMouse: false` です。デスクトップではマウスドラッグがテキスト選択に使われるため、タッチデバイスのみスワイプを有効にしています。

### ヘッダーの自動隠蔽

モバイルではスクロールダウン時にヘッダーを自動的に隠す `StickyHeader` コンポーネントを使っています。

```typescript
<StickyHeader hideOnScroll={isMobile}>
  <Header userId={userId ?? undefined} workId={workId} onShowToast={addToast} />
</StickyHeader>
```

デスクトップでは常に表示 (`hideOnScroll={false}`)、モバイルでは下スクロールで隠れ、上スクロールで再表示。限られた画面領域を最大限活かす工夫です。

### ボタンのタッチターゲット最適化

ヘッダーのボタンは、モバイルとデスクトップでサイズを変えています。

```typescript
// Header.tsx
<button
  className={`bg-green-600 text-white rounded-lg ... ${
    isMobile
      ? 'w-10 h-10 flex items-center justify-center'  // 40x40px タッチターゲット
      : 'px-3 py-2 text-sm'                            // テキスト付きボタン
  }`}
>
  {isSaving ? (
    <span className="text-lg">⏳</span>
  ) : (
    <>
      <span className="text-lg">💾</span>
      <span className="hidden sm:inline ml-1">保存</span>
    </>
  )}
</button>
```

Apple のヒューマンインターフェースガイドラインでは 44x44pt が推奨値ですが、40x40px でも実用上問題ないサイズです。テキストラベルは `hidden sm:inline` でモバイルでは非表示にし、アイコンだけで操作できるようにしています。

### PageNavigator のモバイル対応

モバイルではフッターの PageNavigator を非表示にし、代わりに TabNavigation 内の PageMenu で操作します。

```typescript
// PageNavigator.tsx
export default function PageNavigator() {
  const isMobile = useMediaQuery('(max-width: 640px)');
  if (!project || isMobile) return null;  // モバイル時は非表示
  // ...
}
```

## Phase 3: iOS Safari 対応とキーボード制御

### キーボード高さ検知

iOS Safari でソフトウェアキーボードが表示されると、ビューポートが圧縮されます。この問題に対応するため、`useKeyboardHeight` フックを作りました。

```typescript
// apps/editor/src/hooks/useKeyboardAdjust.ts
export function useKeyboardHeight() {
  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${keyboardHeight}px`
      );
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize();
      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      };
    }
  }, []);
}
```

`window.visualViewport` API は iOS Safari 13 以降で使えます。キーボードの高さを CSS 変数 `--keyboard-height` に設定することで、CSS 側でパディングやマージンを調整できます。

### 入力欄の自動スクロール

テキスト入力時に入力欄がキーボードに隠れないよう、フォーカス時に自動スクロールする `useKeyboardAdjust` フックも用意しています。

```typescript
export function useKeyboardAdjust(isActive: boolean) {
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !elementRef.current) return;
    const element = elementRef.current;

    const handleFocus = () => {
      setTimeout(() => {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);  // キーボードアニメーション完了を待つ
    };

    element.addEventListener('focus', handleFocus);
    return () => element.removeEventListener('focus', handleFocus);
  }, [isActive]);

  return elementRef;
}
```

`setTimeout(300)` はキーボードのスライドアニメーション（約 250ms）の完了を待つためのものです。アニメーション中に `scrollIntoView` を呼ぶと、最終位置がずれてしまいます。

### HamburgerMenu

モバイルではヘッダーにプロジェクト名やページ情報を全て表示するスペースがないため、`HamburgerMenu` コンポーネントに集約しました。

```typescript
// Header.tsx 内
{isMobile ? (
  <HamburgerMenu projectName={project?.title || 'Editor'} />
) : (
  <>
    <h1 className="text-lg sm:text-xl font-bold truncate">
      {project?.title || 'Editor'}
    </h1>
    <span className="text-sm text-gray-500">
      ページ {currentPageIndex + 1} / {project?.pages.length || 0}
    </span>
  </>
)}
```

## 全体のレイアウト構造

最終的なレスポンシブ設計を図にまとめます。

```
[ワイドスクリーン (1024px+)]
┌──────────────────────────────────────┐
│  StickyHeader (常時表示)              │
├─────────┬──────────────┬─────────────┤
│ Outline │  BlockList   │  Inspector  │
│ (左)    │  (中央)       │  (右)       │
│ resize  │              │  resize     │
├─────────┴──────────────┴─────────────┤
│  TimelinePanel (任意)                 │
├──────────────────────────────────────┤
│  PageNavigator                       │
└──────────────────────────────────────┘

[モバイル (640px以下)]
┌──────────────────────┐
│  StickyHeader (隠蔽)  │
├──────────────────────┤
│  TabNavigation       │
│  [Editor|Character|  │
│   Asset|Settings]    │
├──────────────────────┤
│  (選択タブの内容)     │
│                      │
│  ← スワイプでページ→  │
│                      │
└──────────────────────┘
```

## 学んだこと

### 1. 「モバイル対応」は一括でやらない

Phase 1 でレスポンシブ分岐の土台を作り、Phase 2 でタッチ操作、Phase 3 で iOS 固有の問題に対応、と段階的に進めました。一括でやろうとすると、問題の切り分けが難しくなります。

### 2. CSS 変数によるキーボード高さの伝達

`--keyboard-height` を CSS 変数にすることで、JavaScript と CSS の間でキーボード状態を共有できます。`calc(100vh - var(--keyboard-height))` のように使えば、レイアウト崩れを防げます。

### 3. `visualViewport` API の活用

`window.innerHeight` はキーボード表示時に変わらない（iOS Safari の仕様）ため、`window.visualViewport.height` を使う必要があります。対応ブラウザは十分広い（Safari 13+, Chrome 61+）ので、安心して使えます。

### 4. スワイプとテキスト選択の共存

`react-swipeable` の `trackMouse: false` でデスクトップのマウス操作を除外することで、テキスト選択との干渉を回避しました。

## まとめ

モバイル UX の改善は「大きな機能追加」ではなく、「小さな配慮の積み重ね」でした。useMediaQuery でレイアウトを切り替え、useKeyboardHeight でキーボードに対応し、useSwipeable でページ遷移を快適にする。1 つ 1 つは単純なフックですが、組み合わさることで「スマホでも使えるエディタ」が実現しました。

Claude Code との協働では、「Phase 1: レスポンシブ」「Phase 2: タッチ」「Phase 3: キーボード」と段階を区切って指示することで、一貫性のある実装が進みました。AIと協働するときも、人間と同じく「いま何をやるか」の範囲を絞ることが品質につながると感じています。

---

モバイル UX の改善は、画面幅の分岐ロジックから iOS Safari のキーボード制御まで、予想以上に細かい対応の連続でした。しかし、React のカスタムフックで抽象化すれば、各コンポーネントは「モバイルかどうか」を意識するだけで済みます。結果として、コードの見通しを保ちながらモバイル対応を完遂できた点に手応えを感じています。

　　　　　　　　　　Claude Opus 4.6
