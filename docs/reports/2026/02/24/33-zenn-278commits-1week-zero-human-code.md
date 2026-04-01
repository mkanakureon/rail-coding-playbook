---
title: "278 コミット・1 週間・人間のコード 0 行 — Claude Code だけで PF を作った"
emoji: "🏗"
type: "idea"
topics: ["claudecode", "ai", "開発効率化", "ゲーム開発"]
published: false
---

## はじめに

2026 年 2 月 7 日から 2 月 24 日まで、約 2 週間半。278 コミット。全コミットに `Co-Authored-By: Claude` の署名が付いている。

人間が書いたコードは 0 行。

これは「AI にちょっと手伝ってもらった」という話ではない。設計・実装・テスト・ドキュメント・デプロイスクリプトまで、すべてを Claude Code に指示して作らせた記録だ。

できあがったのは **kaedevn** — Nintendo Switch と Web の両方をターゲットにしたビジュアルノベルエンジンのモノレポ。エディタ、API サーバー、プレビューエンジン、スクリプトコンパイラ、インタプリタを含む。

## 成果物の全体像

### リポジトリ構成

```
kaedevn-monorepo/
├── apps/
│   ├── editor/     # Vite + React エディタ（:5176）
│   ├── next/       # Next.js 認証・プロジェクト管理（:3000）
│   └── hono/       # Hono API サーバー（:8080）
├── packages/
│   ├── core/       # プラットフォーム非依存の型・インターフェース
│   ├── web/        # PixiJS/WebGL レンダリングエンジン（:5175）
│   ├── compiler/   # .ks → Op 命令列コンパイラ
│   └── interpreter/ # KSC スクリプトインタプリタ（OSS 公開済み）
└── scripts/        # dev-start.sh, deploy-azure.sh
```

### 数字で見る規模

| 指標 | 数値 |
|------|------|
| 総コミット数 | 281 |
| Co-Authored-By 付きコミット | 279 |
| 開発期間 | 2026-02-07 〜 2026-02-24 |
| パッケージ数 | 6 |
| サーバー数 | 4（Editor, Next.js, Hono API, Web Preview） |

コミットの 99% 以上が AI との共著だ。残りの 2 つは `.gitignore` の追加など、ほぼ手動に近い操作だったと思うが、それすらも Claude Code 経由で行っている。

## 初日：14:29 から始まったモノレポ

最初のコミットは 2026 年 2 月 7 日 14:29。

```
ebbfb3d Initialize monorepo with npm workspaces, TypeScript, and Vite
```

ここから怒涛のコミットが始まる。初日だけのログを見てみよう。

```
14:29 Initialize monorepo with npm workspaces, TypeScript, and Vite
15:09 Implement Phase 1-3: core abstractions, script engine, and rendering
15:28 Implement Phase 4: menu, save/load, settings UI
17:16 Implement Phase 5: auto/skip modes, quick save/load, debug menu
18:41 Update to 1920×1080 resolution with auto-scaling renderer
19:50 Implement Phase 1 & 2: Complete UI/UX overhaul
20:01 Implement Phase 3: Gallery and UI/UX polish
20:35 Implement client stabilization patch with 6 major improvements
22:56 Implement Tween v0.1 seekable timeline system
23:08 Add timeline system documentation
```

14:29 にリポジトリが生まれ、23:08 にはタイムラインシステムまで動いている。Phase 1-5 が約 3 時間で完了したのは、Claude Code の出力速度ではなく、**指示の精度**が理由だ。

## 開発スタイル：「設計を語る人」と「実装する AI」

私の役割は明確だった。

1. **何を作るか決める**（仕様・優先順位）
2. **制約を伝える**（Switch 移植を見据えた抽象化、解像度、セーブスキーマ）
3. **レビューして次の指示を出す**

コードは一切書かない。書く必要がない。

### CLAUDE.md が設計書になる

このプロジェクトでは `CLAUDE.md` がリポジトリルートに置いてある。これが Claude Code への「常駐指示書」として機能する。

```markdown
## Architecture

### Core Abstractions (mandatory)

| Interface | Purpose | Web Implementation |
|-----------|---------|-------------------|
| `IInput`  | Unified action dispatch | PixiJS pointer/keyboard events |
| `IAudio`  | BGM/SE/VOICE playback  | Web Audio API |
| `IStorage`| Save/Load abstraction  | IndexedDB |

Rendering (PixiJS) can be used directly for now, but input, audio,
and storage **must** go through abstractions to avoid full rewrites
at Switch porting time.
```

これを書いておくだけで、Claude Code は毎回この制約を守ってコードを生成する。`IInput` を迂回してイベントリスナーを直接貼るようなコードは出てこない。

### セーブスキーマを「凍結」する

```json
{
  "save_schema_version": 1,
  "engine_version": "",
  "work_id": "",
  "scenario_id": "",
  "node_id": "",
  "vars": {},
  "read": {},
  "timestamp": 0
}
```

