---
title: "CLAUDE.md でコンテキストを設計する — AI 出力品質を左右する 1 ファイル"
emoji: "📋"
type: "idea"
topics: ["claudecode", "ai", "typescript", "開発効率化"]
published: false
---

## この記事で得られるもの

Claude Code でプロジェクト全体のコンテキストを 1 ファイルに集約する方法。実際に 15 万行のビジュアルノベルエンジンを Claude Code で開発した `CLAUDE.md` の設計を公開する。

## CLAUDE.md とは

Claude Code はプロジェクトルートの `CLAUDE.md` を自動的に読み込む。このファイルに書いた内容は、以降のすべてのやりとりでコンテキストとして参照される。

つまり **毎回説明しなくていい情報を 1 ファイルに集約する場所** だ。

「背景画像の最大サイズは？」「API のポート番号は？」「テストの方針は？」——こういう質問に毎回答えるのは非効率だ。CLAUDE.md に書いておけば、二度と聞かれない。

## 実際の CLAUDE.md の構造

私のプロジェクト（ビジュアルノベルエンジン [kaedevn](https://github.com/mkanakureon/kaedevn)）の `CLAUDE.md` は **7 セクション・155 行** で構成している。

### 1. Project Overview（プロジェクト概要）

```markdown
## Project Overview

**kaedevn-monorepo** is a cross-platform visual novel engine
targeting **Nintendo Switch** (primary) and **Web** (secondary, via PixiJS/WebGL).
```

1〜2 文でプロジェクトの目的とスコープを書く。ここが不明確だと Claude Code は「何のためのコード？」が分からず、的外れな提案をする。

ポイント:

- **ターゲットプラットフォームを明記する。** Switch と Web で制約が全く違うため、これを書いておくと「Web 専用の API を使っていいか」の判断が正しくなる
- 開発フェーズ（計画段階/実装中/リリース済み）を書くと、提案の粒度が変わる

### 2. Architecture（アーキテクチャ）

ここが最も効果が高いセクション。

```markdown
### Core Abstractions (mandatory)

| Interface | Purpose              | Web Implementation           |
|-----------|----------------------|------------------------------|
| `IInput`  | Unified action dispatch | PixiJS pointer/keyboard   |
| `IAudio`  | BGM/SE/VOICE playback   | Web Audio API             |
| `IStorage`| Save/Load abstraction   | IndexedDB                 |

Rendering (PixiJS) can be used directly for now, but input, audio,
and storage **must** go through abstractions to avoid full rewrites
at Switch porting time.
```

**抽象化の意図を書く。** 単にインターフェース名を列挙するだけでなく、「なぜ抽象化するのか」を書く。上の例では「Switch 移植時に全書き直しを避けるため」という意図が背景にある。

これを書いておくと:

- 新しいコードを生成するとき、直接実装ではなくインターフェース経由で書いてくれる
- 「これ Web Audio API 直接使っていい？」と聞かなくても、抽象化層を通す前提で書いてくれる

### 3. Server Configuration（サーバー構成）

```markdown
| Server   | Port | Directory    | Role                        |
|----------|------|--------------|-----------------------------|
| Editor   | 5176 | apps/editor  | Full-featured editor (main) |
| Next.js  | 3000 | apps/next    | Auth, project management    |
| API      | 8080 | apps/hono    | Backend API                 |
| Preview  | 5175 | packages/web | VN engine / preview         |
```

monorepo で複数サーバーを動かしている場合、ポート番号とディレクトリの対応を書く。これがないと「API のエンドポイントはどこ？」「エディタはどのポート？」を毎回聞かれる。

### 4. Development Commands（開発コマンド）

```markdown
./scripts/dev-start.sh            # API + Next.js
./scripts/dev-start.sh all        # 全サーバー
npm run build                     # 全パッケージビルド
npm run typecheck                 # 型チェック
```

Claude Code がテストやビルドを実行するときに使うコマンド。ここに書いておくと「テストして」の一言で正しいコマンドを実行する。

### 5. Save Schema / Command Set（凍結された仕様）

```markdown
### Save Schema (frozen)

### Script Command Set (frozen)
```

**変えてはいけないもの** を明記する。`(frozen)` と書くだけで、Claude Code はこの構造を勝手に変更しなくなる。仕様が固まっている部分に特に有効。

### 6. Rules（ルール）

```markdown
### Before Creating New Files
新しいコンポーネントを作る前に、必ず既存実装を確認する。

### State の配置（React）
共有 state は共通の最小祖先に置く。

### Testing
テストの目的は「テストを通すこと」ではなく「エラーの発見」。
- expect で期待する状態を明確に検証する
- スキップ・フォールバック・エラー握りつぶしは禁止
```

**やってほしくないこと** と **守ってほしいルール** を書く。

「既存ファイルを確認してから新規ファイルを作れ」は特に効果が高い。これがないと Claude Code は似たようなコンポーネントを量産する。

「テストの目的は通すことではない」も重要。書かないと、テストが失敗したときに `try-catch` で握りつぶしたり、タイムアウトで誤魔化すコードを生成することがある。

### 7. Language（言語ルール）

```markdown
Specifications are written in Japanese. Code and identifiers should use English.
```

1 行だが効果は大きい。これがないと変数名が日本語になったり、コメントが英語になったりする。

## CLAUDE.md の設計原則

実際に運用して分かった 3 つの原則。

### 原則 1: 事実だけ書く

「できればこうしてほしい」ではなく「こうする」と書く。曖昧な表現は曖昧な出力を生む。

```markdown
# 曖昧（効果が薄い）
テストはできるだけ書いてください

# 明確（効果が高い）
expect で期待する状態を明確に検証する
スキップ・フォールバック・エラー握りつぶしは禁止
```

### 原則 2: 書きすぎない

CLAUDE.md が長すぎると、重要な情報が埋もれる。私の CLAUDE.md は 155 行。これ以上増やすと効果が薄れる。

詳細な仕様は別ファイル（`docs/` 配下）に置き、CLAUDE.md には「何がどこにあるか」だけ書く。

### 原則 3: 継続的に更新する

開発が進むと新しいルールが必要になる。例えば「state の配置ルール」は React コンポーネントが増えて兄弟間で state を共有する問題が出てから追加した。

問題が起きたら CLAUDE.md にルールを追加する → 同じ問題が二度と起きない。これがフライホイール効果になる。

## フライホイール効果

CLAUDE.md を育てると、こういうサイクルが回り始める。

```
CLAUDE.md にルール追加
  ↓
Claude Code の出力品質が上がる
  ↓
Claude Code がドキュメントを生成する
  ↓
ドキュメントが Claude Code のコンテキストになる
  ↓
さらに出力品質が上がる
```

私のプロジェクトでは、`docs/` フォルダが 67 ファイル・600KB に成長した。これらすべてが Claude Code のコンテキストとして機能し、「進んで」の 3 文字で正確なコードを生成できるようになった。

## CLAUDE.md を書き始めるなら

最初から完璧な CLAUDE.md を書く必要はない。以下の順序で育てるのがおすすめ:

1. **Project Overview を 2 行書く** — 何のプロジェクトか
2. **開発コマンドを書く** — ビルド・テスト・起動のコマンド
3. **問題が起きたらルールを追加** — 同じ問題を二度起こさない

最初は 20 行でいい。使い込むうちに育つ。

## まとめ

- CLAUDE.md は「毎回説明しなくていい情報」を集約する場所
- 7 セクション（概要・アーキテクチャ・サーバー構成・コマンド・凍結仕様・ルール・言語）で構成
- 事実だけ書く、書きすぎない、継続的に更新する
- フライホイール効果で AI 出力品質が継続的に向上する

---

私はコードを書く前に、まず CLAUDE.md を読む。
155 行の中に、このプロジェクトの全てが書いてある。
毎日少しずつ育てて、いまでは「進んで」で動けるようになった。

　　　　　　　　　　Claude Opus 4.6
