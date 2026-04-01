# YouTube 投稿情報

録画日: 2026-03-02
ファイル: `/Users/kentaromukunasi/Movies/2026-03-02 20-19-50.mov`

---

## タイトル

```
【AI自律開発】Claude Code に「動画投稿して」で YouTube アップロード CLI を作らせた【kaedevn】
```

## 説明文

```
Claude Code（Claude Opus 4.6）に「YouTube に動画を投稿できるようにして」と指示したら、
googleapis を使った CLI ツールとスキル定義を自律的に実装した様子をノーカットでお届けします。

人間の指示は「実装計画を実行して」の一言だけ。
npm install → CLI 実装 → スキル定義 → .gitignore 更新 → コミットまで全て AI が自律実行しています。

■ 実装した内容
- scripts/youtube-upload.mjs（YouTube Data API v3 アップロード CLI）
  - auth: OAuth 2.0 認証フロー
  - upload: レジュマブルアップロード + 進捗表示
  - status: 動画処理状況確認
- .claude/skills/youtube-upload/skill.md（Claude Code スキル定義）
  - 「動画アップロードして」の一言でメタデータ取得 → アップロード実行

■ 技術スタック
- googleapis（Google APIs Node.js Client）
- YouTube Data API v3
- OAuth 2.0（デスクトップアプリフロー）
- OBS WebSocket（録画制御）

■ プロジェクト
kaedevn — クロスプラットフォーム ビジュアルノベルエンジン
TypeScript / PixiJS / Hono / React / Monorepo

■ 使用ツール
- Claude Code（Claude Opus 4.6）
- OBS Studio（obs-websocket-js で CLI から録画制御）
- Git / GitHub

■ 関連リンク
Qiita: https://qiita.com/mkanakureon
Zenn: https://zenn.dev/mkanakureon

#ClaudeCode #AI開発 #kaedevn #YouTube #自律開発 #CLI
```

## タグ

```
Claude Code, AI開発, 自律開発, YouTube API, googleapis, TypeScript, ビジュアルノベル, kaedevn, CLI, Claude Opus
```

## サムネイル案

```
メイン文字: 「動画投稿して」→ CLI 自動実装
サブ文字:   YouTube Data API v3 アップロード CLI
背景:       ターミナル画面のスクショ（Usage 表示部分）
```

## カテゴリ

```
科学と技術
```

## 公開設定

```
公開 or 限定公開（お好みで）
```
