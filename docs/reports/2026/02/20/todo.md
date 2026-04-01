# 0220 修正計画書

## 概要

各画面の細かい修正と機能追加。調査結果に基づき、元の要望を整理・具体化し、関連する改善提案も含む。

---

## 1. プレイ画面（`/play/[id]`）

**場所:** `apps/next/app/(public)/play/[id]/page.tsx`

### 1-1. スマホ横画面対応（横画面強制）
- **現状:** landscape/orientation の制御なし。通常レイアウト（縦横自由）
- **対応:**
  - プレイ開始時に `screen.orientation.lock('landscape')` を呼び出す
  - 非対応ブラウザ向けに「横画面にしてください」ガイド表示
  - CSS `@media (orientation: portrait)` で回転促進オーバーレイ

### 1-2. 全画面表示
- **現状:** Fullscreen API 未使用。サイトヘッダーが常時表示される
- **対応:**
  - START ボタン押下時に `document.documentElement.requestFullscreen()` を呼ぶ
  - プレイ中はサイトヘッダーを非表示にする（`isPlaying` 時に条件分岐）
  - iframe を `100vw × 100vh` に拡大
  - ESC でフルスクリーン解除 → ヘッダー復帰

### 1-3. コンソール/デバッグ情報の削除
- **現状:** `ksc-demo.html` の `#info` div（キーボード操作ガイド）が常時表示
- **対応:**
  - `?mode=play` パラメータを追加し、play モード時は `#info` を非表示
  - `ksc-demo.ts` でパラメータ判定して表示制御
  - Logger のデフォルトレベルを play モード時は `WARN` 以上に変更

### 1-4. 【提案】プレイ画面 UI 改善
- 下部バー（作品情報・いいね）をオーバーレイ化し、プレイ中は自動非表示
- 戻るボタンをゲーム内メニューに統合

---

## 2. プレビュー画面

**場所:** `apps/editor/src/components/Header.tsx`（プレビュー起動）、`packages/web/ksc-demo.html`

### 2-1. 戻れるようにする
- **現状:** プレビューは新タブで開く。戻る手段は `window.close()` のみ（ポップアップとして開いた場合のみ機能）
- **対応:**
  - プレビュー画面にフローティング「戻る」ボタンを追加（HTML overlay）
  - `?from=editor&workId=xxx` パラメータを付与し、戻り先を判定
  - ボタン押下で `window.close()` → 失敗時は `location.href` でエディタに遷移
  - `ksc-demo.html` に戻るボタン用 UI 要素を追加

### 2-2. 【提案】Next.js 側のブロックプレビュー廃止検討
- **現状:** `apps/next/app/(private)/preview/page.tsx` に React ベースの簡易プレビューが存在（PixiJS 版と重複）
- **提案:** PixiJS プレビューに統一し、Next.js 版は削除を検討

---

## 3. エディタ画面

**場所:** `apps/editor/src/`

### 3-1. セリフの枠色指定
- **現状:** `TextBlock` 型に `body` と `speaker` のみ。スタイル指定なし
- **対応:**
  - `TextBlock` に `frameColor?: string` フィールド追加（`types/index.ts`）
  - `TextBlockCard.tsx` にカラーピッカー UI 追加
  - スクリプト生成（`useEditorStore.ts` の `buildPreviewScript`）で `@text_style color=xxx` コマンド出力
  - PixiJS レンダラ側（`packages/web`）でテキストウィンドウ枠色を動的変更対応

### 3-2. 感情演出（フルスクリーンエフェクト）追加
- **現状:** キャラクター表情の切替はあるが、画面全体エフェクトは未実装
- **対応:**
  - 新ブロックタイプ `effect` を追加
  - プリセットエフェクト候補:
    - `shake` — 画面振動（怒り・衝撃）
    - `flash` — 画面フラッシュ（驚き・雷）
    - `fade_black` / `fade_white` — 暗転・ホワイトアウト
    - `vignette` — 周囲暗転（集中・緊張）
    - `blur` — ぼかし（回想・夢）
    - `rain` / `snow` — 天候パーティクル
  - エディタ: ドロップダウンでエフェクト選択 + パラメータ（強度・時間）
  - スクリプト: `@effect shake intensity=3 duration=500`
  - PixiJS: フィルター（PixiJS built-in filters）で実装

### 3-3. 【提案】アセット選択 UI の公式/マイ切り替え（エディタ内）
- **現状:** BgBlockCard / ChBlockCard のアセット選択に公式/マイの区別なし
- **対応:** AssetSelectModal にタブ切替「公式アセット / マイアセット」を追加
  - 公式アセット: カテゴリー付き（後述 §4）
  - マイアセット: 現在のプロジェクトアセット

