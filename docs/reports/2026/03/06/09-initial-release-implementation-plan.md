# 初期リリース実装計画書

**日付**: 2026-03-06
**優先順位書**: `08-initial-release-priority.md`

## 調査結果による計画修正

優先順位書作成後の調査で、一部タスクの状況が変わった。

| タスク | 当初の想定 | 調査結果 |
|--------|-----------|---------|
| M2. Preview SPA fallback | 未設定 | **設定済み**。`packages/web/public/staticwebapp.config.json` に `navigationFallback` あり。対応不要 |
| S4. 本番 URL 設定 | TODO あり | **対応済み**。`frontend.ts` は `VITE_NEXT_APP_URL` / `VITE_PREVIEW_URL` 環境変数を参照。`deploy-swa.yml` で GitHub vars を注入済み。対応不要 |
| S2. ページリネーム | 未実装 | **部分実装済み**。`renamePage()` アクションと `PageListModal` のインライン編集 UI は動作する。`HamburgerMenu` の TODO のみ残存 |

---

## 実装タスク一覧（残り 5 タスク）

### Must: リリースブロッカー

| # | タスク | 作業量 |
|---|--------|--------|
| M1 | Editor CORS 設定 | 15min |
| M3 | 未設定ブロック警告表示 | 2h |

### Should: 品質向上

| # | タスク | 作業量 |
|---|--------|--------|
| S1 | オートセーブ | 2h |
| S2 | HamburgerMenu のページリネーム連携 | 30min |
| S3 | 未保存変更の離脱警告 | 30min |

---

## M1. Editor CORS 設定

### 背景

API (`apps/hono/src/index.ts:38-47`) は `ALLOWED_ORIGINS` 環境変数で CORS origin を制御。
Editor SWA の本番 URL `https://agreeable-river-0bfb78000.4.azurestaticapps.net` が未登録。

### 手順

1. Azure Container Apps の `ca-api` に Editor SWA の origin を追加

```bash
# 現在の ALLOWED_ORIGINS を確認
az containerapp show --name ca-api --resource-group rg-next-aca-min \
  --query "properties.template.containers[0].env[?name=='ALLOWED_ORIGINS'].value" -o tsv

# Editor SWA の origin を追加（既存値に追加）
az containerapp update --name ca-api --resource-group rg-next-aca-min \
  --set-env-vars "ALLOWED_ORIGINS=https://ca-nextjs.icymeadow-82e272bc.japaneast.azurecontainerapps.io,https://agreeable-river-0bfb78000.4.azurestaticapps.net,https://happy-tree-012282700.1.azurestaticapps.net"
```

2. 動作確認: Editor SWA からアセット一覧が取得できることを確認

### 変更ファイル

なし（Azure 環境変数の設定のみ）

---

## M3. 未設定ブロック警告表示

### 背景

`assetId` / `characterId` が空のまま保存・プレビューすると壊れたスクリプトが生成される。
保存をブロックするのではなく、**視覚的な警告**で作者に気付かせる。

### 方針

CardShell に `warning` prop を追加し、未設定状態のブロックにオレンジ枠を表示する。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `components/blocks/CardShell.tsx` | `warning?: string` prop 追加。truthy なら左ボーダーをオレンジに + ツールチップ |
| `components/BlockList.tsx` | `renderBlock` 内で各ブロックの未設定判定 → `warning` prop を渡す |

### 未設定判定ルール

| ブロック | 条件 | 警告メッセージ |
|---------|------|--------------|
| bg | `!block.assetId` | 背景画像が未選択です |
| ch | `!block.characterId \|\| !block.expressionId` | キャラクターまたは表情が未選択です |
| overlay | `!block.assetId` | オーバーレイ画像が未選択です |
| jump | `!block.toPageId` | ジャンプ先が未選択です |
| choice | `block.options.length === 0` | 選択肢がありません |
| if | `block.conditions.length === 0` | 条件が未設定です |

text, set_var, effect, screen_filter, timeline, battle, ksc は空でも有効なため警告なし。

### CardShell の変更イメージ

```tsx
type CardShellProps = {
  // ... 既存 props
  warning?: string;
};

// block-card の className に条件追加
<div className={`block-card${warning ? ' border-l-4 border-orange-400' : ''}`} ...>
  {warning && (
    <span className="text-[10px] text-orange-500 ml-auto" title={warning}>
      !
    </span>
  )}
```

### BlockList の変更イメージ

