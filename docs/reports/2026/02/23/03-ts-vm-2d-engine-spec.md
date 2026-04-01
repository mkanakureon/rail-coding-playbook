# TS-VM 2D Engine 仕様書

## 1. 概要

TS-VM 2D Engine は **スクリプト VM + 軽量 2D ランタイム + 抽象プラットフォーム層** で構成されるクロスプラットフォーム対応 2D ゲームエンジンである。

**目的**: 小〜中規模 2D ゲームを高速・安全・再現性高く開発する

**設計思想**: VM 主導型（スクリプトが世界を進行させる）

- 一般的なゲームエンジン: Update loop 主導
- 本エンジン: VM 主導 → スクリプトが `wait(1.0)` と書くだけで処理が停止する

**一文要約**: 「ゲーム進行を完全制御できる軽量 2D エンジン」

## 2. 対応ジャンル

### 標準対応（設計上ネイティブ対応済み）

| ジャンル | 備考 |
|---------|------|
| ノベルゲーム | 主要ターゲット |
| RPG（コマンドバトル） | 薄味〜中程度 |
| STG（弾幕含む） | SpriteBatch 活用 |
| パズル | 落ち物・マッチ 3・スライド等 |
| カードゲーム | コマンドバトルロジック流用可能 |
| 放置ゲーム | UI のみで成立 |
| ミニゲーム集 | MiniGame API で統一管理 |

### 条件付き対応（追加実装で可能）

- 横スクロールアクション
- リズムゲーム（音同期に注意）
- ローグライト（軽量版）

### 非対応（設計外）

- 3D ゲーム
- 物理演算主体ゲーム
- MMO / 大規模 AI シミュレーション
- AAA タイトル

## 3. アーキテクチャ

### 3.1 全体構造

```
[ Game Content ]
  Script (TS風) / Data (JSON) / Assets (PNG, Audio, Font)
          |
          v
+------------------------------+
|  VM Runtime (KSC Compiler)   |
|  - Lexer / Parser / AST      |
|  - Type Checker               |
|  - IR Emitter                 |
|  - Stack-based VM Executor    |
|  - Host API Builtins          |
+------------------------------+
          |
          | calls (Host API = VMBuiltins)
          v
+------------------------------+
|  Engine Core                  |
|  - Scene / Node / Transform   |
|  - Game Loop / Timing         |
|  - Input (Action-based)       |
|  - Audio (BGM/SE)             |
|  - Assets (ID-based)          |
|  - UI (minimal)               |
|  - MiniGame Host              |
|  - Event Queue                |
+------------------------------+
          |
          | uses (Platform Adapters)
          v
+------------------------------+
|  Platform Layer (差し替え)     |
|  - Renderer: PixiJS / SDL2    |
|  - Audio: WebAudio / SDL_mixer|
|  - Input: DOM / SDL           |
|  - Storage: IndexedDB / FS    |
+------------------------------+
```

### 3.2 レイヤ責務

| レイヤ | 責務 | 依存方向 |
|--------|------|----------|
| VM | ゲーム進行。スクリプト実行、変数管理、await による停止 | VMBuiltins のみに依存 |
| Engine Core | 状態管理。Scene/Node/Timing/Input/Audio/Assets/MiniGame | Platform Layer に依存 |
| Platform Layer | OS 差吸収。Renderer/Audio/Input/Storage の実装 | 外部ライブラリ（Pixi/SDL2）に依存 |

### 3.3 データフロー

**VM が持つもの:**
- 実行中のスタック / 環境 / コルーチン状態
- スクリプト変数（ゲーム進行フラグ、会話状態、バトル状態）
- await 相当の停止機構

**VM が持たないもの（重要）:**
- Sprite 実体、GPU リソース、入力デバイス状態の生値
- → Engine 側が保持し、VM は API 経由で操作するのみ

**Engine Core が持つもの:**
- SceneGraph（Node ツリー）と Component 状態
- ロード済みリソースのキャッシュ
- Input の Action 状態（押下中 / 押した瞬間）
- Audio の再生状態
- MiniGame の実行状態

## 4. KSC 言語仕様

### 4.1 概要

KSC（Kaede Visual Novel Script Compiler）は TS 風の構文を持つ静的型付けスクリプト言語。VM 上で実行され、`await` による停止・再開が言語レベルで保証される。

