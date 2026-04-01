# ファンタジー地の文特化モデル：実行・検証マニュアル

本ドキュメントは、Stage 4 (本文執筆) モデルのファインチューニングを確実に成功させるためのマニュアルである。

## 1. 使用する学習データ（フルパス）
以下のファイルを Google AI Studio または Vertex AI にアップロードすること。
- **Path**: `<PROJECT_ROOT>/docs/10_ai_docs/2026/03/11/ft_fantasy_narrative/20260311_091107/training_data.jsonl`

## 2. 推奨パラメータ
- **Base Model**: Gemini 1.5 Flash (安定性とコストのバランス)
- **Tuned Model Name**: `fantasy-narrative-v1`
- **Epochs**: 5
- **Batch Size**: 4
- **Learning Rate**: 0.001

## 3. チューニング完了後のモデル登録
学習が完了したら、以下のパスにある \`result.md\` に **モデル ID (tunedModels/...)** を追記せよ。
- **Register**: `<PROJECT_ROOT>/docs/10_ai_docs/2026/03/11/ft_fantasy_narrative/20260311_091107/result.md`

## 4. 性能検証（Eval）手順
モデル完成後、\`assist-cli.ts\` を以下の設定で実行し、ベースラインと比較せよ。

### A. ベースライン（比較対象）
- **出力パス**: `<PROJECT_ROOT>/projects/fantasy_generated/output/20260310_204627/P01_S4_ch1_web_novel.txt`

### B. FTモデルによる出力（新規テスト）
\`\`\`bash
# assist-cli.ts の runStage4 内のモデル指定を新モデルIDに書き換えて実行
./scripts/cli/ai/assist-cli.ts all --settings projects/fantasy_generated/settings --max-chapters 1
\`\`\`

## 5. 期待される変化
- 地の文における「形容詞」のバリエーションが30%以上増加。
- 物理的な感触（重さ、熱、硬さ）に関する記述が必ず1シーンに1回以上含まれること。
