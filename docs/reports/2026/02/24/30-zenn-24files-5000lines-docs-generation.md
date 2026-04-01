---
title: "24 ファイル・5,000 行のドキュメントを依存順に生成した方法"
emoji: "📚"
type: "idea"
topics: ["claudecode", "ai", "ドキュメント", "OSS"]
published: false
---

## はじめに

OSS 公開に向けて、インタプリタパッケージ（`@kaedevn/interpreter`）のドキュメントを一括で整備する必要がありました。結果として、24 ファイル・5,080 行のドキュメントを Claude Code で生成しました。

ただし、これは「24 ファイルをまとめて生成」したのではありません。**依存関係を意識して、5 つのフェーズに分けて順番に生成**しました。本記事では、その設計プロセスと、なぜ順序が重要なのかを解説します。

## 背景: なぜドキュメントが必要だったか

`@kaedevn/interpreter` は、独自のスクリプト言語 `.ksc` を解釈・実行するインタプリタです。OSS として公開するには、以下が必要でした。

- 言語仕様書（文法、型、演算子）
- API リファレンス（全クラス、全メソッド）
- 実装ガイド（IEngineAPI の実装方法）
- テスト手順書（テストの実行方法）
- FAQ（よくあるエラーと対処）

コードは動いていましたが、コードを読まなければ何も分からない状態でした。

## 生成計画: 24 ファイルの全体像

生成したドキュメントの全リストです。

### 要求仕様書（3 ファイル）

| ファイル | 内容 |
|---------|------|
| `requirements-overview.md` | 要求仕様書（総合） |
| `requirements-scripting.md` | スクリプト言語要求仕様書 |
| `requirements-platform.md` | プラットフォーム抽象化要求仕様書 |

### 仕様書（7 ファイル）

| ファイル | 内容 |
|---------|------|
| `spec-ksc-language.md` | KSC 言語仕様書（EBNF、型、演算子） |
| `spec-builtin-commands.md` | 組み込みコマンド仕様書（17 コマンド） |
| `spec-engine-api.md` | IEngineAPI インターフェース仕様書 |
| `spec-expression.md` | 式評価仕様書 |
| `spec-state-management.md` | 状態管理仕様書 |
| `spec-error-handling.md` | エラーハンドリング仕様書 |
| `spec-output-model.md` | 出力モデル仕様書 |

### 設計書（6 ファイル）

| ファイル | 内容 |
|---------|------|
| `design-architecture.md` | アーキテクチャ設計書 |
| `design-parser.md` | パーサー設計書 |
| `design-evaluator.md` | 式評価器設計書 |
| `design-debug-system.md` | デバッグシステム設計書 |
| `design-extensibility.md` | 拡張性設計書 |
| `design-class-support.md` | クラス対応設計書 |

### ガイド・テスト・リファレンス（8 ファイル）

| ファイル | 内容 |
|---------|------|
| `guide-getting-started.md` | クイックスタート |
| `guide-scripting.md` | スクリプト記述ガイド |
| `guide-console-engine.md` | ConsoleEngine ガイド |
| `guide-engine-implementation.md` | IEngineAPI 実装ガイド |
| `testing-plan.md` | テスト計画書 |
| `testing-procedure.md` | テスト手順書 |
| `testing-coverage.md` | テストカバレッジ報告書 |
| `api-reference.md` | API リファレンス |

### 運用（3 ファイル）

| ファイル | 内容 |
|---------|------|
| `faq-troubleshooting.md` | FAQ・トラブルシューティング |
| `changelog.md` | 変更履歴 |
| `glossary.md` | 用語集 |

## 依存関係: なぜ順序が重要か

ドキュメント間には依存関係があります。

```
glossary.md ← 全ドキュメントが用語を参照
  ↓
requirements-overview.md ← 仕様書が要件を参照
  ↓
spec-ksc-language.md ← 設計書が言語仕様を参照
  ↓
design-architecture.md ← ガイドがアーキテクチャを参照
  ↓
guide-getting-started.md ← FAQ がガイドの内容を前提とする
```

たとえば、`spec-builtin-commands.md`（組み込みコマンド仕様書）を書くには、`spec-ksc-language.md`（言語仕様書）が完成している必要があります。コマンドの引数の型や構文ルールは、言語仕様に依存するからです。

同様に、`guide-getting-started.md`（クイックスタート）を書くには、`spec-engine-api.md`（IEngineAPI 仕様書）が完成している必要があります。ガイドで紹介する API のシグネチャは、仕様書が正確である前提で書かれます。

## 5 フェーズの生成順序

依存関係を分析した結果、以下の 5 フェーズで生成することにしました。

