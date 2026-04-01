# 91-FINAL_GENERATION_REPORT

## 1. 実行結果および保存先一覧（Gemini 2.5 Flash）

今回の実験で生成された全ての成果物は、以下のプロジェクト別フォルダに格納されています。

| ジャンル | 最新出力フォルダパス (プロジェクトルート基準) | フォーマット |
|:---|:---|:---|
| **Comedy** | `projects/comedy/output/20260303_210112/` | **最新 (名前なし・自動リスト)** |
| **Slice-of-Life** | `projects/slice-of-life/output/20260303_194245/` | 旧形式 |
| **Fantasy** | `projects/fantasy/output/20260303_195617/` | 旧形式 |
| **Horror** | `projects/horror/output/20260303_200408/` | 旧形式 |
| **Longstory** | `projects/longstory/output/20260303_201108/` | 旧形式 |
| **Mystery** | `projects/mystery/output/20260303_202513/` | 旧形式 |
| **Romance** | `projects/romance/output/20260303_203128/` | 旧形式 |

---

## 2. フォルダ内の主要ファイル構成

各出力フォルダ（例：`projects/comedy/output/20260303_210112/`）には以下のファイルが含まれています。

1.  **`ch1_ep1.ks`**: ゲームエンジン用スクリプト（3行表示・名前プレフィックスなし）。
2.  **`backgrounds.md`**: 使用されている背景IDとその詳細の一覧。
3.  **`characters.md`**: 使用されているキャラクターポーズIDの一覧。
4.  **`_generation_metadata.json`**: 使用モデル（Gemini 2.5 Flash）やトークン数の統計。

---

## 3. エンジン自動化・フォーマット改善の成果（Comedyにて検証）

最新の生成（**Comedy**）では、これまでの課題を解決した「完成形」の出力が行われています。

### ① 資産リストの完全自動生成
人間がリストを作成することなく、スクリプトから自動抽出された `backgrounds.md` と `characters.md` がフォルダ内に作成されています。

### ② セリフ内「名前プレフィックス」の削除
テキストウィンドウに表示される純粋なセリフのみを出力しています。
- **最新の形式例**: `「おはようございます！」` （`圭太：` 等の表記を廃止）

### ③ 選択肢の廃止による安定化
LLMの生成エラーを防ぐため、選択肢機能を廃止し、一本道の物語として質を向上させました。

---

## 4. 結論
Gemini 2.5 Flash を活用し、**「設定（settings）からコード（ks）と資産リスト（md）を完全自動で一括生成する」**ワークフローが確立されました。

最新の成果物を確認するには、上記の **`projects/comedy/output/20260303_210112/`** を参照してください。

---
*保存場所: docs/10_ai_docs/2026/03/03/91-FINAL_GENERATION_REPORT.md*
