# TS-VM 2D Engine 設計書

## 1. 目的

本設計書は TS-VM 2D Engine の内部構造・インターフェース定義・モジュール分割・実装方針を定める。仕様書（03-ts-vm-2d-engine-spec.md）で定義した要件を、どのように実装するかを記述する。

## 2. パッケージ構成

```
packages/
  ksc-compiler/         # KSC 言語処理系（Lexer → Parser → TypeChecker → IR Emitter）
  ksc-vm/               # Stack-based VM（IR 実行 + Host API 呼び出し）
  engine-core/          # Scene / Timing / Input / Audio / Assets / MiniGame Host
  engine-systems/       # ゲーム別ロジック（Battle / Shooter / Puzzle）
  platform-pixi/        # PixiJS アダプタ（IRenderer / IAudio / IInput / IStorage）
  platform-sdl2/        # 将来：SDL2 アダプタ
```

### 2.1 依存関係

```
ksc-compiler  →  （外部依存なし）
ksc-vm        →  ksc-compiler（IR 型のみ）, engine-core（VMBuiltins 型）
engine-core   →  （外部依存なし、インターフェースのみ定義）
engine-systems →  engine-core
platform-pixi →  engine-core, pixi.js
```

**鉄則**: `ksc-vm` と `engine-core` は `pixi.js` に依存してはならない。

## 3. 型定義（TypeScript Interface）

### 3.1 共通型

```typescript
// ブランド型で ID の混同を防ぐ
export type NodeId = number & { readonly __nodeId: unique symbol };
export type BatchId = number & { readonly __batchId: unique symbol };
export type AssetId = string & { readonly __assetId: unique symbol };
export type TextureId = AssetId;
export type SoundId = AssetId;
export type FontId = AssetId;
export type MiniGameHandle = number & { readonly __miniGameHandle: unique symbol };

export type EngineModeId = "novel" | "minigame" | "debug";
export type MiniGameStatus = "running" | "finished" | "aborted";
export type MiniGameOutcome = "win" | "lose" | "clear" | "fail" | "cancel" | "abort";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };
```

### 3.2 Transform

```typescript
export interface Vec2 {
  x: number;
  y: number;
}

export interface Transform2D {
  x: number;
  y: number;
  rotation: number;  // radians
  scaleX: number;
  scaleY: number;
  alpha: number;     // 0..1
  visible: boolean;
  z: number;         // レイヤソート
}
```

### 3.3 IInput

```typescript
export type InputAction =
  | "ok" | "cancel" | "menu" | "skip" | "auto" | "log"
  | "up" | "down" | "left" | "right"
  | "shot" | "bomb" | "pause";

export type InputAxis = "moveX" | "moveY";

export interface IInput {
  setMode(mode: EngineModeId): void;
  bind(mode: EngineModeId, bindings: InputBindings): void;

  isDown(action: InputAction): boolean;
  wasPressed(action: InputAction): boolean;
  wasReleased(action: InputAction): boolean;
  axis(name: InputAxis): number;

  snapshot(): InputSnapshot;
}

export interface InputBindings {
  actions: Partial<Record<InputAction, ActionBinding>>;
}

export interface ActionBinding {
  keys?: KeyCode[];
  gamepadButtons?: GamepadButton[];
}

export interface InputSnapshot {
  down: ReadonlySet<InputAction>;
  pressed: ReadonlySet<InputAction>;
  released: ReadonlySet<InputAction>;
  axes: Record<InputAxis, number>;
}
```

### 3.4 IClock / IScheduler

```typescript
export interface IClock {
  nowMs(): number;
}

export type Easing =
  | "linear"
  | "inQuad" | "outQuad" | "inOutQuad"
  | "inCubic" | "outCubic" | "inOutCubic";

export interface TweenSpec {
  durationSec: number;
  easing?: Easing;
}

export interface IScheduler {
  waitSeconds(sec: number): Promise<void>;
  waitFrames(frames: number): Promise<void>;
  tweenNode(
    nodeId: NodeId,
    props: Partial<Pick<Transform2D, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "alpha">>,
    spec: TweenSpec,
  ): Promise<void>;
  cancelAll(): void;
}
```

### 3.5 IAssets

