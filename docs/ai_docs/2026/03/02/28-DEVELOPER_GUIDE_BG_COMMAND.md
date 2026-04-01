# エンジン開発者のための背景コマンド実装ガイド（bg / bg_new）

## 1. はじめに
新しい背景演出（例：ズームしながら切り替わる等）を作りたい場合、エンジン開発者は `WebOpHandler.ts` 内の `bgSet` メソッドを拡張します。

ここでの鉄則は、**「新しく出す画像は一度 `bg_new` という名前で準備し、アニメーションが終わってから `bg` に昇格させる」**ことです。

## 2. 実装の3ステップ

### ステップ1：今の背景を取得する
まず、現在表示されている背景があるか確認します。

```typescript
const oldSprite = this.sprites.get("bg");
```

### ステップ2：新しい背景を `bg_new` として読み込む
次に、新しい画像を読み込み、初期状態（透明度や位置）を設定します。

```typescript
// ID "bg_new" で画面に生成（この時点ではまだ characterLayer に混じらないよう注意）
await this.show("bg_new", assetPath, 0, 0);
const newSprite = this.sprites.get("bg_new")!;

// 初期状態を設定（例：フェードなら透明度0）
newSprite.alpha = 0;
```

### ステップ3：アニメーションさせて、最後に名前を付け替える
新旧2つのスプライトを同時に動かし、完了後に古い方を消して名前を整理します。

```typescript
// 同時に動かす
await Promise.all([
  fadeTo(newSprite, 1, 500), // 新しい方を出す
  fadeTo(oldSprite, 0, 500)  // 古い方を消す
]);

// --- 完了後の後片付け（重要！） ---
this.removeSprite("bg");           // 古い方を完全に削除
this.sprites.delete("bg_new");     // 管理マップから "bg_new" という名前を消す
this.sprites.set("bg", newSprite); // 新しいスプライトを改めて "bg" として登録
```

## 3. 応用：ズームイン切り替えの実装例
少し特殊な演出（新しい背景がズームしながら現れる）を作りたい場合の例です。

```typescript
// 1. 準備
await this.show("bg_new", assetPath, 0, 0);
const newSprite = this.sprites.get("bg_new")!;

// 2. 初期状態：少し小さくて透明
newSprite.scale.set(0.8);
newSprite.alpha = 0;

// 3. アニメーション
await Promise.all([
  fadeTo(newSprite, 1, 800),
  lerpScale(newSprite, 1.0, 800), // だんだん大きく
  fadeTo(oldSprite, 0, 800)
]);

// 4. 名前を入れ替えて「主役」にする
this.removeSprite("bg");
this.sprites.delete("bg_new");
this.sprites.set("bg", newSprite);
```

## 4. なぜこの手順（改名）が必要なのか？
もし `bg_new` を `bg` に改名せずに放置すると、**次の背景切り替えコマンド**が実行されたときに、`this.sprites.get("bg")` で「今の背景」が正しく取得できず、古い背景が画面に残ってしまうからです。

## 結論
1. **`bg_new`** で作り、
2. **`bg`** と一緒に動かし、
3. 最後に **`bg_new` を `bg` に書き換える。**

この 3 ステップを守るだけで、どんなに複雑な背景演出も安全に実装できます。
