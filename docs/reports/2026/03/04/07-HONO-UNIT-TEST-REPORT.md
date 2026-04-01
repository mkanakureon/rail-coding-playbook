# Hono API ユニットテスト レポート

**日付**: 2026-03-04
**ブランチ**: main
**実行環境**: macOS (ローカル), Vitest v4.0.18

---

## 1. 総合結果

| 項目 | 値 |
|------|-----|
| テストファイル数 | 47 |
| PASS ファイル数 | 46 |
| FAIL ファイル数 | 1 (CLI E2E — ETIMEDOUT, 環境依存) |
| テスト総数 | 513 |
| PASS | 475 |
| SKIP | 38 (CLI E2E の beforeAll タイムアウトによる自動スキップ) |
| FAIL | 0 |
| 実行時間 | 約 181 秒 |

## 2. 新規作成テスト（13 ファイル / 129 テスト）

### 2.1 ルートテスト（3 ファイル）

| ファイル | テスト数 | 対象 |
|---------|---------|------|
| `test/editor-schema.test.ts` | 6 | GET /api/editor-schema — 静的スキーマ返却、Cache-Control、14 ブロック型検証 |
| `test/character-class.test.ts` | 18 | CRUD 4 エンドポイント — 認証、ownership 検証、Zod validation、slug 重複チェック |
| `test/rag-hybrid.test.ts` | 9 | POST /search — 認証、env 検証、HybridRAGService mock、close() finally |

### 2.2 ミドルウェアテスト（5 ファイル）

| ファイル | テスト数 | 対象 |
|---------|---------|------|
| `test/middleware-rate-limit.test.ts` | 10 | ウィンドウ制御、429 応答、Retry-After、IP 抽出、独立ストア、リセット |
| `test/middleware-auth.test.ts` | 8 | JWT 検証、401/403/404 応答、suspended、guest 期限切れ、context 設定 |
| `test/middleware-admin.test.ts` | 4 | role=admin チェック、403 応答 |
| `test/middleware-error.test.ts` | 4 | 500 JSON 応答、構造化ログ出力 |
| `test/middleware-logger.test.ts` | 6 | JSON アクセスログ、level 判定 (info/warn/error)、userId |

### 2.3 lib 関数テスト（5 ファイル）

| ファイル | テスト数 | 対象 |
|---------|---------|------|
| `test/lib-auth.test.ts` | 10 | hashPassword、comparePassword、generateToken、verifyToken |
| `test/lib-id.test.ts` | 12 | generateId (ULID)、validateId、parseTimestamp、isExpired |
| `test/lib-validation.test.ts` | 12 | registerSchema、loginSchema — Zod 検証 + 日本語エラーメッセージ |
| `test/lib-editor-schema.test.ts` | 5 | EDITOR_SCHEMA 定数構造検証（14 ブロック型、rules、version） |
| `test/lib-email.test.ts` | 6 | sendEmail、sendVerificationEmail、sendPasswordResetEmail |

