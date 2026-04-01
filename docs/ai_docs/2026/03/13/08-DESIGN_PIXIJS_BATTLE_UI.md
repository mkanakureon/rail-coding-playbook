# 詳細設計書: PixiJS バトル UI & 演出

**作成日**: 2026-03-13
**対象**: `packages/web/src/renderer/ui/BattleUI.ts`

## 1. 目的
DOM による簡易戦闘 UI を廃止し、PixiJS レンダラー内でゲーム世界と調和した戦闘画面を構築する。

## 2. 画面構成 (PixiJS Layering)

1.  **BattleBackground**: 戦闘背景（マップの `MapData.terrain` に応じて自動選択）。
2.  **EnemyContainer**: 敵スプライト。出現時のアニメーション、被弾エフェクト、消滅時のフェード。
3.  **EffectLayer**: スキル演出（パーティクル、フラッシュ）。
4.  **BattleHud**:
    - `ActorStatusPanel`: 味方の HP/MP/名前。
    - `CommandMenu`: 攻撃、スキル、防御、アイテムの選択肢。
    - `MessageWindow`: 戦闘ログ（「スライムが現れた！」等）。

## 3. 主要ロジック

### `BattleManager` (Web Bridge)
- `packages/battle` の `simulate()` ロジックを、逐次実行（Step-by-step）形式に変換して、アニメーションと同期させる。
- `ActionQueue`: 入力されたアクションを順番に実行し、各アクションごとに演出（アニメーション、ダメージ表示）を待機させる。

### `DamagePopUp`
- ダメージ数値を浮き上がらせてフェードアウトさせる PixiJS オブジェクト。
- クリティカルやミスなどのテキスト表示。

## 4. 演出の同期 (Wait System)
- `BATTLE_START` 命令は非同期 (`async`) で実行され、戦闘終了（WIN/LOSE/DRAW）が確定するまでメインの `OpRunner` を待機させる。
- 各ターンの演出終了を `await` し、次のターンへ移行する。

## 5. モバイル対応
- **タッチ操作**: 画面左右のボタンや、敵キャラクターを直接タップしてのターゲット選択。
- **セーフエリア**: モバイルのノッチを考慮した UI レイアウトの自動調整。
