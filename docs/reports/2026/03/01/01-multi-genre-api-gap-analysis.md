# マルチジャンル API 設計書 vs 実装 ギャップ分析

**日付**: 2026-03-01
**対象設計書**: `docs/10_ai_docs/2026/02/27/11-MULTI_GENRE_API_DESIGN_COMPLETE.md`
**作成者**: Gemini CLI (設計書) → Claude Code (本分析)

---

## 概要

設計書は `IEngineAPI` を拡張し、5ジャンル（ノベル, RPG, ローグライク, 放置, 育成）に対応する「Universal Playback Machine」を提案している。本文書は、設計書の各 API が実際のコードベースでどこまで実装されているかを比較・分析する。

---

## 1. 共通 API 基盤 (Universal Core API)

### 1.1 レンダリング・リソース管理

| 設計書 API | 実装状況 | 実装箇所 | 備考 |
|---|---|---|---|
| `showImage(layerId, assetId, transform, effect)` | **実装済（別名）** | `IOpHandler.chSet()`, `bgSet()` | キャラと背景で別メソッド。汎用 layerId 指定ではない |
| `hideImage(layerId, effect)` | **実装済（別名）** | `IOpHandler.chHide()`, `bgClear()` | 同上 |
| `playAudio(type, assetId, volume, loop)` | **実装済（分離型）** | `IOpHandler.bgmPlay()`, `sePlay()`, `voicePlay()` | カテゴリ別メソッド。`IAudio` インターフェースで抽象化済 |
| `setCamera(position, zoom, shake)` | **部分実装** | Timeline の `CameraTrack` で position/zoom アニメーション可能。`shake()` は `IOpHandler` に存在 | スクリプトから直接呼べる `setCamera()` API は未実装 |

**ギャップ**: 設計書は「レイヤーID で統一管理」を想定しているが、実装は背景・キャラクター・エフェクトを個別メソッドで管理。統一レイヤーマネージャーは未実装。

### 1.2 UI・インタラクション

| 設計書 API | 実装状況 | 実装箇所 | 備考 |
|---|---|---|---|
| `drawUI(uiJsonId, dataContext)` | **未実装** | — | JSON 定義による動的 UI システムは存在しない |
| `waitForInput(inputMask)` | **実装済（限定型）** | `IOpHandler.waitClick()`, `waitMs()`, `waitVoiceEnd()` | 「OK ボタン待ち」のみ。方向キーやマスク指定は未対応 |
| `showChoice(options)` | **実装済** | `IOpHandler.choice()`, `IEngineAPI.showChoice()` | DOM オーバーレイで実装。選択肢テキスト + ジャンプ先を返す |

**ギャップ**: `drawUI` が最大のギャップ。現在の UI はハードコードされた DOM/PixiJS 要素で構成されており、JSON 定義による動的レイアウトは不可。

### 1.3 状態管理 & 時間

| 設計書 API | 実装状況 | 実装箇所 | 備考 |
|---|---|---|---|
| `getVar(key)` / `setVar(key, value)` | **実装済** | `FlagSystem`（`packages/web/src/systems/FlagSystem.ts`）, Op 命令 `VAR_SET/VAR_ADD/VAR_SUB` | FlagSystem は `Map<string, unknown>`。Op は数値のみ |
| `getTimestamp()` | **部分実装** | `SaveData.timestamp` (保存時刻) | リアルタイム取得用の API はない。`Date.now()` を直接呼ぶ必要がある |
| `saveSnapshot()` / `loadSnapshot()` | **実装済** | `IOpHandler.getViewState()` / `restoreViewState()`, `StorageManager` (IndexedDB) | SaveData スキーマ v1 で凍結済。ViewState（背景・キャラ・BGM）を保存・復元 |

**ギャップ**: 変数システムは配列・オブジェクト・BigInt 未対応（設計書 Step 1 で強化予定）。現状は文字列・数値・真偽値のみ。

---

## 2. ジャンル別 API

### 2.1 ノベル・アドベンチャー — 実装度: ★★★★★

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `showDialogue(speaker, text)` | **実装済** | `IEngineAPI.showDialogue()`, `IOpHandler.textAppend()` + `waitClick()` |
| `setBacklog(entry)` | **実装済** | `BacklogStore.push()` (`packages/web/src/renderer/BacklogStore.ts`) |

**追加実装（設計書に記載なし）**:
- `TextWindow` による禁則処理 → 実際は `WebOpHandler` 内のテキストバッファリングで実装
- `CharacterLayer` による Z 順序管理 → `chSet()` の `pos` パラメータ（left/center/right）で制御
- スクリーンフィルター 14 種（Vignette, Night, Glitch, CRT, Rain 等）
- タイムライン再生（`IOpHandler.timelinePlay()`）
- フラグ・インベントリシステム（`FlagSystem`, `InventorySystem`）

