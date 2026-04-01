# 背景遷移（bg vs bg_new）の具体例と動作解説

## 1. なぜ2つの「枠」が必要なのか？
背景を切り替えるとき、古い背景を消してから新しい背景を出すと、一瞬 **「真っ暗な画面」** が見えてしまいます。これを防ぎ、重なり合いながら滑らかに変化させるために、エンジンは2つのスプライト枠を使用します。

- **`bg`**: 現在、画面に表示されている「主役」の背景。
- **`bg_new`**: これから現れる「次」の背景。

## 2. 動作のステップ（クロスフェードの例）

「教室」から「放課後の教室」へ500ミリ秒でフェードする場合の内部処理です。

### ステップ1：準備
- 画面には **`bg` (教室)** が 100% で表示されています。

### ステップ2：新背景の生成（bg_new の登場）
- エンジンは **`bg_new` (夕方の教室)** を読み込み、透明度 0% で作成します。
- このとき、`bg` の上に `bg_new` が重なっている状態になります。

```typescript
// 内部コードのイメージ
await this.show("bg_new", "afternoon_room_path", 0, 0);
const newSprite = this.sprites.get("bg_new");
newSprite.alpha = 0; // まだ見えない
```

### ステップ3：アニメーション実行
- 500ミリ秒かけて、2つの透明度を同時に操作します。
- **`bg`**: 100% → 0% （だんだん消える）
- **`bg_new`**: 0% → 100% （だんだん現れる）

### ステップ4：主役の交代
- アニメーションが終わると、古い **`bg` (教室)** は完全に不要になるので消去します。
- そして、今まで **`bg_new`** と呼んでいたものを、これからは **`bg`**（主役）として扱うように名前を付け替えます。

```typescript
// 完了後の処理
this.removeSprite("bg"); // 古い方を消す
this.sprites.delete("bg_new");
this.sprites.set("bg", newSprite); // 新しい方を "bg" という名前に昇格させる
```

## 3. 具体的なコード例（WebOpHandler.ts より抜粋）

背景設定コマンド `@bg room_night fade 500` が実行された時の実際のロジックです。

```typescript
async bgSet(id: string, fadeMs: number) {
  const oldSprite = this.sprites.get("bg"); // 今の背景

  if (fadeMs > 0 && oldSprite) {
    // 【遷移モード】
    // 1. 新しい背景を "bg_new" という名前で読み込む
    await this.show("bg_new", assetPath, 0, 0);
    const newSprite = this.sprites.get("bg_new")!;
    
    // 2. 重なりながらフェード
    newSprite.alpha = 0;
    await Promise.all([
      fadeTo(newSprite, 1, fadeMs), // 新しい方を出す
      fadeTo(oldSprite, 0, fadeMs)  // 古い方を消す
    ]);

    // 3. 後片付け
    this.removeSprite("bg");
    this.sprites.set("bg", newSprite); // bg_new を bg に改名
  } else {
    // 【即時切り替えモード】
    this.removeSprite("bg");
    await this.show("bg", assetPath, 0, 0);
  }
}
```

## 4. スライド遷移の例
`slide_left`（左へ流れる）の場合も原理は同じです。
- **`bg`**: 中央(0) → 左端(-1280) へ移動。
- **`bg_new`**: 右端(1280) → 中央(0) へ移動。
- 最後に `bg_new` を `bg` に改名して完了。

## 結論
`bg_new` は、**「アニメーションの最中にだけ存在する、幽霊のような作業用スプライト」** です。これがあるおかげで、ユーザーは背景が途切れることなく、映画のような滑らかな画面遷移を楽しむことができます。