---

## 4. 管理画面（公式アセット管理）

**場所:** `apps/next/app/(private)/admin/assets/page.tsx`（既存）、API 拡張

### 4-1. 公式アセットの登録・カテゴリー管理
- **現状:** admin/assets ページは存在するが、カテゴリー管理なし
- **対応:**
  - DB: `official_assets` テーブル or `assets` テーブルに `is_official` + `category` カラム追加
  - カテゴリーマスタ（背景用）:
    - すべて
    - ファンタジー/屋外
    - 基本
    - 現代/屋外
    - 現代/屋内
    - 自然
  - キャラクターも同様のカテゴリー分類
  - Admin 画面: 公式アセットの CRUD + カテゴリー設定 UI
  - API: `GET /api/official-assets?kind=bg&category=fantasy_outdoor` 等

### 4-2. 【提案】公式キャラクターテンプレート
- 公式が用意したキャラクター（表情セット付き）をワンクリックでプロジェクトにインポート

---

## 5. マイページ

**場所:** `apps/next/app/(private)/mypage/page.tsx`

### 5-1. キャラクター管理タブ追加
- **現状:** マイページにはプロジェクト/アセット/プロフィールの 3 タブ。キャラクター管理なし（エディタ内のみ）
- **対応:**
  - `characters` タブを追加（プロジェクト横断でキャラクター一覧）
  - プロジェクトごとにグループ化して表示
  - キャラクターカードをクリック → エディタのキャラクター管理タブへ遷移
  - または: マイページ内でも基本的な CRUD 操作を可能にする

### 5-2. アセット管理の強化
- **現状:** アセットタブは表示のみ（read-only）。アップロード・削除はエディタでしか不可
- **対応:**
  - エディタと同等のアセット管理機能をマイページにも追加
  - アップロード・削除・フィルタリング（kind 別）
  - 公式アセット / マイアセットの切り替え表示

### 5-3. 【提案】マイアセットの共有管理
- プロジェクト横断でアセットを再利用できる「マイライブラリ」機能

---

## 6. 画面整理（プロジェクト一覧の統合）

### 6-1. プロジェクト一覧の重複解消
- **現状:** プロジェクト一覧が 2 箇所に存在
  - A: マイページ内のプロジェクトタブ（`mypage/page.tsx` lines 264-344）— リスト表示
  - B: 独立ページ `/projects`（`projects/page.tsx`）— グリッド表示 + 新規作成ダイアログ
  - さらに `apps/editor` にも 2 つの死にコード（`ProjectListPage.tsx`, `DashboardPage.tsx`）
- **対応案:**
  - **案 A:** マイページに統合。`/projects` を削除し、マイページのプロジェクトタブに新規作成機能を追加
  - **案 B:** `/projects` に統合。マイページからはリンクのみにする
  - **推奨: 案 A**（マイページをダッシュボードとして一元化）
- **追加:** `apps/editor` の死にコード（`ProjectListPage.tsx`, `DashboardPage.tsx`）を削除

---

## 7. あとで対応（次回以降）

- 縦横指定（プレイ画面の縦横モード切替）
- プレイ画面レイアウトの動的切り替え

---

## 優先度・実施順序（提案）

| 優先度 | タスク | 理由 |
|--------|--------|------|
| **高** | 1-1, 1-2, 1-3 プレイ画面修正 | ユーザー体験に直結 |
| **高** | 2-1 プレビュー戻るボタン | 開発効率に直結 |
| **高** | 6-1 プロジェクト一覧統合 | 画面整理・UX 混乱の解消 |
| **中** | 3-1 セリフ枠色 | エディタ機能拡張 |
| **中** | 5-1, 5-2 マイページ強化 | 管理性向上 |
| **中** | 4-1 公式アセット管理 | コンテンツ基盤 |
| **低** | 3-2 感情演出 | 新機能（設計・実装コスト大） |
| **低** | 3-3, 4-2, 5-3 提案項目 | 追加提案 |

---

## 実施結果・確認画面

スクリーンショットは `screenshots/` フォルダに保存。ファイル名はタスク番号付き。

### 1-1 スマホ横画面対応 — 完了

| ファイル | 確認内容 |
|----------|----------|
| `1-1_portrait_warning.png` | モバイル縦画面時「横画面にしてください」オーバーレイ + 回転アイコン表示 |

### 1-2 全画面表示 — 完了

