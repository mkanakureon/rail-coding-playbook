# WYSIWYG レイアウトエディタ コードレビュー報告書

> **作成日**: 2026-03-18
> **担当**: Gemini CLI
> **対象**: WYSIWYG UIレイアウトエディタ実装（`apps/editor/src/components/layout/*` 等）

## 1. 全体評価
**評価: 優秀（Excellent）**

当初の計画（`07-WYSIWYG_LAYOUT_EDITOR_IMPLEMENTATION_PLAN.md`）では外部ライブラリ `react-rnd` の導入が予定されていましたが、実装担当エージェントはこれを独自実装のドラッグ＆リサイズ処理（`LayoutCanvas.tsx`）に置き換えました。これにより、以下のメリットをもたらす非常に高度な判断と実装が行われています。
1. パッケージ依存の削減（バンドルサイズの軽量化）
2. ゲームエンジンの解像度スケール（scale）との完璧な座標同期
3. Zustandストアを介した単一の真実情報（Single Source of Truth）の維持

各コンポーネントの責務分離も明確であり、Reactのパフォーマンスと保守性が高く保たれています。

---

## 2. コンポーネント別コードレビュー

### `LayoutCanvas.tsx` (ドラッグ＆リサイズキャンバス)
* **GOOD**: スナップ処理（`SNAP = 8`）と、スケール値（`scale`）を考慮したマウス座標の逆算 (`dx / scale`, `dy / scale`) が極めて正確に実装されています。
* **GOOD**: イベント伝播の停止（`e.stopPropagation()`）が適切に行われており、要素選択とキャンバスのクリック解除が競合しません。
* **GOOD**: パフォーマンスを考慮し、ローカルのRef (`dragRef`, `resizeRef`) を用いてドラッグ状態を管理し、Zustand の `updateElementRect` を呼び出す形になっているため、不要な再レンダリングが抑えられています。

### `LayoutPropertyPanel.tsx` (プロパティ編集)
* **GOOD**: `opts.backgroundColor ?? ''` のようにオプショナルな `options` プロパティに対する Nullish Coalescing の使い方が徹底されており、未定義時のフォールバックが安全です。
* **GOOD**: 脱ツクール要件である「背景色指定（transparent含む）」と「枠線の表示/非表示 (`borderVisible`)」が汎用的な `updateOpt` 関数を通じて型安全に実装されています。

### `TestPlayOverlay.tsx` (ランタイム統合)
* **GOOD**: `LayoutAwareGameScreen` というサブコンポーネントへの切り出しが行われており、テストプレイ中の状態管理（ダイアログや戦闘進行）と、UIレイアウト（絶対座標での描画）の責務が美しく分離されています。
* **GOOD**: 画面のアスペクト比とスケール値に基づき、CSS の `absolute` 座標へ変換する処理 (`el.rect.x * scale` 等) が、PixiJSネイティブエンジンへの移植を見据えた論理設計になっています。

### `LayoutEditor.tsx` (全体シェル・入出力)
* **GOOD**: JSONのエクスポート・インポート処理が、Blob APIとFileReaderを用いてブラウザネイティブで完結しており、余計な依存がありません。
* **GOOD**: インポート時に `version: 1` のバリデーションチェックを行っており、将来のデータ構造変更に対する安全網が張られています。
* **GOOD**: `isPortrait` の判定と「Web/Android 専用」の警告バッジ表示ロジックがシンプルかつ的確に実装されています。

### `packages/core/src/presets/smartphone-portrait.json`
* **GOOD**: Z-Index の階層化が適切（オーバーレイ: 50, パーティ: 80, メッセージ: 100, 選択肢: 200）に設計されており、UI同士の重なりバグが発生しない堅牢なプリセットデータとなっています。

---

## 3. 改善提案（Minor）
現状でも十分本番稼働可能ですが、将来的な機能拡張を見据えたマイナーな改善点として以下を挙げます。

1. **Undo/Redo (履歴管理)**
   現状、Zustandの `layout` オブジェクトを直接上書き更新しているため、ドラッグミス時の元に戻す（Ctrl+Z）操作ができません。今後のアップデートで `zundo` プラグイン等を導入し、レイアウト状態の履歴管理を追加することを推奨します。
2. **ドラッグ中の Throttle 処理**
   `handleMouseMove` で毎ピクセルごとに `updateElementRect` (Zustandの更新) が発火しています。現状のパーツ数（最大20程度）であれば問題ありませんが、さらにリッチなUI構築機能を追加する場合は `requestAnimationFrame` や `throttle` による更新頻度の制限を検討してください。

## 4. 結論
本実装は、アーキテクチャのクリーンさ、脱ツクールという戦略目標の達成、および動作の堅牢性のすべてにおいて優れたコードベースです。このまま `main` ブランチへマージ（または採用）して問題ありません。