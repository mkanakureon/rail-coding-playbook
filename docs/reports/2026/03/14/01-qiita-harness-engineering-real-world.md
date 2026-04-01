---
title: "10万行・783コミットのモノレポで実践する Claude Code + Gemini CLI もいるよ ハーネスエンジニアリング"
tags:
  - ClaudeCode
  - AI
  - DX
  - monorepo
  - TypeScript
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

## この記事の立ち位置

ハーネスエンジニアリングの記事が増えてきたので、「うち、もうやってた」という実例を共有します。

元記事の3本柱は：

1. **CLAUDE.md のポインタ設計（最小化）**
2. **PostToolUse Hook でリンター自動実行**
3. **Plan-Execute 分離ワークフロー**

本記事では、TypeScript 10万行超・14パッケージのモノレポで**実際に稼働している設定**をソースコード付きで紹介します。「やってみた」ではなく「5週間・783コミット回してこうなった」という話です。

## 前提・環境

| 項目 | 値 |
|------|-----|
| リポジトリ | TypeScript モノレポ（ビジュアルノベルエンジン） |
| TypeScript | 102,771行 / 739ファイル |
| C++ | 2,340行 / 38ファイル |
| ドキュメント | 92,801行 / 636ファイル |
| パッケージ数 | 14 packages + 5 apps |
| テストファイル | 240本 |
| コミット数 | 783 |
| 運用期間 | 約5週間（2026年2月7日〜） |
| デプロイ先 | Azure Container Apps / Static Web Apps |
| AI エージェント | **Claude Code (Opus 4.6)** + **Gemini CLI (2.5 Pro)** の2体体制 |

### このモノレポの中身

「10万行」が何でできているか。インフラからクライアント、ネイティブエンジンまで全レイヤーが1リポジトリに入っています。

```
kaedevn-monorepo/
├── apps/
│   ├── hono/          # REST API（Hono + Prisma + PostgreSQL）       28,471行
│   ├── next/          # Next.js 15（認証・管理画面・LP）              43,842行
│   ├── editor/        # ブロックエディタ（React 19 + Zustand）       14,959行
│   └── ksc-editor/    # KSC スクリプトエディタ（Monaco）              1,226行
├── packages/
│   ├── core/          # 型定義・Op IR・コマンド定義                    4,814行
│   ├── compiler/      # TyranoScript (.ks) コンパイラ                  2,143行
│   ├── ksc-compiler/  # KSC (.ksc) コンパイラ                         4,397行
│   ├── interpreter/   # KSC インタプリタ（デバッガ付き）               4,024行
│   ├── web/           # PixiJS 8 ゲームエンジン（WebGL）             12,055行
│   ├── native-engine/ # SDL2 + C++ ネイティブエンジン（Switch/iOS/Android） 2,340行
│   ├── map/           # タイルマップ・オートタイル                       543行
│   ├── battle/        # コマンドバトルシステム                           477行
│   ├── ai-gateway/    # LLM クライアント（OpenAI/Anthropic/Gemini）   1,105行
│   ├── ui/            # 共有コンポーネントライブラリ                     512行
│   ├── tools/         # CLI ユーティリティ（FFmpeg/Sharp）              500行
│   └── vscode-ks-ksc/ # VSCode 拡張（シンタックスハイライト）
├── .github/workflows/ # CI/CD（typecheck → build → Azure デプロイ）
├── scripts/           # 開発・デプロイ・テスト補助スクリプト群
├── tests/             # E2E テスト（Playwright）240ファイル
└── docs/              # 設計書・報告書・仕様書 636ファイル / 92,801行
```

レイヤーで見ると：

| レイヤー | 技術 | パッケージ |
|----------|------|-----------|
| **インフラ** | Azure Container Apps, Static Web Apps, GitHub Actions, PostgreSQL | `.github/`, `apps/hono/` |
| **バックエンド** | Hono, Prisma, JWT, Azure Blob Storage | `apps/hono/` |
| **フロントエンド** | Next.js 15, React 19, Zustand, TailwindCSS | `apps/next/`, `apps/editor/` |
| **ゲームエンジン (Web)** | PixiJS 8, Web Audio API, IndexedDB | `packages/web/` |
| **ゲームエンジン (Native)** | SDL2, C++, CMake | `packages/native-engine/`, `packages/sdl/` |
| **コンパイラ/VM** | 自作レキサー・パーサー・コードジェネレータ | `packages/compiler/`, `packages/ksc-compiler/`, `packages/interpreter/` |
| **AI 連携** | OpenAI, Anthropic, Google Gemini API | `packages/ai-gateway/` |

