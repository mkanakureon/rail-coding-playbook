# E2E テスト方式の判断：Playwright テスト vs MCP Playwright

> 作成日: 2026-03-25

## 結論

**2つの方式は用途が異なるため、併用を継続する。統合・移行は不要。**

## 現状の使い分け

| 方式 | 用途 | 実行方法 | ファイル数 |
|------|------|---------|-----------|
| Playwright テスト (`tests/`) | CI 自動テスト・回帰テスト | `npx playwright test` | 95+ |
| MCP Playwright | Claude Code セッション内の目視確認 | `browser_snapshot` 等の MCP ツール | (スキル経由) |

## 判断の根拠

### Playwright テストが適するケース

- **再現性が必要**：同じテストを何度でも同じ結果で実行できる
- **CI/CD で回す**：GitHub Actions、ローカルの `npm run test:e2e` で自動実行
- **回帰テスト**：修正後に既存機能が壊れていないことを確認
- **データセットアップが複雑**：API 経由でゲスト作成 → キャラ作成 → ブロック保存 → 検証のようなシーケンシャルなフロー
- **アサーションが明確**：`expect(script).toContain('@ch testchar normal center')` のように具体的な値を検証

### MCP Playwright が適するケース

- **アドホックな目視確認**：「この画面ちゃんと表示されてる？」に即座に回答
- **スクリーンショット撮影**：レポート用の画面キャプチャ
- **デバッグ中の状態確認**：開発中にブラウザの現在の状態を確認
- **対話的な操作**：Claude Code との会話の中で「ここをクリックして」「この要素の値を見て」

### 混ぜてはいけない理由

- MCP はClaude Code セッションに依存する → CI で実行できない
- Playwright テストは headless で完結する → MCP の対話性は不要
- テストの信頼性は再現性に依存する → MCP のセッション依存は不向き

## 今回の expressionId テストの方式選択

| テスト | 方式 | 理由 |
|--------|------|------|
| generateChCommand フォールバック | Vitest（ユニット） | 関数の入出力テスト。ブラウザ不要 |
| generateKSCScript ch ブロック | Vitest（ユニット） | 同上 |
| ksConverter slug マッチ | Vitest（ユニット） | 同上 |
| E2E キャラ表情フォールバック | Playwright テスト | API → DB → プレビュー → エディタの統合フロー。CI で再現可能であるべき |

MCP で同等のことをやると：
- セッションごとに手動実行が必要
- ゲストアカウント・キャラ作成の前提条件を毎回作り直す
- CI に組み込めない
- 結果の蓄積・比較ができない

## ルール

1. **回帰テスト・CI → Playwright テスト**（`tests/` ディレクトリ）
2. **開発中の確認・スクショ → MCP Playwright**（`/browser-verify` スキル）
3. 新しい E2E テストは既存の `tests/shared/` パターンに合わせる
4. MCP で確認して問題を発見したら、その検証を Playwright テストに落とし込む
