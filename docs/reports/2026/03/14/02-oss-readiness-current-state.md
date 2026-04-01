# OSS化 現状整理と構造準備 — 2026-03-14

> 前回の検討（`docs/09_reports/2026/03/11/08-oss-local-edition-spec.md`）から3日経過。リリース前に OSS 化しやすい構造にするための現状整理。

---

## 1. 全パッケージ OSS 化対応表

| パッケージ | 行数 | OSS 対象 | 現状 | ブロッカー |
|-----------|------|----------|------|-----------|
| `packages/core` | 4,814 | **公開** | 準備済み | なし（依存なし） |
| `packages/compiler` | 2,143 | **公開** | 準備済み | なし（core のみ依存） |
| `packages/ksc-compiler` | 4,397 | **公開** | 準備済み | なし |
| `packages/interpreter` | 4,024 | **公開済み** | OSS リポジトリに同期済み | なし |
| `packages/web` | 12,055 | **公開** | ほぼ準備済み | アセットパスのハードコード箇所を確認 |
| `packages/battle` | 477 | **公開** | 準備済み | なし |
| `packages/map` | 543 | **公開** | 準備済み | なし |
| `packages/ui` | 512 | **公開** | 準備済み | なし |
| `packages/tools` | 500 | **要検討** | Azure 依存のスクリプトが混在 | 分離が必要 |
| `packages/schemas` | — | **公開** | 最小 | なし |
| `packages/vscode-ks-ksc` | — | **公開** | 準備済み | なし |
| `apps/editor` | 14,959 | **公開** | API URL・認証トークンがハードコード | 認証アダプター化が必要 |
| `apps/ksc-editor` | 1,226 | **公開** | ほぼ準備済み | editor と同じ認証問題 |
| `apps/hono` | 28,471 | **非公開** | Azure + PostgreSQL + 認証に密結合 | `hono-local` を新規作成 |
| `apps/next` | 43,842 | **非公開** | プラットフォーム機能 | — |
| `packages/native-engine` | 2,340 (C++) | **非公開** | Switch/iOS/Android | — |
| `packages/sdl` | — | **非公開** | Git submodule (SDL2) | — |
| `packages/ai-gateway` | 1,105 | **非公開** | LLM API キー・プロンプト | — |

---

## 2. 公開可能な行数

| 区分 | 行数 | ファイル数 |
|------|------|-----------|
| 公開対象（packages） | 29,465行 | — |
| 公開対象（apps/editor + ksc-editor） | 16,185行 | — |
| **公開合計** | **45,650行** | — |
| 非公開（apps/hono + next + native-engine + ai-gateway） | 75,718行 | — |
| **比率** | 公開 44% / 非公開 56% | — |

---

## 3. ブロッカー一覧と対策

### ブロッカー1: `hono-local` が存在しない（最大）

現在の `apps/hono` は Azure Blob + PostgreSQL + JWT 認証に密結合。OSS 版は SQLite + ファイルシステム + 認証なしで動く必要がある。

**対策案 A: アダプターパターン（推奨）**

既存の `apps/hono` にストレージ・認証のインターフェースを挟み、実装を差し替え可能にする。

```
apps/hono/src/
├── storage/
│   ├── IStorage.ts          # インターフェース
│   ├── AzureBlobStorage.ts  # クラウド版（現行）
│   └── LocalFileStorage.ts  # OSS版（新規）
├── db/
│   ├── IDatabase.ts         # インターフェース
│   ├── PrismaDatabase.ts    # クラウド版（現行）
│   └── SqliteDatabase.ts    # OSS版（新規）
├── auth/
│   ├── IAuth.ts             # インターフェース
│   ├── JwtAuth.ts           # クラウド版（現行）
│   └── LocalAuth.ts         # OSS版（常にログイン済み）
```

- 利点: 既存コードを壊さない。テストも共有できる
- 欠点: インターフェース設計に時間がかかる

**対策案 B: `hono-local` を別アプリとして新規作成**

前回の仕様書（`08-oss-local-edition-spec.md`）の方針。`apps/hono` とは独立した軽量 API。

