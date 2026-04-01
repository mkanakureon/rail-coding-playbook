# エディタ — 画像選択 & プロパティパネル 仕様書

> 作成日: 2026-03-03
> 対象: `apps/editor/` 内のアセット選択・プロパティ編集コンポーネント群

---

## 1. AssetSelectModal（アセット選択モーダル）

**ファイル:** `apps/editor/src/components/AssetSelectModal.tsx`

### 概要

背景・キャラクター・OVL 等の画像アセットを選択するためのフルスクリーンモーダル。
3 つのタブで異なるソースからアセットを選択できる。

### Props

| Prop | 型 | 説明 |
|------|-----|------|
| `isOpen` | `boolean` | モーダル表示状態 |
| `onClose` | `() => void` | 閉じるコールバック |
| `onSelect` | `(assetId: string) => void` | 選択確定コールバック |
| `assets` | `AssetRef[]` | プロジェクト内アセット一覧 |
| `currentAssetId` | `string?` | 現在選択中の ID |
| `title` | `string` | モーダルタイトル |
| `projectId` | `string?` | API 呼び出しに必要 |
| `assetKind` | `string?` | `'bg'` / `'ch'` / `'bgm'` 等 |
| `allowUpload` | `boolean?` | アップロードボタン表示 |

### 3 タブ構成

#### タブ 1: プロジェクト（My）

- プロジェクトに追加済みの `assets` 配列をグリッド表示
- 2〜4 カラム（ビューポートサイズで可変）
- 各アセット: サムネイル + 名前 + slug
- 空の場合: インラインアップロードボタン（`allowUpload` が true のとき）
- **デスクトップ**: クリック → 選択状態 → 確認ボタンで確定
- **モバイル**: クリック → 即時選択（確認なし）

#### タブ 2: 公式（Official）

- カテゴリフィルタチップ（横スクロール・スナップ）
- 「すべて」+ API から取得した動的サブカテゴリ
- 公式アセットをグリッド表示（遅延読み込み）
- 選択 → `use-official` POST で自動インポート → プロジェクトに追加

#### タブ 3: マイライブラリ（User Library）

- ユーザー個人ライブラリのアセット一覧
- カテゴリ表示
- 選択 → `import-from-library` POST でインポート

### 使用 API

```
GET  /api/official-assets/categories?kind={kind}&category={category}
GET  /api/official-assets?kind=image&category={category}&subcategory={subcategory}
GET  /api/user-assets?kind={kind}
POST /api/assets/{projectId}/use-official        { officialAssetId }
POST /api/assets/{projectId}/import-from-library { userAssetId }
POST /api/assets/{projectId}/upload              FormData { file, kind }
```

### 動作仕様

- Escape キーで閉じる
- FocusTrap によるアクセシビリティ対応
- ファイルアップロード時はプログレスバー表示（XHR ストリーミング）
- 公式 / ライブラリからの追加後、プロジェクトを自動保存
- ダークモード対応

---

## 2. PropertyImageGrid（インライン画像グリッド）

**ファイル:** `apps/editor/src/components/sidebar/PropertyImageGrid.tsx`

### 概要

サイドバーのプロパティ欄に表示する小型の画像選択グリッド。
最大 9 件を 3 列で表示し、超過分は「もっと見る」ボタンで AssetSelectModal を開く。

### Props

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `items` | `GridItem[]` | — | 表示アイテム |
| `selectedId` | `string` | — | 選択中 ID |
| `onSelect` | `(id: string) => void` | — | 選択コールバック |
| `maxVisible` | `number` | `9` | 最大表示件数 |
| `onShowMore` | `() => void?` | — | 「もっと見る」コールバック |
| `columns` | `3 \| 4` | `3` | カラム数 |

### GridItem

```typescript
type GridItem = {
  id: string;
  label: string;
  imageUrl: string | null;
  fallback?: string;       // 画像がない場合の代替テキスト
};
```

### UI

- `max-h-[200px]` でスクロール表示
- 選択中: 青リング + ラベルオーバーレイ
- ホバー: グレーリング
- 画像読み込み失敗時: ラベルの先頭 4 文字をフォールバック表示
- アイテム数 > `maxVisible` のとき: `+ もっと見る ({count} 件)` ボタン表示

