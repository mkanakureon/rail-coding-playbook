# Azure 環境へのログイン方法

## 背景

Azure Container Apps にデプロイされたエディタ・API の E2E テストを実行する際、ログイン方法でいくつかの問題に直面した。本文書はその調査結果と成功した方法を記録する。

## Azure 環境 URL

| サービス | URL |
|---------|-----|
| API | `https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Editor | `https://ca-editor.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Next.js | `https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |
| Preview | `https://ca-preview.icymeadow-82e272bc.japaneast.azurecontainerapps.io` |

## 問題1: ローカルのテストアカウントは Azure DB に存在しない

ローカル開発で使用する `test1@example.com` や `mynew@test.com` は Azure の PostgreSQL には存在しない。Azure 環境は独立した DB を持つため、別途ユーザー登録が必要。

## 問題2: curl での JSON 送信が失敗する

```bash
# これは失敗する（500 "Malformed JSON in request body"）
curl -X POST https://ca-api.../api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"DevPass123!"}'
```

原因: シェルのクォート処理で JSON が壊れる場合がある。

## 成功した方法: Node.js http モジュール

```javascript
// ユーザー登録
node -e "
const https = require('https');
const data = JSON.stringify({
  username: 'testuser0221',
  email: 'testuser0221@example.com',
  password: 'DevPass123!'
});
const req = https.request({
  hostname: 'ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io',
  path: '/api/auth/register',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(res.statusCode, body));
});
req.write(data);
req.end();
"
```

```javascript
// ログイン
node -e "
const https = require('https');
const data = JSON.stringify({
  email: 'testuser0221@example.com',
  password: 'DevPass123!'
});
const req = https.request({
  hostname: 'ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io',
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(res.statusCode, body));
});
req.write(data);
req.end();
"
```

## 成功した方法: Playwright の page.request

Playwright テスト内では `page.request` を使うと JSON が正しく送信される。

```typescript
const res = await page.request.post(`${AZURE_API}/api/auth/login`, {
  data: { email: 'testuser0221@example.com', password: 'DevPass123!' },
});
const body = await res.json();
// body.token, body.user.id が取得できる
```

## Azure テスト用アカウント

| 項目 | 値 |
|------|-----|
| Email | `testuser0221@example.com` |
| Password | `DevPass123!` |
| User ID | `01KJ00YX8VP8ERDAGKYQR90GZC` |
| 登録日 | 2026-02-21 |

## 教訓

1. **Azure 環境は独立した DB** — ローカルのアカウントは使えない。テスト前にユーザー登録が必要
2. **curl より Node.js** — JSON のクォート問題を回避できる。Playwright の `page.request` も同様に安全
3. **エディタへの認証注入** — `localStorage.setItem('authToken', token)` と `localStorage.setItem('currentUserId', userId)` を `page.addInitScript()` で注入する
