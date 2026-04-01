# タイルセット画像生成テスト仕様書

> **作成日**: 2026-03-18
> **作成者**: Claude Code (Opus 4.6)
> **目的**: `gen-official-asset.ts` パイプラインを活用し、`outdoor.png` 相当のタイルセット画像をテスト駆動で生成・品質検証する

---

## 1. 背景と目的

### 現状のタイルセット画像

| ファイル | 生成方法 | サイズ | 品質 |
|---------|---------|-------|------|
| `assets/tilesets/outdoor.png` | `gen-placeholder-tilesets.mjs`（手動パターン描画） | 3.3 KB | シンプルな幾何学模様 |
| `assets/tilesets/interior.png` | 同上 | 2.5 KB | 同上 |
| `assets/tilesets/map/outdoor_ai_master.png` | `gen-official-asset.ts`（Imagen 4.0 + sharp） | 21 KB | AI生成ドット絵 |

### 目標

`gen-official-asset.ts` の画像加工パイプライン（リサイズ・減色・背景透過・エッジ検出）を**テストで品質保証**しながら、`outdoor.png` と同じレイアウト（10列×4行、48x48px、40タイル）のタイルセットを再生成する。

テストが通る = 品質基準を満たした画像が出力される、という状態を作る。

---

## 2. アーキテクチャ

```
maps/tilesets.json          ← タイル定義（名前・配置・terrain）
        │
        ▼
┌─────────────────────────────────┐
│  gen-official-asset.ts          │
│  ┌───────────┐  ┌────────────┐  │
│  │ fetchImagen│→│processComponent│
│  │ (API呼出)  │  │ resize 48x48 │
│  └───────────┘  │ DB32 減色    │
│                  │ 背景透過     │
│                  │ エッジ検出   │
│                  └────────────┘  │
│          ↓ composite             │
│  ┌────────────────┐              │
│  │ master.png 出力 │              │
│  └────────────────┘              │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  出力先: assets/tilesets/map/YYYYMMDD_HHmmss/ │
│  ├── outdoor_master.png      ← マスタータイルセット │
│  ├── outdoor_map_sample.png  ← テスト生成マップ    │
│  ├── raw/                    ← AI生成元画像 (1024x1024) │
│  │   ├── 00_grass_raw.png                          │
│  │   └── ...                                       │
│  └── processed/              ← 加工後タイル (48x48)    │
│      ├── 00_grass_processed.png                    │
│      └── ...                                       │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  テスト（Vitest）               │
│  ・出力画像のピクセル検証        │
│  ・パレット準拠チェック          │
│  ・レイアウト整合性チェック      │
│  ・個別タイル品質チェック        │
│  ・マップ画像の整合性チェック    │
└─────────────────────────────────┘
```

### 2-1. 出力フォルダ構造

生成ごとに**実行時刻のフォルダ**を作成し、タイルセット・個別タイル・マップ画像をすべて同一フォルダに格納する。過去の生成結果を上書きせず、比較・履歴管理ができる。

```
assets/tilesets/map/
├── 20260318_163500/           ← 1回目の生成
│   ├── outdoor_master.png     ← マスタータイルセット (480x192)
│   ├── outdoor_map_sample.png ← タイルを使ったサンプルマップ画像
│   ├── raw/                   ← Imagen 生成元画像
│   │   ├── 00_grass_raw.png
│   │   ├── 01_grass-flower_raw.png
│   │   └── ...
│   └── processed/             ← 加工後 48x48 タイル
│       ├── 00_grass_processed.png
│       ├── 01_grass-flower_processed.png
│       └── ...
├── 20260318_170200/           ← 2回目の生成（パラメータ調整後）
│   ├── outdoor_master.png
│   ├── outdoor_map_sample.png
│   ├── raw/
│   └── processed/
├── latest -> 20260318_170200  ← 最新へのシンボリックリンク（任意）
└── outdoor_ai_master.png      ← 既存（旧形式、互換用）
```

**フォルダ名フォーマット**: `YYYYMMDD_HHmmss`（例: `20260318_163500`）

**マップ画像**: 生成したタイルを使って簡単なサンプルマップ（草原 + 水辺 + 木 + 道）を自動レイアウトし、タイルの実用イメージを確認できるようにする。

---

## 3. テスト設計

### 3-1. テストファイル配置

```
packages/tools/test/
  tileset-pipeline.test.ts     ← パイプライン単体テスト（API不要）
  tileset-output.test.ts       ← 出力画像 + マップ画像の品質検証テスト
```

### 3-2. パイプライン単体テスト（`tileset-pipeline.test.ts`）

