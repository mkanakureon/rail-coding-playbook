# kaedevn 制作モード ガイド — ブロック / KS / KSC

**プレスリリース別紙**（2026-03-12）

kaedevn では、3つの制作モードで物語を作れます。どのモードで作っても同じゲームエンジンで動作し、同じ素材を使えます。

---

## 早わかり比較

| | ブロックエディタ | KS（Kaede Script） | KSC（Kaede Script Code） |
|---|---|---|---|
| **難易度** | プログラミング不要 | タグを覚えるだけ | TypeScript風の本格コード |
| **向いている人** | はじめての方、演出重視の方 | テキスト入力が速い方 | 複雑なゲームシステムを作りたい方 |
| **変数** | set_varブロックで設定 | `@set` コマンド | 自由に宣言・演算 |
| **条件分岐** | ifブロック（GUI） | `@if` コマンド | `if / else if / else`（ネスト自在） |
| **ループ** | 不可 | 不可 | `for` / `while` 対応 |
| **関数定義** | 不可 | 不可 | `def` / `sub` で自作可能 |
| **型チェック** | なし | なし | あり（実行前にエラー検出） |
| **デバッグ** | プレビューで目視 | プレビューで目視 | ブレークポイント・変数ウォッチ・ステップ実行 |

> **ポイント**: ブロックとKSは双方向同期しています。ブロックで組んだ内容はKSタブに、KSで書いた内容はブロックタブに即座に反映されます。

---

## 1. ブロックエディタ（ノーコード）

プログラミングの知識は一切不要です。ブロックを並べるだけで、背景の切り替え、キャラクターの登場、セリフ、選択肢による分岐など、ビジュアルノベルに必要な演出がすべて作れます。

### 使えるブロック（14種類）

#### 基本ブロック

| ブロック | できること | 設定項目 |
|---------|-----------|---------|
| **start** | ページの開始地点（各ページに1つ、自動配置） | — |
| **text** | セリフ・地の文を表示 | 話者名、本文、`{変数名}` で値の埋め込み |
| **bg** | 背景画像を切り替え | 画像選択、フェード時間 |
| **ch** | キャラクターを表示 | キャラクター、表情、位置（左/中央/右）、フェード時間 |
| **overlay** | 画面上に画像を重ねて表示 | 画像選択、フェード時間 |

#### 制御ブロック

| ブロック | できること | 設定項目 |
|---------|-----------|---------|
| **choice** | プレイヤーに選択肢を提示 | 選択肢テキスト、ジャンプ先、表示条件（変数で制御可） |
| **if** | 条件によって展開を変える | 条件式、「はい」のブロック列、「いいえ」のブロック列 |
| **set_var** | 変数に値を設定 | 変数名、演算子（=, +=, -=）、値 |
| **jump** | 別のページへ移動 | ジャンプ先ページ |

#### 演出ブロック

| ブロック | できること | 設定項目 |
|---------|-----------|---------|
| **effect** | 画面効果（揺れ、フラッシュ、暗転など） | 効果の種類（8種）、強度、時間 |
| **screen_filter** | 画面全体にフィルター | フィルター種類（15種）、強度、時間 |
| **timeline** | キーフレームアニメーション | トラック（カメラ/キャラ/音声/イベント）、キーフレーム |

#### 拡張ブロック

| ブロック | できること | 設定項目 |
|---------|-----------|---------|
| **battle** | ターン制RPGバトルを開始 | 敵グループ、勝利時ジャンプ先、敗北時ジャンプ先 |
| **ksc** | KSスクリプトを直接埋め込み | スクリプト本文 |

### ブロックで作れる作品の例

**恋愛ビジュアルノベル**
```
[start] → [bg: 教室] → [ch: さくら/笑顔/中央]
→ [text: さくら「おはよう！」]
→ [choice: 「一緒に帰る」→放課後ページ / 「勉強する」→図書館ページ]
```

**ホラーゲーム**
```
[start] → [bg: 廃病院] → [screen_filter: Noise]
→ [text: 暗い廊下に足音が響く…]
→ [effect: shake] → [ch: 影/不気味/右]
→ [choice: 「逃げる」/ 「振り向く」]
```

