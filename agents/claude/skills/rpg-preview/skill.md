# RPG プレビュー Skill

RPG Studio のゲーム画面を Playwright MCP でスクリーンショット撮影して確認する。

## トリガー

- "RPGプレビュー"
- "ゲーム画面確認"
- "rpg preview"
- "画面見せて"

## 手順

1. RPG Studio の dev サーバーが起動しているか確認（localhost:5178）
   - 起動していなければ: `cd apps/rpg-studio && npx vite --port 5178 &`
   - 3秒待ってから次へ

2. CLI のデータを GUI にエクスポート
   - `npx tsx packages/entity-graph/src/cli/rpg-cli.ts sync-export /tmp/rpg-preview.json`

3. Playwright MCP でブラウザを操作
   - `mcp__playwright__browser_navigate` → `http://localhost:5178/`
   - Play Game タブをクリック
   - Import ボタンは使わない（LocalStorage に既にデータがある場合はそのまま使う）
   - Start Game をクリック
   - 1秒待つ
   - `mcp__playwright__browser_take_screenshot` でスクリーンショット撮影

4. スクリーンショットを確認して結果を報告

## 注意

- dev サーバーは `apps/rpg-studio` ディレクトリで起動する
- ポートは 5178 固定
- Playwright MCP のブラウザが他で使用中の場合はエラーになる。その場合はスクリーンショットをスキップして CLI の `show-map` / `run` で代替確認する
