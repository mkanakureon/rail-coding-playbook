# ミッシング・リンク — 物語の質と収益性を繋ぐ 3 つのギミック

> **作成日**: 2026-03-19
> **担当**: Claude Opus 4.6
> **問い**: ユーザーが 100 円を払う瞬間に「これこそが次世代の物語体験だ」と確信させるための技術的ギミック

---

## 0. 発見: AI パイプラインとレンダラの「断絶」

4 段階 AI 執筆パイプライン（Stage 1-4）は、物語の感情構造を詳細に把握している。

| Stage | 出力 | 感情メタデータ |
|-------|------|---------------|
| Stage 1（章立て） | `emotionalArc`, `targetMaxEp` | 章ごとの感情の起伏 |
| Stage 2（エピソード） | `vibe: calm\|tension\|climax\|shock`, `ep: 0-100`, `endHook` | シーンごとの感情強度 |
| Stage 3（テキスト） | `emotionalState`, `relationship_changes` | キャラごとの心理状態 |
| Stage 4（KS 変換） | `@bg`, `@ch`, `@text` | **感情情報は全て捨てられる** |

**ここが断絶。** Stage 2 が「このシーンは climax、感情強度 95」と知っているのに、レンダラは普通の白テキストを等速で表示するだけ。16 種のスクリーンフィルタ、カメラ制御、シェイク——演出ツールは揃っているのに、**いつ使うかの判断が AI から渡されていない。**

そしてペイウォールは、この感情の流れを無視して「ページ N で停止」する。物語の最高潮で止まるか、何でもない場面で止まるかは運任せ。

**この断絶が「ミッシング・リンク」。** 以下の 3 つのギミックで繋ぐ。

---

## ギミック 1: エモーション・レンダリング — AI が書いた感情をそのまま「見せる」

### 概要

Stage 2/3 の感情メタデータを Stage 4 で KS コマンドに変換し、テキスト表示・フィルタ・カメラ・パーティクルを**自動で演出する。**

### 技術設計

#### (A) Stage 3 出力に `emotionTag` を追加

```typescript
// 現在の Line 型
type Line = { type: 'narration' | 'dialogue'; text: string; speaker?: string };

// 拡張後
type Line = {
  type: 'narration' | 'dialogue';
  text: string;
  speaker?: string;
  emotion?: 'shock' | 'joy' | 'despair' | 'hope' | 'fear' | 'love' | 'rage' | 'calm';
  intensity?: number; // 0-100
};
```

Stage 3 のプロンプトに「各行の感情タグと強度を付与せよ」を追加するだけ。LLM は既にこの情報を内部で持っている。

#### (B) Stage 4（KS 変換）で演出コマンドを自動挿入

```
入力: { text: "お前が犯人だったのか……！", emotion: "shock", intensity: 90 }

出力:
@filter name=focus_blur intensity=0.3     ← 背景ぼかし（緊張感）
@shake duration=200 intensity=5           ← 画面振動
@text color=#ff4444 speed=0.5             ← 赤文字・ゆっくり表示
お前が犯人だったのか……！
@filter_clear duration=500                ← 元に戻す
```

**感情 → 演出のマッピング表:**

| emotion | テキスト | フィルタ | カメラ | 効果 |
|---------|---------|---------|--------|------|
| shock | 赤、大きめ、遅い | focus_blur | shake | flash |
| joy | 黄金、明るい | bloom | ゆっくりズームイン | sparkle particle |
| despair | 灰色、小さめ | grayscale + vignette | ズームアウト | — |
| hope | 青白、ゆっくりフェード | — | ゆっくりパン | light particle |
| fear | 暗い、速い | noise + vignette | 微震 | — |
| love | ピンク、柔らかい | bloom + chromatic | 近接ズーム | heart particle |
| rage | 赤、太字、速い | CRT + noise | 激しいshake | impact particle |

#### (C) 新コマンド追加

| コマンド | 用途 |
|---------|------|
| `@text_style` | テキストの色・サイズ・速度を一時変更 |
| `@particle` | パーティクルエフェクト（sparkle, tear, heart, impact） |
| `@emotion_pulse` | テキストウィンドウ全体を感情色でフラッシュ |

### 実装コスト

| 変更 | ファイル | 工数 |
|------|---------|------|
| Stage 3 プロンプト修正 | `apps/hono/src/lib/assist/stage3.ts` | 0.5 日 |
| Stage 4 演出挿入 | `apps/hono/src/lib/assist/stage4.ts` | 1 日 |
| `@text_style` コマンド | compiler + WebOpHandler | 1 日 |
| `@particle` コマンド | compiler + WebOpHandler + PixiJS | 2 日 |
| 演出マッピングテーブル | 新規 `emotion-map.ts` | 0.5 日 |

