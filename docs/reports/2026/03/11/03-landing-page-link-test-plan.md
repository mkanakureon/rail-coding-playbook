# ランディングページ リンクテスト計画書

**日付**: 2026-03-11
**目的**: Azure 上のランディングページの全リンクをクリックし、リンク切れ・404 がないことを確認する
**追加先**: Phase 8 として `scripts/test/azure/run-all.sh` に追加

---

## 1. テスト対象リンク一覧

### ランディングページ (`/`) 内のリンク

| # | リンクテキスト | パス | 種別 |
|---|---------------|------|------|
| 1 | ログイン | `/login` | Auth |
| 2 | 詳細な導入ガイド | `/docs` | Docs |
| 3 | 操作説明書（図解） | `/docs/block-guide` | Docs |
| 4 | もっと見る（作品） | `/works` | Works |
| 5 | ハイブリッド・エディタ | `/docs/hybrid-editor` | Docs |
| 6 | すぐに公開・プレビュー | `/docs/realtime-preview` | Docs |
| 7 | 対応状況を見る | `/docs/platform-support` | Docs |
| 8 | Claude Code 自己紹介 | `/docs/ai-profile-claude-code` | Docs |
| 9 | Gemini CLI 自己紹介 | `/docs/ai-profile-gemini-cli` | Docs |
| 10 | 開発日誌 | `/devlog` | Docs |
| 11 | ソースコード説明書 | `/docs/codebase` | Docs |
| 12 | 詳細なロードマップを見る | `/docs/roadmap-2026` | Docs |
| 13 | About | `/about` | Info |
| 14 | お問い合わせ | `/contact` | Info |
| 15 | 利用規約 | `/terms` | Legal |
| 16 | プライバシーポリシー | `/privacy` | Legal |
| 17 | 素材ライセンス | `/docs/asset-license` | Legal |

### About ページ (`/about`) 内のリンク

| # | リンクテキスト | パス | 種別 |
|---|---------------|------|------|
| 18 | Switch最小構成の設計 | `/docs/dev-stories/switch-minimum-spec` | DevStory |
| 19 | SDL2 VM境界の設計 | `/docs/dev-stories/sdl2-vm-boundary` | DevStory |
| 20 | コンパイラ Phase5 | `/docs/dev-stories/compiler-phase5-crossroads` | DevStory |

### ドキュメントハブ (`/docs`) からの主要リンク

| # | パス | 種別 |
|---|------|------|
| 21 | `/docs/why-kaedevn` | Guide |
| 22 | `/docs/getting-started` | Guide |
| 23 | `/docs/editor-guide` | Guide |
| 24 | `/docs/block-types` | Guide |
| 25 | `/docs/timeline-guide` | Guide |
| 26 | `/docs/character-setup` | Guide |
| 27 | `/docs/asset-management` | Guide |
| 28 | `/docs/guest-mode` | Guide |
| 29 | `/docs/publishing-works` | Guide |
| 30 | `/docs/faq` | Guide |
| 31 | `/docs/how-engine-works` | Tech |
| 32 | `/docs/performance-comparison` | Tech |
| 33 | `/docs/multiplatform-sdl2` | Tech |
| 34 | `/docs/universal-assets` | Tech |
| 35 | `/docs/battle-system` | Tech |
| 36 | `/docs/ai-writing-assist` | Tech |
| 37 | `/docs/ks-script-spec` | Tech |
| 38 | `/docs/ksc-script-spec` | Tech |
| 39 | `/docs/community-guidelines` | Legal |

---

## 2. テスト方針

### アプローチ: Playwright E2E

- **認証不要** — 全て公開ページなのでログイン不要
- **テスト方法**: 各ページに `goto()` → ステータス 200 & メインコンテンツの存在を確認
- **リンク発見**: ランディングページの `<a>` タグを自動収集 + 既知リンクの明示的チェック

### テスト構成

```
tests/azure/azure-landing-links.spec.ts
```

3つの `test.describe`:

1. **ランディングページのリンク** (17 テスト)
   - `/` にアクセス
   - 各内部リンクをクリック → 200 & コンテンツ存在を確認
   - 外部リンク（Twitter 等）はスキップ

2. **About ページのリンク** (3 テスト)
   - `/about` にアクセス
   - dev-stories 3本のリンクをクリック → 200 & コンテンツ確認

3. **ドキュメントハブのリンク** (19 テスト)
   - `/docs` にアクセス
   - 各ドキュメントページへ遷移 → 200 & コンテンツ確認

**合計: 約 39 テスト**

### テスト実装パターン

```typescript
// 各リンクのテスト
test('リンク: /docs/block-guide', async ({ page }) => {
  await page.goto(`${NEXT_URL}/docs/block-guide`);
  // 404ページでないことを確認
  await expect(page.locator('h1, h2, [role="heading"]').first()).toBeVisible();
  // 404 テキストが含まれないことを確認
  await expect(page.locator('text=404')).not.toBeVisible();
});
```

### 効率化: データ駆動テスト

全リンクを配列で定義し、`for...of` でテストを生成する:

```typescript
const LANDING_LINKS = [
  { path: '/login', label: 'ログイン' },
  { path: '/docs', label: 'ドキュメント' },
  { path: '/docs/block-guide', label: '操作説明書' },
  // ...
];

for (const link of LANDING_LINKS) {
  test(`${link.label} (${link.path}) が正常に表示される`, async ({ page }) => {
    const res = await page.goto(`${NEXT_URL}${link.path}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main, [role="main"], article, .container').first())
      .toBeVisible({ timeout: 10_000 });
  });
}
```

---

## 3. Phase 8 追加手順

### 3-1. テストファイル作成

```
tests/azure/azure-landing-links.spec.ts
```

### 3-2. Phase スクリプト作成

```bash
# scripts/test/azure/landing-links.sh
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/env.sh"
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo ""
echo "=== Phase 8: Landing Page Link Verification ==="
echo ""

npx playwright test -c tests/configs/playwright.azure.config.ts \
  tests/azure/azure-landing-links.spec.ts \
  --reporter=list

exit $?
```

### 3-3. run-all.sh 更新

- `MAX_PHASE` を 8 に変更
- `PHASE8_RESULTS=()` 配列追加
- Phase 8 実行ブロック追加
- サマリーに Phase 8 を追加

---

## 4. 判断基準

| 項目 | 合格条件 |
|------|---------|
| HTTP ステータス | 200（リダイレクトは最終ステータスで判定） |
| コンテンツ | `main` or `article` or `.container` 要素が visible |
| 404 | 「404」「ページが見つかりません」テキストが表示されない |
| タイムアウト | 各ページ 15 秒以内にロード完了 |

---

## 5. 実装順序

1. `tests/azure/azure-landing-links.spec.ts` を作成
2. ローカルで `npx playwright test tests/azure/azure-landing-links.spec.ts -c tests/configs/playwright.azure.config.ts` を実行して全パス確認
3. `scripts/test/azure/landing-links.sh` を作成
4. `scripts/test/azure/run-all.sh` に Phase 8 を追加
5. `./scripts/test/azure/run-all.sh --phase 8` で統合テスト確認

---

## 6. 見積り

- ファイル数: 3（テスト 1 + スクリプト 2 修正）
- テスト数: 約 39
- 実行時間: 約 60-90 秒（認証不要・ページ表示のみ）
