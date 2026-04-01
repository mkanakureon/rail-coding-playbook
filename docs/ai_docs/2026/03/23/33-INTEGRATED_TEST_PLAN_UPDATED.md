# 統合テスト計画書・進捗管理表 (2026-03-23 更新)

> **作成日**: 2026-03-23
> **対象**: filter_mix, アナリティクス, フィードバック API, セキュリティ修正

---

## 1. 現状のテスト進捗サマリー

| カテゴリ | 項目 | 状況 | 検証方法 |
| :--- | :--- | :--- | :--- |
| **Compiler** | `filter_mix` 全 272 ケース | ✅ Pass | Vitest (packages/compiler) |
| **API** | セキュリティ (パス・トラバーサル) | ✅ Pass | Vitest (apps/hono) |
| **API** | 読了アナリティクス ＆ 新着ブースト | 🛠 Testing | Vitest (apps/hono) |
| **API** | 読者リアクション ＆ 読了チップ | 🛠 Testing | Vitest (apps/hono) |
| **UI** | 縦画面アンカー配置 | 🔲 Pending | Playwright E2E |
| **UI** | リアクション送信 UI 連携 | 🔲 Pending | Playwright E2E |

---

## 2. 本日追加されたテスト項目の詳細

### 2-1. コンパイラ層 (packages/compiler)
- **filter_mix**: 2層、3層、4層（最大）の引数パターンを網羅。
- **異常系**: 引数が奇数（強度の省略）の場合のデフォルト挙動、および引数不足時のエラーメッセージを検証。

### 2-2. サーバー層 (apps/hono)
- **analytics/page-view**: 公開作品に対するビーコン送信の正常終了を確認。
- **analytics/reaction**: 同一セッションからの重複リアクションが DB 上で `upsert` により適切に処理（無視または更新）されることを検証。
- **sort=fresh**: `playCount < 50` の作品が正しく抽出され、新着順に並んでいることを検証。

---

## 3. 今後の強化ポイント (Next Actions)

### ① Playwright E2E の拡充
- **読了率計測の検証**: 実際に iframe 内でページを送り、バックエンドの `WorkPageStats` が増えることを end-to-end で確認するテストの追加。
- **動画生成成功の自動検証**: 生成ボタン押下後、mp4 ファイルが `/public/uploads/` に正しく書き出されることを確認。

### ② 負荷シミュレーションテスト
- **ビーコンのスパム送信**: `page-view` API に対して短時間に大量のリクエストを送り、DB の `connection_limit` を超えないか、またはレート制限が機能するかを確認。

---

## 4. テストファイル配置ルール

- **単体テスト**: 各パッケージの `test/` ディレクトリ（Vitest）。
- **統合・UI テスト**: `tests/shared/`（Playwright）。
- **本番環境検証**: `tests/configs/playwright.azure.config.ts` を使用。

---

この計画書に基づき、残りの 🛠 Testing 項目および 🔲 Pending 項目の自動化を順次進めます。
