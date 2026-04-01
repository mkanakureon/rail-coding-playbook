# テスト要件書：最近追加された機能

作成日: 2026-03-20

---

## 1. スマホ縦画面対応（Portrait Mode）

**コミット:** `2a5d716`

### 概要
Web 版プレビュー/実行画面をスマホ縦持ち（720×動的高さ）に対応。UI 要素はアンカーベース配置で、デバイス高さが変わっても崩れない。

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 1-1 | エディタでレイアウトプリセット「スマホ縦画面」選択 | レイアウトタブ → ドロップダウン | プレビューキャンバスが縦長に変わる |
| 1-2 | レイアウト保存 → ヘッダー💾保存 → リロード | 操作後 API 確認 | `playLayout.screenMode=portrait` が DB に保存される |
| 1-3 | 実行ボタンの URL | ▶実行クリック | `mode=play&orientation=portrait` が含まれる |
| 1-4 | タイトル画面（縦） | 実行画面を開く | タイトル・「はじめから」ボタンが縦画面中央に配置 |
| 1-5 | テキスト表示（縦） | シナリオ進行 | メッセージウィンドウが画面下部にアンカー配置 |
| 1-6 | 選択肢表示（縦） | 選択肢ブロック到達 | ボタンが画面中央に表示、暗幕が画面全体をカバー |
| 1-7 | 背景 cover スケーリング | BG_SET 実行 | 横長画像が縦画面にカバー表示（上下カットなし） |
| 1-8 | キャラ表示（縦） | CH_SET 実行 | キャラが画面下端に足を揃えて表示 |
| 1-9 | END 画面（縦） | シナリオ完了 | 「END」「タイトルに戻る」が縦画面に収まる |
| 1-10 | 横画面との互換 | `orientation` パラメータなしで開く | 従来通り 1280×720 で表示 |
| 1-11 | プレビュー iframe（縦） | エディタ右サイドバー | iframe 内 canvas が 720×1280 縦長 |
| 1-12 | デバイスエミュレーション | Chrome DevTools iPhone SE / Pixel 7 | 縦横切り替えでレイアウト崩れなし |

### 確認 URL
```
# 縦画面（タイトルあり）
http://localhost:5175/ksc-demo.html?work=<id>&mode=play&orientation=portrait

# 横画面（従来）
http://localhost:5175/ksc-demo.html?work=<id>&mode=play
```

---

## 2. ポイント課金・ペイウォール（Phase 2 マネタイズ）

**コミット:** `e2a488b`, `a7af0e5`

### 概要
作者が作品に `price`（ポイント）と `freeUntil`（無料公開ページ）を設定。読者はペイウォール到達時に購入/チャージ/ログインを選択。購入時 90% が作者に分配。

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 2-1 | ウォレット残高取得 | `GET /api/wallet` | 残高が正しく返る |
| 2-2 | ポイントチャージ | `POST /api/wallet/charge` | 残高が増加、トランザクション記録 |
| 2-3 | 残高不足でチャージプラン表示 | 残高 < price で購入試行 | Trial/Standard/Recommended の3プラン |
| 2-4 | 作品購入 | `POST /api/works/:id/purchase` | 購入者残高 −price、作者残高 +90% |
| 2-5 | 二重購入防止 | 同じ作品を再購入 | エラー返却、残高変動なし |
| 2-6 | ペイウォール UI | プレイ中に freeUntil 超過 | PaywallOverlay 表示、3つのアクション |
| 2-7 | 購入後のアンロック | 購入 → プレイ再開 | ペイウォール解除、シナリオ続行 |
| 2-8 | 未ログインユーザー | ログインなしで購入試行 | ログイン画面へ誘導 |

### 既存テスト
```bash
npm test -w @kaedevn/hono -- wallet.test.ts
npm test -w @kaedevn/hono -- works-purchase.test.ts
npx playwright test tests/shared/flow/wallet-flow.spec.ts
npx playwright test tests/shared/flow/purchase-flow.spec.ts
```

---

## 3. 縦動画クリップ生成（Phase 3 配信）

**コミット:** `d33682a`

