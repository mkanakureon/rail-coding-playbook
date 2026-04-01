# kaedevn エンジン OSS 公開計画

> 作成日: 2026-02-24
> ステータス: 計画策定

---

## 1. 方針

### 公開対象

| パッケージ | 公開 | 理由 |
|---|---|---|
| `@kaedevn/core` | **OSS (MIT)** | プラットフォーム非依存の基盤型定義・ランタイム（OpRunner インタプリタ） |
| `@kaedevn/compiler` | 非公開（将来検討） | .ks → Op 変換パイプライン。安定後に公開検討 |
| `@kaedevn/player` | 非公開（将来検討） | PixiJS ベースプレイヤー |
| `@kaedevn/interpreter` | 非公開 | 旧方式 (.ksc 直接実行)。正規パスは compiler → OpRunner に移行済み |
| `@kaedevn/web` | 非公開 | エディタ統合・ビジネスロジック含む |
| `@kaedevn/battle` | 非公開（将来検討） | 自己完結型。別途公開を検討可能 |
| `@kaedevn/ksc-compiler` | 非公開（将来検討） | KSC VM。安定後に検討 |
| `apps/*` | 非公開 | 秘密情報・ビジネスロジック・インフラ設定を含む |
| `tools/*` | 非公開 | 内部ツール |

### ライセンス

MIT — 全公開パッケージに `LICENSE` ファイル設定済み（Copyright (c) 2026 kaedevn）。

---

## 2. パッケージ現状

| 項目 | @kaedevn/core |
|---|---|
| **バージョン** | 0.1.0 |
| **ライセンス** | MIT |
| **依存関係** | なし（devDependencies のみ） |
| **テスト** | 69 tests / 4 files |
| **完成度** (CODE_REVIEW) | 90% |
| **module type** | ESM (`"type": "module"`) |
| **出力** | `dist/index.js` + `dist/index.d.ts` |
| **repository フィールド** | 設定済み |
| **homepage フィールド** | 設定済み |
| **bugs フィールド** | 設定済み |
| **README** | 整備済み（Timeline/Event API セクション含む） |
| **CHANGELOG** | 整備済み |
| **ハードコード URL / 秘密情報** | なし（確認済み） |

---

## 3. 公開範囲の整理

### @kaedevn/core — エクスポート一覧

**型定義:**
- `Op`, `CompiledScenario`, `ChAnimParams` — ランタイム命令セット
- `SaveData` — セーブデータスキーマ
- `Action` — 入力アクション enum
- `ProjectConfig` — プロジェクト設定

**インターフェース:**
- `IInput` — 入力抽象化
- `IAudio`, `AudioCategory` — オーディオ抽象化
- `IStorage` — ストレージ抽象化
- `IOpHandler` — Op 実行ハンドラ

**エンジン:**
- `OpRunner` — Op 命令列の実行エンジン（変数管理、ジャンプ、選択肢、既読管理）

**レイアウト定数:**
- `VIRTUAL_WIDTH` (1280), `VIRTUAL_HEIGHT` (720)
- `SAFE_AREA_RATIO`, `SAFE_AREA_X`, `SAFE_AREA_Y`

**タイムライン v1.1:**
- 型: `TimelineRoot`, `Track`, `Clip`, `Channel`, `Keyframe`, `EvaluationResult` 他
- 関数: `evaluateTimeline`, `validateTimeline`, `formatValidationResult`
- イージング: `applyEasing`, `linear`, `easeIn`, `easeOut`, `easeInOut` 他 12 関数

**イベントタイムライン:**
- 型: `EventProject`, `EventTrack`, `TimelineEvent`, `RuntimeEventState` 他
- 関数: `validateEventProject`, `emitEventsBetween`, `seekStateAt`, `pickSeekOneShot`

### 非公開パッケージ（将来検討）

