# editor-json インポート実施結果 & 改善案

**日付**: 2026-03-11
**対象**: `projects/fantasy_generated/output/20260311_161005/editor-json/`
**方式**: 案A（最小変換）

---

## 1. 実施結果

### 投入先

| 項目 | 値 |
|------|-----|
| Project ID | `01KKDX2WBHCAXN2VXNT3K8TWE6` |
| API | `http://localhost:8080` |
| エディタ | `http://localhost:5176/projects/editor/01KKDX2WBHCAXN2VXNT3K8TWE6` |
| プレビュー | `http://localhost:8080/api/preview/01KKDX2WBHCAXN2VXNT3K8TWE6` |

### 数値

| 項目 | 値 |
|------|-----|
| ページ数 | 15 |
| 総ブロック数 | 499 |
| 除去したプロパティ | 1,351 |
| 使用背景 | 3種（bg_field, bg_forest, bg_indoor） |
| 使用キャラクター | 3体（luca, yolda, fantasy_hero） |
| 表情 | normal のみ |

### 変換で行ったこと

1. **背景 39 種 → 3 種にマッピング**
   - 室内系（小屋、長老の家、遺跡入口）→ `bg_indoor`
   - 森系（霧、月明かり、毒沼、呪い森 等）→ `bg_forest`
   - 屋外系（村、泉、涸れ谷、祭壇 等）→ `bg_field`

2. **キャラクター 11 体 → 3 体にマッピング**
   - luca → luca（そのまま）
   - garud/gard/gald（表記揺れ）, elder, bandit_* → fantasy_hero
   - kon, mira/meera（表記揺れ）→ yolda

3. **表情 全て `normal` に統一**
   - 元データには 80+ 種類の表情（surprised, determined, worried, anxious, calm 等）
   - 公式アセットが normal のみのため一律フォールバック

4. **speaker 名を日本語に変換**
   - luca → ルカ, garud/gard/gald → ガルド, kon → コン, mira/meera → ミーラ, elder → 長老

5. **非標準プロパティ除去**（1,351 個）
   - bg: `timeContext`, `weather`, `cameraAngle`
   - ch: `emotionDetail`, `action`
   - text: `isThought`, `emotion`, `tone`, `wait`

6. **ブロック ID 再採番**
   - `{type}-{timestamp}-{pageIdx}-{blockIdx}` 形式で全 499 ブロックを一意に

7. **bg の assetId を実際のアセット ID に解決**
   - `BgBlockCard.tsx` は `bgAssets.find((a) => a.id === block.assetId)` で検索（slug ではなく ID）
   - スクリプトがプロジェクトの bg アセット一覧を取得し、slug → ID のマッピングを構築

8. **ch-class メタデータの永続化**
   - `ChBlockCard.tsx` は `characters.find((c) => c.slug === block.characterId)` → `expressions.find(e => e.slug === block.expressionId)` で表情画像を解決
   - GET `/api/projects/:id` は ch-class アセットの `metadata.expressions` から `data.characters` を再構築する（PUT で保存した `data.characters` は上書きされる）
   - そのため `PUT /api/assets/:projectId/character-class/:slug` で `expressions: { normal: imageAssetId }` を永続化する必要がある
   - スクリプトが未紐付の ch-img アセットを検出し、ch-class メタデータに自動紐付け

### 実装中に発見・修正した問題

| # | 問題 | 原因 | 修正 |
|---|------|------|------|
| 1 | bg ブロックが「画像未選択」表示 | `assetId` に slug を設定していたが、`BgBlockCard.tsx` は `id` で検索 | `resolvedBgMap` を slug → **ID** に変更 |
| 2 | ch ブロックが「?」表示（画像なし） | `data.characters` に expressions を保存しても、GET endpoint が ch-class metadata から再構築して上書き | `PUT /api/assets/:projectId/character-class/:slug` で metadata に expressions を永続化 |

---

## 2. 現状の問題点（案A の限界）

### 致命的

| # | 問題 | 影響 |
|---|------|------|
| 1 | **背景が 3 枚しかない** | 39 種の場面が 3 パターンに潰れ、場面転換の区別がつかない |
| 2 | **キャラが 3 体で 11 役** | ガルド・長老・山賊が全て同じ見た目 |
| 3 | **表情が全て同じ** | 感情表現が完全に消失 |