```typescript
export interface AssetManifestEntry {
  id: AssetId;
  type: "texture" | "sound" | "font" | "json";
}

export interface IAssets {
  preload(ids: AssetId[]): Promise<void>;
  has(id: AssetId): boolean;
  texture(id: TextureId): unknown;  // Platform 固有オブジェクト
  sound(id: SoundId): unknown;
  font(id: FontId): unknown;
  manifest(): readonly AssetManifestEntry[];
}
```

### 3.6 IAudio

```typescript
export interface IAudio {
  playBGM(id: SoundId, opts?: { loop?: boolean; volume?: number }): void;
  stopBGM(): void;
  playSE(id: SoundId, opts?: { volume?: number }): void;
  setMasterVolume(v: number): void;
}
```

### 3.7 IRenderer

```typescript
export interface IRenderer {
  setViewport(width: number, height: number): void;

  // Node 生成
  createSprite(textureId: TextureId, opts?: SpriteCreateOptions): NodeId;
  createText(text: string, opts?: TextCreateOptions): NodeId;
  destroyNode(nodeId: NodeId): void;

  // Transform
  setPos(nodeId: NodeId, x: number, y: number): void;
  setRotation(nodeId: NodeId, radians: number): void;
  setScale(nodeId: NodeId, sx: number, sy: number): void;
  setAlpha(nodeId: NodeId, a: number): void;
  setVisible(nodeId: NodeId, v: boolean): void;
  setZ(nodeId: NodeId, z: number): void;

  // テキスト更新
  setText(nodeId: NodeId, text: string): void;

  // 親子関係
  setParent(child: NodeId, parent: NodeId | null): void;

  // Batch（弾幕用）
  createSpriteBatch(textureId: TextureId, opts: BatchCreateOptions): BatchId;
  destroyBatch(batchId: BatchId): void;
  batchSet(batchId: BatchId, index: number, item: BatchItem): void;
  batchCommit(batchId: BatchId, count: number): void;
}

export interface SpriteCreateOptions {
  x?: number; y?: number; z?: number;
  alpha?: number;
  scaleX?: number; scaleY?: number;
  rotation?: number; visible?: boolean;
  anchorX?: number; anchorY?: number;
}

export interface TextCreateOptions extends SpriteCreateOptions {
  style?: TextStyle;
}

export interface TextStyle {
  fontId?: FontId;
  fontSize?: number;
  color?: number;  // 0xRRGGBB
}

export interface BatchCreateOptions {
  capacity: number;
  z?: number;
  alpha?: number;
  visible?: boolean;
}

export interface BatchItem {
  x: number; y: number;
  rotation: number;
  scaleX: number; scaleY: number;
  alpha: number; visible: boolean;
}
```

### 3.8 IKVStore

```typescript
export interface IKVStore {
  get(key: string): JsonValue | undefined;
  set(key: string, value: JsonValue): void;
  remove(key: string): void;
  clear(): void;
}
```

### 3.9 IHttp / IStorage / IEventQueue

```typescript
export interface IHttp {
  getJson(url: string, opts?: HttpRequestOptions): Promise<JsonValue>;
  postJson(url: string, body: JsonValue, opts?: HttpRequestOptions): Promise<JsonValue>;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface IStorage {
  readText(id: string): Promise<string>;
  readBytes(id: string): Promise<Uint8Array>;
  writeText(id: string, text: string): Promise<void>;
  writeBytes(id: string, bytes: Uint8Array): Promise<void>;
  exists(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}

export type EngineEvent =
  | { type: "assetLoaded"; id: AssetId }
  | { type: "httpResponse"; requestId: number; data: JsonValue }
  | { type: "storageRead"; requestId: number; data: string | Uint8Array }
  | { type: "custom"; name: string; payload?: JsonValue };

export interface IEventQueue {
  enqueue(ev: EngineEvent): void;
  drain(): EngineEvent[];
}
```

### 3.10 EngineContext

```typescript
export interface EngineContext {
  clock: IClock;
  scheduler: IScheduler;
  input: IInput;
  audio: IAudio;
  assets: IAssets;
  renderer: IRenderer;
  kv: IKVStore;
  http: IHttp;
  storage: IStorage;
  events: IEventQueue;
  random: {
    seed(seed: number): void;
    next(): number;
    int(min: number, maxInclusive: number): number;
  };
}
```

### 3.11 IMiniGame