---

## 3. SidebarInspector（プロパティパネル）

**ファイル:** `apps/editor/src/components/sidebar/SidebarInspector.tsx`

### 概要

選択中ブロックのプロパティを編集するサイドバー。
`block.type` に応じて専用のプロパティエディタをレンダリングする。

### レイアウト

```
SidebarInspector
├─ プロパティ領域（上半分・スクロール可）
│  ├─ ヘッダー: "プロパティ"
│  └─ BlockPropertyEditor → block.type で分岐
└─ プレビュー領域（下半分）
   └─ SidebarPreview or TimelinePreview
```

### ブロック別プロパティエディタ

#### start — 開始ブロック

- 読み取り専用: 「ページの開始ブロックです。」
- 編集不可

#### bg — 背景

| 項目 | UI | 説明 |
|------|-----|------|
| 背景画像 | PropertyImageGrid (3列, 9件) | プロジェクト内の背景アセット |
| 画像選択 | 「もっと見る」→ AssetSelectModal | 公式 / ライブラリからも選択可 |
| プレビュー | aspect-video サムネイル | 選択中の背景画像 |

#### ch — キャラクター

| 項目 | UI | 説明 |
|------|-----|------|
| キャラクター | PropertyImageGrid | 全キャラクター一覧 |
| 表情 | PropertyImageGrid | 選択キャラの表情差分 |
| 位置 | L / C / R ボタン | 左・中央・右 |
| 表示 | チェックボックス | 表示 / 非表示切替 |

#### text — テキスト

| 項目 | UI | 説明 |
|------|-----|------|
| 話者名 | テキスト入力 | 省略可 |
| 本文 | テキストエリア (min-h: 80px) | セリフ・地の文 |
| フレーム色 | カラーピッカー (`#6366f1` デフォルト) | リセットボタン付き |

#### set_var — 変数代入

| 項目 | UI | 説明 |
|------|-----|------|
| 変数名 | テキスト入力 (monospace) | — |
| 演算子 | セレクト: `=` / `+=` / `-=` | — |
| 値 | テキスト入力 (monospace) | — |

#### effect — 演出効果

| 項目 | UI | 説明 |
|------|-----|------|
| エフェクト | ドロップダウン | shake / flash / fade_black / fade_white / vignette / blur / rain / snow |
| 強度 | スライダー 1〜5 | デフォルト: 3 |
| 持続時間 | 数値入力 100〜5000ms | デフォルト: 500ms, step: 100 |

#### jump — ページジャンプ

| 項目 | UI | 説明 |
|------|-----|------|
| 移動先 | ドロップダウン | 全ページ一覧 (Page N: name) |

#### overlay — オーバーレイ

| 項目 | UI | 説明 |
|------|-----|------|
| OVL 画像 | PropertyImageGrid + AssetSelectModal | `assetKind="ovl"` |
| 表示 | チェックボックス | 表示 / 非表示切替 |
| プレビュー | aspect-video サムネイル | — |

#### choice — 選択肢

- **読み取り専用表示**
- 選択肢リスト（インデックス番号付き）
- 各選択肢のアクション数を表示
- 「選択肢の編集はブロックカードで行ってください」

#### if — 条件分岐

- **読み取り専用表示**
- 条件式を monospace で表示: `var1 >= 5 && var2 == 10`
- TRUE / FALSE それぞれのブロック数を色分け表示（緑 / 赤）
- 「条件式の編集はブロックカードで行ってください」

#### battle — バトル

| 項目 | UI | 説明 |
|------|-----|------|
| 敵グループ | ドロップダウン | slime_pack / goblin_group |
| 敵ステータス | カード表示 | 名前 / HP / ATK / DEF |
| 勝利時ジャンプ | ページドロップダウン | — |
| 敗北時ジャンプ | ページドロップダウン | — |

#### timeline — 演出タイムライン

