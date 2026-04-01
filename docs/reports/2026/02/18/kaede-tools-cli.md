# @kaedevn/tools

ノベルゲーム立ち絵アセット変換 CLI ツール。

MP4動画（Midjourney等）から、ゲームエンジンで使えるアニメーション立ち絵（連番PNG / アニメーションWebP）を生成します。

## インストール

```bash
# monorepo 内で使用（依存は自動解決）
cd packages/tools
npm install
```

ffmpeg は `ffmpeg-static` で自動提供されるため別途インストール不要です。

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `mp4topng` | MP4 → 連番PNG |
| `rmbg` | 単色背景を透過に変換 |
| `webp` | 連番PNG → アニメーションWebP |
| `convert` | 上記3つを一括実行 |

## 使い方

```bash
# 開発中はこちら
npx tsx src/cli.ts <command> [options]

# ビルド後
npx kaede-tools <command> [options]
```

---

### mp4topng — MP4 → 連番PNG

```bash
npx tsx src/cli.ts mp4topng <input.mp4> [options]
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--fps` | 12 | 出力フレームレート |
| `--out` | `./frames` | 出力ディレクトリ |
| `--prefix` | `frame` | ファイル名プレフィックス |

出力: `frame_0001.png`, `frame_0002.png`, ...

```bash
# 例: 8fps でフレーム抽出
npx tsx src/cli.ts mp4topng character.mp4 --fps 8 --out ./my_frames
```

---

### rmbg — 背景除去（アルファ抜き）

単色背景（白/黒/グリーン）を透過に変換します。ファイル指定で1枚、ディレクトリ指定で一括処理。

```bash
npx tsx src/cli.ts rmbg <input> [options]
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--color` | `white` | 背景色 (`white` / `black` / `green`) |
| `--threshold` | 15 | 色の許容範囲 (0-100)。大きいほど広い範囲を透過 |
| `--feather` | 3 | 境界ぼかし (px)。0でくっきり |
| `--out` | 自動 | 出力先パス |

```bash
# 1枚処理
npx tsx src/cli.ts rmbg character.png --color white --threshold 20

# ディレクトリ一括処理
npx tsx src/cli.ts rmbg ./frames --out ./frames_alpha
```

---

### webp — 連番PNG → アニメーションWebP

透過対応のアニメーションWebPを生成します。

```bash
npx tsx src/cli.ts webp <フレームDir> [options]
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--fps` | 12 | フレームレート |
| `--quality` | 80 | WebP品質 (0-100) |
| `--loop` | 0 | ループ回数 (0=無限) |
| `--width` | 元サイズ | リサイズ幅 (px) |
| `--prefix` | `frame` | ファイル名プレフィックス |
| `--out` | `./output.webp` | 出力ファイル |

```bash
npx tsx src/cli.ts webp ./frames_alpha --fps 8 --width 512 --out character.webp
```

---

### convert — 一括変換

MP4 → 連番PNG → 背景除去 → アニメーションWebP を一発で実行。

```bash
npx tsx src/cli.ts convert <input.mp4> [options]
```

上記すべてのオプションに加えて:

| オプション | 説明 |
|-----------|------|
| `--no-webp` | WebP生成をスキップ（連番PNGだけ出力） |
| `--keep-frames` | 変換後も連番PNGを残す |

```bash
# 基本（MP4 → WebP、中間ファイルは自動削除）
npx tsx src/cli.ts convert character.mp4

# カスタム設定
npx tsx src/cli.ts convert character.mp4 --fps 8 --width 512 --quality 75 --out ./tachie

# PNG連番だけ欲しい場合
npx tsx src/cli.ts convert character.mp4 --no-webp --keep-frames --out ./frames
```

---

## 典型的なワークフロー

### Midjourney動画 → ゲーム立ち絵

```bash
# 1. 一括変換（一番簡単）
npx tsx src/cli.ts convert midjourney.mp4 --fps 8 --width 624 --out ./hero_idle

# 2. 生成されたファイル
#    ./hero_idle/midjourney.webp  ← アニメーションWebP

# 3. エディタでZIPアップロード or 直接配置
```

### 手動で段階的に処理

```bash
# Step 1: フレーム抽出
npx tsx src/cli.ts mp4topng input.mp4 --fps 8 --out ./step1_frames

# Step 2: 背景除去（結果を確認しながら閾値調整）
npx tsx src/cli.ts rmbg ./step1_frames --threshold 20 --feather 5 --out ./step2_alpha

# Step 3: WebP生成
npx tsx src/cli.ts webp ./step2_alpha --width 512 --quality 80 --out hero.webp
```

## 依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `ffmpeg-static` | MP4デコード（別途インストール不要） |
| `sharp` | 画像処理（リサイズ、ピクセル操作） |
| `node-webpmux` | アニメーションWebP結合 |
| `archiver` | ZIP圧縮（将来用） |
