# コミットメッセージの慣行と例 — このリポジトリの実例集

作成日: 2026-04-25  
シリーズ: 04-document-implementation-workflow（第 2 部 標準ワークフロー）の補足  
関連: `.husky/commit-msg`, `.claude/skills/commit/SKILL.md`, `CLAUDE.md`「コミットは必ず commit スキル経由」

## この文書の位置付け

`04-document-implementation-workflow.md` 第 2 部の **「各 commit のメッセージに Co-Authored-By + 感想（pre-commit で強制）」** が、実際にどんな形で書かれているかの **実例集**。

「コミットメッセージの書き方」ではなく、**「このリポジトリで実際に守られている慣行」** を残すことが目的。

---

# 第 1 部 — 強制されている要素（フックで自動チェック）

`.husky/commit-msg` が **2 要素** を必須化:

```sh
# 1. Co-Authored-By 行があるか
if ! echo "$MSG" | grep -q "Co-Authored-By:"; then
  echo "❌ Co-Authored-By がありません — /commit を使ってください"
  exit 1
fi

# 2. 感想区切り（---）があるか
if ! echo "$MSG" | grep -q "^---$"; then
  echo "❌ 感想区切り（---）がありません — /commit を使ってください"
  exit 1
fi
```

つまり:
- `Co-Authored-By: ...` 行が必須
- 本文と感想を分ける `---` 単独行が必須

これは **`/commit` スキル経由でしか作れない構造**。`git commit -m "..."` と直接打つと弾かれる。

`Merge*` / `merge*` で始まるメッセージはスキップ（merge コミットは構造を要求しない）。

---

# 第 2 部 — メッセージの全体構造

このリポジトリのコミットメッセージは **5 ブロック構成**:

```
{プレフィックス}({スコープ}): {Phase/Day 番号} — {日本語タイトル}

{本文 — 何を・なぜ・どう変えたかの詳細}

## Design Change Note          ← C ゾーン変更時のみ
- 何を変えるか:
- なぜ必要か:
- 依存方向は変わるか: Yes / No
- 既存抽象を再利用できない理由:
- 破壊的変更か: Yes / No

## {セクション見出し}            ← 必要に応じて
{詳細な変更内容}

---
{Claude の一言：作業の感想・気づき・反省を 1〜3 行}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

# 第 3 部 — 1 行目（subject line）の慣行

## プレフィックス + スコープ

実観測から取れる慣行:

| プレフィックス | 意味 | 実例（最近 20 件から） |
|---|---|---|
| `feat:` | 新機能 | `feat(hono,prisma): ... プレイヤー状態拡張` |
| `fix:` | バグ修正 | `fix: タイムライン編集UI改善` |
| `docs:` | ドキュメントのみ | `docs: Phase 2 計画書ドラフトを追加` |
| `refactor:` | 動作不変のコード整理 | `refactor: ブロックカードのカラートークン一元化` |
| `test:` | テスト追加・修正 | `test(native-engine): ... ksc_runner を ctest smoke test として登録` |
| `chore:` | ビルド・設定・スクリプト | `chore: テストファイルとスクリーンショットを追加` |

## スコープ（プレフィックス直後の括弧）

変更が **複数のパッケージ・アプリにまたがる場合**にカンマ区切りで列挙:

- `feat(hono):` — 1 つだけ
- `feat(hono,prisma):` — 2 つ
- `feat(ksc-vm-cpp):` — パッケージ名直接

スコープは「どこを直したか」を 1 秒で伝える。

## Phase / Day 番号

Phase 進行中のコミットは **`Phase N Week M #X` または `Phase N Day Y`** を入れる:

```
feat(hono): Phase 2 Week 1 #1 — Google Play / Apple レシート検証を実装差し替え
feat(ksc-vm-cpp): Phase 1 Day 17 — parity fixtures 拡張 + RET on empty stack の divergence 修正
test(native-engine): Phase 1 Day 26 — ksc_runner を ctest smoke test として登録
```

これがあるおかげで:
- **計画書の D1〜D11 や Day 1〜Day 14 と 1:1 で対応**（前書 04 の「設計 → 計画 → 実装」マッピング）
- 完了レポートで **「14 コミットで 14 日分の成果物」** と機械的に書ける
- `git log --grep "Day 17"` で該当日の作業が一発で出る

## 日本語タイトル

- **日本語**で短く書く（プレフィックス・スコープ・Phase 番号は英語、タイトルは日本語）
- 区切りは **`—` (em dash)**（`-` ハイフンではない）
- 複数項目は **`・`** で区切る（カンマでも `+` でもなく、日本語的に）

