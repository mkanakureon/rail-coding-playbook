# マイページ キャラクター・アセット管理 実装レポート

## 背景

- マイページのアセットタブにアップロード機能が不完全（`+ キャラ` ボタン欠落）だった
- キャラクタータブが閲覧のみで、新規作成・表情管理ができなかった
- 管理画面のアセット一覧にアップロード機能がなかった

---

## 変更ファイル一覧

| # | ファイル | 変更内容 |
|---|---------|----------|
| 1 | `apps/next/app/(private)/admin/assets/page.tsx` | 一括アップロードモーダル追加 |
| 2 | `apps/next/app/(private)/mypage/page.tsx` | アセット `+ キャラ` ボタン復活・キャラ新規作成モーダル・表情管理モーダル追加 |
| 3 | `apps/next/lib/api.ts` | `createCharacter` / `createExpression` / `updateExpression` / `deleteExpression` 追加 |
| 4 | `docs/myasset-spec.md` | マイアセット仕様書（新規作成） |

---

## 実装の詳細

### 1. 管理画面 一括アップロード（`/admin/assets`）

フォルダ選択（`webkitdirectory`）でサブフォルダ名を `kind` として解釈し、公式アセット（`/api/admin/official-assets/upload`）に一括投入する機能。

```
my-assets/
  bg/    → kind=bg
  ch/    → kind=ch
  bgm/   → kind=bgm
```

- 有効な kind: `bg` / `ch` / `bgm`（API制約に合わせて）
- 並列数: 5（`Promise.all` ワーカープール）
- カテゴリ: 手入力（必須）
- プログレスバー・エラー件数表示あり

**注意点:** `webkitdirectory` は TypeScript の型定義に含まれないため `useEffect` + `setAttribute` で設定。

### 2. マイページ アセットタブ `+ キャラ` 復活

`MyAssetsSection` の `+ 背景` / `+ BGM` の間に `+ キャラ` ボタンが欠落していたため追加。
ハンドラ `handleUploadClick` は元々 `'bg' | 'ch' | 'bgm'` を受け付けていたため、ボタンの追加のみで動作。

```tsx
<button onClick={() => onUploadClick(pa.projectId, 'ch')} ...>
  + キャラ
</button>
```

### 3. キャラクター新規作成（マイページ）

`CharactersTab` にモーダルを追加。

| フィールド | 説明 |
|---|---|
| プロジェクト選択 | 複数プロジェクトある場合のみ表示 |
| キャラID (slug) | 半角英数字・アンダースコアのみ。作成後変更不可 |
| 表示名 | 任意テキスト |

`lib/api.ts` に `createCharacter(projectId, { slug, name })` を追加。

### 4. 表情管理モーダル（マイページ）

各キャラクターカードに「編集」ボタンを追加。クリックで表情管理モーダルが開く。

| 操作 | 実装 |
|---|---|
| 表情一覧表示 | `editExprs` ローカルstate |
| 名前編集 | onChange で即時 `PUT` 送信 |
| 画像アップロード | `<input type="file">` → `uploadProjectAsset` → `updateExpression` |
| 削除 | `deleteExpression`、最低1件は残る |
| + 新しい表情 | `createExpression` → `slug: expr_{timestamp}` で自動生成 |

追加 API 関数:

```typescript
createExpression(projectId, charId, { slug, name, kind })
updateExpression(projectId, charId, exprId, { name?, slug?, imageAssetId? })
deleteExpression(projectId, charId, exprId)
```

---

## 設計上の決定事項

### マイアセット仕様（`docs/myasset-spec.md` に文書化）

現在のアセットはプロジェクト紐づきだが、今後のマイアセットはユーザー紐づきに変更する方針を策定。

| 項目 | 方針 |
|---|---|
| 所有者 | ユーザー（プロジェクトではない） |
| カテゴリ | bg / ch のみ、作者が自由命名 |
| 公式アセットとの関係 | 別体系、名前が同じでも別物 |
| プロジェクトアクセス | 別途検討 |

新規テーブル `user_assets`、エンドポイント `/api/my-assets` が必要（未実装）。

---

## 残課題・未検討事項

- マイアセット仕様の実装（`user_assets` テーブル・`/api/my-assets` エンドポイント・UI刷新）
- プロジェクトからマイアセットを参照する仕組み
- マイページのアセットタブをプロジェクト非依存の UI に刷新（現在は暫定的にプロジェクト紐づきのままの UI）
- アセット容量上限・プラン別制限

---

## 教訓

- `webkitdirectory` 属性は TypeScript 型定義にないため `useEffect` + `setAttribute` で設定する
- 並列アップロードはワーカープールパターン（`indices` 配列 + `shift()` + `Promise.all`）が clean
- 表情名の即時保存（onChange で PUT）は UX が良いが、デバウンスを入れるとさらに良くなる（今回は省略）