## 3. 既存テスト修正（4 ファイル / +8 テスト）

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/config.test.ts` | +7 テスト追加 (getConfig, setStorageMode, isAzureStorage) |
| `test/assist-ks-generator.test.ts` | 5 テストの期待値修正 — KS generator が話者プレフィックス (`主人公：`) を出力しなくなったことに対応。`@l` → `@p` 変更にも対応 |
| `test/assist-context.test.ts` | 1 テスト修正 + 1 テスト追加 — `CharacterStateResultSchema` の optional フィールドにデフォルト値が設定されるよう変更されたことに対応 |
| `test/assist-api.test.ts` | `@kaedevn/ai-gateway` モック追加 — 実 API 呼び出しを回避。KS 期待値も修正 |

## 4. 全テストファイル一覧

| # | ファイル | テスト数 | 時間 | 備考 |
|---|---------|---------|------|------|
| 1 | `test/preview.test.ts` | 40 | 73ms | |
| 2 | `test/assist-api.test.ts` | 31 | 123ms | mock 修正済 |
| 3 | `test/assist-context.test.ts` | 21 | 17ms | 修正済 |
| 4 | `test/azure-live.test.ts` | 20 | 13.9s | Azure 接続テスト |
| 5 | `src/lib/config.test.ts` | 19 | 9ms | +7 追加 |
| 6 | `test/character-class.test.ts` | 18 | 97ms | **NEW** |
| 7 | `test/assist-md-parser.test.ts` | 16 | 15ms | |
| 8 | `test/auth.test.ts` | 15 | 49ms | |
| 9 | `test/assist-prompts.test.ts` | 14 | 16ms | |
| 10 | `test/api-structure.test.ts` | 14 | 98ms | |
| 11 | `test/assist-schemas.test.ts` | 14 | 27ms | |
| 12 | `test/assist-parser.test.ts` | 13 | 30ms | |
| 13 | `test/assist-ks-generator.test.ts` | 12 | 7ms | 修正済 |
| 14 | `test/assist-rag-api.test.ts` | 12 | 1754ms | |
| 15 | `test/lib-id.test.ts` | 12 | 16ms | **NEW** |
| 16 | `test/lib-validation.test.ts` | 12 | 11ms | **NEW** |
| 17 | `test/admin.test.ts` | 12 | 39ms | |
| 18 | `test/assist-vector-store.test.ts` | 11 | 6ms | |
| 19 | `test/lib-auth.test.ts` | 10 | 1111ms | **NEW** |
| 20 | `test/middleware-rate-limit.test.ts` | 10 | 114ms | **NEW** |
| 21 | `test/assets.test.ts` | 9 | 15ms | |
| 22 | `test/rag-hybrid.test.ts` | 9 | 106ms | **NEW** |
| 23 | `test/middleware-auth.test.ts` | 8 | 180ms | **NEW** |
| 24 | `test/assist-chunker.test.ts` | 8 | 5ms | |
| 25 | `src/lib/image.test.ts` | 8 | 547ms | |
| 26 | `test/works.test.ts` | 7 | 131ms | |
| 27 | `test/official-assets.test.ts` | 7 | 101ms | |
| 28 | `test/assist-rag.test.ts` | 7 | 115ms | |
| 29 | `test/editor-schema.test.ts` | 6 | 64ms | **NEW** |
| 30 | `test/schema-sync.test.ts` | 6 | 204ms | |
| 31 | `test/projects.test.ts` | 6 | 124ms | |
| 32 | `test/user-assets.test.ts` | 6 | 13ms | |
| 33 | `test/lib-email.test.ts` | 6 | 13ms | **NEW** |
| 34 | `test/middleware-logger.test.ts` | 6 | 65ms | **NEW** |
| 35 | `test/mcp.test.ts` | 5 | 88ms | |
| 36 | `test/pages.test.ts` | 5 | 88ms | |
| 37 | `test/characters.test.ts` | 5 | 99ms | |
| 38 | `test/contact.test.ts` | 5 | 10ms | |
| 39 | `test/lib-editor-schema.test.ts` | 5 | 13ms | **NEW** |
| 40 | `test/middleware-admin.test.ts` | 4 | 77ms | **NEW** |
| 41 | `test/middleware-error.test.ts` | 4 | 88ms | **NEW** |
| 42 | `test/my-characters.test.ts` | 4 | 57ms | |
| 43 | `test/messages.test.ts` | 4 | 66ms | |
| 44 | `src/lib/hash.test.ts` | 4 | 4ms | |
| 45 | `test/users.test.ts` | 3 | 130ms | |
| 46 | `test/health.test.ts` | 2 | 92ms | |
| 47 | `test/assist-cli-e2e.test.ts` | 38(skip) | 180s | CLI 実行タイムアウト |

## 5. カバレッジ改善

### ルートカバレッジ

| ルート | Before | After |
|--------|--------|-------|
| `/api/editor-schema` | 未テスト | **テスト済** |
| `/api/projects/:pid/character-class` | 未テスト | **テスト済 (CRUD)** |
| `/api/rag-hybrid/search` | 未テスト | **テスト済** |
| その他 17 ルート | テスト済 | テスト済 |

### ミドルウェアカバレッジ

| ミドルウェア | Before | After |
|-------------|--------|-------|
| `auth.ts` | 未テスト | **テスト済 (8 テスト)** |
| `admin.ts` | 未テスト | **テスト済 (4 テスト)** |
| `rate-limit.ts` | 未テスト | **テスト済 (10 テスト)** |
| `error.ts` | 未テスト | **テスト済 (4 テスト)** |
| `logger.ts` | 未テスト | **テスト済 (6 テスト)** |

### lib 関数カバレッジ

| モジュール | Before | After |
|-----------|--------|-------|
| `lib/auth.ts` | 未テスト | **テスト済 (10 テスト)** |
| `lib/id.ts` | 未テスト | **テスト済 (12 テスト)** |
| `lib/validation.ts` | 未テスト | **テスト済 (12 テスト)** |
| `lib/editor-schema.ts` | 未テスト | **テスト済 (5 テスト)** |
| `lib/email.ts` | 未テスト | **テスト済 (6 テスト)** |
| `lib/config.ts` | 部分的 | **拡充 (+7 テスト)** |

## 6. 残存課題

| 課題 | 状態 | 備考 |
|------|------|------|
| `assist-cli-e2e.test.ts` ETIMEDOUT | 未対応 | `execSync` で CLI スクリプトを実行するため 60-120 秒でタイムアウト。環境依存。CI 用にタイムアウト延長 or スキップ設定が必要 |
| `azure-live.test.ts` | PASS (今回) | Azure 接続テスト。Azure サービスが稼働中の場合のみ成功。ネットワーク環境に依存 |

## 7. テスト技法メモ

今回のテスト作成で使用した主要パターン：

### vi.hoisted() によるモック変数の巻き上げ
```typescript
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
vi.mock('../src/lib/db.js', () => ({ prisma: mockPrisma }));
```

### Rate Limiter パススルー
```typescript
vi.mock('../src/middleware/rate-limit.js', () => {
  const pass = async (_c: any, next: any) => next();
  return { loginLimiter: pass, apiLimiter: pass, ... };
});
```

### vi.useFakeTimers() によるウィンドウ制御テスト
```typescript
vi.useFakeTimers();
// リクエスト送信
vi.advanceTimersByTime(windowMs); // ウィンドウ経過
// カウンタリセット確認
vi.useRealTimers();
```

### console.error/log スパイ
```typescript
const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
// リクエスト実行
const logged = JSON.parse(spy.mock.calls[0][0]);
expect(logged.level).toBe('error');
```
