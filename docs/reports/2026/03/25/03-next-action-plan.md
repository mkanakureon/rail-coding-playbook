# kaedevn 今後のアクション計画書

> 作成日: 2026-03-25 | 現状のコミット: `b333d75`

## 現状サマリー

| 領域 | 状態 |
|------|------|
| フィルター (53種) | 完成・ギャラリー撮影済み |
| パーティクル・色調補正 | エンジン統合済み |
| Live2D | 統合済み (Hiyori モデル) |
| ブロックエディタ | 動作するが expressionId バグあり |
| ネイティブエンジン | IRenderer + SoftRenderer 完成、GLRenderer 実装中 |
| ツクール型エディタ | Gemini CLI が別ブランチで実装中 |

---

## A. 短期（すぐやれる）

### A-1. expressionId プレビュー未表示バグの修正

**問題**: キャラブロックで表情を選択しても、プレビュー API が `@ch` コマンドを生成しない。`expressionId` が空のまま保存されている。

**対応箇所**:
1. `ChBlockCard.tsx` — expressionId 自動設定の修正（途中まで実装済み）
2. `apps/hono/src/routes/preview.ts` の `generateChCommand()` — expressionId の ID→slug 変換の確認
3. `apps/editor/src/store/useEditorStore.ts` — `buildSnapshotScript` が expressionId を含んでいるか確認

**工数**: 小（調査 + 修正で 1 セッション）

### A-2. フィルターギャラリーの公開準備

**完了済み**: 53 枚のスクリーンショット撮影 + ギャラリー文書

**残タスク**:
- スクリーンショット画像の Azure Blob へのアップロード（必要なら）
- エディタ UI からフィルターを選択する際のプレビューサムネイル表示

### A-3. ネイティブエンジンのユニットテスト整備

**現状**: 7 テストファイルあり（Parser, Evaluator, Interpreter, GameState, AssetProvider, Screenshot, PakReader）

**やれること**:
- GLRenderer のテスト追加（フレームバッファ・シェーダーコンパイル）
- SoftRenderer のテスト追加（描画結果のスクリーンショット比較）

---

## B. 中期（数セッションかかる）

### B-1. GLRenderer の完成（Phase 2）

**現状**: 骨格は実装済み（VAO/VBO/EBO、シェーダー、フレームバッファ）

**残タスク**:
- シェーダーアセットの WebGL2 ↔ OpenGL ES 3.0 共有パイプライン構築
- フィルター（ポストプロセス）のネイティブ移植
- SDL2Engine での SoftRenderer → GLRenderer 切り替え機構

**価値**: Web と Native でフィルター・シェーダーを共有できる = 競合との差別化ポイント

### B-2. エディタのフィルター/エフェクト UI

**現状**: フィルターはエンジン内部で動作するが、エディタ UI から設定する手段がない

**やれること**:
- `@filter` / `@color_adjust` ブロックの追加（ブロックエディタに新カード）
- フィルター選択 UI にサムネイルギャラリーを表示
- パラメータスライダー（intensity, 個別パラメータ）

### B-3. KSC エディタ（port 5177）の機能強化

**現状**: 基本的な KSC スクリプト編集のみ

**やれること**:
- シンタックスハイライト（`@` コマンド、変数、条件分岐）
- オートコンプリート（コマンド名、キャラ slug、アセット ID）
- リアルタイムプレビュー連携

### B-4. セーブ/ロード機能の Web 実装

**現状**: Save Schema は frozen（定義済み）、IStorage 抽象化は設計済み

**やれること**:
- IndexedDB バックエンドの実装
- セーブスロット UI（サムネイル + タイムスタンプ）
- `vars` / `read` の永続化とリストア

---

## C. 長期（アーキテクチャ寄り）

### C-1. Switch ポーティング準備

**前提**: IRenderer / IInput / IAudio / IStorage の 4 抽象化がキー

| 抽象化 | Web 実装 | Native 実装 | Switch 対応 |
|--------|----------|-------------|-------------|
| IRenderer | PixiJS | SoftRenderer + GLRenderer | Nintendo SDK |
| IInput | PixiJS events | SDL2 events | 未着手 |
| IAudio | Web Audio API | SDL2_mixer | 未着手 |
| IStorage | (未実装) | FileStorage | 未着手 |

**次のステップ**: IInput と IAudio のネイティブ実装を SDL2 ベースで完成させる

### C-2. PAK アーカイブフォーマットの本番運用

**現状**: PakReader + pak_tool CLI が実装済み

**やれること**:
- アセットのパッキングパイプライン（ビルド時に自動 PAK 化）
- ランタイムでの PAK 読み込み統合（AssetProvider → PakReader）
- 暗号化・圧縮オプション（Switch 配信用）

### C-3. CI/CD の強化

**現状**: GitHub Actions で main push → Azure 自動デプロイ

**やれること**:
- ネイティブエンジンのクロスコンパイル CI（macOS / Linux / Windows）
- E2E テスト（Playwright）の CI 統合
- フィルタースクリーンショットの回帰テスト（画像差分比較）

---

## 優先度マトリクス

```
影響大 ┃ B-1 GLRenderer    │ C-1 Switch準備
       ┃ B-2 フィルターUI   │ C-2 PAK運用
───────╋──────────────────┼────────────────
影響小 ┃ A-1 expressionId  │ C-3 CI強化
       ┃ A-2 ギャラリー公開 │ B-3 KSCエディタ
       ┃ A-3 テスト整備     │ B-4 セーブ/ロード
───────╋──────────────────┼────────────────
       ┃    工数小          │    工数大
```

## 推奨: 次にやること

1. **A-1** expressionId バグ修正 — 未コミットの修正が途中なので仕上げる
2. **B-2** フィルター/エフェクトブロックの追加 — 53 種のフィルターをエディタから使えるようにする
3. **B-1** GLRenderer 完成 — シェーダー共有でネイティブとWebの統一が進む
