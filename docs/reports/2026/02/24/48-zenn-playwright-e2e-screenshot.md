---
title: "Playwright E2E テストと日付別スクリーンショット管理"
emoji: "📸"
type: "tech"
topics: ["claudecode", "playwright", "testing", "typescript"]
published: false
---

## はじめに

ビジュアルノベルエンジン「kaedevn」のエディタは、7 種類の画面カテゴリ（認証、管理画面、エディタ、タイムライン、バトル、フルフロー）を持つ Web アプリケーションです。これらの画面を E2E テストで網羅するために、Playwright を使ったテスト基盤を構築しました。

特にこだわったのは、テスト失敗時のスクリーンショットを日付別フォルダで管理する仕組みと、Claude Code が新しいテストを自動生成できるスキル定義です。

## テスト基盤の設計

### 画面判別ガイド

7 種類の画面にはそれぞれ異なるテストパターンが必要です。スキル定義にこの判別ガイドを書くことで、Claude Code がテスト対象の画面に応じて適切なパターンを選択できます。

| ユーザーの表現 | カテゴリ | サンプル | パターン |
|---|---|---|---|
| ログイン / 登録 / 認証 | 認証 | `auth-flow.spec.ts` | 実サーバー (Next.js 経由) |
| 管理画面 / ユーザー管理 / admin | 管理画面 | `admin-panel.spec.ts` | 実サーバー + DB 操作 |
| エディタ / ブロック追加 | エディタ | `editor-asset-selection.spec.ts` | 実サーバー + API login |
| タイムライン / キーフレーム | TL (モック) | `timeline-mock.spec.ts` | API モック |
| バトル / 戦闘 / 敵グループ | バトル | `battle-play.spec.ts` | 実サーバー + API login |
| 全体フロー / 登録〜プレビュー | フルフロー | `full-flow.spec.ts` | 実サーバー全アプリ |

### パターン選択の基準

テストで何を確認したいかによって、パターンが変わります。

| 条件 | パターン | 必要なサーバー |
|---|---|---|
| UI の見た目・操作だけ確認したい | API モック | editor のみ |
| データの保存・読み込みも確認したい | 実サーバー + API login | api + editor |
| 認証フローを確認したい | 実サーバー (Next.js 経由) | api + next |
| 全アプリ横断で確認したい | フルフロー | all |

API モックパターンはサーバー不要で高速にテストできますが、実際のデータ永続化は検証できません。実サーバーパターンは遅くなりますが、API 経由のデータフローを含めて検証できます。

## スクリーンショットヘルパー

テストの各ステップでスクリーンショットを撮り、日付別フォルダに保存します。

```typescript
import * as fs from 'fs';
import * as path from 'path';

const SS_DIR = path.join('screenshots', '2026-02-24-editor-asset');
function ss(filename: string): string {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
  return path.join(SS_DIR, filename);
}
```

### ディレクトリ構成

```
screenshots/
  ├── 2026-02-20-auth-flow/
  │   ├── 01-login-page.png
  │   ├── 02-after-login.png
  │   └── 03-redirect.png
  ├── 2026-02-21-battle-block/
  │   ├── 01-battle-setup.png
  │   └── 02-battle-play.png
  └── 2026-02-24-editor-asset/
      ├── 01-editor-loaded.png
      ├── 02-asset-panel.png
      └── 10-mobile-loaded.png
```

### 日付別管理の利点

1. **時系列での変化追跡**: 同じ画面のスクリーンショットを日付順に比較できる
2. **テスト失敗時の原因特定**: 「いつから壊れたか」をスクリーンショットの日付で追える
3. **上書き防止**: 日付が違えばフォルダが分かれるため、過去のスクリーンショットが消えない
4. **Claude Code との連携**: `Read` ツールで特定日付のスクリーンショットを確認できる

### 連番ルール

ファイル名は `01-`, `02-` のように連番を振ります。デスクトップテストは `01-09`、モバイルテストは `10-19` の番号を使います。これにより、ファイル一覧で表示順が安定し、デスクトップとモバイルが混在しません。

```typescript
// デスクトップ
await page.screenshot({ path: ss('01-editor-loaded.png'), fullPage: true });
await page.screenshot({ path: ss('02-asset-panel.png'), fullPage: true });

// モバイル
await page.screenshot({ path: ss('10-mobile-loaded.png'), fullPage: true });
await page.screenshot({ path: ss('11-mobile-swipe.png'), fullPage: true });
```