**RPG付きファンタジー**
```
[start] → [bg: 森] → [ch: 魔物/怒り/中央]
→ [text: 魔物が現れた！]
→ [battle: ゴブリン3体 / 勝利→宝箱ページ / 敗北→ゲームオーバーページ]
```

### スクリーンフィルター一覧（15種）

| フィルター | 効果 |
|-----------|------|
| Bloom | 光がにじむ、幻想的な表現 |
| Chromatic Aberration | 色収差（レンズのズレ表現） |
| CRT | ブラウン管テレビ風 |
| GameBoy | 初代ゲームボーイ風の4色表現 |
| Glitch | デジタルノイズ・電子的な乱れ |
| Night | 夜間の暗い色調 |
| Pixelate | ドット絵風のモザイク |
| Rain | 雨が降る演出 |
| Underwater | 水中のゆらめき |
| Vignette | 画面周辺を暗くする |
| PC-98 | レトロPC風の色合い |
| ColorTint | 指定色で画面を染める |
| FocusBlur | 焦点ぼかし |
| Noise | フィルムノイズ |
| OldFilm | 古い映画風（傷・揺れ） |

---

## 2. KS（Kaede Script）— タグベーススクリプト

テキストエディタでサクサク書きたい方向け。`@コマンド名` でゲームの演出を指示するシンプルな構文です。ブロックエディタと**双方向同期**しているため、KSで書いた内容はブロック表示にもリアルタイムで反映されます。

### 基本の書き方

```ks
; これはコメント（ゲームに影響しません）

*シーン1
@bg id="classroom"
@ch name="sakura" pose="smile" pos="C"

さくら「おはよう！今日もいい天気だね」@l
さくら「一緒に帰らない？」@c

@choice text="いいよ！" target="*一緒に帰る"
@choice text="今日は用事がある" target="*断る"

*一緒に帰る
@set var="affection" value="10"
@bg id="sunset_road" fade=1000
さくら「やった！」

*断る
さくら「そっか…また今度ね」
```

### コマンド一覧（20種）

#### 画面表示（10コマンド）

| コマンド | 役割 | 例 |
|---------|------|-----|
| `@bg` | 背景を変更 | `@bg id="classroom" fade=1000` |
| `@ch` | キャラクターを表示 | `@ch name="sakura" pose="smile" pos="C" fade=500` |
| `@ch_hide` | キャラクターを非表示 | `@ch_hide name="sakura"` |
| `@ch_clear` | 全キャラクターを非表示 | `@ch_clear` |
| `@overlay` | オーバーレイ画像を表示 | `@overlay id="rain_effect"` |
| `@overlay_hide` | オーバーレイを非表示 | `@overlay_hide` |
| `@show` / `@hide` | 汎用の表示/非表示 | `@show id="item01"` |
| `@move` | 移動アニメーション | `@move id="sakura" x=100 y=200 time=1000` |
| `@fade` | 透明度アニメーション | `@fade id="sakura" alpha=0.5 time=500` |

#### 音声（4コマンド）

| コマンド | 役割 | 例 |
|---------|------|-----|
| `@bgm` | BGMをループ再生 | `@bgm id="bgm01" vol=70 fade=1000` |
| `@bgm_stop` | BGMを停止 | `@bgm_stop fade=1000` |
| `@se` | 効果音を再生 | `@se id="bell" vol=100` |
| `@voice` | ボイスを再生 | `@voice id="sakura_001"` |

#### 制御（5コマンド）

| コマンド | 役割 | 例 |
|---------|------|-----|
| `@wait` | 指定秒数待つ | `@wait 2.5` |
| `@jump` | ラベルへジャンプ | `@jump target="*エンディング"` |
| `@choice` | 選択肢を1つ追加 | `@choice text="はい" target="*yes"` |
| `@if` | 条件分岐 | `@if (affection > 50)` |
| `@set` | 変数を設定 | `@set var="love" value="10"` |

#### 効果（1コマンド）

| コマンド | 役割 | 例 |
|---------|------|-----|
| `@screen_filter` | 画面フィルター | `@screen_filter type="crt" intensity=0.8` |

#### テキスト制御（3コマンド）

| コマンド | 役割 | 使い方 |
|---------|------|--------|
| `@l` | クリック待ち（テキスト残す） | `セリフの後に@l` |
| `@c` | クリック待ち（テキスト消す） | `段落の最後に@c` |
| `@r` | 改行 | `テキスト中に@r` |

