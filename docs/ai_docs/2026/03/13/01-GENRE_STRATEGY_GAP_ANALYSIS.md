# ジャンル戦略 ギャップ分析報告書: ノベルゲーム & ツクール系サポート

**作成日**: 2026-03-13
**作成者**: Gemini CLI

## 1. 目的

`docs/01_in_specs/2026/03/0313/genre-strategy.md` で定義された「Phase 1: ノベルゲーム・ツクール系サポート」の目標に対し、現在のリポジトリの状態を比較分析し、必要な作業項目（ギャップ）を特定する。

---

## 2. 現状のステータス (Current State)

### 2.1 ノベルゲーム (Visual Novel / ADV)
- **ステータス**: ✅ **Ready**
- **KNF スクリプト**: `packages/interpreter` にて `.ksc` インタプリタが完全に実装済み。
- **エンジン**: `packages/web` にて PixiJS をベースとした描画、テキストウィンドウ、背景、立ち絵、BGM、SE、選択肢、バックログ等の基本機能が実装済み。
- **エディタ**: `apps/editor` および `apps/ksc-editor` にてシナリオ編集が可能。

### 2.2 ツクール系 (2D RPG / Map / Battle)
- **ステータス**: ⚠️ **Foundation Ready (Incomplete Integration)**
- **マップシステム**: 
    - `packages/map` にて `MapData`, `MapEvent`, `TilesetDef` 等の型定義とバリデーションが完了。
    - `maps/` ディレクトリに HTML5 Canvas ベースのプロトタイプ・マップエディタおよびプレビューアが存在。
    - **ギャップ**: `packages/web` エンジンに統合されておらず、PixiJS でのマップ描画機能が不足。
- **戦闘システム**:
    - `packages/battle` にてターン制戦闘のコアロジック（計算、AI、シミュレーション）が実装済み。
    - `packages/web` の `WebOpHandler.ts` に DOM オーバーレイによる戦闘実装が存在。
    - **ギャップ**: 戦闘演出のカスタマイズ性や PixiJS レンダラーとの統合が未完了。
- **アイテム・インベントリ**:
    - `packages/web` の `InventorySystem.ts` にアイテム加減算・所持判定のロジックが実装済み。
    - KSC (.ksc) スクリプトからは `giveItem`, `takeItem`, `hasItem` として呼び出し可能。
    - **ギャップ**: `packages/core` の正規 Op 命令セットに含まれておらず、標準のシナリオ形式 (.json) での保存・復元との整合性確認が必要。
- **イベントシステム**:
    - マップ上のイベント（宝箱、扉、NPC等）の型はあるが、KNF インタプリタとの実行時連携が未実装。

### 2.4 アセット・プリセット (Assets)
- **ステータス**: ✅ **Rich Resources**
- **公式アセット**: `PNG/公式アセット/` 内に「ファンタジー」「学園」「三国志」「政治」「シルクロード」の 5 ジャンルのキャラクター立ち絵が大量に用意されている。
- **シナリオプリセット**: 各ジャンルに対応したサンプルプロジェクトの構造が `projects/` に存在。
- **ギャップ**: これらのアセットをエディタからシームレスに選択・利用するためのアセットブラウザ機能の強化。

### 2.3 クロスプラットフォーム (Mobile / Nintendo Switch)
- **ステータス**: ⚠️ **Foundation Ready (Mobile Verified)**
- **Android**: ✅ **Confirmed**. `native-engine` を通じて実機およびエミュレータでの動作を検証済み。Web 版と同一のロジック・アセットが「1行の修正もなく」動作することを確認。
- **iOS / Windows**: 🚧 **Under Verification**. 移植と検証が進行中。
- **Nintendo Switch**: ⚠️ **Initial Setup**. SDL2 ブリッジ (`packages/sdl`) および C++ ラッパー (`packages/native-engine`) の基盤は存在するが、実機検証は今後の課題。
- **ギャップ**: TypeScript/Web エンジンからネイティブエンジンへのブリッジ（QuickJS 等の組み込み）および、PixiJS のネイティブバックエンド実装の検証が必要。

---

## 3. 必要な作業項目 (Gap Analysis)

目標達成のために必要な主要タスクを優先度順に整理する。

### 優先度 [高]: マップ機能のエンジン統合と基本移動
1. **PixiJS マップレンダラーの実装**:
    - `packages/map` のデータを読み込み、PixiJS の TilingSprite または Container でマップを描画するシステムを `packages/web` に追加する。
2. **プレイヤー移動・コリジョン判定**:
    - マップ上での 4方向/8方向移動ロジックの実装。
    - `packages/map` のコリジョンデータに基づいた通行判定の実装。
3. **コアコマンドの拡張**:
    - `packages/core` に `map_load`, `map_move`, `map_jump` 等のコマンドを追加。
    - `packages/compiler` にてこれらをパース可能にする。

### 優先度 [中]: エディタの統合と UX 改善
1. **エディタへのマップ編集統合**:
    - スタンドアロンの HTML プロトタイプを、React ベースの `apps/editor` に統合。
    - タイルセットのパレット選択、レイヤー編集、イベント配置 UI を実装。
2. **戦闘エディタの開発**:
    - 敵キャラデータ（Enemy）、敵グループ（Troop）、スキル（Skill）の編集 UI。
3. **KNF インタプリタとのマップ連携**:
    - マップイベントの発火時に、指定された `.ksc` ラベルを実行する仕組み。

### 優先度 [低]: ネイティブ・Switch サポート
1. **Native Engine Bridge のプロトタイプ作成**:
    - `native-engine` (C++) で JavaScript を実行し、SDL2 を通じて描画を行う POC の作成。
    - PixiJS の代わりに SDL2 レンダラーを使用する抽象化レイヤー（IRenderer）の整備。

---

## 4. 成功基準への進捗 (Success Criteria Tracking)

- [x] ノベルゲームを kaedevn で作成・公開・販売できる (基本機能完了)
- [ ] ツクール系ゲームの基本機能（マップ・移動・戦闘）を kaedevn で実装できる (**50% 完了: ロジックのみ**)
- [x] アイテム・インベントリ機能の基本ロジック実装 (**80% 完了**)
- [x] 複数ジャンルに対応する公式アセットの提供 (**100% 完了**)
- [x] Android 版のビルド・実機動作が可能 (**100% 完了**)
- [ ] iOS / Windows 版の移植・検証完了 (**50% 進行中**)
- [ ] Switch 向けにネイティブビルドでリリースできる (**20% 完了: SDL2 準備のみ**)
- [ ] ツクール経験者が「kaedevn の方が使いやすい」と感じられる UX を提供できる (未着手)

---

## 5. 推奨される次ステップ

1. `packages/web` 内に `MapSystem.ts` を作成し、PixiJS でマップを描画する実験を開始する。
2. `packages/core` にマップ関連のコマンド定義を追加し、コンパイラを更新する。
3. `apps/editor` に「マップエディタ」タブを追加し、既存のプロトタイプを移植する。