### 4.2 await 式（VM 主導型の根幹）

KSC の最大の特徴。`await` でスクリプト実行を一時停止し、Promise 完了で自動再開する。

```typescript
await wait(1.0);                          // 秒数待機
await preload(["bg.city.night"]);         // アセット読み込み待ち
await minigameWait(handle);               // ミニゲーム終了待ち
await tween(nodeId, { x: 100 }, { durationSec: 0.5 }); // アニメ完了待ち
const data = await httpGet("...");        // HTTP レスポンス待ち
```

**VM 内部動作**: `await` は IR レベルで `AWAIT` オペコードに変換される。VM はここでスタックフレームを保存して実行を停止し、非同期処理の完了通知で再開する。コルーチンやスレッドは不要。

### 4.3 型システム

| 型 | 記法 | 例 |
|----|------|-----|
| プリミティブ | `number`, `string`, `boolean`, `void` | `let x: number = 0;` |
| 配列 | `T[]` | `let items: string[] = [];` |
| オブジェクト | `{ key: T }` | `let pos: { x: number; y: number };` |
| ユニオン | `A \| B` | `let v: number \| null = null;` |
| 名前付き | `TypeName` / `Mod.Type` | `let s: Battle.State;` |
| リテラル | `"win"`, `42`, `true` | `type Outcome = "win" \| "lose";` |

### 4.4 制御構文

```typescript
// 条件分岐
if (cond) { ... } else if (cond2) { ... } else { ... }

// ループ（break / continue 対応）
for (let i = 0; i < n; i += 1) { ... }
while (cond) { ... }

// continue（ループ先頭に戻る）
for (let i = 0; i < enemies.length; i += 1) {
  if (enemies[i].dead) continue;
  enemies[i].update(dt);
}

// switch
switch (val) {
  case "a": { ... break; }
  default: { ... }
}
```

### 4.5 関数

```typescript
function attack(target: Enemy, power: number): number {
  const damage = power - target.defense;
  return damage;
}
```

**アロー関数**（Phase 3 以降で実装予定）:

```typescript
const doubled = items.map((x: number) => x * 2);
```

### 4.6 テンプレート文字列

`${expr}` 内の式をパースし、文字列と式の交互リストに変換する。

```typescript
const msg = `HP: ${player.hp} / ${player.maxHp}`;
#narrator `${hero.name}は剣を構えた`
```

**内部表現**: `parts: ["HP: ", player.hp, " / ", player.maxHp]`（文字列リテラルと式の交互配列）

> テンプレート文字列の式展開は Phase 3 以降で実装予定。現在は raw 文字列として扱われる。

### 4.7 ダイアログブロック（KSC 固有構文）

ノベルゲーム向けの一級構文。`#speaker "テキスト"` 形式。

```typescript
#narrator "ここは静かな森の中だった。"
#hero "行こう。"
#narrator `${hero.name}は剣を構えた`
```

### 4.8 演算子

| カテゴリ | 演算子 |
|---------|--------|
| 算術 | `+` `-` `*` `/` `%` |
| 比較 | `==` `!=` `<` `>` `<=` `>=` |
| 論理 | `&&` `\|\|` `!` |
| 代入 | `=` `+=` `-=` `*=` `/=` `%=` |
| 三項 | `cond ? a : b` |
| メンバ | `.` `[]` |
| 呼び出し | `fn(args)` |
| 待機 | `await expr` |

## 5. コア機能仕様

### 5.1 シーン管理（Scene / Node）

- Node ベース構造（transform: x, y, rotation, scale, alpha, visible, z）
- 親子関係（Scene Graph）
- 破棄 / 生成（ID 管理）

### 5.2 描画（Renderer 抽象）

| 機能 | 説明 |
|------|------|
| `createSprite(textureId, opts)` | スプライト生成 |
| `createText(text, opts)` | テキスト生成 |
| `setPos / setRotation / setScale / setAlpha / setVisible / setZ` | トランスフォーム操作 |
| `setText(nodeId, text)` | テキスト更新 |
| `setParent(child, parent)` | 親子関係設定 |
| `destroyNode(nodeId)` | ノード破棄 |
| `createSpriteBatch(textureId, opts)` | バッチ生成（弾幕用） |
| `batchSet(batchId, index, item)` | バッチ要素設定 |
| `batchCommit(batchId, count)` | バッチ確定 |

