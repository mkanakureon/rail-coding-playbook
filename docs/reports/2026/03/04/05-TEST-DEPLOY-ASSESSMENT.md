# テスト・デプロイ 総合評価レポート (2026-03-04)

## 概要

本日実施した全テスト・デプロイ作業の結果と、テストカバレッジの網羅性評価、および追加すべきテストの提案をまとめる。

RAG ハイブリッド検索（`/api/rag/search`）を活用し、過去の Gap Analysis・対策計画・インシデント記録を横断的に参照して評価した。

---

## 1. 本日実施したテスト結果

### 1.1 ユニットテスト

| パッケージ | テスト数 | 結果 | 備考 |
|-----------|---------|------|------|
| @kaedevn/core | 175 | **PASS** | OpRunner, Timeline, Events, SaveData |
| @kaedevn/compiler | 239 | **PASS** | Tokenizer, lineClassifier, Phase2-5 |
| @kaedevn/interpreter | 72 | **PASS** | Phase5 再帰テストは既知の除外 |
| apps/editor | 134 | **PASS** | api-config `characters` → `chClass` 修正 |
| @kaedevn/next | 28 | **PASS** | Ad ユーティリティ |
| @kaedevn/hono (unit) | 331 | **PASS** | 28/33 テストファイル |
| **合計** | **979** | **ALL PASS** | |

### 1.2 Azure Live テスト (vitest)

| テスト数 | 結果 | 実行時間 |
|---------|------|---------|
| 20/20 | **ALL PASS** | 3.24s |

修正内容: Editor/Preview URL を SWA URL に更新、testTimeout を 20,000ms に設定。

### 1.3 Azure E2E テスト (Playwright)

| テスト数 | 結果 | 実行時間 |
|---------|------|---------|
| 55/55 | **ALL PASS** | 1.2m |

構成ファイル: `playwright.check.config.ts`（testDir: `./tests/`）

### 1.4 GitHub Actions デプロイ

| ジョブ | 結果 |
|-------|------|
| build-and-push (api) | **PASS** |
| build-and-push (nextjs) | **PASS** |
| verify (Health) | **PASS** |
| verify (CORS) | **PASS** |
| verify (SPA fallback - Editor) | **PASS** |
| verify (SPA fallback - Preview) | **PASS** |

### 1.5 ESLint (修正後)

| 対象 | 結果 |
|------|------|
| Next.js | **0 warnings, 0 errors** |
| Editor | 未実施（約50件の既存エラー、別途対応） |

---

## 2. 本日実装したガード

| ガード | 内容 | 検出タイミング |
|-------|------|-------------|
| `.husky/pre-push` | typecheck + Next.js lint | `git push` 時 |
| `package.json` lint | Next.js のみ（`lint:all` で Editor 含む） | `npm run lint` |
| `ci.yml` lint ジョブ | Next.js lint | PR / push to main |
| `ci.yml` Prisma check | `prisma migrate status` | PR / push to main |
| `deploy-azure.sh` pre-flight | typecheck + test + Prisma（SKIP_PREFLIGHT で回避可） | ローカルデプロイ時 |
| `deploy.yml` verify | Health + CORS + SPA fallback | GitHub Actions デプロイ後 |

---

## 3. テストカバレッジの網羅性評価

### 3.1 カバレッジ概要

| カテゴリ | テストあり | テストなし | カバー率 | 評価 |
|---------|-----------|-----------|---------|------|
| **Core エンジン** | 175 テスト | — | 高 | 十分 |
| **Compiler** | 239 テスト | — | 高 | 十分 |
| **Interpreter** | 72 テスト | Phase5 再帰 | 高 | 実用上問題なし |
| **Hono API ルート** | 15/19 ルート | 4 ルート | 79% | 要改善 |
| **ai-gateway** | 4 テスト | — | 中 | 基本はカバー |
| **Web パッケージ** | 8 テスト | 48 ファイル | ~15% | 要改善 |
| **Editor コンポーネント** | store のみ | 54/55 コンポーネント | ~2% | 大幅不足 |
| **Next.js アプリ** | Ad 関連のみ | ページ・フック・コンテキスト全般 | <1% | 大幅不足 |
| **E2E テスト** | 42 spec ファイル | — | — | 優秀 |

