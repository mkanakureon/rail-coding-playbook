# Kaede Script (.ksc) 言語仕様書 (v2.1)

**作成日**: 2026-02-26
**対象**: インタプリタ、コンパイラ開発者、シナリオライター

## 1. 概要
Kaede Script (.ksc) は、kaedevn エンジン専用の軽量スクリプト言語です。演出コマンド、セリフ、制御構文を直感的に記述でき、JavaScript ライクな式評価をサポートしています。

## 2. 基本構文

### 2.1 セリフブロック
`#` で始まり `#` で終わる形式を採用しています。
```ksc
#hero
「おはよう、今日も良い天気だね。」
#
```

### 2.2 ラベルとジャンプ
`*` でラベルを定義し、`jump()` コマンドで遷移します。
```ksc
*opening
bg("sky", "fade")
jump("next_scene")
```

### 2.3 制御構文 (if, choice)
JavaScript ライクな if 文と、独自の `choice` ブロックをサポートします。
```ksc
if (trust > 10) {
  #hero
  「君を信じてるよ。」
  #
} else {
  #hero
  「まだ少し不安なんだ。」
  #
}

choice {
  "右に行く" { jump("right_path") }
  "左に行く" { jump("left_path") }
}
```

## 3. 演出コマンド（組み込み関数）

| コマンド | 引数 | 説明 |
| :--- | :--- | :--- |
| `bg` | `(id, effect?)` | 背景の切り替え |
| `ch` | `(id, pose, effect?, x?)` | キャラクタの表示 |
| `ch_hide` | `(id, effect?)` | キャラクタの非表示 |
| `bgm` | `(id, volume?, fade?)` | BGM の再生 |
| `se` | `(id, volume?)` | SE の再生 |
| `wait` | `(ms)` | 指定時間の待機 |
| `waitclick` | `()` | クリック待ち |
| `timeline` | `(id)` | タイムラインアニメーションの再生 |
| `battle` | `(troopId, onWin?, onLose?)` | バトル開始と分岐 |

## 4. 特殊コマンド (サブルーチン)
- `call(label)`: 指定ラベルへ遷移し、`ret()` で元の場所に戻る。
- `ret()`: サブルーチンから復帰。

---
*Created by Gemini CLI based on @kaedevn/interpreter source.*
