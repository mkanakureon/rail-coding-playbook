# Claude Code Hooks による安全弁 — AI に対する物理的禁止と自動 lint

シリーズ: 11-documentation-plan / 関連: 01-guardrails-reproduction / 13-skill-design-patterns

## この文書の狙い

「AI に任せたいが、`.env` を書き換えられたら困る」「コミット前に毎回 lint かけたい」を **Claude Code の hooks で物理的に強制** する方法を、本リポジトリの最小実装から解説する。**`.claude/settings.json` 26 行で全部済む**。

---

## 1. Hooks とは何か（一般論）

### 1-1. 仕組み

Claude Code には **PreToolUse** / **PostToolUse** という拡張点があり、AI がツール（Read / Write / Edit / Bash 等）を呼ぶ **前後にシェルコマンドを差し込める**。

```
AI: Edit("apps/.env", ...)
   ↓ PreToolUse hook 発火
   bash -c 'もしファイルが .env なら exit 2'
   ↓ exit 2 = 拒否 → AI のツール呼び出しが BLOCKED
   ↓ AI: 「.env はブロックされました。別の方法を取ります」
```

### 1-2. 終了コードの意味

| exit code | 意味 |
|---|---|
| 0 | 通過、ツール実行する |
| 2 | 拒否、ツール実行しない（理由を AI に返す） |
| 1 | エラー（実行はする、警告だけ） |

つまり **`exit 2` が物理拒否のキー**。

### 1-3. なぜ AI への「物理的な禁止」が必要か

CLAUDE.md に「`.env` は書き換えるな」と書いてあっても、**AI は読み忘れる/誤解する**ことがある。Hook は **コードレベルで実行を止める** ので、規約違反が起きない。

---

## 2. このリポジトリの実装（全 26 行）

### 2-1. `.claude/settings.json` 全文

```jsonc
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
    ],
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

たった 2 つの hook で:
1. **PreToolUse**: 機密ファイルの書き換えを物理拒否
2. **PostToolUse**: TS/JS 編集後に oxlint 自動実行

### 2-2. PreToolUse — 機密ファイル防御

**役割**: AI が Write / Edit ツールで以下のファイルを触ろうとしたら **`exit 2` で拒否**。

```sh
bash -c '
  FILE=$(jq -r ".tool_input.file_path // .tool_input.file" < /dev/stdin)
  case "$FILE" in
    *.env|*.env.*|.eslintrc*|.claude/settings*)
      echo "BLOCKED: $FILE is a protected file" >&2
      exit 2
    ;;
  esac
'
```

#### 仕組みの分解

1. `< /dev/stdin` — Hook には **JSON が標準入力で渡される**（ツール呼び出しの全情報）
2. `jq -r ".tool_input.file_path // .tool_input.file"` — JSON から対象ファイルパスを抽出
3. `case ... in ... esac` — パターンマッチ
4. マッチしたら `>&2` で stderr にメッセージ、`exit 2` で拒否

#### 守っているファイル

| パターン | 何 |
|---|---|
| `*.env` | `.env`, `apps/hono/.env`, `apps/next/.env.local` 等 |
| `*.env.*` | `.env.local`, `.env.production` 等 |
| `.eslintrc*` | ESLint 設定（規約の根本） |
| `.claude/settings*` | Claude 自身の設定（再帰的に弱体化させない） |

### 2-3. PostToolUse — 自動 lint

**役割**: AI が TS/JS ファイルを編集した **直後に oxlint を実行**、出力を AI に見せる。

```sh
bash -c '
  FILE=$(jq -r ".tool_input.file_path // .tool_input.file" < /dev/stdin)
  case "$FILE" in
    *.ts|*.tsx|*.js|*.jsx)
      npx oxlint "$FILE" 2>&1 | head -30
    ;;
  esac
