# キャラクター表情遷移システム（ch_new）の提案と仕様案

## 1. 導入の背景
現在、`chSet` 命令でキャラクターの表情を変更すると、内部的には「古いスプライトを削除」してから「新しいスプライトを表示」しています。
この方式では、フェード時間を指定しても、**キャラクターが一度消えてから再び現れる**という動きになり、同一人物の表情変化としては不自然です。

背景（bg）における `bg_new` と同様の仕組みをキャラクターにも導入することで、立ち位置を維持したまま、表情だけを滑らかにクロスフェードさせることが可能になります。

## 2. 実装のコンセプト：IDベースの作業用スプライト
キャラクターは画面上に複数存在し得るため、単純な `ch_new` ではなく、キャラクター名を接頭辞にした作業用IDを使用します。

- **`{name}`**: 現在表示されている表情。
- **`{name}_new`**: 次に表示される新しい表情。

## 3. 表情切り替えのフロー（例：hero の表情変更）

1. **新ポーズの読み込み**: `hero_new` というIDで、新しい表情画像を読み込む。
2. **配置**: `hero` (旧) と全く同じ座標、同じスケールで `hero_new` を重ねる。
3. **隠蔽**: `hero_new.alpha = 0` に設定。
4. **クロスフェード**:
   - `hero` (旧): 1.0 → 0.0
   - `hero_new` (新): 0.0 → 1.0
5. **交代**:
   - `hero` (旧) を削除。
   - `hero_new` (新) を `hero` に改名して管理マップを更新。

## 4. WebOpHandler.ts での具体的な対応案

`chSet` メソッドを以下のように拡張することを提案します。

```typescript
async chSet(name: string, pose: string, pos: string, fadeMs: number) {
  const oldSprite = this.sprites.get(name);
  const newId = `${name}_new`;

  if (fadeMs > 0 && oldSprite) {
    // 1. 作業用IDで新しい表情を表示
    await this.show(newId, newAssetPath, posX, posY);
    const newSprite = this.sprites.get(newId)!;
    
    // 2. 重なりながらフェード（キャラが消えない）
    newSprite.alpha = 0;
    await Promise.all([
      fadeTo(newSprite, 1, fadeMs),
      fadeTo(oldSprite, 0, fadeMs)
    ]);

    // 3. 後片付けと昇格
    this.removeSprite(name);
    this.sprites.delete(newId);
    this.sprites.set(name, newSprite);
  } else {
    // 即時切り替え
    this.removeSprite(name);
    await this.show(name, newAssetPath, posX, posY);
  }
}
```

## 5. 背景遷移（bg_new）との共通点と相違点

| 特徴 | 背景 (bg_new) | キャラクター (ch_new) |
| :--- | :--- | :--- |
| **同時存在数** | 常に1組のみ | キャラクターごとに発生 |
| **レイヤー** | backgroundLayer | characterLayer |
| **アンカー点** | 左上 (0, 0) | 中央下 (0.5, 1.0) |
| **目的** | 画面全体の雰囲気変更 | キャラクターの感情変化の演出 |

## 結論
`ch_new` 方式の導入により、「笑いながら少しずつ悲しい顔になる」といった繊細な感情表現が可能になります。これはビジュアルノベルの演出クオリティを左右する重要な要素であり、`bg_new` と一貫した設計思想で実装することで、エンジン全体のメンテナンス性も向上します。
