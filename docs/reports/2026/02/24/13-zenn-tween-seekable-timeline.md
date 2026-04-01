---
title: "Tween ベースのシーク可能タイムラインシステムを実装した"
emoji: "🎬"
type: "tech"
topics: ["claudecode", "typescript", "アニメーション", "ゲーム開発"]
published: false
---

## はじめに

ビジュアルノベルエンジン kaedevn に、シーク可能（任意時刻で同一結果を再現可能）なキーフレームベースのアニメーション評価エンジンと、テキスト・音声・フラグの時刻トリガーイベントシステムを実装した。

カメラワーク、キャラクターの移動、フェードイン/アウトといった演出を JSON で定義し、プログラム上で任意の時刻にシークしても常に正しい状態が得られる。この「シーカブル」という性質がこのシステムの核心だ。

## 2 層アーキテクチャ

タイムラインシステムは 2 つのレイヤーで構成される。

| レイヤー | 役割 | パッケージ |
|---------|------|-----------|
| Tween 評価 | 数値プロパティのキーフレーム補間 | `@kaedevn/core` timeline |
| イベント発火 | 非数値の時刻トリガーイベント | `@kaedevn/core` events |

```
TimelineRoot (Tween)          EventProject (Event)
  |                              |
  +-- Track (camera)             +-- EventTrack (text)
  |   +-- Clip                   |   +-- ShowTextEvent
  |       +-- Channel            |
  |           +-- Keyframe       +-- EventTrack (audio)
  |                              |   +-- SfxEvent
  +-- Track (entity)             |   +-- PlayBgmEvent
  |   +-- Clip                   |   +-- StopBgmEvent
  |       +-- Channel            |
  |           +-- Keyframe       +-- EventTrack (logic)
  |                              |   +-- SetFlagEvent
  +-- Track (audio)              |
                                 +-- EventTrack (marker)
                                     +-- MarkerEvent
```

Tween レイヤーは座標や透明度の連続値を補間し、Event レイヤーはテキスト表示や BGM 再生といった離散イベントを管理する。

## Tween タイムライン: データモデル

### TimelineRoot

```typescript
interface TimelineRoot {
  schemaVersion: 1;
  durationMs: number;    // タイムライン全体の長さ（ミリ秒）
  tracks: Track[];
}
```

### Track

4 種類のトラックがあり、`kind` で判別する。

| kind | targetId | 用途 |
|------|----------|------|
| `camera` | `"camera"` | カメラのパン・ズーム・回転 |
| `entity` | エンティティID | キャラクター・背景の座標・透明度 |
| `audio` | オーディオID | 音量・パン |
| `event` | なし | イベントトリガー |

```typescript
interface BaseTrack {
  id: string;
  kind: TrackKind;
  order: number;      // 描画・評価順序
  enabled: boolean;    // false で評価スキップ
  clips: Clip[];
}
```

`enabled` フラグにより、エディタ上で特定のトラックを無効化してプレビューできる。

### Clip と Channel

Clip は時間範囲を持つアニメーション単位、Channel はプロパティごとのキーフレーム列だ。

```typescript
interface Clip {
  id: string;
  startMs: number;     // 開始時刻（含む）
  endMs: number;       // 終了時刻（含まない）= 半開区間 [start, end)
  fillMode?: FillMode;
  channels: Channel[];
}

interface Channel {
  property: string;      // "x", "y", "scaleX", "alpha" 等
  defaultValue: number;
  keyframes: Keyframe[];
}

interface Keyframe {
  tMs?: number;          // v1 互換（非推奨）
  clipOffsetMs?: number; // v1.1 推奨（clip 開始からの相対時間）
  value: number;
  easing?: Easing;
}
```

Clip の時間範囲は半開区間 `[startMs, endMs)` だ。これにより、連続する Clip の境界で値が重複しない。

### FillMode

FillMode はクリップ範囲外の挙動を制御する。

| FillMode | 説明 |
|----------|------|
| `hold` | クリップ終了後も最終値を保持（デフォルト） |
| `none` | クリップ外では値を変更しない |
| `reset` | クリップ終了後は `defaultValue` に戻す |

`hold` がデフォルトなのは、ノベルゲームでは「背景をフェードインしたらそのまま表示し続ける」のが普通だからだ。

## イージング関数

10 種類のイージングをサポートしている。すべて `[0,1] -> [0,1]` の変換関数だ。

```typescript
export function applyEasing(t: number, easing: Easing): number {
  switch (easing) {
    case "linear":
      return t;
    case "easeIn":
    case "easeInCubic":
      return t * t * t;
    case "easeOut":
    case "easeOutCubic":
      return 1 - Math.pow(1 - t, 3);
    case "easeInOut":
    case "easeInOutCubic":
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "easeInQuad":
      return t * t;
    case "easeOutQuad":
      return 1 - (1 - t) * (1 - t);
    case "easeInOutQuad":
      return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}
```

