# Gemini生成KS → ブロックエディタ変換 振り返り

## 概要

Gemini 2.5 Flash が生成した `ch1_ep1.ks` をブロックエディタで表示・プレイできるようにした。
KSファイルの修正 → API経由でプロジェクト作成 → E2Eテストで動作確認。

## 入出力

| 項目 | パス |
|------|------|
| 元ファイル（読み取り専用） | `projects/fantasy/output/20260303_195617/ch1_ep1.ks` |
| 修正版KS | `projects/fantasy/output/20260303_195617/block/ch1_ep1.ks` |
| 変換スクリプト | `scripts/cli/ks-to-project.mjs` |
| 変換データJSON | `projects/fantasy/output/20260303_195617/block/conversion-data.json` |
| E2Eテスト | `tests/local/editor/gemini-ks-project.spec.ts` |

## KS変換パイプライン

### 1. KSファイル修正（元ファイル → block/ch1_ep1.ks）

| 修正項目 | Before | After |
|---------|--------|-------|
| 背景ID | `@bg l_izumi` | `@bg {公式ファンタジーBG filename}` |
| キャラ表示 | `ルカ：@ch current fear` | `#ルカ\n@ch luca normal center` |
| speaker | `yolda：テキスト` | `#ヨルダ\nテキスト` |
| SE参照 | `@se semi_end` 等 | 削除（アセット不在） |
| 表情ID | `fear`, `grave` 等 | `normal`（定義内に統一） |
| choice | choice ブロック全体 | 削除 |

### 2. 変換スクリプト（ks-to-project.mjs）

API経由でプロジェクトを作成し、KSをエディタブロックに変換する。

```
ログイン → プロジェクト作成（タイムスタンプ付き）
  → 公式BGアセットインポート（use-official API）
  → キャラ画像インポート → キャラクラス作成
  → KS行パース → テキスト分割 → ブロック配列生成
  → PUT /api/projects/:id で保存
  → conversion-data.json に変換データ保存
```

#### BGスラッグ解決（重要）

`generateSlugFromFilename` がスラッグを正規化（小文字化、`-`→`_`、先頭60文字で切断）するため、KS内のファイル名と完全一致しない。**先頭60文字のプレフィックス一致**で解決する:

```javascript
const ksNorm = ksSlug.toLowerCase().replace(/-/g, '_');
const ksPrefix = ksNorm.substring(0, 60);
const asset = allAssets.find(a => {
  const aNorm = a.slug.replace(/^bg_/, '');  // bg_ プレフィックス除去
  return aNorm.startsWith(ksPrefix);
});
```

#### テキストウィンドウ制約に基づく自動分割

TextWindow.ts の定数から算出:

| パラメータ | 値 | 算出根拠 |
|-----------|-----|---------|
| charsPerLine | 46文字 | wordWrapWidth(1112px) / fontSize(24px) |
| maxLines | 3行 | 常に3行（4行分の高さを3行で使用） |
| lineHeight | 40px | fontSize(24) × 1.25 × 4/3 |

- 。（句点）で文を分割
- 46文字を超える行は句読点位置で強制 `@r`
- 3行を超えたら新しいテキストブロックに分割

#### @r の扱い

- **block.body**: `テキスト。@r\n次のテキスト` — `@r` が明示的に見える、`\n` はエディタ表示用
- **KS生成時**（preview.ts）: `\n` を除去、`@r` を独立行に分離
  ```
  テキスト。
  @r
  次のテキスト
  @l
  ```
- インライン `@r`（`テキスト@rテキスト`）はコンパイラが認識しないので必ず独立行にする

#### speaker の扱い

- テキストブロックに `speaker` フィールドは**設定しない**
- `@ch` コマンド実行時にエンジンがキャラクラスの `name` を自動取得して表示
- `#speaker` はKSスクリプトに出力しない
- 実装箇所: `WebOpHandler.ts` の `chSet` で `this.currentWho = character.name`

