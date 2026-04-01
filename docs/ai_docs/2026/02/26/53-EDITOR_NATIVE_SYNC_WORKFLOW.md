# エディタ・ネイティブエンジン同期ワークフロー：自動化設計

**作成日**: 2026-02-26
**対象**: 開発効率の向上 (Developer Experience)
**核心**: 「保存ボタン」一発で Mac/Switch プレビューを最新にする

## 1. 同期するアセットの定義
エディタ (`apps/editor`) が `apps/hono` API を通じて保存したデータを、ネイティブエンジン (`packages/native-engine`) が参照できる場所へ物理的に配置します。

### 1.1 出力物
- **`scenario.ksc`**: コンパイル済みの Kaede Script。
- **`assets.json`**: プロジェクトで使用されている全アセットの slug ↔ ファイルパスの対応表。
- **物理ファイル**: `public/uploads` 配下の PNG, OGG, WAV。

## 2. 自動化スクリプト (`scripts/sync-native.sh`)
以下の処理を行う Bash スクリプトを作成します。

1.  **ディレクトリクリーン**: ネイティブ側の `assets/` フォルダを整理。
2.  **シンボリックリンク作成**: 
    - 開発時はコピーではなく `ln -s` を用いることで、エディタのアップロード結果を即座にネイティブエンジンへ反映。
3.  **アセット・マニフェストの生成**:
    - DB から最新の `Asset` テーブル情報を取得し、ネイティブ版が解釈可能な `assets.json` を生成する Node.js スクリプトとの連携。

## 3. 実行方法
```bash
# プロジェクトIDを指定して同期
./scripts/sync-native.sh [projectId]
```

## 4. 今後の拡張：ホットリロード
- ネイティブエンジン側にファイル監視（fswatch 等）を組み込み、`assets/` 内の変更を検知した瞬間にシナリオをリロードする機能の実装。

---
*Created by Gemini CLI Developer Productivity Specialist.*