| パッケージ | 現状 | 将来の公開可能性 |
|---|---|---|
| `@kaedevn/compiler` | v0.1.0, MIT, .ks → Op コンパイラ | 高 — 安定後に公開検討 |
| `@kaedevn/player` | v0.1.0, MIT, PixiJS ベースプレイヤー | 高 |
| `@kaedevn/battle` | v0.0.1, MIT, 自己完結型コマンドバトルシステム | 高（外部依存なし） |
| `@kaedevn/interpreter` | 旧方式 (.ksc 直接実行)、非推奨化方針 | 低 |
| `@kaedevn/ksc-compiler` | KSC VM、安定化途上 | 中 |
| `apps/*` | 秘密情報・ビジネスロジック含む | 非公開維持 |

---

## 4. 公開前チェックリスト

### セキュリティ

- [x] ソースコードにハードコード URL がないこと（core: 0 件, compiler: 0 件）
- [x] ソースコードに秘密情報（password, secret, api_key）がないこと（確認済み: クリーン）
- [x] `.npmignore` または `"files"` フィールドで不要ファイルが除外されていること
  - core: `"files": ["dist"]` — OK

### パッケージメタデータ

- [x] `repository` フィールド追加（core）
- [x] `homepage` フィールド追加
- [x] `bugs` フィールド追加
- [x] `author` フィールド追加

### ドキュメント

- [x] core README.md — 整備済み（Timeline/Event API セクション含む）
- [x] CHANGELOG.md 作成（core）
- [x] CONTRIBUTING.md 作成
- [x] SECURITY.md 作成（脆弱性報告先）

### バージョン整理

- [x] core: `0.0.1` → `0.1.0` に更新済み

### テスト

- [x] core の全テスト通過確認（69 tests）
- [x] `npm publish --dry-run` で問題がないこと（core）

### ビルド

- [x] `npm run build` がクリーンに完了すること
- [ ] 出力される `.d.ts` に内部型が漏れていないこと

---

## 5. リポジトリ戦略 — 別リポジトリに分離（確定）

### 理由

- `apps/` に秘密情報（DB 接続文字列、認証情報）およびビジネスロジックが存在
- monorepo のまま公開すると git 履歴から情報漏洩のリスクがある
- 公開パッケージ（core）は依存関係が自己完結している

### 既存 OSS リポジトリ（準備済み）

**場所**: `/Users/kentaromukunasi/Documents/git/kaedevn`

既に以下の状態で準備されている:

- `packages/core` — ソースコピー済み、ビルド済み
- ルート `package.json` — workspace 設定済み
- MIT LICENSE、README.md、CONTRIBUTING.md、SECURITY.md 整備済み
- CHANGELOG.md 作成済み
- package.json メタデータ (repository, homepage, bugs, author) 設定済み
- `npm install` + `npm run build` + `npm test` 実行済み
- `npm publish --dry-run` 確認済み
- コンソールデモ (`examples/console-demo.ts`) 追加済み

**未完了**:
- 初回 git commit 未実行（ステージング済みファイルあり）
- GitHub リモート未接続
- GitHub Actions 未設定

### リポジトリ構成（現状）

```
mkanakureon/kaedevn (https://github.com/mkanakureon/kaedevn)
├── packages/
│   └── core/          ← ソースコピー済み、ビルド済み、README/CHANGELOG 整備済み
├── examples/
│   └── console-demo.ts
├── package.json       (workspace root, repository 設定済み)
├── tsconfig.base.json
├── .gitignore
├── LICENSE            (MIT)
├── README.md
├── CONTRIBUTING.md
└── SECURITY.md
```

### 残作業

1. GitHub に `mkanakureon/kaedevn` リポジトリを作成（public）
2. 初回 git commit + push
3. `.github/workflows/publish.yml` 追加
4. monorepo 側を npm パッケージ参照に切り替え

---

## 6. npm 公開手順

### 準備

1. npm org `@kaedevn` を作成（https://www.npmjs.com/org/create）
2. org メンバーの管理設定

### 初回公開

```bash
cd packages/core
npm publish --access public
```

### CI ワークフロー（GitHub Actions）

