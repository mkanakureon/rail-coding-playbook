# Phase 2 実装設計: `call` ブロック + `templates`

**作成日**: 2026-03-16
**Phase**: 2（コモンイベント）
**規模**: 小（新規ブロック型1つ + プロジェクトスキーマ拡張）
**依存**: なし（Phase 1 完了済みの上に追加）

---

## 概要

ツクールの「コモンイベント」に相当する機能。再利用可能なブロック列（テンプレート）を定義し、`call` ブロックで呼び出す。

---

## 1. プロジェクト JSON の拡張

### 変更対象: `packages/schemas/src/project.ts`（または該当スキーマ）

```typescript
// テンプレート定義
interface Template {
  id: string;         // "tpl-{Date.now()}"
  name: string;       // "ショップ処理"
  blocks: Block[];    // 再利用可能なブロック列
}

// プロジェクト data に追加
interface ProjectData {
  pages: Page[];
  characters: Character[];
  templates: Template[];  // ← 追加
  // ...
}
```

**後方互換**: 既存プロジェクトでは `templates` が `undefined`。ロード時に `templates ?? []` でデフォルト補完する。

---

## 2. ファイル変更一覧

### 2-1. `packages/core/src/types/Op.ts` — Op 型追加

```typescript
| { op: "CALL_TEMPLATE"; templateId: string }
```

### 2-2. `packages/compiler/src/registry/commandRegistry.ts` — パーサー追加

```typescript
function parseCallCommand(args: string[], line: number, raw: string): Op {
  const templateId = args[0];
  if (!templateId) {
    throw new ParseError(`@call requires templateId`, line, raw);
  }
  return { op: 'CALL_TEMPLATE', templateId };
}

// COMMAND_PARSERS に登録
COMMAND_PARSERS.set('call', parseCallCommand);
```

KSC 構文: `@call tpl-shop`

### 2-3. `packages/core/src/engine/IOpHandler.ts` — ハンドラメソッド追加

```typescript
callTemplate?(templateId: string): Promise<void>;
```

### 2-4. `packages/core/src/engine/OpRunner.ts` — dispatch case 追加

```typescript
case "CALL_TEMPLATE": {
  if (h.callTemplate) {
    await h.callTemplate(op.templateId);
  }
  this.pc++;
  break;
}
```

**実装方針**: OpRunner はテンプレートのブロック列を知らない。ハンドラ側（WebOpHandler）がプロジェクトデータからテンプレートを取り出し、ブロック列をコンパイル → 子 OpRunner で実行する。

### 2-5. `packages/web/src/engine/WebOpHandler.ts` — 実装

```typescript
async callTemplate(templateId: string): Promise<void> {
  const template = this.project.data.templates?.find(t => t.id === templateId);
  if (!template) {
    console.warn(`Template not found: ${templateId}`);
    return;
  }
  // テンプレートのブロック列をコンパイルして実行
  const ops = compileBlocks(template.blocks, this.project);
  const runner = new OpRunner(ops, this);
  await runner.run();
}
```

### 2-6. `apps/editor/src/types/index.ts` — ブロック型追加

```typescript
export type CallBlock = {
  id: string;
  type: 'call';
  templateId: string;
};

// Block ユニオンに追加
export type Block = TextBlock | ChoiceBlock | ... | CallBlock;
```

### 2-7. `apps/editor/src/store/useEditorStore.ts` — エディタ対応

- `getBlockScript()`: `call` → `@call ${block.templateId}`
- `buildSnapshotScript()`: `call` ブロックの KSC 生成
- テンプレート一覧の state 管理（CRUD）

### 2-8. `apps/hono/src/routes/preview.ts` — プレビュー対応

- `generateKSCScript()` に `call` ブロックのハンドリング追加

---

## 3. エディタ UI

### テンプレート管理パネル

エディタのサイドバーに「テンプレート」タブを追加:

- テンプレート一覧（名前 + ブロック数）
- 新規作成ボタン
- テンプレートを選択 → ブロックエディタで編集（ページ編集と同じ UI を再利用）
- 削除ボタン（使用箇所の警告付き）

### call ブロックの UI

ブロックパレットに「テンプレート呼び出し」を追加:

- ドロップダウンでテンプレート選択（`templates[]` から）
- 選択中のテンプレート名を表示
- クリックでテンプレート編集にジャンプ

---

## 4. テスト計画

| テスト | ファイル | 内容 |
|-------|---------|------|
| コンパイラ同期 | `packages/compiler/test/` | `@call` のパース + Op 生成 |
| OpRunner | `packages/core/test/` | CALL_TEMPLATE の dispatch |
| ランタイム | `packages/web/test/` | テンプレートのブロック列実行 |
| エディタ | `apps/editor/test/` | call ブロックの KSC 生成 |
| E2E | `e2e/` | テンプレート作成 → call ブロック配置 → プレビュー実行 |

### 必須確認事項

- [ ] テンプレートが空のプロジェクトで既存機能が壊れない
- [ ] ネストした call（テンプレートから別テンプレートを呼ぶ）が動作する
- [ ] 存在しない templateId の call でクラッシュしない（warn + スキップ）
- [ ] 循環呼び出し（A→B→A）で無限ループしない（深さ制限: 10）

---

## 5. CLAUDE.md の「Adding New Script Commands」チェックリスト

| # | ファイル | 変更内容 | 状態 |
|---|---------|---------|:----:|
| 1 | `commandRegistry.ts` | `parseCallCommand` + `COMMAND_PARSERS` 登録 | [ ] |
| 2 | `Op.ts` | `CALL_TEMPLATE` Op 型追加 | [ ] |
| 3 | `IOpHandler.ts` | `callTemplate?` メソッド追加 | [ ] |
| 4 | `OpRunner.ts` | dispatch case 追加 | [ ] |
| 5 | `WebOpHandler.ts` | テンプレート取得 + 子 Runner 実行 | [ ] |
| 6 | `useEditorStore.ts` | `getBlockScript` / `buildSnapshotScript` | [ ] |
| 7 | `preview.ts` | `generateKSCScript` | [ ] |
| 8 | `npm test -w @kaedevn/compiler` | 同期テスト通過 | [ ] |
