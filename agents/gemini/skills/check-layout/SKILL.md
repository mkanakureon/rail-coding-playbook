---
name: check-layout
description: Verify UI components against engine constraints (1280x720, Safe Area, relative anchors). Use when asked to review UI, layout, or style code.
---
# Check Layout Skill

kaedevn エンジンの UI 制約（解像度、セーフエリア、レイアウト方式）に準拠しているか確認するためのスキルです。

## エンジン制約
- **論理解像度**: 1280×720
- **セーフエリア**: 5% マージン（左右 64px、上下 36px）
- **レイアウト**: アンカーベースの相対座標（ピクセル単位のハードコードを避ける）

## 確認手順

### Step 1: 解像度の確認
CSS や PixiJS のコード内で、マジックナンバーとしての 1280 や 720 が直書きされていないか確認します。定数を使用しているか、コンテナのサイズに基づいている必要があります。

### Step 2: セーフエリアの確認
重要な UI 要素（ボタン、テキスト、HUD）が画面端から以下の距離を保っているか確認します。
- 左右: 64px 以上
- 上下: 36px 以上

### Step 3: 相対レイアウトの確認
`left: 100px` のような絶対指定ではなく、`left: 50%` や `anchor: 0.5` のような、画面サイズ変更に強い指定になっているか確認します。

## 注意事項
- **Vanilla CSS 優先**: エンジンコアではパフォーマンスと柔軟性のために Vanilla CSS が推奨されます。
- **プラットフォーム抽象化**: 直接的な DOM イベント（`onclick` 等）ではなく、`IInput` 経由のアクション処理になっているか確認してください。