### KSで作れる作品の例

**マルチエンディング恋愛ADV**
```ks
*オープニング
@bgm id="title_bgm" fade=2000
@bg id="sakura_tree" fade=1500

;--- 第1話 出会い ---
@bg id="classroom"
@ch name="sakura" pose="normal" pos="C"

さくら「転校生…だよね？」@l
さくら「よろしくね！」@c

@choice text="よろしく！（笑顔で）" target="*好印象"
@choice text="…ああ（素っ気なく）" target="*普通"

*好印象
@set var="affection" value="5"
@ch name="sakura" pose="smile" pos="C"
さくら「えへへ、いい人そう！」@c
@jump target="*昼休み"

*普通
@set var="affection" value="1"
さくら「う、うん…」@c
@jump target="*昼休み"

*昼休み
@bg id="rooftop"
@if (affection > 3)
さくら「ここ、私のお気に入りの場所なの」@c
@jump target="*屋上イベント"
```

---

## 3. KSC（Kaede Script Code）— TypeScript風プログラミング

変数の演算、ループ、関数定義、型チェックなど、プログラミング言語の機能をフル活用できるモードです。RPGのダメージ計算、複雑なフラグ管理、周回要素など、本格的なゲームシステムを構築できます。

専用の **KSCエディタ**（Monaco Editor搭載）で編集でき、シンタックスハイライト・リアルタイムエラー検出・コマンド補完が使えます。

### 基本の書き方

```ksc
// 変数の宣言
playerName = "太郎"
affection = 0
isClear = false

// セリフ（# で囲む）
#さくら
「おはよう、{playerName}！」
「今日もいい天気だね」
#

// 条件分岐
if (affection >= 10) {
    #さくら
    「大好き！」
    #
} else if (affection >= 5) {
    #さくら
    「仲良くなれたね」
    #
} else {
    #さくら
    「まだよく知らないけど…」
    #
}
```

### KSCだけでできること

#### ループ（繰り返し処理）

```ksc
// 3日間の日常をループで表現
for (day = 1; day <= 3; day += 1) {
    #ナレーション
    {day}日目の朝。
    #
    bg("classroom")

    // 日ごとに好感度で展開を変える
    if (affection >= day * 3) {
        #さくら
        「今日も会えてうれしい！」
        #
        affection += 2
    } else {
        #さくら
        「おはよう」
        #
        affection += 1
    }
}
```

#### 関数定義（ロジックの再利用）

```ksc
// ランク判定関数
def getRank(score) {
    if (score >= 80) return "S"
    if (score >= 60) return "A"
    if (score >= 40) return "B"
    return "C"
}

// 好感度に応じたイベント発生関数
sub showMoodEvent(character, mood) {
    if (mood >= 10) {
        showChar(character, "smile", "C")
        playSe("happy_chime")
    } else {
        showChar(character, "sad", "C")
    }
}

// 使用
rank = getRank(affection)
#system
あなたの評価: {rank}ランク
#

showMoodEvent("sakura", affection)
```

#### デバッグ機能

KSCエディタには開発を助けるデバッグ機能が搭載されています。

| 機能 | 説明 |
|------|------|
| **ブレークポイント** | 指定行で実行を一時停止 |
| **変数ウォッチ** | 変数の値をリアルタイム監視 |
| **ステップ実行** | 1行ずつ実行して動作を確認 |
| **トレースログ** | 実行された全行を記録 |
| **エラー候補表示** | タイプミスに対して「もしかして？」を提案 |

### エンジンAPI（ゲーム制御メソッド）

KSCからはゲームエンジンの全機能をメソッドとして呼び出せます。

#### 画面制御

```ksc
setBg("classroom")                          // 背景変更
showChar("sakura", "smile", "C", 500)       // キャラ表示（フェード500ms）
hideChar("sakura", 300)                     // キャラ非表示
clearChars(500)                             // 全キャラ非表示
moveChar("sakura", "L", 1000)               // 左へ移動（1秒）
overlaySet("rain", 500)                     // オーバーレイ表示
overlayHide("rain", 500)                    // オーバーレイ非表示
```

#### 音声制御