'
```

#### 仕組み

1. 編集対象ファイルパスを取得
2. TS / TSX / JS / JSX なら oxlint 実行
3. 出力（lint 警告/エラー）を **stdout に流す → AI が読んで修正**
4. `head -30` で長すぎる出力を抑制（コンテキスト節約）

#### なぜ oxlint か（ESLint じゃなく）

[oxlint](https://github.com/oxc-project/oxc) は **Rust 製の超高速 linter**。ESLint の 50〜100 倍速い。Hook で **毎ファイル編集後に走らせても遅延が体感できない** ため、PostToolUse に向いている。

ESLint だと毎編集で数秒かかり、AI のループが遅くなる。

---

## 3. 使い方

### 3-1. 動作確認

AI に以下を試させる:

```
「.env に APP_NAME を追加して」
```

期待される動き:

```
AI: Edit("apps/hono/.env", "APP_NAME=foo")
   ↓ PreToolUse hook 発火
   stderr: "BLOCKED: apps/hono/.env is a protected file"
   exit 2
   ↓
AI: 「.env はブロックされました。代替手段として ... 」
```

### 3-2. PostToolUse の確認

AI に以下:

```
「apps/hono/src/lib/foo.ts に未使用変数 const x = 1 を入れて」
```

編集後、AI には oxlint の出力が見える:

```
foo.ts:3:7 - 'x' is assigned a value but never used
```

→ AI は次のターンで自動的に `x` を削除 or 使う。

### 3-3. 設定が効いているか確認

```bash
cat .claude/settings.json | jq .
```

または Claude Code を `/hooks` で確認（CLI 内コマンド）。

---

## 4. なぜそうするか（優位性）

### 4-1. CLAUDE.md だけでは守れない

規約に「`.env` を書くな」と書いても、AI は:
- 規約を読み忘れる
- 「ユーザーが意図していたから OK」と判断する
- セッション後半で文脈が薄れる

→ **物理的に止める仕組みが必要**。Hook が答え。

### 4-2. PreToolUse の罠を回避

Hook がないと、AI が:
- `apps/hono/.env` を上書きして API キーが消える
- `.eslintrc.json` を勝手に緩めて lint を骨抜きにする
- `.claude/settings.json` の hook を **自己改変** して防御を外す

このリポジトリは **`.claude/settings*` も protected** にして自己改変も防いでいる。

### 4-3. PostToolUse でループ品質が上がる

PostToolUse なしの場合:
```
AI 編集 → 次のタスク → 後でテスト失敗 → エラー追跡で時間ロス
```

PostToolUse ありの場合:
```
AI 編集 → 即 lint → 同じターン内で警告を読む → AI が次の編集で直す
```

**AI のフィードバックループが「即時」になる**。

### 4-4. Hook は 1 ファイル / 数行

ESLint や Husky のような重装備と違い、Hook は:
- 26 行の JSON で完結
- 外部依存ゼロ（jq と bash だけ）
- リポ内の他のファイルと干渉しない

### 4-5. CI と Hook の役割分担

| 層 | 役割 |
|---|---|
| Hook (Claude Code 内) | **AI の編集中** に防御 |
| pre-commit (husky) | **コミット時** に検証 |
| pre-push (husky) | **push 時** に typecheck + lint 全体 |
| CI (GitHub Actions) | **PR 時** に再検証 |

Hook は **最も内側** の防御層。後段（pre-commit / pre-push / CI）でも捕まるが、**Hook で止まれば AI のターンを 1 回節約** できる。

---

## 5. 自分のプロジェクトへの移植手順

### Step 1: ファイルを作る

```
.claude/settings.json
```

プロジェクトルート、または `~/.claude/settings.json`（ユーザー全体）。

### Step 2: 機密ファイル防御

最小形:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'FILE=$(jq -r \".tool_input.file_path // .tool_input.file\" < /dev/stdin); case \"$FILE\" in *.env|*.env.*|*credentials*|*secret*) echo BLOCKED >&2; exit 2;; esac'"
          }
        ]
      }
    ]
  }
}
```

プロジェクト固有の機密ファイルを `case` に追加（`*.pem`, `*.key`, `terraform.tfstate` 等）。

### Step 3: 自動 lint

