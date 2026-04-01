# ローカル / Azure テスト乖離 — 対策計画書

**作成日**: 2026-03-04
**根拠**: `docs/09_reports/2026/03/04/02-LOCAL-VS-AZURE-TEST-GAP-ANALYSIS.md`

---

## 現状の課題サマリ

| # | 乖離パターン | 現状の防御 | ギャップ |
|---|------------|----------|---------|
| 1 | ビルドツールの検証レベル差 | CI `ci.yml` で typecheck あり | **typecheck 対象が `core` `web` のみ**。`apps/editor`, `apps/next`, `apps/hono` が未カバー |
| 2 | DB スキーマ同期漏れ | `schema-sync.test.ts` あり | テストは CI の hono ジョブで実行されるが、**deploy 前ゲートとしては機能していない** |
| 3 | ネットワーク・インフラ差分 | `deploy.yml` に verify ジョブあり | verify は疎通のみ。**CORS・SPA fallback・URL 整合性は未検証** |
| 4 | テスト品質 (緩い assertion) | 修正済み (2026-03-04) | 再発防止の仕組みがない（**レビューチェックリスト未整備**） |
| 5 | タイムアウト設定 | 修正済み (2026-03-04) | Azure E2E 用の設定は個別ファイルに記載。**テンプレート化されていない** |

---

## 実施計画

### Phase 1: ローカル防御の強化（即日〜1日）

目的: デプロイ前にローカルで本番と同じ検証を走らせ、「Docker ビルドで初めて発覚」を防ぐ。

#### 1-1. `typecheck` スクリプトの対象拡大

**ファイル**: `package.json` (root)

```diff
- "typecheck": "tsc -b packages/core packages/web",
+ "typecheck": "tsc -b packages/core packages/web && tsc --noEmit -p apps/editor/tsconfig.json && tsc --noEmit -p apps/next/tsconfig.json && tsc --noEmit -p apps/hono/tsconfig.json",
```

> 注: `apps/*` は `tsc -b` (project references) ではなく `--noEmit` で型チェックのみ実行。ビルド成果物は不要。各 app の tsconfig が独立している場合は `-p` で指定する。

#### 1-2. `lint` スクリプトの実装

**ファイル**: `package.json` (root)

```diff
- "lint": "echo \"No linter configured yet\"",
+ "lint": "next lint --dir apps/next/src && eslint apps/editor/src --ext .ts,.tsx && eslint apps/hono/src --ext .ts,.tsx",
```

> 注: 各 app に ESLint 設定がなければ root の `.eslintrc` をフォールバックとして使う。最低限 `next lint` を動かすだけでも `use*` プレフィックス違反は検出できる。

#### 1-3. `build` スクリプトの対象拡大

**ファイル**: `package.json` (root)

```diff
- "build": "npm run build -w @kaedevn/core && npm run build -w @kaedevn/web",
+ "build": "npm run build -w @kaedevn/core && npm run build -w @kaedevn/web && npm run build -w apps/editor && npm run build -w apps/next",
```

#### 1-4. `pre-push` フックの追加

**ファイル**: `.husky/pre-push` (新規作成)

```sh
#!/bin/sh
echo "Pre-push checks..."

# 型チェック（全パッケージ）
npm run typecheck || exit 1

# Next.js lint（use* プレフィックス違反検出）
npx next lint --dir apps/next/src || exit 1

echo "All pre-push checks passed!"
```

> `pre-commit` に入れると毎コミットで遅くなるため、`pre-push` で実行する。
> `npm run build` は時間がかかるため pre-push には入れず、デプロイ前のみとする。

---

### Phase 2: CI パイプラインの強化（1〜2日）

目的: `ci.yml` のカバー範囲を本番ビルドと同レベルに引き上げる。

#### 2-1. typecheck ジョブの対象拡大

**ファイル**: `.github/workflows/ci.yml`

現状: `npm run typecheck` → `packages/core` と `packages/web` のみ
修正: Phase 1-1 で root `typecheck` を拡大済みなので、CI 側の変更は不要（root スクリプトが使われる）。

#### 2-2. lint ジョブの追加

```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npm ci
    - run: npm run lint
```

#### 2-3. Docker ビルドテストの追加

