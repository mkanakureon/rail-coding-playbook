# KSCエディタ 設計仕様書

## 概要

KSC（KaedeScript Classic）専用のコードエディタ。TypeScript風スクリプト言語でビジュアルノベルの演出をプログラミングする。KSエディタ（ブロック編集）とは完全に独立した別画面。

## KS vs KSC

| | KS | KSC |
|---|---|---|
| 文法 | `@command` 形式 | TypeScript風 `engine.method()` 形式 |
| 対象 | シナリオライター | エンジニア・演出ディレクター |
| 編集 | ブロック ←→ KSテキスト双方向変換 | コードのみ（ブロック変換なし） |
| 実行 | KsScanner → KsPrinter → OpRunner | Lexer → Parser → Emitter → VM |
| 特徴 | シンプル・構造的 | 変数・関数・制御構文・型注釈 |

## URL

```
/projects/ksc-editor/:workId
```

## 画面構成

```
┌──────────┬─────────────────────────┬──────────────┐
│ 📁 Files │  Monaco Editor          │ Properties   │
│          │                         │ (コンテキスト │
│ scene/   │  engine.setBg("█")      │  連動)       │
│  01.ksc  │  engine.showChar(...)   │              │
│  02.ksc  │  #hero                  ├──────────────┤
│ common/  │  こんにちは              │ ▶ Preview    │
│  util.ksc│  #                      │ ┌──────────┐ │
│          │                         │ │  Canvas  │ │
│          │                         │ └──────────┘ │
├──────────┴─────────────────────────┴──────────────┤
│ 🎬 Timeline (展開/折りたたみ)                       │
│ ┌─────┬────────────────────────────────────────┐  │
│ │ BG  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│ │ CH  │ ░░░░████████░░░░░░░░████████░░░░░░░░░ │  │
│ │ BGM │ ████████████████████████████░░░░░░░░░ │  │
│ │ SE  │ ░░░░░░░░█░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│ └─────┴────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 左サイドバー: ファイルエクスプローラー

VSCode風のツリー表示。

- プロジェクト内の `.ksc` ファイル一覧
- フォルダ構造（scene/, common/ 等）
- ファイルの追加・削除・リネーム
- ダブルクリックでファイルを開く
- 複数ファイルのタブ表示（Monaco上部）

### 中央: Monaco エディタ

KSCコードの編集。

- シンタックスハイライト（キーワード, 文字列, 対話ブロック, コメント）
- リアルタイムエラー表示（Lexer/Parser/TypeChecker エラーを行にマーキング）
- 自動補完（engine.* メソッド, 変数, キーワード）
- 複数ファイルタブ

### 右上: プロパティパネル（コンテキスト連動）

カーソル行のコマンドに応じてUIが動的に変化する。プロパティパネルで値を変更するとコード側の引数も自動で書き換わる（GUI ↔ コード双方向連動）。

| カーソル位置 | プロパティ表示 |
|---|---|
| `engine.setBg("school")` | BG一覧（サムネイル付き）、effect選択ドロップダウン |
| `engine.showChar("hero", "smile", "center")` | キャラ選択 → 表情選択 → ポジション(L/C/R) |
| `engine.hideChar("hero")` | キャラ選択、fadeMs入力 |
| `engine.playBgm("bgm_main")` | BGM一覧（試聴ボタン付き） |
| `engine.playSe("click")` | SE一覧（試聴ボタン付き） |
| `engine.playVoice("voice01")` | Voice一覧 |
| `engine.wait(500)` | スライダーでms調整 |
| `engine.shake(3, 500)` | intensity / duration スライダー |
| `engine.screenFilter("sepia")` | フィルタ種別選択、intensity スライダー |
| `#speaker` | キャラ選択（speaker切替） |
| `choice { ... }` | 選択肢一覧の編集UI |
| それ以外の行 | ファイルアウトライン（関数・ラベル・対話ブロック一覧） |

### 右下: プレビュー

Canvas (16:9) でリアルタイム描画。

- 実行/停止ボタン
- KscRunner + IOpHandler でスクリプト実行
- BG・キャラ・対話・エフェクトを描画
- エラー時はエラー情報を表示（行・列付き）

