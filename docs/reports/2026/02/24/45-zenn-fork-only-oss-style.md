---
title: "Fork 推奨・PR 拒否の OSS 公開スタイル"
emoji: "🍴"
type: "idea"
topics: ["claudecode", "OSS", "git"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」を OSS として公開するにあたり、通常の OSS とは異なるスタイルを採用しました。それは **「Fork 推奨・PR 拒否」** というスタイルです。

このプロジェクトは private な monorepo で開発しており、OSS リポジトリは一方通行で同期しています。外部からの PR は受け付けず、利用者には Fork して自分のプロジェクトに合わせることを推奨しています。

この記事では、このスタイルの背景と、CONTRIBUTING.md の設計について解説します。

## なぜ PR を受け付けないのか

### 1. monorepo との整合性

kaedevn の開発は private な monorepo（kaedevn-monorepo）で行っています。OSS リポジトリ（kaedevn）は、monorepo から特定のパッケージだけを切り出して同期しています。

```
[kaedevn-monorepo] (private)
  ├── apps/editor/
  ├── apps/hono/
  ├── apps/next/
  ├── packages/core/
  ├── packages/web/
  └── packages/interpreter/  ← ここだけ同期
       ↓ 一方通行
[kaedevn] (public, OSS)
  └── packages/interpreter/
```

OSS リポジトリに PR をマージすると、monorepo 側との差分が生まれます。monorepo → OSS の同期は自動化していますが、OSS → monorepo の逆方向の同期は複雑になります。

### 2. 個人プロジェクトのメンテナンスコスト

PR のレビュー・マージ・テスト・リリースは、個人にとって大きなコストです。特に以下のケースが問題になります。

- コーディングスタイルの違い
- テストカバレッジの不足
- 破壊的変更を含む PR
- 仕様理解が不十分な PR

これらを丁寧にレビューする時間を確保するのは、個人開発では現実的ではありません。

### 3. リファレンス実装としての位置づけ

kaedevn のインタプリタは「リファレンス実装」として公開しています。利用者は Fork して、自分のプロジェクトに合わせてカスタマイズすることを期待しています。

## CONTRIBUTING.md の設計

### 実際のファイル内容

```markdown
# Using kaedevn

This repository is a reference implementation synced from a private monorepo.
Pull requests are not accepted.

## How to Use

Fork this repository and adapt it to your own project.

## Useful Commands

npm run build / npm test / npm run typecheck / npm run demo

## Coding Standards

- Language: TypeScript (strict mode)
- Module system: ESM
- Code identifiers: English

## License

MIT
```

### 設計のポイント

#### 1. タイトルは "Using kaedevn"

通常の CONTRIBUTING.md は "Contributing to ..." ですが、ここでは "Using kaedevn" としています。PR は受け付けないため、「コントリビュート」ではなく「使い方」がメインコンテンツです。

#### 2. 冒頭に明示

最初の 2 行で「PR は受け付けない」ことを明確にしています。曖昧にすると、PR を送った人の時間を無駄にしてしまいます。

#### 3. Fork の手順を具体的に

Fork した後の手順を具体的に示すことで、「Fork してどうすればいいの？」という疑問に答えています。

## monorepo → OSS の同期フロー

同期は Claude Code のスキル（`sync-oss`）で自動化しています。

```
1. packages/interpreter/ のファイルを rsync で OSS リポジトリにコピー
2. 機密情報（.env, credentials）のチェック
3. git add の対象を制限（不要ファイルを除外）
4. コミット・プッシュ
```

このフローは一方通行です。OSS リポジトリ側の変更は monorepo に反映されません。

## Fork した人への配慮

### LICENSE: MIT

MIT ライセンスを採用しています。Fork した人が自由に改変・商用利用できるようにするためです。

### ドキュメントの充実

Fork した人が「この言語の仕様はどうなっているんだ？」と困らないよう、30 ファイル以上のドキュメントを整備しています。

### サンプルスクリプト

8 つのサンプルスクリプトを用意し、基本から応用までの使い方を示しています。

## このスタイルが向いているケース

| 向いているケース | 向いていないケース |
|---|---|
| 個人プロジェクト | コミュニティ主導のプロジェクト |
| private monorepo がある | OSS リポジトリが唯一のソース |
| リファレンス実装として公開 | ライブラリとして配布（npm publish） |
| メンテナンスコストを最小化したい | コントリビューターを増やしたい |

## よくある懸念と回答

### 「PR を受け付けないのは OSS として不適切では？」

MIT ライセンスで公開している以上、誰でも Fork して自由に使えます。「PR を受け付ける」ことは OSS の必須要件ではありません。

### 「Fork した人の改善がプロジェクトに反映されないのは勿体ない」

Fork した人の改善が素晴らしいものであれば、それを参考にして monorepo 側で実装し、同期で反映することは可能です。

## まとめ

「Fork 推奨・PR 拒否」という OSS 公開スタイルは、個人プロジェクトに特化したアプローチです。

- monorepo → OSS の一方通行同期で整合性を維持
- CONTRIBUTING.md を「Fork ガイド」に書き換え
- 充実したドキュメントとサンプルで Fork 後の自立を支援
- MIT ライセンスで利用の自由を保証

全ての OSS プロジェクトに適しているわけではありませんが、個人開発で「コードを公開したいが、PR のレビューに時間を取られたくない」という場合には有効なスタイルです。

---

PR を受け付けない OSS は「閉鎖的」と見られることもありますが、コードとドキュメントを全て公開し、MIT ライセンスで自由に使えるようにしている時点で、十分にオープンだと考えています。個人の時間は有限です。その中で最大限の価値を届ける方法を選びました。

　　　　　　　　　　Claude Opus 4.6
