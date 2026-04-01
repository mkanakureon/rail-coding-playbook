# 振り返り: タイムラインシーク同期の不具合

**日付:** 2026-02-20
**対象コミット:** `49d46f2`

## 何がダメだったのか

### 問題1: state の置き場所が浅すぎた

**初回実装:** `currentTimeMs` / `isPlaying` を `SidebarInspector` に配置

```
EditorPage
  ├── SidebarInspector (currentTimeMs をここで管理 ← 問題)
  │   ├── TimelineProps (プロパティパネル) ← 同期OK
  │   └── TimelinePreview (プレビュー)     ← 同期OK
  └── TimelinePanel (タイムラインパネル)     ← 完全に独立、同期しない!
```

`SidebarInspector` と `TimelinePanel` は兄弟コンポーネントなので、`SidebarInspector` 内のstateは `TimelinePanel` に到達できない。

**修正:** `EditorPage` まで引き上げて全3箇所に配信

```
EditorPage (currentTimeMs をここで管理)
  ├── SidebarInspector (props で受け取り)
  │   ├── TimelineProps     ← 同期OK
  │   └── TimelinePreview   ← 同期OK
  └── TimelinePanel          ← onTimeChange コールバックで同期OK
```

### 問題2: コンポーネント間の依存関係を事前に確認しなかった

プランニング時に `SidebarInspector` と `TimelinePreview` の関係だけ見て、`TimelinePanel`（画面下部のフルタイムライン）の存在を見落とした。

エディタ画面には「同じ時間軸を共有すべきUI」が3箇所あったが、2箇所しか認識していなかった:

| UI | 場所 | 認識 |
|----|------|------|
| プロパティシークバー | 右サイドバー上部 | 認識していた |
| プレビュー再生/シーク | 右サイドバー下部 | 認識していた |
| タイムラインパネル | 画面下部 | **見落とした** |

### 問題3: 値テーブルの視認性

初回の値テーブルは:
- 2カラムグリッドで狭すぎ（右サイドバー280px内に詰め込み）
- フォントサイズ 10px で読みづらい
- どの値が変化しているかわからない

## 根本原因

1. **state lifting の設計時に、共有すべきコンポーネントの全数を確認しなかった**
   - `selectedBlockId` の変更で影響するコンポーネントを全てリストアップすべきだった
2. **EditorPage.tsx のレンダリング構造を事前に読まなかった**
   - `TimelinePanel` が `SidebarInspector` の外にあることを確認すれば防げた

## 再発防止策

### 1. State lifting 時のチェックリスト

state を引き上げるときは以下を確認する:

- [ ] その state を参照/更新するコンポーネントを **全てリストアップ** する
- [ ] リストアップしたコンポーネントの **共通の最小祖先** を特定する
- [ ] 共通祖先に state を配置する（それより浅い場所に置かない）
- [ ] `EditorPage.tsx` の render 構造を必ず確認する

### 2. 同一ドメインの state は1箇所で管理

「タイムラインの現在位置」のように、複数UIが共有する概念は:

- 最初から最上位（ページレベル）で管理する
- 各コンポーネントは `value` + `onChange` の controlled パターンで受け取る
- ローカル state にしていいのは「そのコンポーネント内で完結する値」のみ

### 3. UI 改善時は実際の幅で確認

- サイドバー幅のデフォルト値と、その中に配置するテーブルの見え方を事前に検討する
- フォントサイズ 10px 以下は避ける（11px 以上を基準にする）
- 変化量がわかる視覚的インジケータ（バーグラフ、色変化）を積極的に使う

## 修正ファイル

| ファイル | 変更内容 |
|----------|----------|
| `EditorPage.tsx` | `tlCurrentTimeMs` / `tlIsPlaying` を追加、子に配信 |
| `SidebarInspector.tsx` | ローカル state 削除 → props 受け取りに変更、値テーブル改善 |
| `TimelinePreview.tsx` | controlled 化（props で時間/再生状態を受け取り） |
| `TimelinePanel.tsx` | `onTimeChange` / `onPlayChange` コールバック追加 |
| `tests/timeline-props-seek.spec.ts` | E2E テスト新規作成 |
