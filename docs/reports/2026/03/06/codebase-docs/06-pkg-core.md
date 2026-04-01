# packages/core - 共有型定義・コア抽象化

## 概要

モノレポ全体の基盤パッケージ。Op 命令型、タイムライン型、プラットフォーム抽象化インターフェース（IInput, IAudio, IStorage）、セーブデータスキーマを定義する。他のすべてのパッケージが依存する最下層レイヤー。

## ディレクトリ構成

```
packages/core/
├── src/
│   ├── types/
│   │   ├── Op.ts               # ランタイム命令セット (108行)
│   │   ├── Action.ts           # 入力アクション enum
│   │   ├── SaveData.ts         # セーブデータスキーマ
│   │   ├── ViewState.ts        # 画面状態スナップショット
│   │   ├── BacklogEntry.ts     # バックログエントリ
│   │   └── ProjectConfig.ts    # プロジェクト設定
│   ├── interfaces/
│   │   ├── IInput.ts           # 入力 dispatch インターフェース
│   │   ├── IAudio.ts           # BGM/SE/VOICE 再生
│   │   └── IStorage.ts         # セーブ/ロード抽象化
│   ├── engine/
│   │   ├── IOpHandler.ts       # Op 実行インターフェース (210行)
│   │   └── OpRunner.ts         # Op 実行ループ
│   ├── registry/
│   │   └── commandDefinitions.ts # コマンド定義
│   ├── timeline/
│   │   ├── types.ts            # Timeline v1.1 スキーマ (182行)
│   │   ├── easing.ts           # イージング関数
│   │   ├── evaluator.ts        # タイムライン評価
│   │   ├── validator.ts        # タイムラインバリデーション
│   │   └── __tests__/          # テスト (4ファイル)
│   ├── events/
│   │   ├── types.ts            # イベントタイムライン型
│   │   ├── emitBetween.ts      # 範囲イベント発火
│   │   ├── seekStateAt.ts      # 状態シーク
│   │   ├── seekExtras.ts       # シーク拡張
│   │   └── validate.ts         # イベントバリデーション
│   ├── constants/
│   │   └── layout.ts           # 解像度定数 (1280x720)
│   └── index.ts                # 公開 API (99行)
├── test/
│   ├── SaveData.test.ts
│   ├── OpRunner.test.ts
│   └── commandSync.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 主要型定義

### Op 型 (types/Op.ts)

ランタイム命令の IR (Intermediate Representation)。コンパイラが .ks/.ksc を Op[] に変換し、OpRunner が実行する。

```typescript
// 主要 Op 型
type Op =
  | { type: 'TEXT_APPEND'; speaker?: string; body: string }
  | { type: 'BG_SET'; assetId: string; transition?: string }
  | { type: 'CH_SET'; characterId: string; expressionId: string; position: 'left'|'center'|'right' }
  | { type: 'CH_HIDE'; characterId: string }
  | { type: 'CH_CLEAR' }
  | { type: 'CHOICE'; options: ChoiceOption[] }
  | { type: 'JUMP'; target: string }
  | { type: 'VAR_SET'; name: string; op: '='|'+='|'-='; value: string|number }
  | { type: 'IF'; condition: string; then: Op[]; else?: Op[] }
  | { type: 'BGM_PLAY'; assetId: string; volume?: number }
  | { type: 'BGM_STOP' }
  | { type: 'SE_PLAY'; assetId: string }
  | { type: 'VOICE_PLAY'; assetId: string }
  | { type: 'WAIT'; mode: 'click'|'timeout'|'voiceend'; ms?: number }
  | { type: 'SHOW'; target: string; ... }
  | { type: 'HIDE'; target: string; ... }
  | { type: 'MOVE'; target: string; x: number; y: number; duration: number }
  | { type: 'FADE'; target: string; alpha: number; duration: number }
  | { type: 'OVL_SET'; assetId: string; ... }
  | { type: 'OVL_HIDE'; ... }
  | { type: 'SCREEN_FILTER'; filterType: string; ... }
  // ... 他
```

### Action enum (types/Action.ts)

```typescript
enum Action {
  OK, Back, Menu, SkipToggle, AutoToggle,
  Log, QuickSave, QuickLoad, Screenshot, HideWindow
}
```

### SaveData (types/SaveData.ts)

```typescript
interface SaveData {
  save_schema_version: 1;    // フリーズ済み
  engine_version: string;
  work_id: string;
  scenario_id: string;
  node_id: string;
  vars: Record<string, unknown>;
  read: Record<string, boolean>;
  timestamp: number;
}
```

### Timeline (timeline/types.ts)

```typescript
interface TimelineRoot {
  version: '1.1';
  duration: number;
  tracks: Track[];
}

interface Track {
  id: string;
  target: string;         // 'bg' | 'ch:xxx' | 'ovl:xxx'
  property: string;       // 'x' | 'y' | 'scale' | 'alpha' | 'rotation'
  keyframes: Keyframe[];
}

interface Keyframe {
  time: number;
  value: number;
  easing?: EasingType;
}
```

## プラットフォーム抽象化

| インターフェース | メソッド | 役割 |
|----------------|---------|------|
| IInput | dispatch(action) | 入力イベント → アクション変換 |
| IAudio | playBgm, playSe, playVoice, stop, setVolume | カテゴリ別音声再生 |
| IStorage | save, load, list, delete | セーブデータ永続化 |
| IOpHandler | 各 Op 型に対応するメソッド | Op 命令の実行 |

## 依存関係

- **外部依存**: なし
- **被依存**: compiler, ksc-compiler, interpreter, web, battle, editor, hono

## テスト

- `test/SaveData.test.ts` — セーブデータスキーマ検証
- `test/OpRunner.test.ts` — Op 実行ループテスト
- `test/commandSync.test.ts` — コマンド定義の同期チェック
- `src/timeline/__tests__/` — タイムライン評価・バリデーション (4 ファイル)