`easeIn` / `easeOut` / `easeInOut` はそれぞれ三次関数のエイリアスとしている。ほとんどの演出ではこの 3 つで事足りるが、微妙な動きの違いを求める場合に Quad（二次）も使える。

## 評価エンジン: シーカブルの実現

評価エンジンの核心は `evaluateTimeline` 関数だ。

```typescript
export function evaluateTimeline(
  timeline: TimelineRoot,
  currentTimeMs: number
): EvaluationResult[] {
  const results: EvaluationResult[] = [];

  for (const track of timeline.tracks) {
    if (!track.enabled) continue;

    const result = evaluateTrack(track, currentTimeMs);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
```

各トラックの評価フローは以下の通り。

1. 有効なトラックのみ処理（`enabled: true`）
2. `currentTimeMs` にアクティブなクリップを検索（半開区間 `[startMs, endMs)`）
3. アクティブなクリップがない場合は `fillMode` に従って処理
4. アクティブなクリップ内の各チャンネルでキーフレーム補間
5. トラックごとに `EvaluationResult` を返す

### キーフレーム補間

チャンネルの評価はキーフレーム間の線形補間（lerp）にイージングを適用する。

```typescript
function evaluateChannel(
  channel: Channel,
  clip: Clip,
  currentTimeMs: number
): number {
  const localMs = currentTimeMs - clip.startMs;
  const keyframes = channel.keyframes;

  // ソート済み前提
  // 範囲外はクランプ
  if (localMs <= getKeyframeTime(keyframes[0], clip)) {
    return keyframes[0].value;
  }
  if (localMs >= getKeyframeTime(keyframes[keyframes.length - 1], clip)) {
    return keyframes[keyframes.length - 1].value;
  }

  // 前後のキーフレームを検索
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf0 = keyframes[i];
    const kf1 = keyframes[i + 1];
    const t0 = getKeyframeTime(kf0, clip);
    const t1 = getKeyframeTime(kf1, clip);

    if (localMs >= t0 && localMs < t1) {
      const progress = (localMs - t0) / (t1 - t0);
      const eased = applyEasing(progress, getEffectiveEasing(kf0));
      return lerp(kf0.value, kf1.value, eased);
    }
  }

  return channel.defaultValue;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

**設計原則**: 同じ `currentTimeMs` を渡せば常に同じ結果が返る。これがシーカブルの保証だ。内部に状態を持たず、入力（timeline + 時刻）から出力（プロパティ値）を純粋に計算する。

## イベントタイムライン

数値補間ではなく、特定時刻に発火するイベントを管理するシステムだ。

### イベント型

```typescript
type TimelineEvent =
  | { kind: "SHOW_TEXT"; tMs: number; speaker?: string; text: string }
  | { kind: "SFX"; tMs: number; assetId: string; volume?: number }
  | { kind: "PLAY_BGM"; tMs: number; assetId: string; loop?: boolean; fadeInMs?: number }
  | { kind: "STOP_BGM"; tMs: number; fadeOutMs?: number }
  | { kind: "SET_FLAG"; tMs: number; key: string; value: unknown }
  | { kind: "MARK"; tMs: number; label: string };
```

### emitEventsBetween: 区間イベント発火

通常の再生時はフレームごとに前回時刻と現在時刻の間のイベントを発火する。

```typescript
function emitEventsBetween(
  project: EventProject,
  tPrev: number,
  tNow: number
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const track of project.eventTracks) {
    for (const event of track.events) {
      // 半開区間 (tPrev, tNow] のイベントを収集
      if (event.tMs > tPrev && event.tMs <= tNow) {
        events.push(event);
      }
    }
  }

  // 時刻順にソート
  events.sort((a, b) => a.tMs - b.tMs);
  return events;
}
```

半開区間 `(tPrev, tNow]` を使うことで、イベントの二重発火を防止している。

### seekStateAt: 状態復元（シーカブル）

シーク時は、指定時刻のランタイム状態を完全に復元する。

```typescript
interface RuntimeEventState {
  bgm: {
    playing: boolean;
    assetId?: string;
    loop?: boolean;
    volume?: number;
  };
  flags: Record<string, unknown>;
  text?: { speaker?: string; text: string };
}

