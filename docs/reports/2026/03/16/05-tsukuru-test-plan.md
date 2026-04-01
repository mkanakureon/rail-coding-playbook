# ツクール機能ブラウザテスト計画書

**作成日**: 2026-03-16
**対象**: Phase 2-6 で追加されたツクール機能のヘッドレスブラウザテスト
**前提**: 既存テスト 102件（15ファイル）の棚卸し結果

---

## 既存テストの現状

| カテゴリ | テスト数 | カバー範囲 |
|---------|---------|----------|
| Battle (E2E) | 3 | ブロック UI、プレビュー実行、管理者フロー |
| Battle (Unit) | 19 | RNG、ダメージ計算、シミュレーション決定性 |
| Map (E2E) | 2 | マップロード、プレイヤー移動、レイアウト切替 |
| Interpreter RPG | 5 | map_load、player_move、item、layout_set、event_move |
| Game Systems | 35+ | Flag/Inventory/Effects、KSC アダプタ |
| Systems (Unit) | 38 | FlagSystem、InventorySystem、EncounterSystem、SaveData |

### 未テストのツクール機能（Phase 2-6 追加分）

| 機能 | 追加 Phase | テスト有無 |
|------|-----------|----------|
| **call（テンプレート呼出）** | 2 | なし |
| **gameDb（アクター・敵・スキル・アイテム）** | 3 | なし |
| **battleStart の gameDb 連携** | 4 | なし |
| **ステータス効果（毒・麻痺・気絶）** | 4 | Unit のみ（E2E なし） |
| **map_jump** | 5 | なし |
| **イベント複数ページ** | 5 | なし |
| **NPC 移動ルート** | 5 | なし |
| **scroll_text** | 6 | なし |
| **GameDb エディタタブ** | UI | なし |
| **テンプレート管理タブ** | UI | なし |
| **マップエディタ改善** | UI | なし |
| **BattleScene PixiJS** | UI | なし |

---

## テスト計画

### Phase T1: エディタ新ブロック追加テスト（ヘッドレス）

**目的**: call / map_jump / scroll_text ブロックがエディタで追加・編集・保存できるか。

**ファイル**: `tests/shared/editor/tsukuru-blocks.spec.ts`（新規）

```
テスト1: call ブロック追加 → テンプレート選択 → 保存 → プロパティ保持
テスト2: map_jump ブロック追加 → mapId/spawnX/Y 入力 → 保存 → プロパティ保持
テスト3: scroll_text ブロック追加 → テキスト入力 → 保存 → プロパティ保持
テスト4: 3ブロックを含むプロジェクトをプレビュー → クラッシュしない
```

**方式**: API でプロジェクト作成 → エディタ UI でブロック追加 → saveProject → getProject でプロパティ検証

### Phase T2: GameDb エディタテスト（ヘッドレス）

**目的**: DB タブでアクター/敵/スキル/アイテムの CRUD が動作するか。

**ファイル**: `tests/shared/editor/gamedb-editor.spec.ts`（新規）

```
テスト1: DB タブに切替 → アクター追加 → 名前・ステータス入力 → 保存 → 値保持
テスト2: 敵キャラ追加 → maxHp/atk/def 入力 → 保存 → 値保持
テスト3: スキル追加 → 名前・MP コスト入力 → 保存 → 値保持
テスト4: アイテム追加 → 名前・価格入力 → 保存 → 値保持
テスト5: 削除 → 保存 → 削除されている
```

**方式**: エディタ UI 操作 → saveProject → getProject → data.gameDb を検証

### Phase T3: テンプレート管理テスト（ヘッドレス）

**目的**: テンプレートタブで作成 → call ブロックで呼出 → プレビュー動作。

**ファイル**: `tests/shared/editor/template-editor.spec.ts`（新規）

```
テスト1: テンプレタブに切替 → テンプレート追加 → 名前入力 → 保存
テスト2: テンプレートにブロック追加（text） → 保存 → ブロック保持
テスト3: エディタで call ブロック追加 → テンプレート選択 → プレビュー → テンプレ内テキスト表示
```

### Phase T4: バトル gameDb 連携テスト（ブラウザ E2E）

**目的**: gameDb で定義したアクター・敵でバトルが動作するか。

**ファイル**: `tests/shared/battle/battle-gamedb.spec.ts`（新規）

```
テスト1: API でプロジェクト作成 → gameDb にアクター + 敵 + トループ設定
        → battle ブロック追加 → プレビュー → バトル画面にカスタム名前表示
テスト2: gameDb なし（フォールバック）→ プレビュー → デフォルト Hero でバトル動作
テスト3: ステータス効果スキル → バトル中に毒表示
```

**方式**: API でブロックデータ直接構築 → プレビューのコンソールログ + スクリーンショットで検証

### Phase T5: scroll_text プレビューテスト（ブラウザ E2E）

**目的**: scroll_text がプレビューで表示・スキップできるか。

**ファイル**: `tests/shared/flow/scroll-text.spec.ts`（新規）

```
テスト1: API でプロジェクト作成 → scroll_text ブロック → プレビュー
        → DOM にスクロールオーバーレイ表示 → テキスト内容一致
テスト2: クリックでスキップ → オーバーレイ消滅 → シナリオ続行
テスト3: scroll_text → 次のテキストブロック → 両方表示される
```

**方式**: API でブロック構築 → プレビューで `#scroll-text-overlay` の存在確認 → click → 消滅確認