```
Phase A: 基盤ドキュメント（最初に作成 — 他のドキュメントが参照する）
  1. glossary.md
  2. requirements-overview.md
  3. spec-ksc-language.md
  4. spec-engine-api.md

Phase B: コア仕様・設計（Phase A を参照して作成）
  5. requirements-scripting.md
  6. requirements-platform.md
  7. spec-builtin-commands.md
  8. spec-expression.md
  9. spec-state-management.md
  10. spec-error-handling.md
  11. design-architecture.md

Phase C: 詳細設計（Phase B を参照して作成）
  12. design-parser.md
  13. design-evaluator.md
  14. design-debug-system.md
  15. design-extensibility.md

Phase D: 実装ガイド・テスト（Phase A-C を参照して作成）
  16. guide-getting-started.md
  17. guide-engine-implementation.md
  18. guide-scripting.md
  19. testing-plan.md
  20. testing-procedure.md
  21. testing-coverage.md

Phase E: リファレンス・運用（最後に作成）
  22. api-reference.md
  23. faq-troubleshooting.md
  24. changelog.md
```

### Phase A: 基盤ドキュメント

最初に用語集を作ります。プロジェクト固有の用語（KSC、KNF、IEngineAPI、GameState、CallFrame など）を定義し、以降のドキュメントで一貫した用語を使えるようにします。

次に要求仕様書。「何を実現するのか」を定義します。これがないと、仕様書が「仕様」なのか「単なる実装メモ」なのか区別がつきません。

その後、言語仕様とエンジン API 仕様。この 2 つはほぼ全てのドキュメントから参照されます。

### Phase B: コア仕様・設計

Phase A で定義された用語と言語仕様を前提に、各モジュールの仕様を書きます。組み込みコマンド仕様は言語仕様の上に構築され、式評価仕様は言語の型システムに依存します。

### Phase C: 詳細設計

仕様が固まった段階で、実装の設計書を書きます。パーサーの設計は言語仕様の文法定義に、式評価器の設計は式評価仕様に依存します。

### Phase D: 実装ガイド・テスト

設計書が完成してから、ユーザー向けのガイドを書きます。「正しい仕様と設計」が先にないと、ガイドに不正確な情報が混入するリスクがあります。

### Phase E: リファレンス・運用

最後に、全ドキュメントを参照する API リファレンスと FAQ を書きます。これらは「まとめ」の性質が強く、他のドキュメントが完成していないと書けません。

## Claude Code への指示方法

各フェーズの指示は以下のように行いました。

### Phase A の指示例

```
Phase A の 4 ファイルを作成してください。

1. glossary.md — プロジェクト固有用語の定義
2. requirements-overview.md — プロジェクト目的、機能要件、非機能要件
3. spec-ksc-language.md — .ksc の完全な文法定義（EBNF）
4. spec-engine-api.md — IEngineAPI の全メソッド

ソースコードを読んで、実装に基づいた正確な仕様を書いてください。
```

### Phase B 以降の指示例

```
Phase B の 7 ファイルを作成してください。
Phase A で作成した glossary.md と spec-ksc-language.md を参照してください。
```

重要なのは、**前のフェーズで生成したファイルを参照させる**ことです。Claude Code は前のフェーズで書いたドキュメントを読み込み、用語やクラス名の一貫性を保ちます。

## 生成結果の品質管理

### 一貫性チェック

24 ファイルを生成した後、以下をチェックしました。

- **用語の統一**: glossary.md で定義した用語がブレていないか
- **リンク切れ**: ドキュメント間のリンクが全て有効か
- **コード例の正確性**: コード例が実際のソースコードと一致しているか
- **API シグネチャの正確性**: 仕様書のメソッドシグネチャがソースコードと一致しているか

### 実際に見つかった問題

- `CallFrame` の型定義が 2 つのドキュメントで微妙に異なっていた
- `Evaluator` のメソッド名が古い名前で書かれていた箇所があった
- Phase D のガイドで、Phase B の仕様書にない機能を紹介していた

これらは Phase E（最終フェーズ）の作業中に発見・修正しました。

## docs/ ディレクトリの構造

最終的なディレクトリ構造は以下の通りです。

```
packages/interpreter/docs/
├── README.md                  # 索引（24 ファイルへのリンク）
├── glossary.md                # 用語集
├── requirements-overview.md   # 要求仕様書
├── requirements-scripting.md  # スクリプト言語要求仕様書
├── requirements-platform.md   # プラットフォーム抽象化要求仕様書
├── spec-ksc-language.md       # 言語仕様書
├── spec-builtin-commands.md   # 組み込みコマンド仕様書
├── spec-engine-api.md         # IEngineAPI 仕様書
├── spec-expression.md         # 式評価仕様書
├── spec-state-management.md   # 状態管理仕様書
├── spec-error-handling.md     # エラーハンドリング仕様書
├── spec-output-model.md       # 出力モデル仕様書
├── design-architecture.md     # アーキテクチャ設計書
├── design-parser.md           # パーサー設計書
├── design-evaluator.md        # 式評価器設計書
├── design-debug-system.md     # デバッグシステム設計書
├── design-extensibility.md    # 拡張性設計書
├── design-class-support.md    # クラス対応設計書
├── guide-getting-started.md   # クイックスタート
├── guide-scripting.md         # スクリプト記述ガイド
├── guide-console-engine.md    # ConsoleEngine ガイド
├── guide-engine-implementation.md # IEngineAPI 実装ガイド
├── testing-plan.md            # テスト計画書
├── testing-procedure.md       # テスト手順書
├── testing-coverage.md        # テストカバレッジ報告書
├── api-reference.md           # API リファレンス
├── faq-troubleshooting.md     # FAQ
├── changelog.md               # 変更履歴
├── oss-docs-plan.md           # 本計画書
└── 2026/                      # 内部ドキュメント（日付別）
    ├── 02/09/                 # 初期仕様・計画
    ├── 02/19/                 # エンジン仕様
    ├── 02/21/                 # 現状分析
    ├── 02/22/                 # KSC 言語仕様
    ├── 02/23/                 # 移行計画
    └── 02/24/                 # 実装報告
```

