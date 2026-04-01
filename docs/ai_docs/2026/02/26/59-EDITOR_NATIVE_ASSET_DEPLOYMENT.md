# エディタ成果物のネイティブエンジン配置マニュアル

**作成日**: 2026-02-26
**対象**: 開発者・データ同期担当
**核心**: エディタで作成したデータを SDL2 プレイヤーで再生するための物理配置ルール

## 1. 概念図
```text
[ Web エディタ ] --- (保存/ビルド) ---> [ projects/ ID /output / ]
                                              │
                                              ▼ (sync-native.sh)
                                              │
[ SDL2 プレイヤー ] <--- (読込) --- [ packages/native-engine/assets/ ]
```

## 2. 配置ルール (File Mapping)

ネイティブエンジンは、実行バイナリと同じ階層、または指定された `assets/` フォルダ内に以下の構成を期待します。

| ファイル名 | 役割 | ソース (Editor側) |
| :--- | :--- | :--- |
| **`main.ksc`** | メインシナリオ | `projects/[ID]/output/[Latest]/*.ks` |
| **`assets.json`** | アセット対応表 | エディタの Asset テーブルから生成される JSON |
| **`uploads/`** | 画像・音声実体 | `apps/hono/public/uploads/` |

## 3. 配置方法：シンボリックリンクの活用
開発効率を最大化するため、物理ファイルのコピーではなく**シンボリックリンク**を推奨します。

```bash
# マップ・実体へのパスを通す例
ln -s ../../../apps/hono/public/uploads packages/native-engine/assets/uploads
```
これにより、ブラウザのエディタでアセットをアップロードした瞬間に、ネイティブプレイヤー側でもそのアセットが利用可能になります。

## 4. エディタ保存 JSON の扱い
エディタで保存された「プロジェクト設定（`chapters.json`, `overview.md`等）」は、現時点ではネイティブエンジンの初期化時に `assets.json` を動的生成するために参照されます。

将来的に、セーブデータだけでなく「既読フラグ」や「システム設定」も、TS 版と共通の JSON フォーマットで `assets/` フォルダへ同期される予定です。

## 5. 同期コマンド
現在実装済みの同期コマンドは以下の通りです。
```bash
./scripts/sync-native.sh [projectId]
```
このコマンドは最新のシナリオスクリプトを `main.ksc` として抽出し、アセットディレクトリのリンクを張り直します。

---
*Created by AI Agent to clarify data flow between Editor and SDL2 Player.*