#### キャラ位置（重なり防止）

KSの位置指定を無視し、キャラごとに固定位置を割り当て:

```javascript
const charPositions = { luca: 'R', yolda: 'L' };
```

### 3. preview.ts の KS生成ルール

`generateKSCScript` がブロック配列からKSスクリプトを生成する際:

- `bg` ブロック → `lastVisibleCharSlug = null`（場面転換でspeakerリセット）
- `ch` ブロック（visible）→ `lastVisibleCharSlug` 更新
- `ch` ブロック（hide）→ 該当キャラなら `lastVisibleCharSlug = null`
- `text` ブロック → `@r` を独立行に分離、`\n` 除去、`#speaker` なし

### 4. エンジン側の変更

#### 発話者フォーカス演出（WebOpHandler.ts）

`chSet` 時にアクティブキャラを明るく、他を暗くする:

```typescript
private focusCharacter(activeName: string): void {
  const DIM_TINT = 0x888888;
  const ACTIVE_TINT = 0xffffff;
  for (const [charName] of this.currentCharacters) {
    const sprite = this.sprites.get(charName);
    if (!sprite) continue;
    sprite.tint = charName === activeName ? ACTIVE_TINT : DIM_TINT;
  }
}
```

#### テキスト行間（TextWindow.ts）

`lineHeight: 40` を設定（4行分の高さを3行で使用）:

```typescript
style: {
  fontSize: TEXT_FONT_SIZE,  // 24
  lineHeight: 40,            // 24 * 1.25 * 4/3
  wordWrap: true,
  wordWrapWidth: windowWidth - PADDING * 2,
}
```

#### キャラ名自動表示（WebOpHandler.ts）

`chSet` 時にキャラクラスの `name` を `currentWho` にセット。
`#speaker` コマンドなしでもテキストウィンドウに名前が表示される。

## E2Eテスト

`tests/local/editor/gemini-ks-project.spec.ts`

| Phase | 内容 | 確認項目 |
|-------|------|---------|
| 1 | API でプロジェクト作成 | `ks-to-project.mjs` 実行、ブロック数 ≥ 10 |
| 2 | エディタを開く | localStorage 認証注入、ページ読み込み |
| 3 | ブロック表示確認 | `[data-block-id]` で全ブロック確認 |
| 4 | 全ブロッククリック | パルスアニメーション付きで順次クリック |
| 5 | プレイ完走 | canvas クリック、Scenario completed 検出 |

実行: `npx playwright test tests/local/editor/gemini-ks-project.spec.ts --config=tests/configs/playwright.local.config.ts`

結果: 48ブロック、約60クリックで完走、約3分。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `scripts/cli/ks-to-project.mjs` | KS→ブロック変換スクリプト（テキスト分割、@r挿入、JSON保存） |
| `tests/local/editor/gemini-ks-project.spec.ts` | E2Eテスト |
| `apps/hono/src/routes/preview.ts` | KS生成: @r独立行化、#speaker削除、ch→speaker自動解決 |
| `apps/editor/src/utils/ksConverter.ts` | blocksToKs: @r保持、\n除去 |
| `packages/web/src/renderer/WebOpHandler.ts` | 発話者フォーカス演出、キャラ名自動表示 |
| `packages/web/src/renderer/TextWindow.ts` | lineHeight: 40px（3行表示最適化） |

## 教訓

1. **BGスラッグは完全一致しない** — `generateSlugFromFilename` の正規化（小文字、`-`→`_`、truncate）を考慮してプレフィックス一致で解決
2. **インライン `@r` はNG** — コンパイラはインラインコマンドを認識しない。`@r` は必ず独立行に
3. **`#speaker` よりキャラクラス参照** — `chSet` でキャラクラスの `name` を直接使えば `#speaker` 不要
4. **テキスト分割はエンジン制約から逆算** — TextWindow の寸法・フォントサイズから1行文字数・最大行数を計算し、変換時に自動分割
