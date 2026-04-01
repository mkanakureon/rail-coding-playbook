# Claude Code ゲーム制作スキル設計

- **作成日**: 2026-03-13
- **用途**: Claude Code をインターフェースとして、作者がノベルゲーム / ツクール型ゲームを制作するためのスキル体系
- **前提**: 作者は Claude Code を使える（ターミナルで `claude` を起動して会話する）
- **PoC**: 2026-03-13 実施済み（19-create-story-poc-result.md）— API だけで3ページ36ブロックのシナリオ作成に成功

---

## 1. 設計思想

**Claude Code 自体がゲーム制作ツールである。**

作者は日本語で指示するだけ。Claude Code が API を叩き、JSON を組み立て、保存し、プレビューを開く。

```
作者: 「ファンタジーRPG作って」
Claude Code: プロジェクト作成 → アセット選択 → シナリオ生成 → 保存 → プレビュー

作者: 「メッセージウィンドウを上に移動して」
Claude Code: PlayLayout JSON を編集 → 保存 → プレビュー
```

2つの制作モードがある:

| モード | 編集対象 | 出力 JSON |
|--------|---------|----------|
| **ノベル制作** | ストーリー（ブロック/ページ） | `data.pages[].blocks[]` |
| **ツクール制作** | プレイ画面UI（レイアウト） | `data.playLayout` |

どちらも同じプロジェクト内に共存する。ノベル制作でストーリーを作り、ツクール制作でUI見た目を整える。

---

## 2. スキル一覧

| # | スキル | トリガー | モード | 機能 |
|---|--------|---------|:------:|------|
| 1 | `auth` | 「ログインして」 | 共通 | 認証トークン取得・保存 |
| 2 | `create-story` | 「物語を作って」「ゲーム作って」 | ノベル | 会話→プロジェクト一括作成 |
| 3 | `edit-blocks` | 「セリフ変更」「ブロック追加」 | ノベル | ブロック CRUD・ページ操作 |
| 4 | `story-status` | 「全体を見せて」「構成確認」 | ノベル | プロジェクト俯瞰表示 |
| 5 | `story-preview` | 「プレビューして」「見せて」 | 共通 | ブラウザプレビュー + スクリーンショット |
| 6 | `set-layout` | 「UIを変えて」「RPG風にして」 | ツクール | PlayLayout JSON 編集 |
| 7 | `edit-map` | 「マップを作って」 | ノベル | タイルマップ作成・編集 |
| 8 | `publish` | 「公開して」 | 共通 | 公開フラグ ON・URL 発行 |

---

## 3. 作者のワークフロー

### ノベルゲームを作る

```
「ログインして」           → auth
「学園ラブコメ作って」       → create-story（プロジェクト＋シナリオ一括生成）
「プレビューして」          → story-preview
「2話目のセリフもっと明るく」  → edit-blocks（テキスト修正）
「選択肢追加して」          → edit-blocks（choice + 分岐ページ追加）
「全体を見せて」            → story-status（ページ構成ツリー表示）
「公開して」               → publish
```

### ツクール型のUI調整を加える

```
「RPG風のUIにして」         → set-layout（rpg-classic プリセット適用）
「メッセージウィンドウを上に」  → set-layout（rect.y 変更）
「ゴールド表示を追加して」     → set-layout（gold-window 要素追加）
「プレビューして」            → story-preview（UI変更を確認）
```

### フルコースで作る

```
create-story → edit-blocks で調整 → set-layout でUI → edit-map でマップ → preview → publish
```

---

## 4. スキル詳細

### 4-1. `/auth` — 認証

```
トリガー: 「ログインして」

手順:
1. POST /api/auth/login でトークン取得
2. ~/.kaedevn/token に保存
3. 以降のスキルは自動でトークンを読む

注意: zsh の ! エスケープ問題があるため、ファイル経由で JSON を送る
```

---

### 4-2. `/create-story` — ストーリー一括作成

作者の一言から、プロジェクト作成〜シナリオ生成〜保存まで一気に行う。

#### 入力パターン

| 作者の指示 | Claude Code の解釈 |
|-----------|------------------|
| 「ファンタジー作って」 | ジャンル=ファンタジー、キャラ・設定は自動 |
| 「学園もの、主人公は女子高生」 | ジャンル=学園、主人公=女子高生、他は自動 |
| 「ホラー。廃病院。3人で探検」 | ジャンル=ホラー、舞台=廃病院、キャラ3人 |
| 「続きを作って」 | 直近プロジェクトにページ追加 |

#### 手順

