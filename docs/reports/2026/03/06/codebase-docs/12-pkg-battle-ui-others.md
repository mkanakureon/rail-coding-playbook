# packages/battle, ui, tools, vscode-ks-ksc

## packages/battle - コマンドバトルシステム

### 概要

ターン制バトルシステム。ダメージ計算、ステータスエフェクト、AI、勝敗判定を提供する。

### ディレクトリ構成

```
packages/battle/
├── src/
│   ├── core/
│   │   ├── types.ts          # バトルデータ構造 (300+行)
│   │   ├── damage.ts         # ダメージ計算式
│   │   ├── rng.ts            # シード付き乱数生成
│   │   ├── applyAction.ts    # アクション適用
│   │   ├── victory.ts        # 勝敗判定
│   │   └── simulate.ts       # バトルシミュレーション
│   ├── ai/
│   │   └── simpleAi.ts       # 基本 AI 戦略
│   ├── data/
│   │   ├── skills.ts         # スキル定義
│   │   └── troops.ts         # 敵グループ構成
│   └── index.ts              # 公開 API (24行)
├── __tests__/
│   ├── damage.test.ts
│   ├── rng.test.ts
│   └── simulate.test.ts
├── package.json
└── vitest.config.ts
```

### 主要型

```typescript
interface BattleState {
  actors: ActorState[];        // 味方パーティ
  enemies: EnemyState[];       // 敵パーティ
  turn: number;
  phase: 'player' | 'enemy' | 'result';
}

interface ActorState {
  id: string;
  name: string;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  atk: number; def: number;
  skills: string[];
  statuses: StatusEffect[];
}

interface SkillDef {
  id: string;
  name: string;
  type: 'attack' | 'heal' | 'buff' | 'debuff';
  power: number;
  mpCost: number;
  target: 'single' | 'all';
}
```

### 主要関数

| 関数 | 説明 |
|------|------|
| `simulate(state, actions)` | バトル全体をシミュレート |
| `applyAction(state, action)` | 1アクション適用 |
| `calcDamage(attacker, defender, skill)` | ダメージ計算 |
| `checkVictory(state)` | 勝敗判定 (win/lose/escape/ongoing) |
| `simpleAi(enemies, actors)` | AI のアクション選択 |

### 依存関係
- 内部: なし
- 被依存: `packages/web` (バトルシーン描画)

---

## packages/ui - 共有デザインシステム

### 概要

React + Tailwind CSS の共有 UI コンポーネントライブラリ。

### ディレクトリ構成

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button.tsx          # ボタン (primary/secondary)
│   │   ├── Card.tsx            # カードコンテナ
│   │   ├── Input.tsx           # テキスト入力
│   │   ├── Modal.tsx           # モーダルダイアログ
│   │   └── index.ts
│   ├── theme/
│   │   └── index.ts            # テーマ定義
│   └── index.ts
├── tailwind.config.js
├── package.json
└── vite.config.ts
```

### コンポーネント

| コンポーネント | 説明 |
|--------------|------|
| Button | primary, secondary バリアント |
| Card | コンテナコンポーネント |
| Input | テキスト入力フィールド |
| Modal | ダイアログ/モーダルオーバーレイ |

### 依存関係
- React 18+, clsx, Tailwind CSS (peer)

---

## packages/tools - アセット処理 CLI ツール

### 概要

動画→PNG 変換、背景除去、WebP 変換などのアセット処理 CLI ツール群。

### ディレクトリ構成

```
packages/tools/
├── src/
│   ├── cli.ts          # メイン CLI エントリ
│   ├── mp4topng.ts     # 動画→PNG フレーム抽出
│   ├── rmbg.ts         # 背景除去
│   └── webp.ts         # WebP 変換
├── package.json
└── tsconfig.json
```

### ツール

| ツール | 説明 | 依存 |
|--------|------|------|
| mp4topng | MP4 → PNG シーケンス | ffmpeg-static, fluent-ffmpeg |
| rmbg | 背景除去 (外部 API) | — |
| webp | 画像 → WebP 変換 | sharp, node-webpmux |

### 依存関係
- `ffmpeg-static` / `fluent-ffmpeg` (動画処理)
- `sharp` (画像処理)
- `archiver` (ZIP 作成)

---

## packages/vscode-ks-ksc - VSCode 拡張

### 概要

.ks (TyranoScript 風) と .ksc (TypeScript 風) スクリプトファイルの VSCode 言語サポート。

### ディレクトリ構成

```
packages/vscode-ks-ksc/
├── syntaxes/
│   ├── ks.tmLanguage.json      # .ks 構文ハイライト
│   └── ksc.tmLanguage.json     # .ksc 構文ハイライト
├── language-configuration/
│   ├── ks.language-configuration.json
│   └── ksc.language-configuration.json
├── snippets/
│   ├── ks.snippets.json        # .ks コードスニペット
│   └── ksc.snippets.json       # .ksc コードスニペット
└── package.json                # VSCode 拡張マニフェスト
```

### 機能

- **構文ハイライト**: .ks と .ksc の TextMate 文法定義
- **言語設定**: ブラケット、コメント、インデントルール
- **コードスニペット**: 頻出パターンの入力補助
- VSCode 1.85+ 対応

### 依存関係
- なし（VSCode 拡張マニフェストのみ）