API呼び出しなしで画像加工ロジックだけをテストする。テスト用の入力画像（48x48 の単色PNG）を `sharp` で動的に生成し、パイプラインに通す。

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 1 | `getNearestColor は DB32 パレット内の色を返す` | 任意のRGB値に対して、返り値が DB32_PALETTE 32色のいずれかであること |
| 2 | `getNearestColor: 赤(255,0,0) → DB32の最寄り赤` | `[172, 50, 50]` または `[217, 87, 99]` を返すこと |
| 3 | `getNearestColor: 白(255,255,255) → DB32の白` | `[255, 255, 255]` を返すこと |
| 4 | `getNearestColor: 黒(0,0,0) → DB32の黒` | `[0, 0, 0]` を返すこと |
| 5 | `processComponent（テクスチャモード）: 出力が 48x48` | `isTexture=true` で渡した画像が 48x48px の PNG として返ること |
| 6 | `processComponent（テクスチャモード）: 全ピクセルが DB32 パレット` | 出力画像の全ピクセルRGBが DB32_PALETTE のいずれかに一致すること |
| 7 | `processComponent（テクスチャモード）: 透明ピクセルなし` | テクスチャモードでは alpha=255 のみであること |
| 8 | `processComponent（オブジェクトモード）: 白背景が透過される` | 白背景 (>245,>245,>245) のピクセルが alpha=0 になること |
| 9 | `processComponent（オブジェクトモード）: エッジに黒フチ` | 前景と透明の境界ピクセルが `[0,0,0,255]` であること |
| 10 | `processComponent（オブジェクトモード）: 前景が DB32 パレット` | 非透明ピクセルの RGB が DB32 パレットのいずれかに一致すること |
| 11 | `テクスチャ判定: grass → true` | `isTexture` 判定の正規表現が grass にマッチすること |
| 12 | `テクスチャ判定: rock → false` | `isTexture` 判定の正規表現が rock にマッチしないこと |
| 13 | `テクスチャ判定: water → true` | water がテクスチャとして判定されること |
| 14 | `テクスチャ判定: fence-h → false` | fence がオブジェクトとして判定されること |

### 3-3. 出力画像品質テスト（`tileset-output.test.ts`）

生成済みの `outdoor_ai_master.png` を読み込んで品質を検証する。API呼び出しは不要。

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 15 | `時刻フォルダが YYYYMMDD_HHmmss 形式で作成される` | 出力先フォルダ名が正規表現 `/^\d{8}_\d{6}$/` にマッチすること |
| 16 | `マスター画像がフォルダ内に存在する` | `assets/tilesets/map/{timestamp}/outdoor_master.png` が存在すること |
| 17 | `画像サイズが 480x192 (10列×4行×48px)` | `sharp(file).metadata()` で width=480, height=192 を検証 |
| 18 | `全ピクセルが DB32 パレット準拠（非透明部分）` | alpha>0 の全ピクセルの RGB が DB32 32色のいずれかであること |
| 19 | `パレット使用色数が 8色以上` | 色が少なすぎるとバグの可能性。最低8色は使用されていること |
| 20 | `空タイル（未定義スロット）がグレー系` | tilesets.json に定義がない ID 6-9, 17-19, 27-29, 35-39 のタイルが背景色（透明 or グレー）であること |
| 21 | `草タイル (ID:0) が緑系が支配的` | タイル(0,0)の非透明ピクセルのうち、G成分が R,B より大きいピクセルが 50% 以上 |
| 22 | `水タイル (ID:10) が青系が支配的` | タイル(0,1)の非透明ピクセルのうち、B成分が R,G より大きいピクセルが 50% 以上 |
| 23 | `土タイル (ID:3) が茶系` | R>G>B のピクセルが 40% 以上 |
| 24 | `各定義済みタイルに非透明ピクセルが存在` | tilesets.json の全定義タイル（25タイル）について、非透明ピクセルが 10% 以上あること |
| 25 | `raw/ に個別ファイルが保存されている` | `{timestamp}/raw/` に各タイルの元画像ファイルが存在 |
| 26 | `processed/ に個別ファイルが保存されている` | `{timestamp}/processed/` に各タイルの加工後ファイルが存在 |

### 3-4. マップ画像生成テスト（`tileset-output.test.ts` 内）

