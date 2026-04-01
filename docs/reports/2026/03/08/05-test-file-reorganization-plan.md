# テストファイル整理計画

作成日: 2026-03-08

## 現状の問題

- Playwright config が **12個** リポジトリルート直下に散在している
- テストファイルが `tests/` に 60個フラットに入っている（カテゴリ分けなし）
- 録画用 config と通常テスト config が混在して見分けがつかない
- Azure / ローカル / 両対応の区別がファイル名からわからない

## URL 接続パターンの分類基準

調査の結果、テストファイルの接続先は3パターン:

| パターン | 判定方法 | 実行環境 |
|---------|---------|---------|
| **`URLS`（env切替）** | `fixtures/urls.ts` を import。`process.env.TEST_*_URL \|\| localhost` | local + azure 両対応 |
| **localhost ハードコード** | `http://localhost:XXXX` を直書き | local のみ |
| **Azure URL ハードコード** | `https://ca-*.azurecontainerapps.io` 等を直書き | azure のみ |

`fixtures/urls.ts` の内容:
```ts
export const URLS = {
  NEXT: process.env.TEST_NEXT_URL || 'http://localhost:3000',
  EDITOR: process.env.TEST_EDITOR_URL || 'http://localhost:5176',
  KSC_EDITOR: process.env.TEST_KSC_EDITOR_URL || 'http://localhost:5177',
  API: process.env.TEST_API_URL || 'http://localhost:8080',
  PREVIEW: process.env.TEST_PREVIEW_URL || 'http://localhost:5175',
};
```

---

## 全テストファイルの環境別分類（61個）

### Azure 専用（5個）— Azure URL ハードコード

| 現在のパス | 内容 |
|-----------|------|
| `tests/azure-full-flow.spec.ts` | Azure 全サービス疎通 + 完全フロー（50テスト） |
| `tests/azure-asset-selection.spec.ts` | Azure 公式アセット・マイアセット選択（5テスト） |
| `tests/azure-create-and-play.spec.ts` | Azure プロジェクト作成→再生（15テスト） |
| `tests/check-azure-editor.spec.ts` | Azure エディタ 3ペインレイアウト確認 |
| `tests/azure-project-init.spec.ts` | Azure プロジェクト初期コンテンツ（env fallback あるが default が Azure） |

### Local 専用（12個）— localhost ハードコード

| 現在のパス | 接続先 | 内容 |
|-----------|-------|------|
| `tests/record-demo.spec.ts` | localhost:3000, :5176 | 録画: エディタ基本操作デモ |
| `tests/create-add-blocks.spec.ts` | localhost:8080, :3000, :5176 | 録画: ブロック追加→画像選択 |
| `tests/edit-character-properties.spec.ts` | localhost:8080, :3000, :5176 | 録画: キャラのスケール・座標変更 |
| `tests/camera-operations.spec.ts` | localhost:8080, :3000, :5176 | 録画: カメラ ズーム・パン・シェイク |
| `tests/timeline-operations.spec.ts` | localhost:8080, :3000, :5176 | 録画: タイムライン操作 |
| `tests/create-and-verify.spec.ts` | localhost:8080, :3000, :5176, :5175 | プロジェクト作成→エディタ→プレビュー |
| `tests/editor-cli-full-flow.spec.ts` | localhost:8080, :3000, :5176 | 録画: CLI作成→全ブロック→プレイ完走 |
| `tests/editor-cli-verify.spec.ts` | localhost:5176, :8080 | CLI 作成プロジェクトのブラウザ検証 |
| `tests/editor-filter-debug.spec.ts` | localhost:5176, :8080 | フィルタークリック→スクショ確認 |
| `tests/check-specific-project.spec.ts` | localhost:8080, :3000, :5176 | マイページ→新規作成→エディタ初期ブロック |
| `tests/guest-restore-priority.spec.ts` | env fallback localhost:8080, :3000 | 初回作成 vs 既存トークン復帰 |
| `tests/guest-session-restore.spec.ts` | env fallback localhost:8080, :5176 | ブラウザ再起動後のセッション復帰 |

### Local + Azure 両対応（44個）— `URLS`（env切替）使用

