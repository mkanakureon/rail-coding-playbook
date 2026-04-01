# BigQuery 分析基盤：分析・予測活用ガイド

## 1. 概要
蓄積されたログデータを使い、プラットフォームの健康状態を確認したり、機械学習（ML）を用いて未来を予測する方法を解説します。

## 2. 基本的な分析（SQLビューの活用）
手動で複雑な計算をしなくても、用意された「ビュー」を参照するだけで主要な指標がわかります。

### A. ユーザーの継続状況を確認する
`v_user_retention` ビューには、ユーザーごとの初回アクセス日、最終アクセス日、活動日数がまとまっています。
```sql
SELECT * FROM `kaedevn_analytics.v_user_retention`
ORDER BY last_seen DESC
```

### B. プロジェクトの熱量を測る
`v_project_stats` ビューには、各プロジェクトでのプレビュー実行回数や更新回数がまとまっています。
```sql
SELECT * FROM `kaedevn_analytics.v_project_stats`
WHERE preview_count > 10
```

## 3. 機械学習による予測 (BigQuery ML)
SQL だけで「このユーザーは明日辞めてしまいそうか？」を予測するモデルを運用します。

### ステップ1：学習（モデル作成）
過去の活動データから「離脱パターン」を学習したモデルを作成します。
```sql
CREATE OR REPLACE MODEL `kaedevn_analytics.churn_prediction_model`
OPTIONS(model_type='logistic_reg', input_label_cols=['is_churned']) AS
SELECT active_days, total_events, 
       IF(DATE_DIFF(CURRENT_DATE(), last_seen, DAY) > 7, 1, 0) as is_churned
FROM `kaedevn_analytics.v_user_retention`
```

### ステップ2：予測（スコアリング）
作成したモデルを使い、全ユーザーの「現在の離脱確率」を算出します。
```sql
SELECT user_id, prob.prob as churn_probability
FROM ML.PREDICT(MODEL `kaedevn_analytics.churn_prediction_model`, 
                (SELECT * FROM `kaedevn_analytics.v_user_retention`)),
     UNNEST(predicted_is_churned_probs) as prob
WHERE prob.label = 1
```

## 4. 運営への活かし方
- **離脱防止**: `churn_probability` が高いユーザーに対し、制作をサポートする通知を送る。
- **ヒット予測**: `preview_count` が急増しているプロジェクトを運営がチェックし、公式 SNS で紹介する。

## 結論
この基盤は、単なる「記録」ではなく、運営者の「目と耳」となり、データに基づいた的確なアクションを可能にします。
