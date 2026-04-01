# 設計書：Gemini CLI エディタ直結出力（editor-json）化

## 1. 目的
Gemini CLI の出力を中間形式である `.ks` ファイルから、エディタが直接読み込める `editor-json`（ブロック JSON）に変更する。これにより、正規表現による不安定な変換処理（`ks-convert.mjs`）を廃止し、生成の精度と信頼性を向上させる。

## 2. システム構成
### 変更前
`Gemini` → `.ks` (KaedeScript) → `ks-convert.mjs` → `editor-json` → `ks-upload.mjs`

### 変更後
`Gemini` → **`editor-json`** (Block JSON) → `ks-upload.mjs`

## 3. 出力ディレクトリ構造
`projects/<project_name>/output/<timestamp>/editor-json/` 配下に以下の構成で出力する。

```text
editor-json/
  ├── manifest.json      # プロジェクト設定・アセット依存定義
  ├── characters.json    # キャラクター定義（config から生成）
  ├── page-001.json      # シナリオデータ（1話分 = 1ページ）
  ├── page-002.json
  └── ...
```

## 4. 各ステージの変更内容

### Stage 3: 本文生成 (`prompts.ts`)
- **プロンプトの刷新**: AI に対し、`.ks` 形式ではなく「エディタ用ブロック形式」を意識したテキスト生成を指示する。
- **制約の強化**: 1ブロック最大46文字×3行、`@r\n` による改行、名前プレフィックスの禁止をプロンプトに組み込む。
- **出力形式**: 現行の `lines` 配列を維持しつつ、各行が直接 `text` ブロックや `ch` ブロックにマッピングしやすい構造にする。

### Stage 4: JSON 変換 (`ks-generator.ts` を `editor-json-generator.ts` へ)
- **入力**: Stage 3 の生成結果 + `scripts/cli/configs/<genre>.json`
- **処理**: 
  1. `configs/*.json` を読み込み、場所名（`zh_hall` 等）を `$bg:bg_hall` のような正規の `assetId` に変換。
  2. キャラクターの `speaker` スラグを `characterId` にマッピング。
  3. テキストを46文字ルールでバリデーションしつつ、`text` ブロック化。
  4. ページの先頭に `start`, `bg`, `ch` ブロックを自動挿入。
  5. ページ末尾に次ページへの `jump` ブロックを生成。

### 全体統合 (`assist-cli.ts`)
- **`manifest.json` の生成**: 実行開始時に `configs/<genre>.json` から `manifest.json` を書き出す。
- **`characters.json` の生成**: 設定ファイルからエディタ形式のキャラクターリストを作成。

## 5. アセット解決ロジック
`scripts/cli/configs/drama.json` の `bgMapping` を利用する。

- 例: `location: "zh_hall"` 
  - `bgMapping["zh_hall"]` が `0` を返す。
  - `bgSlugs[0]` が `"bg_hall"` を返す。
  - 最終的な `assetId`: `"$bg:bg_hall"`

## 6. 実装ステップ
1.  **Config ローダーの実装**: `assist-cli.ts` に `scripts/cli/configs/*.json` を読み込む機能を追加。
2.  **JSON 生成エンジンの作成**: `apps/hono/src/lib/assist/editor-json-generator.ts`（新規）を作成。
3.  **プロンプトの調整**: `Stage 3` のプロンプトを新しいテキスト制約に合わせる。
4.  **出力コマンドの更新**: `Stage 4` 実行時に `editor-json/` ディレクトリを作成し、ファイルを書き出す。
