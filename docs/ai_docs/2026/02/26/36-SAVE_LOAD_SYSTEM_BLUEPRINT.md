# セーブ・ロード（完全状態復元）実装設計図

**作成日**: 2026-02-26
**対象**: エンジン全体のシリアライズと IStorage 連携

## 1. シリアライズ対象 (Snapshot)
セーブ時に保存すべきデータは、単なる「変数」だけではありません。

```typescript
export interface GameSnapshot {
  version: number;
  pc: number;               // 実行行
  scriptId: string;         // 実行中のシナリオID
  variables: Record<string, any>; // ゲーム変数
  callStack: any[];         // コールスタック
  viewState: {
    bg: { id: string; effect: string };
    characters: Array<{ id: string; pose: string; x: number }>;
    bgm: { id: string; volume: number };
  };
  thumbnail?: string;       // スクリーンショット (Base64)
}
```

## 2. 復元のプロセス (Load Flow)
1.  **静的復元**: `Snapshot` を読み込み、`Interpreter` の PC と変数をセットする。
2.  **動的演出の復元**: 
    - 保存されていた背景・キャラを「フェードなし」で瞬時に描画する。
    - 保存されていた BGM を再生開始する。
3.  **再開**: インタプリタの `next()` を呼び出し、実行を再開。

## 3. 保存のタイミング
- セリフ表示中（クリック待ち）の状態のみセーブ可能とします。
- 演出（アニメーション）実行中はセーブを禁止、または演出終了まで待機します。

## 4. UI 連携
- `packages/web` にセーブスロット（4x4のグリッド等）を表示する画面を実装。
- スロットクリック時に `IStorage.save(slotId, snapshot)` を非同期で実行。

---
*Created by Gemini CLI Systems Architect.*