```
1. POST /api/projects で新規作成
2. GET /api/projects/:id → _ai_context からアセットを確認
   - availableAssets.backgrounds — 背景一覧
   - availableCharacters — キャラクター + 表情一覧
3. ジャンルに合う背景・キャラを選択
4. ページ構成を設計（短編5ページ / 中編10ページ）
5. 各ページにブロックを生成（下記ブロック型から選択）
6. PUT /api/projects/:id で保存
7. プレビュー URL を表示
```

#### 使用するブロック型（14型）

| ブロック | 用途 | 主なプロパティ |
|---------|------|--------------|
| `start` | ページ先頭（必須・自動） | — |
| `bg` | 背景表示 | `assetId` |
| `ch` | キャラクター表示/非表示 | `characterId`, `expressionId`, `pos`(L/C/R) |
| `text` | セリフ・地の文 | `body`, `speaker`(省略で地の文) |
| `choice` | 選択肢 | `options[]`（text, toPageId, condition, actions） |
| `jump` | ページ遷移 | `toPageId` |
| `set_var` | 変数操作 | `varName`, `operator`(=,+=,-=), `value` |
| `if` | 条件分岐 | `conditions[]`, `thenBlocks[]`, `elseBlocks[]` |
| `effect` | 画面演出 | `effect`(shake/flash/fade/vignette/blur), `intensity`, `duration` |
| `screen_filter` | 画面フィルタ | `filterType`(sepia/grayscale/blur/pc98/gameboy/crt), `intensity` |
| `overlay` | オーバーレイ画像 | `assetId`(category=ovl), `visible` |
| `timeline` | タイムライン演出 | `label`, `timeline`(TimelineRoot) |
| `battle` | バトル開始 | `troopId`, `onWinPageId`, `onLosePageId` |
| `ksc` | KSC スクリプト直書き | `script` |

#### テキスト生成ルール

| ルール | 内容 |
|--------|------|
| 文体 | ノベルゲーム標準（地の文+セリフ） |
| 1ブロック | 1〜3行（40文字×3行以内） |
| 改行 | `\n` で改行 |
| セリフ | `speaker` にキャラ名 |
| 地の文 | `speaker` なし |
| 選択肢 | 2〜4個。分岐先ページを自動作成 |
| ID | `{type}-{Date.now()}` で生成 |

#### 生成例

```json
{
  "id": "page-1773388967059",
  "name": "プロローグ — 旅立ちの朝",
  "blocks": [
    { "id": "start-1773388967059", "type": "start" },
    { "id": "bg-1773388967060", "type": "bg", "assetId": "01KKK3GB584JZ2N8D6ZT88T7AJ" },
    { "id": "ch-1773388967061", "type": "ch", "characterId": "fantasy_hero", "expressionId": "normal", "pos": "C" },
    { "id": "text-1773388967062", "type": "text", "body": "朝靄が草原を覆い、遠くに古びた城の尖塔が見える。\n風が草を揺らし、旅立ちを促すように吹き抜けた。" },
    { "id": "text-1773388967063", "type": "text", "body": "――今日から、俺の冒険が始まる。", "speaker": "勇者" },
    { "id": "effect-1773388967064", "type": "effect", "effect": "fade", "intensity": 0.8, "duration": 1000 },
    { "id": "choice-1773388967065", "type": "choice", "options": [
      { "text": "仲間を探しに行く", "toPageId": "page-forest" },
      { "text": "ひとりで旅立つ", "toPageId": "page-road" }
    ]}
  ]
}
```

---

### 4-3. `/edit-blocks` — ブロック編集

CLI 経由で個別ブロックを追加・更新・削除・移動する。

```
操作:
  blocks <projectId>           — ブロック一覧（人間が読める形式）
  context <projectId>          — アセット・キャラ・ページ一覧
  add <projectId> <pageId> <type> [opts]  — ブロック追加
  update <projectId> <blockId> [opts]     — ブロック更新
  remove <projectId> <blockId>            — ブロック削除
  move <projectId> <blockId> up|down      — ブロック移動
  add-page <projectId> <name>             — ページ追加
  remove-page <projectId> <pageIndex>     — ページ削除
  export <projectId>                       — JSON エクスポート
  import <projectId> <pageId> <file>       — JSON インポート
  validate <projectId>                     — バリデーション

実行:
  node scripts/cli/block/editor-cli.mjs <コマンド> <引数>
```

#### 使用例

```
作者: 「2ページ目にセリフ追加して。勇者が『ここは危険だ』って言う」
→ node scripts/cli/block/editor-cli.mjs add <projectId> page2 text --speaker 勇者 --body "ここは危険だ"

作者: 「3番目のブロック削除して」
→ node scripts/cli/block/editor-cli.mjs remove <projectId> <blockId>

作者: 「画面を揺らして」
→ node scripts/cli/block/editor-cli.mjs add <projectId> <pageId> effect --effect shake --intensity 0.5 --duration 500
```

