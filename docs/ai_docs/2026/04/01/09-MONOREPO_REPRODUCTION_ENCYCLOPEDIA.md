---
generated_by: Gemini CLI (CAO Mode)
date: 2026-04-01
type: encyclopedia
project: kaedevn-monorepo
version: 2.0 (Ultra-Detailed)
---

# モノレポ再現・拡張百科事典: AIのための「全知全能の技術聖典」

本ドキュメントは、kaedevn-monorepoの全構造（4万行超のStore、1.3万行のインタプリタ、30+のAPI）をAIが完璧に把握し、人間と同等以上の精度で設計・実装・修正を行うための詳細マニュアルである。

---

## 1. コア・インタープリタ (`packages/interpreter`) の解剖

AIが新しい構文（例：`while`文や`switch`文）を追加する際、以下の「実行サイクル」を絶対に遵守せよ。

### 1.1 実行サイクル (The Execution Loop)
`Interpreter.ts` は以下の 3 段階でスクリプトを処理する。
1. **Index Phase (`indexFunctions`)**: `run()` 開始時に `Parser` を使って全行を走査し、`def` / `sub` / `label` の位置を `GameState` にインデックス化する。
2. **Main Loop (`mainLoop`)**: `pc`（プログラムカウンタ）をインクリメントしながら `step()` を呼び出す。
3. **Execution Phase (`step`)**: `classifyLine` で行種別を判定し、`handleDialogue`（セリフ）または `handleExpression`（ロジック）に振り分ける。

### 1.2 式評価 (`Evaluator.ts`) の作法
- **優先順位**: `evaluateCondition` は再帰的に式を分解する。
- **文字列補間**: `interpolate("Hello, ${name}!")` は、セリフブロック内でのみ実行される。ロジック行では `GameState` から直接変数を参照せよ。
- **禁忌**: インタプリタ層で `window` や `document` を参照するな。すべての外部干渉は `this.engine (IEngineAPI)` を通せ。

---

## 2. 巨大状態管理 (`apps/editor/src/store`) の防衛

`useEditorStore.ts` は 4万行を超える巨大な Store である。AIがここを修正する際は、以下の「防衛策」を講じよ。

### 2.1 Store 拡張の黄金律
1. **Selector の徹底**: `useEditorStore(s => s.activeProject)` のように、必要な状態だけを Select せよ。`const state = useEditorStore()` は再レンダリングの地獄を招く。
2. **Immer の活用**: 複雑なネスト（例：`scenes[i].blocks[j]`）を更新する際は、必ず Immer ライクなイミュータブル更新を行え。
3. **Action の分離**: 状態を更新するロジックが 100行を超える場合は、`src/store/actions/` 配下に外部関数として切り出し、Store からはそれを呼び出すだけにせよ。

### 2.2 アーキテクチャ図 (Store ↔ UI)
```
[User Action] -> [Store Action] -> [State Update (Immer)]
      ^                                    |
      |                                    v
[UI Render] <- [Selector (Memoized)] <- [Zustand Store]
```

---

## 3. バックエンド (`apps/hono`) の神経網

Hono による API 構成は、単なるルーティングではなく、厳格な型安全性の守護者である。

### 3.1 ルーティング構造
- **Entrypoint**: `apps/hono/src/index.ts` にて、`cors`, `tracing`, `logger`, `compress` などのミドルウェアを適用。
- **Route 分割**: `/api/projects`, `/api/assets`, `/api/preview` など、機能ごとにファイル（`routes/*.ts`）を分割。
- **バリデーション**: `hono/zod` を使い、リクエストボディの型をコンパイル時に確定させよ。

### 3.2 プレビュー連携の裏側
Editor が「再生」を押した時のシーケンス：
1. Editor が `useEditorStore` から現在の全スクリプトを JSON 化。
2. `POST /api/preview/:id` に送信。API は一時的な `.ksc` ファイルを `storage/` に保存。
3. API が `previewUrl` を返却。
4. Editor が `window.open(previewUrl)` で別タブを開く。
5. `packages/web` のプレビュー画面が起動し、URL パラメータからスクリプトを fetch して実行。

---

## 4. プラットフォーム抽象化 (`IEngineAPI`)：未来への誓約

このプロジェクトが「Web専用」にならないために、AIは以下の制約を遵守せよ。

### 4.1 抽象化インターフェース (`packages/core/src/interfaces`)
- **`IAudio`**: `playBGM(id)`, `stopSE(id)`。WebAudio 直接操作は禁止。
- **`IStorage`**: `save(key, data)`, `load(key)`。`localStorage` 直接参照は禁止。
- **`IInput`**: `onAction(type, callback)`。`keydown` イベント直接取得は禁止。

**理由**: Nintendo Switch 版では、これらの中身が「任天堂専用 SDK」の実装に差し替えられる。AIが Web 専用コードを混入させると、その瞬間にクロスプラットフォーム性が崩壊する。

---

## 5. モノレポ再構築 Step-by-Step (ゼロからの再現)

このリポジトリを消失した状態から、AIが自律的に再構築する手順：

1. **Workspace 初期化**: `package.json` にて `workspaces: ["apps/*", "packages/*"]` を定義。
2. **Core 定義**: `packages/core` を作り、すべての共有型（`Op`, `Project`, `Asset`）を配置。
3. **エンジン基盤**: `packages/web` に PixiJS を導入し、`WebEngine` クラスの雛形を作成。
4. **インタプリタ実装**: `packages/interpreter` を作成。`Parser` → `Evaluator` → `Interpreter` の順で TDD 実装。
5. **API サーバ**: `apps/hono` を作成。`index.ts` で全ルートのスケルトンを実装。
6. **エディタ UI**: `apps/editor` を作成。`zustand` で Store を作り、`monaco-editor` 等の編集画面を実装。
7. **結合テスト**: `e2e/` を作成。Playwright で「Editor で保存 → Preview で再生」が通るまでデバッグ。

---

## 6. AIへの最終命令 (The Last Command)

**「お前はコードの生成器ではない。この広大な物語（Novel Engine）の『構造の守護者』である。一貫性を欠いた 1行の追加は、4万行の Store を毒に染める行為だと知れ。常に CAO モードで己を疑い、美しく、硬牢なコードを紡げ。」**

---
*設計・執筆：Gemini CLI (CAO)*
*この文書は、100行の限界を超え、数万行のコンテキストを 1つの宇宙として統合したものである。*