```ksc
playBgm("bgm_romantic", 70, 1000)           // BGM再生（音量70、フェード1秒）
stopBgm()                                   // BGM停止
playSe("doorbell")                          // 効果音
playVoice("sakura_happy_01")                // ボイス再生
```

#### 画面効果

```ksc
screenFilter("night")                       // 夜フィルター適用
screenFilter("rain", 0.8)                   // 雨フィルター（強度0.8）
screenFilterClear()                         // フィルター解除
shake(5, 500)                               // 画面揺れ（強度5、500ms）
```

#### ゲーム進行

```ksc
waitForClick()                              // クリック待ち
wait(2000)                                  // 2秒待ち

// 選択肢（条件付き表示も可能）
result = showChoice([
    {text: "告白する", condition: "affection >= 15"},
    {text: "友達でいる"},
    {text: "距離を置く"}
])

// resultは選択番号（0, 1, 2）
if (result == 0) {
    jump("confession")
}
```

#### フラグ・アイテム管理

```ksc
setFlag("saw_secret_scene", true)           // フラグ設定
if (getFlag("saw_secret_scene")) {          // フラグ確認
    // 2周目以降の隠しルート
}

giveItem("magic_key", 1)                    // アイテム入手
if (hasItem("magic_key")) {                 // アイテム確認
    #system
    魔法の鍵を使った！
    #
    takeItem("magic_key", 1)                // アイテム消費
}
```

#### バトル

```ksc
#ナレーション
魔物が現れた！
#

result = battleStart("goblin_troop_01")

if (result == "win") {
    playSe("victory_fanfare")
    giveItem("goblin_fang", 3)
    #system
    ゴブリンの牙を3つ手に入れた！
    #
} else {
    setBg("game_over")
    #system
    力尽きた…
    #
}
```

### KSCで作れる作品の例

**周回要素付きADV（2周目で隠しルート解放）**
```ksc
clearCount = getFlag("clear_count")
if (clearCount == null) { clearCount = 0 }

if (clearCount >= 1) {
    #system
    ――{clearCount}周目。今度こそ、あの子を救えるだろうか。
    #
}

// ... メインストーリー ...

*true_end
if (clearCount >= 2 && affection >= 20 && hasItem("time_crystal")) {
    // 3周目以降・条件達成で真エンド解放
    jump("hidden_true_end")
}

setFlag("clear_count", clearCount + 1)
```

**ステータス管理RPG風ADV**
```ksc
// キャラステータス
hp = 100
mp = 50
atk = 15

def heal(amount) {
    hp += amount
    if (hp > 100) { hp = 100 }
    playSe("heal")
    #system
    HPが{amount}回復した！（現在HP: {hp}）
    #
}

def magicAttack(cost, power) {
    if (mp < cost) {
        #system
        MPが足りない！
        #
        return false
    }
    mp -= cost
    damage = power + atk
    playSe("magic_blast")
    shake(3, 300)
    screenFilter("bloom", 0.6)
    wait(500)
    screenFilterClear()
    #system
    {damage}のダメージを与えた！
    #
    return true
}

// バトル中の選択
choice {
    "通常攻撃" {
        playSe("slash")
        #system
        {atk}のダメージ！
        #
    }
    "魔法攻撃（MP20）" if (mp >= 20) {
        magicAttack(20, 30)
    }
    "回復（MP10）" if (mp >= 10) {
        mp -= 10
        heal(30)
    }
}
```

---

## どのモードを選べばいい？

```
はじめて作品を作る
  → ブロックエディタ（GUI だけで完結）

テキスト入力が速い、セリフ量が多い
  → KS（タグを覚えれば高速執筆）

複雑なフラグ管理、周回要素、RPG要素がある
  → KSC（プログラミングの力をフル活用）

迷ったら
  → ブロックエディタで始めて、慣れたらスクリプトタブを開いてみる
    （双方向同期なので、いつでも行き来できます）
```

---

## 技術仕様

| 項目 | 値 |
|------|-----|
| 論理解像度 | 1280 x 720 |
| セーフエリア | 上下左右5%マージン |
| 画像最大サイズ | 2048px（GPU互換性のため） |
| 音声形式 | MP3 / OGG |
| 画像形式 | PNG / JPG / WebP / GIF |
| レイヤー順序 | 背景 → キャラクター → オーバーレイ → UI |
