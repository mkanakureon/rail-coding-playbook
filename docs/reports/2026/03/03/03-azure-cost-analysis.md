# Azure コスト分析・削減計画

**日付**: 2026-03-03
**対象**: リソースグループ `rg-next-aca-min`（Japan East）

## 現在のコスト内訳

| サービス | 月額（税抜） | 構成比 |
|---------|----------:|------:|
| Azure Container Apps | ¥2,917.96 | 46.9% |
| Azure Front Door Service | ¥1,552.44 | 25.0% |
| Azure Database for PostgreSQL | ¥1,434.82 | 23.1% |
| Container Registry | ¥312.25 | 5.0% |
| Storage | ¥0.80 | 0.0% |
| Bandwidth | ¥0.00 | 0.0% |
| Log Analytics | ¥0.00 | 0.0% |
| **合計** | **¥6,218.27** | **100%** |

## 現在のリソース構成

| リソース | SKU / スペック |
|---------|---------------|
| ca-api, ca-nextjs, ca-editor, ca-preview | 各 0.5 CPU / 1Gi メモリ |
| pgnextacamin (PostgreSQL) | Standard_B1ms, v16, 32GB |
| acrnextacamin (ACR) | Basic |
| kaedevnworks (Storage) | Standard_LRS, StorageV2, Hot |
| fd-kaedevn (Front Door) | Standard |
| law-next-aca-min (Log Analytics) | — |

## 増加リスク分析

### 高リスク（ユーザー増で確実に増加）

#### Container Apps（¥2,917 → 増加見込み大）

- 現在は各アプリ 0.5CPU/1Gi の最小構成
- ユーザー増でリクエストが増えるとスケールアウト（レプリカ数増加）が発生
- レプリカ 1→2 で単純に倍額
- **全サービス中、最もスケール影響を受ける**

#### Storage（¥0.80 → データ量比例で増加）

- 現在はほぼゼロだがユーザーが画像・アセットをアップロードすると GB 単位で増加
- Hot tier のため読み取りアクセスも課金対象

### 中リスク（状況次第）

#### Front Door（¥1,552 → リクエスト数比例）

- 基本料金 + リクエスト数課金
- 現在の用途はカスタムドメイン + SSL のみ
- Container Apps の組み込みカスタムドメイン + マネージド証明書で代替可能
- **廃止すれば丸ごと削減可能**

#### PostgreSQL（¥1,434 → ほぼ固定）

- Standard_B1ms の固定費が大部分
- ストレージ 32GB まで含まれるため、データ量が 32GB を超えない限り横ばい
- SKU を上げなければ安定

#### Bandwidth（¥0 → 配信量次第）

- 動画や大量画像の配信を始めると増加
- 現在はテスト利用のみで発生なし

### 低リスク（ほぼ変わらない）

#### Container Registry（¥312 → 固定）

- Basic SKU の月額固定費
- イメージ数・サイズが増えても微増程度

#### Log Analytics（¥0 → 無料枠内）

- 大量のログ出力をしなければ無料枠で収まる

## コスト削減案

### 即効策：Front Door 廃止（-¥1,552/月）

| 項目 | 現在 | 変更後 |
|-----|------|--------|
| カスタムドメイン | Front Door 経由 | Container Apps 組み込み |
| SSL 証明書 | Front Door マネージド | Container Apps マネージド |
| 月額 | ¥1,552 | ¥0 |

Container Apps はカスタムドメイン + マネージド証明書を無料で提供している。
CDN やWAF が不要なら Front Door は不要。

**削減効果: ¥1,552/月（年間 ¥18,629）**

### 運用策：Container Apps のスケール設定

| 設定 | 推奨値 | 効果 |
|-----|--------|------|
| min replicas | 0 | アイドル時の課金ゼロ（コールドスタートあり） |
| max replicas | 2〜3 | 急なスケールアウトによるコスト爆発を防止 |

### 中期策：PostgreSQL の見直し

- 現在の B1ms（¥1,434）は開発〜少人数向けには十分
- ユーザーが増えても SKU を上げる前に接続プーリング（PgBouncer）を検討
- Burstable tier のまま運用し、CPU 使用率が常時 80% 超えてから上位を検討

## 新サブスクリプション再作成時の推奨構成

| サービス | 推奨 | 月額見込み |
|---------|------|----------:|
| Container Apps × 4 | 0.5CPU/1Gi, min=0 | ¥2,000〜3,000 |
| PostgreSQL Flexible | Standard_B1ms, 32GB | ¥1,435 |
| Container Registry | Basic | ¥312 |
| Storage | Standard_LRS, Hot | ¥1〜 |
| Front Door | **なし** | ¥0 |
| Log Analytics | 無料枠 | ¥0 |
| **合計見込み** | | **¥3,748〜4,748** |

Front Door を外すだけで **月額 ¥1,500〜2,500 の削減**（現在比 25〜40% 減）。

## まとめ

- 最大コスト要因は **Container Apps**（47%）だが、min=0 設定でアイドル時ゼロにできる
- **Front Door は不要**。廃止で ¥1,552/月の即時削減
- PostgreSQL は固定費のため当面安定。SKU 変更は急がない
- Storage と Bandwidth は現在ゼロに近いが、アセット増に伴い監視が必要