```yaml
# .github/workflows/publish.yml
name: Publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npx -w packages/core npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### バージョニング

- semver 準拠
- tag トリガー: `v0.1.0`, `v0.2.0`, ...

---

## 7. ドキュメント整備計画

### core README — 全セクション整備済み

| セクション | 内容 | 現状 |
|---|---|---|
| Overview | パッケージ概要 | 整備済み |
| Install | `npm install @kaedevn/core` | 整備済み |
| Key Types | Op, CompiledScenario, SaveData | 整備済み |
| IOpHandler | プラットフォーム実装インターフェース | 整備済み |
| OpRunner | 使い方とサンプル | 整備済み |
| Timeline API | evaluateTimeline, validateTimeline | 整備済み |
| Event Timeline API | emitEventsBetween, seekStateAt | 整備済み |
| Layout Constants | VIRTUAL_WIDTH/HEIGHT, SAFE_AREA | 整備済み |
| License | MIT | 整備済み |

### 作成済みドキュメント

| ファイル | 内容 | 状態 |
|---|---|---|
| `README.md` | プロジェクト全体概要、クイックスタート、デモ説明 | 整備済み |
| `CONTRIBUTING.md` | 開発環境セットアップ、PR ルール、コーディング規約 | 整備済み |
| `SECURITY.md` | 脆弱性報告先（GitHub Security Advisory） | 整備済み |
| `packages/core/CHANGELOG.md` | 0.1.0 初回リリースの変更履歴 | 整備済み |
| `packages/core/README.md` | core パッケージ API リファレンス | 整備済み |

---

## 8. 今後のロードマップ

### Phase 1: 文書整備 + チェックリスト消化 — **完了**

| タスク | 状態 |
|---|---|
| package.json メタデータ追加 (repository, homepage, bugs, author) | 完了 |
| core バージョン 0.0.1 → 0.1.0 | 完了 |
| core README: Timeline / Event API セクション追加 | 完了 |
| CHANGELOG.md 作成 (core) | 完了 |
| CONTRIBUTING.md 作成 | 完了 |
| SECURITY.md 作成 | 完了 |
| ルート README.md 拡充 | 完了 |
| npm run build 通過 | 完了 |
| npm test 通過 (core: 69 tests) | 完了 |
| npm publish --dry-run 確認 | 完了 |

### Phase 2: GitHub リポジトリ作成 + 初回 npm publish

| タスク | 優先度 |
|---|---|
| 初回 git commit（ステージング済み） | 高 |
| GitHub リポジトリ `mkanakureon/kaedevn` 作成（public） | 高 |
| git remote 追加 + push | 高 |
| GitHub Actions publish ワークフロー設定 | 高 |
| npm org `@kaedevn` 作成 | 高 |
| 初回 `npm publish --access public` | 高 |

### Phase 3: 追加パッケージの公開検討

| パッケージ | 前提条件 | 時期 |
|---|---|---|
| `@kaedevn/compiler` | API 安定確認、セキュリティ確認 | Phase 2 完了後 |
| `@kaedevn/player` | ソース整理、README 作成 | Phase 2 完了後 |
| `@kaedevn/battle` | API 安定化、テスト整備 | Phase 2 完了後 |

---

## 付録 A: 依存関係図

```
@kaedevn/core (0.1.0)        ← 外部依存なし（OSS 公開対象）
```

公開パッケージの外部依存はゼロ。純粋な TypeScript パッケージ。

---

## 付録 B: 関連文書

### パッケージ現状確認

| 文書 | 内容 |
|---|---|
| `docs/CODE_REVIEW_2026-02-17.md` | パッケージ完成度レビュー（core: 90%） |
| `docs/09_reports/2026/02/24/02-interpreter-implementation-report.md` | インタプリタ実装報告書 |
| `packages/core/package.json` | パッケージメタデータ |
| `packages/core/README.md` | core 現状ドキュメント |
| `packages/core/src/index.ts` | エクスポート一覧 |
| `packages/core/LICENSE` | MIT ライセンス |

### OSS リポジトリ

| 場所 | 内容 |
|---|---|
| `/Users/kentaromukunasi/Documents/git/kaedevn` | OSS 公開用リポジトリ（ローカル） |
| `https://github.com/mkanakureon/kaedevn` | GitHub リポジトリ URL（予定） |