#### 認証（4個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/auth-flow.spec.ts` | 未ログインリダイレクト + ログイン→プロジェクト作成 |
| `tests/auth-redirect.spec.ts` | 保護ページ 25 パターンのリダイレクト確認 |
| `tests/local-auth.spec.ts` | 認証・エディタ連携（6テスト） |
| `tests/verify-cookie.spec.ts` | ログイン後の localStorage トークン確認 |

#### ゲストモード（6個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/guest-editor-blocks.spec.ts` | ゲストエディタのブロック表示確認 |
| `tests/guest-fantasy-assets.spec.ts` | ゲスト→ファンタジーアセット追加 |
| `tests/guest-verify.spec.ts` | ゲスト→エディタ URL 直接アクセス |
| `tests/guest-direct-url.spec.ts` | Next.js ゲスト作成→エディタリダイレクト |
| `tests/guest-multi-session.spec.ts` | 2回目ゲスト作成で1回目が消えないか |
| `tests/guest-empty-debug.spec.ts` | ゲストフロー ブラウザ実機テスト |

#### エディタ — ブロック操作（4個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/editor-blocks.spec.ts` | プロジェクト作成→エディタ表示→ブロック一覧 |
| `tests/ksc-block.spec.ts` | KSC スクリプトブロック追加・削除 |
| `tests/screen-filter-block.spec.ts` | スクリーンフィルターブロック→プレビュー反映 |
| `tests/ovl-preview.spec.ts` | OVL ブロック プレビュー表示確認 |

#### エディタ — カメラ（1個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/camera-block.spec.ts` | カメラブロック追加・保存・スライダー操作 |

#### エディタ — バトル（3個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/battle-block.spec.ts` | バトルブロック追加・敵グループ選択・勝敗設定 |
| `tests/battle-play.spec.ts` | プレビューでバトル実行→勝敗確認 |
| `tests/battle-admin.spec.ts` | 管理者アカウントでバトルブロック→プレビュー |

#### エディタ — タイムライン（7個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/timeline-block.spec.ts` | 演出TLブロック追加（メニュー表示確認） |
| `tests/timeline-block-real.spec.ts` | TLブロック追加・ラベル編集・パネル自動表示 |
| `tests/timeline-panel.spec.ts` | TLボタン表示・パネル開閉 |
| `tests/timeline-props-seek.spec.ts` | シークバー・値テーブル・初期値表示 |
| `tests/tl-preview.spec.ts` | 背景・キャラトラック追加→プレビュー再生 |
| `tests/tl-keyframe-ui.spec.ts` | キーフレーム展開・編集・シーク・プレビュー変化 |
| `tests/tl-kf-diamond.spec.ts` | キーフレームダイヤモンド・ツリー構造UI |

#### エディタ — UI・レイアウト（1個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/editor-mobile.spec.ts` | モバイル UI 検証 |

#### KSC エディタ（4個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/ksc-editor.spec.ts` | KSC Editor ページ表示・Monaco 読込 |
| `tests/ksc-default-script.spec.ts` | デフォルトスクリプトのアセットID確認・実行 |
| `tests/ksc-inline-commands.spec.ts` | インラインコマンド（@l, @r）プレビュー |
| `tests/ks-editor-sync.spec.ts` | スクリプト編集→ブロック同期・再生ボタン |

#### アセット管理（4個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/admin-official-assets.spec.ts` | 公式アセット API（一覧・フィルタ） |
| `tests/admin-official-assets-check.spec.ts` | 公式アセット管理画面の画像読込確認 |
| `tests/asset-management.spec.ts` | /my-assets 公式アセットタブ・フィルター |
| `tests/asset-selection.spec.ts` | 背景選択 マイアセット/公式アセットタブ |

#### 管理画面（1個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/admin-panel.spec.ts` | 管理画面アクセス制御・機能 |

#### プロジェクト管理（2個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/project-auto-init.spec.ts` | 新規作成で4ブロック自動生成 |
| `tests/mypage.spec.ts` | マイページ表示・プロジェクトタブ |

