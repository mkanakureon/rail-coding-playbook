# ブラウザテスト トラブルシューティング記録

## 概要

CLI で作成したプロジェクト (`01KK3VXSKPYRBAXQ4DV4F74GD9`) をブラウザエディタで表示する Playwright E2E テスト (`tests/editor-cli-verify.spec.ts`) の実装で手間取った内容を記録する。

---

## 問題1: エディタが真っ暗な画面のまま何も表示されない

### 症状

- Playwright でエディタ URL にアクセスすると真っ黒な画面
- body のテキストは "Loading... プロジェクト一覧へ戻る" のみ
- API テスト（Playwright の `request` で直接 API を叩くテスト）は正常に通る

### 調査

ネットワーク監視を追加したところ:
- `GET /api/projects/:id` → **200** (成功)
- `GET /api/assets/:id` → **200** (成功)

API は正常にレスポンスを返しているが、React コンポーネントがクラッシュしていた。

### 原因

**`SidebarOutline` コンポーネントの undefined アクセス**

コンソールエラー:
```
Cannot read properties of undefined (reading 'forEach')
An error occurred in the <SidebarOutline> component.
```

CLI で作成した choice ブロックと if ブロックで、`options` / `conditions` プロパティが undefined だった。

- `SidebarOutline.tsx:28` — `block.options.length` がクラッシュ（choice ブロック）
- `SidebarOutline.tsx:32` — `block.conditions[0]` がクラッシュ（if ブロック）
- `useEditorStore.ts:1023` — `block.options.forEach(...)` がクラッシュ（`getAllVariables` 関数）

### 修正

1. 個別のガード追加:
```typescript
// Before
block.options.length → (block.options ?? []).length
block.conditions[0] → (block.conditions ?? [])[0]
```

2. `useEditorStore.ts` の `setProject` にブロック正規化を追加:
- choice ブロック: `options` undefined → `[]`、`label` → `text` 変換、`actions` 保証
- if ブロック: `conditions`/`thenBlocks`/`elseBlocks` undefined → `[]`

### 教訓

- CLI で作成したブロックはエディタ UI で作成されたブロックと構造が異なる場合がある
- **データ読み込み層で正規化する** のが最もクリーン（個別コンポーネントの `?? []` より `setProject` での一括正規化）
- React の Error Boundary がないと、1つのコンポーネントのクラッシュで画面全体が真っ黒になり原因特定が困難

---

## 問題2: 認証フローの選択

### 症状

エディタページに認証情報を渡す方法が複数あり、どれが Playwright テストに適切か判断が必要だった。

### EditorPage.tsx の認証パス（優先順）

| # | 方式 | パラメータ | 用途 |
|---|------|-----------|------|
| 1 | 認可コード交換 | `?code=xxx` | Next.js からの遷移 |
| 2 | ゲストトークン URL | `?token=xxx&guest=1&userId=xxx` | ゲストログイン |
| 2.5 | 通常トークン URL | `?token=xxx&userId=xxx` | Next.js プロジェクト詳細からの遷移 |
| 3 | localStorage | `authToken` + `currentUserId` | 既存セッション |
| 4 | ゲストトークン localStorage | `guestToken` | ゲスト復帰 |

### 最終的に採用: localStorage 注入 → ページ遷移方式（パス 3）

```typescript
// 1. まず同一オリジンに移動して localStorage にアクセス可能にする
await page.goto(EDITOR_URL);

// 2. 認証情報をセット
await page.evaluate(({ token, uid }) => {
  localStorage.setItem('authToken', token);
  localStorage.setItem('currentUserId', uid);
  localStorage.removeItem('guestToken');
  localStorage.removeItem('userRole');
}, { token: authToken, uid: userId });

// 3. プロジェクトページに遷移
await page.goto(`${EDITOR_URL}/projects/editor/${PROJECT_ID}`);
```

### 教訓

- Playwright テストでは localStorage 注入方式が最も安定する
- `page.goto(url)` の前に localStorage をセットするには、まず同一オリジンの任意ページに移動する必要がある

---

## 問題3: テストの期待値がエディタ UI と一致しない

### 症状

- `expect(content).toContain('城に入る')` が失敗
- `expect(content).toContain('第2話')` が失敗

### 原因

エディタ UI は choice ブロックの選択肢テキストを直接表示せず、「選択肢 2個」とサマリ表示する。ページ名「第2話」は現在表示中の第1話には表示されず、「1 / 2」と数字表示。

### 修正

```typescript
// Before → After
expect(content).toContain('城に入る') → expect(content).toContain('2個')
expect(content).toContain('第2話')   → expect(content).toContain('1 / 2')
```

### 教訓

- ブラウザテストの期待値は「API のデータ」ではなく「UI の表示」に基づいて書く

---

## 問題4: choice/if ブロックをクリックすると画面が真っ黒になる

### 症状

