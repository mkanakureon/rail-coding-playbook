# ツクール関連ソースコードレビュー + 次期計画

> 2026-03-15 / 全 2,433 行のツクール関連コードをレビュー

## コードレビュー

### 1. MapSystem.ts（393行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| 構造 | Container ベースの階層設計。PixiJS のベストプラクティスに沿っている |
| タイル描画 | `renderTileLayer` でタイルセットから切り出し → Sprite 配置。正しい |
| オートタイル | 8方向隣接判定 + ビットマスク方式。ツクール互換のアプローチ |
| カメラ | プレイヤー追従 + マップ端クランプ。小マップの中央配置も対応 |
| イベント条件 | 6比較演算子対応。`set_var` / `if` と同じロジック |
| エンカウント | `EncounterSystem` に委譲。責任分離が良い |

**改善点:**
- `moveEvent` の `durationMs > 0` 時が未実装（`jumpTo` で即移動している）
- `checkEventConditions` の `as any` キャスト — 型安全性が弱い
- `canPass` でイベントの `through` / `priority` チェックがあるが、プレイヤーの `through` 状態はない

### 2. MapCharacter.ts（180行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| 移動補間 | `moveProgress` ベースのスムーズ移動。フレームレート独立 |
| 歩行アニメ | 3フレーム（中→左→中→右）パターン。ツクール準拠 |
| スプライト切り出し | 4方向 × 3フレームのシートから Rectangle で切り出し |
| プレースホルダー | スプライト未設定時にカラーボックスで代替表示 |

**改善点:**
- `moveSpeed = 0.15` がハードコード — キャラごとの移動速度設定がない
- スプライトの行マッピング `down:0, left:1, right:2, up:3` がハードコード — 別配列のシートに対応できない

### 3. EncounterSystem.ts（73行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| 歩数計算 | RPG Maker 方式（`rate/2 + random(rate/2)`）準拠 |
| リージョンフィルタ | `regionIds` で地域別エンカウント制御 |
| 重み付き抽選 | `weight` ベースの重み付きランダム。正しい実装 |

**改善点なし。** 小さくて完成度が高い。

### 4. InventorySystem.ts（49行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| 操作 | add / remove / has / count の4操作。シンプルで正しい |
| remove | 所持数不足時に `false` 返却。安全 |
| JSON 変換 | `toJSON` / `loadJSON` でセーブ/ロード対応 |

**改善点なし。** セーブスキーマ v1.1 にそのまま使える。

### 5. UiLayoutContainer.ts（75行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| 設計 | `layoutMap` で ID → Container のマッピング。`applyPlayLayout` で位置適用 |
| コンポーネント | messageWindow, nameBox, choiceWindow, clickWaitIcon, quickMenuBar + 5ボタン |

**改善点:**
- 概念マップの「20 UI要素」のうち、実装済みは 10 要素。残り（toastNotification, areaNamePlate, objectivePanel, goldWindow 等）が未登録

### 6. maps.ts API（193行）— ⭐ 良い

| 項目 | 評価 |
|------|------|
| CRUD | GET(一覧) / GET(slug) / POST(upsert) / DELETE の4エンドポイント |
| 認証 | `authMiddleware` + `checkProjectOwner` で所有者チェック |
| BigInt 対策 | `mapToJson` で `Number()` 変換。正しい |
| バリデーション | Zod で slug/name/data を検証 |

**改善点:**
- `data: z.any()` — MapData のスキーマ検証がない。不正な JSON を保存できてしまう

### 7. エディタ（MapEditor 等, 645行）— ⚠️ 基礎のみ

| ファイル | 行 | 内容 |
|---------|:--:|------|
| MapEditor.tsx | 202 | タブ切り替え、マップ一覧、CRUD |
| MapEditorView.tsx | 134 | マップ詳細ビュー |
| MapCanvas.tsx | 139 | Canvas 描画（基礎のみ） |
| TilePalette.tsx | 60 | タイル選択パレット |
| EventInspector.tsx | 110 | イベントプロパティ |
| mapService.ts | 49 | API 呼び出し |

**改善点:**
- ペイント機能はプロトタイプ段階 — ドラッグでのタイル配置が未実装
- イベントの「複数ページ + 条件切り替え」UIが未実装
- マップテストプレイ機能がない

### 8. packages/map/（517行）— 型定義 + ユーティリティ

| ファイル | 行 | 内容 |
|---------|:--:|------|
| types.ts | 269 | MapData, TilesetDef, MapEvent, MapLayer 等の型定義 |
| validate.ts | 163 | マップデータバリデーション |
| autotile.ts | 61 | オートタイル判定ユーティリティ |
| index.ts | 24 | エクスポート |

