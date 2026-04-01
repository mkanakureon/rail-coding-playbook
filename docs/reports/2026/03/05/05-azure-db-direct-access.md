# Azure DB 直接アクセス手順

## 概要

Azure PostgreSQL (Flexible Server) にローカルから直接接続してデータ操作を行う手順。
ユーザー作成、ロール変更、データ修正などに使用する。

## 接続情報

| 項目 | 値 |
|------|-----|
| サーバー | `pgnextacamin.postgres.database.azure.com` |
| ポート | `5432` |
| DB名 | `appdb` |
| ユーザー | `pgadmin` |
| パスワード | `Kaedevn2026Pass` |
| SSL | 必須 (`?sslmode=require`) |

接続文字列:
```
postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require
```

Container Apps の環境変数から取得する方法:
```bash
az containerapp show --name ca-api --resource-group rg-next-aca-min \
  --query "properties.template.containers[0].env[?name=='DATABASE_URL'].value" -o tsv
```

## 手順

### 1. ファイアウォールルール追加

Azure PostgreSQL はデフォルトで外部接続をブロックしている。ローカル IP を一時的に許可する。

```bash
# 自分の IPv4 を取得
MY_IP=$(curl -s -4 https://ifconfig.me)
echo "My IP: $MY_IP"

# ファイアウォールルール追加
az postgres flexible-server firewall-rule create \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name temp-local-access \
  --start-ip-address "$MY_IP" \
  --end-ip-address "$MY_IP"
```

### 2. Prisma Client で操作

リポジトリルートで実行。`apps/hono/node_modules/@prisma/client` を使う。

```bash
node -e "
const { PrismaClient } = require('./apps/hono/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require' } }
});

async function main() {
  // 例: ユーザー一覧
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log(users);
  await prisma.\$disconnect();
}
main();
"
```

### 3. よくある操作

#### Admin ユーザー作成

```bash
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('./apps/hono/node_modules/@prisma/client');
const crypto = require('crypto');

function makeId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = crypto.randomBytes(10).toString('hex').toUpperCase().slice(0,16);
  return (t + r).slice(0,26);
}

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require' } }
});

async function main() {
  const hash = await bcrypt.hash('DevPass123!', 10);
  const now = BigInt(Date.now());
  const user = await prisma.user.upsert({
    where: { email: 'mynew@test.com' },
    update: { role: 'admin', passwordHash: hash, emailVerified: true, updatedAt: now },
    create: {
      id: makeId(),
      username: 'mynew',
      email: 'mynew@test.com',
      passwordHash: hash,
      role: 'admin',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    }
  });
  console.log('OK:', user.id, user.email, user.role);
  await prisma.\\\$disconnect();
}
main();
"
```

#### ユーザーのロール変更

```bash
node -e "
const { PrismaClient } = require('./apps/hono/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require' } }
});
async function main() {
  const user = await prisma.user.update({
    where: { email: 'target@example.com' },
    data: { role: 'admin', updatedAt: BigInt(Date.now()) },
  });
  console.log('Updated:', user.id, user.role);
  await prisma.\\\$disconnect();
}
main();
"
```

#### テーブル内容確認

```bash
node -e "
const { PrismaClient } = require('./apps/hono/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require' } }
});
async function main() {
  const count = await prisma.user.count();
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { email: true, role: true } });
  console.log('Total users:', count);
  console.log('Admins:', admins);
  await prisma.\\\$disconnect();
}
main();
"
```

### 4. ファイアウォールルール削除（必ず実行）

作業完了後は一時ルールを必ず削除する。

```bash
az postgres flexible-server firewall-rule delete \
  --resource-group rg-next-aca-min \
  --name pgnextacamin \
  --rule-name temp-local-access \
  --yes
```

## 注意事項

- **ファイアウォールルールは必ず削除する** — 放置するとセキュリティリスク
- IPv4 アドレスのみ対応（`curl -s -4 https://ifconfig.me` で取得）
- Prisma Client のフィールド名は **camelCase**（`passwordHash`, `emailVerified`, `createdAt` 等）。DB カラム名（snake_case）ではない
- `createdAt` / `updatedAt` は `BigInt(Date.now())` で Unix ミリ秒タイムスタンプ
- ID は ULID 形式（26文字英数大文字）。`ulid` パッケージが使えない場合は `Date.now().toString(36) + randomHex` で代替可
- `az containerapp exec` はこの環境では使えない（非対話モードで tty エラー）
- `registerLimiter` は 3/hour なので、API 経由での登録は制限に注意

## psql での直接接続（代替手段）

```bash
psql "postgresql://pgadmin:Kaedevn2026Pass@pgnextacamin.postgres.database.azure.com:5432/appdb?sslmode=require"
```

```sql
-- ユーザー一覧
SELECT id, username, email, role FROM users;

-- Admin に昇格
UPDATE users SET role = 'admin', updated_at = EXTRACT(EPOCH FROM NOW()) * 1000 WHERE email = 'target@example.com';

-- ユーザー作成（bcrypt ハッシュは事前に Node で生成）
INSERT INTO users (id, username, email, password_hash, role, email_verified, created_at, updated_at)
VALUES ('GENERATED_ULID', 'username', 'email@example.com', '$2b$10$...hash...', 'admin', true, EXTRACT(EPOCH FROM NOW()) * 1000, EXTRACT(EPOCH FROM NOW()) * 1000);
```
