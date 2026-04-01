# 84-ASSET_LIST_AND_KS_SAMPLE

## 1. 資産命名規則（Asset Naming Convention）

- **文字数制限**: 全てのIDは**8文字以内**。
- **背景（Background）**: `bg_star`, `room_day`, `school_r`, `park_ngt`
- **キャラクター（Character）**: `hiro`, `hero`, `sakura`
- **表情（Expression）**: `std`, `smile`, `sad`, `angry`

---

## 2. テキスト制御コマンド

| コマンド | 生成 Op | 説明 |
|:---|:---|:---|
| `@l` | `WAIT_CLICK` | クリック待ち（テキストは消さない） |
| `@r` | `TEXT_NL` | 改行 |
| `@p` | `PAGE` | **ページ送り（クリック待ち ＋ テキスト消去）** |
| `@wait` | `WAIT_MS` | 時間待ち（秒指定） |

---

## 3. 基本的な会話の流れ（3行表示の原則）

テキストウィンドウに3行表示して次へ進む場合の基本構成：
1. 1行目 `@r`
2. 2行目 `@r`
3. 3行目 `@p`（ここでクリックを待ち、画面をクリアする）

---

## 4. サンプル KS スクリプト（projects/demo/main.ks）

```ks
; メインシナリオ
; -----------------------------------------

@bg bg_star
@wait 1.0

@ch hiro smile center
ヒロ「きれいな星空だな……」@r
「こんな夜は、何かが起きそうな気がするよ。」@r
「……でも、一人じゃ少し寂しいかな。」@p

@bg room_day
@wait 0.5

@ch sakura smile center
サクラ「ヒロ！ おはよう！」@r
ヒロ「サクラ、おはよう。今日は早いな。」@r
サクラ「ふふ、今日は楽しみで眠れなかったんだ！」@p

@ch hero smile center
ヒーロー「待たせたな、諸君！」@r
サクラ「あ、ヒーローだ！」@r
ヒロ「（また騒がしくなりそうだ……）」@p
```
