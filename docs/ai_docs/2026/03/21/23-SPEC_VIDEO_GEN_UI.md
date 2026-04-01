# 動画生成UI（1クリック投稿）設計書

> **作成日**: 2026-03-21
> **原案**: Gemini CLI → Claude Opus 4.6 が既存実装と照合して修正
> **ステータス**: 設計（既存実装を反映した修正版）

---

## 1. 背景と目的

ノベルゲーム作者が作品を SNS（TikTok, YouTube Shorts, X 等）で宣伝する際、プレイ画面を録画・編集する手間が大きなハードル。本機能は **1クリックでハイライト動画を自動生成** し、ダウンロードまたは SNS 投稿を可能にする。

## 2. 既存実装の現状

以下は既に実装済み:

| コンポーネント | ファイル | 内容 |
|--------------|---------|------|
| DB モデル | `apps/hono/prisma/schema.prisma` | `WorkVideo` (id, workId, format, width, height, duration, blobPath, status) |
| 生成 API | `apps/hono/src/routes/videos.ts` | `POST /api/works/:id/video`, `GET /api/works/:id/video` |
| 生成 CLI | `scripts/cli/video/generate-clip.ts` | Playwright 録画 → ffmpeg MP4 変換 |
| エンジン対応 | `packages/web/src/ksc-demo.ts` | `clip=1&clipDuration=30` で自動停止 |

**未実装:**
- フロントエンド UI（プロジェクトページに配置予定）
- 音声トラック合成
- SNS API 連携

## 3. ユーザー体験（UX）

### フロー

```
プロジェクトページ (/projects/[id])
  └─ 「動画」セクション
       ├─ [自動生成] → サーバーで BG+キャラ画面を録画（30秒）
       ├─ [シーン指定] → 開始ページ・秒数を指定して生成
       ├─ [アスペクト比] → 9:16（縦）/ 16:9（横）切替
       ├─ 生成済み動画一覧
       │    ├─ プレビュー再生
       │    ├─ ダウンロード
       │    └─ 削除
       └─ [SNS投稿] → Phase 3
```

### プロジェクトページ UI

タイトル画像セクションの下に「動画」セクションを追加:

```
┌─────────────────────────────────────┐
│ 動画クリップ                         │
│                                     │
│ [🎬 自動生成（30秒）]  [⚙ 設定指定] │
│  アスペクト比: ○ 9:16 縦  ○ 16:9 横 │
│                                     │
│ ── 生成済み動画 ──                   │
│ ┌──────┐ ┌──────┐                   │
│ │ ▶ 再生│ │ ▶ 再生│                  │
│ │ 30秒  │ │ 15秒  │                  │
│ │ DL 削除│ │ DL 削除│                │
│ └──────┘ └──────┘                   │
└─────────────────────────────────────┘
```

## 4. 技術アーキテクチャ

### A. 動画レンダリング（既存）

```
Playwright (headless Chromium)
  ↓ ksc-demo.html?work={id}&autostart=1&clip=1&clipDuration=30
  ↓ recordVideo: { size: { width: 720, height: 1280 } }
  ↓ document.title === '__CLIP_DONE__' で録画終了
  ↓ WebM 出力
  ↓
ffmpeg -i input.webm -c:v libx264 -crf 23 output.mp4
  ↓
Storage (local: public/uploads/videos/ / Azure: Blob)
```

### B. API（既存 + 拡張）

| メソッド | パス | 状態 | 内容 |
|---------|------|------|------|
| `POST` | `/api/works/:id/video` | ✅ 実装済み | 動画生成リクエスト |
| `GET` | `/api/works/:id/video` | ✅ 実装済み | ステータス確認・動画一覧 |
| `DELETE` | `/api/works/:id/video/:videoId` | 🔲 未実装 | 動画削除 |

**拡張が必要な点:**

1. `POST` に `duration`, `aspectRatio`, `startPage` パラメータ追加
2. `GET` で全動画一覧を返す（現在は最新1件のみ）
3. `DELETE` エンドポイント追加

### C. DB スキーマ（既存で十分）

```prisma
model WorkVideo {
  id        String @id @db.VarChar(31)
  workId    String @map("work_id") @db.VarChar(31)
  format    String @default("mp4") @db.VarChar(10)
  width     Int    @default(720)
  height    Int    @default(1280)
  duration  Int    @default(0)    // seconds
  blobPath  String @map("blob_path") @db.VarChar(500)
  status    String @default("pending") @db.VarChar(20)
  createdAt BigInt @map("created_at")
  work      Work   @relation(...)
}
```

