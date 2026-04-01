# 資産検索および設定固定ガイド (Asset Search & Fix Guide)

## 1. 概要
Gemini Vision で解析された `official_assets` のメタデータを活用し、シナリオ執筆前に使用画像を確定させる。これにより、ゲームエンジン上での ID 不一致をゼロにし、画像の内容に即した精度の高いナラティブを生成する。

## 2. 資産の検索手順
以下のコマンド（または直接 SQL）を使用して、設定した「場所」や「キャラ」に合う画像を検索する。

### キーワード検索例 (psql)
```bash
# 「ファンタジー」「森」「夜」に合致する背景を探す
psql postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev -c "
SELECT id, filename, display_name 
FROM official_assets 
WHERE kind = 'image' 
  AND category = 'bg' 
  AND metadata->'tags' ? 'fantasy' 
  AND metadata->'tags' ? 'night'
LIMIT 5;"
```

## 3. 設定ファイルへの ID 固定方法
検索で見つけた `id` を、各設定ファイルの Markdown に明記する。

### s_04_world.md (背景の固定)
```markdown
- **ラーシュ村の泉（spring）**
  - **assetId**: `01KJ2T0G7CT...`  <-- ここに確定 ID を記述
  - **視覚**: ...
```

### s_02_characters.md (キャラクターの固定)
```markdown
- **ルカ（luca）**
  - **assetId**: `01KJ2VME9F...`  <-- ここに確定 ID を記述
  - **性格**: ...
```

## 4. 生成 AI への効果
設定ファイルに `assetId` が記載されている場合、`assist-cli` はその情報をプロンプトに含める。AI はその画像の詳細（`fromVision` の内容）を理解した上で執筆するため、ト書きと画像の不整合が完全に解消される。