```tsx
const renderBlock = (block: Block, index: number) => {
  // ... 既存コード
  const warning = getBlockWarning(block);
  // 各カードに warning={warning} を渡す
};

function getBlockWarning(block: Block): string | undefined {
  switch (block.type) {
    case 'bg': return !block.assetId ? '背景画像が未選択です' : undefined;
    case 'ch': return (!block.characterId || !block.expressionId) ? 'キャラクターまたは表情が未選択です' : undefined;
    case 'overlay': return !block.assetId ? 'オーバーレイ画像が未選択です' : undefined;
    case 'jump': return !block.toPageId ? 'ジャンプ先が未選択です' : undefined;
    case 'choice': return block.options.length === 0 ? '選択肢がありません' : undefined;
    case 'if': return block.conditions.length === 0 ? '条件が未設定です' : undefined;
    default: return undefined;
  }
}
```

---

## S1. オートセーブ

### 背景

現在は手動保存のみ。ブラウザを閉じると編集内容が消える。
AssetManager にのみ `autoSaveProject()` があるが、ブロック編集には適用されていない。

### 方針

`EditorPage` に `useEffect` で 60秒間隔のオートセーブを追加。
`updatedAt` と「最後に保存した時刻」を比較し、変更がある場合のみ保存する。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `pages/EditorPage.tsx` | オートセーブ `useEffect` 追加 |
| `store/useEditorStore.ts` | `_lastSavedAt: number` を state に追加 |
| `components/Header.tsx` | 保存成功時に `_lastSavedAt` を更新。オートセーブインジケーター表示 |

### EditorPage の変更イメージ

```tsx
// オートセーブ（60秒間隔）
useEffect(() => {
  const timer = setInterval(async () => {
    const { project, _lastSavedAt } = useEditorStore.getState();
    if (!project || project.updatedAt <= _lastSavedAt) return;

    try {
      await authFetch(API.projects.update(workId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          data: {
            pages: project.pages,
            assets: project.assets,
            characters: project.characters,
          },
        }),
      });
      useEditorStore.setState({ _lastSavedAt: Date.now() });
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, 60_000);

  return () => clearInterval(timer);
}, [workId]);
```

### Header の変更

- `handleSave` 成功時に `useEditorStore.setState({ _lastSavedAt: Date.now() })` を追加
- ヘッダーに「自動保存済み」テキストを小さく表示（任意）

---

## S2. HamburgerMenu のページリネーム連携

### 背景

`renamePage()` アクションは実装済み。`PageListModal` にインライン編集 UI もある。
`HamburgerMenu` の「名前変更」ボタンが TODO のまま残っている。

### 方針

HamburgerMenu の「名前変更」ボタンタップで `PageListModal` を開く。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `components/HamburgerMenu.tsx` | 「名前変更」ボタンの onClick で PageListModal を開く state 追加 |

### 変更イメージ

```tsx
const [showPageList, setShowPageList] = useState(false);

// 「名前変更」ボタン
onClick={() => {
  setIsOpen(false);
  setShowPageList(true);
}}

// JSX 末尾に追加
{showPageList && <PageListModal onClose={() => setShowPageList(false)} />}
```

---

## S3. 未保存変更の離脱警告

### 背景

`beforeunload` が未実装。ブラウザバック/タブ閉じで確認なく消える。

### 方針

`updatedAt > _lastSavedAt` の場合、ブラウザの離脱確認ダイアログを表示。

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `pages/EditorPage.tsx` | `beforeunload` イベントリスナー追加 |

### 変更イメージ

```tsx
useEffect(() => {
  const handler = (e: BeforeUnloadEvent) => {
    const { project, _lastSavedAt } = useEditorStore.getState();
    if (project && project.updatedAt > _lastSavedAt) {
      e.preventDefault();
    }
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, []);
```

---

## 実装順序

```
1. M1  CORS 設定 (Azure CLI)            ... 15min  ← コード変更なし
2. M3  未設定ブロック警告                ... 2h
3. S1  オートセーブ                      ... 2h     ← _lastSavedAt はここで追加
4. S3  離脱警告                          ... 30min  ← S1 の _lastSavedAt を使う
5. S2  HamburgerMenu リネーム            ... 30min

合計: 約 5.5h
```

S1 と S3 は `_lastSavedAt` を共有するため連続で実装する。

## 完了基準

- [ ] Editor SWA → API のアセット取得が本番で動作する (M1)
- [ ] 未設定ブロックにオレンジ枠 + 警告アイコンが表示される (M3)
- [ ] 60秒間隔でオートセーブが動作する (S1)
- [ ] 未保存状態でブラウザ離脱時に確認ダイアログが出る (S3)
- [ ] HamburgerMenu「名前変更」がページ一覧モーダルを開く (S2)
- [ ] typecheck + lint + テスト 全通過
- [ ] `git push` → GitHub Actions デプロイ → ヘルスチェック通過