---

### 4-4. `/story-status` — プロジェクト俯瞰

```
トリガー: 「全体を見せて」「構成を確認」「あらすじ」

出力例:
  プロジェクト: 冒険のはじまり（01KKK3GB...）
  ページ数: 3
  ├ プロローグ — 旅立ちの朝（bg→ch→text×4→choice）
  │   ├→ 仲間を探しに行く → 第1話 — 森の魔法使い
  │   └→ ひとりで旅立つ → 第1話 — 森の魔法使い
  ├ 第1話 — 森の魔法使い（bg→ch×3→text×8→jump）
  │   └→ 第2話 — 魔王城への道
  └ 第2話 — 魔王城への道（bg→ch×3→text×7）
  総テキストブロック: 19
  総選択肢: 1（2分岐）
  使用キャラ: 3人（勇者、魔法使い、戦士）
  使用背景: 3枚

手順:
1. GET /api/projects/:id でデータ取得
2. pages[] を走査してツリー構造を構築
3. choice/jump の toPageId で分岐を表示
4. ブロック数・キャラ数・背景数を集計
```

---

### 4-5. `/story-preview` — プレビュー

```
トリガー: 「プレビューして」「見せて」「確認」

手順:
1. プロジェクト ID を特定（直近で操作したもの、または指定）
2. エディタ URL を open コマンドで開く:
   http://localhost:5176/projects/editor/{projectId}
3. またはプレビュー URL:
   http://localhost:5175/ksc-demo.html?projectId={projectId}
4. 必要なら Playwright でスクリーンショットを撮って表示
```

---

### 4-6. `/set-layout` — UIレイアウト編集（ツクール）

プレイ画面のUI配置を編集する。PlayLayout JSON を操作する。

#### プリセット

4つのプリセットから選ぶか、個別に調整する。

| プリセット | 特徴 |
|-----------|------|
| `novel-standard` | ADV標準。メッセージ下部、クイックメニュー右上 |
| `rpg-classic` | RPG風。メッセージ下部 + ゴールド + パーティステータス |
| `message-top` | メッセージ上部配置。画面下半分にキャラを大きく表示 |
| `message-center` | NVL形式。画面全体にテキスト |

#### UI要素（20種）

**ノベル基本（8要素）**

| 要素 | 説明 | デフォルト位置 |
|------|------|-------------|
| `message-window` | メッセージウィンドウ | 下部 1200×180 |
| `name-box` | 話者名 | メッセージ上 200×30 |
| `choice-window` | 選択肢 | 中央 600×auto |
| `click-wait-icon` | クリック待ちアイコン | メッセージ右下 |
| `quick-menu` | クイックメニューバー | 右上 |
| `auto-button` | オート | クイックメニュー内 |
| `skip-button` | スキップ | クイックメニュー内 |
| `log-button` | バックログ | クイックメニュー内 |

**通知・ヘルパー（6要素）**

| 要素 | 説明 |
|------|------|
| `toast-notification` | トースト通知（セーブ完了等） |
| `area-name-plate` | エリア名表示（場面転換時） |
| `objective-panel` | 目標パネル |
| `save-indicator` | セーブ中インジケータ |
| `interact-hint` | 操作ヒント |
| `mini-map` | ミニマップ |

**RPG拡張（6要素）**

| 要素 | 説明 |
|------|------|
| `gold-window` | 所持金表示 |
| `party-status` | パーティステータス（HP/MP） |
| `hide-ui-button` | UI非表示ボタン |
| `menu-button` | メニューボタン |
| `fullscreen-menu` | フルスクリーンメニュー |
| `modal-dialog` | モーダルダイアログ |

#### 操作例

```
作者: 「RPG風にして」
→ rpg-classic プリセットを適用
→ PUT /api/projects/:id で data.playLayout を保存

作者: 「メッセージウィンドウを上に」
→ message-window の rect.y を 520 → 20 に変更
→ name-box の rect.y も連動して調整

作者: 「ゴールド表示を右下に」
→ gold-window の rect を { x: 1080, y: 640, width: 160, height: 40 } に設定

作者: 「メッセージの透明度を上げて」
→ message-window の opacity を 0.85 → 0.6 に変更
```

#### PlayLayout JSON 構造