**SpriteBatch**: 弾幕 STG に必須。同一テクスチャを大量描画するための最適化機構。PixiJS では ParticleContainer、SDL2 では自前配列 + まとめ描画に対応。

### 5.3 入力（Action ベース）

キーコード直指定を廃止し、Action に統一。Switch 移植時の入力差分をゼロにする。

**アクション一覧:**
```
ok, cancel, menu, skip, auto, log,
up, down, left, right,
shot, bomb, pause
```

**API:**
```
isDown(action)        // 押下中
wasPressed(action)    // 押した瞬間（エッジ検出）
wasReleased(action)   // 離した瞬間
axis(name)            // アナログ軸（-1..1）
setMode(mode)         // 入力モード切替（novel / minigame）
bind(mode, bindings)  // キーバインド設定
```

**入力競合対策**: モードごとに InputManager を分離する。MiniGame 起動時は `setMode("minigame")` でノベル側への入力流入を防ぐ。

### 5.4 時間制御（Timing / Scheduler）

| 機能 | 説明 |
|------|------|
| `waitSeconds(sec)` | 秒数待機（await 可能） |
| `waitFrames(frames)` | フレーム数待機 |
| `tweenNode(nodeId, props, spec)` | Tween アニメーション（await 可能） |
| 固定ステップ更新 | `fixedDelta = 1/60` を accumulator 方式で実行 |

**固定ステップ**: ブラウザ（可変 fps）でも Switch（安定 60fps）でも挙動が一致。STG では必須。

### 5.5 サウンド（Audio）

```
playBGM(id, opts)     // BGM 再生（loop, volume）
stopBGM()             // BGM 停止
playSE(id, opts)      // SE 再生（volume）
setMasterVolume(v)    // マスター音量（0..1）
```

音量カテゴリ: BGM / SE

### 5.6 アセット管理（Assets）

**すべて ID 参照方式**（パス直書き禁止）

```
"bg.city.night"    // 背景
"se.hit"           // 効果音
"spr.hero.idle"    // スプライト
```

**利点:**
- ファイル配置非依存
- ビルド時再配置可能
- CDN 対応
- プラットフォーム差吸収

**API:**
```
preload(ids)          // 非同期プリロード
has(id)               // ロード済み確認
texture(id)           // テクスチャ取得
sound(id)             // サウンド取得
manifest()            // マニフェスト一覧
```

### 5.7 KV ストア（Save 用最小永続化）

```
get(key)              // 値取得
set(key, value)       // 値保存（JSON 互換）
remove(key)           // 削除
clear()               // 全削除
```

### 5.8 MiniGame システム

エンジン内で別ゲーム（STG / パズル / バトル等）を実行する統合機構。

**ライフサイクル:**
```
init(ctx, spec)       // 初期化（1回）
enter()               // 表示開始
update(dtSec)         // 毎フレーム更新
render()              // 描画（任意、SDL2 向け）
pause() / resume()    // 一時停止 / 復帰
exit()                // 終了処理
status()              // running | finished | aborted
result()              // 結果オブジェクト
```

**Host API（VM から呼び出す）:**
```
minigameStart(spec)   // 起動 → handle 返却
minigameWait(handle)  // VM 停止、完了まで待機
minigameResult(handle)// 結果取得（JSON）
```

**スクリプトからの呼び出しイメージ:**
```
@minigame start type="shooter" id="stage1"
@minigame wait
@minigame result var=score
```

**結果フォーマット（JSON）:**
```json
{
  "outcome": "win",
  "score": 12345,
  "timeSec": 58.3,
  "data": { "noMiss": true, "items": ["potion_small"] }
}
```

**ゲームモードの統一**: ノベルも `IMiniGame` と同じインターフェースで扱う（`NovelGameAdapter`）。これにより STG → ノベル復帰が設計として自然に成立する。

### 5.9 乱数（Deterministic Random）

```
seed(seed)            // シード設定
next()                // 0..1
int(min, maxInclusive)// 整数乱数
```

シード固定でリプレイ・デバッグが容易。

## 6. 非同期 I/O モデル

### 6.1 基本原則

| ルール | 内容 |
|--------|------|
| 非同期 OK | HTTP 通信、ファイル読み込み、画像/音声デコード、JSON 解析、圧縮展開 |
| 非同期 NG | Scene 変更、Node 生成/削除、Renderer 操作、VM 変数変更 |

