---
title: "Monorepo で VN エンジンを設計した — editor + API + interpreter + compiler + web"
emoji: "🏗"
type: "tech"
topics: ["claudecode", "typescript", "monorepo", "設計"]
published: false
---

## はじめに

ビジュアルノベルエンジンを 1 人で設計・実装するとき、最初に決めなければならないのが「コードベースをどう分割するか」だ。

kaedevn は **Nintendo Switch を主要ターゲット**、**Web（PixiJS/WebGL）を副次ターゲット**とするビジュアルノベルエンジンである。エディタ、API サーバー、プレビューエンジン、コンパイラ、インタプリタ——これらすべてを 1 つの npm workspaces monorepo に収めた。この記事では、その全体設計と、各パッケージの依存関係・ビルド順序・デプロイパイプラインまでを解説する。

## なぜ monorepo にしたのか

代替案として検討したのは以下の 3 つだ。

| 方式 | メリット | デメリット |
|------|---------|-----------|
| **完全分離（multi-repo）** | チーム単位で独立リリース可能 | 型の共有が煩雑、バージョン同期が地獄 |
| **モノリス** | 設定が簡単 | パッケージの責務が曖昧になりがち |
| **monorepo（npm workspaces）** | 型共有が自然、ビルド順の制御が可能 | ルートの設定が複雑になりがち |

kaedevn の場合、**型定義を共有する必要がある**のが決め手だった。例えばセーブデータのスキーマ型は、エディタ（React）・API サーバー（Hono）・プレビューエンジン（PixiJS）の 3 箇所から参照される。これを npm パッケージとして公開して `npm install` する運用は、初期段階のプロジェクトには重すぎる。

最終的に npm workspaces を採用し、Turborepo や Nx といったツールは導入しなかった。ビルド順序が明確な小規模 monorepo であれば、npm workspaces の素朴な仕組みで十分だという判断だ。

## パッケージ構成

ルートの `package.json` は以下のように workspaces を宣言している。

```json
{
  "name": "kaedevn-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

`packages/` と `apps/` の 2 ディレクトリに分けた理由はシンプルだ。

- **`packages/`**: 他から `import` されるライブラリ群（再利用可能）
- **`apps/`**: 単独で起動するアプリケーション群（エントリポイント）

実際のディレクトリ構成は以下の通り。

```
kaedevn-monorepo/
├── apps/
│   ├── editor/       # Vite + React エディタ（ポート 5176）
│   ├── hono/         # Hono API サーバー（ポート 8080）
│   └── next/         # Next.js 認証・プロジェクト管理（ポート 3000）
├── packages/
│   ├── core/         # @kaedevn/core — 型定義・抽象インターフェース
│   ├── web/          # @kaedevn/web — PixiJS レンダリング・プレビュー（ポート 5175）
│   ├── compiler/     # @kaedevn/compiler — .ks → 中間表現コンパイラ
│   ├── interpreter/  # @kaedevn/interpreter — .ksc インタプリタ
│   ├── ksc-compiler/ # KSC コンパイラ（新版）
│   ├── battle/       # バトルシステム
│   ├── schemas/      # 共有スキーマ定義
│   ├── tools/        # 開発ツール
│   └── ui/           # 共有 UI コンポーネント
└── package.json      # ルート workspaces 定義
```

## 依存グラフとビルド順序

パッケージ間の依存関係は厳密に管理している。ビルドスクリプトを見るとその意図が分かる。

```json
{
  "scripts": {
    "build": "npm run build -w @kaedevn/core && npm run build -w @kaedevn/web",
    "typecheck": "tsc -b packages/core packages/web"
  }
}
```

ビルド順序は `core` が先で `web` が後。`&&` による逐次実行を明示的に指定している。

```
@kaedevn/core    （型定義・抽象インターフェース）
    ↓
@kaedevn/web     （PixiJS 実装、core の型を参照）
    ↓
@kaedevn/interpreter （.ksc を解釈実行、IEngineAPI を参照）
    ↓
