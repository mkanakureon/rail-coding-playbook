# インタプリタ開発計画書 (2026-02-21)

## 位置づけ

kaedevn のスクリプト作成には3段階のレベルがある：

| レベル | ツール | 対象者 | 形式 |
|--------|--------|--------|------|
| 初級 | `packages/compiler` | 非エンジニア | `.ks` ファイル → JSON → OpRunner |
| **中級** | **`packages/interpreter`** | **シナリオライター** | **`.ksc` ファイルを直接実行** |
| 上級 | TypeScript API | エンジニア | TS でノベルゲームスクリプトを記述 |

インタプリタ（中級）は `.ksc` ファイルをコンパイルなしでリアルタイム実行し、
より豊かな表現（変数・関数・デバッグ）をライターに提供する。

### Switch 移植性についての補足

インタプリタは Switch 対応の観点でも **コンパイラ+OpRunner より有利**：

- **コンパイラ+OpRunner 方式**：Switch 側に OpRunner（バイトコード VM）の実装が必要
- **インタプリタ方式**：Switch 側は `IEngineAPI` を実装するだけでよい（1層の抽象）
- `.ksc` はテキストファイルなのでビルドなしに Switch 環境へ持ち込める
- デバッグモード（Debugger）も同じコードで Switch 開発時に活用できる

つまりインタプリタは「作者のツール」かつ「Switch 移植の基盤」でもある。

---

## 現状サマリー

### 実装済み（Phase 1–7）
- 基本コマンド `bg/ch/bgm/se/wait/waitclick/timeline`
- ラベル・ジャンプ `jump/call/ret`
- 変数・式評価（算術/比較/論理）、文字列連結
- 制御フロー `if/else if/else`、`choice`（条件付き選択肢）
- ユーザー定義関数 `def/sub`、ローカルスコープ
- ダイアログ内文字列補間 `{expr}`（実装済みだがテストがスキップ中）
- エラーハンドリング（Levenshtein提案・スタックトレース）
- Debugger クラス（ブレークポイント・変数ウォッチ・トレース）—ただしインタプリタ本体と未接続

### 既知の不具合・未完了
| 問題 | 重要度 | 場所 |
|------|--------|------|
| `fadeBgm` / `moveChar` が executeBuiltin に case なし | 中 | Interpreter.ts |
| Debugger のステップ実行フラグが本体ループと未接続 | 高 | Interpreter.ts + Debugger.ts |
| ブレークポイントで pause しても実行が止まらない | 高 | Interpreter.ts |
| `notifyStepComplete()` が一度も呼ばれていない | 中 | Interpreter.ts |
| IntegrationSimple テスト 3件スキップ（MockEngine シグネチャ不一致） | 中 | test/ |
| fibonacci + ループでハング（Phase 5 既知問題） | 高 | Interpreter.ts |
| `packages/interpreter/examples/` が空（サンプルなし） | 低 | examples/ |
| README に "DEPRECATED" の記載（方針転換のため削除が必要） | 低 | README.md |

---

## 開発フェーズ計画

### Phase A: バグ修正・テスト復活（優先度：高）

**A-1. ステップデバッグ接続**

`Interpreter.ts` の `step()` ループに Debugger との連携を実装する。

```typescript
// Interpreter.ts の step() 内に追加
if (this.debugger.isEnabled()) {
  const shouldBreak = await this.debugger.shouldBreak(lineNum, this.state);
  if (shouldBreak) {
    this.debugger.pause();
    await this.waitForResume(); // 外部からの resume() 呼び出しを待つ
  }
}

// step() 実行後
if (this.debugger.isEnabled()) {
  this.debugger.notifyStepComplete(lineNum, this.state);
  if (this.debugger.getStepMode() !== 'none') {
    this.debugger.pause();
    await this.waitForResume();
  }
}
```

**A-2. `fadeBgm` / `moveChar` の追加**

```typescript
// Interpreter.ts executeBuiltin()
case "bgm_fade": {
  const time = typeof args[0] === 'number' ? args[0] : 0;
  await this.engine.fadeBgm(time);
  return true;
}
case "move_ch": {
  const [name, pos, ms] = args as [string, string, number?];
  await this.engine.moveChar(name, pos as Position, ms);
  return true;
}
```

**A-3. IntegrationSimple スキップ解消**

`MockEngine.showDialogue` のシグネチャを `IEngineAPI` に合わせて修正し、
スキップされている 3 テストを通るようにする。

---

### Phase B: voice / Web専用コマンド追加（優先度：中）

**B-1. voice コマンド**
- `voice("filename")` → `engine.playVoice(name)` に接続
- `wait_voice()` → `engine.waitVoiceEnd()` に接続

**B-2. Web専用コマンド（アイソレーション）**
- `openUrl(url)` / `share(text)` / `analytics(event)` は `.ksc` でも利用可能にする
- ただし IEngineAPI の `webOnly` フラグがある実装にのみ有効
- Switch ビルドでは警告＋スキップ

---

### Phase C: fibonacci ハング修正（優先度：高）

**原因調査：** `call()` + ループの組み合わせで再帰深さ制限（16）を超えているか、
無限ループになっているかを特定する。

**対応方針：**
1. 再帰深さ制限を超えた時点で明示的なエラーをスローする
2. ループ反復回数の上限（例：10,000回）を設けてタイムアウト防止
3. スキップされているテストを通るように修正

---

### Phase D: サンプルシナリオ作成（優先度：中）

`packages/interpreter/examples/` にサンプル `.ksc` ファイルを作成する。

**demo_basic.ksc** — Phase 1–2 のみ使用（初心者向け）
```
*start
bg("forest_day")
ch("hero", "smile")
#hero
こんにちは！
#
jump("end")

*end
```

**demo_advanced.ksc** — Phase 3–6 を使用（中級者向け）
```
*start
score = 0
name = "旅人"
bg("town")

#narrator
{name}の旅が始まった
#

choice {
  "北へ行く" {
    score += 10
    jump("north")
  }
  "南へ行く" {
    score += 5
    jump("south")
  }
}
```

**demo_debug.ksc** — デバッグ機能のデモ

---

### Phase E: エディタ統合（優先度：低・将来）

エディタ（port 5176）からインタプリタを呼び出し、
`.ksc` ファイルのリアルタイムプレビューを可能にする。

**概要：**
- エディタにインタプリタ用ペインを追加
- `.ksc` テキストを入力 → インタプリタで即時実行 → プレビュー
- Debugger の UI（変数ウォッチ・ブレークポイント）を接続

---

## 実装順序

```
Phase A-3 (テスト復活)
  → Phase A-1 (ステップデバッグ接続)
    → Phase A-2 (fadeBgm/moveChar)
      → Phase B-1 (voice)
        → Phase C (fibonacci 修正)
          → Phase D (サンプル作成)
            → Phase B-2 (Web専用コマンド)
              → Phase E (エディタ統合)
```

---

## 完了基準

| フェーズ | 完了基準 |
|---------|---------|
| Phase A | 全テスト通過（スキップなし）、`npm test` がクリーン |
| Phase B | `voice/web専用コマンド` のテストが通過 |
| Phase C | fibonacci テスト（従来スキップ）が通過 |
| Phase D | demo シナリオが実際に動作する |
| Phase E | エディタから `.ksc` をライブ実行できる |

---

## 備考

- README の "DEPRECATED" 記載は削除する（方針は3段階ティアとして継続）
- コンパイラ (`packages/compiler`) との `.ksc` 文法差異は最小にする
- TypeScript API（上級ティア）は別途計画書を作成する