**理由**: ゲーム状態の決定順序を固定し、再現性を保証するため。

### 6.2 処理フロー

```
非同期処理（I/O）
    ↓
結果取得
    ↓
イベントキュー登録（enqueue）
    ↓
次フレーム先頭で適用（drain → apply）
```

### 6.3 Engine Tick 順序（保証仕様）

```typescript
tick(dt):
    applyEvents()   // キュー処理
    update(dt)       // ゲーム更新
    render()         // 描画
```

この順序は固定。変更不可。

### 6.4 追加 API

**IHttp（ネットワーク）:**
```
getJson(url, opts)    // JSON 取得
postJson(url, body, opts) // JSON 送信
getText(url, opts)    // テキスト取得（任意）
getBytes(url, opts)   // バイナリ取得（任意）
```

**IStorage（永続化抽象）:**
```
readText(id)          // テキスト読み込み
readBytes(id)         // バイナリ読み込み
writeText(id, text)   // テキスト書き込み
writeBytes(id, bytes) // バイナリ書き込み
exists(id)            // 存在確認
remove(id)            // 削除
```

- Web: IndexedDB / Cache Storage / File System Access API
- Native (Switch): ファイルシステム

**IEventQueue:**
```
enqueue(ev)           // イベント追加
drain()               // 全イベント取得＆キュークリア
```

## 7. スレッドモデル

### 7.1 方針

**コアは完全シングルスレッド。重い I/O だけ非同期ワーカーに逃がす。**

```
Main Thread
 ├ VM
 ├ Engine
 ├ Render
 └ Input

Async Workers
 ├ HTTP
 ├ File I/O
 ├ Image/Audio Decode
 └ Heavy AI (将来)
```

### 7.2 シングルスレッドの理由

- 再現性保証（VM が進行を制御する構造と相性が良い）
- デバッグ容易（状態競合・再現不能バグが発生しない）
- VM 制御安定（wait / 入力同期がズレない）

### 7.3 シングルスレッドで成立する規模

| 要素 | 安全ライン | 注意ライン |
|------|-----------|-----------|
| 弾数 | ～2,000 | 5,000 以上 |
| 敵数 | ～200 | 200 以上同時 |
| UI 要素 | 数千 | - |
| パーティクル | 数千 | - |

一般的なインディー 2D ゲームは全て安全ライン内。

### 7.4 必須パフォーマンス最適化

| 最適化 | 対象 | 理由 |
|--------|------|------|
| Object Pool | 弾、エフェクト、敵 | GC 発生防止 |
| Batch 描画 | 同一テクスチャ群 | draw call 削減 |
| 固定ステップ更新 | STG / アクション | 挙動安定 + CPU 効率 |
| 配列ループ最適化 | ホットパス | `for-of` / `map` / `filter` / クロージャ禁止 |

## 8. VM ↔ Engine 境界 API（VMBuiltins）

VM はこの API **のみ** を叩く。Pixi / DOM 型を直接参照してはならない。

### 8.1 Scene 操作

```
spawnSprite(textureId, opts) → NodeId
spawnText(text, opts) → NodeId
setNode(nodeId, props)        // Transform 部分更新
setText(nodeId, text)
destroy(nodeId)
```

### 8.2 時間・待機

```
wait(sec)                     // await 可能
waitFrames(frames)            // await 可能
tween(nodeId, props, spec)    // await 可能
```

### 8.3 入力

```
isDown(action)
wasPressed(action)
axis(name)
```

生キーコードは VM に出さない（Switch で動かなくなる）。

### 8.4 オーディオ

```
playSE(id, opts)
playBGM(id, opts)
stopBGM()
```

### 8.5 アセット

```
preload(ids)                  // await 可能
```

### 8.6 KV

```
kvGet(key)
kvSet(key, value)
```

### 8.7 MiniGame

```
minigameStart(spec) → handle  // await 可能
minigameWait(handle)          // await 可能、VM 停止
minigameResult(handle) → json
```

### 8.8 I/O（拡張）

```
httpGet(url)                  // await 可能
httpPost(url, body)           // await 可能
fileReadText(id)              // await 可能
fileWriteText(id, text)       // await 可能
```

## 9. プラットフォーム移植戦略

### 9.1 差し替え対象