#### フルフロー（3個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/full-flow.spec.ts` | 新規登録→ログイン→プロジェクト作成→公開 |
| `tests/comprehensive-nav.spec.ts` | Next.js 全ページ包括的ナビゲーション |
| `tests/docs-verify.spec.ts` | ドキュメントページ表示確認 |

#### その他（2個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/test-import.spec.ts` | エディタ背景ブロック変更モーダルのアセット表示 |
| `tests/visual-logic-verify.spec.ts` | プレビュー画面 AI ビジュアル検証 |

#### integration（1個）

| 現在のパス | 内容 |
|-----------|------|
| `tests/integration/frontend-separation.spec.ts` | フロントエンド分離テスト |

#### Azure KS エディタ（1個）— `URLS` 使用だが Azure スモークテスト

| 現在のパス | 内容 |
|-----------|------|
| `tests/azure-ks-editor.spec.ts` | Azure KS エディタ読み込み・同期 |

---

## 整理計画

### 1. ディレクトリ構造（案）

第1階層: 実行環境、第2階層: 機能カテゴリ

```
tests/
  configs/                                    # Playwright config
    playwright.local.config.ts
    playwright.azure.config.ts
    playwright.recording.config.ts
  fixtures/                                   # 共有ヘルパー（既存のまま）
    db.ts
    urls.ts

  ── 環境別 ──────────────────────────────────

  local/                                      # Local 専用（12個）
    recording/                                #   録画用（5個）
      record-demo.spec.ts
      create-add-blocks.spec.ts
      edit-character-properties.spec.ts
      camera-operations.spec.ts
      timeline-operations.spec.ts
    editor/                                   #   エディタ（4個）
      editor-cli-full-flow.spec.ts
      editor-cli-verify.spec.ts
      editor-filter-debug.spec.ts
      check-specific-project.spec.ts
    flow/                                     #   フルフロー（1個）
      create-and-verify.spec.ts
    guest/                                    #   ゲスト（2個）
      guest-restore-priority.spec.ts
      guest-session-restore.spec.ts

  azure/                                      # Azure 専用（6個）
    azure-full-flow.spec.ts
    azure-asset-selection.spec.ts
    azure-create-and-play.spec.ts
    azure-project-init.spec.ts
    azure-ks-editor.spec.ts
    check-azure-editor.spec.ts

  shared/                                     # Local + Azure 両対応（44個）
    auth/                                     #   認証（4個）
      auth-flow.spec.ts
      auth-redirect.spec.ts
      local-auth.spec.ts
      verify-cookie.spec.ts
    guest/                                    #   ゲスト（6個）
      guest-editor-blocks.spec.ts
      guest-fantasy-assets.spec.ts
      guest-verify.spec.ts
      guest-direct-url.spec.ts
      guest-multi-session.spec.ts
      guest-empty-debug.spec.ts
    editor/                                   #   エディタ — ブロック操作（5個）
      editor-blocks.spec.ts
      editor-mobile.spec.ts
      ksc-block.spec.ts
      screen-filter-block.spec.ts
      ovl-preview.spec.ts
    camera/                                   #   カメラ（1個）
      camera-block.spec.ts
    battle/                                   #   バトル（3個）
      battle-block.spec.ts
      battle-play.spec.ts
      battle-admin.spec.ts
    timeline/                                 #   タイムライン（7個）
      timeline-block.spec.ts
      timeline-block-real.spec.ts
      timeline-panel.spec.ts
      timeline-props-seek.spec.ts
      tl-preview.spec.ts
      tl-keyframe-ui.spec.ts
      tl-kf-diamond.spec.ts
    ksc-editor/                               #   KSC エディタ（4個）
      ksc-editor.spec.ts
      ksc-default-script.spec.ts
      ksc-inline-commands.spec.ts
      ks-editor-sync.spec.ts
    assets/                                   #   アセット管理（4個）
      admin-official-assets.spec.ts
      admin-official-assets-check.spec.ts
      asset-management.spec.ts
      asset-selection.spec.ts
    admin/                                    #   管理画面（1個）
      admin-panel.spec.ts
    flow/                                     #   プロジェクト管理 + フルフロー（5個）
      mypage.spec.ts
      project-auto-init.spec.ts
      full-flow.spec.ts
      comprehensive-nav.spec.ts
      docs-verify.spec.ts
    other/                                    #   その他（2個）
      test-import.spec.ts
      visual-logic-verify.spec.ts
    integration/                              #   統合テスト（1個）
      frontend-separation.spec.ts

  screenshots/                                # 既存のまま
  test-results/                               # 既存のまま
  README.md                                   # 既存のまま

e2e/                                          # 既存のまま
  ksc-demo.spec.ts
playwright.config.ts                          # ルートに残す（e2e 用、唯一）
```