```yaml
docker-build-test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      app: [api, nextjs]
  steps:
    - uses: actions/checkout@v4
    - run: |
        docker build --platform linux/amd64 \
          -f apps/${{ matrix.app == 'api' && 'hono' || 'next' }}/Dockerfile \
          -t test-${{ matrix.app }}:ci .
```

> Docker ビルドが通ることを PR 段階で確認する。push はしない。
> ビルド時間が長い場合は `workflow_dispatch` トリガーに変更し、デプロイ前のみ手動実行する。

#### 2-4. Prisma マイグレーション整合性チェック

```yaml
# unit-tests-hono ジョブに追記
- name: Check for pending migrations
  run: npx prisma migrate status
  working-directory: apps/hono
  env:
    DATABASE_URL: postgresql://...
```

`prisma migrate status` が "pending migrations" を報告したら CI を失敗させる。

---

### Phase 3: デプロイ前ゲートの整備（1〜2日）

目的: `deploy-azure.sh` にビルド検証を組み込み、壊れたコードが本番に出ないようにする。

#### 3-1. `deploy-azure.sh` に pre-flight チェックを追加

**ファイル**: `scripts/deploy-azure.sh`（先頭に追加）

```bash
echo "=== Pre-flight checks ==="

# 1. 型チェック
echo "Running typecheck..."
npm run typecheck || { echo "FAIL: typecheck errors found"; exit 1; }

# 2. ユニットテスト
echo "Running unit tests..."
npm test || { echo "FAIL: unit tests failed"; exit 1; }

# 3. Prisma マイグレーション状態
echo "Checking Prisma migration status..."
cd apps/hono && npx prisma migrate status 2>&1 | grep -q "Database schema is up to date" || {
  echo "WARNING: Pending Prisma migrations detected. Run 'npx prisma migrate dev' first."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
}
cd -

echo "=== Pre-flight checks passed ==="
```

#### 3-2. デプロイ後の自動検証強化

**ファイル**: `.github/workflows/deploy.yml` の `verify` ジョブ

現状: `curl` で疎通確認のみ。
追加:

```yaml
verify:
  needs: [build-and-push]
  runs-on: ubuntu-latest
  steps:
    - name: Wait for deployment
      run: sleep 45

    - name: Health check - API
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ vars.API_URL }}/health)
        [ "$STATUS" = "200" ] || exit 1

    - name: Health check - Next.js
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ vars.NEXTJS_URL }})
        [ "$STATUS" = "200" ] || exit 1

    - name: CORS check - Editor → API
      run: |
        ACAO=$(curl -s -H "Origin: ${{ vars.EDITOR_URL }}" \
          -I ${{ vars.API_URL }}/api/health \
          | grep -i "access-control-allow-origin" | awk '{print $2}' | tr -d '\r')
        [ "$ACAO" = "${{ vars.EDITOR_URL }}" ] || {
          echo "CORS misconfigured: expected ${{ vars.EDITOR_URL }}, got $ACAO"
          exit 1
        }

    - name: SPA fallback - Editor
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ vars.EDITOR_URL }}/projects/editor/test)
        [ "$STATUS" = "200" ] || {
          echo "SPA fallback not working (got $STATUS)"
          exit 1
        }

    - name: SPA fallback - Preview
      run: |
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ vars.PREVIEW_URL }}/any-deep-path)
        [ "$STATUS" = "200" ] || {
          echo "SPA fallback not working (got $STATUS)"
          exit 1
        }
```

---

### Phase 4: テスト品質の再発防止（継続的）

目的: 緩い assertion やタイムアウト不備が再び入り込まないようにする。

#### 4-1. テスト品質 ESLint ルール

以下のパターンを禁止する ESLint カスタムルールまたは grep チェックを導入:

```bash
# CI / pre-push に追加
echo "Checking for loose test assertions..."
# 複数 status を許容する expect
grep -rn "toContain(res\.\(status\|statusCode\))" tests/ apps/*/test/ && {
  echo "FAIL: Use exact status assertion (e.g., toBe(200)), not toContain"
  exit 1
}
# 条件付き assertion (if で囲まれた expect)
grep -rn "if.*{" -A2 tests/ apps/*/test/ | grep "expect(" && {
  echo "WARNING: Conditional assertion detected. Verify this is intentional."
}
```