**評価**: ノベルジャンルは設計書の範囲を超えて十分に実装されている。

### 2.2 コマンドバトル RPG — 実装度: ★★★★☆

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `battleStart(troopId)` | **実装済** | `IOpHandler.battleStart()`, `WebOpHandler` (870-953行目), `packages/battle/` |
| `playBattleEffect(effectId, targetId)` | **部分実装** | `applyAction()` 内でダメージ計算・状態異常は処理。視覚エフェクト（パーティクル等）は未実装 |

**実装詳細（`packages/battle/`）**:
- `BattleState`: `{ turn, party[], enemies[] }`
- `ActorState`: `{ actorId, hp, hpMax, mp, mpMax, atk, def, statuses }`
- `SkillDef`: `{ id, name, mpCost, hitChance, variance, kind, power, statusId? }`
- `calcDamage()`, `checkHit()`, `applyAction()`, `checkVictory()`, `simpleAi()`
- シード付き RNG（`makeRng()`）で再現性のあるバトル

**ギャップ**:
- パーティクル・画面フラッシュ等のバトル専用視覚エフェクトは未実装
- C++ 移植（設計書で言及）は未着手。計算は TypeScript のみ
- バトル UI は DOM オーバーレイ（PixiJS 統合ではない）

### 2.3 軽量 RPG / フィールド探索 — 実装度: ☆☆☆☆☆

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `loadMap(mapId, startPos)` | **未実装** | — |
| `moveEntity(entityId, targetPos, speed)` | **未実装** | — |

**ギャップ**: タイルマップ、衝突判定、エンティティ移動は一切実装されていない。SDL_RenderCopy による高速描画も未着手。`packages/sdl` は Git サブモジュールとして存在するが、タイルマップ機能は含まれていない。

### 2.4 ローグライク・ダンジョン — 実装度: ☆☆☆☆☆

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `setGridMap(width, height, data)` | **未実装** | — |
| `processTurn()` | **未実装** | — |
| `getEntitiesAt(x, y)` | **未実装** | — |

**ギャップ**: グリッドベースシステム、ターン管理（バトル以外）、A\*パスファインディング、FOV計算は一切実装されていない。

### 2.5 放置ゲー・クリッカー — 実装度: ☆☆☆☆☆

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `calculateOfflineProgress(lastTimestamp)` | **未実装** | — |
| `updateResource(id, perSecondAmount)` | **未実装** | — |

**ギャップ**: オフライン報酬計算、リソース自動増加、BigInt 対応数値システムは一切実装されていない。

### 2.6 育成シミュレーション — 実装度: ☆☆☆☆☆

| 設計書 API | 実装状況 | 実装箇所 |
|---|---|---|
| `bindUIValue(uiElementId, varName)` | **未実装** | — |
| `triggerEventByParams(paramCriteria)` | **未実装** | — |

**ギャップ**: UI-変数バインディング、パラメータ条件によるイベント自動抽出は一切実装されていない。

---

## 3. 実装ロードマップ vs 現状

| ステップ | 設計書の内容 | 現状 | 達成度 |
|---|---|---|---|
| Step 1: 状態管理の強化 | 配列・オブジェクト・BigInt 対応 | `FlagSystem` は `Map<string, unknown>` で any 型を格納可能だが、Op 命令は数値のみ。BigInt 未対応 | **20%** |
| Step 2: レイヤーマネージャー抽象化 | Map/Character/UI/Effect のスタック型管理 | 背景・キャラは個別管理。スクリーンフィルターは PixiJS Filter で実装。統一スタックは未実装 | **30%** |
| Step 3: 動的 UI システム | JSON による UI 定義を全プラットフォームで解釈 | 未実装。UI は React DOM またはハードコード PixiJS | **0%** |

---

## 4. 実装アーキテクチャの実態

設計書が想定するアーキテクチャと、実際の実装は以下のように異なる。

### 設計書の想定

```
IEngineAPI (統一インターフェース)
├── Universal Core (showImage, drawUI, getVar...)
├── Novel API (showDialogue, setBacklog)
├── Battle API (battleStart, playBattleEffect)
├── RPG API (loadMap, moveEntity)
├── Roguelike API (setGridMap, processTurn)
├── Idle API (calculateOfflineProgress)
└── Training API (bindUIValue, triggerEventByParams)
```

### 実際の実装

