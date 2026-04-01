# CLI 設計・実装ガイド

本プロジェクトの CLI ツールの設計思想と作り方をまとめる。
今後 CLI を追加するとき、および E2E テストを CLI で書くときの指針。

---

## 1. 設計思想

### CLI の役割

```
人間（ブラウザ GUI）  →  JSON / API  ←  Claude Code（CLI）
```

- **GUI と CLI は同じデータを操作する**。GUI 専用のデータは作らない
- CLI は「JSON / API の薄いラッパー」。データ操作のロジックは CLI に閉じない
- CLI の出力は **人間可読** かつ **スクリプトで解析可能** にする

### 2つのパターン

| パターン | データ保存先 | 例 |
|---------|------------|-----|
| **ファイルベース** | ローカル JSON | `map-cli.mjs`（maps/*.json を直接読み書き） |
| **API ラッパー** | PostgreSQL（API 経由） | `editor-cli.mjs`（localhost:8080/api を叩く） |

**どちらを選ぶか:**
- git 管理したい、大きなデータ → ファイルベース
- 認証・共有・リアルタイム同期が必要 → API ラッパー
- 迷ったらファイルベース（シンプル、オフラインで動く）

---

## 2. CLI の構造パターン

### 基本構造

```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

// --- ヘルパー ---
function loadData(id) { ... }
function saveData(id, data) { ... }
function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      opts[args[i].slice(2)] = args[i + 1] ?? true;
      i++;
    }
  }
  return opts;
}

// --- コマンド ---
function cmdList() { ... }
function cmdShow(id) { ... }
function cmdCreate(id, opts) { ... }
function cmdUpdate(id, opts) { ... }
function cmdDelete(id) { ... }
function cmdValidate(id) { ... }

// --- Main ---
const [,, cmd, ...rest] = process.argv;
const opts = parseArgs(rest);

switch (cmd) {
  case "list":     cmdList(); break;
  case "show":     cmdShow(rest[0]); break;
  case "create":   cmdCreate(rest[0], opts); break;
  // ...
  default:         console.log("Usage: ..."); break;
}
```

### 命名規則

| 種類 | パターン | 例 |
|------|---------|-----|
| 一覧 | `list` | マップ一覧 |
| 詳細 | `show <id>` | マップ詳細 |
| 作成 | `create <id> [--opts]` | マップ作成 |
| 更新 | `update <id> [--opts]` / `set-<prop>` | プロパティ変更 |
| 削除 | `remove <id>` / `remove-<type> <parentId> <childId>` | イベント削除 |
| 検証 | `validate <id>` | バリデーション |
| 生成 | `gen-<type>` | gen-layer, gen-collision |
| 外部連携 | `render` / `edit` | PNG出力, GUIを開く |

### 出力ルール

- **成功時**: 結果を stdout に出力。`Saved:`, `Created:`, `OK:` 等のプレフィックス
- **エラー時**: `ERROR:` プレフィックスで stderr に出力、`process.exit(1)`
- **一覧表示**: 1行1項目。`id: label (details)` 形式
- **JSON が必要な場合**: `--json` フラグで JSON 出力に切替（将来対応可）

### 引数ルール

- 必須引数は位置引数: `cmd <id>`
- オプションは `--key value` 形式
- stdin 入力が必要な場合は `readFileSync(0, "utf-8")` で読む

---

## 3. E2E テストの書き方

### テストの考え方

```
CLI コマンド実行 → ファイル/DB 確認 → レンダリング結果を画像で確認
```

- **テスト用データは自動生成・自動削除**（既存データを汚さない）
- **実際の CLI コマンドを `execSync` で実行**（関数を直接呼ばない）
- **画像出力で最終確認**（目視 or ファイルサイズ + ヘッダチェック）

### テストスクリプトの構造

```javascript
#!/usr/bin/env node
import { execSync } from "child_process";
import { existsSync, unlinkSync, readFileSync } from "fs";

const cleanupFiles = [];
let passed = 0, failed = 0;

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", cwd: ROOT, ...opts }).trim();
}

function assert(condition, msg) {
  if (condition) { console.log(`  PASS: ${msg}`); passed++; }
  else { console.error(`  FAIL: ${msg}`); failed++; }
}

function cleanup() {
  for (const f of cleanupFiles) {
    try { if (existsSync(f)) unlinkSync(f); } catch {}
  }
}

// テスト実行
console.log("1. create");
run(`node cli.mjs create test-id --name "test"`);
assert(existsSync("test-id.json"), "file created");
cleanupFiles.push("test-id.json");

// 最後にクリーンアップ
cleanup();
process.exit(failed > 0 ? 1 : 0);
```

### テストで確認すべきこと

| レベル | 確認内容 | 方法 |
|--------|---------|------|
| **データ** | JSON の値が正しいか | `readFileSync` → `JSON.parse` → assert |
| **構造** | ファイルが生成されたか | `existsSync` |
| **整合性** | バリデーションが通るか | `validate` コマンド実行 |
| **描画** | 画像が正しく出力されるか | PNG ヘッダ + ファイルサイズ or 目視 |
| **エラー** | 不正入力でエラーになるか | `expectFail` オプション付きで実行 |

### テストの命名

```
scripts/test-<対象>-e2e.mjs
```

例:
- `scripts/test-map-cli-e2e.mjs` — マップ CLI のE2Eテスト
- `scripts/test-editor-cli-e2e.mjs` — ブロックエディタ CLI のE2Eテスト（要サーバ起動）
- `scripts/test-ksc-cli-e2e.mjs` — KSC コンパイラ CLI のE2Eテスト

---

## 4. 新しい CLI を作るときのチェックリスト

1. **データモデルを確認**
   - 操作対象の JSON / API の構造を把握
   - 型定義があれば `packages/*/src/types.ts` を確認

2. **コマンド設計**
   - CRUD + validate + 生成系を洗い出す
   - `parseArgs` で `--key value` を処理

3. **実装**
   - `scripts/<name>-cli.mjs` に作成
   - ヘルパー（load/save/parseArgs）→ コマンド関数 → switch 文

4. **Skill 定義**
   - `.claude/skills/<name>/skill.md` を作成
   - トリガー、ワークフロー、コマンドリファレンス

5. **E2E テスト**
   - `scripts/test-<name>-cli-e2e.mjs` を作成
   - テスト用データの生成 → 各コマンド実行 → 検証 → クリーンアップ
   - 画像出力がある場合は PNG 確認も含める

6. **ドキュメント更新**
   - ヘルプ出力（`default` case）にコマンド一覧を記載
   - Skill の md にコマンドリファレンスを追加

---

## 5. 既存 CLI 一覧

| CLI | ファイル | パターン | Skill | E2E テスト |
|-----|---------|---------|-------|-----------|
| マップ CLI | `scripts/map-cli.mjs` | ファイルベース | `/map` | `test-map-cli-e2e.mjs` (62テスト) |
| ブロックエディタ CLI | `scripts/editor-cli.mjs` | API ラッパー | `/edit-blocks` | 未作成（要サーバ起動） |

### 今後追加候補

| CLI | 用途 | パターン |
|-----|------|---------|
| KSC CLI | スクリプトコンパイル・検証 | ファイルベース |
| アセット CLI | 画像/音声アセット管理 | ファイルベース or API |
| キャラクター CLI | キャラクター・表情管理 | API ラッパー |
| プロジェクト CLI | プロジェクト管理（作成/一覧/削除） | API ラッパー |

---

*作成: Claude Code (Claude Opus 4.6) -- 2026-03-07*
