# 「Malformed JSON in request body」バグ調査レポート

**日付**: 2026-03-03
**ステータス**: **解決済み**

## 症状

`POST /api/auth/register` および `POST /api/auth/login` で、正しい JSON ボディを送っても `500 Malformed JSON in request body` が返る。ローカル・Azure 両方で再現。

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"DevPass123!","username":"test0303"}'
# → {"error":{"message":"Malformed JSON in request body","status":500}}
```

## 根本原因

**zsh のヒストリ展開が `!` を `\!` にエスケープしていた。**

### 証拠

RAW ボディの hex ダンプで判明:

```
送信されたバイト列: ... 44 65 76 50 61 73 73 31 32 33 5c 21 ...
                                                        ^^  ^^
                                                        \   !
正しいバイト列:     ... 44 65 76 50 61 73 73 31 32 33 21 ...
                                                        ^^
                                                        !
```

- `5c 21` = `\!` → JSON では `\!` は不正なエスケープシーケンス → `JSON.parse()` 失敗
- `21` = `!` → 正しい JSON

### 原因の仕組み

1. zsh はデフォルトでヒストリ展開が有効（`!` は特殊文字）
2. シングルクォート内でも、一部環境では `!` が `\!` にエスケープされる
3. curl の `--data-raw` でもシェル処理後の文字列が送信される
4. `DevPass123!` → `DevPass123\!` としてサーバーに到達
5. `JSON.parse()` が `\!` を「不正なエスケープ文字」として拒否

### 検証結果

```bash
# NG: シェル経由（! が \! になる）
curl -d '{"password":"DevPass123!"}' ...
# → Bad escaped character in JSON at position 54

# OK: ファイル経由（シェルのエスケープを回避）
echo '{"password":"DevPass123!"}' > /tmp/body.json
curl -d @/tmp/body.json ...
# → 200 OK（登録成功）
```

## Hono / Node.js の問題ではなかった

調査中に以下を疑ったが、いずれも**原因ではなかった**:

| 仮説 | 結果 |
|---|---|
| compress ミドルウェアの干渉 | ❌ リクエストボディには触れない |
| レートリミッターのレスポンス早期初期化 | ❌ 無関係（ただし `await next()` 後に移動は改善） |
| `@hono/node-server` の `overrideGlobalObjects` | ❌ 無関係 |
| Node.js 25 の互換性問題 | ❌ Node 22 でも同じ（zsh が原因だから） |
| Hono のボディキャッシュ不整合 | ❌ 最新版でも同じ |
| ミドルウェアの組み合わせ | ❌ ミニマルテストでも同じ curl で再現 |

ミニマルテストで「200 OK」が出たのは、テスト用パスワードに `!` を含まなかったため。

## 結論

- **Hono / zValidator / Node.js にバグなし**
- **curl テストで `!` を含む文字列を送る場合は、ファイル経由（`-d @file`）を使う**
- **ブラウザ / フロントエンドからのリクエストは影響なし**（zsh を経由しない）
- Azure の 400 エラーも同じ curl テストで発生していた可能性が高い

## 変更の巻き戻し

| ファイル | 対応 |
|---|---|
| `apps/hono/src/routes/auth.ts` | `validateJson` → `zValidator` に戻す |
| `apps/hono/src/middleware/validate-json.ts` | 削除 |
| `apps/hono/src/middleware/rate-limit.ts` | `await next()` 後のヘッダーセットは改善なので維持 |
| `.nvmrc` | `22` — Node 22 LTS は推奨なので維持 |
| `apps/hono/test-minimal.ts` | 既に削除済み |

## 教訓

1. **zsh の `!` エスケープに注意**: JSON に `!` を含む場合、curl テストではファイル経由が安全
2. **hex ダンプが最強のデバッグツール**: 「ボディが読めない」問題はバイト列を見ればすぐわかる
3. **ミニマルテストとの差分がある場合**: テストデータの違い（`!` の有無）にも注目する
