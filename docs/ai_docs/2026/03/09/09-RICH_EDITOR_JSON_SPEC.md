# 仕様書：拡張版 Rich Editor-JSON (AI 出力用マスターデータ)

## 1. 目的
Gemini から出力される JSON に、エディタが必要とする最小限のデータ以上の「演出メタ情報」を付加する。これにより、将来的な自動演出（カメラワーク、ボイス合成、画像生成、SE配置）の精度を最大化する。

## 2. 構造定義

### A. 全体メタデータ
`manifest.json` にプロジェクト全体の状況を記述する。
- `themeTone`: 章ごとの全体的なトーン（例：「絶望感」「期待」）。
- `suggestedBgm`: AI が推奨する BGM の雰囲気。

### B. text ブロック (type: "text")
| フィールド | 型 | 内容 | 理由 |
| :--- | :--- | :--- | :--- |
| `body` | string | 46文字×3行以内の本文 | エディタ表示用（必須） |
| `speaker` | string | 発言者の slug。地の文は `null` | Markdown出力、ボイス合成用 |
| `isThought` | bool | 心の声（モノローグ）なら `true` | フォント変更、演出用 |
| `emotion` | string | 喜び、怒り、哀しみ、驚き等の感情名 | 表情アセット選択用 |
| `tone` | string | 「震える声」「叫び」「囁き」等の詳細 | 演出、ボイス合成用 |
| `wait` | int | 読了後に推奨される待ち時間 (ms) | 自動進行のテンポ調整用 |

### C. bg ブロック (type: "bg")
| フィールド | 型 | 内容 | 理由 |
| :--- | :--- | :--- | :--- |
| `assetId` | string | 背景 ID | エディタ表示用（必須） |
| `timeContext` | string | 早朝、昼、夕暮れ、夜、深夜等 | 画像生成（Nano Banana）用 |
| `weather` | string | 晴れ、曇り、雨、雪、霧等 | 環境音、エフェクト自動配置 |
| `cameraAngle` | string | アップ、引き、俯瞰、煽り、斜め | 背景の構図、画像生成用 |

### D. ch ブロック (type: "ch")
| フィールド | 型 | 内容 | 理由 |
| :--- | :--- | :--- | :--- |
| `characterId`| string | キャラクター ID | エディタ表示用（必須） |
| `expressionId`| string | 表情 ID（現状 normal 固定） | エディタ表示用（必須） |
| `emotionDetail`| string | 「微かな微笑み」「見下すような視線」 | 画像生成、演出用 |
| `action` | string | 頷く、驚く、背を向ける等の動作 | アニメーション演出用 |

## 3. 運用フロー
1. **生成 (Stage 4)**: Gemini がこの Rich 仕様に従って詳細な JSON を出力する。
2. **変換 (Export)**: `exportChapterToMd` はこの詳細情報を活用して、属性豊かな Markdown を出力する。
3. **投入 (Upload)**: エディタへ投入する直前に、不要な詳細フィールドを削り「Lite 版 JSON」に変換するスクリプトを介す。

---
*本仕様は docs/10_ai_docs/2026/03/09/ の 01〜08 を拡張するものである。*