### 概要
作品から 720×1280 の縦動画（MP4）を自動生成。Playwright で録画 → ffmpeg で変換。SNS シェア用。

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 3-1 | 動画生成リクエスト | `POST /api/works/:id/video` | `WorkVideo` レコード作成 (status: pending) |
| 3-2 | バックグラウンド録画 | 生成スクリプト実行 | Playwright が 720×1280 で ksc-demo.html を録画 |
| 3-3 | ffmpeg 変換 | WebM → MP4 | `public/uploads/videos/` に MP4 出力 |
| 3-4 | タイムアウト制御 | clipDuration 超過 | `document.title = "__CLIP_DONE__"` で録画終了 |
| 3-5 | 動画ステータス取得 | `GET /api/works/:id/video` | status: pending → processing → ready |
| 3-6 | 動画再生 | 生成済み MP4 を再生 | 720×1280 で正常再生 |

### 実行方法
```bash
# CLI で動画生成
npx tsx scripts/cli/video/generate-clip.ts --work=<id> --duration=30

# API 経由
curl -X POST http://localhost:8080/api/works/<id>/video
```

---

## 4. レコメンド・ランキング（Phase 3 配信）

**コミット:** `d33682a`

### 概要
PlaySession（再生時間・到達ページ）と Like データからスコアを算出し、作品をトレンド順・品質順でソート。

### スコア計算式

| スコア | 計算式 |
|--------|--------|
| trendScore | (7日間セッション数 × 0.4) + (7日間いいね × 0.3) + (平均完了率 × 0.3) |
| qualityScore | (平均完了率 × 0.5) + (正規化再生時間 × 0.3) + (いいね率 × 0.2) |

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 4-1 | スコア計算バッチ | `npx tsx scripts/cli/ranking/update-scores.ts` | WorkScore テーブルに trendScore / qualityScore が保存 |
| 4-2 | トレンドソート | `GET /api/works?sort=trending` | trendScore 降順で返る |
| 4-3 | 品質ソート | `GET /api/works?sort=top` | qualityScore 降順で返る |
| 4-4 | PlaySession 記録 | プレイ終了時 | sendBeacon で durationMs, pagesReached, totalPages が送信 |
| 4-5 | セッションなし作品 | セッション 0 件の作品 | スコア 0、ランキング下位 |

---

## 5. 埋め込みプレイヤー（Embed）

**コミット:** `e2a488b`

### 概要
外部サイトから `<iframe src="/embed/<id>">` で作品を埋め込み可能。OGP メタタグ付き。

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 5-1 | OGP メタタグ生成 | `curl /embed/<id>` | og:title, og:image, og:description が含まれる |
| 5-2 | iframe 読み込み | ブラウザで `/embed/<id>` | ksc-demo.html が全画面 iframe で表示 |
| 5-3 | 「kaedevn で開く」リンク | 右下リンクをクリック | `/play/<id>` に遷移 |
| 5-4 | 存在しない作品 | 無効な ID でアクセス | 404 エラー表示 |

### 確認 URL
```
http://localhost:3000/embed/<workId>
```

---

## 6. キャラブロック UI 改善

**コミット:** `62bf3bb`

### 概要
エディタのキャラブロックにキャラ選択ドロップダウン・表情選択・編集ボタンを追加。

### テスト項目

| # | テスト内容 | 方法 | 期待結果 |
|---|----------|------|---------|
| 6-1 | キャラ選択 | ドロップダウンでキャラ切替 | ブロックの characterId が更新 |
| 6-2 | 表情選択 | 表情ドロップダウン切替 | expressionId が更新、サムネ変化 |
| 6-3 | キャラ編集モーダル | ✏️ボタンクリック | CharacterEditModal が開く |
| 6-4 | 新規キャラ作成 | +ボタンクリック | キャラ作成後ブロックに反映 |
| 6-5 | 保存→リロード | プロジェクト保存後リロード | characterId / expressionId が保持 |

---

## テスト実行コマンド

```bash
# API ユニットテスト（全体）
npm test -w @kaedevn/hono

# Web エンジンテスト
npm test -w @kaedevn/web

# E2E テスト（ウォレット・購入フロー）
npx playwright test tests/shared/flow/

# 型チェック
npm run typecheck

# Lint
npm run lint
```

---

## 優先度

| 優先度 | 機能 | 理由 |
|--------|------|------|
| **Critical** | ポイント課金・購入フロー | 収益に直結、金額計算の正確性 |
| **Critical** | ペイウォール | ユーザー体験の中断点、離脱リスク |
| **High** | スマホ縦画面 | モバイルユーザーの大半が縦持ち |
| **High** | 縦動画クリップ | SNS 配信の主要コンテンツ |
| **High** | ランキング | 作品発見の要、スコア計算の正確性 |
| **Medium** | 埋め込みプレイヤー | 外部サイト連携、OGP 正確性 |
| **Medium** | キャラブロック UI | エディタ UX 向上 |