| インターフェース | Web (現在) | Native (将来) |
|----------------|------------|---------------|
| IRenderer | PixiJS (Sprite / Container / ParticleContainer) | SDL2 (Texture / Rect 描画 + 自前バッチ) |
| IAudio | Web Audio API | SDL_mixer |
| IInput | DOM Events (keyboard / pointer / gamepad) | SDL Events |
| IStorage | IndexedDB / localStorage | ファイルシステム |

### 9.2 移植時に変更するもの・しないもの

- **変更しない**: VM、Engine Core、ゲームロジック、スクリプト
- **変更する**: Platform Layer の各アダプタ実装のみ

### 9.3 移植の障害を避けるルール

1. スクリプト実行を動的 eval に依存しない（独自 VM/IR で正解）
2. Asset 参照は ID ベース（パス直書き禁止）
3. 入力は Action 固定（キーコード直指定禁止）
4. Renderer は Sprite + Batch + Text まで（シェーダ等は後回し）

## 10. 現在の実装状況

`packages/ksc-compiler/` に KSC コンパイラの Phase 0〜1 が完了。Phase 1.5（パーサー補完）で改善予定。

### 10.1 モジュール別ステータス

| モジュール | 状態 | 概要 |
|-----------|------|------|
| Token 型定義 | 完了 | 73 種類の TokenType、キーワードマッピング |
| AST 型定義 | 完了 | Expression 14 種、Statement 14 種、TypeAnnotation 5 種 |
| IR 型定義 | 完了 | OpCode enum（スタック / 算術 / 比較 / 論理 / 制御 / オブジェクト / ホスト API） |
| レキサー | 完了 | 258 行、45 テスト合格 |
| パーサー | 完了 | 695 行、65 テスト合格 |
| 型チェッカー | 未着手 | Phase 2 |
| IR エミッター | 未着手 | Phase 3 |
| スタックベース VM | 未着手 | Phase 4 |
| Engine Core | 未着手 | 本仕様書の対象 |
| Platform Layer (Pixi) | 部分的 | 既存ノベルエンジンに IEngineAPI 実装あり |

**テスト合計**: 110 / 110 合格

### 10.2 実装ロードマップ

```
Phase 0〜1（完了）
  └ 型定義・レキサー・パーサー

Phase 1.5（パーサー補完）← 次に実施
  ├ await キーワード・式の追加        ← VM 主導型の根幹
  ├ continue 文の追加
  ├ 未終端ブロックコメントのエラー検出
  ├ トレーリングカンマ対応
  └ デッドコード（Ternary トークン）削除

Phase 2（型チェッカー）
  ├ 型チェッカー本体
  ├ IR に AWAIT / HOST_CALL_ASYNC オペコード追加
  ├ IR に SET_INDEX オペコード追加
  ├ sourceMap のシリアライズ対応（Map → Array）
  └ %= 複合代入の追加

Phase 3（IR エミッター）
  ├ IR エミッター本体
  ├ テンプレート文字列の式展開（レキサー改修含む）
  ├ アロー関数式
  ├ 定数畳み込み（負の数値リテラル最適化）
  └ VMState.locals の型統一

Phase 4（VM 実行器）
  └ Stack-based VM + Host API 呼び出し

Phase 5〜（Engine 統合）
  ├ Engine Core（Scene / Timing / Input / Audio / Assets / MiniGame Host）
  └ Platform Layer（PixiJS アダプタ）
```

## 11. 意図的制約

これらは欠点ではなく設計思想による制約。

| 制約 | 理由 |
|------|------|
| 高度描画非対応（シェーダ / ポストプロセス） | 移植性維持 |
| 物理エンジン非搭載 | 軽量維持 |
| UI レイアウト最小（固定座標ベース） | 構造単純化 |
| マルチスレッド非対応 | 再現性維持・VM 制御安定 |
| 大規模ゲーム非対応 | 小〜中規模高速開発が目的 |

---

## 関連文書

- [04 TS-VM 2D Engine 設計書](./04-ts-vm-2d-engine-design.md) — 本仕様書の実装設計
- [05 KSC Compiler 改善点](./05-ksc-compiler-improvements.md) — コンパイラの Phase 1.5〜改善
- [06 Switch 移植性ギャップ分析](./06-switch-portability-gap.md) — 仕様書の移植前提と実装の乖離
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — VM/IR 型定義のクラス対応準備
