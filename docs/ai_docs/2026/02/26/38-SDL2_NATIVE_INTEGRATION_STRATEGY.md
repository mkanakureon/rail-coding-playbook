# SDL2 ネイティブ移植：統合戦略と Source of Truth

**作成日**: 2026-02-26
**対象**: Switch 移植担当、C++/SDL2 エンジニア
**参照**: docs/01_in_specs/0221 および 0225 の SDL2 関連ドキュメント

## 1. 開発の基本方針：TS 版との同期
本プロジェクトでは、Web 版 (TS + PixiJS) を「リファレンス実装」とし、本番/Switch 版 (C++ + SDL2) を「最適化実装」として並行運用する **Dual-Engine 戦略** を採用します。

### 1.1 同期すべき核心部
- **Kaede Script (.ksc)**: TS 版インタプリタと C++ 版インタプリタで 100% 同一のファイルを読み込めるようにします。
- **Asset Slug システム**: `Asset` テーブルの `slug` による間接参照を SDL2 側でも維持し、アセット管理の整合性を担保します。

## 2. SDL2 レンダリングエンジンの実装要件 (Phase 2)

これまでの検討に基づき、以下のコンポーネントを `packages/switch` (将来) またはネイティブプロジェクト内で実装します。

- **SDL2Renderer**:
    - `SDL_Renderer` を使用したアルファブレンディング。
    - PNG 重ね描画による立ち絵・背景の表示。
    - 自前配列によるスプライトバッチング（描画負荷軽減）。
- **SDL2Audio**:
    - `SDL_mixer` による BGM (Ogg/Vorbis) および SE/Voice (Wav) の再生。
- **SDL2Input**:
    - `SDL_Event` を購読し、Joy-Con やプロコンのボタンをエンジンの `Action` (OK, Back, Skip等) へマッピング。

## 3. ライセンスと移植性の確信
- **無料かつ高移植性**: SDL2 は zlib ライセンスであり、Switch 向けの公式サポートが Nintendo から提供されているため、技術的・法的な障壁が極めて低いことを再確認。
- **Claude Code の活用**: SDL2 は歴史が長く情報が豊富なため、Claude Code による実装支援が最大限に活きる領域です。

## 4. 結論：何が「正解」か
これまでのドキュメントを統合すると、**「TS 版で UI とシナリオを確定させ、SDL2 版でパフォーマンスと移植性を担保する」** という棲み分けが、本プロジェクトの完成形（ Source of Truth ）となります。

---
*Synthesized from legacy docs/01_in_specs and 09_reports by Gemini CLI.*
