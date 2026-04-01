# YouTube 投稿情報: キャラクタープロパティ編集 E2E テスト

## 動画ファイル

`/Users/kentaromukunasi/Movies/2026-03-07 23-32-00.mov`

## タイトル案

```
【AI自律開発】Claude Opus 4.6 がエディタのキャラクタープロパティを操作 — スケール5倍・Y座標変更・プレイ確認まで全自動
```

## 説明文案

```
AI（Claude Opus 4.6）がビジュアルノベルエンジン「kaedevn」のブロックエディタでキャラクタープロパティを編集する E2E テストを自律実行する様子を録画しました。

■ テスト内容
1. API でプロジェクトを新規作成（自動でファンタジーアセット付き）
2. エディタを開く（ログイン省略 — トークン直接注入）
3. キャラクターブロックをクリックして選択
4. 右パネルのプロパティでスケールを 1.00 → 5.00 に変更
5. Y座標を 0 → 2800 に変更（下にずらす）
6. 実行ボタンからプレイ画面を起動 → シナリオ完走

■ 特徴
- ログイン省略: API でトークン取得 → localStorage 注入でエディタ直接アクセス（約1分で完了）
- プロパティ操作: input[type="number"] の属性（step, max）で正確にスケール・Y座標の入力欄を特定
- OBS テキスト連携: 各フェーズ・クリックごとに操作内容を表示
- プレビュー確認: 変更後に実行してキャラクターの拡大・位置変更をプレイ画面で確認

■ 技術スタック
- エンジン: kaedevn（PixiJS / WebGL ベースのビジュアルノベルエンジン）
- エディタ: React + Zustand（Vite, port 5176）
- プレビュー: PixiJS OpRunner（Vite, port 5175）
- API: Hono + Prisma + PostgreSQL（port 8080）
- テスト: Playwright（headless: false で実行画面を表示）
- OBS 連携: obs-websocket-js でテキストオーバーレイを動的更新
- AI: Claude Opus 4.6（Claude Code CLI）

■ ポイント
- エディタのプロパティパネル（SliderRow）を Playwright から操作
- input の属性セレクタで正確に特定: scale → step="0.01" max="5", Y → max="4320"
- ログイン不要で高速（約1分）
- Web ベースだからこそ可能な E2E テスト（Unity との比較: docs/09_reports/2026/03/07/14-web-vs-unity-test-comparison.md）

■ リポジトリ
kaedevn-monorepo（プライベート）
```

## タグ案

```
AI開発, Claude, Claude Opus, ビジュアルノベル, ゲームエンジン, E2Eテスト, Playwright, 自律開発, kaedevn, PixiJS, React, TypeScript, 自動テスト, AI coding, Claude Code, OBS, プロパティ編集, キャラクター
```

## テスト仕様

| 項目 | 値 |
|------|-----|
| テストファイル | `tests/edit-character-properties.spec.ts` |
| 設定ファイル | `playwright.edit-char.config.ts` |
| エディタ viewport | 1200 x 900 |
| プレイ画面 viewport | 600 x 440 |
| ログイン | 省略（トークン直接注入） |
| スケール変更 | 1.00 → 5.00 |
| Y座標変更 | 0 → 2800 |
| プレイクリック数 | 1 |
| 所要時間 | 約1分 |
| 終了判定 | コンソール「Scenario completed」検出 |

## フェーズ構成

| Phase | 内容 |
|-------|------|
| 1 | API でプロジェクト作成 |
| 2 | エディタを開く（トークン注入） |
| 3 | キャラクターブロックを選択 |
| 4 | スケールを 5.00 に変更 |
| 5 | Y座標を 2800 に変更 |
| 6 | 実行 → プレイ画面でシナリオ完走 |

## プロパティ入力の特定方法

| プロパティ | セレクタ | 理由 |
|-----------|---------|------|
| スケール (S) | `input[type="number"][step="0.01"][max="5"]` | step=0.01, max=5 はスケール専用 |
| Y座標 | `input[type="number"][max="4320"]` | ch ブロックの yMax=4320 |
| X座標 | `input[type="number"][max="1280"]` | 参考: 使用時 |

## 録画履歴

| 時刻 | ファイル | 備考 |
|------|---------|------|
| 23:32 | `2026-03-07 23-32-00.mov` | 最終版（5倍, Y=2800, ログイン省略） |