```typescript
export interface MiniGameSpec {
  type: string;    // "shooter" | "battle" | "puzzle" ...
  id: string;
  params?: Record<string, JsonValue>;
}

export interface MiniGameResult {
  outcome: MiniGameOutcome;
  score?: number;
  timeSec?: number;
  data?: Record<string, JsonValue>;
}

export interface IMiniGame {
  init(ctx: EngineContext, spec: MiniGameSpec): Promise<void> | void;
  enter(): void;
  update(dtSec: number): void;
  render?(): void;
  pause?(): void;
  resume?(): void;
  exit(): void;
  status(): MiniGameStatus;
  result(): MiniGameResult | null;
}

export interface IMiniGameHost {
  start(spec: MiniGameSpec): Promise<MiniGameHandle>;
  stop(handle: MiniGameHandle, reason?: string): void;
  status(handle: MiniGameHandle): MiniGameStatus;
  result(handle: MiniGameHandle): MiniGameResult | null;
  updateActive(dtSec: number): void;
  hasActive(): boolean;
}
```

### 3.12 VMBuiltins（VM ↔ Engine 境界）

```typescript
export interface VMBuiltins {
  // Scene
  spawnSprite(textureId: TextureId, opts?: SpriteCreateOptions): NodeId;
  spawnText(text: string, opts?: TextCreateOptions): NodeId;
  setNode(nodeId: NodeId, props: Partial<Transform2D>): void;
  setText(nodeId: NodeId, text: string): void;
  destroy(nodeId: NodeId): void;

  // Timing
  wait(sec: number): Promise<void>;
  waitFrames(frames: number): Promise<void>;
  tween(
    nodeId: NodeId,
    props: Partial<Pick<Transform2D, "x" | "y" | "rotation" | "scaleX" | "scaleY" | "alpha">>,
    spec: TweenSpec,
  ): Promise<void>;

  // Input
  isDown(action: InputAction): boolean;
  wasPressed(action: InputAction): boolean;
  axis(name: InputAxis): number;

  // Audio
  playSE(id: SoundId, opts?: { volume?: number }): void;
  playBGM(id: SoundId, opts?: { loop?: boolean; volume?: number }): void;
  stopBGM(): void;

  // Assets
  preload(ids: AssetId[]): Promise<void>;

  // KV
  kvGet(key: string): JsonValue | undefined;
  kvSet(key: string, value: JsonValue): void;

  // MiniGame
  minigameStart(spec: MiniGameSpec): Promise<MiniGameHandle>;
  minigameWait(handle: MiniGameHandle): Promise<void>;
  minigameResult(handle: MiniGameHandle): MiniGameResult | null;

  // I/O
  httpGet(url: string): Promise<JsonValue>;
  httpPost(url: string, body: JsonValue): Promise<JsonValue>;
  fileReadText(id: string): Promise<string>;
  fileWriteText(id: string, text: string): Promise<void>;
}
```

### 3.13 IEngine

```typescript
export interface EngineConfig {
  viewport: { width: number; height: number };
  fixedStepSec?: number;  // 例: 1/60
}

export interface IEngine {
  ctx: EngineContext;
  vmBuiltins: VMBuiltins;

  setMode(mode: EngineModeId): void;
  mode(): EngineModeId;

  tick(dtSec: number): void;
}
```

### 3.14 NovelGameAdapter

既存のノベルランタイムを IMiniGame として統一するアダプタ。

```typescript
export interface INovelRuntime {
  step(): void;
  isBlocked(): boolean;
  isFinished(): boolean;
  onAction(action: InputAction): void;
}

// NovelGameAdapter implements IMiniGame
// - enter(): input.setMode("novel"), ノベル UI 表示
// - update(dt): novel.step() をバジェット付きで実行
// - exit(): ノベル UI 非表示
// - status(): novel.isFinished() ? "finished" : "running"
```

## 4. KSC コンパイラ内部設計

### 4.1 コンパイルパイプライン

```
KSC Source (.ksc)
    ↓
  Lexer (tokenize)          ← Phase 1 完了
    ↓ Token[]
  Parser (parse)            ← Phase 1 完了
    ↓ Program (AST)
  Type Checker              ← Phase 2
    ↓ Typed AST
  IR Emitter                ← Phase 3
    ↓ IRModule
  Stack-based VM            ← Phase 4
    ↓ VMBuiltins 呼び出し
  Engine Core
```

### 4.2 AST ノード定義

#### Expression（16 種）