```
feat: タイムライン編集UI改善・チャンネル生成共通化・プレビュー連動修正
                          ^               ^
```

---

# 第 4 部 — 本文の書き方

## ブロック 1: 冒頭の要約（2〜4 行）

何を・なぜ変えたかを **散文で** 書く。箇条書きにしない。

```
運営型ソシャゲの基礎となる「スタミナ消費 + 日次ボーナス」を実装。
Phase 1 の Wallet/Entitlement 体系の横に、リチャージ型リソースと連続
ログインインセンティブを追加する。
```

## ブロック 2: Design Change Note（C ゾーン変更時のみ）

`prisma/schema.prisma` や `packages/core/src/interfaces/` などを直したコミットは **必須**（pre-push で blocked）。

実例（Stamina + Daily Bonus 追加時）:

```
## Design Change Note
- 何を変えるか: prisma/schema.prisma に PlayerStamina / DailyClaim の
  2 モデルを追加。User に stamina / dailyClaims 逆参照を追加。
- なぜ必要か: 運営型ソシャゲのループ（スタミナ消費 → 回復待ち →
  IAP で即時回復）と、日次ログインインセンティブ（streak による
  報酬エスカレーション）をサーバー権威で管理する。
- 依存方向は変わるか: No
- 既存抽象を再利用できない理由: Wallet は加算・減算の単純な整数台帳。
  Stamina は「時間経過で自動回復」「上限あり」という時間ドメインが加わる
  ため別モデルが必要。
- 破壊的変更か: No
```

ポイント:
- 「**既存抽象を再利用できない理由**」が一番大事（書けないなら抽象を増やすべきではない）
- 「破壊的変更か」が Yes なら **マイグレ手順** をブロック 4 で書く

## ブロック 3: 詳細セクション（## 見出し付き）

実装の中身を機能ごとにセクション化。実例の構造:

```
## Prisma 追加
### PlayerStamina
- 1 user 1 row（userId PRIMARY）
- ...

## 純ロジック (src/lib/)
### stamina.ts
- StaminaState / effective / rebase / tryConsume / addStamina
- ...

## Hono routes (src/routes/player.ts 拡張)
- GET  /api/player/me                 — 既存に stamina フィールド追加
- POST /api/player/stamina/consume    — cost 消費、不足なら 400
- ...

## テスト (15 件新規)
stamina (8): 時間未経過 / 経過による回復 / max キャップ / ...
daily (7): tokyoDay の JST 変換 / streak 継続 / ...

結果:
- vitest: stamina-daily 15/15 pass
- billing + player 系統合: 41/41 pass
- tsc --noEmit 緑
```

## ブロック 4: 進捗・累計

Phase の累計コミット数や次の作業への接続を 1 行:

```
Phase 1 累計コミット 31 件。
```

```
Phase 1 → Phase 2 の節目

Phase 1 完了レポートの 6 項目 TODO のうち、最上位の 2 件
（Google Play Developer API / App Store Server API 実装差し替え）が
消化された。
```

## ブロック 5: TODO・落とし穴

スコープ外にした事項を明記（`半端に入れると誤検証を生む` のような判断含め）:

```
TODO 明記: Apple JWS の署名チェーン検証（Apple ルート CA から辿る）は
Phase 2 hardening で実装。Phase 1 scope は decode のみ。
```

```
JWS 署名検証（Apple ルート CA 経由）は Phase 1 スコープ外、TODO 明記
```

---

# 第 5 部 — 「Claude の一言」（感想ブロック）

## 強制されている形

`---` 単独行で本文と区切り、その下に感想を 1〜3 行。最後に `Co-Authored-By:`。

