# 壊れている箇所メモ

作成日: 2026-03-08
随時追加する。

## 検証結果サマリー（2026-03-08）

| Phase | 内容 | 結果 | 備考 |
|-------|------|------|------|
| 1 | 静的検証（旧パス残存チェック） | ✅ | e2e.sh コメント内の旧パス修正済み |
| 2 | typecheck + lint | ✅ | エラーなし |
| 3 | ユニットテスト | ✅ | 175 passed（7 failures 修正済み） |
| 4-1 | husky pre-commit | ✅ | コミット時に正常動作確認 |
| 4-3 | CLI ヘルプ表示 | ✅ | block / map 両方 OK |
| 4-4 | Playwright config テスト検出 | ✅ | local 237件 / azure 298件 |
| 5 | E2E テスト（要サーバー起動） | 未実施 | |
| 6 | スキル参照確認 | ✅ | 7スキル全て新パス |

---

## 1. packages/core ユニットテスト — ✅ 修正済み

### OpRunner.test.ts（6 failures → 修正済み）

**原因**: bgSet/chSet/overlaySet に x,y,s 引数が追加されたが、テストの `toHaveBeenCalledWith` が旧引数のまま。
**修正**: テストの expect に `undefined` 引数を追加して実シグネチャと一致させた。

### commandSync.test.ts（1 failure → 修正済み）

**原因**: `camera` コマンドが COMMAND_PARSERS に存在するが COMMAND_DEFINITIONS に未登録。
**修正**: `commandDefinitions.ts` に camera 定義を追加 + テストの validMethods と期待数を更新。

---