| Kind | 説明 | Phase |
|------|------|-------|
| `NumberLiteral` | `42`, `3.14` | 1 |
| `StringLiteral` | `"hello"` | 1 |
| `BooleanLiteral` | `true`, `false` | 1 |
| `NullLiteral` | `null` | 1 |
| `TemplateStringLiteral` | `` `text ${expr}` `` | 1（raw）→ 3（式展開） |
| `Identifier` | `foo`, `player` | 1 |
| `BinaryExpr` | `a + b`, `x == y` | 1 |
| `UnaryExpr` | `!flag`, `-n` | 1 |
| `AssignExpr` | `x = 1`, `x += 2`, `x %= n` | 1 |
| `CallExpr` | `fn(a, b)` | 1 |
| `MemberExpr` | `obj.prop` | 1 |
| `IndexExpr` | `arr[0]` | 1 |
| `TernaryExpr` | `cond ? a : b` | 1 |
| `ArrayLiteral` | `[1, 2, 3]` | 1 |
| `ObjectLiteral` | `{ x: 1, y: 2 }` | 1 |
| **`AwaitExpr`** | **`await wait(1.0)`** | **1.5** |

> `ArrowFunctionExpr`（`(x) => x * 2`）は Phase 3 以降で追加予定。

#### Statement（15 種）

| Kind | 説明 | Phase |
|------|------|-------|
| `VariableDecl` | `let x = 1;`, `const y: number = 2;` | 1 |
| `FunctionDecl` | `function f(a: number): void { }` | 1 |
| `ReturnStmt` | `return expr;` | 1 |
| `IfStmt` | `if / else if / else` | 1 |
| `ForStmt` | `for (init; cond; update) { }` | 1 |
| `WhileStmt` | `while (cond) { }` | 1 |
| `SwitchStmt` | `switch (expr) { case / default }` | 1 |
| `BreakStmt` | `break;` | 1 |
| **`ContinueStmt`** | **`continue;`** | **1.5** |
| `BlockStmt` | `{ ... }` | 1 |
| `ExpressionStmt` | 式文（`fn();`, `x = 1;`） | 1 |
| `TypeAliasDecl` | `type T = ...;` | 1 |
| `ImportDecl` | `import { x } from "mod";` | 1 |
| `ExportDecl` | `export ...` | 1 |
| `DialogueBlock` | `#speaker "text"` | 1 |

#### TypeAnnotation（5 種）

| Kind | 例 |
|------|-----|
| `named` | `number`, `string`, `Battle.State` |
| `array` | `number[]`, `string[]` |
| `union` | `number \| null` |
| `object` | `{ x: number; y: number }` |
| `literal` | `"win"`, `42`, `true` |

### 4.3 IR 設計

#### OpCode 一覧

```typescript
enum OpCode {
  // スタック操作
  LOAD_CONST, LOAD_VAR, STORE_VAR, POP, DUP,

  // 算術
  ADD, SUB, MUL, DIV, MOD, NEG,

  // 比較
  EQ, NEQ, LT, GT, LTE, GTE,

  // 論理
  AND, OR, NOT,

  // 制御フロー
  JMP, JMP_IF_FALSE, CALL, RETURN,
  SWITCH,                    // switch テーブルジャンプ

  // オブジェクト操作
  GET_PROP, SET_PROP, GET_INDEX,
  SET_INDEX,                 // ← Phase 2 で追加（配列要素代入）

  // ホスト API
  HOST_CALL,                 // 同期 Host API 呼び出し
  HOST_CALL_ASYNC,           // 非同期 Host API 呼び出し（Phase 2 で追加）

  // 非同期
  AWAIT,                     // スタックトップの Promise を待機、VM 停止（Phase 1.5 で追加）
}
```

**`AWAIT` の VM 動作フロー:**

```
1. VM が AWAIT 命令を実行
2. スタックトップから Promise（または非同期ハンドル）を取得
3. VM は VMResult { type: WAIT_ASYNC, handle } を返して停止
4. Engine が非同期処理の完了を検知
5. 結果をスタックに積んで VM を再開
```

**`HOST_CALL` vs `HOST_CALL_ASYNC` の設計判断:**

| 方式 | 説明 | 採用 |
|------|------|------|
| 分離方式 | `HOST_CALL`（同期） / `HOST_CALL_ASYNC`（非同期 → 自動 AWAIT） | 推奨 |
| 統一方式 | 全 `HOST_CALL` が `VMResult` を返し VM 側で判断 | 代替案 |

