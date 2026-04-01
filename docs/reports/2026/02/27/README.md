# 2026-02-27 作業レポート

SDL2 ネイティブエンジンの Android クロスビルドと、スクリーンショットベースのビジュアルテスト手順の整備。

## ファイル構成

```
docs/09_reports/2026/02/27/
├── README.md                                  ← この文書
├── 01-sdl2-android-build-guide.md             ← Android ビルド手順・構成・トラブルシューティング
├── 02-visual-testing-with-screenshots.md      ← スクリーンショットを使ったビジュアルテスト手順書
└── screenshots/
    ├── android_01_initial.png                 ← Android: 背景 + テキストウィンドウ（初期状態）
    ├── android_02_character.png               ← Android: 背景 + 立ち絵 + 日本語テキスト
    └── macos_headless_test.png                ← macOS: ヘッドレステストパターン（オレンジ + 青四角）
```

## 文書の関係

```
01-sdl2-android-build-guide.md
  ビルド環境の構築から APK 生成・インストールまで
  (前提: docs/09_reports/2026/02/26/05-sdl2-native-engine-player.md)
        │
        ▼
02-visual-testing-with-screenshots.md
  ビルドしたアプリの描画結果をスクリーンショットで確認する方法
  macOS / Android 両対応、チェックリスト付き
        │
        ▼
screenshots/
  実際にキャプチャした画像サンプル（文書内から参照）
```

## 前日の関連レポート

- [`../26/05-sdl2-native-engine-player.md`](../26/05-sdl2-native-engine-player.md) — SDL2 ネイティブエンジン macOS ビルド（本作業の前提）
