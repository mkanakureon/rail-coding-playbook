# kaedevn実装の重要ポイント

## ⚠️ 絶対に忘れないこと

### 1. インタプリタは使用しない

**kaedevnエンジンは .ks スクリプトを直接実行しません。**

```
.ks (人間が読める)
  ↓
[@kaedevn/compiler] でコンパイル
  ↓
CompiledScenario JSON (Op命令列)
  ↓
[OpRunner] で実行
  ↓
画面表示
```

- ❌ `Interpreter` は旧方式（使わない）
- ✅ `compile()` → `OpRunner` が正しい

### 2. スクリプト形式（スペース区切り）

**正しい形式**:
```ks
@bg bg_id
@ch character_id pose position
テキスト@l
```

**間違った形式（動かない）**:
```ks
@bg id="bg_id"              ← ❌ key=value形式
@chara_show id="..." pos="C"  ← ❌ 動かない
```

### 3. サーバー構成（3つ必要）

| サーバー | ポート | 役割 |
|---------|--------|------|
| APIサーバー | 3002 | プロジェクト管理・アセット配信 |
| エディター | 5173 | GUI編集画面 |
| プレビューサーバー | 3000 | ゲーム実行（コンパイル+OpRunner） |

### 4. プロジェクト構造

```
projects/                    # プロジェクト保存先
├── demo001/
│   ├── project.json         # Block構造（GUI用）
│   ├── pages/001.ks         # .ksスクリプト
│   └── manifest.json        # アセット情報

apps/public/assets/          # アセットファイル保存先
├── bg/bg*.png               # 背景画像
└── ch/ch*.png               # キャラ画像
```

### 5. プレビュー実行フロー

```
1. エディター「保存」
   → API: POST /api/project/:workId
   → projects/demo001/ に保存

2. エディター「再生」
   → 新しいタブで ksc-demo.html を開く

3. プレビュー画面
   → API: GET /api/preview/:workId
   → { script, assets } 取得

4. コンパイル
   → @kaedevn/compiler で .ks → JSON

5. 実行
   → OpRunner で JSON を実行

6. 画像取得
   → API: GET /assets/bg/bg*.png
   → http://localhost:3002/assets/ から取得
```

### 6. 重要なファイル

#### エディター側（Block → .ks変換）
- `apps/editor/src/store/useEditorStore.ts`
  - `buildPageScript()` - Block → .ks変換
  - `buildPreviewScript()` - 全ページ結合
  - **position変換**: `L`→`left`, `C`→`center`, `R`→`right`

#### プレビュー側（.ks → 実行）
- `packages/web/src/ksc-demo.ts`
  - APIからスクリプト取得
  - `compile(script)` でコンパイル
  - `runner.start(scenario, handler)` で実行
  - アセットURLを `http://localhost:3002` に変換

#### Op実行
- `packages/web/src/renderer/WebOpHandler.ts`
  - `setAssetManifest()` - APIから受け取ったアセット情報を設定
  - `resolveAssetPath()` - キャラ画像は pose を除いて検索
  - `bgSet()`, `chSet()` - Op命令の実行

#### API
- `apps/api/src/index.ts`
  - `GET /api/preview/:workId` - プレビュー用エンドポイント
  - `GET /assets/*` - アセットファイル配信（apps/public/から）

### 7. コンパイラのコマンド形式

`packages/compiler/src/parser/parseCommand.ts` で定義：

```typescript
@bg <id>                      // 背景
@ch <id> <pose> <position>    // キャラ（position: left/center/right）
@ch_hide <id>                 // キャラ非表示
@bgm <id>                     // BGM
@se <id>                      // SE
@wait <秒>                    // 待機
@jump <label>                 // ジャンプ
@l                            // クリック待ち
@p                            // 改ページ
@r                            // 改行
```

### 8. トラブルシューティング

#### 画像が表示されない
- 原因: アセットファイルが見つからない
- 確認: `ls apps/public/assets/bg/`
- 解決: APIサーバー（port 3002）が起動しているか確認

#### プレビューがエラー
- 原因: スクリプト形式が間違っている
- 確認: `cat projects/demo001/pages/001.ks`
- 解決: エディターで保存し直す（正しい形式で生成される）

#### コンパイルエラー
- 原因: 引数が不足（例: `@ch requires (name pose pos)`）
- 解決: エディターのBlock構造を確認し、再保存

---

## クイックリファレンス

### エディター開発時
- Block → .ks 変換は `useEditorStore.ts` の `buildPageScript()`
- スペース区切りで生成する
- position は `L/C/R` → `left/center/right` に変換

### プレビュー開発時
- `compile()` → `runner.start()` の順
- アセットURLは `http://localhost:3002` から取得
- `WebOpHandler` に `setAssetManifest()` でアセット情報を渡す

### コンパイラ開発時
- @コマンドはスペース区切り
- 引数は順番固定（key=value形式ではない）
- `packages/compiler/src/parser/parseCommand.ts` で定義

---

**参考ドキュメント**: `docs/server-urls.md`