**評価:** 型定義が充実しており、バリデーションもある。良い基盤。

## 実装完了度まとめ

| 機能 | 完了度 | 詳細 |
|------|:------:|------|
| タイル描画 | 90% | オートタイル含む。ただし動的タイルアニメーション未対応 |
| プレイヤー移動 | 85% | スムーズ移動、衝突判定済み。移動速度設定なし |
| NPC/イベント | 70% | 条件分岐、touch/action トリガー済み。複数ページ未対応 |
| エンカウント | 95% | RPG Maker 方式完備。リージョン対応済み |
| カメラ | 80% | 追従 + クランプ済み。スクロール速度調整なし |
| アイテム管理 | 80% | CRUD + セーブ対応。装備システム未実装 |
| UIレイアウト | 50% | 10/20 要素実装。プリセット4種。残り10要素未実装 |
| マップAPI | 90% | CRUD + 認証 + 所有者チェック。data バリデーションなし |
| マップエディタ | 40% | 一覧/詳細/パレットの基礎のみ。ペイント・テストプレイ未実装 |
| バトルランタイム | 5% | `battle` ブロック型のみ。ダメージ計算・行動AI・バトルUI 全て未実装 |

## 次期計画

### 短期（1-2週間）— 既存コードの品質向上

| # | タスク | 対象ファイル | 規模 |
|---|-------|------------|:----:|
| 1 | `moveEvent` の `durationMs` 対応 | MapCharacter.ts | 小 |
| 2 | キャラ移動速度をオプション化 | MapCharacter.ts | 小 |
| 3 | maps API の `data` バリデーション追加 | maps.ts + @kaedevn/map validate | 小 |
| 4 | `checkEventConditions` の型安全化 | MapSystem.ts | 小 |
| 5 | マップ関連の単体テスト追加 | MapSystem, MapCharacter | 中 |

### 中期（3-4週間）— Phase 2-3 の機能追加

| # | タスク | 概念マップ | 規模 |
|---|-------|:--------:|:----:|
| 6 | `call` ブロック + `templates[]` | Phase 2, §4 | 中 |
| 7 | `gameDb` スキーマ（actors/enemies/skills/items） | Phase 3, §5 | 中 |
| 8 | イベント複数ページ + 条件切り替え | Phase 5, §7 | 中 |
| 9 | `map_jump` ブロック（シナリオ↔マップ遷移） | Phase 5, §7 | 中 |
| 10 | セーブスキーマ v1.1（inventory 追加） | Phase 3, §9 | 小 |

### 長期（1-2ヶ月）— Phase 4-6

| # | タスク | 概念マップ | 規模 |
|---|-------|:--------:|:----:|
| 11 | バトルランタイム（ダメージ計算、行動AI、勝敗分岐） | Phase 4, §6 | 大 |
| 12 | バトルUI（PixiJS でステータス/コマンドウィンドウ） | Phase 4, §6 | 大 |
| 13 | マップエディタのペイント機能完成 | Phase 5 | 中 |
| 14 | マップテストプレイ機能 | Phase 5 | 中 |
| 15 | PlayLayout 残り10要素の実装 | Phase 6, §9-13 | 中 |
| 16 | セーブスキーマ v1.2-1.3 | Phase 4-5, §9 | 小 |

### 担当の推奨分担

| 担当 | タスク |
|------|-------|
| **Gemini CLI** | #6 call ブロック, #7 gameDb, #8 イベント複数ページ, #11-12 バトル, #13 ペイント |
| **Claude Code** | #1-5 品質向上, #9 map_jump, #10 セーブ v1.1, #15 PlayLayout |
| **どちらでも** | #14 テストプレイ, #16 セーブ v1.2-1.3 |

### 優先順位の根拠

1. **#1-5（品質向上）を先にやる** — 既存コードのバグ予防。テストがないと安心して拡張できない
2. **#6-10（Phase 2-3）は中期** — ノベル制作者向けの機能拡張。call / gameDb がないとRPGが作れない
3. **#11-16（Phase 4-6）は長期** — バトルは最大規模。マップエディタ完成とバトルが揃えばツクール相当

### 注意事項

- **Gemini CLI は必ずブランチで作業する** — main に直接 push しない
- **`commandDefinitions.ts` を変更したら core + compiler の同期テストを通す**
- **新ブロック型の追加は CLAUDE.md の「Adding New Script Commands」に従う**
- **セーブスキーマ変更時は `save_schema_version` を更新し、後方互換のデフォルト値補完を実装する**
