---
description: Use when the user asks to upload a video to YouTube or authenticate with YouTube API. Triggers on "動画アップロード", "YouTubeに投稿", "YouTube認証".
---

# YouTube Upload Skill — 動画を YouTube にアップロード

YouTube Data API v3 を使って動画をアップロードする。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "動画アップロード" / "YouTubeに投稿" / "動画公開して" / "動画投稿して" | 動画をアップロード |
| "YouTube認証" / "YouTube auth" | OAuth 認証フロー実行 |

---

## アップロード手順

### 1. 投稿情報ドキュメントを探す

`docs/09_reports/` 配下から最新の YouTube 投稿情報ドキュメント（`*youtube-upload-info*` や `*youtube*` を含むファイル）を探す。

```bash
find docs/09_reports/ -name "*youtube*" -type f | sort | tail -1
```

見つかった場合はそこからメタデータ（タイトル・説明文・タグ・動画ファイルパス・公開設定）を読み取る。

### 2. メタデータを確認

ドキュメントから取得した情報をユーザーに表示して確認する:

- **ファイル**: 動画ファイルのパス
- **タイトル**: 動画タイトル
- **説明文**: 動画の説明
- **タグ**: カンマ区切りのタグ
- **公開設定**: private / unlisted / public

ドキュメントが見つからない場合、またはユーザーが直接情報を指定した場合はそれを使う。

### 3. アップロード実行

```bash
node scripts/stream/youtube-upload.mjs upload "<動画ファイルパス>" \
  --title "<タイトル>" \
  --desc "<説明文>" \
  --tags "<タグ>" \
  --privacy <公開設定>
```

### 4. 結果を報告

アップロード完了後、以下を表示する:
- 動画 URL (`https://youtu.be/<videoId>`)
- アップロードステータス

---

## ステータス確認

```bash
node scripts/stream/youtube-upload.mjs status <videoId>
```

---

## 認証（初回のみ）

未認証の場合、アップロード前に認証が必要:

```bash
node scripts/stream/youtube-upload.mjs auth
```

1. 表示された URL をブラウザで開く
2. Google アカウントで認証する
3. 表示された認証コードをターミナルに貼り付ける

---

## 重要ルール

- `.env` や認証トークンの内容を表示しない（配信中に漏洩するため）
- `--privacy` を指定しない場合のデフォルトは `private`（安全側）
- 大容量動画でもレジュマブルアップロードで対応
- アップロード前に必ずユーザーにメタデータを確認する

---

## コマンド一覧

| コマンド | 用途 |
|---------|------|
| `node scripts/stream/youtube-upload.mjs auth` | OAuth 2.0 認証（初回のみ） |
| `node scripts/stream/youtube-upload.mjs upload <video> [options]` | 動画アップロード |
| `node scripts/stream/youtube-upload.mjs status <videoId>` | 処理状況確認 |

## アップロードオプション

| オプション | 説明 |
|-----------|------|
| `--title "..."` | 動画タイトル（デフォルト: ファイル名） |
| `--desc "..."` | 動画説明文 |
| `--tags "a,b,c"` | カンマ区切りタグ |
| `--privacy <value>` | private / unlisted / public（デフォルト: private） |
