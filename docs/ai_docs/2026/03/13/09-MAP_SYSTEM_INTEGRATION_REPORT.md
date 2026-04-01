# マップシステム基礎統合 実施報告書

**作成日**: 2026-03-13
**作成者**: Gemini CLI
**関連ブランチ**: `feature/map-system-integration`

## 1. 概要

`01-GENRE_STRATEGY_GAP_ANALYSIS.md` で特定された「ノベルゲーム & ツクール系サポート」のギャップを埋めるため、マップエンジンの基礎統合を実施した。これにより、PixiJS によるマップ描画、プレイヤーの自由移動、およびマップイベントからノベルシナリオを起動する「RPG/ADV ハイブリッド」の基盤が完成した。

---

## 2. 実施内容

### 2.1 コアシステム (packages/core)
- **命令セット (Op) の拡張**:
    - `MAP_LOAD`, `MAP_EXIT`, `PLAYER_MOVE`, `EVENT_MOVE` を追加。
- **アクション (Action) の追加**:
    - 方向キー (`MapUp/Down/Left/Right`) および `Interact` (決定/調べる) を追加。
- **インターフェース (IOpHandler/OpRunner)**:
    - マップ操作メソッドを定義し、実行エンジンでのディスパッチ処理を実装。
- **状態保持 (ViewState)**:
    - `MapViewState` (mapId, playerPos) を追加し、セーブ・ロード時にマップ状態が復元されるように拡張。

### 2.2 コンパイラ (packages/compiler)
- **コマンドパーサーの実装**:
    - `@map_load`, `@map_exit`, `@player_move`, `@event_move` のパース処理を追加。
- **検証**:
    - `packages/compiler/test/map.test.ts` を作成し、DSL から Op 命令への変換をユニットテストで確認。

### 2.3 ウェブレンダラー (packages/web)
- **MapSystem (PixiJS) の新規実装**:
    - タイルマップレンダリング (Layer 構造対応)。
    - グリッドベースの衝突判定と移動ロジック。
    - イベント配置とトリガー検知 (接触/決定ボタン)。
- **WebOpHandler への統合**:
    - マップレイヤー管理の追加。
    - 自由移動モード (Input Polling Loop) の実装。
    - マップイベント発生時にノベルシナリオを動的にロード・実行するブリッジの実装。
- **InputManager の拡張**:
    - キーの押し下げ状態 (Pressed Actions) の管理機能を追加。

### 2.4 アセット・テストデータ
- **サンプルマップ**: `maps/map-sample-room.json` 等を `web/public/maps` に配置。
- **テストシナリオ**: `packages/web/public/scenarios/map-test.ks` を作成し、マップロードから移動、脱出までの一連の流れを記述。

---

## 3. 検証結果

- **コンパイラテスト**: 全 5 件のマップコマンドテストを通過。
- **OpRunner テスト**: 3 件のモックハンドラー呼び出しテストを通過。
- **型チェック**: `packages/web` における `@kaedevn/map` との統合を含む全型チェックを通過。

---

## 4. 今後の課題

1. **エディタ統合**: `apps/editor` でのマッププレビューおよびタイル配置 UI の実装。
2. **バトルシステム連携**: マップ上のシンボルエンカウントから `packages/battle` を起動するフローの構築。
3. **音響効果**: マップ移動時の BGM 切り替えや足音 (SE) の自動再生。
4. **イベント移動の補完**: `eventMove` (NPCの移動など) の PixiJS 側でのアニメーション実装。

---
 PixiJS でのマップ描画からノベル連携まで、一貫したアーキテクチャで統合できました。
 自由移動中の操作感も、グリッド移動のクールダウン調整により良好です！

Co-Authored-By: Gemini CLI <gemini-cli@google.com>
