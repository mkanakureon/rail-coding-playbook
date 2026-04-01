# create-story PoC 結果 — Claude Code 単体でゲーム制作

- **実施日**: 2026-03-13
- **目的**: Claude Code が既存 API だけでプロジェクト作成〜シナリオ保存まで完結できるか検証
- **結果**: **成功。新しいコードは1行も不要。**

---

## 実行手順と結果

### Step 1: 認証

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login.json
```

- トークン取得成功（179文字の JWT）
- 唯一のハマりどころ: `!` が zsh でエスケープされて `\!` になり JSON が壊れた → ファイル経由で解決

### Step 2: プロジェクト新規作成

```bash
curl -s -X POST http://localhost:8080/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"CLI試作: 学園ラブコメ"}'
```

- プロジェクト ID: `01KKK3GB4KTM44SBNN2MA32HCQ`
- 自動で公式アセット（ファンタジー）がインポートされた
  - 背景 5 枚（ダークソウル風景色、森、草原、城、パノラマ）
  - キャラクター 5 人（勇者、魔法使い、戦士、盗賊、僧侶）
  - 初期ブロック（start → bg → ch → text）1ページ

### Step 3: `_ai_context` でアセット確認

```bash
curl -s http://localhost:8080/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"
```

`_ai_context` から取得できた情報:

| カテゴリ | 件数 | 内容 |
|---------|:----:|------|
| `availableAssets.backgrounds` | 5 | ファンタジー背景（ID + ファイル名） |
| `availableCharacters` | 5 | 勇者・魔法使い・戦士・盗賊・僧侶（slug + 表情一覧） |
| `availablePages` | 1 | 初期ページ |

### Step 4: シナリオ JSON 生成

Claude Code がテキストと構造を同時に生成。外部 LLM 呼び出しは不要。

**生成したもの:**

| ページ | 名前 | ブロック数 | 内容 |
|:------:|------|:--------:|------|
| page1 | プロローグ — 旅立ちの朝 | 11 | bg → テキスト → 勇者登場 → セリフ3つ → 戦士登場 → 選択肢 |
| page2 | 第1話 — 森の魔法使い | 13 | bg → 勇者+戦士表示 → 魔法使い登場 → 会話 → jump |
| page3 | 第2話 — 魔王城への道 | 12 | bg → 3人表示 → 会話 → 「つづく」 |
| **合計** | | **36** | text×19, ch×8, bg×3, choice×1, jump×1, start×3, choice内分岐×1 |

**使用したブロックタイプ:**

- `start` — 各ページ先頭
- `bg` — 背景切替（3種の背景アセットを使用）
- `ch` — キャラクター表示（pos: L / C / R）
- `text` — 地の文（`speaker` なし）とセリフ（`speaker` あり）
- `choice` — 2択（両方 page2 にジャンプ）
- `jump` — page2 → page3 への自動遷移

### Step 5: PUT で保存

```bash
curl -s -X PUT http://localhost:8080/api/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -d @/tmp/story-data.json
```

- 成功: `"プロジェクトを更新しました"`
- エディタで開いて全ブロックが正しく表示されることを確認

### Step 6: エディタで確認

```bash
open "http://localhost:5176/projects/editor/01KKK3GB4KTM44SBNN2MA32HCQ"
```

- エディタが正常に開く
- 3ページがサイドバーに表示
- 各ブロックの内容が正しい

---

## 所要時間

| ステップ | 時間 |
|---------|:----:|
| 認証（ハマり含む） | 2分 |
| プロジェクト作成 | 10秒 |
| アセット確認 | 30秒 |
| シナリオ JSON 生成 | 1分 |
| 保存 + 確認 | 10秒 |
| **合計** | **約4分** |

認証のエスケープ問題を除けば **2分以内** で完了。

---

## 判明した課題

### 認証の `!` エスケープ問題

zsh で `curl -d '{"password":"DevPass123!"}'` とすると `!` が `\!` にエスケープされて JSON が壊れる。

**対策**: auth スキルでファイル経由にするか、`scripts/cli/auth-cache.ts` で Node.js から直接叩く。

### アセットがファンタジー固定

現状の `POST /api/projects` は公式アセットのうちファンタジーカテゴリを自動インポートする。学園ものを作りたい場合はアセットが合わない。

**対策**: 公式アセットの subcategory を指定できるパラメータを追加するか、作成後に `use-official` API でアセットを差し替える。

### 表情が `normal` のみ

キャラクターの表情バリエーションが1種しかない。

**対策**: 公式アセットに表情差分を追加するか、作者がアップロードしたアセットを使う。

---

## 結論

| 質問 | 回答 |
|------|------|
| Claude Code 単体でできるか？ | **はい** |
| 新しいコードは必要か？ | **不要**（既存 API で完結） |
| スキルファイルは必要か？ | あると便利（手順の自動化）だが、なくても動く |
| assist-cli（Gemini）は必要か？ | 短編には不要。長編の大量テキスト生成時のみ |
| 試作レベルか実用レベルか？ | **実用レベル**（エディタで正常表示、プレビュー可能） |

**「作って」と言われたら、Claude Code はその場で API を叩いてゲームを作れる。**
スキルファイル（.md）を書けば、手順を毎回考えなくても自動で同じフローが走る。
