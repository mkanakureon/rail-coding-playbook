# kaedevn エンジン テスト計画書

**作成日**: 2026-02-27
**対象**: packages/core, packages/web, packages/ksc-compiler
**テストフレームワーク**: Vitest

---

## 1. 現状分析

### 1.1 テスト済み領域

| パッケージ | テスト対象 | テスト数 | 状態 |
|-----------|-----------|---------|------|
| ksc-compiler | Lexer, Parser, Checker, Emitter, VM | ~200+ | ✅ 網羅的 |
| core | Events (emitEventsBetween, seekStateAt, validate) | 21 | ✅ |
| core | Timeline (easing, evaluator, validator) | 68 | ✅ |
| web | KscHostAdapter (HOST_CALL → IOpHandler 変換) | ~38 | ✅ |
| web | KscRunner E2E (KSC → VM → Adapter フロー) | ~10 | ✅ |
| web | FlagSystem (get/set/serialize) | 72 | ✅ |
| web | InventorySystem (add/remove/count/serialize) | 90+ | ✅ |
| web | game-systems E2E (KSC → Flag/Inventory 統合) | ~10 | ✅ |

### 1.2 テスト未実施の重大ギャップ

| コンポーネント | パッケージ | 重要度 | 理由 |
|--------------|-----------|--------|------|
| **OpRunner** | core | 最高 | シナリオ実行エンジンの中核。PC 管理、分岐、変数操作が未テスト |
| **Phase 2-6 新機能** | web | 高 | KscHostAdapter に追加した screenFilter/shake/moveChar ディスパッチが未テスト |
| **SaveData 整合性** | core | 高 | セーブデータのシリアライズ・デシリアライズが未テスト |

### 1.3 テスト不要（UI 描画層）

以下はブラウザ描画に依存するため、ユニットテストの対象外とする。E2E/手動テストでカバー。

- WebOpHandler（PixiJS 依存）
- TextWindow, ChoiceOverlay, MenuScreen 等の UI コンポーネント
- AudioManager（Web Audio API 依存）
- LayerManager（PixiJS Container 依存）

---

## 2. テスト計画

### Phase T-1: OpRunner ユニットテスト（最優先）

**ファイル**: `packages/core/test/OpRunner.test.ts`（新規作成）

OpRunner はモックの IOpHandler を注入してテスト可能。PixiJS 依存なし。

#### テストケース

**基本実行:**
- TEXT_APPEND → handler.textAppend が正しい引数で呼ばれる
- TEXT_NL → handler.textNl が呼ばれる
- WAIT_CLICK → handler.waitClick が呼ばれる
- PAGE → handler.page が呼ばれる
- WAIT_MS → handler.waitMs が正しい ms で呼ばれる

**背景・キャラ:**
- BG_SET → handler.bgSet(id, fadeMs, effect) が呼ばれる
- BG_CLEAR → handler.bgClear(fadeMs) が呼ばれる
- CH_SET → handler.chSet(name, pose, pos, fadeMs) が呼ばれる
- CH_HIDE → handler.chHide(name, fadeMs) が呼ばれる
- CH_CLEAR → handler.chClear(fadeMs) が呼ばれる
- CH_MOVE → handler.chMove(name, pos, durationMs) が呼ばれる（オプショナル）
- CH_ANIM → handler.chAnim(params) が呼ばれる

**音声:**
- BGM_PLAY → handler.bgmPlay(id, vol, fadeMs) が呼ばれる
- BGM_STOP → handler.bgmStop(fadeMs) が呼ばれる
- SE_PLAY → handler.sePlay(id, vol) が呼ばれる
- VOICE_PLAY → handler.voicePlay(id) が呼ばれる
- WAIT_VOICE_END → handler.waitVoiceEnd が呼ばれる

**変数・分岐:**
- VAR_SET → vars に値が設定される
- VAR_ADD → vars の値が加算される
- VAR_SUB → vars の値が減算される
- JUMP → pc が指定値にジャンプ
- JUMP_IF (条件 true) → pc がジャンプ
- JUMP_IF (条件 false) → pc が +1
- 条件式評価: `>=`, `<=`, `>`, `<`, `==`, `!=` の各演算子

**選択肢:**
- CHOICE → handler.choice が呼ばれ、返り値で pc が設定される

**オプショナル Op:**
- BATTLE_START → handler.battleStart が呼ばれ、vars["battle_result"] が設定される
- TIMELINE_PLAY → handler.timelinePlay が呼ばれる（未実装の場合はスキップ）
- SCREEN_FILTER → handler.screenFilter が呼ばれる（オプショナル）
- SCREEN_FILTER_CLEAR → handler.screenFilterClear が呼ばれる
- SHAKE → handler.shake が呼ばれる（オプショナル）