分離方式を推奨。コンパイル時に同期/非同期が静的に決まるため、VM 実行時の分岐を減らせる。

#### IRModule

```typescript
interface IRModule {
  functions: IRFunction[];
  constants: unknown[];          // 定数プール
  sourceMap: Array<[number, number]>;  // [IR命令index, ソース行番号]
  // ※ Map<number, number> ではなく Array にしてJSONシリアライズ可能にする
}
```

#### VMState（save/load 対象）

```typescript
interface VMState {
  pc: number;
  stack: unknown[];
  callStack: Array<{
    functionIndex: number;
    returnPc: number;
    locals: unknown[];  // インデックスベース（変数名→index は定数プールで解決）
  }>;
  globals: Record<string, unknown>;
  status: 'running' | 'paused' | 'finished';
}
```

> `callStack.locals` は `Record<string, unknown>` ではなく `unknown[]`（配列）とする。IR の `LOAD_VAR` / `STORE_VAR` がインデックスで変数を参照する設計に合わせる。変数名→インデックスのマッピングは `IRFunction.localNames` で管理し、デバッグ時のみ使用する。

### 4.4 FunctionParam の型注釈

```typescript
interface FunctionParam {
  name: string;
  type: TypeAnnotation | null;  // null = 型推論に委ねる（Phase 2 で利用）
}
```

KSC は明示的型付けを推奨するが、コールバック引数など型推論が自然な場面に備えて nullable とする。

## 5. Engine Tick 設計

### 5.1 メインループ

```typescript
class Engine implements IEngine {
  tick(dtSec: number): void {
    // 1. 非同期完了イベントを適用
    for (const ev of this.ctx.events.drain()) {
      this.applyEvent(ev);
    }

    // 2. 入力更新（エッジ検出）
    this.ctx.input.update();

    // 3. ゲーム更新
    if (this.miniGameHost.hasActive()) {
      // MiniGame 実行中
      if (this.fixedStepSec) {
        this.accumulator += dtSec;
        while (this.accumulator >= this.fixedStepSec) {
          this.miniGameHost.updateActive(this.fixedStepSec);
          this.accumulator -= this.fixedStepSec;
        }
      } else {
        this.miniGameHost.updateActive(dtSec);
      }
    } else {
      // Novel / 通常モード
      this.activeMode.update(dtSec);
    }

    // 4. 描画（Platform が自動実行、SDL2 では明示呼び出し）
  }
}
```

### 5.2 固定ステップ（Accumulator 方式）

STG など物理的な挙動を安定させるため、`fixedStepSec = 1/60` を設定した場合:

```
accumulator += dtSec (実経過時間)
while accumulator >= fixedStep:
    update(fixedStep)
    accumulator -= fixedStep
```

可変 fps ブラウザでも Switch (60fps 固定) でも同一挙動。

## 6. ゲーム別システム設計

### 6.1 Combat Core（薄味コマンドバトル）

```
engine-systems/battle/
  ├ BattleSystem.ts       # ターン管理、行動順
  ├ DamageCalc.ts         # ダメージ計算
  ├ BattleState.ts        # HP/MP/バフデバフ
  └ BattleGame.ts         # IMiniGame 実装
```

**VM 内実行と MiniGame 実行の使い分け:**
- 薄味（数ターン、演出最小）→ VM 内で直接実行
- UI あり（スキル選択、ターゲット選択）→ MiniGame として独立

### 6.2 Shooter Core（STG）

```
engine-systems/shooter/
  ├ ShooterGame.ts        # IMiniGame 実装
  ├ Player.ts             # 自機
  ├ EnemyManager.ts       # 敵管理 + Wave/Spawn
  ├ BulletPool.ts         # 弾 Object Pool
  ├ Collision.ts          # 当たり判定（円 / AABB）
  └ StageData.ts          # ステージ定義
```

**必須最適化:**
- SpriteBatch で弾描画
- Object Pool で GC 回避
- 固定ステップで判定安定

### 6.3 Puzzle Core（将来）

```
engine-systems/puzzle/
  ├ PuzzleGame.ts         # IMiniGame 実装
  ├ Board.ts              # 盤面管理
  └ Rules.ts              # マッチ判定等
```

## 7. Platform Layer 設計

