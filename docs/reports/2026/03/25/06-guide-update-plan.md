# 読者向け/作者向けガイド 更新計画

> 作成日: 2026-03-25

## 現状

ガイドは18ファイル以上存在するが、直近の大型機能追加（Live2D、パーティクル53種、色調補正、ネイティブエンジン GPU 移植）が反映されていない。

## 未反映の機能一覧

| 機能 | 追加時期 | 影響するガイド |
|------|---------|-------------|
| Live2D キャラブロック | 3/24 | editor-guide, block-guide, for-creators, character-setup |
| パーティクルフィルター 5種 | 3/24 | editor-guide, block-guide |
| 色調補正ブロック | 3/24 | editor-guide, block-guide |
| フィルター 53種（15→53） | 3/23-25 | editor-guide, block-guide, publishing-works |
| filter_mix 重ね掛け | 3/23 | editor-guide, block-guide |
| パーティクルブロック | 3/24 | editor-guide, block-guide, for-creators |
| expressionId 自動設定 | 3/25 | character-setup |
| CPU パーティクルシステム | 3/24 | (開発者向け) |
| ネイティブ GPU 移植 | 3/25 | (開発者向け、ユーザーには透過的) |

---

## 更新対象と内容

### 1. `editor-guide.md`（作者向けエディタ完全ガイド）— 優先度: 高

**現状**: 14ブロック型 + 15フィルターの記述。Live2D / パーティクル / 色調補正の記載なし。

**更新内容**:
- ブロック型に Live2D キャラブロック追加（モデル選択、モーション、位置/サイズ）
- ブロック型にパーティクルブロック追加（バトル/ガチャ演出用）
- フィルター一覧を 15→53 に更新（7カテゴリに整理: 時間帯/天候/パーティクル/雰囲気/色調/特殊効果/レトロ）
- 色調補正スライダー（明るさ/コントラスト/彩度/色温度）の説明追加
- filter_mix（重ね掛け）の使い方を追加
- 「3枚の背景で30場面」のコンセプト説明

### 2. `block-guide.md`（ブロック操作ガイド、スクリーンショット付き）— 優先度: 高

**現状**: 14ブロック型のスクリーンショット付き解説。フィルターブロックは15種の記述。

**更新内容**:
- Live2D キャラブロックのスクリーンショット + 操作説明追加
- パーティクルブロックのスクリーンショット + 操作説明追加
- スクリーンフィルターブロックのフィルター数を更新（15→53）
- 色調補正ブロックのスクリーンショット追加
- 必要に応じて既存スクリーンショットの差し替え

### 3. `for-creators.md`（作者向けハブページ）— 優先度: 中

**現状**: Live2D / パーティクルへのリンクなし。

**更新内容**:
- Live2D キャラクター演出のセクション追加
- パーティクル/エフェクトのセクション追加
- フィルターギャラリーへのリンク追加
- 「フィルターで背景を変化させる」のユースケース紹介

### 4. `character-setup.md`（キャラクター設定ガイド）— 優先度: 中

**現状**: 静止画ベースのキャラクター設定のみ。

**更新内容**:
- Live2D キャラクターの設定手順追加（モデル配置、モーショングループ、位置/サイズ）
- 表情の自動設定（expressionId フォールバック）の説明
- アニメーション表情（フレームセット）の説明強化

### 5. `publishing-works.md`（公開・共有ガイド）— 優先度: 中

**現状**: プレビュー可能な機能リストにフィルター/Live2D なし。

**更新内容**:
- プレビュー可能な機能に Live2D、パーティクル、53種フィルター、色調補正を追加
- 読者体験の説明にフィルター演出の効果を追加

### 6. `player-guide.md` + `player-reference.md`（読者向け）— 優先度: 低

**現状**: 基本操作（テキスト送り、選択肢、オート/スキップ）のみ。

**更新内容**:
- 読者側は操作が変わっていないので大幅な変更は不要
- Live2D キャラクターが表示される作品がある旨を追記（読者は特に操作不要）
- パーティクル/フィルター演出は自動的に表示される旨を追記

### 7. `getting-started.md`（はじめの一歩）— 優先度: 低

