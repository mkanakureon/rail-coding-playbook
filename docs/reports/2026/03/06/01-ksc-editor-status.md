# KSC Editor 現状レポート (2026-03-06)

## 概要

KSC（KaedeScript Classic）専用のコードエディタ。TypeScript 風スクリプト言語でビジュアルノベル演出をプログラミングする。KS エディタ（ブロック編集）とは完全に独立したアプリケーション。

- **Phase 1 MVP 完了** — コード編集 + プレビュー
- **実装規模**: src 1,226 行、E2E テスト 21 本
- **ポート**: 5177（Vite dev server）
- **URL**: `http://localhost:5177/projects/ksc-editor/:workId`

---

## ファイル構成

```
apps/ksc-editor/src/
├── main.tsx                          (10行) エントリーポイント
├── App.tsx                           (14行) React Router 定義
├── types/index.ts                    (47行) KscFile, AssetRef, ProjectData 型
├── config/
│   ├── api.ts                        (43行) API エンドポイント・認証ヘルパー
│   └── frontend.ts                   (6行)  プレビュー URL 設定
├── store/
│   └── useKscEditorStore.ts          (214行) Zustand ストア
├── pages/
│   └── KscEditorPage.tsx             (154行) 3カラムレイアウト・リサイズ
├── components/
│   ├── FileTree.tsx                  (127行) ファイルエクスプローラー
│   ├── KscMonacoEditor.tsx           (92行)  Monaco エディタ統合
│   └── PreviewPane.tsx               (134行) プレビュー iframe
└── monaco/
    ├── kscLanguage.ts                (166行) Monarch tokenizer・テーマ
    ├── kscDiagnostics.ts             (55行)  リアルタイム診断
    └── kscCompletionProvider.ts      (164行) 自動補完プロバイダ
```

---

## 技術スタック

| 層 | 技術 |
|----|------|
| UI | React 19.2 + TypeScript |
| エディタ | Monaco Editor (@monaco-editor/react 4.7) |
| 状態管理 | Zustand 5.0 |
| スタイリング | Tailwind CSS 3.4 |
| ルーティング | React Router DOM 7.13 |
| コンパイラ | @kaedevn/ksc-compiler（monorepo package） |
| ビルド | Vite 7.3 |
| テスト | Playwright（E2E） |

---

## 主要機能

### 3カラムレイアウト（KscEditorPage.tsx）

- **左**: FileTree — `.ksc` ファイル一覧、追加・削除・リネーム
- **中央**: Monaco Editor — シンタックスハイライト、診断、自動補完
- **右**: PreviewPane — 16:9 iframe、実行/リロードボタン
- マウスドラッグでカラム幅リサイズ（最小 120px）

### ストア（useKscEditorStore.ts）

| State | 説明 |
|-------|------|
| `project` | ProjectData（アセット・キャラ・data） |
| `files` | KscFile[]（name・content） |
| `currentFileIndex` | 選択中のファイル |
| `diagnostics` | Diagnostic[]（エラー・警告） |
| `isDirty` | 未保存フラグ |
| `isSaving` | 保存中フラグ |
| `previewError` | プレビューエラーメッセージ |

主要メソッド:
- `loadProject(workId)` — API からプロジェクト読み込み + アセット自動インポート
- `saveProject()` — `PUT /api/projects/:id` でファイル保存
- `ensureFantasyAssets()` — 背景・キャラ不足時に公式アセット自動インポート
- `buildDefaultFile()` — デフォルト KSC スクリプト生成

### Monaco 統合

- **シンタックスハイライト**: 対話ブロック（`#`）、キーワード、コメント、文字列、数値
- **自動補完（39メソッド）**: `engine.` → メソッド候補、`engine.setBg("` → 背景アセット、キャラ slug・表情 slug
- **リアルタイム診断**: 300ms デバウンス → Tokenize → Parse → TypeCheck → マーカー表示
- **ショートカット**: Ctrl+S（Cmd+S）で保存

### プレビュー（PreviewPane.tsx）

- iframe に `postMessage()` でスクリプト・アセット・キャラ送信
- Preview 側（packages/web）で `KscRunner` が実行
- Canvas に描画、エラーは iframe → 親へ送信

---

## API 連携

| エンドポイント | メソッド | 用途 |
|---------------|---------|------|
| `/api/projects/:id` | GET | プロジェクト・アセット・キャラ取得 |
| `/api/projects/:id` | PUT | kscFiles 保存 |
| `/api/official-assets?kind=image` | GET | 公式アセット一覧 |
| `/api/assets/:projectId/use-official` | POST | 公式アセットインポート |
| `/api/projects/:projectId/character-class` | POST | キャラクタークラス作成 |

認証: `authFetch()` — `Authorization: Bearer ${token}`

---

## E2E テスト（21本）

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `tests/ksc-editor.spec.ts` | 11 | 基本操作（表示・ファイル追加・編集・保存・プレビュー） |
| `tests/ksc-inline-commands.spec.ts` | 6 | @r/@l/@p コマンド、混合スクリプト、保存→リロード |
| `tests/ksc-default-script.spec.ts` | 2 | デフォルトスクリプト生成・実行 |
| `tests/ksc-block.spec.ts` | 2 | ブロックエディタの ksc ブロック追加・削除 |

テストパターン: 認証トークン注入 → プロジェクト作成 → KSC Editor 操作 → プロジェクト削除

---

## 直近のコミット履歴

| コミット | メッセージ |
|---------|-----------|
| `52229a7` | feat: add inline commands, editor type selection, UX improvements |
| `9108617` | fix: use # dialogue syntax in default KSC script |
| `255c075` | fix: use asset-free default KSC script |
| `9bc6b4a` | fix: handle API response wrapper and null assets in KSC Editor |
| `20dfd20` | test: add KSC Editor E2E tests (10 tests) |
| `be199ad` | feat: add KSC Editor app (Phase 1 MVP) |
| `7e34032` | docs: add KSC editor design specification |

---

## 実装フェーズと残課題

### Phase 1 (MVP) — 完了

- コード編集（Monaco + KSC 言語対応）
- ファイル管理（追加・削除・リネーム）
- プレビュー実行（iframe + postMessage）
- API 連携（読み込み・保存）
- 公式アセット自動インポート
- E2E テスト 21 本

### Phase 2 — 未実装

- **プロパティパネル**: カーソル行の engine.* メソッドに応じたコンテキスト UI
- **デバッグ機能**: ブレークポイント、ステップ実行、変数ウォッチ
- **KscRunner の VM 変数抽出**

### Phase 3 — 未実装

- **タイムライン**: BG/CH/BGM/SE レーン、ドラッグで fadeMs 調整
- **コードインテリジェンス**: 定義ジャンプ、ホバー型情報、リネーム

### 既知の制限

- `previewError` が `getState()` 直接参照（リアクティブでない可能性）
- コード内に明示的な TODO/FIXME はなし

---

## 関連ドキュメント

- 設計書: `docs/09_reports/2026/03/05/08-ksc-editor-spec.md`
- KSC コマンドリファレンス: `docs/ksc-command-reference.md`
- KS/KSC マッピング: `docs/02_references/ks_ksc_mapping.md`
- KSC メソッドリファレンス: `docs/02_references/ksc_method_reference.md`
