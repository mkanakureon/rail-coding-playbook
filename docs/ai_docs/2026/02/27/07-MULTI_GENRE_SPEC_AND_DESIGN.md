# 技術設計書：マルチジャンル対応拡張 (v0.1)

**日付**: 2026-02-27
**起草者**: Gemini CLI
**ステータス**: 設計レビュー中

---

## 1. 設計目標

1.  **後方互換性の維持**: 既存のノベルゲームスクリプトが修正なしで動作すること。
2.  **ポータビリティの継承**: Web/Native 両ランタイムでの「一行の修正もなし」を全ジャンルで維持する。
3.  **データ駆動型 UI**: バトル画面やメニュー画面を、エンジンを再ビルドせずに KSC（または定義ファイル）から動的に構築可能にする。
4.  **AI 親和性**: AI が複雑なステータス計算や AI ロジックを容易に生成できる命令体系にする。

---

## 2. 拡張仕様 (Specification)

### 2.1 データ構造の拡張 (Advanced State)
現在の変数は単一の値（スカラー）のみだが、RPG 展開のために以下のデータ型をサポートする。

*   **Object / Array**: `party[0].hp = 100` のような構造。
*   **Scoped Variables**: `global` (全データ共有), `save` (セーブデータ依存), `temp` (実行時のみ) の分離。

### 2.2 新規命令セット (Extended Command Set)

| カテゴリ | 命令 | 説明 |
|:---|:---|:---|
| **Battle** | `battle_start(troopId, onWin, onLose)` | バトルシーンの開始 |
| | `battle_command(actorId, actionId, targetId)` | バトルのアクション実行 |
| **Map** | `map_load(mapId, x, y)` | タイルマップの読み込みと初期位置 |
| | `map_move(x, y)` | 指定座標への移動（テレポート） |
| **System** | `ui_show(uiId, data)` | カスタムUI（HPバー、メニュー等）の表示 |
| | `inventory_add(itemId, count)` | アイテム管理の抽象化 |

---

## 3. アーキテクチャ設計 (Technical Design)

### 3.1 IEngineAPI の拡張
Native 層 (`SDL2Engine`) および Web 層 (`WebOpHandler`) に追加すべきインターフェース。

```cpp
class IEngineAPI {
    // ...既存の命令...

    // タイルマップ描画
    virtual void drawMap(const std::string& mapId, int layer, int cameraX, int cameraY) = 0;
    
    // スプライト（歩行グラ等）の描画
    virtual void drawSprite(const std::string& assetId, int x, int y, int frame) = 0;

    // 動的UI要素
    virtual void setUIElement(const std::string& id, const UIProps& props) = 0;
};
```

### 3.2 汎用バトルエンジンのプラグイン化
各ジャンルのロジックを KSC 側で記述するための「イベント・フック」モデル。

1.  **KSC 側での定義**: `def calculate_damage(atk, def) { return atk * 2 - def; }`
2.  **エンジン側からの呼び出し**: バトル進行中に、エンジンが KSC 内の特定の関数をコールバックして数値を決定する。
3.  **メリット**: バトルバランスの調整を C++ の再ビルドなしで（Web プレビューですぐに）行える。

### 3.3 タイルマップ・フォーマット
ポータビリティを維持するため、Tiled (TMX) 等の標準形式を JSON に変換して使用する。

*   **AssetProvider**: `"map_01"` という ID に対し、JSON 形式のマップデータと、対応するタイルセット画像を返す。

---

## 4. UI 抽象化レイヤー (Dynamic UI Design)

ノベルゲーム以外のジャンルでは、固定のテキストウィンドウ以外に「HPバー」「アイテムリスト」「スキルボタン」が必要になる。

*   **UI 定義 (JSON)**:
    ```json
    {
      "id": "hp_bar",
      "type": "progress_bar",
      "x": 100, "y": 650,
      "binding": "party[0].hp / party[0].max_hp"
    }
    ```
*   **同期メカニズム**:
    KSC 内で `party[0].hp` が書き換わった際、エンジンが自動的に UI の表示を更新する。これにより、UI 実装のプラットフォーム依存を完全に排除する。

---

## 5. 開発フェーズ (Milestones)

### Phase 1: データエンジンの強化 (KSC 2.0)
*   Object/Array の完全サポート。
*   Interpreter での関数定義 (`def`) と呼び出しの安定化。

### Phase 2: バトルモジュール (Battle MVP)
*   `battle_start` コマンドの実装。
*   KSC 側での「コマンド選択 → ダメージ計算 → アニメーション」のフロー完成。

### Phase 3: マップモジュール (Map MVP)
*   タイルマップ描画の `IEngineAPI` 実装（SDL2 / PixiJS 両方）。
*   キャラクターの歩行と、マップ上のイベントトリガー（接触判定）。

---

## 6. 評価基準

*   **Zero Mod Check**: バトルシーンを含む RPG を作成し、Web で動かしたものが Android で「1行も直さずに」動くこと。
*   **Performance Check**: タイルマップ上で 100 体のスプライトを動かしても、全プラットフォームで 60fps を維持すること。
*   **AI Ease Check**: AI に「敵の属性相性表」を渡した際、正しい KSC 命令（`if/else`）を生成できること。

---
本設計書は、kaedevn を単なる「読み物」の再生機から、**「システムと物語が融合した総合エンターテインメント基盤」**へと昇華させるための地図である。
