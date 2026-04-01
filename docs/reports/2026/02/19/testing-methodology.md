# Claude Code のテスト方法と仕組み

## 結論（先に要点）

| 質問 | 回答 |
|------|------|
| テストコードは毎回新規作成？ | **両方ある**。既存テストがあれば実行、なければその場で新規作成 |
| 結果はどう取得？ | Bash ツールでコマンド実行し、**stdout/stderr を直接読む** |
| 合否判定は？ | テストランナーの**終了コードとコンソール出力**を Claude が読んで判断 |

---

## 1. テストの2つのカテゴリ

### A. 事前に作成済みのテスト（既存テスト）

プロジェクトに既にコミットされているテストファイル。Claude Code は `npm test` や `npx vitest` 等で**実行するだけ**。

#### ユニットテスト（Vitest）

```
packages/compiler/test/
  ├── tokenizer.test.ts     # トークナイザーのテスト
  ├── phase2.test.ts         # パーサーのテスト
  ├── phase3.test.ts         # コード生成のテスト
  ├── phase5.test.ts         # 高度な機能テスト
  ├── validator.test.ts      # バリデーションテスト
  └── integration.test.ts    # 統合テスト

packages/interpreter/test/
  ├── Parser.test.ts
  ├── Interpreter.test.ts
  ├── Phase2〜Phase6.test.ts
  ├── ErrorHandling.test.ts
  ├── Debug.test.ts
  ├── Integration.test.ts
  └── IntegrationSimple.test.ts

packages/core/src/events/__tests__/
  └── events.test.ts
```

**実行方法:**
```bash
# パッケージ単位で実行
npm test -w @kaedevn/compiler    # → vitest
npm test -w @kaedevn/interpreter # → vitest
```

#### E2Eテスト（Playwright）

```
tests/
  ├── admin-panel.spec.ts           # 管理画面テスト
  ├── editor-blocks.spec.ts         # エディタブロック機能
  ├── auth-flow.spec.ts             # 認証フローテスト
  ├── mypage-tabs.spec.ts           # マイページタブ
  ├── full-flow.spec.ts             # 全体フロー
  └── ... (35+ ファイル)
```

**実行方法:**
```bash
npx playwright test                    # 全テスト
npx playwright test tests/admin-panel  # 特定ファイル
```

### B. Claude Code がその場で新規作成するテスト

新機能実装時やバグ修正時に、**検証のためにその場でテストコードを書く**ことがある。

**典型的なケース:**
1. 新しいコンポーネント/APIを実装した → 動作確認用の Playwright テストを作成
2. バグ報告を受けた → 再現テストを作成してから修正
3. ユーザーが「テストも書いて」と依頼した

**つまり「毎回その場で作っている」わけではなく、必要に応じて作成する。既存テストがあればそれを使う。**

---

## 2. テスト結果の取得方法

Claude Code は **Bash ツール** を使ってテストコマンドを実行する。結果は以下の流れで取得される:

```
┌─────────────────────────────────────────────────┐
│ Claude Code                                     │
│                                                 │
│  1. Bash ツールで実行                            │
│     → npx vitest run                            │
│     → npx playwright test                       │
│                                                 │
│  2. stdout / stderr を受け取る                   │
│     → テスト結果のテキスト出力                    │
│     → 終了コード (0=成功, 1=失敗)               │
│                                                 │
│  3. 出力テキストを読んで判断                     │
│     → "X tests passed" → 成功                   │
│     → "FAIL" / "Error" → 失敗                   │
│     → エラーメッセージから原因を特定             │
│                                                 │
│  4. 失敗時はコードを修正して再実行               │
└─────────────────────────────────────────────────┘
```

### 具体例: Vitest の場合

```bash
$ npm test -w @kaedevn/compiler

 ✓ test/tokenizer.test.ts (15 tests) 12ms
 ✓ test/phase2.test.ts (8 tests) 5ms
 ✓ test/integration.test.ts (6 tests) 8ms

 Test Files  3 passed (3)
      Tests  29 passed (29)
```