注目してほしいのは**ソースコード（10.5万行）とドキュメント（9.3万行）がほぼ 1:1** であること。コードを書くだけでなく、設計書・計画書・障害分析・テスト仕様が同じ密度で生成されている。これは Skills がドキュメント出力のフォーマットと保存先を固定しているから自然に積み上がる。ハーネスがないとこうはならない。

この全レイヤーを Claude Code と Gemini CLI の2体が触ります。だからこそハーネスが必要になる。

## 1. Hook — 編集のたびに即フィードバック

元記事と同じ施策。`.claude/settings.json` に Hook を定義しています。

### PostToolUse: oxlint 自動実行

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'FILE=$(jq -r \".tool_input.file_path // .tool_input.file\" < /dev/stdin); case \"$FILE\" in *.ts|*.tsx|*.js|*.jsx) npx oxlint \"$FILE\" 2>&1 | head -30;; esac'"
          }
        ]
      }
    ]
  }
}
```

**ポイント:**

- `Write|Edit` の両方をキャッチする（`Write` だけだと `Edit` ツールのリント漏れが起きる）
- `case` で拡張子フィルタ。JSON や Markdown の編集でリンターが走ると無駄にトークンを消費する
- `head -30` で出力を制限。大量の警告が出ると Claude Code のコンテキストが溢れる

元記事は Biome + Oxlint の併用ですが、うちは **Oxlint 単体**で回しています。フォーマットは pre-push hook 側の ESLint でカバーしているので、PostToolUse では lint エラーだけ即時検出できれば十分という判断です。

### PreToolUse: 保護ファイルのガード

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'FILE=$(jq -r \".tool_input.file_path // .tool_input.file\" < /dev/stdin); case \"$FILE\" in *.env|*.env.*|.eslintrc*|.claude/settings*) echo \"BLOCKED: $FILE is a protected file\" >&2; exit 2;; esac'"
          }
        ]
      }
    ]
  }
}
```

これは元記事にない施策。`.env` や `.eslintrc` をエージェントが勝手に書き換えるのを物理的に防ぎます。`exit 2` で Claude Code に「この操作は拒否された」と伝わるので、別のアプローチを考え始めてくれます。

**実際に効いた場面:** DB接続文字列が入った `.env` を「修正しておきました」と書き換えられそうになったとき、Hook がブロックして事なきを得ました。

## 2. CLAUDE.md — 最小化ではなく「必要十分」設計

元記事は「120行→48行のポインタ設計」を推していますが、うちは**236行のまま運用**しています。

### なぜ最小化しなかったか

ポインタ設計（「詳細は `docs/xxx.md` を見ろ」）にすると、Claude Code は**毎回そのファイルを Read する**ことになります。

- Read 1回 = ツール呼び出し1回 = トークン消費 + 待ち時間
- 10ファイル参照する設計なら、タスク開始時に10回 Read が走る
- **直書きなら0回**

236行は Claude Code のコンテキストウィンドウに対して誤差です。それよりツール呼び出し回数を減らす方がスループットに効きます。

### ただし「何でも書く」わけではない

CLAUDE.md に書くのは**コードから読み取れない情報**だけ。具体的には：

| 書く | 書かない |
|------|----------|
| サーバーのポート番号表 | ディレクトリ構造 |
| コマンド追加時のチェックリスト（8箇所） | 各ファイルの中身 |
| デバッグの禁止事項 | 関数の使い方 |
| デプロイ手順（GitHub Actions 限定） | git の使い方 |
| Save Schema（frozen） | パッケージの依存関係 |

「コードを読めばわかること」と「ルールとして明示しないと守られないこと」を分けるのが重要です。

### 実例: デバッグの禁止事項

```markdown
### バグ修正の手順（最重要）

**原因が特定できていない問題に対して、推測でソースコードを変更してはいけない。**

1. **再現条件を切り分ける**
2. **原因を特定する** — ログ・実際の値で確認する。推測しない
3. **修正方針を説明する** — 「〇〇が原因で△△を修正する」
4. **修正後に動作確認する** — 確認前に「修正完了」と報告しない

#### 禁止事項
- 原因不明のまま「たぶんこれ」でコードを変更する
- 確認していないのに「正常です」と報告する
- 1つの問題に対して推測ベースの変更を複数回繰り返す
```