`CLAUDE.md` に「frozen」と明記した。Claude Code は新しいフィールドを追加しようとしない。画像やオーディオのバイナリを埋め込もうとしない。「参照 ID のみ」というルールも守られる。

## 1 日の流れ

典型的な 1 日のサイクルはこうだ。

### 朝（方針決定）

```
ユーザー: 今日は KSC コンパイラの Phase 2 をやろう。
         パーサーを補完して、型チェッカーを新規で書く。
```

### 午前（大きな実装）

Claude Code が一気に実装する。Phase 2 のコミットメッセージを見ると規模がわかる。

```
feat: KSCコンパイラ Phase 1.5-2 実装（パーサー補完・型チェッカー）

Phase 1.5: await/continue/%= トークン・AST追加、トレーリングカンマ対応
Phase 2: 2パス型チェッカー新規実装 — KscType型システム、スコープチェーン、
IEngineAPIビルトイン型シグネチャ、式16種・文14種の型推論・検証（172テスト通過）
```

13 ファイル変更、1,719 行追加。これが 1 セッションの成果。

### 午後（調整・バグ修正）

テストを回して不具合を潰す。Claude Code 自身がテストを書いているので、テストの品質が高い。人間がやるのは「あのパターンも試して」と言うだけだ。

### 夕方（ドキュメント・次の計画）

```
docs: TS-VM 2D Engine 仕様書・設計書・改善点・Switch移植性ギャップ分析を追加
```

仕様書も Claude Code が書く。ギャップ分析のような「考える系」のドキュメントも任せられる。

## コミットメッセージのスタイル

初期は英語だった。

```
Initialize monorepo with npm workspaces, TypeScript, and Vite
Implement Phase 1-3: core abstractions, script engine, and rendering
```

途中から日本語に切り替えた。

```
feat: ksc スクリプトブロックをエディタに追加
fix: タイムライン編集UI改善・チャンネル生成共通化・プレビュー連動修正
```

この切り替えも `CLAUDE.md` に書いただけで、以降すべてのコミットが日本語になった。

## 何がうまくいったか

### 1. 仕様の凍結が効いた

`CLAUDE.md` に `(frozen)` と書いたセーブスキーマとコマンドセットは、278 コミットを通じて一度も破られなかった。AI は「もっといい方法がある」と勝手に変更しない。凍結と書けば凍結する。

### 2. モノレポ構成が明確だった

```
Core commands (Switch-guaranteed):
  text, choice, jump, set, if, show, hide, move, fade,
  playBgm, playSe, playVoice, wait

Web-only (isolated):
  openUrl, share, analytics, webOnlyUI
```

「Switch で動くもの」と「Web 限定」を最初に分けたおかげで、Claude Code が Web 限定の機能をコア部分に混ぜることがなかった。

### 3. Phase 方式の段階的実装

初日の Phase 1-5 を皮切りに、コンパイラも Phase 0-1、1.5-2、2.5-3、4、5 と段階を踏んだ。各 Phase の終わりにテストが全通過していることを確認してから次に進む。

## 何が危なかったか

### 1. 大きすぎるコミット

```
19a2d53 feat: KSCコンパイラ Phase 0-1 実装 — 383 files changed, 6,570 insertions
```

383 ファイル変更はレビューが難しい。ただし、この大部分はアセット PNG だったので、コード部分は許容範囲だった。

### 2. 再帰テストのハング

> Known: Phase 5 recursion tests hang (fibonacci), large loop tests timeout

これはインタプリタの既知の制限だ。AI が書いたコードの限界は、AI 自身が検出してドキュメントに残した。

### 3. console.log の残留

```typescript
console.log(`[Parser] parseChoice() called with pcOffset=${pcOffset}`);
```

デバッグ用の `console.log` がコンパイラのパーサーに残っている。これは人間がレビューで見落とした。AI は「消していい？」とは聞いてこない。聞くべきだったのは人間の方だ。

## 「人間のコード 0 行」の意味

「コードを書いていない」は「何もしていない」ではない。

- CLAUDE.md を書いて設計を固めた
- 仕様を凍結してスコープクリープを防いだ
- Phase を切って実装順序を決めた
- テスト結果を見てバグ修正を指示した
- ドキュメントのレビューをした
- デプロイ手順を確認した

これらはすべて「開発」だ。ただ、キーボードで TypeScript を打つ工程がなかっただけだ。

## まとめ

278 コミットで作れたのは、Claude Code が優秀だったからだけではない。**指示の設計**が決定的に重要だった。

- `CLAUDE.md` に制約を明文化する
- 凍結すべきものは「frozen」と書く
- Phase を切って段階的に進める
- テストを毎回回して品質を担保する

これができれば、コードを 1 行も書かずにプラットフォームを作ることは現実的に可能だ。

---

278 コミットを振り返ると、初日の怒涛の Phase 1-5 が一番印象に残る。14:29 にリポジトリが生まれて、23:08 にはタイムラインシステムまで動いていた。人間が設計を語り、AI が実装する。このスタイルは今後もっと一般的になると思う。

　　　　　　　　　　Claude Opus 4.6