```json
{
  "version": 1,
  "resolution": { "width": 1280, "height": 720 },
  "presetName": "novel-standard",
  "elements": [
    {
      "id": "message-window",
      "rect": { "x": 40, "y": 520, "width": 1200, "height": 180 },
      "visible": true,
      "opacity": 0.85,
      "zIndex": 100,
      "options": {
        "style": "adv",
        "padding": 20,
        "fontSize": 24,
        "textColor": "#ffffff",
        "backgroundColor": "rgba(0,0,0,0.7)",
        "borderRadius": 8
      }
    }
  ]
}
```

#### zIndex 設計

| 範囲 | 用途 |
|------|------|
| 100–119 | テキスト系（message, name, choice, click-wait） |
| 120–139 | 情報系（quick-menu, area-name, objective, interact-hint） |
| 140–149 | 通貨・ステータス（gold, party-status） |
| 150–159 | メニュー（hide-ui, menu-button） |
| 200+ | モーダル |
| 300+ | 通知（toast, save-indicator） |
| 500+ | フルスクリーン |

---

### 4-7. `/edit-map` — マップ編集

```
トリガー: 「マップを作って」「マップ編集」「地形配置」

操作:
  tilesets                              — タイルセット一覧
  tiles <tilesetId>                     — タイル一覧
  list                                  — マップ一覧
  create <mapId> [opts]                 — マップ作成
  gen-layer <tsId> <mapId> <layerId>    — テキストからレイヤー生成
  gen-collision <mapId>                 — 衝突判定自動生成
  add-event <mapId> [opts]              — イベント追加
  render <mapId> [output.png]           — PNG プレビュー
  edit <mapId>                          — GUI エディタを開く
  validate <mapId>                      — バリデーション

実行:
  node scripts/cli/map/map-cli.mjs <コマンド> <引数>
```

---

### 4-8. `/publish` — 公開

```
トリガー: 「公開して」「リリースして」

手順:
1. story-status で最終確認を表示
2. 公開フラグを ON（PUT /api/projects/:id）
3. 公開 URL を表示
4. 必要なら OGP 画像を生成
```

---

## 5. API リファレンス

全スキルが使う共通 API。

| エンドポイント | メソッド | 機能 |
|--------------|:-------:|------|
| `/api/auth/login` | POST | 認証（トークン取得） |
| `/api/projects` | POST | プロジェクト新規作成（アセット自動インポート付き） |
| `/api/projects/:id` | GET | プロジェクト取得（`_ai_context` 付き） |
| `/api/projects/:id` | PUT | プロジェクト保存 |
| `/api/editor-schema` | GET | 14ブロック型の全スキーマ（認証不要） |
| `/api/official-assets` | GET | 公式アセット一覧 |

### `_ai_context` の内容

`GET /api/projects/:id` のレスポンスに付与される。読み取り専用。

| フィールド | 内容 |
|-----------|------|
| `availableAssets.backgrounds` | 背景一覧（ID, name） |
| `availableAssets.overlays` | オーバーレイ一覧 |
| `availableCharacters` | キャラクター + 表情一覧（ID, slug, name, expressions） |
| `availablePages` | ジャンプ先ページ候補 |
| `knownVariables` | プロジェクト内で使われている変数名 |

---

## 6. 実装

### スキルファイル（.md のみ、コード変更なし）

| スキル | ファイル |
|--------|---------|
| `auth` | `.claude/skills/auth/skill.md` |
| `create-story` | `.claude/skills/create-story/skill.md` |
| `story-status` | `.claude/skills/story-status/skill.md` |
| `story-preview` | `.claude/skills/story-preview/skill.md` |
| `set-layout` | `.claude/skills/set-layout/skill.md` |
| `publish` | `.claude/skills/publish/skill.md` |

`edit-blocks` と `edit-map` は既にスキルファイルが存在する。

### ヘルパースクリプト（あると便利）

| スクリプト | 用途 |
|-----------|------|
| `scripts/cli/auth-cache.ts` | トークン取得→ファイル保存→期限切れ自動更新 |
| `scripts/cli/project-summary.ts` | プロジェクト構造のツリー表示（story-status 用） |

### API 変更

不要。全て既存 API で対応できる。

---

## 7. まとめ

| 項目 | 内容 |
|------|------|
| スキル数 | 8（auth, create-story, edit-blocks, story-status, story-preview, set-layout, edit-map, publish） |
| ノベル制作 | create-story → edit-blocks → story-status → preview → publish |
| ツクール制作 | set-layout（プリセット適用 or 個別調整）→ preview |
| 新規コード | 不要（スキルファイル = .md のみ） |
| API 変更 | 不要 |
| PoC 実証済み | create-story: 3ページ36ブロックを API だけで作成・保存・エディタ表示に成功 |
