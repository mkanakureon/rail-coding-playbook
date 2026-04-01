# kaedevn テストファイル一覧

## 1. E2E / 結合テスト (Root `tests/`, `e2e/`)
Playwrightを使用した、主にフロントエンドとバックエンドを跨ぐシナリオテスト。

- `tests/full-flow.spec.ts`: 全体的な基本フローの検証。
- `tests/auth-flow.spec.ts`: 認証フローの検証。
- `tests/editor-blocks.spec.ts`: エディタの各ブロック操作。
- `tests/battle-play.spec.ts`: バトル画面の実行。
- `tests/ovl-preview.spec.ts`: オーバーレイ（OVL）のプレビュー検証。
- `tests/timeline-block-real.spec.ts`: タイムラインブロックの実際的な動作。
- `tests/azure-full-flow.spec.ts`: Azure環境を想定したフルフロー。
- `e2e/ksc-demo.spec.ts`: KSCデモ画面の検証。
- (他、多数の特定機能向け .spec.ts ファイル)

## 2. パッケージ・ユニットテスト (`packages/*/test/`)
各共有ライブラリのロジックを検証する Vitest テスト。

- **`packages/interpreter`**: KNFインタープリタの各フェーズ（Phase2〜Phase6）およびパーサー、デバッグ機能のテスト。
- **`packages/compiler`**: KSコンパイラのトークナイザ、コマンド分類、バリデーション等のテスト。
- **`packages/ksc-compiler`**: KSCコンパイラのレキシカル解析、パース、VM実行等のテスト。
- **`packages/core`**: セーブデータ管理、OpRunnerのディスパッチテスト。
- **`packages/battle`**: ダメージ計算、乱数、バトルシミュレーションのテスト。
- **`packages/web`**: インベントリ、フラグシステム、KscRunnerの結合テスト。
- **`packages/ai-gateway`**: モックおよびファクトリのテスト。

## 3. アプリケーション・テスト (`apps/*/test/`)
各アプリケーション固有のロジックやAPIのエンドポイントテスト。

- **`apps/hono`**: 
  - `test/auth.test.ts`: 認証API。
  - `test/projects.test.ts`: プロジェクト管理API。
  - `test/preview.test.ts`: プレビューデータ生成API。
  - `test/assist-*`: AIアシスト（RAG, CLI等）関連の広範なテスト。
- **`apps/editor`**:
  - `test/store.test.ts`: Zustandストアのロジックテスト。
  - `test/api-config.test.ts`: API設定のテスト。
- **`apps/next`**: 
  - `lib/id.test.ts`: ID生成等のユーティリティテスト。

## 4. 特殊テスト・テンプレート
- `.claude/skills/playwright-e2e-test/`: AIエージェント用のテスト生成テンプレート。
- `./test-mobile-ui.spec.ts`: ルート直下にある（おそらく一時的な）モバイルUI検証用。
