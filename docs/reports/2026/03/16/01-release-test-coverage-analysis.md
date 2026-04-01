# リリース前テストカバレッジ分析

**作成日**: 2026-03-16
**分析時点**: 216テストファイル / 約1,900テストケース

## 現状サマリ

| カテゴリ | ファイル数 | テスト数 | 主な対象 |
|---------|-----------|---------|---------|
| packages (unit) | 131 | ~1,018 | compiler, core, web, interpreter, battle, map, ai-gateway |
| apps (unit/integration) | 77 | ~677 | editor store, hono API, next.js |
| tests/shared (E2E) | 78 | ~419 | auth, editor, assets, timeline, guest, flow |
| tests/azure | 7 | ~81 | Azure デプロイ後の疎通 |
| tests/local | 26 | ~68 | 録画、ガイド生成、ローカル検証 |
| tests/block-coverage | 9 | ~61 | 全ブロック型の API 保存・プレビュー |
| e2e (root) | 4 | ~4 | マップ、モバイル UI |

---

## 不足テスト一覧（優先度順）

### A. クリティカル（リリースブロッカー）

| # | 領域 | 不足内容 | 理由 |
|---|------|---------|------|
| 1 | **Preview KSC 生成 — if ブロック後のテキスト** | `generateKSCScript` で if/else ブロック直後のテキストに到達しない（JUMP ターゲット不正） | `rec-logic-detail` テストで発見。if ブロックの後にテキストがあるシナリオが壊れる |
| 2 | **Guest → 正規ユーザーアップグレード E2E** | `POST /api/auth/guest/upgrade` のブラウザフロー未検証 | ゲストで作ったプロジェクトが正規アカウントに引き継がれるか。unit test (`auth.test.ts`) はあるが E2E なし |
| 3 | **Cloud Save/Load E2E** | `cloud-saves.ts` の API テスト (3件) のみ。ブラウザからの保存→復元フロー未検証 | セーブデータ破損はユーザー離脱に直結 |

### B. 重要（品質リスク）

| # | 領域 | 不足内容 | 理由 |
|---|------|---------|------|
| 4 | **Preview — choice 内 set_var の動作** | choice の actions 内の set_var が正しく KSC に変換されるかの unit test なし | `preview.test.ts` (40件) はあるが、choice + set_var + if 連携は未検証 |
| 5 | **Editor Store — undo/redo** | `store.test.ts` (108件) に undo/redo のテストが不明確 | ブロック追加→undo→redo でデータが壊れないか |
| 6 | **Editor — ページ削除時の jump 参照整合性** | jump ブロックの `toPageId` が指すページを削除した場合の挙動 | プレビューで不正な `@jump` が生成されクラッシュする可能性 |
| 7 | **Audio 再生 E2E** | AudioManager の unit test なし。BGM/SE/VOICE の再生・停止・音量変更 | `WebOpHandler` でのオーディオ Op は実装済みだがテストなし |
| 8 | **Screen Filter — 全16種の適用テスト** | `screen-filter-block.spec.ts` は 1件のみ。個別フィルタの適用結果未検証 | 7,155行の ScreenFilter.ts に対してテスト過少 |

### C. あると良い（防御的）

| # | 領域 | 不足内容 | 理由 |
|---|------|---------|------|
| 9 | **Editor — 同時編集/競合** | 2タブで同じプロジェクトを開いた場合の挙動 | 保存時にデータが上書きされる可能性 |
| 10 | **Official Assets — semantic search** | `GET /api/official-assets/semantic-search` のテストなし | Gemini Embedding API 依存で障害時にフォールバックするか |
| 11 | **Pages API — ページ順序変更** | `pages.ts` (5件) にページの並べ替えテストなし | jump の `toPageId` 参照が壊れないか |
| 12 | **KSC Editor — プレビュー連携** | `ksc-editor.spec.ts` (10件) はエディタ UI のみ。編集→プレビュー反映の E2E なし | 編集した KSC が即座にプレビューに反映されるか |
| 13 | **Map System E2E** | `map-feature.spec.ts` (1件)、`run-map-*.spec.ts` (2件) のみ | MAP_LOAD → プレイヤー移動 → イベント発火 → シナリオ遷移の統合フロー |
| 14 | **Battle System E2E** | `battle-*.spec.ts` (3件) は最小限 | 勝利/敗北 → 正しい jump 先に遷移するか |
| 15 | **Save Schema バージョニング** | `SaveData.test.ts` (7件) はv1のみ。将来の v2 マイグレーション未検証 | schema_version が変わった際の後方互換性 |