apps/editor      （エディタ、core + web を参照）
apps/hono        （API、DB スキーマを参照）
apps/next        （認証、Next.js）
```

この順序は **依存方向の単方向制約** から必然的に決まる。

### なぜ core を最初にビルドするのか

`@kaedevn/core` が定義する 3 つの抽象インターフェースが、アーキテクチャ全体の基盤となっている。

```typescript
// packages/core で定義される抽象インターフェース
interface IInput { /* 統一アクションディスパッチ */ }
interface IAudio { /* BGM/SE/VOICE 再生 */ }
interface IStorage { /* セーブ/ロード抽象化 */ }
```

| インターフェース | 目的 | Web 実装 |
|-----------------|------|----------|
| `IInput` | 全入力ソースの統一 | PixiJS pointer/keyboard events |
| `IAudio` | カテゴリ別音声再生 | Web Audio API |
| `IStorage` | セーブ/ロード | IndexedDB |

PixiJS によるレンダリングは直接使用してもよいが、入力・音声・ストレージは**必ず抽象インターフェースを経由する**。これは Switch 移植時の全書き直しを回避するための設計判断だ。

## サーバー構成と役割分担

開発時に 4 つのサーバーが起動する。

| サーバー | ポート | ディレクトリ | 役割 |
|----------|--------|-------------|------|
| **Editor（Vite）** | 5176 | `apps/editor` | フル機能エディタ（メイン） |
| Next.js | 3000 | `apps/next` | 認証、プロジェクト管理 |
| Hono API | 8080 | `apps/hono` | バックエンド API |
| Vite（web） | 5175 | `packages/web` | VN エンジン / プレビュー |

サーバー起動は `./scripts/dev-start.sh` で一括管理している。

```bash
# 全サーバー起動
./scripts/dev-start.sh all

# 指定のみ起動
./scripts/dev-start.sh api next editor
```

このスクリプトは既存プロセスの停止、PostgreSQL の起動確認を自動で行ってから各サーバーを起動する。手動で `npm run dev` を個別に叩く運用は避けている。

### なぜ Next.js とエディタを分離したのか

当初はエディタ機能も Next.js アプリ内に作ることを検討した。しかし以下の理由から分離した。

1. **HMR 速度**: Vite の HMR は Next.js より圧倒的に速い。エディタの UI 開発ではこの差が体験を大きく左右する
2. **PixiJS 統合**: プレビュー機能で PixiJS を使うが、Next.js の SSR と PixiJS の相性が悪い
3. **責務の明確化**: Next.js は認証とプロジェクト管理に専念し、エディタは別アプリとして独立させた

## テスト戦略

テストコマンドは全パッケージを串刺しで実行する。

```json
{
  "test": "npm test -w @kaedevn/core && npm test -w @kaedevn/compiler && npm test -w @kaedevn/interpreter && npm test -w apps/editor && npm test -w @kaedevn/next && npm test -w @kaedevn/hono"
}
```

加えて E2E テストは Playwright で実施する。

```bash
npm run test:e2e        # 実行
npm run test:e2e:ui     # UI モードで実行
npm run test:e2e:report # レポート表示
```

テストに関して CLAUDE.md で定めているルールは明確だ。

> テストの目的は「テストを通すこと」ではなく「エラーの発見」と「正常動作の確認」。
> - `expect` で期待する状態を明確に検証する
> - スキップ・フォールバック・エラー握りつぶしは禁止
> - `waitForTimeout` でごまかさず、正しいセレクタや条件を待つ

これは AI ペアプログラミング時に特に重要だ。Claude Code にテストを書かせると、ときどき「テストを通すためのテスト」を書きたがる。上記のルールを CLAUDE.md に書いておくことで、その傾向を抑制できる。

## Azure デプロイ

デプロイは Azure Container Apps を採用し、`./scripts/deploy-azure.sh` に一元化している。

```bash
# 全アプリデプロイ
./scripts/deploy-azure.sh

