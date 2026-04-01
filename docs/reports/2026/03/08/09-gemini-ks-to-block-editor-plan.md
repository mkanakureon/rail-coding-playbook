# Gemini生成KSスクリプト → ブロックエディタ変換計画書

## 目的

Gemini 2.5 Flash が生成した `ch1_ep1.ks` をブロックエディタで表示・実行できるようにする。

## 入力ファイル

- `projects/fantasy/output/20260303_195617/ch1_ep1.ks` — **変更しない（読み取り専用）**
- 修正版は `projects/fantasy/output/20260303_195617/block/` に保存

## 問題点の分析

### 1. 背景アセット参照が不一致

KSファイルで使用:
| KS内ID | 意味 |
|--------|------|
| `l_izumi` | 泉の風景 |
| `yokoya02` | 薬草小屋の窓辺 |

→ 公式ファンタジーアセットの実在IDに置換する必要がある

### 2. キャラクターコマンドの書式が非標準

KSファイル内のパターン:
```
ルカ：@ch current fear        ← 日本語名 + ":"、current/fear は非標準
yolda：@ch current grave      ← yoldaは小文字、current/graveは非標準
```

**正しい書式:**
```
#luca
@ch luca serious center
テキスト
@l
```

問題:
- `current` はキャラクターIDではない（存在しない）
- `fear`, `surpri`, `worry`, `grave`, `gaze` 等は定義外の表情
- 「ルカ：」「yolda：」は speaker 記法ではない（正しくは `#speaker`）
- 表情IDが `characters.md` の定義 (`std`, `serious`, `smile`) と不一致

### 3. SEコマンドの参照が不一致

KSファイル内: `@se semi_end`, `@se door_crk`, `@se shard_cl`, `@se map_open`
→ これらのSEアセットは存在しない。削除するか、コメント化する

### 4. テキスト書式の問題

- `@r` (改行) と `@p` (ページ送り) は正しい
- ただし `ルカ：テキスト` 形式は KS パーサーが認識しない
- `「」` 括弧つきセリフとそうでないものが混在

### 5. choice ブロックの構文

```
choice {
  "選択肢テキスト" {
    結果テキスト
    @p
  }
}
```
→ これはコンパイラ対応済み。修正不要

## 変換方針

### Phase 1: KSファイル修正 → `block/ch1_ep1.ks` に保存

| 修正項目 | Before | After |
|---------|--------|-------|
| 背景ID | `@bg l_izumi` | `@bg {公式ファンタジーBG slug}` |
| 背景ID | `@bg yokoya02` | `@bg {公式ファンタジーBG slug 2つ目}` |
| キャラ表示 | `ルカ：@ch current fear` | `#ルカ\n@ch luca std center` |
| yolda表記 | `yolda：テキスト` | `#ヨルダ\nテキスト` |
| SE参照 | `@se semi_end` 等 | 削除（アセット不在のため） |
| 表情ID | `fear`, `surpri`, `grave` 等 | `std` or `serious`（定義内のものに統一） |

### Phase 2: 公式アセット調査

APIまたはDBから利用可能な公式ファンタジーアセットを取得:
```bash
# ローカルDBからファンタジーBGを検索
psql "postgresql://kaedevn:<YOUR_DB_PASSWORD>@localhost:5432/kaedevn_dev" \
  -c "SELECT id, filename, slug, subcategory FROM official_assets WHERE category='bg' AND subcategory ILIKE '%ファンタジー%';"
```

### Phase 3: ブロックエディタに読み込み

#### 方法A: API経由（推奨）

1. プロジェクトを新規作成（API経由 or 既存プロジェクト使用）
2. 公式アセットをインポート (`POST /api/projects/:id/assets/use-official`)
3. キャラクタークラスを作成
4. 修正済みKSをコンパイル → ブロックに変換 → `PUT /api/projects/:id` で保存

#### 方法B: CLIスクリプト作成

`scripts/cli/ks-to-blocks.ts` を作成:
1. 修正済みKSファイルを読む
2. `@kaedevn/compiler` でパース
3. `ksToBlocks()` でブロック配列に変換
4. API経由でプロジェクトに保存

### Phase 4: 動作確認

1. ブラウザで `http://localhost:5176/projects/editor/{projectId}` を開く
2. ブロック一覧が表示されることを確認
3. プレビュー再生で背景・キャラ・テキストが表示されることを確認

## 実装ステップ（所要時間目安）

| Step | 内容 | 依存 |
|------|------|------|
| 1 | 公式ファンタジーアセット一覧をDBから取得 | PostgreSQL稼働 |
| 2 | `block/` ディレクトリ作成 | なし |
| 3 | `ch1_ep1.ks` を修正して `block/ch1_ep1.ks` に保存 | Step 1 |
| 4 | 修正済みKSのコンパイルテスト | Step 3 |
| 5 | プロジェクト作成 + アセットインポート | APIサーバー稼働 |
| 6 | ブロック変換 + プロジェクト保存 | Step 4, 5 |
| 7 | ブラウザで動作確認 | Step 6, エディタサーバー稼働 |

## キャラクターマッピング

| KS内の名前 | characters.md ID | 表示名 | 使用表情 |
|-----------|-----------------|--------|---------|
| ルカ | `luca` | ルカ | `std`, `serious` |
| ヨルダ / yolda | `gard` ※ or 新規 | ヨルダ | `std` |

**注意**: `characters.md` にヨルダ（yolda）の定義がない。ガルド(`gard`)をヨルダとして流用するか、ルカ1人に統一するか判断が必要。

## リスク・注意事項

- 元ファイル `ch1_ep1.ks` は変更しない
- 公式アセットが見つからない場合、プロジェクト新規作成時の自動追加アセットを使う
- SE/BGM はアセットがないため削除。表示には影響しない
- Geminiが生成した独自書式（`ルカ：@ch current fear`）は標準KS書式に全面書き換え
