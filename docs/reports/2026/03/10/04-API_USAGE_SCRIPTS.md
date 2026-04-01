# Gemini API 利用スクリプト管理台帳 (2026-03-10)

## 概要
本プロジェクトの AI ワークフローは Gemini API (Google AI Studio) に依存しています。
動作には `apps/hono/.env` 内の `GOOGLE_API_KEY` が必要です。

## スクリプト一覧

### 1. 制作・生成系
| ファイルパス | コマンド例 | 内容 |
|:---|:---|:---|
| `scripts/cli/ai/assist-cli.ts` | `all`, `stage0`~`stage4` | 骨格生成からゲーム用スクリプト変換までの全工程を担当。 |

### 2. 企画・レビュー系
| ファイルパス | コマンド例 | 内容 |
|:---|:---|:---|
| `scripts/cli/ai/upstream-cli.ts` | `review-idea`, `review-settings`, `review-prompt` | 企画構想、作品設定、AIプロンプト案の自動添削。 |

### 3. データ整備系 (Vision)
| ファイルパス | コマンド例 | 内容 |
|:---|:---|:---|
| `scripts/db/analyze-all-assets.mjs` | (直接実行) | 全公式アセットの画像を解析し、DB(official_assets)を更新。 |
| `scripts/db/apply-vision-metadata.mjs` | (直接実行) | 保存済みJSONからDBへメタデータを反映。 |

### 4. 診断・テスト系
| ファイルパス | 内容 |
|:---|:---|
| `scripts/list-available-models.mjs` | 利用可能なモデル（2.5 Pro/Flash等）の確認。 |
| `scripts/test-models.mjs` | 特定モデルの動作疎通テスト。 |
| `scripts/check-pro-model.mjs` | Proモデルの有効性確認。 |

## コスト・パフォーマンス管理の指針
- **高品質が必要な場合** (`upstream-cli`, `analyze-all-assets`): `gemini-2.5-pro` を使用。
- **量産・速度重視の場合** (`assist-cli`): `gemini-2.5-flash` を使用。
- **デバッグ時**: `assist-cli` の `--mock` オプションを使用することで、APIを消費せずにロジック確認が可能。
