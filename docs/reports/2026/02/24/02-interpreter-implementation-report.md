# kaedevn インタプリタ実装報告書

**日付:** 2026-02-24
**対象:** `@kaedevn/core` パッケージ（OSS公開対象）

---

## 1. 概要

kaedevn ビジュアルノベルエンジンのインタプリタ（ランタイム）部分の実装状況を報告する。
コンパイラは OSS 対象外とし、インタプリタ単体で動作するコンソールデモを追加した。

## 2. パッケージ構成

```
@kaedevn/core v0.0.1
├── src/
│   ├── engine/          ← インタプリタ本体
│   │   ├── OpRunner.ts       (276行) 命令実行エンジン
│   │   └── IOpHandler.ts     (117行) プラットフォーム抽象
│   ├── types/
│   │   ├── Op.ts              (80行)  命令セット定義 (21種)
│   │   ├── Action.ts          (10行)  入力アクション enum
│   │   ├── SaveData.ts        (10行)  セーブスキーマ
│   │   └── ProjectConfig.ts   (39行)  プロジェクト設定
│   ├── interfaces/
│   │   ├── IInput.ts          (7行)   入力抽象
│   │   ├── IAudio.ts          (8行)   音声抽象
│   │   └── IStorage.ts        (8行)   ストレージ抽象
│   ├── constants/
│   │   └── layout.ts          (6行)   1280×720 レイアウト定数
│   ├── timeline/        ← タイムラインシステム
│   │   ├── types.ts           (181行) 型定義 (v1.1)
│   │   ├── evaluator.ts       (286行) 評価エンジン
│   │   ├── easing.ts          (132行) イージング関数 10種
│   │   └── validator.ts       (343行) バリデータ
│   └── events/          ← イベントタイムライン
│       ├── types.ts           (101行) イベント型 6種
│       ├── emitBetween.ts     (86行)  区間イベント発火
│       ├── seekStateAt.ts     (104行) 状態復元
│       └── validate.ts        (86行)  バリデータ
└── dist/                ← ビルド成果物
```

**ソースコード合計: 約 3,520 行（テスト除く）**

### 依存関係

- ランタイム依存: **なし**（純粋な TypeScript）
- 開発依存: `tsx`, `vitest`
- コンパイラへの依存: **なし**（コンパイラが core に依存する一方向）

## 3. Op 命令セット（21種）

インタプリタが実行する全命令の一覧。

| カテゴリ | Op | 主要パラメータ |
|---|---|---|
| **テキスト** | `TEXT_APPEND` | `who?`, `text` |
| | `TEXT_NL` | — |
| **待機** | `WAIT_CLICK` | — |
| | `PAGE` | — |
| | `WAIT_MS` | `ms` |
| **背景** | `BG_SET` | `id`, `fadeMs?` |
| **キャラクター** | `CH_SET` | `name`, `pose`, `pos`, `fadeMs?` |
| | `CH_HIDE` | `name`, `fadeMs?` |
| | `CH_CLEAR` | `fadeMs?` |
| | `CH_ANIM` | `name`, `src`, `frames`, `fps`, `pos`, `loop?` |
| **音声** | `BGM_PLAY` | `id`, `vol?`, `fadeMs?` |
| | `BGM_STOP` | `fadeMs?` |
| | `SE_PLAY` | `id`, `vol?` |
| | `VOICE_PLAY` | `id` |
| | `WAIT_VOICE_END` | — |
| **変数** | `VAR_SET` | `name`, `value` |
| | `VAR_ADD` | `name`, `value` |
| | `VAR_SUB` | `name`, `value` |
| **選択肢** | `CHOICE` | `options: [{label, jump}]` |
| **制御フロー** | `JUMP` | `pc` |
| | `JUMP_IF` | `condition`, `pc` |

### JUMP_IF の対応演算子

`>=`, `<=`, `>`, `<`, `==`, `!=`

## 4. OpRunner（実行エンジン）

### アーキテクチャ

```
CompiledScenario { id, ops[] }
        │
        ▼
   ┌─────────┐    dispatch    ┌────────────┐
   │ OpRunner │──────────────▶│ IOpHandler │ (プラットフォーム実装)
   │  pc=0    │    each op    │  Web / CLI  │
   │  vars={} │◀──────────────│  / Switch   │
   │  read={} │   await/return└────────────┘
   └─────────┘
```

### 内部状態

| フィールド | 型 | 用途 |
|---|---|---|
| `pc` | `number` | プログラムカウンタ |
| `vars` | `Record<string, unknown>` | 変数ストア |
| `read` | `Record<number, boolean>` | 既読フラグ（Auto/Skip用） |
| `running` | `boolean` | 実行中フラグ |

### 公開API

| メソッド | 説明 |
|---|---|
| `start(scenario, handler)` | 先頭から実行開始 |
| `resume(scenario, handler, pc, vars, read)` | セーブデータから復帰 |
| `stop()` | 実行停止 |
| `getState()` | 現在の `{scenarioId, pc, vars, read}` を返す |

