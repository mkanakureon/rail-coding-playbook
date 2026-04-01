# 実装詳細：リカバリ戦略に基づくトーン固定化とモデル安定化

リカバリ戦略 (28-RECOVERY_STRATEGY_STABLE_TONE.md) をコードレベルで強制するための具体的な修正内容を定義する。

## 1. モデルの安定化 (apps/hono/src/routes/assist.ts)

プレビュー版（Lite/3.1）によるトーンの不安定さを排除するため、デフォルトモデルを 2.5 系列の安定版に固定する。

```typescript
// resolveModel 関数の Defaults 部分を修正
const defaults = {
  pro: 'gemini-2.5-pro',
  flash: 'gemini-2.5-flash',
  lite: 'gemini-2.5-flash' // gemini-2.5-flash-lite から変更
};
```

## 2. システムプロンプトへの絶対制約注入 (apps/hono/src/lib/assist/prompts.ts)

AIが「ダークファンタジー」や「過剰な装飾」に流れるのを防ぐため、全ステージのシステムプロンプト冒頭に以下の定義を注入する。

```typescript
const RECOVERY_TONE_GUIDE = `
【作品全体の絶対的トーン指針（最優先遵守）】
- トーン: 温かみのある王道冒険もの（素朴な勇気、温かな交流、希望）
- ターゲット: 家族・ライトユーザー（過度な残酷描写、冷笑、エログロ、難解な比喩は厳禁）
- キーワード: 素朴さ、透明感、さわやかな勇気、温もり、小さな発見
- 禁止事項 (NGワード): 瘴気、地脈、侵食、禁忌、死地、捕食者、絶望、背筋に冷たいもの
- 世界観リファレンス:
    - 『ドラゴンクエストIV』（素朴な勇気、温かな交流）
    - 『風ノ旅ビト』（透明感、沈黙の情緒）
- 執筆の掟: 「格好良さ」よりも「心の機微」を。「絶望」よりも「一筋の光」を描け。
`;

// buildStage0Prompt, buildStage1Prompt, buildStage2Prompt, buildStage3Prompt 
// の各 system 文字列の先頭に ${RECOVERY_TONE_GUIDE} を挿入する。
```

## 3. ジャンルルールの王道化 (apps/hono/src/lib/assist/genre-rules/fantasy.yaml)

```yaml
# 追加・更新するルール
descriptionRules:
  - "温かみのある描写。冷たい石造りの城でも、どこかに人の営みや暖炉の火を感じさせること。"
  - "過度なダーク化（死体、血飛沫、絶望的な叫び）を避け、ピンチの時こそ『仲間との絆』や『折れない心』を強調する。"
stage2Rules:
  - "各話の終わりには、ドラクエのレベルアップ音や新しい町に着いた時のような『ワクワクする期待感』を演出する。"
```

## 4. 実行手順

1. `apps/hono/src/routes/assist.ts` のモデルマッピングを修正。
2. `apps/hono/src/lib/assist/prompts.ts` に定数を追加し、各関数を更新。
3. `apps/hono/src/lib/assist/genre-rules/fantasy.yaml` を更新。

---
*上記内容を適用してもよろしいでしょうか？「適用して」との指示をいただければ直ちに実行いたします。*