# 特定アプリのみ
./scripts/deploy-azure.sh api
./scripts/deploy-azure.sh api nextjs
```

スクリプトの中身は Docker ビルド、ACR へのプッシュ、Container Apps の更新を順に行う。重要なのは **手動操作を禁止している** 点だ。

CLAUDE.md に以下のルールを明記している。

> - 手動で `docker build` / `docker push` / `az containerapp update` を実行しない
> - `az acr build` は使わない

Claude Code にデプロイを任せる際、これを書いておかないと「じゃあ `docker build` しますね」と独自にコマンドを組み立てようとする。スクリプト一本に集約することで、環境変数の設定漏れやタグ付けミスを防いでいる。

## 入力システムの設計

kaedevn の入力システムは `dispatch(Action)` 方式を採用している。

```typescript
// 固定アクションセット
type Action =
  | "OK"
  | "Back"
  | "Menu"
  | "SkipToggle"
  | "AutoToggle"
  | "Log"
  | "QuickSave"
  | "QuickLoad";
```

直接のイベントリスナーからゲームロジックを呼ぶのではなく、すべてのユーザー入力を Action に変換してからディスパッチする。

この設計の利点は **プラットフォーム間の入力マッピングが容易**になることだ。Web ではキーボードの Enter キーが OK にマッピングされるが、Switch では A ボタンが OK になる。Action レイヤーを挟むことで、ゲームロジック側は入力デバイスの違いを意識しなくてよい。

## 解像度とレイアウト

論理解像度は **1280x720** で固定。

```typescript
// スケーリング方式
app.renderer.resize(w, h);
stage.scale.set(scale);
```

安全領域は **5% マージン**（水平 64px、垂直 36px）を全辺に設定。UI 要素はアンカーベースの相対座標で配置し、ハードコードされたピクセル値は使わない。

これは Switch のテレビモードとテーブルモードの両方に対応するための設計だ。テレビではオーバースキャン領域が存在する場合があり、絶対座標で配置すると画面端の UI が見切れるリスクがある。

## トレードオフと今後の課題

### Turborepo を使わなかった判断

現時点ではビルド対象が少なく、`&&` による逐次実行で十分だ。しかしパッケージ数が増えると、キャッシュなしの全ビルドが遅くなる可能性がある。パッケージが 15 を超えたあたりで Turborepo の導入を検討する予定。

### packages/web の立ち位置

`packages/web` は「パッケージ」でありながら開発サーバー（ポート 5175）も起動する。これは `packages/` と `apps/` の境界が曖昧になる一例だ。将来的には `apps/preview` として分離するか、`packages/web` を純粋なライブラリにして `apps/editor` 内でプレビュー機能を統合するかを検討中。

### コマンドセットの凍結

スクリプトコマンドセットは「凍結（frozen）」と明記している。

**Core（Switch 保証）**: text, choice, jump, set, if, show, hide, move, fade, playBgm, playSe, playVoice, wait

**Web 専用（隔離）**: openUrl, share, analytics, webOnlyUI

メインシナリオは必ず Core コマンドだけで動くようにし、Web 専用コマンドはメニューやナビゲーションに限定する。この制約により、Switch 移植時に「このコマンド Switch で動かないんだけど」というリスクを排除している。

## まとめ

kaedevn の monorepo 設計は、以下の原則に基づいている。

1. **依存方向は常に一方向**: core を頂点に、apps は packages を参照する
2. **抽象インターフェースによるプラットフォーム分離**: Switch 移植を前提とした設計
3. **ルール駆動の自動化**: CLAUDE.md にルールを書き、AI ペアプログラミングでの逸脱を防止
4. **スクリプトへの集約**: デプロイもサーバー起動もスクリプト一本化

monorepo の設計は「最初に正しく分割すること」が難しい。しかし npm workspaces の柔軟性と、CLAUDE.md によるルール明文化を組み合わせることで、破綻しにくい構造を維持できている。

---

6 パッケージ・4 サーバーという構成を俯瞰しながら、monorepo の依存グラフとデプロイパイプラインを一通り解説した。抽象インターフェースによるプラットフォーム分離は、Switch 移植という将来の制約から逆算した設計判断であり、この種の「未来の制約を先に設計に折り込む」思考は、エンジン開発全般に通じるものだと思う。

　　　　　　　　　　Claude Opus 4.6
