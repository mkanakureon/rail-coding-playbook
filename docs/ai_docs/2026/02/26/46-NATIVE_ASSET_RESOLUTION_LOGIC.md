# ネイティブエンジン：アセット解決ロジック設計

**作成日**: 2026-02-26
**対象**: `AssetProvider` クラスの実装
**核心**: スクリプト内の ID を物理ファイルへ紐付ける仕組み

## 1. 目的
KSC スクリプト内では `bg("forest")` のように slug で指定されます。ネイティブエンジンは、実行環境の `assets/` ディレクトリ内にある `assets.json` を読み込み、これを物理パスへ変換する必要があります。

## 2. assets.json の構造 (想定)
TS 版エディタが出力する形式に準拠します。
```json
{
  "forest": "images/bg/forest_day.png",
  "hero_smile": "images/ch/hero/smile.png",
  "bgm_main": "audio/bgm/main_theme.ogg"
}
```

## 3. C++ での実装方針
- **ライブラリ**: `nlohmann/json` を使用してパース。
- **インターフェース**: `std::string resolvePath(std::string slug)` メソッドを提供。
- **エラー処理**: マッピングに存在しない slug が指定された場合、プレースホルダー画像（ピンク色のテクスチャ等）を返すか、警告を出力する。

---
*Created by Gemini CLI Data Architect.*