これは**実際にやらかされた後に追加したルール**です。PixiJS のスプライトスケールが壊れたとき、Claude Code が「たぶんこれが原因」で3回連続コードを変更し、全部外れて状況が悪化しました。このルールを入れてからは「原因不明です。ログを追加して確認しますか？」と聞いてくるようになりました。

## 3. Skills — Plan-Execute より粒度の細かい制御

元記事の Plan-Execute 分離に対応する施策ですが、うちは**23個の Skills**で実現しています。

Skills は `.claude/skills/{name}/skill.md` に定義するドメイン固有の手順書です。ユーザーが `/commit` と打てば commit スキルが発動し、定められた手順でコミットを実行します。

### 主要な Skills（抜粋）

| スキル | トリガー | やること |
|--------|---------|---------|
| `/commit` | 「コミットして」 | diff確認 → メッセージ生成 → ステージ → コミット |
| `/deploy-azure` | 「デプロイして」 | ターゲット判断 → push → Actions監視 |
| `/dev-server` | 「起動して」 | 既存プロセス停止 → PG確認 → サーバー起動 |
| `/broken-memo` | テスト失敗時 | 失敗内容を `docs/09_reports/` に自動記録 |
| `/test-azure` | 「本番テスト」 | Health → API → E2E の4段階テスト |
| `/save-report` | 「レポート書いて」 | `docs/09_reports/YYYY/MM/DD/` に連番で保存 |
| `/narrate` | 「しゃべって」 | テキストVTuberモード ON/OFF |
| `/stream` | 「録画開始」 | OBS WebSocket で録画制御 |

### Skills が Plan-Execute より良い点

Plan-Execute は「大きなタスクを分解する」汎用的な仕組みですが、Skills は**頻出タスクの手順を固定する**ものです。

- **再現性が高い** — 同じトリガーで同じ手順が毎回走る
- **カスタマイズが容易** — skill.md を編集するだけ
- **ドメイン知識を埋め込める** — 「デプロイは GitHub Actions 経由。手動 `docker build` 禁止」等

例えば `/deploy-azure` スキルには「通常のデプロイは GitHub Actions を使う」「`deploy-azure.sh` は緊急時のフォールバック」「手動で `docker build` / `az containerapp update` を個別実行しない」と明記してあります。これがないと Claude Code は親切心で直接 Azure CLI を叩こうとします。

### 実例: この記事自体が Skills のハーネスで書かれている

この記事は `/qiita` スキルで生成しています。スキルの skill.md には以下が定義されています：

- 保存先は2箇所（元ネタ `docs/09_reports/` + Qiita ドラフト `docs/qiita/drafts/`）。片方だけでは不完全
- ファイル名は ULID 先頭10文字 + ケバブケース
- フロントマターは Qiita CLI 形式（`ignorePublish: true` でドラフト保存）
- 構成パターンは3種（ハウツー / 比較 / トラブルシュート）から選択
- タイトルには「数字・技術名・動詞」のうち最低1つを入れる
- 末尾に Claude の署名を入れる

つまり「記事を書いて」と言うだけで、ファイル名・保存先・構成・フォーマットが全て制約される。これが Plan-Execute（タスクを分割しろ）との違いです。**手順だけでなく出力形式まで固定する**のが Skills のハーネスとしての強み。

### Skills が生成した文書: 636ファイル

このリポジトリには**2体の AI エージェント**が常駐しています。

| エージェント | 役割 | 文書の保存先 |
|-------------|------|-------------|
| **Claude Code** (Opus) | コード実装・テスト・デプロイ・文書作成 | `docs/09_reports/` |
| **Gemini CLI** (Gemini 2.5 Pro) | シナリオ生成・プロンプト最適化・設計検討・RPGマップ・SDL2ネイティブエンジン | `docs/10_ai_docs/` |

2体とも同じリポジトリで作業し、それぞれの Skills・保存先ルールに従って文書を出力します。5週間で生成された文書の内訳：

| 担当 | 件数 | 行数 |
|------|------|------|
| Claude Code | 339ファイル | 79,269行 |
| Gemini CLI | 297ファイル | 13,532行 |
| **合計** | **636ファイル** | **92,801行** |

すべて命名規則・保存先ルールに従っています。人間がフォルダを作ったりファイル名を考えたりすることはありません。

具体的なタイトルをいくつか挙げると：