## 5. IOpHandler（プラットフォーム抽象）

17メソッド + オプション2メソッド。

| メソッド | async | 戻り値 |
|---|---|---|
| `textAppend(who?, text)` | Yes | void |
| `textNl()` | Yes | void |
| `waitClick()` | Yes | void |
| `page()` | Yes | void |
| `waitMs(ms)` | Yes | void |
| `bgSet(id, fadeMs?)` | Yes | void |
| `chSet(name, pose, pos, fadeMs?)` | Yes | void |
| `chHide(name, fadeMs?)` | Yes | void |
| `chClear(fadeMs?)` | Yes | void |
| `chAnim(params)` | Yes | void |
| `bgmPlay(id, vol?, fadeMs?)` | No | void |
| `bgmStop(fadeMs?)` | No | void |
| `sePlay(id, vol?)` | No | void |
| `voicePlay(id)` | No | void |
| `waitVoiceEnd()` | Yes | void |
| `choice(options)` | Yes | number (jump先pc) |
| `setCurrentPosition?(pc)` | No | void (optional) |
| `setReadFlags?(read)` | No | void (optional) |

### 既存の実装

| 実装 | 用途 | 場所 |
|---|---|---|
| `WebOpHandler` | PixiJS/ブラウザ | monorepo `packages/web/` |
| `ConsoleHandler` | Node.js コンソールデモ | OSS `examples/console-demo.ts` |

## 6. テスト状況

```
Test Files:  4 passed (4)
Tests:       69 passed (69)
Duration:    404ms
```

| テストファイル | テスト数 | 対象 |
|---|---|---|
| `easing.test.ts` | 18 | イージング関数 (境界値・単調性) |
| `evaluator.test.ts` | 32 | タイムライン評価 (fillMode・補間・v1.1) |
| `validator.test.ts` | 17 | スキーマ検証・クリップ重複検出 |
| `events.test.ts` | 27 | イベント発火・状態復元・重複排除 |

**注:** OpRunner 単体のユニットテストは未作成（統合テストで動作確認済み）。

## 7. コンソールデモ（本日追加）

### ファイル

| ファイル | 操作 |
|---|---|
| `examples/console-demo.ts` (322行) | 新規作成 |
| `package.json` | `demo` スクリプト + `tsx` devDep + `type: module` 追加 |

### 実行方法

```bash
npm install && npm run build && npm run demo
```

### 3つのデモシナリオ

**1. 基本テキスト表示** — BG_SET, CH_SET, BGM/SE, TEXT_APPEND, WAIT_CLICK, PAGE

**2. 3回ループ（変数 + if + jump）**
```
pc=0: VAR_SET counter = 0
pc=1: VAR_ADD counter += 1       ← *loop
pc=2: TEXT "ループを実行中..."
pc=3: WAIT_CLICK
pc=4: SE "tick"
pc=5: JUMP_IF counter >= 3 → 7   ← 脱出条件
pc=6: JUMP → 1                   ← ループバック
pc=7: TEXT "3回ループしました"    ← *done
pc=8: PAGE
```

**3. 選択肢 + 変数分岐** — CHOICE → VAR_ADD → JUMP_IF で good/normal エンド分岐

### 設計方針

- `@kaedevn/core` のみに依存（コンパイラ不要）
- Op 命令列を TypeScript で直接構築
- `ConsoleHandler` が全 IOpHandler メソッドを実装
- 各コマンドはコンソールにダミーメッセージを出力

## 8. 開発履歴（packages/core）

| 日付 | コミット |
|---|---|
| 2026-02-08 | 選択肢機能・アセット管理・デモ完成度向上 |
| 2026-02-08 | DSL→Op命令列コンパイラ Phase 1-2 |
| 2026-02-08 | Op[]統一ランタイム実装 — ScriptCommand形式を完全廃止 |
| 2026-02-15 | 選択肢・IF文・変数のサポート（compiler Phase 7） |
| 2026-02-17 | Timeline v1.1 統一リファクタ |
| 2026-02-19 | BG_CLEAR対応・Editor port修正 |
| 2026-02-21 | TIMELINE_PLAY実装・バトルブロック統合 |
| 2026-02-23 | FlagSystem + InventorySystem 実装 |
| 2026-02-24 | **コンソールデモ追加（本報告）** |

## 9. 残課題

| 項目 | 優先度 | 備考 |
|---|---|---|
| OpRunner ユニットテスト | 中 | 現在は統合テストのみ |
| OpRunner デバッグログ除去 | 低 | `console.log("[OpRunner]...")` が残存。本番ビルドでは不要 |
| IOpHandler の Switch 実装 | — | Switch 移植時に対応 |
| セーブ/ロード統合テスト | 中 | `resume()` のテスト |
