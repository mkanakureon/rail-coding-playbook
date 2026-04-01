# インタプリタ・コンパイラ コマンドギャップ調査 (2026-02-21)

## 調査方針

コンパイラ (`packages/compiler`) がサポートする `@コマンド` と、
インタプリタ (`packages/interpreter`) の `executeBuiltin` の対応を比較し、
インタプリタで未実装のコマンドを特定する。

---

## コマンド対応表

| コンパイラ `@cmd` | Compiler Op | IEngineAPI メソッド | インタプリタ `.ksc` | 状態 |
|-----------------|-------------|--------------------|--------------------|------|
| `@bg id`         | BG_SET      | `setBg(name, effect?)` | `bg("id")` | ✅ 実装済み |
| `@bg` (引数なし)  | BG_CLEAR    | `setBg("")` | `bg("")` | ✅ 実装済み（空文字） |
| `@ch n p pos`    | CH_SET      | `showChar(name, pose, pos, fadeMs?)` | `ch("n","p","pos")` | ⚠️ fadeMs 未対応 |
| `@ch_anim n p pos` | CH_ANIM  | `showCharAnim(name, pose, pos)` | `ch_anim("n","p","pos")` | ❌ 未実装 |
| `@ch_hide n`     | CH_HIDE     | `hideChar(name, fadeMs?)` | `ch_hide("n")` | ⚠️ fadeMs 未対応 |
| `@ch_clear`      | CH_CLEAR    | `clearChars(fadeMs?)` | `ch_clear()` | ❌ 未実装 |
| `@bgm id`        | BGM_PLAY    | `playBgm(name, vol?, fadeMs?)` | `bgm("id")` | ⚠️ vol/fadeMs 未対応 |
| `@bgm_stop`      | BGM_STOP    | `stopBgm()` / `fadeBgm(ms)` | `bgm_stop()` | ⚠️ fadeMs 未対応 |
| `@se id`         | SE_PLAY     | `playSe(name, vol?)` | `se("id")` | ⚠️ vol 未対応 |
| `@voice id`      | VOICE_PLAY  | `playVoice(name)` | `voice("id")` | ❌ 未実装 |
| `@wait sec`      | WAIT_MS     | `wait(ms)` | `wait(ms)` | ✅ 実装済み |
| `@battle id`     | BATTLE_START | `battleStart(troopId)` | `battle("id","win","lose")` | ❌ 未実装 |
| `@timeline_play id` | TIMELINE_PLAY | `playTimeline(name)` | `timeline_play("id")` | ❌ 未実装（`timeline()` は別名で存在） |
| `@l`             | WAIT_CLICK  | `waitForClick()` | `waitclick()` | ✅ 実装済み（別名） |

---

## IEngineAPI の不足メソッド

| 不足メソッド | シグネチャ | 対応コマンド |
|------------|----------|------------|
| `showCharAnim` | `(name: string, pose: string, position: string): Promise<void>` | `ch_anim` |
| `clearChars` | `(fadeMs?: number): Promise<void>` | `ch_clear` |
| `playVoice` | `(name: string): void` | `voice` |
| `battleStart` | `(troopId: string): Promise<'win' \| 'lose'>` | `battle` |

## IEngineAPI の既存メソッドに必要な optional params 追加

| メソッド | 現行シグネチャ | 修正後シグネチャ |
|---------|-------------|----------------|
| `showChar` | `(name, pose, position?)` | `(name, pose, position?, fadeMs?)` |
| `hideChar` | `(name)` | `(name, fadeMs?)` |
| `playBgm` | `(name)` | `(name, vol?, fadeMs?)` |
| `playSe` | `(name)` | `(name, vol?)` |

---

## .ksc 構文 (インタプリタ向け)

インタプリタはポジショナル引数を使用する（コンパイラの `key=value` 形式とは異なる）。

```
// 背景
bg("forest_day")
bg("forest_day", "fade")    // with effect

// キャラクター
ch("hero", "smile", "left")
ch("hero", "smile", "left", 500)   // with fadeMs
ch_anim("hero", "run", "left")     // アニメーション表示
ch_hide("hero")
ch_hide("hero", 300)               // with fadeMs
ch_clear()                         // 全キャラ消去
ch_clear(500)                      // with fadeMs

// オーディオ
bgm("bgm_main")
bgm("bgm_main", 80)                // with vol
bgm("bgm_main", 80, 1000)         // with vol + fadeMs (fade-in)
bgm_stop()
bgm_stop(500)                      // fade-out over 500ms
se("se_click")
se("se_click", 80)                 // with vol
voice("vo_hero_001")               // ボイス再生

// 待機
wait(1000)                         // 1000ms 待機
waitclick()                        // クリック待ち

// タイムライン
timeline("tl_001")                 // 既存（互換性のため残す）
timeline_play("tl_001")           // 追加（コンパイラと同名）

// バトル
battle("troop001", "victory", "gameover")   // troopId + onWin + onLose ラベル
```

---

## 修正方針

1. **IEngineAPI.ts** に不足メソッドを追加、既存メソッドに optional params を追加
2. **Interpreter.ts** の `executeBuiltin` に不足 case を追加
3. **Interpreter.ts** の `isBuiltinFunction` に新コマンド名を追加
4. **IntegrationSimple.test.ts** の MockEngine を IEngineAPI に合わせて修正（スキップ解除）
5. **PhaseA.test.ts** を新規作成（新コマンドのテスト）

### battle コマンドの実装方針

`.ksc` での `battle(troopId, onWin?, onLose?)` は以下のように動作する：

```typescript
// executeBuiltin 内
case "battle": {
  const troopId = String(args[0]);
  const onWin = args[1] ? String(args[1]) : undefined;
  const onLose = args[2] ? String(args[2]) : undefined;
  const result = await this.engine.battleStart(troopId);
  if (result === 'win' && onWin) {
    this.executeJump(onWin);
    return false;
  } else if (result === 'lose' && onLose) {
    this.executeJump(onLose);
    return false;
  }
  return true;
}
```

### bgm_stop の fade 方針

既存の `fadeBgm(time)` を再利用する（`stopBgm` のシグネチャは変えない）：

```typescript
case "bgm_stop":
  if (args[0] && Number(args[0]) > 0) {
    await this.engine.fadeBgm(Number(args[0]));  // fade out
  } else {
    this.engine.stopBgm();                        // immediate stop
  }
  return true;
```

---

## 実装後の完了基準

- `npm test` で interpreter パッケージの全テストがパス（スキップなし）
- 新コマンド（ch_anim, ch_clear, voice, battle, timeline_play）がテストで検証済み
- IntegrationSimple の3件スキップが解消
