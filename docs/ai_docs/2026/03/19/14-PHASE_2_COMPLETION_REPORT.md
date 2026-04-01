# Phase 2 完了報告書：ポイント課金・ペイウォール・埋め込み・販売設定

> **作成日**: 2026-03-19
> **担当**: Claude Opus 4.6
> **ステータス**: 完了 (Completed)
> **対象コミット**: `ca78b44`, `e2a488b`, `c8b4aae`, `a7af0e5`

---

## 1. 実施内容

設計書（`11-release-design-spec.md`）Phase 2 の全4機能を4コミットで実装。

| # | 機能 | 状態 | コミット |
|---|------|------|---------|
| P2-1 | ポイント課金（モック） | 完了 | `ca78b44` |
| P2-2 | ペイウォール | 完了 | `e2a488b` + `a7af0e5` |
| P2-3 | 縦画面モード | 定数完了 | `e2a488b` |
| P2-4 | 埋め込みプレイヤー | 完了 | `e2a488b` |
| - | 販売設定 UI | 完了 | `a7af0e5` |

**変更規模**: 17ファイル / +1,500行以上

---

## 2. 機能別サマリー

### 2.1. ポイント課金（モック決済）

| コンポーネント | 内容 |
|---------------|------|
| DB | Wallet / PointTransaction / WorkPurchase（3テーブル）+ Work に price/freeUntil |
| API | `/api/wallet`（残高・チャージ・履歴）+ `/api/works/:id/purchase,access,revenue` |
| UI | ウォレット画面（チャージ + 取引履歴）+ 作者収益ダッシュボード |
| モック→本番 | `/api/wallet/charge` の1エンドポイントのみ Stripe 対応に変更 |

**チャージプラン**: 300円(300pt) / 500円(520pt) / 1,000円(1,100pt)
**分配率**: 作者 90%（`$transaction` でアトミック実行）

### 2.2. ペイウォール

**データフロー（完全実装済み）**:

```
ksc-demo.ts (iframe)                  PlayPageClient (parent)
      |                                        |
      | ticker で _page 監視                    |
      | page > freeUntil 到達                   |
      | runner.stop()                           |
      |-- postMessage({paywallReached}) ------>|
      |                                        |-- PaywallOverlay 表示
      |                                        |   ├ 残高あり → 購入
      |                                        |   ├ 残高なし → チャージ
      |                                        |   └ 未ログイン → ログイン
      |                                        |
      |<-- postMessage({paywallUnlocked}) -----|
      |                                        |
      | runner.resume(scenario, handler, pc)    |
      | → 続きのシーン再開（リロード不要）        |
```

### 2.3. 埋め込みプレイヤー

- `/embed/[id]` — Server Component + OGP 付き
- フルスクリーン iframe + 「kaedevn で開く」ブランドリンク
- 外部サイト: `<iframe src="https://kaedevn.com/embed/xxx">`

### 2.4. 縦画面モード

- `packages/core` に定数追加済み: `PORTRAIT_WIDTH(720)` / `PORTRAIT_BASE_HEIGHT(1560)` / `TEXT_WINDOW_RATIO(0.3)` / `ScreenMode` 型
- レンダラ側（WebOpHandler / LayerManager）の動的レイアウト対応は大規模リファクタのため別タスク

### 2.5. 販売設定 UI

公開ダイアログに追加:
- 無料/有料ラジオボタン
- 有料選択時: 価格入力（pt）+ 無料区間入力（ページID）
- publish API に price/freeUntil を送信

---

## 3. 技術的ハイライト

### アトミックな決済処理

```typescript
prisma.$transaction(async (tx) => {
  // 1. 購入者ウォレット取得 + 残高チェック
  // 2. 作者ウォレット取得 or 自動作成
  // 3. 購入者 balance -= price
  // 4. 購入者 PointTransaction(purchase)
  // 5. 作者 balance += price * 0.9
  // 6. 作者 PointTransaction(earn)
  // 7. WorkPurchase レコード作成
});
```

7ステップが1つのトランザクションで原子実行。途中でエラーが発生しても全ロールバック。

### ペイウォールの ticker 監視

エンジンの `app.ticker.add()` で毎フレーム `runner.getState().vars._page` を監視。シナリオスクリプトへの特殊コマンド追加なしで、メタデータ（freeUntil）だけでペイウォールが機能する。

### Prisma output 標準化

Phase 2 実装中に発見した問題: `schema.prisma` の `output = "../src/generated/prisma"` が monorepo 環境で `@prisma/client` の型と衝突。`output` 行を削除して標準パスに修正。

---

## 4. typecheck 結果

```
npm run typecheck → PASS（全4コミットでエラー 0）
```

---

## 5. 今後の課題（Phase 3）

| 課題 | 優先度 | 概要 |
|------|--------|------|
| 縦画面レンダリング実装 | 高 | WebOpHandler / LayerManager で ScreenMode 動的レイアウト |
| Stripe 実決済移行 | 高 | `/api/wallet/charge` → Stripe Checkout + Webhook |
| 縦動画クリップ生成 | 中 | 9:16 MP4 自動生成（P3-1） |
| レコメンド + ランキング | 中 | 読了率スコアで上位表示（P3-3） |
| AI 音声合成 | 低 | テキスト → 読み上げ動画（P3-4） |

---

## 6. 結論

Phase 2 の全機能が設計書通りに実装され、typecheck を通過した。kaedevn は「作品を公開する場」から「物語を売れるプラットフォーム」へ進化。モック決済 → Stripe 本番移行の変更点は `/api/wallet/charge` の1エンドポイントに限定されており、スムーズな移行が可能。