| 項目 | UI | 説明 |
|------|-----|------|
| タイムライン名 | テキスト入力 (monospace) | — |
| 持続時間 | 数値入力 100〜60000ms | step: 100 |
| シークバー | スライダー + ドラッグ | 現在時間 / 合計時間 |
| 現在値テーブル | X / Y / Opacity / Scale | 変化中の値は青ハイライト |
| キーフレーム編集 | 時間・各プロパティ・イージング | 選択時のみ表示 |
| トラック一覧 | ラベル / ターゲットID / 削除 | — |
| トラック追加 | キャラ / 背景 / OVL / 演出 / 音声 / イベント | 色分けボタン |

---

## 4. SidebarPreview（プレビュー）

**ファイル:** `apps/editor/src/components/sidebar/SidebarPreview.tsx`

### 概要

選択中ブロックの状態を iframe 内で KSC スクリプトとして描画する。

### 動作

1. `buildSnapshotScript(selectedBlockId)` で KSC スクリプトを生成
2. iframe に `postMessage` でスクリプト + アセット + キャラクター情報を送信
3. iframe 内の Web エンジンがレンダリング

### Message Protocol

```typescript
{
  type: 'previewScript',
  script: string,
  assets: AssetRef[],
  characters: CharacterData[],
  timelines: Record<string, TimelineRoot>
}
```

### UI

- ヘッダー: ページ表示 + リロードボタン
- iframe: 1280×720 解像度、黒背景
- Sandbox: `allow-scripts`, `allow-same-origin`

---

## 5. キャラクター管理

### CharacterPanel

**ファイル:** `apps/editor/src/components/panels/CharacterPanel.tsx`

- キャラクター一覧をグリッド表示（1〜4 カラム）
- 新規作成 / 編集 / 削除
- 「マイキャラクターに追加」ボタン

### CharacterEditModal

**ファイル:** `apps/editor/src/components/panels/CharacterEditModal.tsx`

| フィールド | UI | 制約 |
|-----------|-----|------|
| キャラ ID (slug) | テキスト入力 | `^[a-zA-Z0-9_]+$`、編集時は変更不可 |
| 表示名 | テキスト入力 | — |
| 表情差分 | カード一覧 + AssetSelectModal | 最低 1 つ必須 |
| デフォルト表情 | ドロップダウン | 表情が 2 つ以上のとき表示 |

### 使用 API

```
GET    /api/projects/{projectId}/character-class
POST   /api/projects/{projectId}/character-class
PUT    /api/projects/{projectId}/character-class/{slug}
DELETE /api/projects/{projectId}/character-class/{id}
POST   /api/my-characters/import
```

---

## 6. ブロックテーマ設定

**ファイル:** `apps/editor/src/config/blockTheme.ts`

| ブロック型 | バッジ色 | ラベル | アイコン |
|-----------|---------|--------|---------|
| start | gray-600 | START | ▶ |
| bg | green-600 | 背景 | 🖼️ |
| ch | blue-600 | キャラ | 👤 |
| text | purple-600 | テキスト | 💬 |
| set_var | indigo-600 | 変数 | 📊 |
| choice | yellow-600 | 選択肢 | 🔀 |
| if | cyan-600 | IF文 | ❓ |
| effect | amber-600 | FX | ✨ |
| screen_filter | violet-600 | フィルター | 🎨 |
| jump | orange-600 | ジャンプ | ➡️ |
| battle | red-600 | バトル | ⚔ |
| overlay | fuchsia-600 | OVL | 🌧️ |
| timeline | rose-600 | 演出TL | 🎬 |
| ksc | teal-600 | スクリプト | 📝 |

---

## 7. アセット型定義

```typescript
type AssetRef = {
  id: string;
  kind: 'bg' | 'ch' | 'bgm' | 'image' | 'audio';
  category?: string | null;   // 'bg', 'ch-img', 'ovl', 'bgm', 'se'
  url: string;
  name?: string;
  slug?: string | null;
};
```

### フィルタ関数

| 関数 | 条件 |
|------|------|
| `isBgAsset(a)` | `kind === 'bg'` または `kind === 'image' && category === 'bg'` |
| `isChAsset(a)` | `kind === 'ch'` または `kind === 'image' && category === 'ch-img'` |
| `isOvlAsset(a)` | `kind === 'image' && category === 'ovl'` |
