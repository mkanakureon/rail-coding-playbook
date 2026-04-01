# リリース前テストギャップ解消計画書

**作成日**: 2026-03-16
**前提**: [01-release-test-coverage-analysis.md](./01-release-test-coverage-analysis.md) で特定した不足テスト15件
**目標**: クリティカル3件 + 重要2件を解消し、既知バグ1件を修正する

---

## Phase 0: if ブロック JUMP バグ修正（最優先）

### 概要

`generateKSCScript` が生成する KSC で if/else ブロック直後のテキストに到達しない。
then ブロック末尾の JUMP が if ブロック後のコードを飛び越えてスクリプト末尾に着地する。

### 対象ファイル

| ファイル | 操作 |
|---------|------|
| `apps/hono/src/routes/preview.ts` | `generateKSCScript` 内の nested text テンプレート修正 |
| `apps/hono/test/preview.test.ts` | if ブロック後テキスト到達の unit test 追加 |
| `tests/block-coverage/press/rec-logic-detail.spec.ts` | Test 3 に「分岐終了」テキスト検証を復活 |

### 調査方針

1. **再現**: `preview.test.ts` に if + 後続テキストのケースを追加し、生成 KSC を確認
2. **原因特定**: nested text の `@l` 配置と compiler の JUMP 計算のどちらが原因か切り分け
   - `generateKSCScript` の出力 KSC を手動で compiler に通し、Op 列を確認
   - JUMP の PC が指す位置を特定
3. **修正**: 原因に応じて preview.ts または compiler/Parser.ts を修正
4. **検証**: `rec-logic-detail.spec.ts` Test 3 で「分岐終了」到達を確認

### 完了条件

- `npm test -w @kaedevn/hono -- preview` PASS（新規テスト含む）
- `rec-logic-detail.spec.ts` 全5テスト PASS（Test 3 で「分岐終了」表示確認）

---

## Phase 1: choice + set_var + if 連携の KSC 生成テスト

### 概要

分析 #4: choice の actions 内の set_var → 後続 if ブロックの条件分岐が正しい KSC に変換されるか。
Phase 0 の修正が前提。

### 対象ファイル

| ファイル | 操作 |
|---------|------|
| `apps/hono/test/preview.test.ts` | テストケース追加（3件） |

### テストケース

```
1. choice 内 set_var → KSC に `varName = value` が出力される
2. choice → if 連携 → then/else の分岐コードが正しく生成される
3. choice の複数 actions（set_var + text）→ 順序が保持される
```

### 完了条件

- `npm test -w @kaedevn/hono -- preview` 全 PASS

---

## Phase 2: Guest → アップグレード E2E

### 概要

分析 #2: ゲストアカウントで作成したプロジェクトが、正規アカウントへのアップグレード後も保持されるか。

### 対象ファイル

| ファイル | 操作 |
|---------|------|
| `tests/shared/guest/guest-upgrade.spec.ts` | **新規作成** |

### テストケース（4件）

```
1. ゲスト作成 → プロジェクト作成 → アップグレード → プロジェクトが残る
2. ゲスト作成 → アップグレード → 同じメールで再ログイン → プロジェクト参照可能
3. アップグレード後にゲストトークンが無効化される
4. 既存メールでアップグレード → 適切なエラーレスポンス
```

### 実装パターン

```typescript
// API レベルで検証（ブラウザ UI は使わない）
const guest = await request.post('/api/auth/guest');
const { token: guestToken } = await guest.json();

// ゲストでプロジェクト作成
const projectId = await createProject(request, guestToken, 'guest-project');

// アップグレード
const upgrade = await request.post('/api/auth/guest/upgrade', {
  headers: { Authorization: `Bearer ${guestToken}` },
  data: { email: `upgrade-${Date.now()}@test.com`, password: 'DevPass123!' },
});
const { token: userToken } = await upgrade.json();

// プロジェクトが残っているか
const projects = await request.get('/api/projects', {
  headers: { Authorization: `Bearer ${userToken}` },
});
expect(projects).toContainProject(projectId);
```

