# Playwrightを活用したエディタ操作動画の自動生成計画書

## 1. 概要
Qiita の知見（Playwright による自動操作・録画）を kaedevn に取り込み、エディタの強力な機能（CPC等）を視覚的に伝えるための高品質なデモ動画を自動生成する環境を構築します。

## 2. なぜこの手法が最適なのか
- **再現性**: UIがアップデートされても、スクリプトを再実行するだけで常に最新の状態のデモ動画が手に入ります。
- **高画質・ノイズレス**: 手動録画と違い、マウスの迷いや余計なブラウザのタブ、通知などが一切映り込まない「完璧な操作」を記録できます。
- **多言語対応**: 言語設定を変えて実行するだけで、日本語版・英語版の動画を瞬時に作り分けられます。

## 3. 具体的な実装・活用イメージ

### A. 紹介動画のシナリオ例
1. エディタを開く。
2. 左側の「キャラクター」タブからキャラをドラッグ＆ドロップ。
3. ブロックをクリックして、右下のプレビューが「シュパッ」と切り替わる様子（CPC機能）を見せる。
4. タイムラインを操作してキャラが動く様子を見せる。

### B. 実装コードの構成
既存の `tests/` 内の Playwright 資産を流用し、録画専用のオプションを有効にします。

```typescript
// demo-recorder.spec.ts
import { test } from '@playwright/test';

test('record-cpc-demo', async ({ page }) => {
  // 動画保存を有効化
  // (playwright.config.ts で video: 'on' に設定するだけでも可能)
  
  await page.goto('http://localhost:3000/projects/editor/demo');
  
  // 1. ブロックをクリックする操作（ゆっくり見せる）
  const block = page.locator('[data-block-id="bg-1"]');
  await block.scrollIntoViewIfNeeded();
  await page.mouse.move(block.centerX, block.centerY); // マウスカーソルの動きを見せる
  await block.click();
  
  await page.waitForTimeout(2000); // プレビューの反映を待つ
  
  // 2. 別のブロックをクリック
  await page.locator('[data-block-id="ch-1"]').click();
  await page.waitForTimeout(2000);
});
```

## 4. OSSとしての「成功」への貢献
- **READMEの充実**: 言葉で説明するより、動いているGIF/動画を1枚貼る方が100倍伝わります。
- **チュートリアルの自動化**: 新機能が追加されるたびに、その使い方の動画が自動で更新される仕組みは、OSSとしての信頼性を大きく高めます。

## 5. 次のステップ
1. `playwright.config.ts` に録画用プロジェクト（`demo-recorder`）を追加。
2. 代表的な操作（プロジェクト作成、ブロック追加、CPC体験）のレコーディングスクリプトを作成。
3. 生成された動画を WebP や GIF に変換してドキュメントに配置。

## 結論
「手動で動画を撮る面倒さ」を Playwright で自動化することは、開発効率だけでなく、プロジェクトのマーケティング（成功）において決定的な役割を果たします。kaedevn の「Web技術の優位性」を象徴する取り組みになります。
