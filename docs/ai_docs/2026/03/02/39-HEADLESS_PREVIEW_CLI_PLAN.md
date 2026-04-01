# ヘッドレス・プレビューCLIの実装計画書（最小構成版）

## 1. 目的
Claude Code等のAIエージェントが、現在開発中のシーンの実行結果を「視覚的に確認」できるようにするため、最小限の工数でスクリーンショット取得CLIを実装します。

## 2. 実装のスコープ（今回やること）
複雑な自動化は行わず、以下の単一機能のみを実装します。
- **機能**: 特定のプロジェクトIDとページ番号を指定すると、プレビュー画面を開き、レンダリング完了後に画像を保存する。

## 3. 具体的な実装手順

### Step 1: プレビュー用キャプチャスクリプトの作成
`packages/web/scripts/capture-preview.ts` (Playwrightを使用) を作成します。

```typescript
// 実装イメージ
import { chromium } from 'playwright';

const [projectId, pageNum] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// プレビューURLを開く
await page.goto(`http://localhost:3000/preview/${projectId}?page=${pageNum}`);

// レンダリング完了を待機（特定の要素が表示されるまで）
await page.waitForSelector('#pixi-canvas');
await page.waitForTimeout(1000); // 演出の完了待ち

// スクリーンショット保存
await page.screenshot({ path: `./tmp/preview_${projectId}_${pageNum}.png` });
await browser.close();
```

### Step 2: package.json へのコマンド追加
ルートの `package.json` に、AIが叩きやすいエイリアスを追加します。

```json
"scripts": {
  "preview:capture": "tsx packages/web/scripts/capture-preview.ts"
}
```

## 4. AIへの指示（プロンプト例）
機能を実装後、AIに対して以下のように指示できるようになります。
「修正した演出を確認したいので、 `npm run preview:capture -- <project_id> <page_num>` を実行して生成された画像を確認して。」

## 5. 期待される効果
- **即時フィードバック**: AIが自分の修正結果を画像として認識し、タイポや数値設定ミスによる「画面の崩れ」を自ら発見できるようになります。
- **人間による確認コストの削減**: AIが「よし、これで合っている」と判断した後の最終確認だけで済むようになります。

## 結論
この最小構成の実装により、わずか数時間の作業で kaedevn の AI 開発効率を飛躍的に高めることが可能です。
