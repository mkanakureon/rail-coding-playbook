# YouTube 投稿情報: タイムライン操作 E2E テスト

## 動画ファイル

`/Users/kentaromukunasi/Movies/2026-03-08 01-05-52.mov`

## タイトル案

```
【AI自律開発】Claude Opus 4.6 がタイムラインでキャラ登場演出 — Scale/X/Opacity アニメーション＋シークバー操作＋プレイ確認まで全自動
```

## 説明文案

```
AI（Claude Opus 4.6）がビジュアルノベルエンジン「kaedevn」のブロックエディタでタイムラインブロックを作成し、キャラクター登場演出（Scale/X/Opacity）と背景フェードインをシークバーで操作・確認する E2E テストを自律実行する様子を録画しました。

■ テスト内容
1. API でプロジェクトを新規作成（自動でファンタジーアセット付き）
2. 自動生成ブロック（bg/ch）から実際のアセットID・キャラスラッグを取得
3. タイムラインブロックをAPI経由で追加（キャラ演出 + 背景フェードイン、3秒）
4. マイページからプロジェクトを選択（トークン注入でログイン省略）
5. エディタでタイムラインブロックを選択
6. シークバー操作（0% → 50% → 100%）でプレビュー確認
7. プレビュー画像の検証（背景・キャラが実際に表示されているか）
8. 実行ボタンからプレイ画面を起動 → シナリオ完走

■ タイムライン演出の内容
- キャラ（fantasy_hero）:
  - Scale: 0.5 → 1.5 → 1.0（easeOut → easeInOut）
  - X: -300 → 100 → 0（左から登場）
  - Opacity: 0 → 1（フェードイン）
- 背景:
  - Opacity: 0.3 → 1.0（暗転から明転）

■ バグ修正も含む
- 当初 targetId に "ch"/"bg" をハードコードしていたため、プレビューが黒画面＋青プレースホルダーだった
- 原因: TimelinePreview.tsx が asset.id/character.slug で照合するため、文字列 "ch"/"bg" では一致しない
- 修正: existingBlocks から実際の assetId/characterId を抽出して targetId に使用
- プレビュー検証を追加: img 要素の naturalWidth > 0 を確認し、壊れていればテスト失敗にする

■ 技術スタック
- エンジン: kaedevn（PixiJS / WebGL ベースのビジュアルノベルエンジン）
- エディタ: React + Zustand（Vite, port 5176）
- プレビュー: PixiJS OpRunner（Vite, port 5175）
- API: Hono + Prisma + PostgreSQL（port 8080）
- フロントエンド: Next.js（port 3000）
- テスト: Playwright（headless: false で実行画面を表示）
- OBS 連携: obs-websocket-js でテキストオーバーレイを動的更新
- AI: Claude Opus 4.6（Claude Code CLI）

■ タイムラインシステム
- evaluateTimeline() で毎フレーム評価
- entity トラック: キャラ/背景の x, y, opacity, scale を CSS で制御
- camera トラック: 全体の transform（zoom/pan）を制御
- キーフレーム補間: Linear / EaseIn / EaseOut / EaseInOut
- シークバーでリアルタイムプレビュー

■ リポジトリ
kaedevn-monorepo（プライベート）
```

## タグ案

```
AI開発, Claude, Claude Opus, ビジュアルノベル, ゲームエンジン, E2Eテスト, Playwright, 自律開発, kaedevn, PixiJS, React, TypeScript, 自動テスト, AI coding, Claude Code, OBS, タイムライン, アニメーション, キーフレーム, シークバー
```

## テスト仕様

| 項目 | 値 |
|------|-----|
| テストファイル | `tests/timeline-operations.spec.ts` |
| 設定ファイル | `playwright.timeline.config.ts` |
| エディタ viewport | 1200 x 900 |
| プレイ画面 viewport | 600 x 440 |
| ログイン | 省略（トークン直接注入） |
| タイムライン長 | 3000ms |
| キャラトラック | scale(0.5→1.5→1.0), x(-300→100→0), opacity(0→1) |
| 背景トラック | opacity(0.3→1.0) |
| プレイクリック数 | 2 |
| 所要時間 | 約1.2分 |
| 終了判定 | コンソール「Scenario completed」検出 |

## フェーズ構成

| Phase | 内容 |
|-------|------|
| 1 | API でプロジェクト作成 + タイムラインブロック追加 |
| 2 | マイページ → プロジェクト選択（トークン注入） |
| 3 | エディタを開く |
| 4 | タイムラインブロックを選択 |
| 5 | シークバー操作（0% → 50% → 100%） |
| 6 | 実行 → プレイ画面でシナリオ完走 |

## targetId の照合ルール

| 対象 | TimelinePreview.tsx の照合 | 正しい値の例 |
|------|--------------------------|-------------|
| 背景 | `asset.id === targetId \|\| asset.name === targetId` | `01KK4GS4WG4GTV4EFVQQ928J2N` |
| キャラ | `character.slug === targetId \|\| character.id === targetId` | `fantasy_hero` |

## 録画履歴

| 時刻 | ファイル | 備考 |
|------|---------|------|
| 01:05 | `2026-03-08 01-05-52.mov` | 最終版（targetId修正済み、プレビュー検証付き） |