- エディタは正常に表示される（問題1は修正済み）
- choice ブロックをクリックすると画面全体が黒くなる

### 原因

`ChoiceBlockCard.tsx` と `IfBlockCard.tsx` 内の多数の箇所で `block.options.xxx` / `block.conditions.xxx` に直接アクセスしていた。CLI 作成の choice ブロックは `options` 内の各要素が `{ id, label }` 形式だが、エディタは `{ id, text, actions }` を期待。`option.actions.length` 等でクラッシュ。

### 修正

`useEditorStore.ts` の `setProject` でブロック正規化を追加（問題1の修正に含む）:

```typescript
if (block.type === 'choice') {
  const opts = (raw.options ?? []).map((o) => ({
    id: String(o.id ?? `option-${Date.now()}-${...}`),
    text: String(o.text ?? o.label ?? ''),      // CLI の label → エディタの text
    actions: Array.isArray(o.actions) ? o.actions : [],  // undefined → []
    condition: String(o.condition ?? ''),
  }));
  return { ...block, options: opts };
}
```

### 教訓

- CLI とエディタでブロックのプロパティ名が異なる場合がある（`label` vs `text`）
- 個別コンポーネントに `?? []` を散りばめるより、データ読み込み時に一括正規化が安全

---

## 問題5: フィルターブロックのプロパティにプレビュー画像が表示されない

### 症状

- `screen_filter` ブロック用の `SidebarInspector` プロパティパネルが存在しなかった
- 追加後、プレビュー画像を表示しようとしたが黒いまま

### 試行1: iframe postMessage でキャンバスキャプチャ（失敗）

プレビュー iframe（port 5175）に `captureCanvas` メッセージを送り、`canvas.toDataURL()` を返す方式。

```
エディタ (5176) → postMessage → プレビュー iframe (5175)
                ← canvasCapture ← canvas.toDataURL()
```

**Playwright テストでは成功するが、ブラウザでは黒いまま。**

**原因**: エディタ（port 5176）とプレビュー（port 5175）は**別オリジン**。`ksc-demo.ts` に `captureCanvas` リスナーを追加しても、Vite HMR は各ポートで独立して動作するため、**ブラウザで開いている iframe 内の ksc-demo.ts にはコード変更が反映されない**。Playwright は毎回新しいブラウザコンテキストで iframe を読み込むので最新コードが使われる。

### 試行2: タイミング調整（失敗）

500ms/1500ms/3000ms の3回リトライでキャプチャをリクエスト。Playwright では成功するが、ブラウザでは同じ理由で失敗。

### 最終解決: CSS 合成方式（成功）

iframe 通信を完全に廃止。エディタ側のデータだけで背景画像+キャラクター画像を CSS で重ね合わせ、CSS `filter` プロパティでフィルターをかける。

```tsx
<div className="aspect-video" style={{ filter: getCssFilter(filterType, intensity) }}>
  <img src={bgUrl} className="w-full h-full object-cover" />
  {charUrl && (
    <img src={charUrl} className="absolute inset-0 object-contain" />
  )}
</div>
```

### 教訓

- **Playwright テストが通っても、ブラウザで動くとは限らない**（HMR の反映差異）
- クロスオリジン iframe の postMessage は動作するが、**iframe 内のコード更新は親ページの HMR とは独立**
- 外部通信に依存せず、**ローカルデータだけで完結する方式** が最も確実
- プレビューエンジンとの通信が必要な機能は、プレビューエンジン側の変更を含むため、dev サーバー再起動が必要

---

## 最終結果

```
7 passed (5.5s)
```

| テスト | 内容 |
|--------|------|
| API データ検証 | プロジェクト構造（2ページ、21ブロック）の確認 |
| エディタ表示 | プロジェクトタイトル + START ブロック表示 |
| 第1話ブロック | テキスト「冒険の始まり」が表示される |
| キャラクター | 「ファンタジー勇者」が表示される |
| 選択肢 | 「選択肢 2個」が表示される |
| 2ページ構成 | 「1 / 2」が表示される |
| フィルタープレビュー | プロパティにキャプチャ画像が表示される |

## 修正ファイル

| ファイル | 修正内容 |
|---------|---------|
| `apps/editor/src/store/useEditorStore.ts` | `setProject` にブロック正規化（choice/if の必須フィールド補完） |
| `apps/editor/src/components/sidebar/SidebarOutline.tsx` | `options`/`conditions` の undefined ガード |
| `apps/editor/src/components/sidebar/SidebarInspector.tsx` | `ScreenFilterProps` 追加（CSS 合成プレビュー） |
| `packages/web/src/ksc-demo.ts` | `captureCanvas` メッセージハンドラ追加 |
| `tests/editor-cli-verify.spec.ts` | 認証方式・テスト期待値修正 |
| `tests/editor-filter-debug.spec.ts` | フィルタープレビューデバッグテスト |

---

*記録: Claude Code (Claude Opus 4.6) -- 2026-03-07*
