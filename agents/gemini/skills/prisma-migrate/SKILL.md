---
name: prisma-migrate
description: Manage Prisma schema changes and database migrations. Use when modifying schema.prisma, adding new database models, or when the user asks to "update the database".
---
# Prisma Migrate Skill

This skill ensures that database schema changes are properly tracked via migrations and validated against the application code.
Never use `db push` for schema changes that need to be deployed.

## Required Workflow

When modifying `apps/hono/prisma/schema.prisma`:

1. **Generate Migration**: Do not just save the file. You must generate a migration file.
   ```bash
   cd apps/hono
   npx prisma migrate dev --name <short_english_description>
   ```
2. **Verify Generation**: Use `git status` to ensure the new migration folder was created in `apps/hono/prisma/migrations/`.
3. **Run Schema Sync Tests (Mandatory)**: Verify the new schema doesn't break the application.
   ```bash
   npm test -w @kaedevn/hono
   ```
4. **Commit**: Once tests pass, commit both `schema.prisma` and the newly generated migration files together.
