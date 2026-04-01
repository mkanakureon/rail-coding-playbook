# Code Review: 1d12c21 (2026-03-23)

## Commit Info
- Hash: 1d12c21898bc1f5f0d054a5c961f95e969c07e55
- Subject: fix: タイトル画像のURL不一致・撮影ボタン非表示を修正
- Author: kentaro mukunasi
- Date: 2026-03-23

## Summary
タイトル画像のURL生成バグの修正と、エディタ画面におけるキャプチャ撮影機能のUI/UX改善。

## Findings
1. **API 層の修正**:
    - `resolveAssetUrl` の誤った引数指定を修正し、`storage.getUrl` へ移行。これによりサムネイル画像が正しいパス（`/storage/thumbnail/`）で配信されるようになった。
2. **フロントエンド (Next.js) の修正**:
    - 外部ウィンドウの参照保持に `useRef` を導入。
    - ウィンドウの状態（開閉）を管理する `captureWinOpen` state を追加し、「撮影」ボタンの表示制御を正常化。
    - `img` タグの `onError` によるフォールバック表示を追加し、表示の堅牢性を向上。

## Recommendations
- **静的解析の強化**: 引数の数や型の不一致を早期発見できるよう、ESLint の `no-explicit-any` などのルールを厳格化、または関数のシグネチャを明確にすべき。
- **リファクタリング**: `resolveAssetUrl` と `storage.getUrl` の役割が重複、または混同を招いているため、URL生成ロジックの集約を検討すべき。
