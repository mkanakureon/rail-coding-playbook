# 92-GENRE_TYPESCRIPT_SPEC

## 1. ジャンルの型定義 (Genre Type Definition)

```typescript
export type ScenarioGenre = 
  | 'comedy'        // コメディ
  | 'fantasy'       // ファンタジー
  | 'horror'        // ホラー
  | 'longstory'     // 長編
  | 'mystery'       // ミステリー
  | 'romance'       // 恋愛
  | 'slice-of-life'  // 日常
  | 'chinese-short-drama'; // 中国短尺ドラマ：格差、暴露、復讐
```

---

## 2. 各ジャンルの詳細仕様

### 2.7 Chinese Short Drama (中国短尺ドラマ)
- **ID接頭辞**: `zh_`
- **生成ロジック**:
  - 主人公の『真の正体』を段階的に示唆しつつ、中盤までは徹底的な屈辱描写を行う。
  - セリフから一切の無駄を省き、感情の爆発（怒号、冷笑）に全トークンを集中させる。
  - 物理的衝撃音（[se: slap] 等）をプロットの転換点に配置する。
