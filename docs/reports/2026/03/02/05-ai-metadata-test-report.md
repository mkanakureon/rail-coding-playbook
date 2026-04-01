# AI 親和性 JSON メタデータ — テスト結果報告書

- **日付**: 2026-03-02
- **コミット**: `70e3b20` (feat: AI親和性メタデータ API を追加)
- **環境**: ローカル (localhost:8080)
- **結果**: **7/7 PASS**

---

## 対象機能

| 変更 | ファイル |
|------|---------|
| 静的ブロックスキーマ定義 | `apps/hono/src/lib/editor-schema.ts` (新規) |
| スキーマ API エンドポイント | `apps/hono/src/routes/editor-schema.ts` (新規) |
| ルート登録 | `apps/hono/src/index.ts` |
| 動的 `_ai_context` 付加 + PUT ストリップ | `apps/hono/src/routes/projects.ts` |
| ドキュメント | `CLAUDE.md` |

---

## テスト結果

### Test 1: GET /api/editor-schema — PASS

| 項目 | 期待 | 結果 |
|------|------|------|
| Status | 200 | 200 |
| Cache-Control | `public, max-age=86400` | `public, max-age=86400` |
| version | 1 | 1 |
| blockTypes 数 | 14 | 14 |
| blockTypes | start, bg, ch, text, choice, if, set_var, effect, screen_filter, timeline, battle, overlay, jump, ksc | 一致 |
| rules キー | startBlock, idUniqueness, referentialIntegrity | 一致 |
| ch.pos.enum | ["L","C","R"] | ["L","C","R"] |
| effect.effect.enum 数 | 8 | 8 |
| set_var.operator.enum | ["=","+=","-="] | ["=","+=","-="] |
| id/type readOnly | true | true |

### Test 2: GET /api/projects/:id _ai_context — PASS

| 項目 | 結果 |
|------|------|
| _ai_context 存在 | true |
| schemaEndpoint | `/api/editor-schema` |
| availableAssets.backgrounds | 1件 |
| availableAssets.overlays | 0件 |
| availableCharacters | 2件 (id, slug, name, expressions 含む) |
| availablePages | 1件 (`{"id":"page1","name":"Page 1"}`) |
| knownVariables | `[]` (該当プロジェクトに変数なし) |

### Test 3: PUT _ai_context/_metadata ストリップ — PASS

| 項目 | 期待 | 結果 |
|------|------|------|
| PUT status | 200 | 200 |
| レスポンス data._ai_context | undefined (除去済み) | undefined |
| レスポンス data._metadata | undefined (除去済み) | undefined |

### Test 4: Re-GET 後 DB 汚染なし — PASS

| 項目 | 期待 | 結果 |
|------|------|------|
| data._ai_context (DB由来) | 存在しない | clean |
| data._metadata (DB由来) | 存在しない | clean |
| _ai_context (トップレベル再生成) | 存在する | true |

PUT で `_ai_context`/`_metadata` を送信しても DB には保存されず、GET 時に動的に再生成されることを確認。

### Test 5: Preview API 影響なし — PASS

| 項目 | 結果 |
|------|------|
| Status | 200 |
| レスポンスサイズ | 17,220 bytes |
| script コンテンツ | 正常出力 |

既存の `/api/preview/:id` エンドポイントへの影響なし。

### Test 6: Editor-schema 認証不要 — PASS

認証ヘッダーなしで `GET /api/editor-schema` にアクセスし、200 が返ることを確認。

### Test 7: 複数プロジェクト対応 — PASS

| 項目 | 結果 |
|------|------|
| プロジェクト2 (フィルター) _ai_context | 存在 |
| pages | 1件 |
| characters | 1件 |

異なるプロジェクトごとに固有の `_ai_context` が生成されることを確認。

---

## まとめ

全テスト PASS。DB マイグレーション不要、エディタ UI 変更なし、既存エンドポイント（プレビュー含む）への副作用なし。
