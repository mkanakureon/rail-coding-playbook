# ブラウザ2画面同時編集 — 検討メモ

**日付**: 2026-02-20
**ステータス**: 検討中（未着手）

## 課題

同じプロジェクトを2つのブラウザタブ/ウィンドウで開いて編集できるか？

## 現状

- `useEditorStore` (zustand) はインメモリのみ。タブ間で共有されない
- 2タブで同じプロジェクトを開くと、それぞれ独立に `GET /api/projects/:id` でfetchして別々のstateを持つ
- 一方で保存 → もう一方には反映されない → 後から保存した方が上書きする（Last Write Wins）

## 対策案

### 案1: BroadcastChannel API（推奨）

- 同一オリジンの複数タブ間でメッセージを送受信
- 保存時に `channel.postMessage({ type: 'project-updated', project })` で通知
- 他タブが受信して `setProject()` で反映
- **メリット**: 実装が軽い（50行程度）、外部依存なし、ブラウザ標準API
- **デメリット**: 同一ブラウザ内のみ（別デバイス不可）

```ts
// 実装イメージ
const channel = new BroadcastChannel('kaedevn-editor');

// 送信側（保存成功後）
channel.postMessage({ type: 'project-updated', projectId, data: project });

// 受信側
channel.onmessage = (event) => {
  if (event.data.type === 'project-updated' && event.data.projectId === currentProjectId) {
    setProject(event.data.data);
  }
};
```

### 案2: localStorage + storage イベント

- 保存時に `localStorage.setItem('project-sync', JSON.stringify({ ... }))` に書き込み
- 他タブが `window.addEventListener('storage', ...)` で検知
- **メリット**: BroadcastChannelと同程度の軽さ
- **デメリット**: 大きなデータをlocalStorageに書くのは非効率、5MBの容量制限

### 案3: Server-Sent Events (SSE)

- サーバーが保存イベントを購読中のクライアントにpush
- `GET /api/projects/:id/events` → EventSource
- **メリット**: 別デバイス間でも同期可能
- **デメリット**: サーバー側の実装が必要、Hono APIに変更が必要

### 案4: WebSocket

- リアルタイム双方向通信
- **メリット**: 最もリアルタイム性が高い、OT/CRDTで同時編集も可能
- **デメリット**: 実装コスト大、インフラ変更必要

## 推奨方針

1. **Phase 1**: BroadcastChannel で同一ブラウザ内のタブ同期（低コスト）
2. **Phase 2**: 必要に応じてSSEで別デバイス同期を追加

## 考慮事項

- コンフリクト検出: 両方で同時編集した場合の競合。まずはLast Write Winsで許容し、将来的にoptimistic lockingを検討
- `updatedAt` をバージョンとして使い、保存時にサーバー側で `updatedAt` が一致しなければ409を返す方式も可能
- ページ単位での部分同期（全プロジェクトではなく編集中ページのみ同期）も検討の余地あり