### 中程度

| # | 問題 | 影響 |
|---|------|------|
| 4 | **キャラ名の表記揺れ**（garud/gard/gald）| AI 生成パイプラインのバグ。page ごとに別人扱いになる可能性 |
| 5 | **除去したメタ情報が惜しい** | `emotion`, `tone`, `wait` は演出強化に活用できるデータ |
| 6 | **ページタイトルに "Stage 3" 等の生成痕跡** | 見栄えが悪い |

---

## 3. 改善案（案B への段階的拡張）

### 改善 1: 背景バリエーション拡充（優先度: 高）

**現状**: 3 枚で 39 場面をカバー
**目標**: 10〜15 枚で主要場面を区別

**方法**:
- `GET /api/official-assets` で利用可能な背景一覧を取得
- 場面カテゴリ（村、泉、森・昼、森・夜、洞窟、祭壇、峠 等）ごとに最適な公式背景をマッピング
- マッピングテーブルを `BG_MAP` に反映

**必要データ**: 公式背景アセットの全一覧（名前 + サムネイル）

### 改善 2: キャラクター追加（優先度: 高）

**現状**: 3 体で 11 役
**目標**: 主要 4〜5 体 + サブキャラ

**方法**:
- 公式キャラアセットから elder（老人系）、bandit（悪役系）に適した画像を探す
- ガルド・コン・ミーラを独立キャラとして登録（表記揺れを統一）

**生成パイプラインの修正**:
- `garud`/`gard`/`gald` を統一する（Stage 3-4 で名前がブレている）
- characters.json に全キャラを定義する

### 改善 3: 表情バリエーション（優先度: 中）

**現状**: normal のみ
**目標**: 基本 5 表情（normal, happy, sad, angry, surprised）

**方法**:
- 公式アセットにキャラ別表情画像があれば利用
- なければ、表情フィルタ（色調変化 + テキスト演出）で簡易対応
- `expressionId` マッピングテーブル: 80+ → 5 に集約

```
surprised, shocked → surprised
happy, hopeful, relieved, gentle_smile, joyful → happy
sad, worried, anxious, pained, exhausted → sad
angry, hostile, fighting, tense → angry
それ以外 → normal
```

### 改善 4: メタ情報の活用（優先度: 低）

除去した `emotion`, `tone`, `wait` を活用する方法:

- **wait**: text ブロックに `wait` プロパティを公式サポート → 演出テンポ制御
- **emotion**: テキスト表示時のエフェクト（画面揺れ、色変化）に変換
- **tone**: speaker 表示のフォントスタイルに反映

→ エディタ/エンジン側の機能追加が必要。長期的な改善候補。

### 改善 5: ページタイトル整理（優先度: 低）

```
"涸れ谷の足音 - Stage 3" → "涸れ谷の足音"
"黒き病巣 - 第3話" → "大樹の病巣と過去の罪 - 第1話"
```

→ manifest.json の title を正規化する or 章タイトル + 話数で再生成

### 改善 6: 生成パイプライン修正（優先度: 中）

| 問題 | 修正箇所 |
|------|---------|
| キャラ名表記揺れ | Stage 3-4 の prompt に characters.json のスラグ一覧を注入 |
| 背景スラグの `$bg:` プレフィックス | Stage 4 で除去 or manifest の bgDependencies と一致させる |
| characters.json に全キャラ未定義 | Stage 4 の変換ロジックで登場キャラを自動追加 |

---

## 4. 変換スクリプト

`scripts/import-editor-json.ts`

```bash
# dry-run（ファイル出力のみ）
npx tsx scripts/import-editor-json.ts <editor-json-dir> --dry-run

# 実行（API 投入）
npx tsx scripts/import-editor-json.ts <editor-json-dir>

# Azure 向け
API_URL=https://ca-api.icymeadow-82e272bc.japaneast.azurecontainerapps.io \
  npx tsx scripts/import-editor-json.ts <editor-json-dir>
```

---

## 5. 次のアクション

1. エディタで 15 ページの表示を確認する
2. プレビューで再生確認する
3. 改善 1-2（背景 + キャラ拡充）の公式アセット調査
4. 生成パイプラインのキャラ名表記揺れ修正