生成したタイルを使って**サンプルマップ画像**を組み立て、同じ時刻フォルダに保存する。マップは `maps/tilesets.json` のタイル定義を使い、簡易なフィールドマップ（10x8タイル = 480x384px）を自動レイアウトする。

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 27 | `サンプルマップ画像が同一フォルダに生成される` | `{timestamp}/outdoor_map_sample.png` が存在すること |
| 28 | `マップ画像サイズが 480x384 (10列×8行×48px)` | width=480, height=384 を検証 |
| 29 | `マップ画像が DB32 パレット準拠` | 全ピクセルが DB32 32色のいずれかであること |
| 30 | `マップに草・水・木・道の4種以上のタイルが使用されている` | ユニークなタイル ID が 4種以上使われていること |
| 31 | `マップのタイル配置が tilesets.json の ID 範囲内` | 使用されているタイル ID が全て 0〜39 の範囲内であること |

**マップレイアウト（自動生成パターン）**:

```
草  草花 草  土道 土道 土道 草  草  草花 草       ← 行0: 草原 + 道
草  草  草  土道 草  草  草  草  草  草       ← 行1
草  木上 草  土道 草  岩  草  木上 草  草       ← 行2: 自然物
草  木幹 草  土  草  草  草  木幹 草  草       ← 行3
水上 水上 水上 水上 水上 水上 水上 水上 水上 水上     ← 行4: 水辺（上端）
水  水  水  水  水  水  水  水  水  水       ← 行5: 水面
水  水  水  水  水  水  水  水  水  水       ← 行6: 水面
砂  砂  砂  砂  砂  砂  砂  砂  砂  砂       ← 行7: 砂浜
```

### 3-5. tilesets.json 整合性テスト

| # | テスト名 | 検証内容 |
|---|---------|---------|
| 32 | `outdoor タイルセットの columns=10, tileCount=40` | JSON 定義の基本構造 |
| 33 | `全タイル ID が 0〜39 の範囲内` | tiles のキーが範囲外でないこと |
| 34 | `タイル名が重複しない` | 同じ name のタイルが複数定義されていないこと |
| 35 | `isTexture 判定と terrain の整合性` | terrain=grass/water/dirt/sand のタイルが isTexture=true に該当すること |

---

## 4. 実装計画

### Phase 1: パイプライン関数のエクスポート（リファクタリング）

現在の `gen-official-asset.ts` は全ロジックが `main()` に閉じている。テスト可能にするため、以下の関数を個別にエクスポートする：

```typescript
// scripts/cli/asset/tileset-pipeline.ts （新規、ロジック分離）
export const DB32_PALETTE: number[][];
export function getNearestColor(r: number, g: number, b: number): number[];
export function processComponent(buffer: Buffer, isTexture: boolean): Promise<Buffer>;
export function isTextureTile(name: string): boolean;
export function createTimestampDir(basePath: string): string; // YYYYMMDD_HHmmss フォルダ作成
export function composeSampleMap(                              // サンプルマップ画像生成
  tilesetPath: string,
  tilesetDef: TilesetDef,
  mapLayout: number[][],
  outputPath: string
): Promise<void>;
```

`gen-official-asset.ts` は上記をインポートして使う（CLI エントリポイントとして残す）。

### Phase 2: 出力先を時刻フォルダに変更

`gen-official-asset.ts` の出力先を変更：

```typescript
// 変更前
const finalOutPath = path.join(PROJECT_ROOT, `assets/tilesets/map/${tsDef.name}_ai_master.png`);
const debugDir = path.join(PROJECT_ROOT, `assets/tilesets/map/${tsDef.name}_debug`);

// 変更後
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');
const runDir = path.join(PROJECT_ROOT, `assets/tilesets/map/${timestamp}`);
const finalOutPath = path.join(runDir, `${tsDef.name}_master.png`);
const rawDir = path.join(runDir, 'raw');
const processedDir = path.join(runDir, 'processed');
```

タイルセット生成完了後に、同じフォルダ内にサンプルマップ画像も生成：

```typescript
// マップ自動レイアウト → 同一フォルダに保存
const mapOutPath = path.join(runDir, `${tsDef.name}_map_sample.png`);
await composeSampleMap(finalOutPath, tsDef, SAMPLE_MAP_LAYOUT, mapOutPath);
```

### Phase 3: テスト用入力画像の準備

テスト内で `sharp` を使って動的に生成する（ファイル不要）：

```typescript
// 48x48 の赤い正方形（テクスチャテスト用）
const redTile = await sharp({
  create: { width: 48, height: 48, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } }
}).png().toBuffer();

// 白背景 + 中央に緑の四角（オブジェクトテスト用）
const objectTile = await sharp({
  create: { width: 128, height: 128, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } }
}).composite([{
  input: await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 255 } } }).png().toBuffer(),
  left: 32, top: 32
}]).png().toBuffer();
```