| ファイル | 確認内容 |
|----------|----------|
| `1-2_splash_screen.png` | START/戻るボタン、作品情報、Header/Footer 正常表示 |
| `1-2_playing_fullscreen.png` | 全画面化、Header/Footer/下部バー非表示、終了ボタン（右上）表示 |
| `1-2_after_exit.png` | 終了ボタン押下 → スプラッシュ画面に復帰 |

### 1-3 デバッグ情報の削除 — 完了

| ファイル | 確認内容 |
|----------|----------|
| `1-3_demo_normal_info_visible.png` | 通常モード: 左上に `#info` Controls パネル表示 |
| `1-3_demo_play_mode_info_hidden.png` | play モード: `#info` パネル除去済、エラーなし、ゲーム正常描画 |

### 1-4 プレイ画面 UI 改善 — 完了

下部バー（作品情報・いいね）を削除、終了ボタンをオーバーレイ化。`1-2_playing_fullscreen.png` で確認。

### 2-1 プレビュー戻るボタン — 完了

`packages/web/ksc-demo.html` にフローティング「戻る」ボタンを追加。`?from=editor` または `?from=preview` パラメータ時に表示。`window.close()` → `history.back()` でエディタに復帰。

| ファイル | 変更内容 |
|----------|----------|
| `packages/web/ksc-demo.html` | `#back-button` 要素追加、CSS スタイル、from パラメータ判定ロジック |

### 3-1 セリフ枠色指定 — 完了

`TextBlock` に `frameColor?: string` を追加。`TextBlockCard.tsx` にカラーピッカー UI 追加。スクリプト生成で `@text_style color=xxx` コマンド出力。

| ファイル | 変更内容 |
|----------|----------|
| `apps/editor/src/types/index.ts` | `TextBlock` に `frameColor?: string` 追加 |
| `apps/editor/src/components/blocks/TextBlockCard.tsx` | カラーピッカー UI + リセットボタン + textarea 枠色表示 |
| `apps/editor/src/store/useEditorStore.ts` | `buildPreviewScript` で `@text_style color=xxx` 出力 |

### 3-2 感情演出（エフェクト） — 完了

新ブロックタイプ `effect` を追加。プリセット: shake, flash, fade_black, fade_white, vignette, blur, rain, snow。強度(1-5)・時間(ms)パラメータ付き。

| ファイル | 変更内容 |
|----------|----------|
| `apps/editor/src/types/index.ts` | `EffectBlock` 型定義追加、`Block` ユニオンに追加 |
| `apps/editor/src/components/blocks/EffectBlockCard.tsx` | **新規** — エフェクト選択ドロップダウン + パラメータ入力 |
| `apps/editor/src/components/BlockList.tsx` | EffectBlockCard 統合、ブロック追加メニューに「エフェクト」追加 |
| `apps/editor/src/components/ui/FABMenu.tsx` | FABメニューに「エフェクト」追加 |
| `apps/editor/src/store/useEditorStore.ts` | `buildPreviewScript` / `buildPageScript` で `@effect` コマンド出力 |

### 3-3 アセット選択 UI（公式/マイ切替） — 完了

`AssetSelectModal` にマイアセット/公式アセットタブ切替を実装。公式アセットはカテゴリフィルタ付き。選択時に `use-official` API でプロジェクトに参照追加。`AssetPanel` のタイトルを「マイアセット管理」に変更。

| ファイル | 変更内容 |
|----------|----------|
| `apps/editor/src/components/AssetSelectModal.tsx` | タブ切替 + カテゴリフィルタ + 公式アセット選択フロー |
| `apps/editor/src/components/panels/AssetPanel.tsx` | タイトルを「マイアセット管理」に変更 |
| `apps/editor/src/components/blocks/BgBlockCard.tsx` | `projectId` / `assetKind` props 追加 |
| `apps/editor/src/components/panels/CharacterEditModal.tsx` | `projectId` / `assetKind` props 追加 |
| `apps/editor/src/config/api.ts` | `officialAssets.list()` / `officialAssets.useOfficial()` エンドポイント追加 |

### 4-1 公式アセット管理 — 完了

`OfficialAsset` テーブル追加。管理画面に公式アセット管理ページを新設。kind タブ + カテゴリフィルタ + アップロード + 削除 + ライトボックス。公開 API (`/api/official-assets`) でエディタからフェッチ可能。