### 3.2 強み

- **コア基盤（compiler / interpreter / core）のテストは充実**。エンジン部分は信頼性が高い
- **Hono API は 15/19 ルートにテストあり**。認証・プロジェクト・アセット管理等の主要フローをカバー
- **E2E テストが 42 ファイル** と豊富。認証フロー、エディタ操作、ゲストモード、管理画面まで網羅
- **Azure 固有の問題（CORS・SPA・URL）は E2E + deploy verify で二重検証**

### 3.3 弱み

- **フロントエンド（Editor / Next.js）のユニットテストがほぼゼロ**。E2E に依存
- **Web パッケージの抽象化層（IInput, IAudio, IStorage）にテストがない**
- **新規機能（RAG ハイブリッド検索）にユニットテストがない**
- **スキーマパッケージ（packages/schemas）にテストがない**

---

## 4. 追加すべきテスト（優先度順）

### P0: 即座に追加すべき

#### 4-1. RAG ハイブリッド検索 API テスト

**理由**: 今日デプロイした新機能だがユニットテストが存在しない。

```
ファイル: apps/hono/test/rag-hybrid.test.ts（新規）
テスト内容:
  - POST /api/rag/search — 正常検索（query + topK）
  - 認証なしでの 401 レスポンス
  - 空クエリでの 400 バリデーションエラー
  - RAG_DATABASE_URL 未設定時の 500 エラー
```

#### 4-2. Editor ESLint の高優先バグ修正

**理由**: `react-hooks/rules-of-hooks` 違反（BlockList.tsx:146）は実行時バグの可能性。

```
対象: apps/editor/src/components/BlockList.tsx:146
問題: 条件付きフック呼び出し（React のルール違反）
対応: コードを修正し、ルール違反がないことを lint で検証
```

### P1: 短期的に追加すべき

#### 4-3. character-class API ルートテスト

```
ファイル: apps/hono/test/character-class.test.ts（新規）
テスト内容:
  - CRUD 操作（作成・取得・更新・削除）
  - 表情マッピングの正当性検証
  - 認証チェック
```

#### 4-4. editor-schema API テスト

```
ファイル: apps/hono/test/editor-schema.test.ts（新規）
テスト内容:
  - GET /api/editor-schema — 全14ブロック型の定義が返ること
  - レスポンスの Cache-Control ヘッダー検証
  - 認証不要であること
```

#### 4-5. CI での compiler vitest 修正

**理由**: `packages/compiler/package.json` の `"test": "vitest"` が watch モードで CI をブロックする可能性。GitHub Actions では `CI=true` で自動的に run モードになるが、ローカルの `npm test` はハングする。

```diff
# packages/compiler/package.json, packages/ksc-compiler/package.json, packages/web/package.json
- "test": "vitest",
+ "test": "vitest run",
```

### P2: 中期的に追加すべき

#### 4-6. Web パッケージの抽象化層テスト

```
対象:
  - packages/web/src/engine/LayerManager.ts — レイヤー順序・show/hide
  - packages/web/src/engine/SoundManager.ts — BGM/SE/Voice 再生・停止
  - packages/web/src/engine/InputDispatcher.ts — アクション dispatch
推定工数: 各 1-2 時間
```

#### 4-7. Next.js 認証コンテキストのユニットテスト

```
対象: apps/next/lib/contexts/AuthContext.tsx
テスト内容:
  - トークン保存・取得・クリア
  - 期限切れトークンのリフレッシュ
  - 未認証時のリダイレクト
推定工数: 2-3 時間
```

#### 4-8. Editor 主要コンポーネントのテスト

```
対象（最優先の 5 コンポーネント）:
  - BlockList.tsx — ブロック追加・削除・並び替え
  - SidebarInspector.tsx — プロパティ編集
  - TimelinePanel.tsx — キーフレーム操作
  - CharacterEditModal.tsx — キャラクター設定
  - AssetManagementPanel.tsx — アセット管理
テストフレームワーク: vitest + @testing-library/react
推定工数: 各 2-3 時間
```

### P3: 長期的に検討

#### 4-9. カバレッジ計測の CI 導入

```yaml
# ci.yml に追加
- run: npm test -- --coverage
- name: Upload coverage
  uses: codecov/codecov-action@v4
```