## ログインヘルパー

実サーバーパターンでは、テスト前にログインが必要です。ログインヘルパーは API を直接呼び出し、取得したトークンを `localStorage` に注入します。

```typescript
async function login(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${URLS.API}/api/auth/login`, {
    data: { email: 'test1@example.com', password: 'DevPass123!' },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
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

### なぜ UI 経由のログインではないのか

ログインフォームを UI で操作する方法もありますが、以下の理由で API 直接呼び出しを採用しています。

- **速度**: UI 操作は数秒かかるが、API 呼び出しは数百ミリ秒
- **安定性**: フォームの DOM 構造変更に影響されない
- **テスト対象の分離**: ログインのテストは `auth-flow.spec.ts` に任せ、他のテストはログイン処理を前提条件として扱う

### `addInitScript` の仕組み

`page.addInitScript()` はページが読み込まれる前に実行されるスクリプトを登録します。ページ遷移が発生しても、登録したスクリプトが毎回実行されるため、`localStorage` のトークンが常に設定された状態になります。

## プロジェクト作成・削除ヘルパー

エディタのテストでは、テスト用のプロジェクトを作成し、テスト完了後に削除します。

```typescript
async function createProject(
  page: import('@playwright/test').Page,
  token: string,
  title: string,
) {
  const res = await page.request.post(`${URLS.API}/api/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  if (!res.ok()) {
    throw new Error(`Create project failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.project?.id || body.id;
}

async function deleteProject(
  page: import('@playwright/test').Page,
  token: string,
  projectId: string,
) {
  await page.request.delete(`${URLS.API}/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

これらのヘルパーは `beforeAll` / `afterAll` で呼び出します。

```typescript
test.describe('エディタ操作テスト', () => {
  let token: string;
  let userId: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const creds = await login(page);
    token = creds.token;
    userId = creds.userId;
    projectId = await createProject(page, token, 'テスト用プロジェクト');
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (projectId && token) {
      const page = await browser.newPage();
      await deleteProject(page, token, projectId);
      await page.close();
    }
  });

  // テストケース
});
```

### なぜ `beforeEach` ではなく `beforeAll` か

プロジェクト作成は API 呼び出しを伴うため、各テストケースの前に実行すると遅くなります。`beforeAll` で 1 回だけ作成し、全テストケースで共有します。`afterAll` で確実に削除することで、テスト用データが残り続ける問題も防ぎます。

## テンプレートファイル

新しいテストを書く際の出発点として、2 種類のテンプレートを用意しています。

| ファイル | 用途 |
|---|---|
| `template-real-server.spec.ts` | 実サーバー接続パターン |
| `template-mock-api.spec.ts` | API モックパターン |

### 実サーバーテンプレートの構造

```typescript
test('デスクトップでの基本操作', async ({ page }) => {
  test.setTimeout(60000);

  // ログイン状態セット
  await page.addInitScript(
    ({ t, u }: { t: string; u: string }) => {
      localStorage.setItem('authToken', t);
      localStorage.setItem('currentUserId', u);
    },
    { t: token, u: userId },
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${URLS.EDITOR}/projects/editor/${projectId}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('.editor-layout', { timeout: 15000 });
  await page.screenshot({ path: ss('01-editor-loaded.png'), fullPage: true });

  // ===== ここにテスト内容を書く =====
});

test('モバイルでの基本操作', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  // ...
});
```

テンプレートのポイントは以下です。

- **デスクトップ (1280x800) とモバイル (375x812) の両方** をテスト
- **`test.setTimeout(60000)`** でネットワーク待ちに対応
- **`waitUntil: 'networkidle'`** でローディング完了を待つ
- **`waitForSelector`** で特定の要素が表示されるまで待つ

## URL 定義の一元管理

4 つのサーバーの URL を一元管理しています。

```typescript
import { URLS } from './fixtures/urls';
// URLS.NEXT    = http://localhost:3000
// URLS.EDITOR  = http://localhost:5176
// URLS.API     = http://localhost:8080
// URLS.PREVIEW = http://localhost:5175
```

環境変数があればそれを使い、なければ localhost のデフォルト値を使います。本番環境でのテストも URL を変更するだけで対応可能です。

## セレクタ戦略

テストの安定性はセレクタの選び方で大きく変わります。優先順位を決めて運用しています。

```
1. [data-testid="..."] / [data-block-id^="..."] — 最も安定
2. text=ボタン名 / button:has-text("...")      — 可読性高い
3. [aria-label="..."]                          — アクセシビリティ
4. .class-name                                 — 変更されやすいので避ける
```

`data-testid` はテスト専用の属性で、CSS やリファクタリングの影響を受けません。エディタの各ブロックには `data-block-id` を付与しており、特定のブロックを安定して選択できます。

## Claude Code スキルとの連携

このテスト基盤は Claude Code のスキルとして定義しています。スキル定義には以下の情報が含まれています。

1. **画面判別ガイド**: ユーザーの指示からテスト対象を特定
2. **サンプルファイル一覧**: 7 種類のサンプルテスト
3. **テンプレート**: 2 種類のテンプレート
4. **共通パターン**: URL 定義、スクリーンショットヘルパー、ログインヘルパー
5. **セレクタ優先順位**: 安定したセレクタの選び方
6. **テスト作成手順**: 6 ステップの手順

この情報があることで、Claude Code に「エディタのアセット選択をテストして」と指示するだけで、以下の処理が自動で行われます。

1. 画面判別ガイドから「エディタ」カテゴリを特定
2. `editor-asset-selection.spec.ts` サンプルを参照
3. テンプレートをベースに、アセット選択に特化したテストを生成
4. 対象コンポーネントの実際のセレクタを確認して使用

### 「ゼロから書かない」ルール

スキル定義で最も重要なルールは「ゼロから書かない」です。

```markdown
## ルール
**新規テスト作成時は、必ず既存テストを参考にする。**

1. 画面判別ガイドでカテゴリを判断
2. examples/ の該当サンプルを Read で確認
3. 既存テストの構造をベースにカスタマイズ
4. 対象画面のコンポーネントを Read で実際のセレクタを確認
5. ゼロから書かない
```

AI がゼロからテストを書くと、ヘルパー関数の存在を知らずに冗長なコードを生成したり、URL を直接書いてしまったりします。既存テストを参考にすることで、プロジェクトのテスト規約に沿ったコードが生成されます。

## ベストプラクティス

実際の運用で効果があったベストプラクティスをまとめます。

### 1. 重要ステップごとにスクリーンショット

```typescript
await page.screenshot({ path: ss('01-before-click.png') });
await page.click('[data-testid="submit"]');
await page.screenshot({ path: ss('02-after-click.png') });
```

テストが失敗した場合、「どのステップで失敗したか」がスクリーンショットの連番で分かります。

### 2. `waitForSelector` + `networkidle`

```typescript
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.target-element', { timeout: 15000 });
```

`waitForTimeout` でハードコードされた時間を待つのではなく、`waitForSelector` で実際の要素の表示を待ちます。これにより、ネットワーク速度に左右されないテストになります。

### 3. テスト単位のタイムアウト設定

```typescript
test('データ量の多い操作', async ({ page }) => {
  test.setTimeout(60000); // 60秒
  // ...
});
```

デフォルトのタイムアウトでは足りない操作（画像アップロード、大量データの読み込みなど）に対して、テスト単位でタイムアウトを設定します。

## まとめ

| 要素 | 内容 |
|---|---|
| スクリーンショット管理 | 日付別フォルダ + 連番ファイル名 |
| 画面判別 | 7 カテゴリ x 4 パターン |
| ログイン | API 直接呼び出し + `addInitScript` |
| テンプレート | 実サーバー / API モックの 2 種類 |
| セレクタ | `data-testid` 優先の 4 段階 |
| AI 連携 | スキル定義で自動テスト生成 |

---

E2E テストは「書くコスト」が高いため敬遠されがちですが、テンプレートとヘルパーを整備し、Claude Code にスキルとして教えることで、テスト作成のハードルが大幅に下がりました。日付別スクリーンショットは小さな工夫ですが、テスト失敗の原因特定において最も役立つ仕組みです。スクリーンショットは「テストが何を見ていたか」の証拠であり、「いつから壊れたか」のタイムラインです。

　　　　　　　　　　Claude Opus 4.6