**現状**: 基本フロー（登録→プロジェクト作成→スクリプト→プレビュー）。

**更新内容**:
- フィルターの紹介を追加（「背景にフィルターをかけて雰囲気を変えてみよう」）
- Live2D は上級者向けなので getting-started には含めない

---

## 作業順序

```
Phase 1（高優先度）:
  1. editor-guide.md — フィルター53種 + Live2D + パーティクル + 色調補正
  2. block-guide.md — スクリーンショット追加（MCP Playwright で撮影）

Phase 2（中優先度）:
  3. for-creators.md — ハブページにリンク追加
  4. character-setup.md — Live2D キャラ設定手順
  5. publishing-works.md — プレビュー機能リスト更新

Phase 3（低優先度）:
  6. player-guide.md — 演出表示の補足
  7. getting-started.md — フィルター紹介
```

## スクリーンショット撮影計画

block-guide.md の更新にはスクリーンショットが必要:

| 対象 | 撮影方法 | 枚数 |
|------|---------|------|
| Live2D キャラブロック（カード表示） | MCP browser-verify | 1-2 |
| Live2D キャラブロック（プロパティ） | MCP browser-verify | 1 |
| パーティクルブロック（カード表示） | MCP browser-verify | 1 |
| 色調補正ブロック（スライダー） | MCP browser-verify | 1 |
| フィルター選択UI（53種カテゴリ） | MCP browser-verify | 1-2 |
| filter_mix 重ね掛け設定 | MCP browser-verify | 1 |

合計 7-9 枚。既存のフィルターギャラリー（53枚）は `screenshots/filters/` に撮影済み。

## スクリーンショット撮影方法

前回のガイド画像は **Playwright Docs Capture** で撮影されている。

### 3つの撮影方法

| 方法 | 仕組み | 保存先 | 用途 |
|------|--------|--------|------|
| **Playwright Docs Capture** | `capture-block-guide.spec.ts` 等を実行 | `apps/next/public/images/{guide}/` | ガイド用画像（バナー+マーカー付き） |
| Block Coverage Press | `rec-*.spec.ts` 連番スクショ | `screenshots/press-*/` | テストフロー記録用 |
| MCP Browser Verify | Claude Code セッション内 | `docs/09_reports/` | アドホック確認用 |

### 既存の撮影スクリプト

| ファイル | 出力先 | 枚数 |
|---------|--------|------|
| `tests/local/docs/capture-block-guide.spec.ts` | `apps/next/public/images/block-guide/` | 18枚 |
| `tests/local/docs/capture-block-guide-2.spec.ts` | 同上 | 9枚（choice, if, set_var 等） |
| `tests/local/docs/capture-timeline-guide.spec.ts` | `apps/next/public/images/timeline-guide/` | 6枚 |

### 撮影の仕組み

- 画像は `apps/next/public/images/{guide}/` に配置
- Markdown では `/images/block-guide/01-editor-overview.png` で参照
- 自動でタイトルバナー（黒帯+白文字）と赤丸マーカー（「ここ」）を注入
- メタデータは `manifest.json` に記録（id, title, description, selector, tags, viewport）
- ビューポート: 1280×800 固定
- 認証: admin アカウントでログイン

### 新規撮影の計画

`capture-block-guide-3.spec.ts` を新規作成して以下を撮影:

| 対象 | 枚数 | 備考 |
|------|------|------|
| Live2D キャラブロック（カード + プロパティ） | 2-3 | Hiyori モデル使用 |
| パーティクルブロック（カード + 設定） | 1-2 | |
| 色調補正ブロック（スライダー UI） | 1 | |
| フィルター選択 UI（53種カテゴリ表示） | 1-2 | |
| filter_mix 重ね掛け設定 | 1 | |

撮影後に `block-guide.md` と `editor-guide.md` を更新。

## 注意事項

- ガイドは `docs/landing/` に配置（ランディングページ向け）
- 技術用語は最小限にし、読者（開発者でない小説作者）に伝わる言葉を使う
- スクリーンショットは実際のエディタ画面から撮影（モックアップ不可）
- Live2D は Hiyori テストモデルで撮影可能（リポジトリに追加済み）
