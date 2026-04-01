# プロジェクト・アセット配置自動化ガイド

**作成日**: 2026-02-26
**対象**: 開発者・ビルドエンジニア
**核心**: エディタの「ハッシュ化アセット」をネイティブエンジンへ正確に繋ぐ

## 1. ディレクトリ構造の対応

エディタで管理されているデータと、ネイティブエンジンの `assets/` フォルダの対応関係は以下の通りです。

| ネイティブエンジン側 (assets/) | リポジトリ内ソース | 備考 |
| :--- | :--- | :--- |
| **`main.ksc`** | `projects/[ID]/output/[Latest]/*.ks` | 最新の生成シナリオをコピー |
| **`assets.json`** | (DB/Editor Data) | slug ↔ ハッシュ名の対応表 |
| **`uploads/bg/`** | `apps/hono/public/uploads/bg/` | 背景画像実体 |
| **`uploads/ch/`** | `apps/hono/public/uploads/ch/` | 立ち絵画像実体 |
| **`uploads/frame/`** | `apps/hono/public/uploads/frame/` | アニメーション用 |

## 2. 実装のポイント：アセットの解決

エディタでアップロードした画像は、以下のようなハッシュ名で保存されています：
`apps/hono/public/uploads/ch/01a7177ae7557eeb.webp`

これに対し、シナリオ（KSC）内では以下のように記述されます：
`ch('hero', 'normal', ...)`

この橋渡しを行うのが `assets.json` です。配置時には、必ずこの JSON に正しいハッシュ名を記述する必要があります。

## 3. 同期自動化の手順 (Mac 開発時)

1.  **アセットの接続**:
    ```bash
    ln -s ../../../apps/hono/public/uploads packages/native-engine/assets/uploads
    ```
2.  **シナリオの最新化**:
    `sync-native.sh` を実行して、`projects/` フォルダから最新のスクリプトを `assets/main.ksc` へ抽出。
3.  **マッピングの生成**:
    エディタの保存 JSON（`projects/[ID]/settings/assets.md` 等）を解析し、`assets.json` を生成。

## 4. 結論：スタンドアロン化への応用

将来的に Windows 用の配布フォルダを作る際は、上記 Step 1〜3 で集めたファイルを、1 つの `assets/` フォルダに実体コピーとしてまとめるだけで、完璧な「完成品ゲーム」となります。

---
*Created by AI Agent. Bridging the gap between Web Editor and Native Player.*
