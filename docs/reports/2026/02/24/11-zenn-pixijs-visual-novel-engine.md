---
title: "ブラウザで動くビジュアルノベルエンジンを PixiJS + TypeScript で作った"
emoji: "🎮"
type: "tech"
topics: ["claudecode", "typescript", "pixijs", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン kaedevn の Web 実装として、PixiJS + TypeScript でブラウザ上で完全に動くエンジンを構築した。背景表示、キャラクター立ち絵、テキストウィンドウ、選択肢、BGM/SE 再生まで、ノベルゲームに必要な一通りの機能がブラウザだけで動く。

この記事では `WebEngine`（IEngineAPI 実装・384 行）を中心に、PixiJS を使ったノベルゲームエンジンの設計と実装を解説する。

## アーキテクチャ

エンジンのレイヤー構成は以下のようになっている。

```
┌─────────────────────────────────────────────┐
│              ksc-demo.ts (Entry)             │
│  PixiJS Application 初期化 + シナリオ制御    │
├─────────────────────────────────────────────┤
│           OpRunner / KscRunner               │
│  コンパイル済み Op 列の実行制御              │
├─────────────────────────────────────────────┤
│           WebOpHandler (IOpHandler)          │
│  Op → PixiJS 描画コマンドの変換             │
├────────────┬────────────┬───────────────────┤
│ LayerManager│ TextWindow │ ChoiceOverlay     │
│ (背景/キャラ)│ (テキスト) │ (選択肢UI)       │
├────────────┼────────────┼───────────────────┤
│ AudioManager│InputManager│ Logger            │
│ (BGM/SE)   │(キーボード │ (デバッグ)        │
│            │  /タッチ)  │                   │
├────────────┴────────────┴───────────────────┤
│              PixiJS v8                       │
└─────────────────────────────────────────────┘
```

重要な設計原則は「プラットフォーム抽象を介して全てにアクセスする」ことだ。レンダリングは PixiJS を直接使うが、入力（IInput）、音声（IAudio）、ストレージ（IStorage）は抽象インターフェースを通す。これにより、将来の Nintendo Switch 移植時にフルリライトを回避できる。

## PixiJS Application のセットアップ

エントリポイント `ksc-demo.ts` では PixiJS Application を初期化する。論理解像度は 1280x720 固定だ。

```typescript
import { Application } from "pixi.js";
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from "@kaedevn/core";

async function main() {
  const app = new Application();
  await app.init({
    width: VIRTUAL_WIDTH,    // 1280
    height: VIRTUAL_HEIGHT,  // 720
    backgroundColor: 0x1a1a2e,
    antialias: true,
  });

  document.body.appendChild(app.canvas);

  // Play モードではビューポート全体をカバー
  const isPlayMode = urlParams.get('mode') === 'play';
  if (isPlayMode) {
    app.canvas.style.width = "100vw";
    app.canvas.style.height = "100vh";
    app.canvas.style.objectFit = "cover";
  } else {
    app.canvas.style.margin = "0 auto";
    app.canvas.style.maxWidth = "100vw";
    app.canvas.style.maxHeight = "100vh";
  }
}
```

`objectFit: "cover"` でアスペクト比を維持しながらビューポートを埋める。エディタプレビューモードでは `margin: 0 auto` でセンタリングする。

## LayerManager: レイヤー管理

ノベルゲームの描画はレイヤーの重ね順が重要だ。LayerManager は背景、キャラクター、UI の 3 レイヤーを管理する。

```
root (Container)
├── backgroundLayer  (z=0)  背景画像
├── characterLayer   (z=1)  キャラクター立ち絵
└── uiLayer          (z=2)  テキストウィンドウ、選択肢
```

この順序により、背景の上にキャラクターが、キャラクターの上にテキストウィンドウが表示される。

## WebEngine: IEngineAPI 実装

`WebEngine` は KNF インタプリタの `IEngineAPI` を実装する 384 行のクラスだ。インタプリタが `.ksc` スクリプトを実行する際、描画や音声の処理をこのクラスに委譲する。

### 背景の表示

```typescript
async setBg(name: string, effect?: string): Promise<void> {
  logger.info("WebEngine", `setBg: ${name} (effect=${effect ?? "none"})`);
  const assetPath = this.resolveAssetPath(name, 'background');
  await this.showSprite("bg", assetPath, 0, 0, true);
}
```

背景画像は `showSprite` 内部で 1280x720 にフィットするようスケーリングされる。

```typescript
private async showSprite(
  id: string, assetPath: string,
  x: number, y: number, isBackground: boolean
): Promise<void> {
  this.removeSprite(id); // 既存のスプライトを削除

  try {
    const texture = await Assets.load(assetPath);
    const sprite = new Sprite(texture);

    if (isBackground) {
      // 画面全体をカバーするスケーリング
      const scaleX = VIRTUAL_WIDTH / texture.width;
      const scaleY = VIRTUAL_HEIGHT / texture.height;
      const scale = Math.max(scaleX, scaleY);
      sprite.scale.set(scale);
      sprite.position.set(
        (VIRTUAL_WIDTH - texture.width * scale) / 2,
        (VIRTUAL_HEIGHT - texture.height * scale) / 2
      );
    } else {
      // キャラクター: 画面高さに合わせる
      const targetHeight = VIRTUAL_HEIGHT;
      const scale = targetHeight / texture.height;
      sprite.scale.set(scale);
      sprite.anchor.set(0.5, 1); // 下端中央アンカー
      sprite.position.set(x, VIRTUAL_HEIGHT);
    }

    displayObj = sprite;
  } catch (err) {
    logger.error("WebEngine", `Failed to load: ${assetPath}`, err);
    displayObj = this.createErrorPlaceholder(isBackground, assetPath);
  }

  this.sprites.set(id, displayObj);

  if (isBackground) {
    this.layers.backgroundLayer.removeChildren();
    this.layers.backgroundLayer.addChild(displayObj);
  } else {
    this.layers.characterLayer.addChild(displayObj);
  }
}
```

背景は `Math.max(scaleX, scaleY)` で画面全体をカバーする（CSS の `object-fit: cover` と同じ考え方）。キャラクターは画面高さに合わせてスケーリングし、下端中央にアンカーを設定する。

アセット読み込みに失敗した場合は赤い X マークのプレースホルダーを表示する。開発中にアセットが欠けていてもエラーで止まらず、視覚的にどこが問題かわかるようにしている。

### キャラクターの表示と位置

キャラクターの表示位置は `left` / `center` / `right` の 3 ポジション固定だ。

```typescript
async showChar(name: string, pose: string, position?: string): Promise<void> {
  const pos = position || "center";
  // left=320, center=640, right=960
  const posX = pos === "left" ? 320 : pos === "right" ? 960 : 640;
  const posY = 360;

  const spriteId = `${name}_${pose}`;
  const assetPath = this.resolveAssetPath(spriteId, 'character');
  await this.showSprite(name, assetPath, posX, posY, false);
}
```

### キャラクターの移動アニメーション

`moveChar` はリニア補間による移動アニメーションを実装している。

```typescript
async moveChar(name: string, position: string, time: number): Promise<void> {
  const sprite = this.sprites.get(name);
  if (!sprite) return;

  const targetX = position === "left" ? 320 : position === "right" ? 960 : 640;
  const startX = sprite.position.x;
  const startTime = Date.now();

  return new Promise<void>((resolve) => {
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / time, 1);
      sprite.position.x = startX + (targetX - startX) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };
    animate();
  });
}
```

`requestAnimationFrame` ベースのアニメーションを `Promise` でラップすることで、スクリプト側では `await` で完了を待てる。

### 選択肢の表示

選択肢は `ChoiceOverlay` に委譲して表示し、ユーザーの選択を `Promise<number>` で返す。

```typescript
async showChoice(options: ChoiceOption[]): Promise<number> {
  // 条件付き選択肢をフィルタ
  const visibleOptions = options
    .map((opt, idx) => ({ ...opt, originalIndex: idx }))
    .filter(opt => opt.condition !== false);

  if (visibleOptions.length === 0) {
    return 0;
  }

  const overlayOptions = visibleOptions.map((opt, idx) => ({
    label: opt.text,
    jump: idx,
  }));

  const selectedIndex = await this.choiceOverlay.show(overlayOptions);
  return visibleOptions[selectedIndex].originalIndex;
}
```

`originalIndex` の保持が重要だ。条件によって一部の選択肢が非表示になった場合でも、元のインデックスを正しく返すことで、スクリプト側の分岐処理が狂わない。

### 音声再生

BGM と SE は `AudioManager` に委譲する。

```typescript
playBgm(name: string): void {
  const assetPath = this.resolveAssetPath(name, 'audio');
  this.audio.play("bgm", assetPath, true);  // loop=true
}

playSe(name: string): void {
  const assetPath = this.resolveAssetPath(name, 'audio');
  this.audio.play("se", assetPath);  // loop=false
}

async fadeBgm(time: number): Promise<void> {
  const startVolume = this.audio.getVolume("bgm");
  const startTime = Date.now();

  return new Promise<void>((resolve) => {
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / time, 1);
      this.audio.setVolume("bgm", startVolume * (1 - progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.audio.stop("bgm");
        this.audio.setVolume("bgm", startVolume); // 音量リセット
        resolve();
      }
    };
    animate();
  });
}
```

BGM のフェードアウトも `requestAnimationFrame` + `Promise` パターンだ。音量を線形に 0 まで下げてから `stop()` する。

## WebOpHandler: 新しいアーキテクチャ

現在は `WebEngine`（IEngineAPI 実装）に代わって `WebOpHandler`（IOpHandler 実装）が主役になっている。WebOpHandler は Op 命令を直接処理する、より低レベルなインターフェースだ。

```typescript
export class WebOpHandler implements IOpHandler {
  private layers: LayerManager;
  private textWindow: TextWindow;
  private choiceOverlay: ChoiceOverlay;
  private input: InputManager;
  private audio: AudioManager;
  private ticker: Ticker;
  private sprites = new Map<string, Container>();

  // テキストバッファ管理
  private textBuffer = "";
  private currentWho: string | undefined;

  // アセットマニフェスト
  private assetManifest: {
    backgrounds: Record<string, string>;
    characters: Record<string, string>;
    audio: Record<string, string>;
  } | null = null;
}
```

WebOpHandler は Auto モード / Skip モードにも対応している。

```typescript
constructor(/* ... */) {
  this.input.on(Action.AutoToggle, () => {
    this.autoMode = !this.autoMode;
    this.textWindow.enableAuto(this.autoMode);
  });

  this.input.on(Action.SkipToggle, () => {
    this.skipMode = !this.skipMode;
    if (this.skipMode) {
      const isRead = this.readFlags[this.currentPC] === true;
      if (isRead) {
        this.textWindow.enableSkip(true);
      }
    } else {
      this.textWindow.enableSkip(false);
    }
  });
}
```

既読テキストのみスキップ可能にする仕組みは、既読フラグ（`readFlags`）と現在の pc 値で判定している。

## アセットマニフェストと動的解決

アセットの参照は ID ベースで行い、マニフェスト JSON で実際の URL に解決する。

```typescript
setAssetManifest(assets: Array<{ id: string; kind: string; category?: string; url: string }>): void {
  this.assetManifest = { backgrounds: {}, characters: {}, audio: {} };

  for (const asset of assets) {
    if (asset.kind === 'image') {
      if (asset.category === 'bg') {
        this.assetManifest.backgrounds[asset.id] = asset.url;
      } else if (asset.category === 'ch-img') {
        this.assetManifest.characters[asset.id] = asset.url;
      }
    } else if (asset.kind === 'audio') {
      this.assetManifest.audio[asset.id] = asset.url;
    }
    // Legacy kinds (backward compat)
    else if (asset.kind === 'bg') {
      this.assetManifest.backgrounds[asset.id] = asset.url;
    }
  }
}
```

新しい 3 階層分類体系（kind + category + subcategory）とレガシー形式（bg/ch/bgm/se）の両方に対応している。

## エディタ連携: postMessage

エディタからプレビューへのスクリプト送信は `postMessage` で行う。

```typescript
window.addEventListener('message', async (event) => {
  if (event.data?.type !== 'previewScript') return;

  const { script, assets, characters, timelines, lang } = event.data;

  try {
    runner.stop();
    kscRunner.stop();
    handler.reset();

    if (assets) handler.setAssetManifest(assets);
    if (characters) handler.setCharacters(characters);
    if (timelines) handler.setTimelines(timelines);

    if (lang === 'ksc') {
      await kscRunner.run(script, handler);
    } else {
      const scenario = compile(script, { scenarioId: 'preview', validate: false });
      await runner.start(scenario, handler);
    }
  } catch (err) {
    // エラーをエディタに返す
    window.parent.postMessage({
      type: 'previewError',
      error: { message: err.message, line: err.line }
    }, '*');
  }
});
```

エラー発生時は行番号付きでエディタに返し、エディタ側で該当行をハイライトできるようにしている。

## セーブ/ロード対応

WebEngine はステートのスナップショットと復元に対応している。

```typescript
getState() {
  const currentBg = this.sprites.has("bg") ? "bg" : null;
  const characters = [];
  for (const [id, _sprite] of this.sprites) {
    if (id !== "bg") {
      characters.push({ id, sprite: id });
    }
  }
  return { currentBg, characters };
}

async restoreState(state: { currentBg: string | null; characters: Array<{ id: string; sprite: string }> }) {
  this.layers.backgroundLayer.removeChildren();
  this.layers.characterLayer.removeChildren();
  this.sprites.clear();

  if (state.currentBg) {
    await this.setBg(state.currentBg);
  }
}
```

## まとめ

PixiJS + TypeScript でブラウザ上に完全動作するビジュアルノベルエンジンを構築した。プラットフォーム抽象（IEngineAPI / IOpHandler）を介することで、レンダリングの実装を差し替え可能に保ちながら、PixiJS の高速な 2D レンダリングを活かした実装になっている。

---

PixiJS の Sprite 管理、requestAnimationFrame ベースのアニメーション、postMessage によるエディタ連携と、Web 技術を駆使してノベルゲームエンジンの描画層を組み上げた。プラットフォーム抽象という設計判断が将来の Switch 移植を見据えた本プロジェクトにおいて正しかったことを、実装を通じて確認できた。

　　　　　　　　　　Claude Opus 4.6
