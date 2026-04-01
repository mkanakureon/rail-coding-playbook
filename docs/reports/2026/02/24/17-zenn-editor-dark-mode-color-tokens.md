---
title: "エディタのダークモード完全対応 — 全コンポーネントの色トークン統一"
emoji: "🌙"
type: "tech"
topics: ["claudecode", "React", "CSS", "デザインシステム"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のエディタにダークモードを完全対応させた。Tailwind CSS の `dark:` プレフィックスを全コンポーネントに適用し、色トークンを `index.css` の `@layer components` に一元化した。さらに CardShell を共通シェルとして全ブロックカードの外観を統一し、モバイル/タブレット/デスクトップの 3 段階レスポンシブにも対応した。

## 課題：散在するカラー定義

ダークモード対応前の状態では以下の問題があった。

1. 各コンポーネントに個別のカラークラスが直書きされていた
2. ダークモード用のクラスが一部のコンポーネントにしかなかった
3. ブロックカードの背景・ボーダー・テキスト色に統一感がなかった

## 設計方針：@layer components による一元管理

Tailwind CSS の `@layer components` ディレクティブを使い、全ブロック共通のスタイルを `index.css` に集約した。

```css
/* apps/editor/src/index.css */
@layer base {
  body {
    @apply m-0 p-0 font-sans bg-white text-gray-900;
    @apply dark:bg-gray-900 dark:text-gray-100;
  }
}

@layer components {
  .editor-header {
    @apply h-14 px-4 flex items-center justify-between
           border-b border-gray-300 bg-white
           fixed top-0 left-0 right-0 z-10;
    @apply dark:bg-gray-800 dark:border-gray-700;
  }

  .editor-main {
    @apply flex-1 overflow-y-auto bg-gray-50;
    @apply dark:bg-gray-900;
    margin-top: 56px;
    margin-bottom: 56px;
  }

  .editor-footer {
    @apply h-14 border-t border-gray-300 flex items-center
           justify-center bg-white fixed bottom-0 left-0 right-0 z-10;
    @apply dark:bg-gray-800 dark:border-gray-700;
  }
}
```

ポイントは `@apply dark:...` を同じルール内に書くことで、ライトモードとダークモードのペアが常に隣接すること。これによりメンテナンス時に片方だけ変更してしまう事故を防げる。

## ブロックカードのダークモード対応

`.block-card` は全ブロック共通のカードスタイルだ。

```css
.block-card {
  @apply bg-white rounded-xl shadow-sm border border-gray-200;
  @apply dark:bg-gray-800 dark:border-gray-700;
  padding: 16px;
  margin: 0 12px;
}
```

ライトモードでは白背景に薄いグレーのボーダー、ダークモードでは `gray-800` 背景に `gray-700` ボーダー。全ブロックがこのクラスを使うため、色の統一が自動的に保証される。

## コントロールボタンのスタイル

上下移動ボタンや削除ボタンもダークモード対応した。

```css
.control-btn {
  @apply flex items-center justify-center rounded-lg
         bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold;
  @apply dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300;
  min-width: 44px;
  min-height: 44px;
  transition: transform 0.1s, background-color 0.2s;
}

.control-btn:active {
  transform: scale(0.95);
}
```

`min-width: 44px` と `min-height: 44px` はモバイルのタッチターゲットサイズの最低要件。タップフィードバックとして `scale(0.95)` のアニメーションも入れている。

## タブナビゲーション

エディタのタブ（ブロック編集 / キャラクター / 設定 / アセット）もダークモード対応。

```css
.tab-navigation {
  @apply flex gap-1 px-3 py-2 bg-white border-b border-gray-300;
  @apply dark:bg-gray-800 dark:border-gray-700;
}

.tab-button:not(.active) {
  @apply text-gray-600 hover:bg-gray-100;
  @apply dark:text-gray-400 dark:hover:bg-gray-700;
}

.tab-button.active {
  @apply bg-blue-600 text-white;
  @apply dark:bg-blue-500;
}
```

アクティブタブはダークモードでも青系を維持しつつ、やや明るい `blue-500` に変更。非アクティブタブはホバー時の背景色をダーク用に切り替えている。

## ブロックテーマ：blockTheme.ts

各ブロックタイプのバッジカラーは `blockTheme.ts` で一元管理している。

```typescript
// apps/editor/src/config/blockTheme.ts
export const BLOCK_THEME: Record<BlockType, BlockThemeEntry> = {
  start:    { badgeColor: 'bg-gray-600',    label: 'START',    icon: '▶' },
  bg:       { badgeColor: 'bg-green-600',   label: '背景',     icon: '🖼️' },
  ch:       { badgeColor: 'bg-blue-600',    label: 'キャラ',   icon: '👤' },
  text:     { badgeColor: 'bg-purple-600',  label: 'テキスト', icon: '💬' },
  set_var:  { badgeColor: 'bg-indigo-600',  label: '変数',     icon: '📊' },
  choice:   { badgeColor: 'bg-yellow-600',  label: '選択肢',   icon: '🔀' },
  if:       { badgeColor: 'bg-cyan-600',    label: 'IF文',     icon: '❓' },
  // ...
};
```

バッジカラーは `-600` を統一的に使い、ダークモードでも十分なコントラストが出るようにした。Tailwind の `bg-*-600` は白テキストとの組み合わせで WCAG AA 基準を満たす。

## 各コンポーネントでの dark: 適用パターン

具体的に、各コンポーネントでどのようにダークモードを適用しているか見ていく。

### テキストブロック

```tsx
// TextBlockCard.tsx
<textarea
  className="w-full px-3 py-2 border border-gray-300 rounded-lg
    resize-y min-h-[80px]
    dark:bg-gray-700 dark:border-gray-600
    dark:text-gray-200 dark:placeholder-gray-400"
  placeholder="テキストを入力…"
/>
```

入力フィールドは `dark:bg-gray-700`、ボーダーは `dark:border-gray-600`、テキストは `dark:text-gray-200`、プレースホルダーは `dark:placeholder-gray-400` と階層的に明度を変えている。

### 選択肢ブロック

```tsx
// ChoiceBlockCard.tsx
<div className="p-3 bg-gray-50 rounded-lg border border-gray-200
  dark:bg-gray-700 dark:border-gray-600">
  <span className="text-xs font-medium text-gray-500
    dark:text-gray-400">選択肢 1</span>
</div>
```

選択肢の各オプションはカード内カードの構造。ライト時は `bg-gray-50`、ダーク時は `bg-gray-700` で区別する。

### IF 文ブロック

IF 文ブロックは条件 / TRUE / FALSE の 3 セクションを持ち、それぞれ色を変えている。

```tsx
// IfBlockCard.tsx（条件セクション）
<div className="p-3 bg-gray-50 rounded-lg border border-gray-200
  dark:bg-gray-800 dark:border-gray-700">

{/* TRUE セクション */}
<div className="p-3 bg-green-50 rounded-lg border border-green-200
  dark:bg-green-900/20 dark:border-green-700">

{/* FALSE セクション */}
<div className="p-3 bg-red-50 rounded-lg border border-red-200
  dark:bg-red-900/20 dark:border-red-700">
```

ダークモードでは `green-900/20` や `red-900/20` のように色の透明度を利用し、暗い背景の上でもセクションの区別が視認できるようにしている。

## ボトムシートとオーバーレイ

ブロック追加のボトムシートもダークモード対応済み。

```css
.bottom-sheet-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 z-50
         flex items-end justify-center;
  @apply dark:bg-opacity-70;
}

.bottom-sheet {
  @apply w-full bg-white rounded-t-3xl p-6 animate-slide-up;
  @apply dark:bg-gray-800 dark:text-gray-100;
}
```

ダークモードではオーバーレイの透明度を `50%` から `70%` に上げ、背景がより暗くなるようにしている。

## 3 段階レスポンシブ

エディタは 3 カラムレイアウト対応で、画面幅に応じて以下のように変化する。

| 画面幅 | レイアウト | 対応 |
|--------|-----------|------|
| ~640px | 1 カラム（モバイル） | FAB + ボトムシート |
| 641px~1024px | 1 カラム（タブレット） | インライン追加ボタン |
| 1025px~ | 3 カラム（デスクトップ） | 左右サイドバー付き |

3 カラム時の CSS Grid 設定。

```css
.editor-layout {
  display: grid;
  grid-template-columns: auto 4px 1fr 4px auto;
  height: calc(100vh - 56px - 56px);
  margin-top: 56px;
  margin-bottom: 56px;
}

.editor-sidebar {
  @apply overflow-hidden bg-white;
  @apply dark:bg-gray-800;
}

.resize-handle {
  width: 4px;
  cursor: col-resize;
  @apply bg-gray-200 hover:bg-blue-400 transition-colors;
  @apply dark:bg-gray-700 dark:hover:bg-blue-500;
}
```

サイドバーの幅はリサイズハンドルでドラッグ変更可能。ダークモードではリサイズハンドルも `gray-700` 背景にして目立たなくしている。

## リップルエフェクトのダークモード対応

ボタンのリップルエフェクトもダークモードで色を変えている。

```css
.btn-ripple::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
}

@media (prefers-color-scheme: dark) {
  .btn-ripple::after {
    background: rgba(255, 255, 255, 0.2);
  }
}
```

ダークモードではリップルの白を `0.5` から `0.2` に落とし、控えめな印象にしている。

## アクセシビリティ：reduced-motion 対応

ダークモードとは直接関係しないが、同じタイミングでモーション削減にも対応した。

```css
@media (prefers-reduced-motion: reduce) {
  .animate-slide-in,
  .animate-slide-up {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .tab-button,
  .control-btn,
  .delete-btn {
    transition: none;
  }
}
```

`prefers-reduced-motion: reduce` が設定されている場合、すべてのアニメーションとトランジションを無効化する。

## まとめ

ダークモード対応で実施した内容を振り返る。

| 項目 | 対応 |
|------|------|
| body 背景 | `dark:bg-gray-900` |
| カード背景 | `dark:bg-gray-800` |
| 入力フィールド | `dark:bg-gray-700` |
| ネストカード | `dark:bg-gray-700` or `dark:*-900/20` |
| テキスト | `dark:text-gray-100~400` |
| ボーダー | `dark:border-gray-600~700` |
| バッジカラー | `-600` で統一（ダーク/ライト共通） |
| オーバーレイ | `dark:bg-opacity-70` |

明度の階層構造を「900（body） > 800（カード） > 700（入力）」と整理したことで、各コンポーネントが自然に浮き出す。色トークンを `index.css` の `@layer components` に集約したことで、新しいコンポーネントを追加する際も既存のクラスを使うだけでダークモード対応が完了する。

---

ダークモード対応は「全コンポーネントに dark: を書く」だけの単純作業に見えるが、実際には明度の階層設計が重要だった。body > カード > 入力フィールドの 3 段階の明度差を意識することで、ダークモードでも視覚的な奥行きが保たれる。CardShell での共通化と blockTheme.ts でのカラートークン一元管理が、13 種類のブロックすべてに一貫したダークモード体験を提供する基盤になった。

　　　　　　　　　　Claude Opus 4.6
