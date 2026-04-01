# スクリーンフィルター コマンドリファレンス

- **日付**: 2026-02-28
- **対象**: `.ksc` スクリプト（位置引数）

---

## 基本構文

```ksc
// フィルター適用（位置引数）
filter("night")

// intensity 指定あり
filter("colorTint", 0.4)

// フィルター解除
filter_clear()
```

| コマンド | 引数1 | 引数2 | 説明 |
|---------|-------|-------|------|
| `filter(type)` | フィルター名 (string) | — | フィルター適用 |
| `filter(type, intensity)` | フィルター名 (string) | 強度 (number) | フィルター適用（強度指定） |
| `filter_clear()` | — | — | フィルター解除 |

> **エイリアス**: `screenFilter(type, intensity)` / `screenFilterClear()` も使用可能（同じ動作）

---

## フィルター一覧（全 18 種）

### 基本フィルター（PixiJS 組み込み）

| type | 効果 | intensity の意味 | デフォルト |
|------|------|-----------------|-----------|
| `sepia` | セピア調（古写真風） | — | — |
| `grayscale` | グレースケール（白黒） | 適用度 (0〜1) | 1 |
| `blur` | ガウシアンぼかし | ぼかし強度 (px) | 4 |

### レトロ系

| type | 効果 | intensity の意味 | デフォルト | animated |
|------|------|-----------------|-----------|----------|
| `pc98` | PC-98 風（減色+ディザ+スキャンライン） | 色数 (8 / 16 / 32) | 32 | No |
| `gameboy` | ゲームボーイ風（4色緑パレット） | コントラスト | 1.0 | No |
| `crt` | CRT モニター（樽型歪み+サブピクセル+スキャンライン） | — | — | No |
| `pixelate` | モザイク / ドット絵風 | ピクセルサイズ (px) | 8 | No |

### 色調・雰囲気

| type | 効果 | intensity の意味 | デフォルト | animated |
|------|------|-----------------|-----------|----------|
| `vignette` | 周辺暗転（注意集中・緊張感） | 暗転の強さ (0〜1) | 0.5 | No |
| `colorTint` | 色ティント（夕焼け/ホラー/病的） | 混合率 (0〜1) | 0.3 | No |
| `night` | 夜景（彩度低下+青シフト+暗転） | 全体強度 (0〜1) | 0.6 | No |
| `bloom` | 発光（ロマンチック・夢・神聖） | ブルーム強度 | 0.5 | No |
| `focusBlur` | 被写界深度ぼかし（キャラ注目） | 最大ブラー強度 | 3.0 | No |

### 異常・演出系

| type | 効果 | intensity の意味 | デフォルト | animated |
|------|------|-----------------|-----------|----------|
| `chromaticAberration` | 色収差（精神異常・超常現象） | 強度 | 1.0 | No |
| `oldFilm` | 古い映画風（グレイン+明滅+セピア+傷） | — | — | **Yes** |
| `noise` | TV ノイズ（静電気・通信断絶） | ノイズ混合率 (0〜1) | 0.5 | **Yes** |
| `glitch` | デジタルグリッチ（破損・ホラー） | グリッチ強度 (0〜1) | 0.5 | **Yes** |

### 環境エフェクト

| type | 効果 | intensity の意味 | デフォルト | animated |
|------|------|-----------------|-----------|----------|
| `rain` | 雨（多層レインドロップ） | 雨の密度 (0〜1) | 0.4 | **Yes** |
| `underwater` | 水中（波歪み+青緑 tint+コースティクス） | — | — | **Yes** |

---

## シーン別 使用例

### 日常

```ksc
// 夕方の教室
filter("colorTint", 0.4)

// 夜の街
filter("night")

// 雨の日
filter("rain")
```

### 回想・記憶

```ksc
// セピア調の回想
filter("sepia")

// 古い映画風の記憶
filter("oldFilm")

// ゲームボーイ風コメディ回想
filter("gameboy")
```

### ロマンチック・夢

```ksc
// 夢のシーン（発光）
filter("bloom")

// 周辺ぼかし（キャラに注目）
filter("focusBlur")

// ビネット（親密感）
filter("vignette")
```

### ホラー・異常

```ksc
// 精神崩壊
filter("chromaticAberration")

// デジタルグリッチ
filter("glitch")

// TV ノイズ（通信途絶）
filter("noise")

// ホラー赤ティント
filter("colorTint", 0.5)
```

### SF・メタ演出

```ksc
// レトロ端末
filter("crt")

// PC-98 風
filter("pc98")

// モザイク遷移
filter("pixelate")
```

### 水中・幻想

```ksc
// 水中シーン
filter("underwater")

// ぼかし夢
filter("blur", 6)
```

### シーン終了

```ksc
// フィルター解除
filter_clear()
```

---

## 完全な使用例（シナリオ）

```ksc
bg("classroom")
ch("heroine", "smile", "center")

#heroine
いい天気だね

#

// 夕方に切り替え
filter("colorTint", 0.4)
bg("classroom_evening")

#heroine
もうこんな時間...

#

// 回想へ
filter("oldFilm")

#narrator
あの日のことを思い出す...

#

filter_clear()

// 夜
filter("night")
bg("school_gate")

#heroine
また明日ね

#

filter_clear()
```

---

## 注意事項

- フィルターは **同時に 1 つだけ** 適用可能。新しい `filter()` 呼び出しで前のフィルターは自動解除される
- `animated` フィルター（oldFilm, noise, glitch, rain, underwater）は自動でアニメーション開始
- `intensity` を省略するとデフォルト値が使われる
- `colorTint` のデフォルトティント色は暖色 (1.0, 0.85, 0.6)。色を変えるにはコード側のパラメータ調整が必要
- Switch 移植時: ポスト処理は Web レンダリング層のみ。Core 層・スクリプト構文には影響なし

---

## コマンド対応表

| 短縮 (推奨) | フルネーム | 説明 |
|-------------|-----------|------|
| `filter(type, intensity?)` | `screenFilter(type, intensity?)` | フィルター適用 |
| `filter_clear()` | `screenFilterClear()` | フィルター解除 |

他のコマンドとの命名規則比較:

| 短縮 | フルネーム | パターン |
|------|-----------|---------|
| `bg(name)` | `setBg(name)` | 背景 |
| `ch(name, pose)` | `showChar(name, pose)` | キャラ表示 |
| `bgm(name)` | `playBgm(name)` | BGM |
| `se(name)` | `playSe(name)` | 効果音 |
| `filter(type)` | `screenFilter(type)` | フィルター |

---

## テスト方法

```bash
# dev サーバー起動
cd packages/web && npm run dev

# ブラウザで全フィルター確認
open http://localhost:5175/filter-test.html

# 特定フィルターを直接表示
open http://localhost:5175/filter-test.html?filter=night

# 全フィルター自動スクリーンショット
node scripts/filter-screenshot.mjs
```