> 本格的な ESLint プラグイン（`eslint-plugin-jest` の `no-conditional-expect`）を導入する方が望ましいが、まずは grep ベースで即効性を確保する。

#### 4-2. Azure E2E テストテンプレート

新規 Azure E2E テストファイル作成時のボイラープレート:

**ファイル**: `tests/templates/azure-e2e-template.ts` (参照用)

```typescript
import { test, expect } from '@playwright/test';

// Azure テストの共通設定
test.use({
  navigationTimeout: 60_000,   // コールドスタート考慮
  actionTimeout: 20_000,       // ネットワークレイテンシ考慮
});

test.beforeAll(async () => {
  // ウォームアップ: コールドスタート回避
  await fetch(process.env.API_URL + '/health', {
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {});
});
```

#### 4-3. PR レビューチェックリスト

**ファイル**: `.github/pull_request_template.md` に追記

```markdown
## テスト品質チェック
- [ ] `expect` で期待する状態を 1 つだけ明示しているか（`toContain([200, 500])` 禁止）
- [ ] 条件分岐 (`if`) で `expect` をスキップしていないか
- [ ] Azure 向けテストに適切なタイムアウトを設定しているか
- [ ] Prisma schema を変更した場合、マイグレーションファイルを作成したか
```

---

## 実施優先度とスケジュール

| 優先度 | タスク | 工数 | 効果 |
|-------|--------|------|------|
| **P0** | 1-1. typecheck 対象拡大 | 15 min | Editor/Next/Hono の型エラーを即検出 |
| **P0** | 1-4. pre-push フック追加 | 15 min | push 前に最低限の検証を自動実行 |
| **P0** | 3-1. deploy-azure.sh に pre-flight 追加 | 30 min | デプロイ前の最終防壁 |
| **P1** | 1-2. lint スクリプト実装 | 30 min | `use*` プレフィックス等の検出 |
| **P1** | 1-3. build 対象拡大 | 15 min | Editor/Next のビルドエラーを検出 |
| **P1** | 2-2. CI に lint ジョブ追加 | 30 min | PR 段階で lint エラー検出 |
| **P1** | 2-4. Prisma migration status チェック | 15 min | マイグレーション漏れを CI で検出 |
| **P2** | 2-3. Docker ビルドテスト | 1h | Dockerfile の不備を PR 段階で検出 |
| **P2** | 3-2. デプロイ後検証強化 | 1h | CORS・SPA fallback を自動検証 |
| **P2** | 4-1. テスト品質チェック | 30 min | 緩い assertion の再発防止 |
| **P3** | 4-2. Azure E2E テンプレート | 15 min | タイムアウト設定の標準化 |
| **P3** | 4-3. PR テンプレート | 15 min | 人的レビューの品質向上 |

---

## 期待効果

```
Before:
  開発 → git push → deploy-azure.sh → Docker build FAIL → 調査 → 修正 → 再デプロイ
  （発見まで 10〜30 分、修正含め 1〜2 時間）

After:
  開発 → git push (pre-push: typecheck FAIL) → 即修正 → push → CI (lint/test) → deploy
  （発見まで 1〜2 分、修正含め 5〜15 分）
```

**カバレッジ改善**:

| 乖離パターン | 検出タイミング (Before) | 検出タイミング (After) |
|------------|----------------------|---------------------|
| 型エラー (apps/) | Docker build / deploy 時 | **pre-push / CI** |
| ESLint 違反 | `next build` 時 | **pre-push / CI** |
| Dockerfile 不備 | deploy 時 | **CI (Docker build test)** |
| DB スキーマ漏れ | 本番 500 エラー | **CI (migrate status)** |
| CORS 設定漏れ | Azure E2E 手動実行時 | **deploy 後自動検証** |
| SPA fallback 漏れ | Azure E2E 手動実行時 | **deploy 後自動検証** |
| 緩い assertion | 次の障害発生時 | **CI (grep チェック) / PR レビュー** |

---

## 参照

- Gap Analysis: `docs/09_reports/2026/03/04/02-LOCAL-VS-AZURE-TEST-GAP-ANALYSIS.md`
- 既存 CI: `.github/workflows/ci.yml`
- デプロイスクリプト: `scripts/deploy-azure.sh`
- Pre-commit: `.husky/pre-commit`