### 下部: タイムライン（展開/折りたたみ）

KSエディタと同じ配置。

- BG / CH / BGM / SE / Voice のレーン表示
- 時間軸上にコマンドの発生タイミングを可視化
- タイムライン上でドラッグして fadeMs や wait の調整
- コード側の値と双方向連動

## 機能一覧

### Phase 1（MVP）: コード編集 + プレビュー

エディタとして最低限動く状態。

- [ ] Monaco エディタ + KSCシンタックスハイライト
- [ ] リアルタイムエラー表示（Lexer/Parser/TypeChecker）
- [ ] engine.* の自動補完
- [ ] プレビュー（実行/停止）
- [ ] ファイルエクスプローラー（.ksc ファイル一覧）
- [ ] プロジェクトのアセット・キャラ定義の読み込み

### Phase 2: プロパティパネル + デバッグ

GUIとコードの双方向連動。デバッグ機能。

- [ ] プロパティパネル（カーソル行連動）
  - [ ] setBg: アセットサムネイル選択
  - [ ] showChar: キャラ・表情・ポジション選択
  - [ ] playBgm/playSe: オーディオ一覧 + 試聴
  - [ ] wait/shake: スライダー調整
  - [ ] #speaker: キャラ選択
  - [ ] デフォルト: アウトライン表示
- [ ] プロパティ変更 → コード自動書き換え
- [ ] コード変更 → プロパティ自動反映
- [ ] 変数ウォッチ（VM globals + locals）
- [ ] ブレークポイント（行指定で一時停止）
- [ ] ステップ実行（1行ずつ進める）
- [ ] コールスタック表示

### Phase 3: タイムライン + コードインテリジェンス

演出の視覚的調整と開発体験の向上。

- [ ] タイムライン（BG/CH/BGM/SE レーン表示）
- [ ] タイムライン上のドラッグ → コード書き換え
- [ ] 定義ジャンプ（関数・変数）
- [ ] ホバー型情報（TypeChecker の型を表示）
- [ ] リネーム（変数・関数名の一括変更）
- [ ] コードフォーマッター

## 共有リソース

KSエディタとKSCエディタで共有するもの:

- プロジェクトデータ（API: `GET /api/projects/:id`）
- アセット定義（背景・オーバーレイ・BGM・SE）
- キャラクター定義（キャラ・表情）
- プレビューエンジン（IOpHandler, WebOpHandler）
- 認証（JWT トークン）

共有しないもの:

- 編集対象（KS: ブロック/ページ、KSC: .ksc ファイル）
- コンパイルパイプライン（KS: KsScanner/KsPrinter、KSC: Lexer/Parser/Emitter/VM）
- タブ構成・画面レイアウト

## 技術スタック

| 要素 | 技術 |
|---|---|
| フレームワーク | React (Vite) |
| コードエディタ | Monaco Editor |
| 状態管理 | Zustand |
| コンパイラ | @kaedevn/ksc-compiler（既存） |
| ランタイム | KscRunner + KscHostAdapter（既存） |
| プレビュー | WebOpHandler + Canvas（既存） |
| デプロイ | Azure Static Web Apps（KSエディタと同じ or 別SWA） |

## 既存資産の活用

| 既存コード | 活用先 |
|---|---|
| `packages/ksc-compiler` (Lexer/Parser/TypeChecker/Emitter/VM) | エラー検出、自動補完、実行 |
| `packages/ksc-compiler/src/checker/builtins.ts` | engine.* の型情報 → 補完・プロパティパネル |
| `packages/web/src/engine/KscRunner.ts` | プレビュー実行 |
| `packages/web/src/engine/KscHostAdapter.ts` | VM ↔ IOpHandler ブリッジ |
| `packages/web/src/renderer/WebOpHandler.ts` | Canvas 描画 |
| `apps/editor/src/components/KSEditor/` | Monaco 統合の参考 |
| `apps/editor/src/components/panels/AssetPanel.tsx` | アセット一覧UIの参考 |
| `apps/editor/src/components/panels/CharacterPanel.tsx` | キャラ一覧UIの参考 |
