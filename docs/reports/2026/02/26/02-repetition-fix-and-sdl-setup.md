# 反復問題対策の実装 + SDL ビルド環境構築

**日付**: 2026-02-26
**コミット**: `feat: 反復問題対策 — 禁止リスト蓄積・行動パターン導入・章別情景キーワード`

---

## 1. 反復問題対策（3つの改善）

`01-genre-generation-review.md` で報告した4ジャンルの反復問題に対し、以下の3対策を実装した。

### 対策1: 章をまたぐ禁止リストの蓄積

**問題**: `usedExpressions`（使用済み表現の禁止リスト）がシーンごとにリセットされ、エピソード・章をまたぐ蓄積がなかった。

**変更内容** (`scripts/assist-cli.ts`):

| 項目 | Before | After |
|------|--------|-------|
| シーン間 | 前シーンの表現で **置換** | **追加（append）**、最大50件で古いものを切り捨て |
| エピソード間 | 引き継ぎなし | `initialUsedExpressions` パラメータで渡す |
| 章レベル | 引き継ぎなし | `runAll` で `chapterUsedExpressions` を蓄積して渡す |
| 篇区切り | — | 最新の半分を残してトリム |

`runStage3` の戻り値に `usedExpressions` を追加し、`runAll` で受け取って蓄積する設計。

### 対策2: キャラ設定を行動パターンに変更

**問題**: `speechStyle` に「いや待ってくれ」等の決め台詞が書かれていたため、LLM が毎シーン機械的にそれを出力していた。

**変更内容**:

| ファイル | 変更 |
|---------|------|
| `types.ts` | `CharacterSetting` に `behaviorPatterns?: string` 追加 |
| `md-parser.ts` | `行動パターン` フィールドをパース |
| `prompts.ts` (formatCharacters) | `behaviorPatterns` を `speechStyle` より先に出力 |
| `prompts.ts` (buildStage3Prompt) | charGuide で `behaviorPatterns` 優先、`speechStyle` は「参考。毎回同じ台詞を使わず変化させること」に注記 |
| `prompts.ts` (ルール) | 「口癖を複数シーンで繰り返さない。行動・表情・仕草で代替表現する」を追加 |
| `chunker.ts` | キャラチャンクに `behaviorPatterns` を含める |

**4ジャンル全16キャラの `characters.md` を更新**:
- `口調`: 決め台詞（「いや待ってくれ」等）→ 口調の傾向（「焦ると早口になる」等）
- `行動パターン`: 新規追加（「困ると頭を抱えて天井を見る」等）

### 対策3: 章別情景キーワードセットの注入

**問題**: 情景描写が全章同一で、季節・天候の変化がなく同じ文言がコピペされていた。

**変更内容** (`prompts.ts`):

```typescript
const ATMOSPHERE_KEYWORDS: Record<number, string[]> = {
  1: ['残暑', '蝉の最後の声', '汗ばむ', '入道雲'],
  2: ['落ち葉', '日暮れの早さ', '冷たい風', '長袖'],
  3: ['金木犀', '雨上がりの匂い', '秋晴れ', '空の高さ'],
  4: ['初霜', '吐く息の白さ', '枯れ枝', '木枯らし'],
  5: ['冬の星空', '静寂', '結露', '遠い焚き火の匂い'],
};
```

- `buildStage3Prompt` に `chapterNumber` パラメータを追加
- 章番号からキーワードを引いてプロンプトに注入（6章以上はループ）
- `scripts/assist-cli.ts` の `runStage3` / `runAll` から章番号を渡す

### 補足: comedy.yaml の修正

`characterRules` の「各キャラのボケパターンを固定し、予測可能性で笑いを取る」を「各キャラのボケの方向性は保ちつつ、毎話バリエーションを持たせる」に変更。反復を助長するルールだったため。

他3ジャンル（fantasy, horror, slice-of-life）の YAML は反復を助長するルールがなく変更不要。

### 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/hono/src/lib/assist/types.ts` | `behaviorPatterns` フィールド追加 |
| `apps/hono/src/lib/assist/md-parser.ts` | `行動パターン` パース追加 |
| `apps/hono/src/lib/assist/prompts.ts` | charGuide修正, 情景キーワード追加, ルール追加, 章番号パラメータ |
| `apps/hono/src/lib/assist/chunker.ts` | `behaviorPatterns` 追加 |
| `scripts/assist-cli.ts` | 禁止リスト蓄積, 章番号渡し, usedExpressions戻り値 |
| `projects/comedy/settings/characters.md` | 行動パターン追加, 口調を傾向に書き換え |
| `projects/fantasy/settings/characters.md` | 同上 |
| `projects/horror/settings/characters.md` | 同上 |
| `projects/slice-of-life/settings/characters.md` | 同上 |
| `apps/hono/src/lib/assist/genre-rules/comedy.yaml` | characterRules 修正 |

### 検証方法

```bash
npx tsx scripts/assist-cli.ts all --settings projects/comedy/settings/ --max-chapters 2
```

出力された `全話テキスト.md` で以下を確認:
- 同一台詞の出現回数が3回以下に減っているか
- 章ごとに情景描写が異なるか
- キャラの表現に行動・仕草のバリエーションがあるか

---

## 2. SDL ビルド環境構築

### 背景

kaedevn-monorepo は Nintendo Switch を一次ターゲットとするビジュアルノベルエンジン。Switch 向けのネイティブレンダリング基盤として SDL3 を導入した。

### 構成

- **SDL ソース**: `packages/sdl/`（git submodule、libsdl-org/SDL main ブランチ）
- **ビルドスクリプト**: `scripts/build-sdl.sh`
- **ビルド出力**: `packages/sdl/build/`

### ビルド環境確認結果

| 項目 | 値 |
|------|-----|
| SDL バージョン | SDL 3.5.0 |
| OS | macOS 26.2 (Darwin 25.2.0) |
| CPU | Apple Silicon (arm64) |
| コンパイラ | Apple Clang 17.0.0 |
| CMake | 4.2.3 |
| ビルド結果 | 成功（100%、エラーなし） |

### 有効バックエンド

| カテゴリ | ドライバ |
|---------|---------|
| Video | cocoa, dummy, offscreen |
| Render | gpu, metal, ogl, ogl_es2, vulkan |
| GPU | metal, openxr, vulkan |
| Audio | coreaudio, disk, dummy |
| Joystick | hidapi, iokit, mfi, virtual |
| Camera | coremedia, dummy |

### 使い方

```bash
# ビルド（初回: configure + build、2回目以降: 差分ビルド）
./scripts/build-sdl.sh

# テスト実行
packages/sdl/build/test/testdraw        # 図形描画ウィンドウ
packages/sdl/build/test/testsprite      # スプライトバウンドデモ
packages/sdl/build/test/testcontroller  # ゲームパッド入力
packages/sdl/build/test/testaudio       # オーディオ再生
packages/sdl/build/test/testgl          # OpenGL レンダリング
packages/sdl/build/test/testautomation  # ユニットテスト一括
```

### 注意事項

- `libusb-1.0` は未検出だが、macOS では IOKit で代替されるため問題なし
- `packages/sdl/build/` は `.gitignore` 対象にすべき（ビルド成果物）
- 他メンバーが clone した後は `git submodule update --init` が必要
