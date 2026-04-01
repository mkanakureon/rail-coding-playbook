---
description: Use when the user asks to create, run, or debug Playwright E2E browser tests. Triggers on "E2Eテスト作って", "Playwrightテスト", "ブラウザテスト".
---

# Playwright E2E Test Skill

Playwright を使用したブラウザ E2E テストの作成・実行・分析を行う。

## ルール

**新規テスト作成時は、必ず既存テストを参考にする。**

1. 下の「画面判別ガイド」でどのカテゴリか判断する
2. `examples/` の該当カテゴリのサンプルを Read で確認する
3. 既存テストの構造をベースに、対象画面のセレクタ・操作・検証に合わせてカスタマイズする
4. 対象画面のコンポーネントを Read で確認し、実際の `data-testid` / `aria-label` / テキストを使う
5. ゼロから書かない — モックデータも対象画面が期待するデータ構造に合わせる

## 画面判別ガイド

ユーザーの指示からテスト対象の画面を判別し、適切なサンプルを選ぶ。

| ユーザーの表現 | カテゴリ | サンプル | パターン |
|---|---|---|---|
| ログイン / 登録 / 認証 / リダイレクト | 認証 | `examples/auth-flow.spec.ts` | 実サーバー (Next.js経由) |
| 管理画面 / ユーザー管理 / ロール / admin | 管理画面 | `examples/admin-panel.spec.ts` | 実サーバー + DB操作 |
| エディタ / ブロック追加 / アセット選択 | エディタ | `examples/editor-asset-selection.spec.ts` | 実サーバー + API login |
| タイムライン / TL / キーフレーム / シーク | TL(モック) | `examples/timeline-mock.spec.ts` | API モック |
| タイムライン + 実データ / TL実行 | TL(実サーバー) | `examples/timeline-real.spec.ts` | 実サーバー + API login |
| バトル / 戦闘 / 敵グループ | バトル | `examples/battle-play.spec.ts` | 実サーバー + API login |
| 全体フロー / 登録〜プレビュー / E2E | フルフロー | `examples/full-flow.spec.ts` | 実サーバー全アプリ |

### パターン選択基準

| 条件 | パターン | 必要なサーバー |
|---|---|---|
| UIの見た目・操作だけ確認したい | API モック | editor のみ |
| データの保存・読み込みも確認したい | 実サーバー + API login | api + editor |
| 認証フローを確認したい | 実サーバー (Next.js経由) | api + next |
| 全アプリ横断で確認したい | フルフロー | all |

## サンプルファイル（examples/）

| ファイル | 画面 | ポイント |
|---|---|---|
| `auth-flow.spec.ts` | 認証 | 登録→ログイン→リダイレクト、Next.jsフォーム操作 |
| `admin-panel.spec.ts` | 管理画面 | APIヘルパー、DB直接操作でadminロール設定 |
| `editor-asset-selection.spec.ts` | エディタ | API login + localStorage注入の標準形 |
| `timeline-mock.spec.ts` | TL(モック) | `page.route()` でAPIモック、サーバー不要 |
| `timeline-real.spec.ts` | TL(実サーバー) | login/createProjectヘルパー |
| `battle-play.spec.ts` | バトル | CRUD全操作 + プレビュー実行 |
| `full-flow.spec.ts` | フルフロー | `test.step()` でライフサイクル全体 |

## テンプレートファイル

| ファイル | 用途 |
|---|---|
| `template-real-server.spec.ts` | 実サーバー接続（login + プロジェクト作成/削除） |
| `template-mock-api.spec.ts` | API モック（サーバー不要でUI単体テスト） |

使い方: テンプレートを `tests/` にコピー → リネーム → 対象画面に合わせて書き換え

## 共通パターン

### URL定義（必須）

```typescript
import { URLS } from './fixtures/urls';
// URLS.NEXT    = http://localhost:3000
// URLS.EDITOR  = http://localhost:5176
// URLS.API     = http://localhost:8080
// URLS.PREVIEW = http://localhost:5175
```

### スクリーンショットヘルパー

```typescript
const SS_DIR = path.join('screenshots', 'YYYY-MM-DD-テスト名');
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}
```

### ログインヘルパー（実サーバーパターン共通）

```typescript
async function login(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  const { token, user } = await res.json();
  await page.addInitScript(
    ({ token, userId }: { token: string; userId: string }) => {
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUserId', userId);
    },
    { token, userId: user.id },
  );
  return { token, userId: user.id };
}
```

## テスト作成手順

1. **画面判別**: 上の「画面判別ガイド」で対象カテゴリとサンプルを特定
2. **サンプルを読む**: `examples/` の該当ファイルを Read で確認
3. **対象画面の確認**: テスト対象のコンポーネント (.tsx) を Read してセレクタを把握
4. **テストファイル作成**: `tests/{機能名}.spec.ts` に作成
5. **実行**: `npx playwright test tests/{機能名}.spec.ts`
6. **失敗時**: スクリーンショットを Read で確認して原因特定

## テスト実行

```bash
# 特定ファイル
npx playwright test tests/battle-block.spec.ts

# 全テスト
npx playwright test

# デバッグモード
npx playwright test --debug
```

## 設定

- **playwright.config.ts**: testDir=`./tests`, Chromium のみ, baseURL=`http://localhost:3000`
- **fixtures/urls.ts**: 環境変数 or localhost デフォルト
- **タイムアウト**: action=10s, navigation=30s, テスト単位で `test.setTimeout(60000)` 可

## セレクタ優先順位

1. `[data-testid="..."]` / `[data-block-id^="..."]` — 安定
2. `text=ボタン名` / `button:has-text("...")` — 可読性高い
3. `[aria-label="..."]` — アクセシビリティ
4. `.class-name` — 変更されやすいので避ける

## ベストプラクティス

- 重要ステップごとにスクリーンショットを撮る（`ss('01-step.png')` で連番）
- `test.setTimeout(60000)` でネットワーク待ちに対応
- `waitForSelector` + `waitUntil: 'networkidle'` でローディング完了を待つ
- `beforeAll` でログイン/プロジェクト作成、`afterAll` でクリーンアップ
- デスクトップ（1280x800）とモバイル（375x812）の両方をテスト
