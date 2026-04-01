# TSX 構造・UI/UX 全体的改善計画書

**作成日**: 2026-02-26
**対象**: `apps/next` および `apps/editor` 全般の TSX/CSS 実装

## 1. アーキテクチャとコード品質

### 1.1 共通 UI パッケージへの移行 (The "shadcn" Pattern)
- **課題**: `apps/next` と `apps/editor` でボタン、モーダル、トースト等の基礎 UI パーツの実装が重複・散在している。
- **対策**: `packages/ui` を Radix UI 等の Headless ライブラリを用いた「共有 UI コンポーネントライブラリ」として再定義し、各アプリからはそれをインポートする形に統一する。これにより、デザイン変更を一箇所で全アプリに反映可能にする。

### 1.2 ロジックとビューの分離 (Custom Hooks)
- **課題**: `EditorPage.tsx` のように、UI 宣言の中にリサイズ計算、認証、データマージのロジックが混在し、テストが困難。
- **対策**: `useProjectLoader`, `useEditorLayout`, `useTimelineSync` などの用途別カスタム Hook へロジックを抽出し、コンポーネントは「データの表示」に専念させる。

## 2. UI/UX の一貫性

### 2.1 スタイリング規約の厳格化
- **課題**: `my-assets` ページに見られるようなインラインスタイルの使用。これはダークモードやテーマ変更の障壁となる。
- **対策**: インラインスタイルを禁止し、すべて TailwindCSS + `clsx` / `tailwind-merge` による条件付きクラス管理に移行する。

### 2.2 ローディング体験の向上 (Skeleton Screens)
- **課題**: データの読み込み中に「Loading...」のテキストが表示されるだけで、レイアウトシフト（ガタつき）が発生している。
- **対策**: すべての主要ページに `Skeleton` コンポーネントを導入し、データ取得前後でレイアウトが崩れないようにする。

## 3. パフォーマンス最適化

### 3.1 Next.js 15 の最適活用
- **課題**: クライアントサイドでのフェッチが多用されており、SEO や初期表示速度に改善の余地がある。
- **対策**: Next.js の `Server Components` と `Suspense` を活用し、初期データはサーバーで取得、インタラクティブな部分のみをクライアントコンポーネントとして切り出す。

### 3.2 アセットプレビューの遅延読み込み
- **課題**: `my-assets` や `AssetPanel` で大量の画像を一度にロードしようとしてネットワーク帯域を圧迫している。
- **対策**: `next/image` の活用、または `Intersection Observer` による遅延読み込み (Lazy Loading) を徹底する。

## 4. 具体的な実装優先順位 (Next Steps)

1.  **Phase 1**: `my-assets` の Tailwind 完全移行と `packages/ui` への共通パーツ抽出。
2.  **Phase 2**: `EditorPage.tsx` の巨大なロジックをカスタム Hook へリファクタリング。
3.  **Phase 3**: `apps/next` の主要ページを Server Components 対応させ、表示速度を高速化。

---
*Created by AI Agent based on exhaustive codebase review.*
