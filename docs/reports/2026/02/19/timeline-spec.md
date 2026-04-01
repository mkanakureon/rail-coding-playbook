# タイムライン演出システム仕様書（作成途中）

シーカブル（任意時刻で同一結果を再現可能）なキーフレームベースのアニメーション評価エンジンと、
テキスト・音声・フラグ等の時刻トリガーイベントシステムの仕様書です。

## 概要

タイムラインシステムは2つのレイヤーで構成されます。

| レイヤー | 役割 | パッケージ |
|---------|------|-----------|
| **Tween 評価** | 数値プロパティのキーフレーム補間（カメラ移動、エンティティ座標、透明度等） | `@kaedevn/core` timeline |
| **イベント発火** | 非数値の時刻トリガーイベント（テキスト表示、効果音、BGM、フラグ設定） | `@kaedevn/core` events |

```
TimelineRoot (Tween)          EventProject (Event)
  │                              │
  ├─ Track (camera)              ├─ EventTrack (text)
  │   └─ Clip                    │   └─ ShowTextEvent
  │       └─ Channel             │
  │           └─ Keyframe        ├─ EventTrack (audio)
  │                              │   ├─ SfxEvent
  ├─ Track (entity)              │   ├─ PlayBgmEvent
  │   └─ Clip                    │   └─ StopBgmEvent
  │       └─ Channel             │
  │           └─ Keyframe        ├─ EventTrack (logic)
  │                              │   └─ SetFlagEvent
  └─ Track (audio)               │
                                 └─ EventTrack (marker)
                                     └─ MarkerEvent
```

## Tween タイムライン

### データモデル（v1.1）

#### TimelineRoot

```typescript
interface TimelineRoot {
  schemaVersion: 1;
  durationMs: number;    // タイムライン全体の長さ（ミリ秒）
  tracks: Track[];
}
```

#### Track

4種類のトラックがあり、`kind` で判別します。

| kind | targetId | 用途 |
|------|----------|------|
| `camera` | `"camera"`（固定） | カメラのパン・ズーム・回転 |
| `entity` | エンティティID | キャラクター・背景の座標・透明度 |
| `audio` | オーディオソースID | 音量・パン |
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

#### Clip

時間範囲を持つアニメーション単位です。同一トラック内でクリップが重複してはいけません。

```typescript
interface Clip {
  id: string;
  startMs: number;     // 開始時刻（含む）
  endMs: number;       // 終了時刻（含まない）= 半開区間 [start, end)
  fillMode?: FillMode; // デフォルト: "hold"
  channels: Channel[];
}
```

**FillMode（クリップ範囲外の挙動）:**

| FillMode | 説明 |
|----------|------|
| `hold` | クリップ終了後も最終値を保持（デフォルト） |
| `none` | クリップ外では値を変更しない |
| `reset` | クリップ終了後は `defaultValue` に戻す |

#### Channel

プロパティごとのキーフレーム列です。

```typescript
interface Channel {
  property: string;      // "x", "y", "scaleX", "alpha" 等
  defaultValue: number;  // 初期値（fillMode: reset で使用）
  keyframes: Keyframe[];
}
```

#### Keyframe

```typescript
interface Keyframe {
  tMs?: number;          // v1 互換（非推奨）
  clipOffsetMs?: number; // v1.1 推奨（clip 開始からの相対時間）
  value: number;
  easing?: Easing;       // 次のキーフレームへの補間方法（デフォルト: "linear"）
}
```

両方指定された場合は `clipOffsetMs` を優先。

### イージング関数

10種類のイージングをサポートします。すべて `[0,1] → [0,1]` の変換関数です。

| Easing | 説明 |
|--------|------|
| `linear` | 等速（デフォルト） |
| `easeIn` | 加速（= `easeInCubic`） |
| `easeOut` | 減速（= `easeOutCubic`） |
| `easeInOut` | 加速→減速（= `easeInOutCubic`） |
| `easeInQuad` | 二次加速 |
| `easeOutQuad` | 二次減速 |
| `easeInOutQuad` | 二次加速→減速 |
| `easeInCubic` | 三次加速 |
| `easeOutCubic` | 三次減速 |
| `easeInOutCubic` | 三次加速→減速 |

### 評価アルゴリズム

`evaluateTimeline(timeline, currentTimeMs)` → `EvaluationResult[]`

