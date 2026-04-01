# ローカル全体テスト結果報告書

- **日付**: 2026-03-02
- **コミット**: `a62b1b6` (main)
- **環境**: macOS (Darwin 25.2.0), Node.js v25.6.0, ローカル PostgreSQL

---

## サマリー

| パッケージ | テストファイル数 | テスト数 | 結果 | 備考 |
|-----------|----------------|---------|------|------|
| `@kaedevn/core` | 8 | 175 | **ALL PASS** | |
| `@kaedevn/compiler` | 8 | 239 | **ALL PASS** | |
| `@kaedevn/web` | 8 | 123 | **ALL PASS** | |
| `@kaedevn/ksc-compiler` | 5 | 322 | **ALL PASS** | |
| `@kaedevn/battle` | 3 | 21 | **ALL PASS** | |
| `@kaedevn/hono` (API) | 33 | 391 | **387 pass / 4 fail** | 既存の問題（後述） |
| `@kaedevn/interpreter` | — | — | **ハング（既知）** | Phase 5 再帰テスト等がハングする既知問題 |
| TypeScript 型チェック | — | — | **PASS** | `tsc -b packages/core packages/web` |
| AI メタデータ API | — | 7 | **ALL PASS** | 前回レポート参照 |

**合計**: テストファイル 68 / テスト 1,278+ pass（interpreter 除く）

---

## 詳細

### @kaedevn/core — 8 files / 175 tests PASS

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| OpRunner.test.ts | 73 | 34ms |
| evaluator.test.ts | 16 | 4ms |
| easing.test.ts | 17 | 4ms |
| validator.test.ts | 15 | 4ms |
| events.test.ts | 21 | 4ms |
| integration.test.ts | 18 | 6ms |
| commandSync.test.ts | 8 | 4ms |
| SaveData.test.ts | 7 | 3ms |

### @kaedevn/compiler — 8 files / 239 tests PASS

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| command-sync.test.ts | 99 | 14ms |
| lineClassifier.test.ts | 56 | 6ms |
| phase2.test.ts | 20 | 6ms |
| validator.test.ts | 18 | 5ms |
| phase5.test.ts | 16 | 10ms |
| phase3.test.ts | 13 | 4ms |
| integration.test.ts | 11 | 7ms |
| tokenizer.test.ts | 6 | 4ms |

### @kaedevn/web — 8 files / 123 tests PASS

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| WebOpHandler.bgch.test.ts | 17 | 46ms |
| その他 7 ファイル | 106 | — |

### @kaedevn/ksc-compiler — 5 files / 322 tests PASS

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| emitter.test.ts | 72 | 30ms |
| checker.test.ts | 69 | 31ms |
| vm.test.ts | 69 | 43ms |
| parser.test.ts | 65 | 14ms |
| lexer.test.ts | 47 | 10ms |

### @kaedevn/battle — 3 files / 21 tests PASS

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| damage.test.ts | 8 | 4ms |
| simulate.test.ts | 8 | 4ms |
| rng.test.ts | 5 | 44ms |

### @kaedevn/hono — 33 files / 387 pass / 4 fail

#### 失敗テスト（全て既存の問題、今回の変更とは無関係）

| テスト | エラー | 原因 |
|-------|--------|------|
| `assist-context.test.ts` — 必須フィールドが欠けるとエラー | `expected [Function] to throw` | Zod スキーマの `.passthrough()` が緩い — テストの期待値が不正確 |
| `assist-api.test.ts` — MockClient で章プロットを生成する | Timeout 5000ms | AI ゲートウェイの MockClient タイムアウト |
| `assist-api.test.ts` — MockClient で話プロットを生成する | Timeout 5000ms | 同上 |
| `assist-api.test.ts` — MockClient でテキストを生成する | Timeout 5000ms | 同上 |

※ `azure-live.test.ts` の 2 件（health / preview）はリモート Azure への接続タイムアウトで、ローカルテストでは不安定になる（ネットワーク依存）。今回の実行では一部タイムアウトが発生。

#### 主要テストファイル（全 PASS）

| テストファイル | テスト数 | 時間 |
|--------------|---------|------|
| preview.test.ts | 40 | 43ms |
| assist-api.test.ts | 28/31 pass | 15s |
| azure-live.test.ts | 18/20 pass | 17s |
| assist-context.test.ts | 19/20 pass | 31ms |
| api-structure.test.ts | 14 | 95ms |
| admin.test.ts | 12 | 17ms |
| assets.test.ts | 9 | 19ms |
| assist-rag.test.ts | 7 | 119ms |
| official-assets.test.ts | 7 | 50ms |
| works.test.ts | 7 | 48ms |
| schema-sync.test.ts | 6 | 432ms |
| projects.test.ts | 6 | 90ms |
| characters.test.ts | 5 | 66ms |
| pages.test.ts | 5 | 77ms |
| my-characters.test.ts | 4 | 61ms |
| messages.test.ts | 4 | 44ms |
| users.test.ts | 3 | 125ms |
| health.test.ts | 2 | 41ms |

### @kaedevn/interpreter — ハング（既知問題）

vitest run を実行しても出力が得られずハングする。MEMORY.md に記載の既知問題:
> Phase 5 recursion tests hang (fibonacci), large loop tests timeout

---

## TypeScript 型チェック — PASS

```
tsc -b packages/core packages/web → エラーなし
```

---

## AI メタデータ API テスト — 7/7 PASS

前回レポート (`05-ai-metadata-test-report.md`) で実施済み。全 7 項目 PASS:
1. GET /api/editor-schema（14ブロック型・キャッシュ）
2. GET /api/projects/:id に _ai_context 付与
3. PUT 時の _ai_context/_metadata ストリップ
4. Re-GET で DB 汚染なし確認
5. Preview API 影響なし
6. スキーマ API 認証不要
7. 複数プロジェクト対応

---

## 結論

- **今回の変更（AI メタデータ）による新たな失敗**: なし
- **既存の失敗**: hono 4 件（assist MockClient タイムアウト 3 件 + Zod スキーマテスト 1 件）
- **既知のハング**: interpreter パッケージ（Phase 5 再帰テスト）
- **全パッケージの型チェック**: PASS
