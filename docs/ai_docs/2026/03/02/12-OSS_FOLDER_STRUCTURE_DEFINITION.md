# kaedevn-studio OSSリポジトリ構成定義書

## 1. コンセプト
個人開発者が「自分のPC（ローカル）」で、ノベルゲームの制作、テスト、確認を完結させるためのOSS開発環境。

## 2. ディレクトリ構造

```text
kaedevn-studio/
├── apps/
│   ├── editor/           # GUIエディタ（React/Vite）
│   ├── hono-local/      # ローカルファイル操作API（Hono/Node.js）
│   └── dashboard/        # プロジェクト管理ポータル（Next.js Lite）
├── packages/
│   ├── core/             # 型定義・インターフェース
│   ├── web/              # 描画エンジン（PixiJSプレイ画面）
│   ├── interpreter/      # スクリプト実行部（KNF）
│   ├── ksc-compiler/     # スクリプトコンパイル（KSC）
│   ├── compiler/         # KAG互換コンパイラ（KS）
│   ├── ui/               # 共通UIコンポーネント
│   └── battle/           # バトルエンジン
├── projects/             # ユーザープロジェクト保存領域
├── scripts/              # 開発支援スクリプト
├── GEMINI.md             # AIエージェント用コンテキスト
└── CLAUDE.md             # AIエージェント用コンテキスト
```

## 3. 主要コンポーネントの仕様

### A. apps/hono-local
- **Storage**: ローカルディスク（projects/ フォルダ）を直接利用。
- **Database**: SQLite (file-based) または JSON。
- **Role**: ブラウザ上のエディタからの要求を受け、ローカルファイルを読み書きするプロキシ。

### B. apps/dashboard
- **Auth**: 不要（ローカル実行のため）。
- **Features**: プロジェクト作成、一覧表示、エディタ起動、ローカルテスト実行。

### C. packages/web
- **Resolution**: 1280x720 (Standard).
- **Features**: エディタ内プレビューおよび独立テストウィンドウ。

## 4. 開発・貢献ガイドライン（AIネイティブ）
- すべてのパッケージは、AIエージェント（Claude Code / Gemini CLI）が構造を即座に理解できるよう、`GEMINI.md` / `CLAUDE.md` による定義を必須とする。
- 外部貢献者は、この OSS リポジトリをクローンし、ローカル PC 上で独自の機能追加や UI 改善を行うことができる。