#### 4-10. schemas パッケージのテスト

```
対象: packages/schemas/
テスト内容: Zod スキーマの parse/safeParse 検証（正常値・異常値）
```

---

## 5. 今日の対策計画（03-GAP-COUNTERMEASURE-PLAN）の実施状況

| タスク | 計画 | 実施状況 |
|-------|------|---------|
| 1-1. typecheck 対象拡大 | P0 | **完了** ✅ |
| 1-2. lint スクリプト実装 | P1 | **完了** ✅（Next.js のみ、Editor は別途） |
| 1-3. build 対象拡大 | P1 | **完了** ✅ |
| 1-4. pre-push フック追加 | P0 | **完了** ✅（Editor lint 除外で調整済み） |
| 2-2. CI に lint ジョブ追加 | P1 | **完了** ✅ |
| 2-3. Docker ビルドテスト | P2 | 未実施（GitHub Actions デプロイで代替） |
| 2-4. Prisma migration status チェック | P1 | **完了** ✅ |
| 3-1. deploy-azure.sh に pre-flight 追加 | P0 | **完了** ✅ |
| 3-2. デプロイ後検証強化 | P2 | **完了** ✅（CORS + SPA verify） |
| 4-1. テスト品質チェック | P2 | 未実施 |
| 4-2. Azure E2E テンプレート | P3 | 未実施 |
| 4-3. PR テンプレート | P3 | **完了** ✅ |

**達成率: 9/12 (75%)**

---

## 6. インシデント記録

### pre-push lint ブロック（04-PRE-PUSH-LINT-INCIDENT.md）

- **原因**: Editor の ESLint 設定は存在したが、CI / pre-push で一度も実行されていなかった（約50件のエラーが蓄積）
- **対応**: pre-push / CI の lint を Next.js のみに絞り、Editor は別途修正タスクとした
- **教訓**: 新しいガードを導入する前に、既存コードベースでの実行結果を確認すること

---

## 7. 総合評価

### テスト網羅性

```
                    テストあり    テストなし
コア基盤 (engine)   ████████████  ░░            高
API ルート          ████████████  ░░░░          中-高
E2E フロー          ████████████  ░░            高
フロントエンド      ░░            ████████████  極低
Web 抽象化層        ░░░░          ████████████  低
```

### 結論

1. **バックエンド・エンジン層のテストは十分**。CI + pre-push で型・lint エラーも検出可能になった
2. **フロントエンド（Editor / Next.js）のユニットテストが大幅に不足**。E2E テストが主要フローをカバーしているため実害は限定的だが、リファクタリングやバグ調査時にリグレッションを検出できない
3. **新機能（RAG ハイブリッド検索）のテストが欠落**。最優先で追加すべき
4. **Editor の ESLint 技術的負債**（約50件）は中期的に解消が必要。特に `rules-of-hooks` 違反は潜在的バグ

### 推奨アクション（優先順）

1. `apps/hono/test/rag-hybrid.test.ts` を作成（P0）
2. `BlockList.tsx:146` の `rules-of-hooks` 違反を修正（P0）
3. vitest の `"test": "vitest"` → `"test": "vitest run"` に修正（P1）
4. 未テストの API ルート（character-class, editor-schema）のテスト追加（P1）
5. Editor / Next.js のユニットテスト導入を中期計画に組み込む（P2）

---

## 参照ドキュメント（RAG 検索で取得）

- `docs/09_reports/2026/03/04/01-RELEASE-TEST-REPORT.md` — リリーステスト結果
- `docs/09_reports/2026/03/04/02-LOCAL-VS-AZURE-TEST-GAP-ANALYSIS.md` — 乖離分析
- `docs/09_reports/2026/03/04/03-GAP-COUNTERMEASURE-PLAN.md` — 対策計画
- `docs/09_reports/2026/03/04/04-PRE-PUSH-LINT-INCIDENT.md` — ESLint インシデント
- `docs/09_reports/2026/02/25/07-test-audit-report.md` — テスト品質監査
- `docs/09_reports/2026/02/25/06-zenn-never-fail-test.md` — テストアンチパターン
- `docs/09_reports/2026/02/19/release-readiness-audit.md` — リリース準備監査

> Generated by Claude Opus 4.6 (RAG-assisted)