Gemini 原案の `GeneratedVideo` モデルは不要。`WorkVideo` が同等の機能を持つ。

### D. generate-clip.ts 拡張

| パラメータ | 現在 | 追加 |
|-----------|------|------|
| `--duration` | ✅ 30秒 | — |
| `--output` | ✅ | — |
| `--page` | ✅ | — |
| `--aspect` | 🔲 | `16:9` or `9:16`（デフォルト: `9:16`） |

`--aspect 16:9` の場合: viewport を 1280×720 に変更。

## 5. フロントエンド実装

### 配置場所

**プロジェクトページ** (`apps/next/app/(private)/projects/[id]/page.tsx`) のタイトル画像セクションの下。エディタには置かない（サムネと同じ方針）。

### コンポーネント

```
projects/[id]/page.tsx
  └─ VideoSection (新規)
       ├─ 生成ボタン（自動 / 設定指定）
       ├─ アスペクト比ラジオ
       ├─ 生成中のプログレス表示
       └─ 動画一覧カード（プレビュー・DL・削除）
```

### 生成フロー（フロント → API）

```typescript
// 1. 生成リクエスト
const res = await authFetch(`/api/works/${projectId}/video`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ duration: 30, aspectRatio: '9:16' }),
});
const { videoId } = await res.json();

// 2. ポーリングでステータス確認
const poll = setInterval(async () => {
  const status = await authFetch(`/api/works/${projectId}/video`);
  const data = await status.json();
  if (data.status === 'done' || data.status === 'error') {
    clearInterval(poll);
    // UI 更新
  }
}, 3000);
```

## 6. 音声トラック対応（Phase 2）

Playwright の `recordVideo` はブラウザの音声をキャプチャしない。Phase 2 では:

1. ksc-demo.ts にオーディオダンプモードを追加（AudioContext の出力を WAV にバッファ）
2. 録画完了時に WAV を postMessage で返す
3. ffmpeg で映像 + 音声をマージ: `ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac output.mp4`

## 7. SNS 連携（Phase 3）

| SNS | API | 認証 |
|-----|-----|------|
| TikTok | TikTok For Business API | OAuth2 |
| YouTube | YouTube Data API v3 | OAuth2 (Google) |
| X (Twitter) | Media Upload API | OAuth 1.0a |

プロジェクト設定ページに SNS 連携セクションを追加し、OAuth トークンを DB に保存。動画生成完了後に「投稿」ボタンから各 SNS に直接アップロード。

## 8. 実装フェーズ

| Phase | 内容 | 工数 | 状態 |
|-------|------|------|------|
| **1 (MVP)** | プロジェクトページに動画セクション追加、生成・一覧・DL・削除 | 1日 | 🔲 |
| **2 (Audio)** | 音声キャプチャ + ffmpeg 合成 | 2-3日 | 🔲 |
| **3 (SNS)** | TikTok / YouTube / X API 連携、OAuth 設定 UI | 1週間 | 🔲 |
| **4 (AI)** | AI による「盛り上がりシーン」自動検知 | 未定 | 🔲 |

## 9. 変更ファイル一覧（Phase 1）

| # | ファイル | 変更内容 |
|---|---------|---------|
| 1 | `apps/next/app/(private)/projects/[id]/page.tsx` | 動画セクション追加 |
| 2 | `apps/hono/src/routes/videos.ts` | DELETE エンドポイント追加、POST に duration/aspectRatio パラメータ |
| 3 | `scripts/cli/video/generate-clip.ts` | `--aspect` パラメータ追加 |
| 4 | `apps/next/lib/api.ts` | 動画 API ヘルパー関数追加 |

## 10. Gemini 原案からの変更点

| 項目 | 原案 | 修正 |
|------|------|------|
| DB モデル | `GeneratedVideo`（新規） | `WorkVideo`（既存で十分） |
| API パス | `POST /api/videos/generate` | `POST /api/works/:id/video`（既存） |
| UI 配置 | エディタの `VideoGeneratorModal` | プロジェクトページの動画セクション |
| ステータス API | `GET /api/videos/status/:jobId` | `GET /api/works/:id/video`（既存） |
| 録画方式 | フレーム連番 or Playwright video | Playwright `recordVideo`（既存確定） |