```
---
{感想本体}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 良い感想の例（実コミットから）

### 例 1 — 設計判断への満足

```
---
stamina の「遅延計算」設計、背景ジョブ不要でシンプルに済むのが気持ちよい。
cron で毎分 tick するより、updatedAt と interval から算出する方が
スケールも桁違いに楽。daily bonus の streak ロジック、最初 diffDays == 0
のケース（同日内で二重呼出される設計ミス）を考慮忘れそうになったが、
テストを先に書いたおかげで捕まえられた。
```

特徴:
- **何が気持ちよかったか**を具体的に（背景ジョブ不要）
- **危なかったポイント**を素直に告白（diffDays == 0 を忘れそうになった）
- **救ってくれたもの**を明記（テストを先に書いた）

### 例 2 — ライブラリ選定の所感

```
---
nlohmann::json の CBOR サポートが標準装備なので、外部依存ゼロでバイナリ
IR を手に入れられたのが良い。本当は MessagePack のほうが少し軽いが、
両対応するほどの差はない。strict=true + allow_exceptions=false の
組み合わせ、noexcept 契約を守りながら不正入力を拒否できる綺麗な
ペアで、nlohmann::json の設計が効いてる瞬間。
```

特徴:
- **代替案を検討した形跡**（MessagePack）
- **採用判断の理由**（差は小さい）
- **発見**（noexcept 契約と不正入力拒否の両立）

### 例 3 — 反省と次の方針

```
---
`prisma.$transaction` を vitest mock するときに「トランザクション内で
呼ばれる関数の引数に渡される tx」もまた mock しないといけないのが
ちょっと手間。今回は無名 tx を毎回生成する形で閉じたが、本物の
Prisma 型を満たさない quick-and-dirty なので、integration 層の E2E で
補完したい。refund の Pub/Sub 順序性非保証は state machine 側で冪等
処理にすることで吸収しているので、まあ実用上は問題なし。
```

特徴:
- **手間に感じた点**を率直に
- **手抜きした自覚**を明記（quick-and-dirty）
- **補う計画**（integration E2E）

### 例 4 — 設計投資が報われた瞬間

```
---
Phase 1 の成果を棚卸しながら Phase 2 計画を書いてると、Day 1 時点で
「IBilling 抽象を先に入れておく」判断が Phase 2 の工程を丸ごと 2 週
縮めてるのが見える。設計投資が利息付きで返ってくるのが気持ちいい。
ガチャは法務次第で遅らせる覚悟を明文化できてよかった、「作れる」と
「売れる」の間にある規制の壁を軽視するとプロジェクト止まるので。
```

特徴:
- **過去の判断が今効いてる**ことの実感
- **将来リスクへの構え**（法務）

### 例 5 — Skill ファイルから（短め）

```
---
今日は表を作るだけかと思ったら、KSとKSCの違いを整理するいい機会になった。
wait の単位が秒とミリ秒でバラバラなのは、うっかりすると絶対ハマりそう。
```

```
---
スキルのトリガー追加、地味だけどこういう細かい改善が積み重なって使いやすくなるんだよな。
「ここに保存して」を正しく解釈できなかったのは反省。
```

## 書くときのトーン指針

`.claude/skills/commit/SKILL.md` から:

- **作業内容を振り返った正直な感想**
- **たわいない・ゆるい**トーンでOK、堅苦しくしない
- 「面白かった」「難しかった」「地味だけど大事」など素直に
- 日本語

書きがちな失敗:
- ❌ 「○○を実装しました」← 本文の重複
- ❌ 「ユーザーのお役に立てれば幸いです」← 媚び
- ❌ 「次は××を実装したい」← 一言なら OK だが感想にしたい
- ✅ 「○○の設計、××より楽。△△は危なかったが□□で捕まえた」

---

# 第 6 部 — Co-Authored-By 行

## 形式

```
Co-Authored-By: Claude {モデル名} <noreply@anthropic.com>
```

実観測:
- `Claude Opus 4.7 (1M context)` — 現在主流（コンテキストウィンドウ拡張版）
- `Claude Opus 4.6` — 過去
- `Claude Sonnet 4.6` / `Claude Haiku 4.5` — 用途次第

## なぜ必須か

- **AI が書いたコード** であることをコミット履歴に永久に残す
- 半年後に `git blame` したときに「これは AI 主導の変更」と分かる
- GitHub の Co-Author 表示で AI のアバターが付く（責任の所在を明らかに）
- pre-commit でモデル名なし `Co-Authored-By:` 行を要求しているので **必ず付く**

---

# 第 7 部 — 完成形の実例（Stamina + Daily Bonus 追加）

実コミット `360861ea` の全文（一部省略・整形）:

```
feat(hono,prisma): Phase 2 Week 5 #7 — プレイヤー状態拡張（Stamina + Daily Bonus）

運営型ソシャゲの基礎となる「スタミナ消費 + 日次ボーナス」を実装。
Phase 1 の Wallet/Entitlement 体系の横に、リチャージ型リソースと連続
ログインインセンティブを追加する。

## Design Change Note
- 何を変えるか: prisma/schema.prisma に PlayerStamina / DailyClaim の
  2 モデルを追加。User に stamina / dailyClaims 逆参照を追加。
- なぜ必要か: 運営型ソシャゲのループ（スタミナ消費 → 回復待ち →
  IAP で即時回復）と、日次ログインインセンティブ（streak による
  報酬エスカレーション）をサーバー権威で管理する。
