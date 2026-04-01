# テスト報告書 — 2026年4月1日

> 実行時刻: 12:22 / トリガー: useEditorStore テスト追加・ウォレットプラン変更・動画パイプライン監査

## 変更内容

- `apps/editor/test/store.test.ts` — Undo/Redo・ダーティ判定・変数収集等 25テスト追加
- `apps/hono/src/routes/wallet.ts` — trial → tiny/small プラン分割
- `apps/next/` — ウォレット UI・API クライアントのプラン変更追従
- `packages/core/` — ARCHITECTURE.md 追加（コード変更なし）
- `docs/` — 監査レポート・テスト分析文書追加

## テスト判定

| ワークスペース | 判定理由 | 実行 |
|--------------|---------|------|
| apps/editor | store.test.ts に25テスト追加 | ✅ |
| @kaedevn/hono | wallet.ts のプラン変更 | ✅ |
| @kaedevn/core | ARCHITECTURE.md のみだが念のため | ✅ |
| @kaedevn/next | api.ts・wallet/page.tsx のプラン変更 | ✅ |

## テスト結果

| ワークスペース | passed | failed | skipped | 結果 |
|--------------|--------|--------|---------|------|
| apps/editor | 310 | 0 | 0 | ✅ |
| @kaedevn/hono | 494 | 0 | 116 | ✅ |
| @kaedevn/core | 216 | 0 | 1 | ✅ |
| @kaedevn/next | 28 | 0 | 0 | ✅ |
| **合計** | **1,048** | **0** | **117** | **✅** |

## 失敗詳細

なし

## スキップされたテスト（既知）

- `@kaedevn/hono`: assist 系テスト 116件（AI アシスタント機能、外部 API 依存のためスキップ）
- `@kaedevn/core`: commandSync 1件（`COMMAND_PARSERS の全キーが COMMAND_DEFINITIONS に存在する`）

## 総合判定

✅ 全テスト通過（1,048 passed / 0 failed / 117 skipped）
