# apps/editor - エディタ SPA

## 概要

ビジュアルノベルのメインエディタ。React 19 + Vite 7 + Zustand 5 で構成される SPA。ブロックベースの GUI でページ・ブロック・キャラクター・アセットを管理し、KSC スクリプトを生成してプレビューエンジンに送る。

## ディレクトリ構成

```
apps/editor/
├── src/
│   ├── pages/              # 8 ページコンポーネント
│   ├── components/         # 59 コンポーネント
│   │   ├── blocks/         # 14 ブロックカード + CardShell
│   │   ├── panels/         # 設定・キャラクター・アセットパネル
│   │   ├── sidebar/        # アウトライン・インスペクタ・プレビュー
│   │   ├── timeline/       # タイムラインエディタ
│   │   ├── ui/             # UI プリミティブ（ドロワー、FAB、コンテキストメニュー等）
│   │   └── KSEditor/       # KS スクリプトエディタ
│   ├── store/              # Zustand ストア (useEditorStore.ts)
│   ├── hooks/              # カスタムフック (6 ファイル)
│   ├── config/             # API, blockTheme, frontend URLs
│   ├── utils/              # 変換, ハイライト, マイグレーション
│   ├── types/              # 型定義 (Block, EditorProject 等)
│   ├── index.css           # Tailwind グローバルスタイル
│   └── main.tsx            # エントリポイント
├── test/                   # Vitest ユニットテスト
├── vite.config.ts          # ポート 5176
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| `src/store/useEditorStore.ts` | ~1,500 | Zustand ストア。プロジェクト、ページ、ブロック、キャラクター、アセット、undo/redo、自動保存 |
| `src/pages/EditorPage.tsx` | ~800 | メインエディタページ。レイアウト、状態同期、自動保存(60秒)、beforeunload、ゲストモード |
| `src/components/BlockList.tsx` | ~400 | ブロック一覧。ドラッグ&ドロップ、コンテキストメニュー、FAB、警告表示 |
| `src/components/Header.tsx` | ~260 | ヘッダー。保存、プレビュー、undo/redo、設定、タイムライン切替 |
| `src/utils/ksConverter.ts` | ~400 | ブロック ↔ KSC AST 双方向変換 |
| `src/types/index.ts` | ~330 | 全 14 ブロック型定義、AssetRef、Character、Expression |
| `src/config/api.ts` | ~150 | API エンドポイント、authFetch、getAssetUrl |

## 依存関係

### 内部パッケージ
- `@kaedevn/core` (型参照のみ)

### 主要外部ライブラリ
- `react` 19 / `react-dom` / `react-router-dom` — UI フレームワーク
- `zustand` 5 — 状態管理
- `@dnd-kit/core` / `@dnd-kit/sortable` — ドラッグ&ドロップ
- `@monaco-editor/react` — コードエディタ
- `react-simple-code-editor` / `prismjs` — 軽量コードエディタ
- `react-hot-toast` — トースト通知
- `framer-motion` — アニメーション
- `tailwindcss` 3.4 — CSS

## ページ構成

| ページ | パス | 役割 |
|--------|------|------|
| EditorPage | `/projects/editor/:workId` | メインエディタ |
| EditorPage (guest) | `/projects/editor` | ゲストモード |
| UserProjectListPage | `/projects` | プロジェクト一覧 |
| LoginPage | `/login` | ログイン |
| UserSelectPage | `/user-select` | ユーザー選択 |
| UserSettingsPage | `/settings` | ユーザー設定 |
| WorksPage | `/works` | 作品一覧（準備中） |
| FavoritesPage | `/favorites` | お気に入り（準備中） |
| GuidePage | `/guide` | ガイド（準備中） |

## Zustand ストア (useEditorStore)

### State

```typescript
{
  project: EditorProject | null     // プロジェクトデータ
  currentPageIndex: number          // 現在のページ
  activeTab: 'editor' | 'character' | 'asset' | 'settings' | 'script'
  timelines: TimelineRoot[]         // タイムラインデータ
  _history: { past: [], future: [] } // undo/redo 履歴 (50エントリ上限)
  _lastSavedAt: number              // 自動保存用タイムスタンプ
  kscTestScript: string | null      // KSC テスト用スクリプト
  kscError: { message, line?, column? } | null
}
```

### 主要アクション

| カテゴリ | アクション |
|---------|----------|
| プロジェクト | setProject, updateProjectTitle |
| ページ | addPage, removePage, renamePage, setCurrentPage |
| ブロック | addBlock, updateBlock, moveBlock, removeBlock, duplicateBlock, setBlocks, reorderBlocks |
| アセット | addAsset, removeAsset, updateAssetSlug |
| キャラクター | setCharacters, addCharacter, updateCharacter, removeCharacter |
| 表情 | addExpression, updateExpression, removeExpression |
| プレビュー | buildPreviewScript, buildPageScript, buildSnapshotScript |
| 履歴 | undo, redo, canUndo, canRedo |
| 保存 | _markSaved, _isDirty |

## ブロック型一覧 (14 種)

| ブロック | ファイル | 役割 |
|---------|---------|------|
| start | StartBlockCard.tsx | ストーリー開始マーカー（編集不可） |
| bg | BgBlockCard.tsx | 背景アセット選択 + トランスフォーム |
| ch | ChBlockCard.tsx | キャラクター・表情・位置 |
| text | TextBlockCard.tsx | テキスト（話者名 + 本文） |
| overlay | OverlayBlockCard.tsx | オーバーレイ画像 |
| choice | ChoiceBlockCard.tsx | 選択肢（複数オプション + 条件） |
| if | IfBlockCard.tsx | 条件分岐（then/else ブロックリスト） |
| jump | JumpBlockCard.tsx | ページジャンプ |
| set_var | SetVarBlockCard.tsx | 変数設定 (=, +=, -=) |
| effect | EffectBlockCard.tsx | エフェクト（種類・強度・時間） |
| screen_filter | ScreenFilterBlockCard.tsx | スクリーンフィルター |
| timeline | TimelineBlockCard.tsx | タイムラインアニメーション |
| battle | BattleBlockCard.tsx | バトル（敵グループ・勝敗ジャンプ） |
| ksc | KscBlockCard.tsx | KSC スクリプト直接記述 |

## カスタムフック

| フック | 役割 |
|--------|------|
| useMediaQuery | CSS メディアクエリ監視 |
| useBreakpoint | 'mobile' / 'tablet' / 'desktop' 判定 |
| useKeyboardAdjust | モバイルキーボード高さ追従 |
| useLongPress | ロングプレス検出（コンテキストメニュー用） |
| useScrollDirection | スクロール方向検出（ヘッダー表示/非表示） |
| useReducedMotion | prefers-reduced-motion 検出 |

## 自動保存 / 離脱警告

- **自動保存**: 60秒間隔で `_isDirty()` をチェック → PUT API で保存 → `_markSaved()`
- **離脱警告**: `beforeunload` イベントで `_isDirty()` をチェック → 未保存時にブラウザ確認ダイアログ
- **手動保存**: ヘッダーの保存ボタン → 成功時に `_markSaved()`

## レスポンシブ対応

- **モバイル** (640px以下): ハンバーガーメニュー、タブナビゲーション、ボトムシート、FAB
- **タブレット**: 2カラムレイアウト
- **デスクトップ**: 3カラムレイアウト（サイドバー + メインエリア + インスペクタ）
- タッチターゲット最小 44px

## テスト

### ユニットテスト (Vitest)
- `test/store.test.ts` — ストア CRUD テスト (~80 テスト)
- `test/types.test.ts` — 型バリデーション (~30 テスト)
- `test/ksConverter.test.ts` — ブロック ↔ KSC 変換 (~50 テスト)
- `test/api-config.test.ts` — API エンドポイント検証

### E2E テスト (Playwright)
- `test-mobile-ui.spec.ts` — モバイル UI (640px)
- `test-mobile-ux-phase3.spec.ts` — モバイル 3 カラム
- `test-three-column.spec.ts` — デスクトップレイアウト

**合計: 189 ユニットテスト + 3 E2E テストファイル**
