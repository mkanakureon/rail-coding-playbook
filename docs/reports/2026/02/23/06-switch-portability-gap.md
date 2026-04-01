# Switch 移植性ギャップ分析

仕様書・設計書で定義した 3 つの移植前提条件について、現在の実装との乖離を調査した。

## 前提

「Switch 移植できる設計」だけでは足りない。以下の 3 点を**実装レベルで徹底**しない限り、移植時に全面書き直しが発生する。

## 1. Asset ID 参照の完全徹底

### 仕様（設計書 3.5 IAssets）

すべてのアセットを ID で参照し、パス直書きを禁止する。

### 現状

| 領域 | 状態 | 詳細 |
|------|------|------|
| スクリプト層（.ks） | OK | slug でアセット参照 |
| API 層（Hono） | OK | `{ id, slug, url, kind }` で返却、`resolveAssetUrl()` で解決 |
| ランタイム層（WebOpHandler） | 要注意 | マニフェストなし時 `/assets/backgrounds/${id}.png` にフォールバック |
| `IAssets` インターフェース | **未実装** | `packages/core/src/interfaces/` に定義なし |

### 問題箇所

**`packages/web/src/renderer/WebOpHandler.ts`** — `resolveAssetPath()`:

```typescript
// マニフェストがない場合のフォールバック（パス直書き）
if (!this.assetManifest) {
  return `/assets/backgrounds/${id}.png`;  // ← Switch では動かない
}
```

### 対応

- [ ] `packages/core/src/interfaces/IAssets.ts` を作成
- [ ] `WebOpHandler.resolveAssetPath()` のフォールバックを削除し、マニフェスト必須にする
- [ ] デモ用ハードコードパス（EditorPage.tsx、GalleryScreen.ts）を ID 参照に置換

## 2. Input Action の完全徹底

### 仕様（設計書 3.3 IInput）

キーコード直指定を廃止し、Action に統一。Switch 移植時の入力差分をゼロにする。

### 現状

**ゲームロジック層**: OK

| コンポーネント | 方式 |
|--------------|------|
| TextWindow | `Action.OK` |
| GameUI | `Action.Menu / QuickSave / QuickLoad` |
| GalleryScreen（戻る） | `Action.Back`（onWithPriority） |

**UI 層: NG — 直接 keydown リスナーが 6 箇所**

| コンポーネント | 直書きキー | 必要な Action |
|--------------|-----------|-------------|
| ChoiceOverlay | `ArrowUp/ArrowDown/Enter` | `Up/Down/OK` |
| MenuScreen | `ArrowUp/ArrowDown/Enter/Escape` | `Up/Down/OK/Back` |
| SaveLoadScreen | `ArrowUp/ArrowDown/Enter/Escape` | `Up/Down/OK/Back` |
| GalleryScreen | `ArrowLeft/ArrowRight` | `Left/Right` |
| DiagnosticsOverlay | `D/C` | debug 専用（許容可） |
| main.ts | `D` | debug 専用（許容可） |

### 対応

- [ ] Action enum に `Up/Down/Left/Right` が既にあることを確認（仕様書 5.3 に定義済み）
- [ ] ChoiceOverlay: `window.addEventListener("keydown")` → `input.on(Action.Up/Down/OK)`
- [ ] MenuScreen: 同上 + `Action.Back`
- [ ] SaveLoadScreen: 同上
- [ ] GalleryScreen: `ArrowLeft/Right` → `Action.Left/Right`
- [ ] InputManager の `KEY_MAP` に Up/Down/Left/Right の矢印キーマッピングを追加

## 3. I/O 抽象を同じ呼び方で揃える

### 仕様（設計書 3.9 IHttp / IStorage / IEventQueue、3.8 IKVStore）

HTTP・Storage・KV を共通インターフェースで統一し、Platform Layer で差し替え可能にする。

### 現状

| 抽象 | core 定義 | 実装 | 状態 |
|------|----------|------|------|
| IStorage（セーブ） | あり | StorageManager（IndexedDB） | OK |
| IHttp | **なし** | `fetch()` が 70+ 箇所に散在 | NG |
| IKVStore | **なし** | `localStorage` 直叩きが 20+ 箇所 | NG |

### fetch() 散在箇所（主要）

| パッケージ | 箇所数 | 用途 |
|-----------|--------|------|
| `packages/web/` | 6+ | シナリオ読み込み、アセットマニフェスト、音声ストリーミング |
| `apps/editor/` | 10+ | API 通信（認証、アセット、タイムライン） |
| `apps/next/` | 50+ | 全 API 関数（`lib/api.ts` に集中） |

### localStorage 散在箇所（主要）

| パッケージ | 箇所数 | 用途 |
|-----------|--------|------|
| `apps/editor/` | 6+ | authToken、userId、userName |
| `apps/next/` | 5+ | authToken、userId、role、consent |
| `packages/web/` | 2 | UserConfig（ゲーム設定） |

### 対応

- [ ] `packages/core/src/interfaces/IHttp.ts` を作成
- [ ] `packages/core/src/interfaces/IKVStore.ts` を作成
- [ ] `packages/web/` の `fetch()` を `IHttp` 経由に移行（エンジン層のみ、editor/next は後回し可）
- [ ] `packages/web/src/config/UserConfig.ts` の localStorage を `IKVStore` 経由に移行
- [ ] apps 層（editor / next）は Web 専用のため、移行優先度は低い

## ギャップ全体像

```
                  仕様書   設計書   core定義   実装
Asset ID          ○       ○       ×          △
Input Action      ○       ○       ○          △
I/O 抽象          ○       ○       △          ×
```

○ = 定義・実装済み　△ = 部分的　× = 未着手

## 優先度と実施タイミング

**KSC コンパイラ開発と並行して進められる。Engine Core（Phase 5〜）開始前に完了必須。**

```
高  ┃ IHttp / IKVStore を core に定義（型だけ、1日）
    ┃ UI 層の Input Action 統一（6 ファイル修正、1日）
    ┃ IAssets を core に定義（型だけ、半日）
中  ┃ packages/web の fetch() を IHttp に移行（段階的）
    ┃ WebOpHandler のフォールバック削除
低  ┃ apps 層の fetch/localStorage 移行（Web 専用のため後回し可）
```

**合計見積り**: インターフェース定義 2〜3 日 + 実装移行 1〜2 週間（段階的）

---

## 関連文書

- [03 TS-VM 2D Engine 仕様書](./03-ts-vm-2d-engine-spec.md) — 移植前提の仕様元（IAssets / IInput / IHttp）
- [04 TS-VM 2D Engine 設計書](./04-ts-vm-2d-engine-design.md) — インターフェース定義の設計
- [07 クラス追加準備仕様書](./07-class-preparation-spec.md) — VM/IR のクラス対応先行準備（並行して実施可能）
