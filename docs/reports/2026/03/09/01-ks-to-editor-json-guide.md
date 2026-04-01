# KS → エディタプロジェクト 手順書

output ディレクトリの `.ks` ファイルをブロック JSON に変換し、エディタプロジェクトに投入する手順。
**変換（ks-convert）と投入（ks-upload）は独立したツール。**

---

## 全体フロー

```
Step 1: Gemini CLI で KS 生成
         ↓
Step 2: ks-convert.mjs で JSON 変換（オフライン・API不要）
         ↓
     editor-json/ を確認・手動編集（任意）
         ↓
Step 3: ks-upload.mjs で API 投入（サーバー必要）
```

---

## Step 1: KS 生成（Gemini）

```bash
npx tsx scripts/cli/ai/assist-cli.ts all --settings projects/{project}/settings --max-chapters 1
```

出力先: `projects/{project}/output/YYYYMMDD_HHMMSS/`
生成物: `ch1_ep1.ks`, `ch1_ep2.ks`, `ch1_ep3.ks` 等

---

## Step 2: 変換（ks-convert.mjs）

**API 不要。オフラインで実行可能。**

```bash
node scripts/cli/ks-convert.mjs --config <genre> <ks-directory>
```

### 使用例

```bash
node scripts/cli/ks-convert.mjs --config fantasy  projects/fantasy/output/20260308_143338/
node scripts/cli/ks-convert.mjs --config comedy   projects/comedy/output/20260308_172012/
node scripts/cli/ks-convert.mjs --config drama    projects/chinese-short-drama/output/YYYYMMDD_HHMMSS/
node scripts/cli/ks-convert.mjs --config horror   projects/horror/output/YYYYMMDD_HHMMSS/
node scripts/cli/ks-convert.mjs --config longstory projects/longstory/output/YYYYMMDD_HHMMSS/
node scripts/cli/ks-convert.mjs --config mystery  projects/mystery/output/YYYYMMDD_HHMMSS/
node scripts/cli/ks-convert.mjs --config romance  projects/romance/output/YYYYMMDD_HHMMSS/
```

### 利用可能な config

| config 名 | タイトル | キャラ数 | BG数 |
|---|---|---|---|
| `fantasy` | ファンタジー | 3 | 3 |
| `drama` | 龍王の帰還 | 3 | 3 |
| `comedy` | 幽霊部員が多すぎる | 5 | 3 |
| `horror` | 巳ノ口 | 4 | 3 |
| `longstory` | 霧ヶ崎島 | 5 | 3 |
| `mystery` | 真夜中の探偵 | 3 | 3 |
| `romance` | 放課後の約束 | 2 | 3 |

設定ファイル: `scripts/cli/configs/<genre>.json`

### 変換スクリプトが行う整形

| 処理 | 例 |
|------|-----|
| `[keita: 困惑]` 等の角括弧タグ除去 | `[keita: 困惑]` → （削除） |
| `@ch current 表情` のスキップ | 表情固定のため無視 |
| `「」` 括弧の除去 | テキストブロック用に平文化 |
| テキストウィンドウ幅に合わせた分割 | 46文字/行 × 3行でブロック分割 |
| 各ページ冒頭にBG + CH強制挿入 | 初期表示保証 |
| ページ間 jump ブロック自動追加 | 最終ページ以外 |

### 出力

```
output/YYYYMMDD_HHMMSS/editor-json/
  ├── manifest.json      ← メタ情報 + アセット依存宣言
  ├── characters.json    ← キャラクター定義（slug + officialAssetId）
  ├── page-001.json      ← ページ別ブロックデータ
  ├── page-002.json
  └── ...
```

### BG プレースホルダー

BG ブロックの `assetId` は `$bg:bg_field` 形式のプレースホルダー。
実際のアセット ID は Step 3（ks-upload）で API 経由で解決される。

```json
{ "id": "bg-1773014155217", "type": "bg", "assetId": "$bg:bg_field" }
```

### manifest.json の構造

```json
{
  "configName": "fantasy",
  "projectTitlePrefix": "ファンタジー",
  "totalPages": 15,
  "totalBlocks": 477,
  "bgDependencies": [
    { "slug": "bg_field", "officialAssetId": "01KJK93SXJDZA4TNZGGDDRHPWZ" }
  ],
  "characterDependencies": [
    { "slug": "luca", "name": "ルカ", "officialAssetId": "01KJ2T0H318QVPR2P11EWSEC6V" }
  ],
  "pages": [
    { "id": "page-001", "title": "第1章 枯れた泉 - 第1話", "blocks": 30 }
  ]
}
```

---

## （任意）editor-json の確認・手動編集

Step 2 の出力を確認し、必要に応じて手動で修正できる。

- `page-*.json` のブロック順序入れ替え
- テキスト修正
- 不要なブロック削除
- BG プレースホルダーの変更

投入前に中身を確認したい場合:
```bash
cat projects/fantasy/output/20260308_143338/editor-json/manifest.json | jq .
cat projects/fantasy/output/20260308_143338/editor-json/page-001.json | jq '.blocks | length'
```

---

## Step 3: 投入（ks-upload.mjs）

**API サーバーが必要。**

```bash
# ローカル（デフォルト）
node scripts/cli/ks-upload.mjs projects/fantasy/output/20260308_143338/editor-json/

# Azure
node scripts/cli/ks-upload.mjs --env azure projects/fantasy/output/20260308_143338/editor-json/
```

### 前提

- ローカル: `./scripts/dev-start.sh api` で API 起動済み
- Azure: 環境変数 `AZURE_API_URL` / `AZURE_EMAIL` / `AZURE_PASSWORD`（省略時はデフォルト値）

### ks-upload が行うこと

1. `manifest.json` を読み込む
2. API ログイン
3. プロジェクト新規作成（タイトル: `{prefix} YYYY-MM-DD HH:MM`）
4. `bgDependencies` の公式アセットをインポート → `$bg:slug` を実 ID に解決
5. `characterDependencies` のキャラ画像インポート + character-class 作成
6. 各ページ JSON のプレースホルダーを実 ID に置換
7. `PUT /api/projects/{id}` でブロックデータ保存
8. `editor-json/upload-result.json` に結果を保存

### 出力

```
editor-json/upload-result.json
```

```json
{
  "projectId": "01ABCDEF...",
  "projectTitle": "ファンタジー 2026-03-09 14:30",
  "env": "local",
  "editorUrl": "http://localhost:5176/projects/editor/01ABCDEF...",
  "uploadedAt": "2026-03-09T05:30:00.000Z"
}
```

---

## ファイル構成まとめ

```
output/YYYYMMDD_HHMMSS/
  ├── ch1_ep1.ks              ← Step 1: Gemini 生成（未加工）
  ├── ch1_ep2.ks
  ├── ch1_ep3.ks
  └── editor-json/            ← Step 2: 変換済み JSON
      ├── manifest.json       ← メタ情報 + 依存宣言
      ├── characters.json     ← キャラクター定義
      ├── page-001.json       ← ページ別ブロック
      ├── page-002.json
      ├── ...
      └── upload-result.json  ← Step 3: 投入結果（投入後に生成）
```

---

## 関連ドキュメント

- Gemini KS 出力仕様: `docs/09_reports/2026/03/09/02-gemini-ks-output-spec.md`
- config ファイル: `scripts/cli/configs/*.json`
- 変換スクリプト: `scripts/cli/ks-convert.mjs`
- 投入スクリプト: `scripts/cli/ks-upload.mjs`