### 7.1 PixiJS アダプタ（Web 用）

```
platform-pixi/
  ├ PixiRenderer.ts       # IRenderer 実装
  │   - Sprite → PIXI.Sprite
  │   - Text → PIXI.Text
  │   - Batch → PIXI.ParticleContainer
  ├ PixiAudio.ts          # IAudio 実装（Web Audio API）
  ├ PixiInput.ts          # IInput 実装（DOM Events）
  ├ WebStorage.ts         # IStorage 実装（IndexedDB）
  └ FetchHttp.ts          # IHttp 実装（fetch API）
```

### 7.2 SDL2 アダプタ（将来・Native 用）

```
platform-sdl2/
  ├ SDL2Renderer.ts       # IRenderer 実装
  │   - Sprite → SDL_Texture + SDL_RenderCopy
  │   - Batch → 自前配列 + まとめ描画
  ├ SDL2Audio.ts          # IAudio 実装（SDL_mixer）
  ├ SDL2Input.ts          # IInput 実装（SDL_Event）
  └ NativeStorage.ts      # IStorage 実装（ファイルシステム）
```

## 8. 既存資産との統合方針

### 8.1 段階的移行（壊さない順）

| 順番 | 対象 | 内容 | 既存への影響 |
|------|------|------|-------------|
| 1 | Assets | ID 参照に統一（パス直指定廃止） | 低（マッピング追加のみ） |
| 2 | Input | Action 化（ok/cancel/skip/auto/log） | 低（キーバインド表導入） |
| 3 | Timing | wait/tween を Engine Scheduler に寄せる | 中（演出コード書き換え） |
| 4 | Renderer | Pixi 直叩きを IRenderer ラッパ経由に | 中（段階的に置換） |
| 5 | Mode 統一 | NovelGameAdapter 追加 | 低（薄いラッパ追加のみ） |

### 8.2 既存 KSC コンパイラとの関係

```
[現在の KSC パイプライン]
KSC Source → Lexer → Parser → AST（Phase 1 完了）
                        ↓
                  Phase 1.5（パーサー補完）
                  - await 式追加
                  - continue 文追加
                  - トレーリングカンマ対応
                  - 未終端コメントエラー
                        ↓
                  Type Checker（Phase 2）
                        ↓
                  IR Emitter（Phase 3）
                        ↓
                  IRModule
                        ↓
                  Stack-based VM（Phase 4）
                        ↓
                  VMBuiltins 呼び出し
                        ↓
                  Engine Core
```

### 8.3 既存ノベルエンジンとの共存

```
[Path A: 既存 KS パス（維持）]
.ks → Compiler → Op[] → OpRunner → IEngineAPI

[Path B: 新 KSC パス（開発中）]
.ksc → Lexer → Parser → AST → TypeChecker → IR → VM → VMBuiltins → Engine Core

両パスは Engine Core を共有する。
MiniGame API はどちらのパスからも利用可能。
```

## 9. 実装ルール

### 9.1 絶対守るルール

1. **VM は VMBuiltins のみに依存する**（Pixi / DOM 型を import しない）
2. **非同期完了コールバック内でゲーム状態を変更しない**（EventQueue 経由で次フレーム適用）
3. **Engine Tick 順序は applyEvents → update → render で固定**
4. **Asset 参照は ID ベース**（パス直書き禁止）
5. **Input は Action ベース**（キーコード直指定禁止）

### 9.2 テスト方針

| 対象 | テスト方法 |
|------|-----------|
| ksc-compiler (Lexer/Parser) | 単体テスト（vitest）— 110 テスト合格済み + Phase 1.5 で 8 件追加予定 |
| ksc-compiler (TypeChecker/IR) | 単体テスト（vitest） |
| ksc-vm | 単体テスト + IR スナップショットテスト |
| engine-core | インターフェースのモック実装でテスト |
| platform-pixi | ブラウザ統合テスト（Playwright） |
| engine-systems | 各ゲームシステムの単体テスト |

---

## 関連文書

- [03 TS-VM 2D Engine 仕様書](./03-ts-vm-2d-engine-spec.md) — 本設計書の仕様元
- [05 KSC Compiler 改善点](./05-ksc-compiler-improvements.md) — IR/AST の改善（await, SET_INDEX 等）
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — IAssets/IInput/IHttp の移植課題
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — IR に CALL_METHOD 追加、Value 型導入等