### Phase 4: テスト実装・実行

```bash
# 単体テスト実行
npm test -w @kaedevn/tools -- tileset-pipeline.test.ts

# 出力品質 + マップ画像テスト実行
npm test -w @kaedevn/tools -- tileset-output.test.ts
```

### Phase 5: タイルセット + マップ再生成

テストが全て通る状態で、AI パイプラインでタイルセット + マップを再生成：

```bash
# outdoor タイルセットを Imagen 4.0 で再生成（時刻フォルダに出力）
npx tsx scripts/cli/asset/gen-official-asset.ts outdoor
# → assets/tilesets/map/20260318_163500/
#    ├── outdoor_master.png
#    ├── outdoor_map_sample.png
#    ├── raw/
#    └── processed/

# 生成後にテストで品質検証
npm test -w @kaedevn/tools -- tileset-output.test.ts
```

生成結果が品質テストに通らない場合、`processComponent` のパラメータ（trim threshold、エッジ検出ロジック等）を調整して再実行。新しい時刻フォルダが作られるので、過去の結果と比較可能。

---

## 5. 現行 `outdoor.png` との比較

### 現行（`gen-placeholder-tilesets.mjs` による生成）

- **方式**: 純粋な JavaScript でピクセルを手動配置（`setPixel` / `fillRect` / `hLine`）
- **カラー**: 独自パレット（約40色）を `C` オブジェクトに定義
- **パターン**: タイル名ごとに専用の描画関数（`PATTERNS` マップ、30パターン）
- **PNG出力**: 自前 CRC32 + zlib deflate で PNG バイナリを直接生成
- **長所**: API不要、決定的（毎回同じ出力）、高速
- **短所**: 幾何学的パターンのみ。自然物（木、岩、水面）の表現が限定的

### 新規（`gen-official-asset.ts` による生成）

- **方式**: Imagen 4.0 で 1024x1024 画像生成 → sharp で 48x48 にドット絵化
- **カラー**: DawnBringer 32 パレットに強制減色
- **加工**: 背景透過 + ニアレストネイバー縮小 + エッジ検出（黒フチ）
- **長所**: 自然でリッチなドット絵、AI の表現力を活用
- **短所**: API キー必要、非決定的（毎回微妙に異なる出力）、コスト発生

### テストによる橋渡し

テストを「品質ゲート」として使うことで、非決定的な AI 生成でも以下を保証する：

1. **サイズ整合性** — 480x192px（10×4×48）であること
2. **パレット準拠** — DB32 32色のみ使用していること
3. **色の妥当性** — 草は緑、水は青、土は茶など期待通りの色分布
4. **レイアウト整合性** — tilesets.json の定義通りの配置
5. **個別タイル品質** — 各タイルに十分な描画がされていること

---

## 6. 実行コマンドまとめ

```bash
# 1. ロジック分離（リファクタリング後）
npm test -w @kaedevn/tools -- tileset-pipeline    # パイプライン単体テスト（14件）

# 2. タイルセット + マップ生成（時刻フォルダに出力）
npx tsx scripts/cli/asset/gen-official-asset.ts outdoor
# → assets/tilesets/map/20260318_HHMMSS/ に一式出力

# 3. 生成物の品質 + マップ検証
npm test -w @kaedevn/tools -- tileset-output       # 出力品質テスト（12件）+ マップテスト（5件）

# 4. 全テスト一括
npm test -w @kaedevn/tools

# 5. 過去の生成結果を確認
ls -lt assets/tilesets/map/                        # 時刻フォルダ一覧
```

---

## 7. 成功基準

- [ ] パイプライン単体テスト 14件 全パス
- [ ] 出力品質テスト 12件 全パス（時刻フォルダ・マスター画像・パレット・色分布）
- [ ] マップ画像生成テスト 5件 全パス（サンプルマップ生成・サイズ・パレット・タイル種類）
- [ ] tilesets.json 整合性テスト 4件 全パス
- [ ] **合計 35件** のテストが通る状態
- [ ] `assets/tilesets/map/YYYYMMDD_HHmmss/` に以下が揃っている：
  - `outdoor_master.png` — 10×4 レイアウトのタイルセット（480x192px）
  - `outdoor_map_sample.png` — タイルを使ったサンプルマップ（480x384px）
  - `raw/` — Imagen 生成元画像
  - `processed/` — 加工後 48x48 タイル
- [ ] 再生成しても過去の結果が上書きされない（別の時刻フォルダに保存される）