- 依存方向は変わるか: No
- 既存抽象を再利用できない理由: Wallet は加算・減算の単純な整数台帳。
  Stamina は「時間経過で自動回復」「上限あり」という時間ドメインが加わる
  ため別モデルが必要。DailyClaim は冪等性の鍵（userId+day UNIQUE）が
  重要で、PointTransaction の線形ログとは役割が違う。
- 破壊的変更か: No

## Prisma 追加
（中略）

## 純ロジック (src/lib/)
（中略）

## Hono routes (src/routes/player.ts 拡張)
- GET  /api/player/me                 — 既存に stamina フィールド追加
- POST /api/player/stamina/consume    — cost 消費、不足なら 400
- POST /api/player/stamina/refill     — amount 加算（IAP 消費型の受け皿）
- POST /api/player/daily/claim        — 今日の報酬受取、冪等

## テスト (15 件新規)
stamina (8): 時間未経過 / 経過による回復 / max キャップ / ...
daily (7): tokyoDay の JST 変換 / streak 継続 / ...

結果:
- vitest: stamina-daily 15/15 pass
- billing + player 系統合: 41/41 pass
- tsc --noEmit 緑

Phase 1 累計コミット 31 件。

---
stamina の「遅延計算」設計、背景ジョブ不要でシンプルに済むのが気持ちよい。
cron で毎分 tick するより、updatedAt と interval から算出する方が
スケールも桁違いに楽。daily bonus の streak ロジック、最初 diffDays == 0
のケース（同日内で二重呼出される設計ミス）を考慮忘れそうになったが、
テストを先に書いたおかげで捕まえられた。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

含まれる要素チェックリスト:
- ✅ プレフィックス: `feat`
- ✅ スコープ: `(hono,prisma)`
- ✅ Phase 番号: `Phase 2 Week 5 #7`
- ✅ 日本語タイトル
- ✅ 要約 2〜3 行
- ✅ Design Change Note（C ゾーン: prisma/schema.prisma を変更したため）
- ✅ 詳細セクション（## Prisma 追加 / 純ロジック / routes / テスト）
- ✅ 結果（テスト件数 + 緑確認）
- ✅ 累計コミット数
- ✅ `---` 区切り + 感想 4 行
- ✅ Co-Authored-By

---

# 第 8 部 — チェックリスト（コミット前の自己点検）

`/commit` スキルが裏で実行する手順を、人手でやるならこれ:

- [ ] プレフィックスは `feat / fix / docs / refactor / test / chore` のいずれか
- [ ] スコープは変更ファイルが属するパッケージ・アプリ
- [ ] Phase 進行中なら `Phase N Week M #X` または `Phase N Day Y` を含める
- [ ] タイトルは日本語、複数項目は `・` 区切り
- [ ] 要約 2〜4 行で「何を・なぜ」
- [ ] C ゾーン（`packages/core/src/interfaces/`, `Op.ts`, `SaveData.ts`, `prisma/schema.prisma` 等）を触っていれば **Design Change Note 必須**
- [ ] 実装ブロックを `## 見出し` で構造化
- [ ] テスト件数・pass/fail を明記
- [ ] スコープ外にした項目を **TODO 明記**
- [ ] `---` 単独行で区切る
- [ ] 感想 1〜3 行（具体・素直・ゆるく）
- [ ] `Co-Authored-By: Claude {モデル名} <noreply@anthropic.com>` で締める

このうち **`Co-Authored-By` と `---`** は `commit-msg` フックで強制。残りは慣行。

---

# まとめ — このコミット慣行の効果

「決まりが多すぎて面倒」に見えるが、実観測では以下の利益が出ている:

1. **完了レポートが機械化できる** — Phase 1 完了レポートが「14 コミットで 14 日分」と書けたのは、各コミットに Day 番号があるから
2. **意思決定が永続化される** — Design Change Note が `git log --grep "Design Change Note"` で全部出る
3. **AI と人間の境目が追える** — Co-Authored-By で `git blame` が AI 主導の変更を表示
4. **半年後に思い出せる** — 感想ブロックに「危なかった」「気持ちよかった」が残るので、コードからは読めない判断の温度感が保存される
5. **作業日誌になる** — 感想を流し読みするだけで「このプロジェクトがどう進んだか」のナラティブが出る（実際 `devlog` スキルが感想を集約して開発日誌を生成している）

> 結論: コミットメッセージは **「コードの diff だけでは伝わらない判断・温度・反省」** を埋める場所。フック強制 + スキル誘導でこれを徹底することで、組織記憶（or AI の長期記憶）になる。