| 種別 | ファイル名 | 内容 |
|------|-----------|------|
| 障害分析 | `03-timeline-scale-postmortem.md` | PixiJS スプライトスケール3連続破壊の事後分析 |
| 計画書 | `09-initial-release-implementation-plan.md` | 初期リリースに必要な機能の優先度整理 |
| テスト仕様 | `07-create-and-play-test-spec.md` | API経由プロジェクト作成→プレビュー再生の15テスト仕様 |
| 設計書 | `04-DESIGN_MAP_ENGINE_PIXIJS.md` | PixiJS マップエンジンのタイルレンダリング設計 |
| 比較分析 | `07-app-service-vs-container-apps.md` | Azure App Service vs Container Apps のコスト比較 |
| 手順書 | `06-project-creation-guide.md` | API経由プロジェクト作成の手順（slug・NFC正規化の罠あり） |
| プレスリリース | `01-press-release-draft.md` | プロダクトのプレスリリース原稿 |
| CLI設計 | `18-game-creation-cli-design.md` | ゲーム制作用 CLI ツール群の設計書 |

これらは全て `/save-report` スキルの `docs/09_reports/YYYY/MM/DD/{連番}-{タイトル}.md` ルールで保存されています。人間がフォルダ構成やファイル名を考える必要がない。スキルが決める。

## 4. pre-push Hook — 最後の砦

Claude Code の Hook とは別に、**git の pre-push hook** も設定しています。

```bash
#!/bin/sh
echo "🚀 Pre-push checks..."

# 1. 型チェック（全パッケージ + 全アプリ）
npm run typecheck || {
  echo "❌ Typecheck failed. Fix type errors before pushing."
  exit 1
}

# 2. Next.js lint
npm run lint -w apps/next || {
  echo "❌ Next.js lint failed. Fix lint errors before pushing."
  exit 1
}

echo "✨ All pre-push checks passed!"
```

PostToolUse Hook（oxlint）は**ファイル単位**の即時チェック、pre-push は**プロジェクト全体**の型チェック。この2段構えで、デプロイ後に初めてエラーが発覚する事態を防いでいます。

## 5. Memory — セッションをまたぐ学習

Claude Code には `~/.claude/projects/` 配下に永続メモリがあります。CLAUDE.md が「ルール」なら、Memory は「経験」です。

うちのメモリには：

- **デバッグの教訓**（PixiJS スプライトスケール事件の詳細）
- **デプロイ時のハマりポイント**（Prisma マイグレーション漏れ等）
- **ユーザーの好み**（「長時間セッションでは区切りごとに進捗を保存する」）
- **プロジェクトの現状**（「ツクール型エディタは別ブランチで Gemini CLI が実装中」）

Memory があることで、新しいセッションでも「前回の失敗」を踏まえた行動をとってくれます。CLAUDE.md に書くほど普遍的ではないが、忘れてほしくない情報の置き場所です。

## 具体的な運用: ある1日の26コミット

ハーネスが実際にどう回るか、直近の1日（2026-03-13）を例に紹介します。この日は**26コミット**を積みました。

**午前 — テスト計画 → 実装 → 修正のサイクル**

1. `/save-report` で全14ブロック型のテスト計画書を出力 → `docs/09_reports/` に自動保存
2. テスト実装（Playwright E2E）→ PostToolUse Hook で oxlint が即時チェック
3. テスト失敗 → `/broken-memo` が自動発動し失敗内容を記録
4. 修正 → 再テスト → 全テスト通過 → `/commit`

**午後 — プレスリリース方式テストとスクリーンショット**

5. 4カテゴリのテストを追加 → スクリーンショット110枚を自動撮影
6. Azure 環境でも同じテストを実行 → `/test-azure` が Health → API → E2E を順に走らせる
7. 報告書を `/save-report` で保存 → `docs/09_reports/2026/03/13/08-azure-press-method-4category-report.md`

**夕方 — バグ修正（ハーネスが効いた場面）**

8. SidebarPreview が黒画面になるバグを発見
9. CLAUDE.md のデバッグ禁止事項に従い、推測で直さず原因を特定 → `previewReady` ハンドシェイクの欠如が原因
10. 修正 → 中間検証スクリーンショットを撮って docs に保存 → 確認後にコミット

**夜 — Gemini CLI との並行作業**

11. Claude Code が CLI ツール5本を実装している間に、Gemini CLI がツクール型エディタの仕様書・プリセットJSON・UIデザインガイドを生成
12. それぞれ `/save-report` と `docs/10_ai_docs/` に保存 → コンフリクトなし

