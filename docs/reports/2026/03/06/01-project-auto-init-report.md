# プロジェクト新規作成：初期コンテンツ自動追加

作成日: 2026-03-06

## 概要

新規プロジェクト作成時に、空の start ブロックだけでなく、ファンタジー公式アセットを使った **bg → ch → text** の初期ブロックを自動追加するように `POST /api/projects` を修正した。

## 変更理由

ユーザーがプロジェクトを新規作成すると空の start ブロックのみが表示され、「ブロックを追加できない」「何をすればよいかわからない」という UX 問題があった。

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `apps/hono/src/routes/projects.ts` | `POST /api/projects` ハンドラに初期アセット追加ロジックを実装 |

## 処理フロー

```
POST /api/projects { title }
  ↓
1. プロジェクトを start ブロックだけで先に作成（FK 制約対策）
  ↓
2. OfficialAsset から「ファンタジー」背景・キャラ画像を取得
   - NFD/NFC 両方で LIKE 検索（Unicode 正規化問題対策）
   - ヒットしなければ任意の bg / ch-img を取得（フォールバック）
  ↓
3. Asset レコードを作成（bg, ch-img, ch-class の3つ）
  ↓
4. プロジェクト data を更新
   - blocks: start → bg → ch → text（4つ）
   - characters: ファンタジー勇者（slug: fantasy_hero）
  ↓
5. 失敗時はプロジェクトは start ブロックのまま（フォールバック）
```

## 発生した問題と解決

### 1. Unicode NFD/NFC 不一致

| 項目 | 内容 |
|------|------|
| 症状 | `subcategory: { contains: 'ファンタジー' }` で Prisma がヒットしない |
| 原因 | DB 内の subcategory が **NFD** (e.g. `e38299` = combining dakuten) で格納されているが、TypeScript リテラルは **NFC** |
| 解決 | `prisma.$queryRaw` で NFD/NFC 両方の LIKE を OR 検索 |

```sql
-- NFC と NFD の両方でマッチ
WHERE subcategory LIKE '%ファンタジー%'  -- NFC
   OR subcategory LIKE '%ファンタジー%'  -- NFD (.normalize('NFD'))
```

### 2. Foreign Key 制約違反

| 項目 | 内容 |
|------|------|
| 症状 | `assets_project_id_fkey` FK 制約エラーで Asset 作成に失敗 |
| 原因 | プロジェクト作成前に Asset を作成しようとした（Asset.projectId → Project.id の FK 制約） |
| 解決 | プロジェクトを先に start ブロックだけで作成してから、Asset を追加し、最後に project.data を更新 |

### 3. Raw Query のカラム名

| 項目 | 内容 |
|------|------|
| 症状 | raw query で `bgOfficial.blobPath` が undefined |
| 原因 | `$queryRaw` はスネークケース (`blob_path`) を返すが、コードはキャメルケース (`blobPath`) を期待 |
| 解決 | `toCamel()` ヘルパーでスネーク → キャメル変換 |

### 4. Bash テスト時のシェルクォート問題

| 項目 | 内容 |
|------|------|
| 症状 | curl で `DevPass123!` を含む JSON を送ると `Malformed JSON` エラー |
| 原因 | zsh が `!` を履歴展開として解釈し、`\!` にエスケープする |
| 解決 | heredoc (`<<'EOF'`) で JSON ファイルを生成し、`-d @file` で渡す。または Node.js スクリプトで直接テスト |

## テスト結果

```
=== Results ===
Pages: 1
Blocks: 4
  - start
  - bg assetId=01KK0S4ZVS3NCRWGP9W5S4KHSB
  - ch char=fantasy_hero expr=normal
  - text body="ここにセリフを入力してください" speaker="ファンタジー勇者"
Characters: 1
  - ファンタジー勇者 (fantasy_hero) expressions:1

PASS: All 4 blocks created
```

- TypeScript typecheck: PASS
- Hono unit tests: 45/46 PASS（1件は assist-cli タイムアウト — 既存・無関係）

## ルール（恒久）

**今後、プロジェクト新規作成は必ず初期コンテンツを含める。空の start ブロックだけにしない。**

## E2E テスト

`tests/project-auto-init.spec.ts` — プロジェクト新規作成時の初期ブロック検証テスト