### Phase T6: map_jump プレビューテスト（ブラウザ E2E）

**目的**: map_jump ブロックがプレビューでマップ遷移を発生させるか。

**ファイル**: `tests/shared/flow/map-jump.spec.ts`（新規）

```
テスト1: API でプロジェクト作成 → text → map_jump(mapId) → プレビュー
        → コンソールに MAP_LOAD ログ → マップ ID 一致
テスト2: map_jump に spawnX/Y 指定 → ログに座標が含まれる
```

**方式**: API でブロック構築 → プレビューのコンソールログで `[Op] MAP_LOAD` を検証

### Phase T7: ステータス効果 Unit テスト強化

**目的**: Phase A で修正した RNG 消費 + 致死ダメージのロジックをテストで固める。

**ファイル**: `packages/battle/__tests__/status-effects.test.ts`（新規）

```
テスト1: 毒スキル → ターン終了 → HP 10% 減少（HP1 で止まる）
テスト2: 麻痺 → 行動スキップ確認
テスト3: ステータスのターン減少 → 0 で自動回復
テスト4: 致死ダメージ + 毒スキル → 毒は付与されない（死亡対象）
テスト5: スキル未存在 → RNG 2回消費 + silent failure
テスト6: skillLookup 経由のスキル使用 → 正常動作
```

---

## 実施順序

```
T7（Unit テスト）──── 依存なし、最速で実行可能
  │
T1（エディタブロック）── エディタ UI 操作
  │
T2（GameDb エディタ）── T1 と類似パターン
T3（テンプレート）───── T1 + T2 と並行可能
  │
T4（バトル gameDb）─── T2 の保存結果を使用
T5（scroll_text）───── T1 と独立
T6（map_jump）──────── T1 と独立
```

- T7 は Unit テストなのでブラウザ不要、最速で着手可能
- T1-T3 はエディタ UI テスト（ヘッドレス Playwright）
- T4-T6 はプレビューテスト（ヘッドレス Playwright、API ベース）

---

## 成果物

| Phase | ファイル | テスト数 | 種別 |
|-------|---------|---------|------|
| T1 | `tests/shared/editor/tsukuru-blocks.spec.ts` | 4 | ヘッドレス E2E |
| T2 | `tests/shared/editor/gamedb-editor.spec.ts` | 5 | ヘッドレス E2E |
| T3 | `tests/shared/editor/template-editor.spec.ts` | 3 | ヘッドレス E2E |
| T4 | `tests/shared/battle/battle-gamedb.spec.ts` | 3 | ヘッドレス E2E |
| T5 | `tests/shared/flow/scroll-text.spec.ts` | 3 | ヘッドレス E2E |
| T6 | `tests/shared/flow/map-jump.spec.ts` | 2 | ヘッドレス E2E |
| T7 | `packages/battle/__tests__/status-effects.test.ts` | 6 | Vitest Unit |
| **合計** | **7 新規ファイル** | **26 テスト** | |

---

## 共通パターン

### API ベースプロジェクト構築（T4-T6）

```typescript
const { token } = await login(request);
const projectId = await createProject(request, token, `test-${Date.now()}`);
await saveProject(request, token, projectId, {
  data: {
    pages: [{ id: 'page-1', name: 'メイン', blocks: [...] }],
    gameDb: { actors: [...], enemies: [...], troops: [...], skills: [], items: [], states: [] },
    templates: [{ id: 'tpl-1', name: 'テンプレ', blocks: [...] }],
  },
});
```

### エディタ UI 操作（T1-T3）

```typescript
await openEditor(page, token, userId, projectId);
// GameDb タブ切替
await page.locator('button:has-text("DB")').click();
// テンプレタブ切替
await page.locator('button:has-text("テンプレ")').click();
```

### プレビュー検証（T4-T6）

```typescript
const logs: string[] = [];
page.on('console', (msg) => logs.push(msg.text()));
await page.goto(`${URLS.PREVIEW}/ksc-demo.html?work=${projectId}&page=001&autostart=1`);
// ログ検証
expectLog(logs, /\[Op\] MAP_LOAD:/);
// DOM 検証
await expect(page.locator('#scroll-text-overlay')).toBeVisible();
```

---

## 検証コマンド

```bash
# T7: Unit テスト
cd packages/battle && npx vitest run __tests__/status-effects.test.ts

# T1-T3: エディタテスト
npx playwright test tests/shared/editor/tsukuru-blocks.spec.ts \
  tests/shared/editor/gamedb-editor.spec.ts \
  tests/shared/editor/template-editor.spec.ts \
  --config=tests/configs/playwright.local.config.ts

# T4-T6: プレビューテスト
npx playwright test tests/shared/battle/battle-gamedb.spec.ts \
  tests/shared/flow/scroll-text.spec.ts \
  tests/shared/flow/map-jump.spec.ts \
  --config=tests/configs/playwright.local.config.ts

# 全ツクールテスト一括
npx playwright test tests/shared/editor/tsukuru-blocks.spec.ts \
  tests/shared/editor/gamedb-editor.spec.ts \
  tests/shared/editor/template-editor.spec.ts \
  tests/shared/battle/battle-gamedb.spec.ts \
  tests/shared/flow/scroll-text.spec.ts \
  tests/shared/flow/map-jump.spec.ts \
  --config=tests/configs/playwright.local.config.ts
```
