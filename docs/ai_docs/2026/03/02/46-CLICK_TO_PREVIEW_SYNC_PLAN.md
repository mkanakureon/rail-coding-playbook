# クリック・プレビュー同期（CPC）機能の実装計画書

## 1. 概要
エディタ上のブロックをクリックした際、そのブロックに至るまでの演出状態をプレビュー画面（右下パネル）に即座に反映させる機能を実装します。これにより、制作者は「特定時点の見た目」をリロードなしで瞬時に確認可能になります。

## 2. 実装の基盤（既存資産の活用）
- **データ生成**: `useEditorStore.ts` の `buildSnapshotScript(blockId)` を使用。
- **通信**: エディタからプレビュー `iframe` への `postMessage` 経由のスクリプト送信。
- **描画**: `WebOpHandler.ts` の `reset()` メソッドと、送信されたスナップショットスクリプトの即時実行。

## 3. 具体的な実装手順

### Step 1: エディタ側でのイベントフック
各ブロックコンポーネント（`BgBlockCard.tsx` 等）のクリックイベント、あるいは `BlockList.tsx` 全体でのセレクションイベントを検知します。

```typescript
const handleBlockClick = (blockId: string) => {
  const snapshot = buildSnapshotScript(blockId);
  previewWindow.postMessage({ type: 'UPDATE_SNAPSHOT', script: snapshot }, '*');
};
```

### Step 2: プレビュー側での受け取りロジック
プレビュー側のエントリーポイント（`KscRunner` 等）で、スナップショット更新メッセージを待ち受けます。

```typescript
window.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_SNAPSHOT') {
    engine.reset(); // 現在の表示をクリア
    engine.runScript(event.data.script); // スナップショットを実行
  }
});
```

### Step 3: 演出の最適化
- **トランジションのスキップ**: スナップショット再生時は、フェード時間などを強制的に `0` に設定し、クリックした瞬間に最終的な見た目が完成するように調整します。

## 4. ユーザー体験（UX）への影響
- **「迷わない」制作**: 大量のブロックの中から「このブロックは何をしているのか？」を視覚的に即座に理解できます。
- **「戻れる」安心感**: 複雑な演出を組んでいる最中でも、前のブロックをクリックするだけで過去の状態に戻って確認できます。

## 結論
「ブロックをクリック ＝ その瞬間のプレイ実行」という直感的な操作系は、Webベースのkaedevnエディタにおいて最も強力なキラー機能となります。既存の `buildSnapshotScript` を UI イベントに繋ぎ込むだけで実現できるため、非常に投資対効果の高い改善項目です。