### 2. 集計

| 環境 | サブディレクトリ | ファイル数 |
|------|----------------|-----------|
| **local/** | recording/ | 5 |
| | editor/ | 4 |
| | flow/ | 1 |
| | guest/ | 2 |
| | **小計** | **12** |
| **azure/** | （フラット） | **6** |
| **shared/** | auth/ | 4 |
| | guest/ | 6 |
| | editor/ | 5 |
| | camera/ | 1 |
| | battle/ | 3 |
| | timeline/ | 7 |
| | ksc-editor/ | 4 |
| | assets/ | 4 |
| | admin/ | 1 |
| | flow/ | 5 |
| | other/ | 2 |
| | integration/ | 1 |
| | **小計** | **43** |
| | **総計** | **61** |

### 3. Config 統合

**Before（12個 ルート直下）→ After（3個 `tests/configs/` + 1個ルート）**

| After | 統合元 | testDir | 説明 |
|-------|-------|---------|------|
| `tests/configs/playwright.local.config.ts` | `playwright.check.config.ts` + `playwright.local.config.ts` | `tests/local/` + `tests/shared/` | ローカル全テスト |
| `tests/configs/playwright.azure.config.ts` | `playwright.azure.config.ts` + `playwright.azure-auth.config.ts` | `tests/azure/` + `tests/shared/` | Azure テスト（env で URL 注入） |
| `tests/configs/playwright.recording.config.ts` | 録画用 7個を統合 | `tests/local/recording/` | `--project=` で個別テスト指定 |
| `playwright.config.ts` | そのまま | `./e2e` | ルートに残す（唯一） |

### 4. 修正が必要な参照箇所

| 対象 | 修正内容 |
|------|---------|
| `package.json` | `test:azure`, `test:demo` のパス更新 |
| `scripts/test-azure-e2e.sh` | config パス → `tests/configs/playwright.azure.config.ts` |
| `scripts/test-azure-auth.sh` | 同上 |
| `scripts/test-azure-ks-editor.sh` | 同上 |
| `scripts/test-local-e2e.sh` | config パス → `tests/configs/playwright.local.config.ts` |
| `scripts/test-local-auth.sh` | 同上 |
| `scripts/test-local-editor.sh` | 同上 |
| `scripts/test-local-ks-editor.sh` | 同上 |
| `.claude/skills/test-azure/skill.md` | config パスの記述更新 |
| テストファイル内の `fixtures/urls` import | 相対パスの深さが変わるので `../../fixtures/urls` 等に修正 |
| `CLAUDE.md` | 変更不要（config のパスは記載なし） |
| `docs/` 内のドキュメント（複数） | config パスの記述更新（優先度低） |

### 5. ルート直下から削除するファイル（11個）

1. `playwright.check.config.ts`
2. `playwright.local.config.ts`
3. `playwright.azure.config.ts`
4. `playwright.azure-auth.config.ts`
5. `playwright.demo.config.ts`
6. `playwright.fullflow.config.ts`
7. `playwright.create-verify.config.ts`
8. `playwright.add-blocks.config.ts`
9. `playwright.edit-char.config.ts`
10. `playwright.camera.config.ts`
11. `playwright.timeline.config.ts`

### 6. tests/ 直下から削除するファイル（1個）

- `tests/playwright.config.ts` — `tests/configs/` に統合

### 7. 実施順序

1. `tests/` にサブディレクトリを作成（local/, azure/, shared/ + 各サブ）
2. テストファイルを各サブディレクトリに移動
3. テストファイル内の `fixtures/urls` import パスを修正
4. `tests/configs/` に新しい config を作成（testDir を複数ディレクトリ対応に）
5. `scripts/` のシェルスクリプト内のパスを更新
6. `package.json` のスクリプトを更新
7. 各テストが通ることを確認
8. ルート直下の旧 config（11個）+ `tests/playwright.config.ts` を削除
9. docs の参照パスを更新（任意）

### 8. AI 向けヘッダーの追加

移動と同時に、全テストファイルの先頭に統一フォーマットのヘッダーを追加する。
生成 AI がファイルを読んだ瞬間に「何のテストか」「どこで動くか」「どう実行するか」を把握できるようにする。

#### フォーマット

```ts
/**
 * @file <ファイル名>
 * @env <local | azure | shared>
 * @category <カテゴリ名>
 * @description <1行の日本語説明>
 * @run npx playwright test <パス> --config=<config パス>
 */