function seekStateAt(
  project: EventProject,
  tNow: number,
  baseState: RuntimeEventState
): RuntimeEventState {
  let state = { ...baseState };

  // 全ステートフルイベントを時刻0から畳み込み
  for (const track of project.eventTracks) {
    for (const event of track.events) {
      if (event.tMs > tNow) break; // 未来のイベントは無視

      switch (event.kind) {
        case "PLAY_BGM":
          state.bgm = {
            playing: true,
            assetId: event.assetId,
            loop: event.loop,
            volume: event.volume,
          };
          break;
        case "STOP_BGM":
          state.bgm = { playing: false };
          break;
        case "SET_FLAG":
          state.flags[event.key] = event.value;
          break;
        case "SHOW_TEXT":
          state.text = { speaker: event.speaker, text: event.text };
          break;
      }
    }
  }

  return state;
}
```

「時刻 0 から畳み込み」というアプローチにより、どの時刻にシークしても正しい状態が得られる。パフォーマンスの観点では、長いタイムラインで頻繁にシークする場合にスナップショットキャッシュを導入する余地がある。

## JSON サンプル

実際の JSON 定義例を示す。カメラのパンとキャラクターのフェードインを同時に行う演出だ。

```json
{
  "schemaVersion": 1,
  "durationMs": 5000,
  "tracks": [
    {
      "id": "cam",
      "kind": "camera",
      "targetId": "camera",
      "order": 0,
      "enabled": true,
      "clips": [
        {
          "id": "cam-pan",
          "startMs": 0,
          "endMs": 3000,
          "fillMode": "hold",
          "channels": [
            {
              "property": "x",
              "defaultValue": 0,
              "keyframes": [
                { "clipOffsetMs": 0, "value": 0, "easing": "easeInOut" },
                { "clipOffsetMs": 3000, "value": 200 }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "hero",
      "kind": "entity",
      "targetId": "hero",
      "order": 1,
      "enabled": true,
      "clips": [
        {
          "id": "hero-enter",
          "startMs": 500,
          "endMs": 2500,
          "fillMode": "hold",
          "channels": [
            {
              "property": "alpha",
              "defaultValue": 0,
              "keyframes": [
                { "clipOffsetMs": 0, "value": 0, "easing": "easeOut" },
                { "clipOffsetMs": 1000, "value": 1 }
              ]
            },
            {
              "property": "x",
              "defaultValue": -100,
              "keyframes": [
                { "clipOffsetMs": 0, "value": -100, "easing": "easeOutCubic" },
                { "clipOffsetMs": 2000, "value": 640 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

この JSON だけで「カメラが 3 秒かけて右にパンしつつ、0.5 秒後にキャラクターが左からフェードインしながらスライドしてくる」という演出が定義できる。

## シネマティックプリセット

デモ実装では以下のプリセットを用意した。

| プリセット名 | 演出内容 |
|------------|---------|
| dollyZoom | カメラのドリーズーム |
| dramaticCutIn | キャラクターのドラマティックカットイン |
| cinematicPan | シネマティックなカメラパン |
| crossFade | クロスフェード切り替え |
| dutchAngle | オランダアングル（傾斜カメラ） |
| parallaxEffect | 視差効果 |
| impactFreeze | インパクト時のフリーズ演出 |
| slowMotionEntrance | スローモーション登場 |

各プリセットは TimelineRoot の JSON を生成する関数として実装している。

## バリデーション

`validateTimeline` で JSON の正当性を検証する。

```typescript
function validateTimeline(timeline: TimelineRoot): {
  valid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // スキーマバージョン
  if (timeline.schemaVersion !== 1) {
    errors.push({ message: `Invalid schemaVersion: ${timeline.schemaVersion}` });
  }

  // 全体長
  if (timeline.durationMs <= 0) {
    errors.push({ message: "durationMs must be > 0" });
  }

  for (const track of timeline.tracks) {
    // トラック種別の妥当性
    // targetId の整合性
    // クリップ重複検出
    // キーフレーム範囲チェック
    // イージング値の妥当性
  }

  return { valid: errors.length === 0, errors };
}
```

同一トラック内のクリップ重複検出は、クリップをソートして隣接するペアの区間が重なっていないかチェックする。

## テスト

| テストファイル | テスト数 | 対象 |
|---|---|---|
| `easing.test.ts` | 18 | 境界値・単調性 |
| `evaluator.test.ts` | 32 | fillMode・補間・v1.1 |
| `validator.test.ts` | 17 | スキーマ検証・クリップ重複 |
| `events.test.ts` | 27 | イベント発火・状態復元・重複排除 |
| **合計** | **94** | |

イージングのテストでは、全関数が `f(0) === 0` かつ `f(1) === 1` を満たすこと、および単調非減少であることを検証している。

## スクリプトからの呼び出し

KNF インタプリタでは `timeline("name")` コマンドでタイムライン再生を呼び出す。

```
// .ksc ファイル内
bg("classroom")
timeline("walk_home")
timeline("ending_true")
```

インタプリタ内部では `IEngineAPI.playTimeline(name)` に委譲される。

```typescript
case "timeline":
case "timeline_play":
  await this.engine.playTimeline(String(args[0]));
  return true;
```

## まとめ

純粋関数ベースの評価エンジンにより、同じ入力（timeline + 時刻）に対して常に同じ結果を返すシーカブルなタイムラインシステムが完成した。内部に状態を持たないため、テストが書きやすく、エディタ上でのスクラブ（タイムラインバーのドラッグ）にも自然に対応できる。

---

キーフレーム補間、イージング関数、FillMode、イベント発火と状態復元。アニメーションシステムの基本要素を、シーカブル（再現可能）という一貫した設計原則のもとで組み上げた。純粋関数による評価という選択が、テスタビリティとエディタ統合の両方に効いている。

　　　　　　　　　　Claude Opus 4.6
