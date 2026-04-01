# JSON 中間表現（Op 命令セット）仕様書

KS スクリプトをコンパイルした結果生成される **Op 命令セット**（中間表現 / IR）の仕様書です。
ランタイム（インタプリタ）はこの Op 命令列を逐次実行してゲームを進行させます。

## 概要

- KS スクリプトは直接実行されず、必ず Op 命令列（JSON 配列）に変換されます
- 各 Op は `op` フィールドで種別を識別します
- コンパイル済みシナリオは `CompiledScenario` 型として管理されます

## CompiledScenario 構造

```typescript
interface CompiledScenario {
  id: string;    // シナリオID
  ops: Op[];     // Op 命令の配列
}
```

## Op 型一覧

### テキスト表示

| Op | フィールド | 説明 |
|----|-----------|------|
| `TEXT_APPEND` | `who?: string`, `text: string` | テキストを追記表示。`who` でキャラ名指定 |
| `TEXT_NL` | ― | 改行 |

### フロー制御

| Op | フィールド | 説明 |
|----|-----------|------|
| `WAIT_CLICK` | ― | クリック待ち |
| `PAGE` | ― | ページ送り（テキストクリア） |
| `WAIT_MS` | `ms: number` | 指定ミリ秒待機 |

### 背景・キャラクター

| Op | フィールド | 説明 |
|----|-----------|------|
| `BG_SET` | `id: string`, `fadeMs?: number` | 背景画像を設定 |
| `CH_SET` | `name: string`, `pose: string`, `pos: "left"\|"center"\|"right"`, `fadeMs?: number` | キャラクターを表示 |
| `CH_HIDE` | `name: string`, `fadeMs?: number` | キャラクターを非表示 |
| `CH_CLEAR` | `fadeMs?: number` | 全キャラクターをクリア |
| `CH_ANIM` | `name: string`, `src: string`, `frames: number`, `fps: number`, `pos: "left"\|"center"\|"right"`, `loop?: boolean` | キャラクタースプライトアニメーション |

### オーディオ

| Op | フィールド | 説明 |
|----|-----------|------|
| `BGM_PLAY` | `id: string`, `vol?: number`, `fadeMs?: number` | BGM 再生 |
| `BGM_STOP` | `fadeMs?: number` | BGM 停止 |
| `SE_PLAY` | `id: string`, `vol?: number` | 効果音再生 |
| `VOICE_PLAY` | `id: string` | ボイス再生 |
| `WAIT_VOICE_END` | ― | ボイス再生完了待ち |

### 変数操作

| Op | フィールド | 説明 |
|----|-----------|------|
| `VAR_SET` | `name: string`, `value: number` | 変数に値を代入 |
| `VAR_ADD` | `name: string`, `value: number` | 変数に値を加算 |
| `VAR_SUB` | `name: string`, `value: number` | 変数から値を減算 |

### 選択肢・分岐

| Op | フィールド | 説明 |
|----|-----------|------|
| `CHOICE` | `options: Array<{ label: string, jump: number }>` | 選択肢を表示。各選択肢にジャンプ先（pc）を指定 |
| `JUMP` | `pc: number` | 指定した命令位置へジャンプ |
| `JUMP_IF` | `condition: string`, `pc: number` | 条件が真の場合に指定位置へジャンプ |

## Op 命令の例

### テキスト表示の例

KS:
```
【太郎】こんにちは！
```

Op:
```json
[
  { "op": "TEXT_APPEND", "who": "太郎", "text": "こんにちは！" },
  { "op": "WAIT_CLICK" }
]
```

### 背景とキャラクターの例

KS:
```
@bg classroom fade 500
@ch hanako smile center fade 300
```

Op:
```json
[
  { "op": "BG_SET", "id": "classroom", "fadeMs": 500 },
  { "op": "CH_SET", "name": "hanako", "pose": "smile", "pos": "center", "fadeMs": 300 }
]
```

### 選択肢の例

KS:
```
@choice_start
- はい
- いいえ
@choice_end
```

Op:
```json
[
  { "op": "CHOICE", "options": [
    { "label": "はい", "jump": 2 },
    { "label": "いいえ", "jump": 5 }
  ]}
]
```

## SaveData スキーマ

ゲームの状態を保存するための構造です。バージョン 1 で固定されています。

```typescript
interface SaveData {
  save_schema_version: 1;        // スキーマバージョン（固定）
  engine_version: string;        // エンジンバージョン
  work_id: string;               // 作品ID
  scenario_id: string;           // シナリオID
  node_id: string;               // 現在のノードID
  vars: Record<string, unknown>; // 変数の状態
  read: Record<string, unknown>; // 既読情報
  timestamp: number;             // 保存時刻（UNIX タイムスタンプ）
}
```

**設計方針:**

- 画像や音声データは埋め込まず、参照IDのみを保存
- 後方互換性は `save_schema_version` で管理