Claude Code はこの出力テキストを読んで:
- `29 passed` → 全テスト合格と判断
- `failed` が含まれていれば → 失敗箇所を特定して修正

### 具体例: Playwright の場合

```bash
$ npx playwright test tests/admin-panel.spec.ts

Running 13 tests using 1 worker

  ✓ 管理画面 > アクセス制御 > 一般ユーザーは管理画面にアクセスできない (2.1s)
  ✓ 管理画面 > ダッシュボード > 統計カードが表示される (1.8s)
  ✗ 管理画面 > ユーザー管理 > ユーザー一覧が表示される (5.0s)
     Error: expect(received).toBeVisible()
```

Claude Code はこの出力を読んで:
- どのテストが失敗したか
- エラーメッセージの内容
- 必要なら `test-results/` のスクリーンショットやトレースを確認

---

## 3. 判定の仕組み（自動ではなくAIが読む）

重要な点: **Claude Code は機械的にexit codeだけを見ているわけではない**。

テストランナーの出力テキスト全体を「読んで理解」している:

| 出力パターン | Claude Code の判断 |
|------------|-------------------|
| `Tests: 29 passed (29)` | 全テスト成功 |
| `1 failed, 28 passed` | 1件失敗 → エラー内容を分析 |
| `TypeError: Cannot read...` | ランタイムエラー → コードのバグ |
| `Timeout exceeded` | タイムアウト → サーバー未起動 or セレクタ間違い |
| `ECONNREFUSED` | サーバーに接続できない → 起動確認が必要 |

つまり人間がターミナルの出力を読んで判断するのと同じことを Claude が行っている。

---

## 4. テストフレームワーク構成

```
kaedevn-monorepo/
├── playwright.config.ts          # E2Eテスト設定（Chromium）
├── tests/                        # Playwright E2Eテスト (35+ ファイル)
│
├── packages/compiler/
│   ├── vitest.config.ts          # ユニットテスト設定
│   └── test/                     # Vitest テスト (6 ファイル)
│
├── packages/interpreter/
│   ├── vitest.config.ts          # ユニットテスト設定（推定）
│   └── test/                     # Vitest テスト (11 ファイル)
│
├── packages/core/
│   ├── vitest.config.ts          # ユニットテスト設定
│   └── src/events/__tests__/     # Vitest テスト
│
└── apps/hono/
    └── vitest.config.ts          # APIユニットテスト設定
```

| フレームワーク | 用途 | 設定ファイル |
|--------------|------|-------------|
| **Vitest** | ユニットテスト（ロジック検証） | `vitest.config.ts` |
| **Playwright** | E2Eテスト（ブラウザ操作） | `playwright.config.ts` |

---

## 5. よく使うテストコマンド一覧

```bash
# ユニットテスト
npm test -w @kaedevn/compiler        # compiler パッケージ
npm test -w @kaedevn/interpreter     # interpreter パッケージ

# E2Eテスト（事前にサーバー起動が必要）
npx playwright test                            # 全 E2E テスト
npx playwright test tests/admin-panel.spec.ts  # 特定ファイル
npx playwright test --ui                       # UI モードで実行

# 型チェック
npm run typecheck
```

---

## 6. まとめ: Claude Code のテストワークフロー

```
ユーザーの依頼
    │
    ▼
既存テストがある？ ──Yes──→ そのまま実行
    │
    No
    │
    ▼
テストが必要？
    │
    ├─ 新機能 → テストコードを新規作成して実行
    ├─ バグ修正 → 再現テストを作成 → 修正 → テスト通過を確認
    └─ 小さな変更 → テストなしで進めることもある

    │
    ▼
Bash ツールでテストコマンド実行
    │
    ▼
stdout を読んで結果を判断
    │
    ├─ 全パス → 完了報告
    └─ 失敗あり → 原因分析 → コード修正 → 再実行（ループ）
```
