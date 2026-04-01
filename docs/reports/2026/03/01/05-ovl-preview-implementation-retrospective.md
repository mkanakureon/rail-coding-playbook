# OVL（オーバーレイ）プレビュー実装 ― 手間取った理由と教訓

## 概要

エディタの OVL ブロックがプレビュー画面で動作するまでに、UI 作成（2/21）からエンジン完成（3/1）まで約 10 日を要した。
原因は「5 層パイプラインを貫通させる必要がある」アーキテクチャ特性と、サイレント失敗する設計上の罠。

---

## パイプライン構造（なぜ工数がかかるか）

新コマンドを 1 つ追加するだけで、以下 **5 パッケージ・9 ファイル** に手を入れる必要がある。

```
compiler（.ks → Op）
  ├─ lineClassifier.ts   … KNOWN_COMMANDS に追加
  └─ parseCommand.ts     … パーサー関数追加

core（型 + ディスパッチ）
  ├─ Op.ts               … Op 型追加
  ├─ IOpHandler.ts       … ハンドラインターフェース追加
  └─ OpRunner.ts         … case 分岐追加

web（PixiJS レンダリング）
  ├─ LayerManager.ts     … レイヤー追加
  └─ WebOpHandler.ts     … 表示・非表示ロジック

editor + API
  ├─ useEditorStore.ts   … getBlockScript / buildSnapshotScript
  └─ preview.ts          … generateKSCScript
```

**どの 1 層が欠けてもサイレントに失敗し、エラーメッセージが出ない。**

---

## 遭遇したバグと原因

### 1. KNOWN_COMMANDS ホワイトリスト問題（最大の原因）

| 深刻度 | 影響 |
|--------|------|
| Critical | `@overlay` が TEXT として分類され、コマンドごと無視される |

`lineClassifier.ts` は `KNOWN_COMMANDS` というホワイトリストを持っており、未登録の `@command` は TEXT に分類される。
エラーは一切出ない（サイレント失敗）ため、「プレビューに何も表示されない」としか分からない。

**同じバグに過去も繰り返しハマっている:**

| 日付 | コマンド | コミット |
|------|---------|---------|
| 2/19 | `ch_anim` | `c147cd0` |
| 2/21 | `battle`, `timeline_play` | `2090a3f`, `dbed227` |
| 2/28 | `filter`, `filter_clear` 他 | `eacdaff` |
| 2/28 | `shake`, `flash`, `fade_black` 他 | `3549342` |
| **3/1** | **`overlay`, `overlay_hide`** | **`7501307`** |

**教訓:** 新コマンド追加時は **最初に** `KNOWN_COMMANDS` に追加する。MEMORY.md にも記載済み。

---

### 2. buildSnapshotScript の空 assetId ガード漏れ

エディタで OVL ブロックを追加した直後（アセット未選択状態）に、`buildSnapshotScript` が `@overlay undefined` を生成してしまう。

```typescript
// Before（クラッシュ）
lines.push(`@overlay ${ovl.assetId}`);

// After（ガード追加）
if (ovl.assetId) {
  lines.push(`@overlay ${ovl.assetId}`);
}
```

API 側 `preview.ts` にも同様のガードが必要だった。

---

### 3. レイヤー順序の追加

元の `LayerManager.ts` は 3 層（background / character / UI）だった。
オーバーレイはキャラの上・UI の下に表示する必要があり、4 層目を追加。

```
backgroundLayer   … z:0
characterLayer    … z:1
overlayLayer      … z:2  ← 新規追加
uiLayer           … z:3
```

---

### 4. スプライトスケーリングの誤分類

`WebOpHandler.show()` は `isBackground` かどうかで2分岐していた:
- 背景 → カバースケーリング（画面全体）
- それ以外 → キャラスケーリング（高さ合わせ）

オーバーレイは全画面表示なのにキャラスケーリングが適用されてしまう。

```typescript
// Fix: フルスクリーン判定を統一
const isFullScreen = isBackground || isBgTransition || isOverlay;
```

---

### 5. アセット分類の変遷

OVL ブロックで選択できるアセットのフィルタが 3 回変わった。

| 時期 | フィルタ | 問題 |
|------|---------|------|
| 2/21 | `kind === 'bg' \|\| kind === 'ch'` | 背景・キャラ画像が混在 |
| 2/24 | `isBgAsset(a) \|\| isChAsset(a)` | taxonomy 変更対応だが OVL 専用カテゴリなし |
| 3/1 | `isOvlAsset(a)` → `kind=image, category=ovl` | 正しい分類 |

`AssetSelectModal` に渡す `assetKind` も `"bg"` → `"ovl"` に修正が必要だった。

---

## タイムライン

| 日付 | 内容 | コミット |
|------|------|---------|
| 2/21 15:11 | エディタ UI だけ作成（エンジン未対応） | `6ab4037` |
| 2/21 15:44 | CardShell リファクタで簡略化 | `8967cd2` |
| 2/24 00:17 | taxonomy 変更に追従 | `45360d3` |
| 2/28 17:30 | screen filter で同じパイプラインバグを経験・修正 | `eacdaff` |
| 2/28 21:00 | FX エフェクトで buildSnapshotScript パターン確立 | `3549342` |
| 2/28 21:04 | モバイル FAB から OVL を非表示 | `56b3127` |
| **3/1 20:49** | **フルパイプライン実装完了** | **`7501307`** |

---

## 根本原因のまとめ

1. **サイレント失敗する設計** — KNOWN_COMMANDS に未登録のコマンドがエラーなく TEXT 扱いになる
2. **5 層貫通が必要** — 1 つでも漏れるとサイレントに壊れる。チェックリストなしでは漏れが発生する
3. **UI 先行開発** — エディタ UI を先に作った結果、10 日間「ブロックは置けるがプレビューで動かない」状態が続いた
4. **空状態の未考慮** — アセット未選択のブロックが存在しうることへのガードが後付けになった

## 今後の対策

- 新コマンド追加時は KNOWN_COMMANDS → parseCommand → Op.ts → IOpHandler → OpRunner → WebOpHandler → preview.ts の順にチェックリストで確認
- MEMORY.md の KNOWN_COMMANDS 注意書きを維持
- 可能であれば KNOWN_COMMANDS を廃止し、未知のコマンドは警告ログを出す設計に変更
