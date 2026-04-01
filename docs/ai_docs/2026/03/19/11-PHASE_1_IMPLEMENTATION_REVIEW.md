# Phase 1 実装レビュー：OGP + ワンタップ起動 + シーン共有

> **作成日**: 2026-03-19
> **担当**: Claude Opus 4.6
> **対象コミット**: `df69a41` (feat: OGP 動的生成・ワンタップ起動・シーン共有ボタン)
> **判定**: **合格**

---

## 1. 概要

設計書（`11-release-design-spec.md`）Phase 1 の3機能を実装した。

| 機能 | 目的 | 状態 |
|------|------|------|
| 動的 OGP | SNS シェア時のカード表示 | 完了 |
| ワンタップ起動（`?quick=1`） | タイトル画面スキップ → 即プレイ | 完了 |
| シーン共有 | プレイ中スクショ → SNS シェア | 完了 |

変更規模: 5ファイル、570行追加 / 364行削除（実質リファクタ込み）

---

## 2. 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---------|------|---------|
| `apps/next/app/(public)/play/[id]/page.tsx` | 書換 | Client → Server Component 化。`generateMetadata()` で動的 OGP |
| `apps/next/app/(public)/play/[id]/PlayPageClient.tsx` | 新規 | 旧 page.tsx の全 UI/ロジック移動。`?quick=1` + シェアボタン追加 |
| `apps/next/app/(public)/play/[id]/ShareDialog.tsx` | 新規 | Web Share API 非対応ブラウザ用フォールバック（X / LINE / URLコピー） |
| `packages/web/src/ksc-demo.ts` | 1行 | `autostart=1` 条件に `quick=1` を追加 |
| `apps/next/public/ogp-default.png` | 新規 | 1200x630 デフォルト OGP 画像（グラデーション + ブランド名） |

---

## 3. 機能別レビュー

### 3.1. 動的 OGP（`page.tsx`）

**設計判断**:
- App Router の Server Component + `generateMetadata()` を使い、SSR 時にメタタグを生成
- クライアントの `getWork()` ではなくサーバーサイド `fetch()` を使用
- `{ next: { revalidate: 60 } }` で ISR キャッシュ（60秒）

**評価: 優**

| 項目 | 判定 | 備考 |
|------|------|------|
| OGP title/description | OK | `work.title` + `work.description` をそのまま使用 |
| OGP image | OK | `work.thumbnail` 優先、なければ `/ogp-default.png` |
| Twitter Card | OK | `summary_large_image` で大画像カード |
| キャッシュ戦略 | OK | revalidate: 60 で playCount 二重加算を防止 |
| エラー時 | OK | work が null なら静的エラー画面（OGP なし） |

**コード確認ポイント**:
```typescript
// page.tsx:8-14 — サーバーサイド fetch
async function fetchWork(id: string) {
  const res = await fetch(`${API_URL}/api/works/${id}`, {
    next: { revalidate: 60 },
  });
  // ...
}
```

`NEXT_PUBLIC_API_URL` をサーバーサイドで使用している。Next.js では `NEXT_PUBLIC_` プレフィックスの環境変数はサーバー・クライアント両方で利用可能なため問題ない。ただし、Docker ビルド時にベイクされる値（`Dockerfile:31`）なので、ランタイム変更は不可。現行の運用では問題なし。

### 3.2. ワンタップ起動（`?quick=1`）

**設計判断**:
- `PlayPageClient.tsx` で `useSearchParams()` から `quick=1` を検出
- マウント時に `handleStart()` を自動実行（タイトル画面スキップ）
- iframe URL にも `&quick=1` を付与して伝播
- `ksc-demo.ts` 側は既存の `autostart=1` 条件に `|| quick=1` を追加（1行）

**評価: 優**

| 項目 | 判定 | 備考 |
|------|------|------|
| パラメータ検出 | OK | `useSearchParams().get('quick')` |
| タイトルスキップ | OK | `useEffect` で `isQuickStart` 時に自動 `handleStart()` |
| iframe 伝播 | OK | `previewSrc` に `&quick=1` を条件付与 |
| エンジン側対応 | OK | `ksc-demo.ts:376` — `autostart=1 \|\| quick=1` |
| 通常起動への影響 | なし | `quick=1` がない場合は従来通りタイトル画面表示 |

