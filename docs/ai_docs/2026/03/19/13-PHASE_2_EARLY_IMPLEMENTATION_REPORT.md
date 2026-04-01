# Phase 2 前半 実装報告書：ポイント課金・ペイウォール・埋め込みプレイヤー・縦画面定数

> **作成日**: 2026-03-19
> **担当**: Claude Opus 4.6
> **対象コミット**: `ca78b44`, `e2a488b`
> **判定**: 合格

---

## 1. 実施内容

設計書（`11-release-design-spec.md`）Phase 2 の4機能を実装。

| # | 機能 | 状態 | コミット |
|---|------|------|---------|
| P2-1 | ポイント課金（モック） | 完了 | `ca78b44` |
| P2-2 | ペイウォール | 完了 | `e2a488b` |
| P2-3 | 縦画面モード | 定数追加済（レンダラは後半） | `e2a488b` |
| P2-4 | 埋め込みプレイヤー | 完了 | `e2a488b` |

**変更規模**: 12ファイル / +1,042行 / -3行

---

## 2. 変更ファイル一覧

### コミット 1: `ca78b44`（P2-1: ポイント課金）

| ファイル | 種別 | 内容 |
|---------|------|------|
| `apps/hono/prisma/schema.prisma` | 変更 | Wallet / PointTransaction / WorkPurchase モデル追加、Work に price/freeUntil 追加、Prisma output 標準化 |
| `apps/hono/src/routes/wallet.ts` | 新規 | GET / / POST /charge / GET /history |
| `apps/hono/src/routes/works.ts` | 変更 | GET /:id/access / POST /:id/purchase / GET /:id/revenue 追加 |
| `apps/hono/src/index.ts` | 変更 | wallet ルートマウント追加 |
| `apps/next/lib/api.ts` | 変更 | getWallet / chargeWallet / getWalletHistory / purchaseWork / checkWorkAccess 追加 |
| `apps/next/app/(private)/mypage/wallet/page.tsx` | 新規 | ウォレット画面（チャージ + 取引履歴） |
| `apps/next/app/(private)/mypage/revenue/page.tsx` | 新規 | 作者収益ダッシュボード |

### コミット 2: `e2a488b`（P2-2/3/4）

| ファイル | 種別 | 内容 |
|---------|------|------|
| `apps/next/app/(public)/play/[id]/PaywallOverlay.tsx` | 新規 | ペイウォール UI |
| `apps/next/app/(public)/play/[id]/PlayPageClient.tsx` | 変更 | paywallReached/paywallUnlocked 対応 |
| `apps/next/app/(public)/embed/[id]/page.tsx` | 新規 | 埋め込みプレイヤー |
| `packages/core/src/constants/layout.ts` | 変更 | PORTRAIT 定数 + ScreenMode 型 |
| `packages/core/src/index.ts` | 変更 | 新定数のエクスポート |

---

## 3. 機能別レビュー

### 3.1. ポイント課金（モック決済）

**DB スキーマ（3テーブル追加）**:

```
Wallet ──< PointTransaction
  │
User ──< WorkPurchase >── Work
```

- `Wallet`: ユーザーごとに1つ（`userId` に `@unique`）。初回アクセス時に自動作成
- `PointTransaction`: 全ポイント変動の履歴（type: charge/purchase/earn/refund）。`balance` フィールドで取引後残高をスナップショット
- `WorkPurchase`: ユーザー × 作品の購入レコード（`@@unique([userId, workId])`）

**Work モデル拡張**:
- `price Int @default(0)` — 0 = 無料、100 = 100pt
- `freeUntil String?` — ペイウォール位置（ページID）

**API エンドポイント（5本）**:

| メソッド | パス | 機能 | 認証 |
|---------|------|------|------|
| GET | `/api/wallet` | 残高取得（自動作成） | 必須 |
| POST | `/api/wallet/charge` | モックチャージ（3プラン） | 必須 |
| GET | `/api/wallet/history` | 取引履歴（ページネーション） | 必須 |
| POST | `/api/works/:id/purchase` | 作品購入（アトミック） | 必須 |
| GET | `/api/works/:id/access` | アクセス権確認 | 必須 |

**購入トランザクションの原子性**:

