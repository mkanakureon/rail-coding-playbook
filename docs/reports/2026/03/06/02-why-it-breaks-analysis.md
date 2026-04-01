# なぜ毎回壊れるのか — 根本原因分析

作成日: 2026-03-06

## 結論

**「テストしていたはず」なのに壊れる原因は4つの構造的問題にある。**
コードの品質やロジックの問題ではなく、開発プロセスとデータ環境のギャップが原因。

---

## 問題 1: Unicode NFD/NFC 不一致（今回最大のハマりポイント）

### 何が起きた

- DB の `official_assets.subcategory` に「ファンタジー」が **NFD** (分解形) で格納されていた
- TypeScript の文字列リテラル `'ファンタジー'` は **NFC** (合成形)
- Prisma の `contains` は文字列を**そのまま** SQL の `LIKE` に渡すため、**バイト列が異なるとマッチしない**

### なぜテストで検出できなかった

| テスト手段 | なぜ見逃した |
|-----------|------------|
| 既存 E2E テスト (`azure-create-and-play.spec.ts`) | JavaScript の `.normalize('NFC')` で**比較前に正規化**していたため、API レスポンスの検証は通る。しかし DB 内の生データは NFD のまま |
| API テスト (curl) | 公式アセット一覧取得 → JavaScript で filter → 一致する。DB の `LIKE` 検索は使っていない |
| Prisma スキーマテスト | スキーマの整合性のみ。**データの文字コード**はチェックしない |

### 根本原因

**macOS のファイルシステムが NFD を生成し、それがインポート時にそのまま DB に入った。**
macOS の HFS+/APFS は濁音・半濁音を含むファイル名を NFD に正規化する。
公式アセットをインポートした際に `subcategory` がファイル名由来で NFD のまま DB に書き込まれた。

### 対策

```typescript
// 方法 1: DB クエリで両方の正規化形式を検索（今回採用）
WHERE subcategory LIKE '%ファンタジー%'  -- NFC
   OR subcategory LIKE '%ファンタジー%'  -- NFD

// 方法 2: インポート時に NFC に正規化（推奨・恒久対策）
subcategory = rawSubcategory.normalize('NFC');
```

---

## 問題 2: Foreign Key 制約の順序問題

### 何が起きた

- 新規プロジェクト作成で Asset レコードを先に作ろうとした
- `assets.project_id` → `projects.id` の FK 制約があるため、プロジェクトが存在しない状態で Asset を作成すると失敗

### なぜテストで検出できなかった

- 既存のプロジェクト作成は start ブロックのみで Asset を作らない
- Asset 追加は `PUT /api/projects/:id` (更新) や `/api/assets/:id/use-official` (別エンドポイント) で行う
- **新規作成と同時に Asset を作る**パターンは今回が初

### 対策

```
1. プロジェクトを先に作成（start ブロックのみ）
2. Asset レコードを作成（FK の参照先が存在する）
3. プロジェクトの data を更新（ブロックとキャラクターを追加）
```

---

## 問題 3: API レスポンス構造の不統一

### 何が起きた

- テストコードが `proj.data?.data?.pages` と書いていたが、実際は `proj.project?.data?.pages`
- テストの5つ中4つが、データ抽出の部分で失敗

### なぜ起きる

API のレスポンス構造が**エンドポイントによって異なる**:

| エンドポイント | レスポンス構造 |
|--------------|-------------|
| `POST /api/projects` | `{ message, project: { id, title, createdAt } }` — data なし |
| `GET /api/projects/:id` | `{ project: { id, title, data: { pages, characters } } }` |
| `PUT /api/projects/:id` | `{ project: { id, title, data: { pages, characters } } }` |
| `GET /api/projects` (一覧) | `{ projects: [{ id, title }] }` — data なし |

テストを書くたびに「このエンドポイントの構造はどうだっけ」となり、毎回微妙にずれる。

### 対策

テストにヘルパー関数を用意する（今回作成した `fetchProjectData()`）。
将来的には API レスポンスの型を共有パッケージで定義する。

---

## 問題 4: Bash シェルのクォート問題（テスト実行そのものが壊れる）

### 何が起きた

- `curl -d '{"password":"DevPass123!"}'` で `!` が zsh の履歴展開に引っかかる
- `echo -n '...'` でも zsh は `!` をエスケープする
- `$()` サブシェルでネストするとさらに破壊される

### なぜ毎回ハマる

- **bash と zsh で挙動が違う**: bash はシングルクォート内の `!` をそのまま通すが、zsh は `!` を常に展開しようとする
- `curl | node -e "..."` のパイプは、各コマンドの stdout/stdin の接続タイミングで不安定
- Claude Code のシェル実行は zsh を使用

### 対策

```bash
# 方法 1: heredoc でファイルに書き出し（zsh safe）
cat <<'EOF' > /tmp/body.json
{"password":"DevPass123!"}
EOF
curl -d @/tmp/body.json ...

# 方法 2: Node.js スクリプトで直接テスト（推奨）
node /tmp/test_script.js

# 方法 3: Playwright テストで検証（最も確実）
npx playwright test tests/xxx.spec.ts
```

---

## まとめ: 壊れるパターンの分類

| パターン | 頻度 | 検出タイミング | 予防策 |
|---------|------|-------------|--------|
| Unicode NFD/NFC | 日本語データを扱うたび | 実行時のみ | インポート時に `.normalize('NFC')` |
| FK 制約順序 | 新しいデータ作成パターンを追加するたび | 実行時のみ | 処理順序を意識、トランザクション使用 |
| レスポンス構造不一致 | テストを新規作成するたび | テスト実行時 | ヘルパー関数、型定義共有 |
| シェルクォート | `!` `$` `"` を含むデータをcurlで送るたび | テスト実行時 | heredoc or Node.js スクリプト |

## 恒久的な改善案 → 実施状況

| # | 対策 | 状況 |
|---|------|------|
| 1 | 公式アセットインポート時に NFC 正規化を強制 | **実施済み** (2026-03-06) |
| 2 | API レスポンス型を `packages/core/src/types/` で定義 | 未実施 |
| 3 | API テストは Playwright の `request` を使う | **実施済み** (2026-03-06) |
| 4 | テストヘルパーを `tests/helpers/` に集約 | 未実施 |

### 対策 1: NFC 正規化 — 変更箇所

| ファイル | 変更内容 |
|---------|---------|
| `apps/hono/src/routes/admin.ts` | アップロード時: `category?.normalize('NFC')` |
| `apps/hono/src/routes/assets.ts` | use-official コピー時: `subcategory?.normalize('NFC')` |
| `apps/hono/src/routes/official-assets.ts` | クエリパラメータ: `normalize('NFC')` |
| `apps/hono/src/routes/projects.ts` | 新規作成時: `subcategory?.normalize('NFC')` + raw query 廃止 → Prisma `contains` に簡素化 |
| DB (手動) | `UPDATE official_assets/assets SET subcategory = normalize(subcategory, NFC)` — 39行修正 |

**Windows 対策**: Windows (NTFS) は NFC を使用するため、macOS (NFD) → DB → Windows の経路で不一致が起きていた。NFC 正規化により OS に依存しなくなった。
