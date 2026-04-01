# 90-GENRE_SCENARIOS

全ジャンルのサンプルシナリオ（KSスクリプト）です。
**Gemini 2.5 Flash 最適化ルール**:
1. 8文字IDの使用（`89-GENRE_ASSET_LISTS.md` 準拠）
2. 3行表示の徹底（`@r` → `@r` → `@p`）

---

## 1. Comedy (コメディ)
**使用資産**: `c_room`, `tsukkomi`, `boke`

```ks
@bg c_room
@wait 1.0

@ch boke silly center
ボケ「ねえねえ、宇宙人ってスルメ食べるのかな？」@r
「足がいっぱいあるから、親近感湧くと思うんだよね。」@r
「マヨネーズ派か七味派かで戦争になるかも！」@p

@ch tsukkomi shock center
ツッコミ「お前の頭の中が戦争状態だよ！」@r
「スルメの心配する前に、昨日の宿題の心配をしろ！」@r
「なんで宇宙規模で現実逃避してんだ！」@p

@ch boke smile center
ボケ「えへへ、宿題はブラックホールに食べられちゃった。」@r
ツッコミ「回収してこい！ 今すぐに！」@r
「光の速さで提出期限は過ぎてるんだぞ！」@p
```

---

## 2. Fantasy (ファンタジー)
**使用資産**: `f_forest`, `knight`, `mage`

```ks
@bg f_forest
@wait 1.0

@ch knight std center
騎士「静かすぎるな……。」@r
「この森には古代の魔獣が眠ると言われている。」@r
「油断するなよ、背後は任せたぞ。」@p

@ch mage chant center
魔法使い「わかってるわよ。結界の準備はできてる。」@r
「……来るわ。風の流れが変わった。」@r
「右前方、距離３０……大きいのがいる！」@p

@ch knight pain center
騎士「くっ、速い！ 防ぎきれるか！？」@r
魔法使い「下がって！ 私の炎で焼き払うわ！」@r
「紅蓮の炎よ、我が敵を灰燼に帰せ！」@p
```

---

## 3. Horror (ホラー)
**使用資産**: `h_corrid`, `victim`, `ghost`

```ks
@bg h_corrid
@wait 1.0

@ch victim fear center
主人公「はぁ、はぁ……出口はどこだ……。」@r
「さっき通ったはずの廊下が、まだ続いている。」@r
「誰か……誰かいないのか……？」@p

@bg h_bath
@wait 0.5
@ch victim scream center
主人公「うわあああああっ！！」@r
「ち、血だ……鏡一面に……！」@r
「なんだこれ……手形……？」@p

@ch ghost std center
主人公「（背後に……気配が……）」@r
「振り向いちゃいけない……振り向いたら……」@r
幽霊「……みぃつけた……」@p
```

---

## 4. Longstory (長編/重厚)
**使用資産**: `l_study`, `writer`, `muse`

```ks
@bg l_study
@wait 1.0

@ch writer think center
作家「言葉が出てこない……。」@r
「あの日の記憶は、指の隙間から零れ落ちていく砂のようだ。」@r
「書けば書くほど、真実から遠ざかっていく気がする。」@p

@ch muse std center
少女「迷っているのね。」@r
作家「……幻影か。また現れたな。」@r
少女「貴方が呼んだのよ。失われた言葉を探すために。」@p

@ch writer sad center
作家「俺は何も探してなどいない。」@r
「ただ、忘れたいだけなんだ。」@r
少女「嘘つき。貴方のペンは泣いているわ。」@p
```

---

## 5. Mystery (ミステリー)
**使用資産**: `m_office`, `detec`, `wit`

```ks
@bg m_office
@wait 1.0

@ch detec std center
探偵「さて、話を整理しましょう。」@r
「あなたが遺体を発見したのは、昨夜の午後10時。」@r
「その時、部屋には鍵がかかっていた。間違いありませんか？」@p

@ch wit std center
目撃者「は、はい。間違いありません。」@r
「マスターキーを使って開けたんです。」@r
「中に入ったら、あの人が……倒れていて……。」@p

@ch detec think center
探偵「妙ですね。」@r
「現場の窓は開いていた。しかし雨の痕跡はない。」@r
「昨夜は激しい雷雨でした。……何かが矛盾している。」@p
```

---

## 6. Romance (恋愛)
**使用資産**: `r_school`, `boy`, `girl`

```ks
@bg r_school
@wait 1.0

@ch boy std center
男子「あー、やっと終わったな、文化祭の準備。」@r
「お前も手伝ってくれてサンキュ。」@r
「一人じゃ絶対終わらなかったよ。」@p

@ch girl smile center
女子「ううん、私も楽しかったから。」@r
「……ねえ、ちょっと休憩しない？」@r
「屋上、風が気持ちいいかも。」@p

@bg r_park
@wait 1.0
@ch girl blush center
女子「あのね、話したいことがあるの。」@r
「ずっと言えなかったんだけど……。」@r
「私……先輩のことが……。」@p
```

---

## 7. Slice-of-Life (日常)
**使用資産**: `s_room`, `friend1`, `friend2`

```ks
@bg s_room
@wait 1.0

@ch friend1 laugh center
友人A「ぎゃはは！ マジで！？」@r
「そんなドジ踏んだの？ お前最高だな！」@r
「動画撮っとけばバズったのにー！」@p

@ch friend2 sigh center
友人B「笑い事じゃないって……。」@r
「こっちは死ぬほど恥ずかしかったんだから。」@r
「もう二度とあの店には行けないよ。」@p

@ch friend1 smile center
友人A「まあまあ、元気出せって。」@r
「ほら、コンビニで新作スイーツ買ってきたから。」@r
「糖分とって忘れろ！ な？」@p
```
