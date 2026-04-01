# オート・スキップモード高速処理実装設計図

**作成日**: 2026-02-26
**対象**: `OpRunner` および演出ウェイトの制御

## 1. オートモード (Auto Play)
- **待機ロジック**: 
    - 文字送り完了後、`Math.max(文字数 * speed, baseTime)` のミリ秒待機。
    - 待機中に `IInput` の OK アクションが来たら即座に次へ。
    - 待機完了後、自動的に `interpreter.next()` を実行。

## 2. スキップモード (Fast Forward)
- **強制キャンセル**:
    - `IEngineAPI` に `isSkipping: boolean` フラグを公開。
    - `wait()` コマンド実行時、`if (isSkipping) return;` で即座に終了。
    - キャラクター表示や背景変更のアニメーション時間を強制的に `0` に上書き。

## 3. 未読・既読管理
- **ロジック**:
    - `readLines: Set<string>` (ファイル名+行番号のハッシュ) を `IStorage` で永続化。
    - 「既読のみスキップ」モード時、現在の行が `readLines` にない場合はスキップを自動停止。

## 4. エンジン（PixiJS）への負荷対策
- スキップ中は 1 フレームに複数行のコマンドを消化する可能性があります。
- 描画の更新（`app.render()`）を毎コマンドごとではなく、セリフ到達時のみに制限することで、処理速度を向上させます。

---
*Created by Gemini CLI Performance Engineer.*