1. 有効なトラックのみ処理（`enabled: true`）
2. 各トラックで `currentTimeMs` にアクティブなクリップを検索（半開区間 `[startMs, endMs)`）
3. アクティブなクリップがない場合 → `fillMode` に従って処理
4. アクティブなクリップ内の各チャンネルで:
   - キーフレームを時刻順にソート
   - `localMs = currentTimeMs - clip.startMs` を計算
   - 前後のキーフレーム間で `lerp(a, b, applyEasing(progress, easing))` で補間
   - 範囲外はクランプ（最初/最後のキーフレーム値を使用）
5. トラックごとに `EvaluationResult` を返す

```typescript
interface EvaluationResult {
  trackId: string;
  targetId: string | null;
  properties: Record<string, number>;  // { x: 100, y: 200, alpha: 0.5 }
}
```

**設計原則:** 同じ `currentTimeMs` を渡せば常に同じ結果が返る（シーカブル）。

### バリデーション

`validateTimeline(timeline)` → `{ valid: boolean, errors: ValidationError[] }`

検証項目:
- `schemaVersion === 1`
- `durationMs > 0`
- トラック種別の妥当性、`targetId` の整合性
- 同一トラック内のクリップ重複検出
- クリップの時間範囲（`startMs < endMs`）
- キーフレームの時刻がクリップ範囲内
- イージング値・FillMode の妥当性

## イベントタイムライン

数値補間ではなく、特定時刻に発火するイベントを管理するシステムです。

### EventProject

```typescript
interface EventProject {
  schemaVersion: 1;
  durationMs: number;
  eventTracks: EventTrack[];
}
```

### EventTrack

| kind | 用途 |
|------|------|
| `text` | テキスト表示 |
| `audio` | 効果音・BGM |
| `logic` | フラグ設定 |
| `marker` | マーカー（ラベル） |

### イベント型

| イベント型 | kind | フィールド |
|-----------|------|-----------|
| `SHOW_TEXT` | text | `speaker?`, `text`, `appendToBacklog?` |
| `SFX` | audio | `assetId`, `volume?` |
| `PLAY_BGM` | audio | `assetId`, `loop?`, `fadeInMs?`, `volume?` |
| `STOP_BGM` | audio | `fadeOutMs?` |
| `SET_FLAG` | logic | `key`, `value` |
| `MARK` | marker | `label` |

すべてのイベントは `tMs`（タイムライン絶対時刻）を持ちます。

### 主要関数

| 関数 | 説明 |
|------|------|
| `emitEventsBetween(project, tPrev, tNow)` | `(tPrev, tNow]` の範囲内のイベントを発火 |
| `seekStateAt(project, tNow, baseState)` | 指定時刻のランタイム状態を復元（BGM・フラグ） |
| `pickSeekOneShot(project, tNow)` | シーク時の最新テキストを取得 |
| `validateEventProject(project)` | イベントプロジェクトのバリデーション |

### RuntimeEventState

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
```

`seekStateAt` は全ステートフルイベントを時刻0から畳み込んで状態を復元します（シーカブル）。

## エンジン統合

### スクリプトからの呼び出し

KNF インタプリタでは `timeline("name")` コマンドで `IEngineAPI.playTimeline(name)` に委譲します。

```
// .ksc ファイル内
timeline("walk_home")
timeline("ending_true")
```

### 現在の実装状況

| コンポーネント | 状態 |
|--------------|------|
| コア型定義（v1.1） | 完了 |
| 評価エンジン | 完了 |
| イージング関数（10種） | 完了 |
| バリデータ | 完了 |
| イベントタイムライン | 完了 |
| コアテスト（評価・イージング・バリデーション・統合） | 完了 |
| Web タイムラインプレイヤー | v1.1 対応中（一時無効化） |
| WebEngine.playTimeline() | 未実装（スタブ） |
| タイムラインエディタ UI | 未実装 |

## JSON サンプル

### v1.1 形式

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

### シネマティックプリセット例

デモで実装済みの演出プリセット:

| プリセット名 | 演出内容 |
|------------|---------|
| dollyZoom | カメラのドリーズーム（前進しながらズームアウト） |
| dramaticCutIn | キャラクターのドラマティックなカットイン |
| cinematicPan | シネマティックなカメラパン |
| crossFade | クロスフェード切り替え |
| dutchAngle | オランダアングル（傾斜カメラ） |
| parallaxEffect | 視差効果（パララックス） |
| impactFreeze | インパクト時のフリーズ演出 |
| slowMotionEntrance | スローモーション登場 |