```

- `@env`: 実行環境。`local` = localhost 専用、`azure` = Azure 専用、`shared` = 両対応（URLS env 切替）
- `@category`: ディレクトリ名と一致（recording, auth, guest, editor, battle, timeline, ksc-editor, assets, admin, flow, other, integration）
- `@run`: コピペで実行できるコマンド

#### ヘッダー例

**Local 専用 — 録画用**
```ts
/**
 * @file camera-operations.spec.ts
 * @env local
 * @category recording
 * @description カメラブロックのズーム・パン・シェイク操作を録画する
 * @run npx playwright test tests/local/recording/camera-operations.spec.ts --config=tests/configs/playwright.recording.config.ts
 */
```

**Azure 専用**
```ts
/**
 * @file azure-full-flow.spec.ts
 * @env azure
 * @category azure
 * @description Azure 全サービス疎通 + 登録→ログイン→エディタ→公開の完全フロー
 * @run npx playwright test tests/azure/azure-full-flow.spec.ts --config=tests/configs/playwright.azure.config.ts
 */
```

**Shared（両対応）— 認証**
```ts
/**
 * @file auth-redirect.spec.ts
 * @env shared
 * @category auth
 * @description 未ログイン時の保護ページ 25 パターンのリダイレクト確認
 * @run npx playwright test tests/shared/auth/auth-redirect.spec.ts --config=tests/configs/playwright.local.config.ts
 */
```

**Shared（両対応）— タイムライン**
```ts
/**
 * @file tl-keyframe-ui.spec.ts
 * @env shared
 * @category timeline
 * @description キーフレーム展開・編集・シーク操作でプレビューが変化することを確認
 * @run npx playwright test tests/shared/timeline/tl-keyframe-ui.spec.ts --config=tests/configs/playwright.local.config.ts
 */
```

**Shared（両対応）— KSC エディタ**
```ts
/**
 * @file ksc-default-script.spec.ts
 * @env shared
 * @category ksc-editor
 * @description デフォルトスクリプトに実在アセット ID が入っていることを確認し、そのまま実行してプレビュー表示
 * @run npx playwright test tests/shared/ksc-editor/ksc-default-script.spec.ts --config=tests/configs/playwright.local.config.ts
 */
```

#### 既存ヘッダーとの関係

- 既存の `/** ... */` コメントがある場合は、上記タグを先頭に追加し、既存の説明文は `@description` に統合する
- 既存コメントの「ルール」等の補足はタグの後に残してよい

### 9. シェルスクリプト整理

→ 別ファイルに分離: [06-scripts-reorganization-plan.md](./06-scripts-reorganization-plan.md)

（テスト用シェルスクリプト17個の一覧、整理計画、パス修正マッピングを含む）

### 10. 注意点

- `guest-restore-priority.spec.ts` と `guest-session-restore.spec.ts` は `process.env.TEST_*_URL || localhost` を直接使っている（`URLS` 未使用）。`URLS` に統一するか、local/ に置くか要判断。→ 現状は local/ に分類
- `azure-project-init.spec.ts` は `process.env.TEST_API_URL || Azure URL` で default が Azure。→ azure/ に分類
- `check-specific-project.spec.ts` は localhost ハードコード。名前に「azure」がないので local/ に分類