**状態管理:**
- start() → pc=0, vars={}, read={} で初期化
- resume() → 指定 pc/vars/read から再開
- stop() → 実行が停止する
- getState() → 現在の scenarioId, pc, vars, read が返る
- TEXT_APPEND 実行後に read[pc] = true になる

**統合シナリオ:**
- 複数 Op の連続実行（TEXT_APPEND → WAIT_CLICK → BG_SET → CH_SET の流れ）
- 変数を使った分岐（VAR_SET → JUMP_IF → 分岐先の Op 実行）
- 選択肢 → ジャンプ → テキスト表示の一連のフロー

---

### Phase T-2: KscHostAdapter 追加テスト

**ファイル**: `packages/web/test/KscHostAdapter.test.ts`（既存に追記）

Phase 2-6 で追加した HOST_CALL ディスパッチのテスト。

#### テストケース

- `screenFilter("sepia", 0.8)` → handler.screenFilter が呼ばれる
- `screenFilterClear()` → handler.screenFilterClear が呼ばれる
- `shake(10, 500)` → handler.shake が呼ばれ、pendingPromise が設定される
- `shake()` (handler 未実装) → 警告ログ + Promise.resolve(null)
- `moveChar("hero", "right", 800)` → handler.chMove が呼ばれる
- `moveChar()` (handler 未実装) → 警告ログ + Promise.resolve(null)
- `setBg("forest", "slide_left")` → handler.bgSet(id, 500, "slide_left") が呼ばれる
- `setBg("forest", "slide_right")` → handler.bgSet(id, 500, "slide_right") が呼ばれる
- `setBg("forest", "fade")` → handler.bgSet(id, 500, "fade") が呼ばれる
- `setBg("forest", null)` → handler.bgSet(id, undefined, undefined) が呼ばれる
- `fadeBgm(1000)` → handler.bgmStop(1000) が呼ばれ、pendingPromise が設定される

---

### Phase T-3: SaveData 整合性テスト

**ファイル**: `packages/core/test/SaveData.test.ts`（新規作成）

セーブデータの型・構造が正しいことを検証。

#### テストケース

- SaveData の必須フィールドが存在する（save_schema_version, scenario_id, node_id, vars, read, timestamp）
- thumbnail フィールドがオプショナル
- viewState フィールドがオプショナル
- vars は Record<string, unknown> としてシリアライズ可能
- read は Record<number, boolean> としてシリアライズ可能
- JSON.stringify → JSON.parse のラウンドトリップで値が保持される

---

### Phase T-4: KSC コンパイラ ビルトイン追加テスト

**ファイル**: `packages/ksc-compiler/test/checker.test.ts`（既存に追記）

Phase 4-5 で追加したビルトインの型チェックテスト。

#### テストケース

- `screenFilter("sepia")` → 型エラーなし
- `screenFilter("sepia", 0.5)` → 型エラーなし
- `screenFilterClear()` → 型エラーなし
- `shake()` → 型エラーなし
- `shake(10, 500)` → 型エラーなし
- `moveChar("hero", "right", 800)` → 型エラーなし
- `moveChar("hero")` → 引数不足で型エラー

---

## 3. 実装順序

```
Phase T-1: OpRunner ユニットテスト     ← 最優先（エンジンの中核）
Phase T-2: KscHostAdapter 追加テスト   ← Phase 2-6 新機能のリグレッション防止
Phase T-3: SaveData 整合性テスト       ← セーブロードの信頼性
Phase T-4: KSC コンパイラ ビルトイン   ← コンパイラの型チェック検証
```

## 4. テスト方針

### やること
- `vi.fn()` でモック IOpHandler を作成し、OpRunner に注入
- 各 Op が正しいハンドラメソッドを正しい引数で呼ぶことを `expect().toHaveBeenCalledWith()` で検証
- 状態変化（pc, vars, read）を `getState()` で検証
- `async/await` で非同期ハンドラの完了を待つ

### やらないこと
- PixiJS 描画の検証（ブラウザ依存）
- Web Audio API の検証（ブラウザ依存）
- DOM 操作の検証（ブラウザ依存）
- E2E テスト（Playwright — 別計画）

### 実行方法

```bash
# core パッケージのテスト
npm test -w @kaedevn/core

# web パッケージのテスト
npm test -w @kaedevn/web

# ksc-compiler パッケージのテスト
npm test -w @kaedevn/ksc-compiler

# 全テスト
npm test
```

## 5. 期待する成果

| 指標 | 現在 | テスト後 |
|------|------|---------|
| OpRunner テスト | 0 | ~35 |
| KscHostAdapter テスト | ~38 | ~50 |
| SaveData テスト | 0 | ~6 |
| KSC ビルトインテスト | 既存 | +7 |
| 合計新規テスト | — | ~50 |
