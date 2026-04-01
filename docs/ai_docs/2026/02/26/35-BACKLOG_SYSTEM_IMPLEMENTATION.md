# バックログ（メッセージ履歴）システム実装設計図

**作成日**: 2026-02-26
**対象**: `@kaedevn/interpreter` および `@kaedevn/web`

## 1. データ構造の定義
`packages/core` のタイプ定義に以下を追加します。

```typescript
export interface LogEntry {
  speaker: string | null;
  text: string;
  voiceId?: string;
  timestamp: number;
}
```

## 2. インタプリタ層へのフック
`Interpreter.ts` の `handleDialogue` メソッドを拡張し、エンジンの `onDialogue` を呼ぶ直前でログを記録します。

```typescript
// Interpreter.ts 内のイメージ
private async handleDialogue(speaker: string, lines: string[]) {
  const fullText = lines.join('
');
  
  // エンジン側へログ追加を通知
  this.engine.pushLog({
    speaker,
    text: fullText,
    timestamp: Date.now()
  });

  await this.engine.showDialogue(speaker, fullText);
}
```

## 3. レンダリング層（Web）での表示
`packages/web` 内に `LogOverlay.ts` を作成し、PixiJS の Container として実装します。

- **描画**: セリフ一つ一つを `PIXI.Text` または `BitmapText` として縦に並べます。
- **スクロール**: `wheel` イベントまたは `IInput` の `Up/Down` アクションを購読し、Y 座標をオフセットします。
- **再利用**: 画面外に消えたテキストオブジェクトをプールし、メモリ消費を抑えます。

## 4. 特殊要件
- **ボイス再再生**: ログ内の各項目に「再生」ボタン（アイコン）を配置し、クリック時に `IAudio` を通じて `playVoice(id)` を再度実行します。

---
*Created by Gemini CLI Engine Specialist.*
