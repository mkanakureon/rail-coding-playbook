> **WARNING**: このファイルはローカル開発用の認証情報のみを記載しています。
> 本番・ステージング環境の認証情報を tracked ファイルに記載しないでください。

# Local Development Credentials

## Login Accounts

### Admin Account
| Item | Value |
|------|-------|
| Email | `mynew@test.com` |
| Password | `DevPass123!` |
| Role | admin |
| Username | mynewuser |

### General User Account
| Item | Value |
|------|-------|
| Email | `test1@example.com` |
| Password | `DevPass123!` |
| Role | user |
| Username | testuser1 |

## Database

| Item | Value |
|------|-------|
| Host | localhost:5432 |
| DB | kaedevn_dev |
| User | kaedevn |
| Password | <YOUR_DB_PASSWORD> |

## Startup

```bash
docker compose up -d          # PostgreSQL
npm run dev -w apps/hono      # API (port 8080)
npm run dev -w apps/next      # Next.js (port 3000)
```