- 利点: クラウド版に一切触らない
- 欠点: エンドポイントの重複保守、機能追加時に2箇所修正

**推奨: A（アダプターパターン）を先にやり、B は時間がなければ A から自動生成**

### ブロッカー2: エディタの認証依存

`apps/editor` が `localStorage` からトークンを読んで API リクエストに付与している。OSS 版ではトークンが不要。

**対策:**

```typescript
// config/api.ts
const getAuthHeader = () => {
  if (import.meta.env.VITE_AUTH_MODE === 'local') return {};
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
```

環境変数1つで認証の有無を切り替え。既存コードへの影響は `config/api.ts` の1ファイルのみ。

### ブロッカー3: API URL のハードコード

エディタの `config/api.ts` に API の URL が設定されているが、OSS 版では `localhost:8080` 固定で動く必要がある。

**対策:** 既に `VITE_API_URL` 環境変数で切り替え可能な設計になっている場合は問題なし。確認が必要。

---

## 4. 今やるべきこと（リリース前の構造準備）

フル OSS 化は後回しにして、**構造だけ先に整える**。

| 優先度 | タスク | 影響範囲 | 見積もり |
|--------|-------|---------|---------|
| **高** | `apps/hono` にストレージインターフェース（`IStorage`）を導入 | `routes/*.ts` のファイルアクセス箇所 | 2-3日 |
| **高** | `apps/hono` に DB インターフェース（`IDatabase`）を導入 | Prisma 呼び出し箇所 | 3-5日 |
| **中** | `apps/editor/src/config/api.ts` に認証モード切り替えを追加 | 1ファイル | 1時間 |
| **中** | `apps/hono` に認証インターフェース（`IAuth`）を導入 | 認証ミドルウェア | 1日 |
| **低** | `packages/tools` から Azure 依存スクリプトを分離 | ファイル移動のみ | 半日 |

**合計見積もり: 1〜2週間**（コードを書くのは AI なので実質数日）

---

## 5. OSS 公開方針

### コンセプト

**ツール配布型 OSS。** 「使ってもらう」ことが目的。コミュニティ開発は想定しない。

### 運用モデル

| 項目 | 方針 |
|------|------|
| ライセンス | MIT または Apache 2.0 |
| PR | **受けない**（fork-only） |
| Issue | 受ける（バグ報告・要望） |
| 開発元 | Private の `kaedevn-monorepo` で開発 → `kaedevn-studio` に同期 |
| コントリビュート | fork して自由に改変OK。本体への取り込みはしない |

### なぜ PR を受けないか

- 同期方式で Private → Public に一方向で流すため、PR をマージしても次の同期で上書きされる
- 個人 + AI 2体の開発体制で、外部コードのレビュー・マージ管理は負荷が高い
- コミュニティが育ったら方針を変更する余地は残す

### 将来の移行パス

コミュニティが活発になった場合：
1. `kaedevn-studio` を開発元に昇格
2. Private の `kaedevn-monorepo` は非公開部分のみ保持（next, hono, native-engine, ai-gateway）
3. `kaedevn-studio` を submodule で参照する構成に切り替え

## 6. やらないこと（今は）

- `hono-local` の新規作成（アダプターを入れれば不要になる可能性）
- SQLite 実装（インターフェースだけ先に定義、実装は後）
- OSS リポジトリへの同期スクリプト更新
- CONTRIBUTING.md / 開発ガイド
- コミットログ監査の自動化

---

## 7. 関連文書

| 文書 | 内容 |
|------|------|
| `docs/09_reports/2026/03/11/08-oss-local-edition-spec.md` | OSS ローカルエディション仕様書 |
| `docs/09_reports/2026/03/11/02-oss-review-summary.md` | 過去の OSS 議論まとめ |
| `docs/10_ai_docs/2026/03/02/34-OSS_STRUCTURAL_ISSUES_REPORT.md` | 構造的課題レポート |
| `docs/10_ai_docs/2026/03/02/12-OSS_FOLDER_STRUCTURE_DEFINITION.md` | ディレクトリ構造定義 |