---

## 発見した実バグ

### KSC コンパイラ — if ブロック後の JUMP ターゲット不正 (#1)

**発見経緯**: `rec-logic-detail.spec.ts` の Test 3（if の条件分岐）で検出。

**症状**: `start → bg → set_var(flag=1) → if(flag==1) { then: [text("then到達")] } else { [text("else到達")] } → text("分岐終了")` の構成で、then ルート実行後に「分岐終了」テキストが表示されない。

**原因**: `generateKSCScript`（`apps/hono/src/routes/preview.ts`）が生成する KSC で、if/else の then ブロック末尾に置かれる JUMP の PC ターゲットが、if ブロック直後のテキストを飛び越えてスクリプト末尾に到達する。

**影響**:
- `if { then } else { } → 後続テキスト` パターンのシナリオで後続テキストが表示されない
- if ブロック内にテキストを閉じ込める構成では問題なし（テスト Test 3 の回避策として確認済み）

**対応案**:
- `preview.ts` の nested text テンプレートでの `@l` 配置を見直す
- または compiler (`packages/compiler/src/parser/Parser.ts`) の if ブロック JUMP 計算を修正

---

## テスト分布の詳細

### パッケージ別テスト数

| パッケージ | テスト数 | 備考 |
|-----------|---------|------|
| ksc-compiler | 332 | lexer 51 + parser 68 + checker 69 + emitter 75 + vm 69 |
| interpreter | 218 | Phase 1-6 + A + error + debug + integration |
| core (engine) | 179 | OpRunner 77 + timeline 66 + events 21 + save 7 + sync 8 |
| compiler | 183 | tokenizer + parser + integration + command-sync + validator + map |
| hono API | 459 | auth 33 + projects 6 + assets 22 + preview 40 + assist 200 + middleware 32 + others |
| editor | 209 | store 108 + converter 31 + types 26 + api 24 + E2E 20 |
| web engine | 126 | WebOpHandler 17 + KscAdapter 34 + KscRunner 15 + game systems 44 + others |
| battle | 21 | damage + rng + simulate |
| ai-gateway | 28 | mock + factory + embeddings |

### E2E テスト数（ブラウザテスト）

| カテゴリ | テスト数 | 備考 |
|---------|---------|------|
| Auth | 35 | redirect 25 + flow 3 + local 6 + cookie 1 |
| Editor | 14 | blocks 3 + mobile 7 + ksc 2 + filter 1 + overlay 1 |
| Assets | 43 | admin 19 + management 10 + search 10 + selection 4 |
| Timeline | 32 | block 10 + panel 8 + seek 6 + keyframe 6 + preview 2 |
| Guest | 16 | assets 8 + blocks 3 + debug 2 + verify 1 + direct 1 + multi 1 |
| Flow | 27 | AI profiles 10 + auto-init 6 + mypage 5 + nav 1 + full 1 + others |
| Azure | 81 | full-flow 50 + create-play 15 + assets 5 + others |
| Block Coverage | 61 | API save 19 + compiler 30 + press 12 |
| Battle | 3 | play + block + admin |
| Camera | 6 | camera block operations |

---

## 推奨アクション

### 即座に対応
- **#1**: if ブロック後テキスト到達不能のバグ修正（ユーザーが作るシナリオで頻出パターン）

### リリース前に追加
- **#2**: Guest → アップグレード E2E
- **#3**: Cloud Save/Load E2E
- **#4**: choice + set_var + if 連携の KSC 生成 unit test

### 次スプリント
- **#5〜#8**: Editor undo/redo、jump 参照整合性、Audio E2E、Screen Filter 全種

### バックログ
- **#9〜#15**: 同時編集、semantic search、ページ順序、KSC Editor プレビュー連携、Map/Battle 統合 E2E、Save Schema v2