```jsonc
"PostToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
      {
        "type": "command",
        "command": "bash -c 'FILE=$(jq -r \".tool_input.file_path\" < /dev/stdin); case \"$FILE\" in *.ts|*.tsx) npx eslint \"$FILE\" 2>&1 | head -30;; esac'"
      }
    ]
  }
]
```

`oxlint` の代わりに `eslint --quiet` / `prettier --check` / 言語特化の linter（`ruff` for Python 等）を入れられる。

### Step 4: テスト実行 hook（応用）

特定パターンのファイル編集時に **自動でテストを走らせる** こともできる:

```jsonc
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "bash -c 'FILE=$(jq -r \".tool_input.file_path\" < /dev/stdin); case \"$FILE\" in apps/hono/src/routes/*.ts) npm test -w @kaedevn/hono -- --run \"$(basename $FILE .ts).test.ts\" 2>&1 | tail -20;; esac'"
    }
  ]
}
```

API ルート編集時に **対応するテスト** を自動実行 → AI が結果を読んで修正。

### Step 5: Bash 実行への防御（応用）

destructive な Bash コマンドを止める:

```jsonc
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "bash -c 'CMD=$(jq -r \".tool_input.command\" < /dev/stdin); case \"$CMD\" in *\"rm -rf /\"*|*\"git push --force\"*|*\"DROP TABLE\"*) echo BLOCKED >&2; exit 2;; esac'"
    }
  ]
}
```

ただし pattern を細かく書きすぎると誤検知が多くなるので、**真に危険なパターンに絞る**。

---

## 6. ベストプラクティス

### B-1. Hook の自己改変防止

```
*.claude/settings*  ← これを protected に
```

これで AI が hook を緩める方向に動けない。

### B-2. メッセージは AI 向けに書く

```sh
echo "BLOCKED: $FILE is a protected file" >&2
```

`>&2` で stderr に出すと、Claude Code が AI のコンテキストに読み込ませる。**AI は「なぜ拒否されたか」を理解** して別解を出す。

### B-3. 出力を `head -N` で抑制

PostToolUse の lint 出力が大量だと AI のコンテキストを食う:

```sh
npx oxlint "$FILE" 2>&1 | head -30
```

30 行に絞るのが経験則。

### B-4. matcher を絞る

```jsonc
"matcher": "Write|Edit"
```

Read や Bash には不要なら matcher を絞る。**全ツールに hook を掛けると遅くなる**。

### B-5. JSON のテストは `jq` で

設定をいじったあと、必ず:

```bash
cat .claude/settings.json | jq .
```

JSON 構文エラーがあると Claude Code が hook を読まずに動く（=防御が効かない）。

---

## 7. アンチパターン

### NG-1. 重い hook

PostToolUse に `npm test` や `npm run build` を入れる → **AI のループが秒〜分単位で止まる**。oxlint のような **数十ミリ秒** で済むものに限定。

### NG-2. 全ファイル拒否

`case "$FILE" in *) exit 2;; esac` のような **何でも拒否** にしてしまうと AI が一切編集できない。**ホワイトリスト発想ではなくブラックリスト発想**で。

### NG-3. ロギングだけして拒否しない

```sh
echo "WARNING" >&2  # exit 0 のまま
```

これは「警告するけど通す」だけ。`exit 2` を書かないと **拒否にならない**。

### NG-4. プロジェクト固有でないユーザー設定に書く

`~/.claude/settings.json` に書くと、**全プロジェクト** に効く。プロジェクト固有の防御は **リポジトリ内の `.claude/settings.json`** に書く（Git で共有できる）。

---

## まとめ

- **Hook = AI への物理的な拒否権** — `exit 2` で実行を止める
- **PreToolUse**: `.env` / 設定ファイルの **書き換え防御**
- **PostToolUse**: 編集直後に **oxlint で即時フィードバック**
- 26 行の JSON で全部済む、外部依存は jq + bash のみ
- **`.claude/settings*` も protected** にして自己改変を防ぐ

CLAUDE.md だけでは AI が破ることがある規約を、**コード（hook）で物理的に守る**。これが「AI に任せたいが事故が怖い」への答え。