**コード確認ポイント**:
```typescript
// ksc-demo.ts:376 — 変更箇所（1行のみ）
if (urlParams.get('autostart') === '1' || urlParams.get('quick') === '1') {
```

`autostart` はテスト用（Playwright）、`quick` はユーザー向けと意味が分離されている。将来的に `quick` 側だけバトル自動進行を無効にする等の分岐が可能。

### 3.3. シーン共有

**設計判断**:
- プレイ中の右上にシェアアイコンボタン（終了ボタンの左隣）
- ボタン押下 → iframe に `postMessage({ type: 'captureCanvas' })` 送信
- エンジン側（`ksc-demo.ts:108-113`）が `canvasCapture` レスポンスを返す（**既存実装を流用、変更不要**）
- `navigator.share()` で画像 + URL をネイティブ共有
- 非対応ブラウザ: `ShareDialog.tsx` で X / LINE / URLコピー

**評価: 良**

| 項目 | 判定 | 備考 |
|------|------|------|
| キャプチャ要求 | OK | `postMessage` → iframe の既存ハンドラが応答 |
| Web Share API | OK | `navigator.share({ files: [File] })` で画像付き共有 |
| フォールバック | OK | AbortError（ユーザーキャンセル）は無視、それ以外は ShareDialog |
| ShareDialog UI | OK | X / LINE / URLコピーの3択 |
| ボタン配置 | OK | `right-16`（終了ボタン `right-3` の左隣） |

**コード確認ポイント — キャプチャのデータフロー**:
```
PlayPageClient (parent)              ksc-demo.ts (iframe)
      |                                     |
      |-- postMessage({captureCanvas}) ---->|
      |                                     |-- canvas.toDataURL()
      |<-- postMessage({canvasCapture}) ----|
      |
      |-- navigator.share() or ShareDialog
```

エンジン側のキャプチャハンドラは `ksc-demo.ts:108-113` に既に存在し、`window.parent.postMessage` で返す。play ページの iframe は `window.parent` が Next.js ページなので、双方向通信は正しく成立する。

---

## 4. 注意点・改善候補

### 4.1. postMessage の origin 検証（低リスク）

現在、キャプチャの送受信で `'*'` origin を使用している。

```typescript
// ksc-demo.ts:112
window.parent.postMessage({ type: 'canvasCapture', dataUrl: ... }, '*');

// PlayPageClient.tsx — message イベントで origin 未チェック
```

ゲームのスクリーンショットが第三者に漏洩するリスクは極めて低いが、プロダクション品質として `origin` の検証を追加するのが望ましい。

**優先度**: Phase 3 以降で対応可

### 4.2. 縦画面モード対応の布石（Phase 2）

`PlayPageClient.tsx` に `lock('landscape')` と `portrait-warning` が残っている。Phase 2 の縦画面対応時に、プロジェクトの `screenMode` に応じた条件分岐が必要。

**影響範囲**: `handleStart()` 内の orientation lock + JSX 内の warning div

### 4.3. シェア URL のシーン deep link（Phase 2）

現在のシェア URL は `/play/${workId}` 固定。特定シーンから再開できる deep link（`?scene=xxx`）は Phase 2 に先送り済み。設計書通り。

### 4.4. OGP 画像の動的生成（将来検討）

現在は `work.thumbnail`（作者がアップロードした画像）をそのまま OGP に使用。将来的に `@vercel/og` や Canvas ライブラリでタイトル・作者名を合成した OGP 画像を動的生成する余地がある。

---

## 5. typecheck / lint 結果

```
npm run typecheck  → PASS（エラー 0）
```

新規ファイル 2つ（PlayPageClient.tsx, ShareDialog.tsx）を含め、型エラーなし。

---

## 6. 結論

Phase 1 の3機能はすべて設計書通りに実装され、typecheck も通過。「URL を送るだけで即プレイ → SNS でシェア」のバイラルループ基盤が完成した。

**次のステップ**: Phase 2（ポイント課金・縦画面対応）へ進む。