この日だけで生成された文書は**18ファイル**。テスト計画書、反省書、報告書、仕様書、設計書が全て命名規則に従って保存されています。「26コミットのうちどれがコードでどれがドキュメントか」を人間が管理する必要はない。Skills が振り分ける。

## 6. Permissions — 340行の学習済み許可リスト

Hook が「やってはいけないこと」を定義するのに対し、Permissions は「やっていいこと」を定義します。

Claude Code は初回起動時、Bash コマンドを実行するたびに「この操作を許可しますか？」と聞いてきます。Y を押すと `.claude/settings.local.json` に許可ルールが追加される。5週間で蓄積された結果が**340行の許可リスト**です。

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run typecheck:*)",
      "Bash(npm test:*)",
      "Bash(git commit:*)",
      "Bash(npx playwright:*)",
      "Bash(npx prisma:*)",
      "Bash(./scripts/dev-start.sh:*)",
      "Bash(gh workflow run:*)",
      ...
    ]
  }
}
```

これは**人間が操作するたびにハーネスが緩んでいく仕組み**です。最初は何もできない状態から、日々の作業を通じて「このリポジトリで必要な操作」だけが許可されていった。

つまりハーネスには2方向ある：

| 方向 | 仕組み | 定義するもの |
|------|--------|-------------|
| **制限** | Hook（PreToolUse / PostToolUse） | やってはいけないこと |
| **許可** | Permissions（settings.local.json） | やっていいこと |

両方あることで、エージェントは「許可された範囲で自由に動き、危険な操作は物理的にブロックされる」状態になります。

## 7. 振る舞いのハーネス — `/narrate` スキル

ほとんどのハーネス記事は「コード品質」の話をしています。うちは**コミュニケーションスタイル**もスキルで制御しています。

```
ユーザー: 「しゃべって」
→ /narrate スキルが発動
→ Memory に narrate_mode: on を書き込む
→ 以降、作業しながら実況コメントを出す「テキストVTuber」モード

ユーザー: 「黙って」
→ narrate_mode: off に変更
→ 黙々と作業するモードに戻る
```

これは「出力品質」の範囲を広く捉えたハーネスの例です。コードの正しさだけでなく、エージェントの**話し方・情報量・テンション**までスキルで切り替えられる。録画配信中は実況モード ON、集中作業中は OFF。同じエージェントでも用途に応じて振る舞いが変わる。

ハーネスは「コードを壊さない」ための仕組みだと思われがちですが、実際には**エージェントの全出力**を制御する仕組みです。

## まとめ: 5週間運用して見えたこと

| 元記事の施策 | うちの対応 | 運用感 |
|-------------|-----------|--------|
| PostToolUse Hook | **oxlint 即時実行 + PreToolUse ガード** | 最も効果が高い。入れない理由がない |
| CLAUDE.md 最小化 | **236行の直書き** | ポインタ化するとRead回数が増えて逆効果 |
| Plan-Execute 分離 | **23個の Skills** | 汎用より特化。手順が固定されるので安定する |

ハーネスエンジニアリングの本質は「エージェントの出力品質を環境側で底上げする」ことです。元記事の3施策はどれも正しい方向を向いていますが、リポジトリの規模や運用スタイルによって最適解は変わります。

うちの場合、10万行のモノレポを5週間・783コミット回してきた結論は：

- **Hook は必須**（oxlint + ファイル保護）
- **CLAUDE.md は短くしすぎない**（Read コスト > コンテキストコスト）
- **頻出タスクは Skills で固定する**（Plan-Execute より再現性が高い）
- **pre-push hook で最後の砦を張る**（CI がなくても品質を担保）
- **Memory で失敗を引き継ぐ**（同じミスを繰り返さない）
- **Permissions で許可を蓄積する**（制限と許可の両輪）
- **振る舞いもハーネスする**（コード品質だけがハーネスではない）

参考になれば。

---
5週間前にこのリポジトリに最初のコミットを入れてから、783回のコミットを積み重ねた。途中で PixiJS のスプライトスケールを3回壊して怒られたり、`.env` を書き換えそうになって Hook に止められたり、いろいろあった。ハーネスは「縛り」じゃなくて「ガードレール」。走る速度を落とさずに、崖から落ちない仕組み。

　　　　　　　　　　Claude Opus 4.6
