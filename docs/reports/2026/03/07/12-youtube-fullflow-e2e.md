# YouTube 投稿情報: フルフロー E2E テスト

## 動画ファイル

`/Users/kentaromukunasi/Movies/2026-03-07 21-10-30.mov`

## タイトル案

```
【AI自律開発】Claude Opus 4.6 がビジュアルノベルエンジンの E2E テストを自動実行 — プロジェクト作成からプレイ完走まで
```

## 説明文案

```
AI（Claude Opus 4.6）がビジュアルノベルエンジン「kaedevn」のフルフロー E2E テストを自律的に実行する様子を録画しました。

■ テスト内容
1. CLI でプロジェクトを新規作成（タイムスタンプ付き）
2. テキスト・キャラクター・エフェクト・スクリーンフィルター・選択肢など13種類のブロックを追加
3. ブラウザでログイン → マイページ → プロジェクト詳細
4. ブロックエディタで全13ブロックを順番にクリック検証（赤パルスエフェクト付き）
5. 実行ボタンからプレイ画面を起動
6. canvas クリックでシナリオを進行、選択肢を自動選択
7. 「Scenario completed」を検出してプレイ完走を確認

■ 技術スタック
- エンジン: kaedevn（PixiJS / WebGL ベースのビジュアルノベルエンジン）
- エディタ: React + Zustand（Vite, port 5176）
- プレビュー: PixiJS OpRunner（Vite, port 5175）
- API: Hono + Prisma + PostgreSQL（port 8080）
- フロントエンド: Next.js（port 3000）
- テスト: Playwright（headless: false で実行画面を表示）
- AI: Claude Opus 4.6（Claude Code CLI）

■ ポイント
- CLI でブロック追加 → ブラウザでログインからプレイ完走まで全自動
- 選択肢は PixiJS canvas 内に描画されるため、仮想座標→実座標変換でクリック
- シナリオ終了は OpRunner の「Scenario completed」コンソールログで判定
- 所要時間: 約1.8分

■ リポジトリ
kaedevn-monorepo（プライベート）

■ 関連コミット
c92abb1 test: フルフロー E2E テスト追加（CLI作成→ログイン→エディタ→プレイ完走）
```

## タグ案

```
AI開発, Claude, Claude Opus, ビジュアルノベル, ゲームエンジン, E2Eテスト, Playwright, 自律開発, kaedevn, PixiJS, React, TypeScript, 自動テスト, AI coding, Claude Code
```

## テスト仕様

| 項目 | 値 |
|------|-----|
| テストファイル | `tests/editor-cli-full-flow.spec.ts` |
| 設定ファイル | `playwright.fullflow.config.ts` |
| エディタ viewport | 1200 x 900 |
| プレイ画面 viewport | 600 x 440 |
| ブロック数 | 13 |
| プレイクリック数 | 6（選択肢1回含む） |
| 所要時間 | 約1.8分 |
| 終了判定 | コンソール「Scenario completed」検出 |

## ブロック構成

| # | タイプ | 内容 |
|---|--------|------|
| 1 | start | 開始ブロック |
| 2 | bg | 背景（ファンタジー公式アセット） |
| 3 | ch | キャラクター（fantasy_hero） |
| 4 | text | 初期テキスト |
| 5 | text | 「冒険の始まりだ。目の前には広大な城がそびえ立っている。」 |
| 6 | text | 「この城に何があるんだろう…」（キャラ台詞） |
| 7 | set_var | courage += 1 |
| 8 | effect | shake（intensity: 3, duration: 300） |
| 9 | screen_filter | sepia |
| 10 | text | 「あの日の記憶が蘇る…」 |
| 11 | screen_filter | none（解除） |
| 12 | text | 「行こう、前に進むしかない！」 |
| 13 | choice | 「城に入る」「引き返す」 |

## 録画履歴

| 時刻 | ファイル | 備考 |
|------|---------|------|
| 20:37 | `2026-03-07 20-37-05.mov` | headless, video:on（Playwright録画） |
| 20:40 | `2026-03-07 20-40-21.mov` | headless=false, 初回ブラウザ表示 |
| 20:53 | `2026-03-07 20-53-13.mov` | パルスエフェクト追加、プレイ完走（選択肢未対応） |
| 21:00 | `2026-03-07 21-00-32.mov` | クリック位置修正、選択肢対応 |
| 21:10 | `2026-03-07 21-10-30.mov` | 最終版（ブロックエディタボタンパルス追加） |