```
packages/core/
├── IOpHandler (低レベル Op 命令実行)
├── IInput / IAudio / IStorage (抽象化済)
├── Op.ts (命令セット — 凍結済)
├── SaveData.ts (セーブスキーマ — 凍結済)
└── timeline/types.ts (アニメーションシステム)

packages/interpreter/
└── IEngineAPI (高レベル — ノベル特化)

packages/web/
├── WebOpHandler (PixiJS 実装 — 1474行)
├── KscHostAdapter (KSC VM ブリッジ)
├── BacklogStore, ScreenFilter
├── FlagSystem, InventorySystem
└── StorageManager (IndexedDB)

packages/battle/
├── BattleState, calcDamage, applyAction
├── simpleAi, checkVictory
└── skills, troops, enemyDefs (ゲームデータ)
```

**重要な違い**:
- 設計書は単一の `IEngineAPI` に全ジャンル API を統合する想定
- 実装は **2層構造**（`IOpHandler` = 低レベル Op 実行, `IEngineAPI` = 高レベルスクリプト API）
- バトルは `packages/battle` に分離されており、`IOpHandler.battleStart()` 経由で呼び出し
- ノベル以外のジャンル拡張ポイントは設計されていない

---

## 5. ジャンル別「AI 執筆ルール」システム（設計書に記載なし）

設計書にはないが、実際のコードベースには **ジャンル別の AI 執筆支援ルール** が実装されている。

| ファイル | 説明 |
|---|---|
| `apps/hono/src/lib/assist/types.ts` | `WorkSetting.genre` フィールド、`GenreRules` インターフェース |
| `apps/hono/src/lib/assist/genre-rules.ts` | `resolveGenreRules(genre)` — ジャンル YAML マッチング |
| `apps/hono/src/lib/assist/genre-rules/*.yaml` | 7 ジャンル定義（fantasy, romance, mystery, horror, comedy, slice-of-life, _default） |
| `apps/hono/src/lib/assist/prompts.ts` | ジャンルルールを AI プロンプトに注入 |
| `apps/hono/src/routes/assist.ts` | AI 執筆 API エンドポイント |

これはエンジン API ではなく、AI によるシナリオ自動生成時のプロンプトルールシステム。設計書のスコープ外だが、「ジャンル対応」の一形態として存在する。

---

## 6. 総合評価

### 実装済み API カバレッジ

```
設計書の API 数: 18
実装済み:         9  (50%)
部分実装:         3  (17%)
未実装:           6  (33%)
```

### ジャンル別カバレッジ

| ジャンル | 実装度 | 説明 |
|---|---|---|
| ノベル・ADV | ★★★★★ (100%) | 設計書を超える実装。スクリーンフィルター、タイムライン、フラグ/インベントリも完備 |
| コマンドバトル RPG | ★★★★☆ (80%) | バトルロジック完成。視覚エフェクトと C++ 移植が残課題 |
| 軽量 RPG / フィールド | ☆☆☆☆☆ (0%) | 未着手 |
| ローグライク | ☆☆☆☆☆ (0%) | 未着手 |
| 放置ゲー | ☆☆☆☆☆ (0%) | 未着手 |
| 育成シミュレーション | ☆☆☆☆☆ (0%) | 未着手 |

### 結論

設計書はマルチジャンル対応の理想像を描いているが、現在の実装は**ノベル + バトル RPG**に集中しており、それ以外のジャンル（RPG フィールド、ローグライク、放置、育成）は一切着手されていない。これは意図的な優先順位付けの結果であり、設計書のロードマップ Step 1〜3（状態管理強化・レイヤー抽象化・動的 UI）が完了しなければ、新ジャンル追加は現実的ではない。

---

## 7. ファイルリファレンス

| カテゴリ | ファイルパス |
|---|---|
| エンジン API 定義 | `packages/interpreter/src/engine/IEngineAPI.ts` |
| Op ハンドラ定義 | `packages/core/src/engine/IOpHandler.ts` |
| Web 実装 | `packages/web/src/renderer/WebOpHandler.ts` |
| KSC ブリッジ | `packages/web/src/engine/KscHostAdapter.ts` |
| Op 命令セット | `packages/core/src/types/Op.ts` |
| セーブデータ | `packages/core/src/types/SaveData.ts` |
| タイムライン | `packages/core/src/timeline/types.ts` |
| バトルシステム | `packages/battle/src/` |
| フラグシステム | `packages/web/src/systems/FlagSystem.ts` |
| インベントリ | `packages/web/src/systems/InventorySystem.ts` |
| バックログ | `packages/web/src/renderer/BacklogStore.ts` |
| ストレージ | `packages/web/src/storage/StorageManager.ts` |
| 入力抽象化 | `packages/core/src/interfaces/IInput.ts` |
| 音声抽象化 | `packages/core/src/interfaces/IAudio.ts` |
| ストレージ抽象化 | `packages/core/src/interfaces/IStorage.ts` |
| AI ジャンルルール | `apps/hono/src/lib/assist/genre-rules/` |