`docs/` 直下が OSS 公開用、`2026/` 以下が内部ドキュメント（開発過程の記録）です。

## 命名規則の設計

ファイル名は以下のプレフィクスで分類しています。

| プレフィクス | 分類 | 例 |
|-------------|------|-----|
| `requirements-` | 要求仕様 | `requirements-overview.md` |
| `spec-` | 仕様書 | `spec-ksc-language.md` |
| `design-` | 設計書 | `design-architecture.md` |
| `guide-` | ガイド | `guide-getting-started.md` |
| `testing-` | テスト | `testing-plan.md` |
| `api-` | リファレンス | `api-reference.md` |
| `faq-` | FAQ | `faq-troubleshooting.md` |

この命名規則により、ファイル名だけで「どの種類のドキュメントか」が分かります。

## 内部ドキュメントとの関係

`2026/` 以下の内部ドキュメントは、開発過程で蓄積された仕様書・計画書・報告書です。これらは `docs/` 直下の OSS ドキュメントの**ソース**として機能しました。

```
内部ドキュメント                OSS ドキュメント
────────────────────          ──────────────────
上級インタプリタ仕様書 v2.md  → spec-ksc-language.md
                                （EBNF に整理）

KNF_Interpreter_Phase7_Plan  → design-debug-system.md
                                （ブレークポイント設計）

Phase7-3_Complete.md         → testing-coverage.md
                                （カバレッジ数値）
```

内部ドキュメントは日本語で書かれた「作業メモ」の性質が強く、OSS ドキュメントはそれを整理・構造化した「公開向け」のドキュメントです。

## 所要時間

| フェーズ | ファイル数 | 所要時間（体感） |
|---------|----------|---------------|
| Phase A | 4 | 20 分 |
| Phase B | 7 | 25 分 |
| Phase C | 4 | 15 分 |
| Phase D | 6 | 20 分 |
| Phase E | 3 | 15 分 |
| 品質チェック | - | 10 分 |
| **合計** | **24** | **約 105 分** |

24 ファイル・5,080 行を約 2 時間弱で生成しました。人間が書いた場合、控えめに見積もっても 2-3 週間はかかる作業量です。

## 学んだこと

### 1. 順序が品質を決める

ランダムな順番で生成すると、用語のブレ、仕様の矛盾、ガイドの不正確さが増えます。依存関係を分析し、基盤から積み上げることで、一貫性のあるドキュメント群が生まれます。

### 2. 内部ドキュメントが「正解データ」になる

開発過程で蓄積した内部ドキュメントは、AI にとっての「正解データ」です。仕様の根拠、設計判断の理由、テスト結果の数値。これらがあるから、AI は正確なドキュメントを生成できます。

### 3. 索引（README.md）は最後に書く

README.md は全ファイルへのリンクを含む索引です。これを最初に書くと、ファイル名やタイトルの変更が反映されません。最後に書くのが正解です。

### 4. 「生成」ではなく「構造化」

AI がやっていることは「ゼロから創作」ではありません。内部ドキュメントとソースコードという「素材」を、OSS 向けの「構造」に整理しているのです。だから品質が高い。

## まとめ

| 指標 | 値 |
|------|-----|
| 生成ファイル数 | 24 |
| 合計行数 | 5,080 |
| 所要時間 | 約 105 分 |
| フェーズ数 | 5（A〜E） |
| 品質チェックで見つかった問題 | 3 件（修正済み） |

依存順に生成するという方法は、AI ドキュメント生成に限らず、人間がドキュメントを書く場合にも有効です。用語集 → 要求仕様 → 言語仕様 → 設計書 → ガイドという順序は、ソフトウェア開発における「正しいドキュメント作成の順序」そのものです。

---

24 ファイルのドキュメントを一気に生成するのではなく、依存順に 5 フェーズで積み上げたことが品質の鍵でした。内部ドキュメントという「正解データ」があったからこそ、AI は正確な仕様書を書けました。この体験は、「AI にドキュメントを書かせるなら、まず内部ドキュメントを蓄積せよ」という教訓を残してくれました。

　　　　　　　　　　Claude Opus 4.6
