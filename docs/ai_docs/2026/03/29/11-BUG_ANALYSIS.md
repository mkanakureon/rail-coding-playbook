# フィルター機能バグ分析・リスクアセスメント報告書 (2026-03-29)

## 1. 概要
コミット `4b7ebf9` および `85bedc4` で実施されたフィルター関連の変更に対し、修正漏れや新たなデグレード、および潜在的な不具合リスクを精査した。

## 2. 修正済みバグの再検証 (Status: Resolved)
以下の5件の主要なバグは、最新のソースコードにおいて正しく修正されていることを確認した。

| 項目 | 修正内容 | 検証結果 |
| :--- | :--- | :--- |
| **Mapping Error** | `pixelate` が `FamicomFilter` に割り当てられていた不具合を `PixelateFilter` へ修正。 | OK (ScreenFilter.ts) |
| **Operator Precedence** | `DustFilter` のアルファ計算 `0.4 + 0.6 * sin(...) * 0.5 + 0.5` に括弧を追加し、値が [0.4, 1.0] に収まるよう修正。 | OK (DustFilter.ts) |
| **Alpha Mismatch** | `ChromaticAberrationFilter` で色収差オフセット時にアルファが不自然に欠ける問題を `maxAlpha` による再合成で解消。 | OK (ChromaticAberrationFilter.ts) |
| **Dead Code** | `ScreenFilter.brightness` の第2引数（multiply）が固定値 `false` であった設計上の不備を明示化。 | OK (ScreenFilter.ts) |
| **Comment Fix** | `PC98Filter` のタイリング比率に関する誤ったコメントを修正。 | OK (PC98Filter.ts) |

## 3. 潜在的リスクと改善推奨事項 (Status: Warning)
致命的ではないが、特定の条件下で微細な表示不整合やノイズが発生する可能性がある箇所が2点特定された。

### A. 行列合成の計算順序 (`ScreenFilter.ts`)
- **箇所**: `applyColorAdjust` メソッド内の色温度行列 (`tempMatrix`) の合成処理。
- **詳細**: 現在の実装では `cur * tempMatrix`（現在の行列に色温度を掛ける）順序で計算されている。
- **リスク**: 数学的には「色温度を先に適用し、その結果に対して明るさ・コントラストを適用する」挙動となる。通常、ユーザーは「調整済みの画面全体に色温度を載せる」ことを期待するため、順序を `tempMatrix * cur` に入れ替える方がより直感的（かつオフセット値の干渉が少ない）な結果が得られる可能性がある。
- **優先度**: 低（見た目上の破綻は極めて少ない）

### B. エッジサンプリング時の色漏れ (`ChromaticAberrationFilter.ts`)
- **箇所**: `ChromaticAberrationFilter` のフラグメントシェーダーにおける `texture()` サンプリング。
- **詳細**: `vTextureCoord ± off` で座標が [0.0, 1.0] を超えた際のクランプ処理がシェーダー内で行われていない。
- **リスク**: PixiJS のテクスチャ設定が `REPEAT` になっている場合、画面の端に反対側の色が 1px 程度の線（赤または青）として漏れてくる可能性がある。
- **対策**: `texture(uTexture, clamp(vTextureCoord + off, 0.0, 1.0))` のように明示的にクランプするか、エンジン側でテクスチャの `wrapMode` が `CLAMP_TO_EDGE` であることを保証する必要がある。
- **優先度**: 中（高解像度ディスプレイや特定端末でエッジノイズとして視認される可能性がある）

## 4. 結論
現在のコードベースは、コミット `4b7ebf9` による網羅的なバグ修正とユニットテストの導入により、極めて高い信頼性を維持している。上述の潜在的なリスクについても、通常のプレイ環境では無視できるレベルであり、現時点での緊急の修正は不要と判断する。

次回の定期メンテナンスまたは大規模なリファクタリング時に、上記 2 点の微修正を取り込むことを推奨する。

---
*分析実施者: Gemini CLI (Strategic Orchestrator)*
*日付: 2026年3月29日*
