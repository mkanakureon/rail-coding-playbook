# 仕様書：動的なモデル設定と優先順位ルール

## 1. 目的
Gemini の頻繁なモデルアップデートや、プロジェクトごとのコスト・品質要件に柔軟に対応するため、モデル ID を外部から動的に注入・制御できる仕組みを定義する。

## 2. 設定の優先順位 (Settings Hierarchy)

モデル ID は以下の順位で解決される。上にあるものが優先される。

1. **CLI 引数**: `--model-pro`, `--model-flash`, `--model-lite`
2. **環境変数**: `ASSIST_MODEL_PRO`, `ASSIST_MODEL_FLASH`, `ASSIST_MODEL_LITE`
3. **プロジェクト個別 Config**: `scripts/cli/configs/{genre}.json` 内の `models` フィールド
4. **共通モデル設定**: `scripts/cli/configs/models.json`
5. **コード内デフォルト**: `gemini-2.5-flash` シリーズ

## 3. 設定ファイル形式 (JSON Spec)

### A. 個別 Config への組み込み例
```json
{
  "projectTitlePrefix": "ファンタジー",
  "models": {
    "pro": "gemini-2.5-pro",
    "flash": "gemini-2.5-flash",
    "lite": "gemini-2.5-flash-lite"
  },
  "bgSlugs": ["bg_field", "..."]
}
```

### B. 共通モデル設定 (`scripts/cli/configs/models.json`)
```json
{
  "version": "2026-03-09",
  "default_set": {
    "pro": "gemini-2.5-pro",
    "flash": "gemini-2.5-flash",
    "lite": "gemini-2.5-flash-lite"
  }
}
```

## 4. CLI 引数仕様

| オプション | 対象工程 | 説明 |
| :--- | :--- | :--- |
| `--model-pro` | S0, S1, S2, S4 | 推論能力を必要とする工程のモデルを指定。 |
| `--model-flash` | デフォルト | 標準工程（またはフォールバック）のモデルを指定。 |
| `--model-lite` | S3, 要約 | 大量生成・コスト優先工程のモデルを指定。 |

## 5. 運用のメリット
- **デバッグ**: `--model-pro gemini-2.0-pro-exp` のように、特定のモデルでの挙動を即座にテストできる。
- **保守性**: `models.json` を更新するだけで、全プロジェクトのベースラインを最新世代へ移行できる。
- **SaaS 適性**: ユーザープラン（無料版/有料版）に応じてモデルを外部から切り替える基盤となる。

---
*本仕様は docs/10_ai_docs/2026/03/09/ の設計群を補完し、将来的な拡張性を担保するものである。*
