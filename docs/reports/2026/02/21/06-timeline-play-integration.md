# ゲームプレビューでタイムラインアニメーション再生

## 背景

ksc-demo.html のゲームプレビュー (`?work=<id>`) でタイムラインブロックが完全にスキップされていた。
5秒のタイムラインがあるページでも `@bg` + `@ch` + `PAGE` の3命令だけが実行され35msで完了。

### 原因

パイプライン全体でタイムラインブロック未対応だった:

| レイヤー | 状態 |
|---------|------|
| スクリプト生成 | コメント `; [タイムライン: ...]` に変換 → コンパイラが無視 |
| Op型 | `TIMELINE_PLAY` が存在しない |
| WebOpHandler | タイムライン再生の実装なし |

既存資産として `evaluateTimeline()` は `@kaedevn/core` に実装済み・テスト済みで、エディタの TimelinePreview では正常動作していた。

## 方針

コンパイラ拡張 + アウトオブバンドデータ。

KSCテキストに `@timeline_play {blockId}` を出力し、タイムラインJSON本体は別チャネルで渡す（`setAssetManifest()` / `setCharacters()` と同パターン）。

## 変更ファイル一覧

| # | ファイル | 変更 |
|---|---------|------|
| 1 | `packages/core/src/types/Op.ts` | `TIMELINE_PLAY` op追加 |
| 2 | `packages/core/src/engine/IOpHandler.ts` | `timelinePlay?()` メソッド追加 |
| 3 | `packages/core/src/engine/OpRunner.ts` | `TIMELINE_PLAY` case追加 |
| 4 | `packages/compiler/src/tokenizer/lineClassifier.ts` | `'timeline_play'` をKNOWN_COMMANDSに追加 |
| 5 | `packages/compiler/src/parser/parseCommand.ts` | `parseTimelinePlayCommand()` 追加 |
| 6 | `packages/web/src/renderer/WebOpHandler.ts` | `setTimelines()` + `timelinePlay()` + `applyTimelineResult()` |
| 7 | `packages/web/src/ksc-demo.ts` | APIモード・postMessageモード両方でtimelines渡し |
| 8 | `apps/hono/src/routes/preview.ts` | timeline case追加 + timelines返却 |
| 9 | `apps/editor/src/store/useEditorStore.ts` | `buildPreviewScript`/`buildPageScript` でtimeline出力変更 |
| 10 | `apps/editor/src/components/sidebar/SidebarPreview.tsx` | postMessageにtimelines含める |

## 実装の詳細

### Op型・ハンドラー・ランナー (packages/core)

```typescript
// Op.ts
| { op: "TIMELINE_PLAY"; timelineId: string }

// IOpHandler.ts
timelinePlay?(timelineId: string): Promise<void>;

// OpRunner.ts
case "TIMELINE_PLAY": {
  if (h.timelinePlay) await h.timelinePlay(op.timelineId);
  this.pc++;
  break;
}
```

`battleStart` と同パターン — オプショナルメソッドで既存実装を壊さない。

### WebOpHandler のタイムライン再生

PixiJS の `Ticker.add()` で毎フレーム `evaluateTimeline()` を呼び、結果をスプライトに適用。`durationMs` 経過で Promise を resolve。

```typescript
async timelinePlay(timelineId: string): Promise<void> {
  const timeline = this.timelines.get(timelineId);
  // ...
  return new Promise<void>((resolve) => {
    const tickHandler = () => {
      const results = evaluateTimeline(timeline, elapsed);
      for (const result of results) this.applyTimelineResult(result);
      if (elapsed >= durationMs) { ticker.remove(tickHandler); resolve(); }
    };
    this.ticker.add(tickHandler);
  });
}
```

## デバッグで判明した問題と修正

### 問題1: コンパイラのビルド漏れ

`npm run build` が `core` + `web` しかビルドしておらず `compiler` をスキップしていた。コンパイラの `package.json` が `"main": "./dist/index.js"` を指すため、ソースの変更だけでは反映されなかった。

```
# 修正: コンパイラも明示的にビルド
npm run build -w @kaedevn/compiler
```

**症状**: `@timeline_play` が `TEXT_APPEND`（テキスト）としてコンパイルされていた。

### 問題2: targetId ミスマッチ（背景）

タイムラインの entity トラックは背景のアセットID (`01KHV3D6ZMBRGS0G0ZRMN03J2A`) を `targetId` に持つが、sprites マップのキーは `"bg"`。

```
sprite not found for targetId="01KHV3D6ZMBRGS0G0ZRMN03J2A", available: [bg,hero]
```

**修正**: `targetIdAliases` マップを導入。`bgSet(id)` 呼び出し時に `assetId → "bg"` を登録し、`applyTimelineResult` で alias を解決してからスプライトを検索。

```typescript
private targetIdAliases = new Map<string, string>();

// bgSet 内
this.targetIdAliases.set(id, "bg");

// applyTimelineResult 内
const spriteKey = this.targetIdAliases.get(result.targetId) ?? result.targetId;
const sprite = this.sprites.get(spriteKey);
```

### 問題3: プロパティ名ミスマッチ

タイムラインエディタが出力するプロパティ名とコードが期待する名前が不一致だった。

| タイムラインの出力 | コードが期待 | 修正 |
|------------------|------------|------|
| `opacity` | `alpha` | 両方対応 |
| `scale` (uniform) | `scaleX` / `scaleY` | `scale.set(value)` |
| `zoom` (camera) | `scaleX` / `scaleY` | `scale.set(zoom)` |

## 教訓

1. **ビルドパイプラインの依存関係を確認する** — `npm run build` のスクリプトが全パッケージをビルドするか確認。`"main": "./dist/"` のパッケージはソース変更だけでは反映されない
2. **ID体系の不一致は早期に検出する** — タイムラインエディタが使う targetId（アセットID）とランタイムの sprite key（`"bg"`, `"hero"`）は異なる名前空間。alias マップで橋渡しする
3. **プロパティ名はエディタの出力に合わせる** — `opacity` vs `alpha` のようなシノニムは、エディタ側の命名に合わせて両方対応する