| ファイル | 変更内容 |
|----------|----------|
| `apps/hono/prisma/schema.prisma` | `OfficialAsset` モデル追加 |
| `apps/hono/src/routes/official-assets.ts` | **新規** — 公開 GET API |
| `apps/hono/src/routes/admin.ts` | アップロード / 一覧 / 削除 API 追加 |
| `apps/hono/src/routes/assets.ts` | `use-official` エンドポイント + 削除時保護 |
| `apps/hono/src/index.ts` | ルート登録 |
| `apps/next/app/(private)/admin/official-assets/page.tsx` | **新規** — 管理画面 UI |
| `apps/next/app/(private)/admin/layout.tsx` | サイドバーに「公式アセット」追加 |
| `apps/next/lib/api.ts` | `getAdminOfficialAssets` / `uploadOfficialAsset` / `deleteOfficialAsset` 追加 |

### 5-1 マイページ キャラクター管理タブ — 完了

マイページに「キャラクター」タブ追加（4タブ: プロジェクト/アセット/キャラクター/プロフィール）。プロジェクトごとにキャラクター一覧を表示。表情リストをバッジ表示。エディタへの遷移リンク付き。

| ファイル | 変更内容 |
|----------|----------|
| `apps/next/app/(private)/mypage/page.tsx` | `CharactersTab` コンポーネント追加、タブ配列に追加 |
| `apps/next/lib/api.ts` | `Character` 型 + `getProjectCharacters()` 追加 |

### 5-2 マイページ アセット管理強化 — 完了

アセットタブにアップロード（背景/BGM）・削除機能を追加。プロジェクトヘッダーにアップロードボタン、アセットカードにホバー時削除ボタンを表示。タイトルを「マイアセット管理」に変更。

| ファイル | 変更内容 |
|----------|----------|
| `apps/next/app/(private)/mypage/page.tsx` | `AssetsTab` にアップロード/削除ハンドラ追加 |
| `apps/next/lib/api.ts` | `uploadProjectAsset()` / `deleteProjectAsset()` 追加 |

### 6-1 プロジェクト一覧の重複解消 — 完了

マイページのプロジェクトタブに新規作成ダイアログを統合。`/projects` はマイページへリダイレクト。エディタの死にコード（`ProjectListPage.tsx`, `DashboardPage.tsx`, `LandingPage.tsx`）を削除。

| ファイル | 変更内容 |
|----------|----------|
| `apps/next/app/(private)/mypage/page.tsx` | `ProjectsTab` に作成ダイアログ統合 |
| `apps/next/app/(private)/projects/page.tsx` | `/mypage` へリダイレクト |
| `apps/editor/src/pages/ProjectListPage.tsx` | **削除** |
| `apps/editor/src/pages/DashboardPage.tsx` | **削除** |
| `apps/editor/src/pages/LandingPage.tsx` | **削除** |

### その他（共通画面）

| ファイル | 確認内容 |
|----------|----------|
| `0-0_login.png` | ログイン画面 |
| `0-0_after_login.png` | ログイン後マイページ遷移 |
| `0-0_works_page_unaffected.png` | 作品一覧: Header/Footer 通常表示（プレイ画面変更の影響なし） |
| `3-0_editor_loaded.png` | エディタ全体（ロード完了状態） |
| `3-0_editor_settings_tab.png` | エディタ-作品設定タブ |
| `5-0_mypage_profile_tab.png` | マイページ-プロフィールタブ |

### 変更ファイル（1-1, 1-2, 1-3, 1-4）

| ファイル | 変更内容 |
|----------|----------|
| `apps/next/app/(public)/play/[id]/page.tsx` | 全画面化 (`requestFullscreen`)、横画面ロック (`orientation.lock`)、終了ボタン、縦画面警告、`mode=play` 付与、下部バー削除 |
| `packages/web/ksc-demo.html` | `mode=play` 時に `#info` div を `remove()` |
| `packages/web/src/ksc-demo.ts` | `mode=play` 時に Logger レベルを `WARN` に設定 |

---

## 調査で判明した関連問題

1. **Next.js ブロックプレビュー** (`apps/next/app/(private)/preview/page.tsx`) が PixiJS プレビューと重複
2. ~~**apps/editor の死にコード**: `ProjectListPage.tsx`, `DashboardPage.tsx`, `LandingPage.tsx` 等が未使用~~ → **解消済み**（6-1 で削除）
3. ~~**マイページの「新規」ボタン** が `/projects` にリンクしており、同じデータを別画面で見ることになる~~ → **解消済み**（6-1 で統合）
4. **TextBlock の speaker フィールド** がエディタ UI に露出していない（型定義にはある）
5. **AssetPanel のキャラクターアップロードボタン** がコメントアウトされている（CharacterPanel に移行済み）
