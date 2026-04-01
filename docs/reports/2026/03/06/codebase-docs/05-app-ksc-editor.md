# apps/ksc-editor - KSC スクリプトエディタ

## 概要

KSC (TypeScript 風スクリプト言語) 専用のコードエディタ。Monaco Editor を統合し、構文ハイライト、リアルタイム診断、オートコンプリート、ファイルツリー、プレビューペインを備える。ポート 5177 で動作。

## ディレクトリ構成

```
apps/ksc-editor/
├── src/
│   ├── main.tsx                        # React エントリ
│   ├── App.tsx                         # ルーター・レイアウト
│   ├── pages/
│   │   └── KscEditorPage.tsx           # メインエディタページ (3カラム)
│   ├── components/
│   │   ├── KscMonacoEditor.tsx         # Monaco エディタ統合
│   │   ├── FileTree.tsx                # ファイルブラウザ
│   │   └── PreviewPane.tsx             # iframe プレビュー
│   ├── monaco/
│   │   ├── kscLanguage.ts              # KSC 構文ルール
│   │   ├── kscDiagnostics.ts           # リアルタイムエラーチェック
│   │   └── kscCompletionProvider.ts    # オートコンプリート
│   ├── store/
│   │   └── useKscEditorStore.ts        # Zustand 状態管理
│   ├── config/
│   │   ├── api.ts                      # API エンドポイント
│   │   └── frontend.ts                 # フロントエンド定数
│   ├── types/
│   │   └── index.ts                    # 型定義
│   └── index.css                       # グローバルスタイル
├── .env.development / .env.production  # API URL 設定
├── vite.config.ts                      # ポート 5177
├── tailwind.config.js
└── package.json
```

## 主要ファイル

| ファイル | 行数 | 役割 |
|---------|------|------|
| KscEditorPage.tsx | ~180 | 3カラムレイアウト (ファイルツリー / Monaco / プレビュー) |
| KscMonacoEditor.tsx | ~200 | Monaco エディタ設定、構文ハイライト、診断表示 |
| FileTree.tsx | ~150 | ファイルブラウザ、ファイル CRUD |
| PreviewPane.tsx | ~120 | iframe でKSC 実行結果プレビュー |
| useKscEditorStore.ts | ~120 | 現在ファイル、開いているファイル、未保存変更の状態管理 |

## 依存関係

### 内部パッケージ
- なし（独立、API 経由でデータ取得）

### 主要外部ライブラリ
- `@monaco-editor/react` — コードエディタ
- `react` / `react-router-dom` — UI・ルーティング
- `zustand` — 状態管理
- `tailwindcss` — CSS

## 機能

### Monaco エディタ統合
- **構文ハイライト**: KSC キーワード、コマンド（@text, @choice, @bgm 等）、文字列、コメント
- **リアルタイム診断**: 入力中にエラー・警告をインライン表示
- **オートコンプリート**: コマンド名、パラメータ、変数名の候補表示

### ファイルツリー
- プロジェクト内の .ksc ファイル一覧
- ファイル作成・リネーム・削除
- ファイル選択でエディタに読み込み

### プレビュー
- iframe で KSC スクリプトの実行結果を表示
- `packages/web` の ksc-demo エンジンを使用

## データフロー

```
[FileTree] → ファイル選択 → [KscMonacoEditor] → 編集 → [useKscEditorStore]
                                    ↓
                            [kscDiagnostics] → エラー表示
                                    ↓
                            [PreviewPane] → iframe 実行
```

## テスト

- E2E: `tests/ksc-editor.spec.ts` (217行) — Monaco エディタ表示、ファイルツリー操作、プレビュー実行
- E2E: `tests/ksc-inline-commands.spec.ts` (314行) — インラインコマンド解析
