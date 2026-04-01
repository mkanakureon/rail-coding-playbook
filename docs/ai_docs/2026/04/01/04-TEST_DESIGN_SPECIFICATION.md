---
generated_by: Gemini CLI
date: 2026-04-01
type: design-spec
project: kaedevn-monorepo
---

# 詳細テスト設計仕様書 (エディタ・スマホ・動画レンダリング編)

## 1. ノベルゲームエディタ: 状態遷移 & 構造検証

### 1.1 `useEditorStore` (Vitest)
- **シナリオ 1: ブロックのネスト移動 (Indentation)**
    - 検証: ブロックの親子関係変更時に循環参照が発生しないこと。
- **シナリオ 2: スクリプト Round-trip (`ksConverter.ts`)**
    - 検証: KAG/KS ⇔ Block UI の双方向変換で意味が変わらないこと。

### 1.2 `CommandPalette` (Playwright E2E)
- **シナリオ: キーボード操作によるコマンド挿入**
    - 操作: `Cmd+K` 入力 -> 検索 -> 挿入。フォーカスが正しく移動すること。

---

## 2. スマホ対応: タッチ & レスポンシブ検証

### 2.1 モバイル特有フック (Vitest)
- **`useLongPress.ts` の検証**: 長押し時間の正確性と、タップとの誤爆防止。
- **`useKeyboardAdjust.ts`**: 仮想キーボード出現時の Viewport リサイズ追従。

### 2.2 モバイル UI (Playwright Visual Regression)
- **Safe Area 検証**: iPhone 端末での FAB（浮遊ボタン）の配置整合性。
- **Bottom Sheet 変換**: スマホ解像度時にモーダルがボトムシート形式になること。

---

## 3. 動画作成 & YouTube 投稿: ライフサイクル & 外部同期検証

### 3.1 動画レンダリング (`scripts/stream/auto-record.sh`)
- **シナリオ: ヘッドブラウザによる自動録画**
    - 操作: 指定されたプロジェクト ID を Playwright で開き、動画出力を開始。
    - 検証: 指定された秒数 (Duration) の `.mp4` ファイルが生成されること。
    - 異常系: 音声アセットが欠落している場合に、無音で録画を継続するかエラーを出すかの挙動検証。

### 3.2 YouTube 自動投稿 (`scripts/stream/youtube-upload.mjs`)
- **シナリオ: メタデータとファイル送信**
    - 操作: ダミーの動画ファイルと、タイトル・説明文を YouTube API 経由で送信。
    - 検証: YouTube Data API のリクエスト形式が最新のスキーマに合致していること（モックテスト）。
    - セキュリティ: API キーや OAuth トークンがログに漏えいしないこと。

### 3.3 エディタ連携 (`apps/editor/src/config/api.ts`)
- **シナリオ: エディタからの動画書き出しリクエスト**
    - 操作: エディタ UI から「動画エクスポート」を実行。
    - 検証: サーバー（Hono）へ正しいパラメータ（ProjectID, Scene, Resolution）が送られること。

---

## 4. 実行計画

1. **Phase 1: CI 安定化 (Day 1)**: `waitForTimeout` の一斉排除。
2. **Phase 2: クリティカル・コア (Day 2-3)**: `ksConverter` の Round-trip テストとモバイル UI 検証。
3. **Phase 3: 動画パイプライン (Day 4)**: `auto-record.sh` の正常系テストと `youtube-upload.mjs` のモックテスト。

---
*設計責任者: Gemini CLI (CAO)*
