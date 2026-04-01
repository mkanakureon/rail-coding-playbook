# AI生成・CLI操作を前提としたエディタ強化 — 設計

06 の構想を既存実装と照合し、実装可能な形に落とし込んだ設計。

## 現状の棚卸し

| 領域 | 既存実装 | 状態 |
|------|---------|------|
| スキーマ | `editor-schema.ts` — 14ブロック型定義、`/api/editor-schema` で公開 | 済 |
| バリデーション | `editor-cli.mjs validate` — assetId/toPageId の参照整合性チェック | 済（基本） |
| 履歴管理（GUI） | `useEditorStore.ts` — Zustand スナップショットで undo/redo | 済 |
| 履歴管理（CLI） | なし | 未実装 |
| テンプレート | なし | 未実装 |

## 設計

### 1. スキーマバリデーション強化

**方針**: 既存の `editor-schema.ts` を拡張する。新規スキーマは作らない。

#### 1-1. CLI validate の強化

現状の `validate` は assetId / toPageId の参照チェックのみ。以下を追加する。

```
追加チェック項目:
- 必須フィールド欠落（type ごとに editor-schema.ts の required を参照）
- enum 値の範囲外（pos, effect, filterType, operator）
- 型不一致（number フィールドに文字列が入っている等）
- ブロック ID の重複
- choice の options が空配列
```

#### 1-2. CLI add/update 時のインラインバリデーション

`validate` コマンドを事後に実行するだけでなく、`add` / `update` 実行時にも `editor-schema.ts` の定義に基づいてチェックする。

```
実装箇所: scripts/editor-cli.mjs
方法:
  1. /api/editor-schema を起動時に1回 fetch してキャッシュ
  2. cmdAdd / cmdUpdate 内でブロックデータを検証
  3. エラー時は保存せず終了（--force で無視可能）
```

### 2. CLI 操作の履歴管理

**方針**: ファイルベース履歴は採用しない。API 経由のスナップショットで管理する。

#### 2-1. snapshot / restore コマンド

```
editor-cli snapshot <projectId> [--tag <name>]
  → export と同等だが .snapshots/<projectId>/ にタイムスタンプ付きで保存
  → --tag 指定時はファイル名に付与（例: 2026-03-07T120000_before-ai-edit.json）

editor-cli restore <projectId> <snapshotFile>
  → スナップショットの内容で PUT して復元

editor-cli snapshots <projectId>
  → 保存済みスナップショット一覧
```

#### 2-2. 自動スナップショット

CLI の破壊的操作（remove, remove-page, import）実行前に自動でスナップショットを取る。

```
保存先: .snapshots/<projectId>/auto_<timestamp>.json
保持数: 最新10件（古いものは自動削除）
```

#### 2-3. GUI との関係

- GUI は既存の Zustand undo/redo をそのまま使う（変更不要）
- CLI スナップショットは GUI とは独立。git と併用する運用を想定
- `.snapshots/` は `.gitignore` に追加

### 3. テンプレート

**方針**: ブロック構成のテンプレートを JSON で定義し、CLI から利用可能にする。

#### 3-1. 対象範囲

| 対象 | テンプレート例 | 理由 |
|------|--------------|------|
| シーン（ページ） | 日常会話、選択肢分岐、バトル導入 | 最も再利用頻度が高い |
| プロジェクト | （Phase 2） | まずシーン単位で検証する |
| マップ | （Phase 2） | マップエディタの安定後 |

#### 3-2. テンプレート形式

```
templates/scenes/
  daily-conversation.json    # 背景→キャラ表示→会話数往復
  choice-branch.json         # 会話→選択肢→条件分岐
  battle-intro.json          # 演出→バトル→勝敗分岐
  dramatic-reveal.json       # エフェクト→背景切替→会話
```

テンプレート JSON の構造:
```json
{
  "name": "日常会話",
  "description": "背景設定→キャラ登場→3往復の会話",
  "placeholders": {
    "bgAssetId": "背景アセットID",
    "characterId": "キャラクターID",
    "expressionId": "表情ID"
  },
  "blocks": [
    { "type": "bg", "assetId": "{{bgAssetId}}" },
    { "type": "ch", "characterId": "{{characterId}}", "expressionId": "{{expressionId}}", "pos": "C", "visible": true },
    { "type": "text", "speaker": "{{characterName}}", "body": "（会話1）" },
    { "type": "text", "body": "（地の文）" },
    { "type": "text", "speaker": "{{characterName}}", "body": "（会話2）" }
  ]
}
```

- `{{placeholder}}` は CLI 引数または `_ai_context` から自動解決
- ID は生成時に `generateBlockId()` で自動付与

#### 3-3. CLI コマンド

```
editor-cli template list
  → 利用可能なテンプレート一覧

editor-cli template apply <projectId> <pageId> <templateName> [--var key=value ...]
  → テンプレートを展開してページにブロック追加
  → --var bgAssetId=bg-001 --var characterId=ch-001

editor-cli template preview <templateName>
  → テンプレートの内容をプレビュー表示（実際には保存しない）
```

#### 3-4. AI との連携

AI がテンプレートを活用する流れ:
```
1. editor-cli context <projectId>     → 利用可能なアセット・キャラ取得
2. editor-cli template list            → テンプレート一覧確認
3. editor-cli template apply <id> <pageId> daily-conversation \
     --var bgAssetId=bg-school --var characterId=ch-sakura --var expressionId=expr-smile
4. editor-cli update <id> <blockId> --body "実際の台詞"
```

## 実装順序

| Phase | 内容 | 依存 |
|-------|------|------|
| Phase 1 | CLI validate 強化（1-1） | なし |
| Phase 2 | CLI snapshot/restore（2-1, 2-2） | なし |
| Phase 3 | テンプレート基盤（3-2, 3-3） | なし |
| Phase 4 | CLI インラインバリデーション（1-2） | Phase 1 |
| Phase 5 | テンプレート拡張（マップ、プロジェクト） | Phase 3 + マップエディタ安定 |

Phase 1〜3 は相互依存なし。並行実装可能。
