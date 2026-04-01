# アセット最適化：WebP 自動変換パイプライン設計

**作成日**: 2026-02-26
**対象**: `apps/hono` およびアセット管理システム
**核心**: VRAM 消費とロード時間の削減（特に Switch 移植を見据えて）

## 1. 目的
高解像度の PNG 画像はディスク容量と VRAM を大幅に消費します。
- **解決策**: アップロード時に `sharp` を使用して WebP 形式へ変換。
- **効果**: 品質を維持したまま、ファイルサイズを平均 50%〜80% 削減。

## 2. 変換パイプライン (Implementation Flow)

### 2.1 アップロード時の処理 (`apps/hono`)
1.  **オリジナルの保存**: 念のため元のファイルも保持（または一時保存）。
2.  **WebP 変換**: `sharp(buffer).webp({ quality: 85 }).toBuffer()` を実行。
3.  **メタデータの記録**: `Asset` テーブルに、オリジナルの URL と併せて「最適化済み WebP URL」を記録。

### 2.2 ネイティブエンジン側での優先使用
ネイティブエンジン (`SDL_image` 使用) は WebP をサポートしています。
- **同期スクリプト**: `sync-native.sh` は、WebP 版が存在する場合はそれを `assets/` に優先的に配置します。
- ** slug 解決**: `assets.json` は WebP ファイルを指すように更新されます。

## 3. WebP 設定の推奨値
- **背景 (BG)**: Quality 80 (大面積のため圧縮率重視)。
- **立ち絵 (Character)**: Quality 90 (表情や細部が重要なため高品質維持)。
- **ロスレス**: 透明度（アルファチャンネル）が重要な場合は `lossless: true` を検討。

## 4. 今後の拡張：KTX2 への対応
Switch 本番環境では WebP よりも GPU に直接ロード可能な **KTX2 (Basis Universal)** がさらに推奨されます。将来的に `sharp` と `basisu` CLI を連携させ、プロフェッショナルなテクスチャ最適化を実現します。

---
*Created by Gemini CLI Asset Pipeline Architect.*