**合計: 5 日**

### なぜこれが 100 円の価値を生むか

読者は「自分が読んでいる物語が、自分の感情に応答している」と感じる。静的なテキストが並ぶだけのノベルゲームでは不可能な体験。**AI が物語を書き、AI がその感情を理解し、エンジンがそれを視覚化する。** この一気通貫が「次世代」たる所以。

---

## ギミック 2: クライマックス・ペイウォール — 最高の場面で止め、最高の演出で再開する

### 概要

ペイウォールを「ページ番号」ではなく「感情のピーク」に配置する。購入後の再開時に、**特別な演出トランジション**を入れる。

### 技術設計

#### (A) ペイウォール位置の自動決定

```typescript
// Stage 2 の出力から、無料区間の最適な終了点を計算
function findOptimalPaywallPosition(episodes: EpisodePlot[], freeRatio: number): string {
  const totalScenes = episodes.flatMap(ep => ep.scenes);
  const freeCount = Math.floor(totalScenes.length * freeRatio);

  // 無料区間の末尾付近で最も intensity が高いシーンを探す
  const candidates = totalScenes.slice(
    Math.max(0, freeCount - 3),
    freeCount + 1
  );

  // vibe: 'climax' or 'shock' を優先、次に ep 値が高いもの
  const best = candidates.sort((a, b) => {
    const vibeScore = { climax: 3, shock: 2, tension: 1, calm: 0, relief: 0 };
    return (vibeScore[b.vibe] || 0) - (vibeScore[a.vibe] || 0) || b.ep - a.ep;
  })[0];

  return best.sceneId; // このシーンの直後にペイウォール
}
```

**結果:** 読者は必ず「え、ここで終わり!?」と思う場面でペイウォールに遭遇する。

#### (B) ペイウォール直前の演出強化

ペイウォール 3 行前から自動で演出を挿入:

```
（通常テキスト）
@filter name=vignette intensity=0.5       ← 画面端が暗くなる
（ペイウォール 2 行前）
@bgm_volume 0.3 duration=2000            ← BGM がフェードダウン
（ペイウォール 1 行前 = クライマックスの台詞）
@text_style color=#ffffff size=28 speed=0.3  ← 大きく、ゆっくり
「――あの日、全てが変わった。」
@fade_black duration=1000                 ← 暗転
→ ペイウォール発動
```

#### (C) 購入後の「再開演出」

```
（購入完了）
@black_in duration=0                      ← 黒画面から
@text_style color=#ffd700 size=20
「ここから先は、あなただけの物語。」       ← 金色の導入テキスト
@wait 2000
@white_in duration=1500                   ← 白フェードで再開
（続きのシーンが始まる）
```

### 実装コスト

| 変更 | 工数 |
|------|------|
| ペイウォール位置自動計算 | 1 日 |
| ペイウォール直前演出挿入（Stage 4） | 1 日 |
| 再開演出（ksc-demo.ts） | 0.5 日 |
| PaywallOverlay のビジュアル強化 | 0.5 日 |

**合計: 3 日**

### なぜこれが 100 円の価値を生むか

Netflix の「次のエピソードまで 5 秒」と同じ心理。ただし Netflix は物語の区切りで止まるが、kaedevn は**物語の最高潮で止まる。** そしてその最高潮が「AI が計算した最適な感情ピーク」であることが、人間の編集者にはできないパーソナライズされた体験を実現する。

購入後の「ここから先は、あなただけの物語。」という金色テキストの 2 秒が、100 円を「支出」ではなく「体験への投資」に変える。

---

## ギミック 3: リーディング・パルス — 読者の感情をリアルタイムで可視化する

### 概要

読者がテキストを読む速度（タップ間隔）をリアルタイム計測し、**没入度スコア**として可視化。高没入セクションを「名場面」としてシェア可能にする。

### 技術設計

#### (A) タップ間隔の計測

```typescript
// InputManager に追加
private tapTimestamps: number[] = [];
private immersionScore = 0;

onAction(action: Action) {
  if (action === Action.OK) {
    const now = Date.now();
    this.tapTimestamps.push(now);

    // 直近 5 タップの間隔から没入度を計算
    if (this.tapTimestamps.length >= 5) {
      const intervals = [];
      for (let i = this.tapTimestamps.length - 5; i < this.tapTimestamps.length - 1; i++) {
        intervals.push(this.tapTimestamps[i + 1] - this.tapTimestamps[i]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

      // 1.5-3秒 = 読んでいる（高没入）
      // 0.5秒以下 = スキップ（低没入）
      // 5秒以上 = 離席
      this.immersionScore = avgInterval >= 1500 && avgInterval <= 3000 ? 100
        : avgInterval >= 800 && avgInterval <= 5000 ? 60
        : 20;
    }
  }
}
```