### 完了条件

- `npx playwright test guest-upgrade --config=tests/shared/playwright.config.ts` 全 PASS

---

## Phase 3: Cloud Save/Load E2E

### 概要

分析 #3: プレビューでのゲーム進行状態をクラウドに保存し、復元できるか。

### 対象ファイル

| ファイル | 操作 |
|---------|------|
| `tests/shared/flow/cloud-save.spec.ts` | **新規作成** |

### テストケース（5件）

```
1. API: セーブデータ作成 → 取得 → 内容一致
2. API: セーブデータ上書き → 最新データが返る
3. API: 存在しないセーブ取得 → 404
4. API: 他ユーザーのセーブ取得 → 403
5. API: セーブスキーマ v1 の全フィールドが保持される
```

### 実装方針

- `cloud-saves.ts` の API エンドポイントを直接呼び出す API レベルテスト
- SaveData スキーマ（`packages/core/src/SaveData.ts`）の全フィールドを検証
- ブラウザ UI からの保存/復元は TitleScreen / SaveLoadScreen の UI 依存が大きいため、API レベルを優先

### 完了条件

- `npx playwright test cloud-save --config=tests/shared/playwright.config.ts` 全 PASS

---

## Phase 4: Editor jump 参照整合性テスト

### 概要

分析 #6: jump ブロックが参照するページを削除した場合、プレビューがクラッシュしないか。

### 対象ファイル

| ファイル | 操作 |
|---------|------|
| `apps/hono/test/preview.test.ts` | テストケース追加（2件） |
| `apps/editor/test/store.test.ts` | テストケース追加（2件） |

### テストケース

**preview.test.ts:**
```
1. jump の toPageId が存在しないページを指す → KSC に空行が出力される（クラッシュしない）
2. if の thenBlocks 内の jump が存在しないページを指す → 同上
```

**store.test.ts:**
```
3. ページ削除時に jump.toPageId が削除対象 → 警告 or toPageId クリア
4. undo でページ復活 → jump.toPageId が再び有効
```

### 完了条件

- `npm test -w @kaedevn/hono -- preview` PASS
- `npm test -w @kaedevn/editor` PASS

---

## 実施順序とスケジュール

```
Phase 0 ─── if JUMP バグ修正 ──────── 調査 + 修正 + テスト
  │
Phase 1 ─── choice+if KSC テスト ──── Phase 0 修正が前提
  │
Phase 2 ─── Guest アップグレード ───── Phase 0/1 と独立
  │
Phase 3 ─── Cloud Save/Load ────────── Phase 0/1 と独立
  │
Phase 4 ─── jump 参照整合性 ─────────── Phase 0/1 と独立
```

- Phase 0 → Phase 1 は依存関係あり（順序固定）
- Phase 2, 3, 4 は Phase 0/1 と独立して並行実施可能

---

## 成果物

| Phase | 新規ファイル | 修正ファイル | テスト増分 |
|-------|------------|------------|----------|
| 0 | — | preview.ts, preview.test.ts, rec-logic-detail.spec.ts | +2 |
| 1 | — | preview.test.ts | +3 |
| 2 | guest-upgrade.spec.ts | — | +4 |
| 3 | cloud-save.spec.ts | — | +5 |
| 4 | — | preview.test.ts, store.test.ts | +4 |
| **合計** | **2 新規** | **4 修正** | **+18 テスト** |

---

## 対象外（次スプリント以降）

| # | 領域 | 理由 |
|---|------|------|
| 5 | Editor undo/redo | store.test.ts に 108 件あり、Phase 4 で部分対応 |
| 7 | Audio E2E | Web Audio API のヘッドレステストは技術的制約が大きい |
| 8 | Screen Filter 全16種 | 視覚的テストは Playwright screenshot 比較が必要。工数大 |
| 9-15 | 防御的テスト群 | リリースブロッカーではない |
