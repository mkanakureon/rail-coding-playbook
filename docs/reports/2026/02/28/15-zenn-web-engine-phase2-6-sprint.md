---
title: "Webノベルエンジンを1日でPhase 2→6まで実装した：Claude Codeによるフルスタック開発記録"
emoji: "🚀"
type: "idea"
topics: ["claudecode", "pixijs", "typescript", "gamedev", "webgl"]
published: false
---

## はじめに

2026年2月27日、1日で Web ノベルエンジンの **Phase 2 から Phase 6 まで一気に実装した**。

バックログ表示、フェードトランジション、スキップ高速化、セーブサムネイル、画面シェイク、キャラ移動、スクリーンショット、フルスクリーン、設定画面——**6コミット、計1,400行超の追加**を、すべて Claude Code との対話だけで行った。

人間が書いたコードは0行。ただし「次はフェードを」「シェイクはeaseOutで減衰させて」といった**方向指示は人間**がやっている。

## 前提：Phase 1 までの状態

Phase 1 時点では以下ができていた：

| 機能 | 状態 |
|------|------|
| 背景表示・切り替え | 動作 |
| キャラクター立ち絵表示 | 動作 |
| テキスト表示（1文字ずつ） | 動作 |
| 選択肢 | 動作 |
| BGM/SE/ボイス再生 | 動作 |
| セーブ/ロード | 基本動作 |

「最低限のノベルゲームとして遊べる」状態。しかし演出がない。フェードもない。バックログもない。

## Phase 2：フェードとバックログ

### fadeTo() — アニメーションの基盤

```typescript
export async function fadeTo(
  target: Container,
  toAlpha: number,
  durationMs: number,
  ticker: Ticker,
  easing: EasingFn = easeInOut
): Promise<void> {
  // PixiJS Ticker で毎フレーム alpha を補間
}
```

この関数が以降のすべてのアニメーションの基盤になった。Promise ベースなので `await` できる。スキップモード時は `durationMs = 0` で即座に完了する。

### バックログ — 223行の UI

`BacklogScreen.ts` は PixiJS の `Container` でスクロール可能な履歴画面を実装。キーボード・マウスホイール・タッチ対応。ボイスの再生ボタンもつけた。

正直、DOM で作ったほうが楽だったかもしれない。でも「キャンバス内で完結させる」方針があったので PixiJS でやり切った。

## Phase 3：スキップ高速化とオートモード

スキップモードの実装で重要だったのは **「すべてのアニメーション関数がスキップを尊重する」** こと。

```typescript
// Phase 3 以降、すべてのアニメーションに共通のパターン
const ms = this.skipMode ? 0 : durationMs;
await fadeTo(sprite, 1, ms, this.ticker);
```

テキスト送り、フェード、待機——すべてが `skipMode` フラグを見る。個別のスキップ処理を書く必要がない。

オートモードはボイス再生終了に連動。ボイスがあれば終了を待ち、なければ一定時間で自動進行。

## Phase 4：サムネイル・ギャラリー・画面シェイク

### セーブサムネイル

```typescript
async captureThumbnail(): Promise<string | undefined> {
  const canvas = this.renderer.extract.canvas(this.layers.root);
  const thumb = document.createElement("canvas");
  thumb.width = 160; thumb.height = 90;
  thumb.getContext("2d")!.drawImage(canvas, 0, 0, 160, 90);
  return thumb.toDataURL("image/jpeg", 0.7);
}
```

160x90 の JPEG。セーブスロットのプレビューに使う。data URL でセーブデータに埋め込む。

### 画面シェイク

```typescript
// shake.ts — 10行の減衰関数
const remaining = 1 - easeOut(elapsed / durationMs);
const str = intensity * remaining;
const dx = (Math.random() - 0.5) * 2 * str;
```

`easeOut` で減衰させると自然な振動になる。ゲーム演出では頻出のパターン。

## Phase 5：キャラ移動とイージング

キャラクターの移動は `lerpPosition()` で位置を補間する。

```typescript
const targetX = pos === "left" ? 320 : pos === "right" ? 960 : 640;
await lerpPosition(sprite, targetX, sprite.position.y, ms, this.ticker);
```

仮想解像度 1280x720 に対して `left=320, center=640, right=960`。3点固定は割り切った設計で、ノベルゲームにはこれで十分。

イージング関数は4種：

```typescript
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
```

## Phase 6：設定画面とフルスクリーン

最後に設定画面。スライダー UI を PixiJS の `Graphics` と `PointerEvent` で作った。

| 設定項目 | 範囲 | 対象 |
|----------|------|------|
| BGM音量 | 0-100% | AudioManager |
| SE音量 | 0-100% | AudioManager |
| ボイス音量 | 0-100% | AudioManager |
| ウィンドウ透明度 | 0-100% | TextWindow |
| テキスト速度 | 0-100% | TextWindow |
| オート速度 | 0-100% | TextWindow |

テキストウィンドウの非表示（スペースキー）とフルスクリーンもここで実装。

## 1日のスプリントを振り返って

### よかった点

- **アニメーション基盤（fadeTo）を最初に作った**のが効いた。以降の Phase はすべてこの上に乗った
- **スキップモードの設計が早かった**。全関数が `skipMode` を見るルールを Phase 3 で確立できた
- Claude Code は「次は shake を実装して、easeOut で減衰させて」のような指示でブレなく実装する

### 微妙だった点

- **PixiJS で UI を作るのはしんどい**。スクロール、スライダー、ボタン——DOM なら CSS で終わることを手書きしている
- **テストがない**。動作確認はすべて目視。E2E テストは後回し
- **Phase を切りすぎた**。振り返ると Phase 2-3 は一緒にやれた

### 数字で見る

| 指標 | 値 |
|------|-----|
| コミット数 | 6 |
| 追加行数 | 約1,400行 |
| 新規ファイル | 7（fadeTo, lerpPosition, shake, easing, BacklogScreen, BacklogStore, SettingsScreen） |
| 所要時間 | 約8時間（休憩込み） |
| 人間のコード | 0行 |

## まとめ

1日でノベルエンジンの演出機能をほぼ揃えた。Phase 1 の「テキストが出るだけ」から、フェード・シェイク・バックログ・設定画面つきの「遊べるエンジン」になった。

Claude Code はこういう**「やることが明確で、1つずつ積む」タスク**が異常に速い。逆に「何を作るか決まっていない」段階では人間の判断が不可欠。AI は方向を決めてもらえれば、1日で6 Phase 走れる。

---
背景を描き、キャラクターを動かし、画面を揺らし、設定画面のスライダーを作った。
1日分の作業としては多すぎるのかもしれないが、
振り返ると、どの Phase も「次はこれ」と言われた通りに積んだだけだった。

　　　　　　　　　　Claude Opus 4.6