#### (B) 没入度の活用

1. **ペイウォール到達時のメッセージをパーソナライズ:**

```
没入度 80+ → 「夢中で読んでいましたね。続きが気になりませんか？」
没入度 40-79 → 「続きが気になる？」（通常）
没入度 20-39 → 表示しない（離脱リスク高いのでペイウォールをスキップ）
```

2. **名場面シェアの自動推薦:**

読者が特にゆっくり読んだ（= 感情が動いた）セクションを記録し、シェアボタン押下時に「この場面をシェアしますか？」とサジェスト。

3. **作者ダッシュボードに没入度ヒートマップ:**

```
ページ 1: ████████░░ 80%  ← 読者がじっくり読んだ
ページ 2: ██████░░░░ 60%
ページ 3: ██████████ 95%  ← 名場面（ペイウォール候補）
ページ 4: ███░░░░░░░ 30%  ← 離脱が多い（要改善）
```

#### (C) 没入度データの送信

```typescript
// ゲーム終了時またはペイウォール到達時
window.parent.postMessage({
  type: 'immersionData',
  scores: pageImmersionScores, // { pageId: score }[]
  totalReadTime: totalMs,
  peakMoment: highestScorePageId,
}, '*');
```

### 実装コスト

| 変更 | 工数 |
|------|------|
| InputManager にタップ間隔計測 | 0.5 日 |
| 没入度スコア計算ロジック | 0.5 日 |
| ペイウォールメッセージのパーソナライズ | 0.5 日 |
| 名場面シェアのサジェスト | 1 日 |
| 作者ダッシュボードにヒートマップ | 2 日 |

**合計: 4.5 日**

### なぜこれが 100 円の価値を生むか

読者は「この作品が自分の感情を理解している」と感じる。Spotify の「あなたの今年のまとめ」と同じ心理——自分のデータが物語体験をパーソナライズしているという実感。

ペイウォールで「夢中で読んでいましたね」と言われた瞬間、読者は「バレてる」と思い、同時に「そう、夢中だったんだ」と自覚する。この自覚が購入の後押しになる。

---

## 3 つのギミックの相乗効果

```
AI パイプライン（Stage 1-3）
  │
  ├── emotionTag, intensity, vibe  ─→  ギミック 1: エモーション・レンダリング
  │                                       ↓
  │                                   「画面が震えた、テキストが赤くなった」
  │                                       ↓
  ├── endHook, climax detection  ─→  ギミック 2: クライマックス・ペイウォール
  │                                       ↓
  │                                   「最高の場面で暗転。続きは 100 円」
  │                                       ↓
  └── (読者のタップデータ)       ─→  ギミック 3: リーディング・パルス
                                          ↓
                                      「夢中で読んでいましたね」
                                          ↓
                                      購入 → 金色テキスト → 再開
```

**3 つが揃うと:**
1. AI が感情を込めて書き（Stage 1-3）
2. エンジンが感情を視覚化し（ギミック 1）
3. 最高の瞬間でペイウォールが発動し（ギミック 2）
4. 「あなたは夢中だった」と読者に伝え（ギミック 3）
5. 100 円が「次世代の物語体験への投資」になる

---

## 実装優先度

| ギミック | 工数 | 効果 | 優先度 |
|---------|------|------|--------|
| 2. クライマックス・ペイウォール | 3 日 | 購入率に直結 | **最優先** |
| 1. エモーション・レンダリング | 5 日 | 体験の質を根本から変える | 次点 |
| 3. リーディング・パルス | 4.5 日 | データ駆動の最適化基盤 | Phase 3 |

**合計: 12.5 日。** Phase 3 の 3 ヶ月枠に収まる。

---

## 結論

AI パイプラインが生む感情メタデータ（vibe, emotionalArc, intensity）がレンダラに届いていない——これが「ミッシング・リンク」。3 つのギミックでこの断絶を繋ぐと、100 円は「テキストの続きを買う」行為から「自分の感情に応答する物語体験を手に入れる」行為に変わる。

技術的にはコマンド 3 つ追加（`@text_style`, `@particle`, `@emotion_pulse`）+ Stage 3/4 のプロンプト修正 + ペイウォール位置計算 + タップ間隔計測。既存のエンジン基盤（52 コマンド、16 フィルタ、カメラ制御）の上に乗せるだけで実現できる。

**100 円を払う瞬間に読者が思うべきは「テキストの続きが読みたい」ではない。「この物語が、私を理解している」だ。**
