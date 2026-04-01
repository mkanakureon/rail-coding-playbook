# インタプリタ現状調査 (2026-02-21)

## 結論：インタプリタは現行フローとは別系統

現行の実行フローは：

```
.ks ファイル → [compiler] → CompiledScenario (JSON) → [OpRunner] → [WebOpHandler]
```

`packages/interpreter` は `.ksc` 形式のスクリプトを直接実行する**別系統**のエンジン。
コンパイラ+OpRunnerが本番フローとして動いているため、インタプリタは開発が途中で止まっている状態。

---

## packages/interpreter の現状

### 実装済み（動作確認済み）

| フェーズ | 内容 |
|---------|------|
| Phase 1 | ダイアログブロック、bg/ch/bgm/se/wait/waitclick/timeline |
| Phase 2 | ラベル・jump/call/ret、コールスタック |
| Phase 3 | 変数・式評価（算術/比較/論理/代入）、文字列連結 |
| Phase 4 | if/else if/else、choice（条件付き選択肢） |
| Phase 5 | ユーザー定義関数 def/sub、ローカルスコープ、再帰深さ制限16 |
| Phase 6 | ダイアログ内文字列補間 `{expr}` |
| Phase 7-1 | エラーハンドリング（Levenshtein提案、スタックトレース） |
| Phase 7-2 | デバッグモード（変数ウォッチ、ブレークポイント、トレース） |
| Phase 7-3 | 統合テスト（107テスト通過） |

### 未実装・既知問題

| 問題 | 詳細 |
|-----|------|
| `fadeBgm` / `moveChar` 未配線 | IEngineAPI に定義あり、executeBuiltin に case なし → 無言失敗 |
| step実行未接続 | Debugger.stepOver/Into/Out のフラグはあるが interpreter ループが見ていない |
| fibonacci+ループでハング | Phase 5 既知問題、Integration.test.ts 5件スキップ |
| demo_scenario.ksc 不在 | `packages/interpreter/examples/` が空 |
| IntegrationSimple 3件スキップ | MockEngine の showDialogue シグネチャ不一致 |

---

## packages/core (OpRunner) の現状

### 実装済み
- 全 Op コードのディスパッチ（BG_SET / CH_SET / WAIT_CLICK / TIMELINE_PLAY 等）
- タイムライン評価器（キーフレーム補間・イージング）
- タイムラインバリデーター
- IAudio / IInput / IStorage インターフェース定義

### 未実装・既知問題

| 問題 | 詳細 |
|-----|------|
| JUMP_IF の複合条件非対応 | `x > 0 && y < 10` のような式は単一演算子のみ対応 |
| timeline integration テスト失敗 | `packages/core/public/samples/` が存在しない（web 側にある） |
| timeline v0.2 候補 | ブレンド合成・bezier イージング・clip フェード等未実装 |
| OpRunner の console.log 残留 | デバッグログが本番コードに残っている |

---

## packages/compiler の現状

- **84テスト中83通過**（1件: `@bg` 引数なしでエラーにならない）
- コンパイル済み JSON (CompiledScenario) を正常に生成
- choice の条件付きオプションは TODO（パーサーに記述あり）

---

## 推奨アクション

インタプリタ (`packages/interpreter`) の開発を続けるかどうかの判断材料：

**継続する場合の残タスク（優先順）**
1. `fadeBgm` / `moveChar` を executeBuiltin に追加
2. IntegrationSimple のスキップ解消（MockEngine シグネチャ修正）
3. demo_scenario.ksc サンプルファイル作成
4. step実行をインタプリタループに接続
5. fibonacci+ループのハング調査・修正

**廃止・凍結する場合**
- コンパイラ+OpRunner が本番フローとして安定しているため、インタプリタは不要
- `packages/interpreter` をアーカイブ or 削除
