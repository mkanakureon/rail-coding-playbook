# kaedevn 全フィルター ギャラリー

> 撮影日: 2026-03-25 | 撮影方法: Playwright + headless Chromium (SwiftShader WebGL)
> 背景画像: `assets/backgrounds/bg01.png` (1280x720)
> フィルター強度: 効果が視認できるよう強め設定（intensity=0.6〜0.8 相当）
> 分類: `@kaedevn/core` FilterType 定義に準拠
>
> **修正履歴:**
> - GLSL 予約語 `active` → `isActive` に修正（firefly/sparkle/dust がコンパイルエラーで真っ黒だった）
> - ドロップダウンを `<optgroup>` による階層構造に変更
> - 効果が薄かったフィルター（pc98, bloom, vignette, oldFilm 等）のデフォルトパラメータを強化

## 1. 時間帯（5種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| 朝 | `morning` | ![morning](../../../../screenshots/filters/morning.png) |
| 夕方 | `sunset` | ![sunset](../../../../screenshots/filters/sunset.png) |
| 黄昏 | `twilight` | ![twilight](../../../../screenshots/filters/twilight.png) |
| 夜 | `night` | ![night](../../../../screenshots/filters/night.png) |
| 月明かり | `moonlight` | ![moonlight](../../../../screenshots/filters/moonlight.png) |

## 2. 天候（2種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| 雨 | `rain` | ![rain](../../../../screenshots/filters/rain.png) |
| 曇り | `overcast` | ![overcast](../../../../screenshots/filters/overcast.png) |

## 3. パーティクル（5種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| 雪 | `snow` | ![snow](../../../../screenshots/filters/snow.png) |
| 花びら | `sakura` | ![sakura](../../../../screenshots/filters/sakura.png) |
| 光の粒 | `firefly` | ![firefly](../../../../screenshots/filters/firefly.png) |
| キラキラ | `sparkle` | ![sparkle](../../../../screenshots/filters/sparkle.png) |
| 塵 | `dust` | ![dust](../../../../screenshots/filters/dust.png) |

## 4. 季節感（2種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| 紅葉 | `autumn` | ![autumn](../../../../screenshots/filters/autumn.png) |
| 冬 | `winter` | ![winter](../../../../screenshots/filters/winter.png) |

## 5. 雰囲気（8種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| ほんわか | `dreamy` | ![dreamy](../../../../screenshots/filters/dreamy.png) |
| 緊張 | `tense` | ![tense](../../../../screenshots/filters/tense.png) |
| 哀愁 | `melancholy` | ![melancholy](../../../../screenshots/filters/melancholy.png) |
| 懐かしい | `nostalgia` | ![nostalgia](../../../../screenshots/filters/nostalgia.png) |
| ロマンチック | `romantic` | ![romantic](../../../../screenshots/filters/romantic.png) |
| ホラー | `horror` | ![horror](../../../../screenshots/filters/horror.png) |
| ミステリアス | `mysterious` | ![mysterious](../../../../screenshots/filters/mysterious.png) |
| 穏やか | `peaceful` | ![peaceful](../../../../screenshots/filters/peaceful.png) |

## 6. 色調（9種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| セピア | `sepia` | ![sepia](../../../../screenshots/filters/sepia.png) |
| モノクロ | `grayscale` | ![grayscale](../../../../screenshots/filters/grayscale.png) |
| 色褪せ | `desaturate` | ![desaturate](../../../../screenshots/filters/desaturate.png) |
| 暖色 | `warm` | ![warm](../../../../screenshots/filters/warm.png) |
| 寒色 | `cool` | ![cool](../../../../screenshots/filters/cool.png) |
| 鮮やか | `vivid` | ![vivid](../../../../screenshots/filters/vivid.png) |
| くすみ | `muted` | ![muted](../../../../screenshots/filters/muted.png) |
| 明るく | `bright` | ![bright](../../../../screenshots/filters/bright.png) |
| 暗く | `dark` | ![dark](../../../../screenshots/filters/dark.png) |

## 7. 特殊演出（10種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| ぼかし | `blur` | ![blur](../../../../screenshots/filters/blur.png) |
| 周辺暗転 | `vignette` | ![vignette](../../../../screenshots/filters/vignette.png) |
| 中央フォーカス | `focusBlur` | ![focusBlur](../../../../screenshots/filters/focusBlur.png) |
| ノイズ | `noise` | ![noise](../../../../screenshots/filters/noise.png) |
| グリッチ | `glitch` | ![glitch](../../../../screenshots/filters/glitch.png) |
| 色ずれ | `chromaticAberration` | ![chromaticAberration](../../../../screenshots/filters/chromaticAberration.png) |
| 古いフィルム | `oldFilm` | ![oldFilm](../../../../screenshots/filters/oldFilm.png) |
| ブルーム | `bloom` | ![bloom](../../../../screenshots/filters/bloom.png) |
| カラーティント | `colorTint` | ![colorTint](../../../../screenshots/filters/colorTint.png) |
| 水中 | `underwater` | ![underwater](../../../../screenshots/filters/underwater.png) |

## 8. レトロ（4種）

| フィルター | ID | スクリーンショット |
|:----------:|:--:|:------------------:|
| PC-98 | `pc98` | ![pc98](../../../../screenshots/filters/pc98.png) |
| ゲームボーイ | `gameboy` | ![gameboy](../../../../screenshots/filters/gameboy.png) |
| CRT | `crt` | ![crt](../../../../screenshots/filters/crt.png) |
| ドット絵 | `pixelate` | ![pixelate](../../../../screenshots/filters/pixelate.png) |

## 9. 色調補正パターン（8種）

`applyColorAdjust(brightness, contrast, saturation, temperature)` によるパラメータ指定。

| パターン | 設定 | スクリーンショット |
|:--------:|:----:|:------------------:|
| 明るく | brightness: +50 | ![ca_bright](../../../../screenshots/filters/ca_bright.png) |
| 暗く | brightness: -50 | ![ca_dark](../../../../screenshots/filters/ca_dark.png) |
| ハイコントラスト | contrast: +50 | ![ca_highContrast](../../../../screenshots/filters/ca_highContrast.png) |
| ローコントラスト | contrast: -50 | ![ca_lowContrast](../../../../screenshots/filters/ca_lowContrast.png) |
| 鮮やか | saturation: +60 | ![ca_vivid](../../../../screenshots/filters/ca_vivid.png) |
| モノクロ | saturation: -100 | ![ca_mono](../../../../screenshots/filters/ca_mono.png) |
| 暖色 | temperature: +60 | ![ca_warm](../../../../screenshots/filters/ca_warm.png) |
| 寒色 | temperature: -60 | ![ca_cool](../../../../screenshots/filters/ca_cool.png) |

---

**合計: 53 枚** (フィルター45種 + 色調補正8種)
