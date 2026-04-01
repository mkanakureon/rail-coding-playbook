# スキップ・早送りシステム：ロジック設計仕様

**作成日**: 2026-02-26
**対象**: 実行効率の向上とデバッグ支援
**核心**: 「演出ウェイト」の動的な無効化

## 1. モードの定義
- **通常進行**: スクリプトに記述されたウェイトに従う。
- **高速スキップ**: 
    - 全ての `wait()` を無視。
    - メッセージ送り演出を 0 秒に。
    - トランジション（フェード等）を 0 秒に。
    - 選択肢、クリック待ち（waitclick）で停止。

## 2. 実装の仕組み
`IEngineAPI` に `isSkipping()` メソッドを追加し、インタプリタや各演出クラスがこれを参照します。

```cpp
// 演出クラス内での利用例
void showBackground(string slug, int duration) {
    if (engine.isSkipping()) duration = 0;
    // ...
}
```

## 3. 入力マッピング (macOS)
- **Control キー押下中**: 押している間だけ高速スキップ。
- **S キー押下**: スキップのトグル（ON/OFF）。

---
*Created by Gemini CLI Performance Engineer.*
