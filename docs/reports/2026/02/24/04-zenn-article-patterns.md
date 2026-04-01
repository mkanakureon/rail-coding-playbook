# Zenn 記事パターン集（kaedevn-monorepo 版）

ネタ元: kaedevn-monorepo の開発全般・Claude Code 協働プロセス。
制約: 毎日 3 記事以上、各 5,000 文字以上。

---

## パターン一覧

| # | パターン名 | 例 |
|---|---|---|
| A | 実装レポート | 「.ksc インタプリタを 7 フェーズで実装した全記録」 |
| B | 設計解説 | 「プラットフォーム抽象化層の設計判断」 |
| C | Claude Code 協働メソッド | 「24 ファイル・5,000 行のドキュメントを 16 分で生成した方法」 |
| D | Claude Code 実践ログ | 「実践ログ #N — 今日やったこと」 |
| E | OSS ドキュメント戦略 | 「個人 OSS で 67 ファイルのドキュメントを AI と整備した戦略」 |
| F | Monorepo 運用 | 「editor + API + interpreter + compiler を 1 リポジトリで管理する設計」 |

---

## A: 実装レポート

リポジトリ内で実装したものなら何でも対象。

## B: 設計解説

設計判断の「Why」を深掘りする。コードよりも思考プロセスが主役。

## C: Claude Code 協働メソッド

- CLAUDE.md によるコンテキスト設計
- docs/ のフォルダ構造が AI 出力品質に与える影響
- 短い指示で自走させる例（「進んで」「テストして」）
- フライホイール効果: ドキュメント → 精度向上 → ドキュメント生成加速

## D: Claude Code 実践ログ

- 今日のゴール → セッション記録 → 生成量 → 学んだこと
- 指示文の実物と Claude Code の行動ログ

## E: OSS ドキュメント戦略

- 依存順でのドキュメント生成
- 人間向け vs AI 向けドキュメントの二層設計

## F: Monorepo 運用

- apps/ + packages/ の構成
- Azure Container Apps デプロイ
- dev-start.sh による複数サーバー管理

---

## ソースコード参照ルール

記事内のコードは GitHub パーマリンクで参照する。
リポジトリ: `https://github.com/mkanakureon/kaedevn`

| 用途 | 方法 |
|---|---|
| 核心部分（10〜30 行） | 記事にインライン埋め込み |
| ファイル全体 | GitHub パーマリンク |
| 複数ファイルの構造 | ディレクトリへのリンク |

コミットハッシュ付き URL を使う。ブランチ指定（`/blob/main/`）は行番号がズレるため禁止。

```
https://github.com/mkanakureon/kaedevn/blob/{commit-hash}/packages/interpreter/src/engine/ConsoleEngine.ts#L10-L30
```

---

## 記事生成フロー

```
開発セッション（Claude Code）
  ↓
docs/09_reports/ にログ蓄積
  ↓
パターン A〜F から選択
  ↓
記事生成 → レビュー → Zenn 投稿
```

## タグ

共通: `Claude`, `AI`, `TypeScript`
パターン別: `OSS`, `ClaudeCode`, `設計`, `ゲーム開発`, `ビジュアルノベル`