```typescript
// works.ts — $transaction 内で6ステップをアトミック実行
const result = await prisma.$transaction(async (tx) => {
  // 1. 購入者ウォレット取得 + 残高チェック
  // 2. 作者ウォレット取得 or 作成
  // 3. 購入者: balance -= price
  // 4. 購入者: PointTransaction (type: purchase, amount: -price)
  // 5. 作者: balance += price * 0.9
  // 6. 作者: PointTransaction (type: earn, amount: +price*0.9)
  // 7. WorkPurchase レコード作成
});
```

**チャージプラン**:

| プラン | 価格 | ポイント | ボーナス |
|--------|------|---------|---------|
| trial | 300円 | 300 pt | なし |
| standard | 500円 | 520 pt | +20 pt |
| recommended | 1,000円 | 1,100 pt | +100 pt |

**評価: 優** — 本番移行時は `/api/wallet/charge` のみ Stripe Webhook 対応に変更すればよい構造。

### 3.2. ペイウォール

**データフロー**:

```
ksc-demo.ts (iframe)                  PlayPageClient (parent)
      |                                        |
      |-- postMessage({paywallReached}) ------>|
      |                                        |-- PaywallOverlay 表示
      |                                        |   ├ 残高あり → 購入ボタン
      |                                        |   ├ 残高なし → チャージ導線
      |                                        |   └ 未ログイン → ログイン導線
      |                                        |
      |<-- postMessage({paywallUnlocked}) -----|  ← 購入完了後
      |                                        |
      |-- 続きのシーン再開                       |
```

**PaywallOverlay の状態分岐**:

| 状態 | 表示 |
|------|------|
| 未ログイン | 「ログイン」ボタン |
| ログイン + 残高十分 | 「{price} pt で続きを読む」ボタン |
| ログイン + 残高不足 | 「ポイントをチャージ」ボタン（/mypage/wallet へ遷移） |
| 既に購入済み | 即座に `onPurchased()` → オーバーレイ非表示 |

**評価: 良** — 設計書の画面遷移図を忠実に再現。

### 3.3. 埋め込みプレイヤー

**`/embed/[id]` ページ**:
- Server Component（`generateMetadata` 付き）
- フルスクリーン iframe + 右下に「kaedevn で開く」ブランドリンク
- 外部サイトの `<iframe src="/embed/xxx">` で使用

**評価: 良** — 最小限の実装で機能を実現。

### 3.4. 縦画面レイアウト定数

```typescript
// packages/core/src/constants/layout.ts
export const PORTRAIT_WIDTH = 720;
export const PORTRAIT_BASE_HEIGHT = 1560;  // ≈ 9:19.5
export const TEXT_WINDOW_RATIO = 0.3;       // 画面高さの30%
export const TEXT_WINDOW_MIN_H = 280;
export type ScreenMode = 'landscape' | 'portrait';
```

Phase 2 後半で `packages/web` のレンダラがこれらの定数を使用して動的レイアウトを計算する。

---

## 4. Prisma output 標準化

実装中に `schema.prisma` の `output = "../src/generated/prisma"` が monorepo 環境で `@prisma/client` の型と衝突する問題が発見された。

**変更**: `output` 行を削除 → 標準の `.prisma/client` に生成されるように修正。`@prisma/client` からのインポートが正しく新モデルの型を認識するようになった。

---

## 5. typecheck 結果

```
npm run typecheck → PASS（エラー 0）
```

---

## 6. 今後の課題（Phase 2 後半）

| 課題 | 優先度 | 概要 |
|------|--------|------|
| 縦画面レンダリング実装 | 高 | WebOpHandler / LayerManager で ScreenMode に応じた動的レイアウト |
| エディタの販売設定 UI | 高 | price / freeUntil を作者が GUI で設定 |
| エンジン側 paywallReached 発火 | 高 | OpRunner が freeUntil 到達時に postMessage を送信 |
| 本番決済移行（Stripe） | 中 | /api/wallet/charge を Stripe Checkout Session 対応に |
| 振込申請機能 | 低 | 作者の収益をリアル通貨に変換する仕組み |

---

## 7. 結論

Phase 2 前半の実装により、kaedevn は「作品を公開する場」から「収益を生むプラットフォーム」へ進化した。モック決済 → 本番移行の変更点が `/api/wallet/charge` の1エンドポイントに限定されており、スムーズな移行が可能。
