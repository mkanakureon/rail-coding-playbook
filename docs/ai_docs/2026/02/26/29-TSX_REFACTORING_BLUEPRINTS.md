# TSX リファクタリング：具体的実装案 (Implementation Blueprints)

**作成日**: 2026-02-26
**対象**: `apps/next`, `apps/editor` の主要コンポーネントの構造改革

## 1. 【EditorPage】巨大なロジックの分離 (Hook 化)

`apps/editor/src/pages/EditorPage.tsx` の肥大化を解消するためのカスタム Hook 構成案です。

### 1.1 `useEditorLayout.ts` (新規作成)
- **機能**: サイドバー（左・右）のリサイズ、タイムラインパネルの上下リサイズ、マウスイベントの購読。
- **目的**: 複雑な `onMouseMove` や `isDragging` のステートを UI 宣言から分離する。

### 1.2 `useProjectLoader.ts` (新規作成)
- **機能**: `workId` に基づくプロジェクト取得、アセット Slug のマージロジック、エラーハンドリング。
- **目的**: コンポーネントのマウント時に行われる複雑な「データ準備プロセス」をカプセル化する。

## 2. 【MyPage】Next.js 15 Server Components への移行

クライアントサイドでのフェッチを減らし、初期表示速度を向上させます。

### 2.1 `app/(private)/mypage/page.tsx` (リファクタリング)
- **変更前**: `'use client'` による `useEffect` フェッチ。
- **変更後**: サーバーサイドでのデータ取得 + `Suspense` によるローディング管理。
```tsx
// イメージ
export default async function MyPage() {
  const user = await getCurrentUserServer(); // Server-side fetch
  const projectsData = await getProjectsServer();

  return (
    <div className="container">
      <Banner user={user} />
      <Suspense fallback={<StatsSkeleton />}>
        <FloatingStats stats={await getStatsServer()} />
      </Suspense>
      <ProjectList initialProjects={projectsData.projects} />
    </div>
  );
}
```

## 3. 【MyAssets】TailwindCSS 完全準拠とコンポーネント化

`apps/next/app/(private)/my-assets/page.tsx` のスパゲッティコードを整理します。

- **インラインスタイルの全廃**: すべて `className` 形式に置換。
- **パーツの分離**:
    - `AssetFilterSidebar.tsx`: 種別・カテゴリのフィルター。
    - `AssetGrid.tsx`: アセットカードのグリッド表示。
    - `AssetUploadZone.tsx`: ドラッグ＆ドロップ対応のアップロード領域。

## 4. 【packages/ui】共通テーマエンジンの構築

- **`tailwind.config.js` の共有**: `packages/ui` 内にマスター設定を置き、各アプリがそれを継承する。
- **セマンティックカラー**: `primary`, `secondary`, `accent`, `canvas` といったエイリアスを定義し、色指定を抽象化する。

---
*Created by AI Agent to provide actionable refactoring paths.*
