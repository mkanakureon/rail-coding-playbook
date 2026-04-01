# 設計書：Rich Editor-JSON のマルチプラットフォーム展開仕様

## 1. 概要
Gemini CLI が出力する "Rich Editor-JSON" をマスターデータとし、Web小説（スマホ閲覧）、書籍（紙媒体）、ノベルゲーム（演出重視）の 3 大プラットフォームへ最適化されたテキストを自動生成するための変換ロジックを定義する。

## 2. Rich Data フィールド定義（再確認）

| フィールド | 意味 | 変換時の利用用途 |
| :--- | :--- | :--- |
| `isThought` | 心の声 | 記号 `（）` やフォント変更のトリガー |
| `tone` | 声の調子 | 地の文への「〜と囁いた」「〜と叫んだ」の付与 |
| `emotion` | 表情・感情 | 立ち絵の表情差分、地の文の描写強化 |
| `timeContext` | 時間帯 | 背景描写の自動生成（「夕暮れが迫る中...」） |
| `action` | 動作 | 立ち絵のアニメーション、地の文の動作描写 |

## 3. プラットフォーム別 変換ロジック

### A. Web Novel Mode (Target: なろう, カクヨム)
スマホでの「スクロール読み」と「テンポ」に特化する。

- **改行ルール**:
  - `text` ブロックごとに必ず空行を 1 行挿入。
  - 場面転換（`bg` 変更）時は空行 3 行 + 区切り線 `―――` を挿入。
- **ト書き生成**:
  - `bg` ブロックの情報（時間、天気）を、簡潔な 1 行の情景描写に変換して挿入。
  - 例: `{ time: "night", weather: "rain" }` → **「雨音が響く夜のことだった。」**
- **記号処理**:
  - 感嘆符 `！` `？` の後は全角スペースを自動挿入。
  - `isThought: true` の行は `（……テキスト）` の形式に変換。

### B. Book Mode (Target: 書籍, 同人誌, 電子書籍)
縦書きレイアウトと「没入感」を重視し、地の文をリッチにする。

- **改行ルール**:
  - セリフの連続は改行のみ（空行なし）。
  - 段落の先頭は全角スペースで字下げ。
- **Narrative Expansion (描写の肉付け)**:
  - JSON の `tone` や `action` を解析し、セリフの後に描写を自動追記する。
  - 例: `{ body: "待って", action: "手を伸ばす", tone: "必死" }`
  - 変換後: **「待って！」<br>　彼は必死な形相で手を伸ばした。**
- **禁則処理**:
  - 縦書き用の約物（ダブルダッシュ、三点リーダー）への正規化。

### C. Game Mode (Target: Visual Novel Engine)
演出スクリプトとしての正確性と、プレイヤーへのフィードバックを重視する。

- **制御タグ生成**:
  - `wait` 値に基づき、テキスト末尾に `@wait {ms}` を付与。
  - `action` がある場合、立ち絵に `@shake` や `@jump` 等のエフェクトを付与。
- **オートモード最適化**:
  - `tensionCurve`（S1で生成）に基づき、テキストの表示速度を動的に緩急させる。
- **ボイス連携**:
  - `speaker` と `tone` をキーにして、TTS（音声合成）エンジンへパラメータを渡す。

## 4. 実装戦略 (Universal Exporter)

```typescript
// インターフェース定義
interface Exporter {
  convert(page: RichPage): string;
}

// Web小説用
class WebNovelExporter implements Exporter {
  convert(page: RichPage): string {
    return page.blocks.map(b => {
      if (b.type === 'text') return this.formatText(b) + '\n\n';
      if (b.type === 'bg') return this.narratizeBg(b) + '\n\n';
      return '';
    }).join('');
  }
}
```

このアーキテクチャにより、新しい媒体（例：Chat Story形式）が増えても、新しい `Exporter` クラスを追加するだけで対応可能となる。

---
*本仕様は docs/10_ai_docs/2026/03/09/ の設計群を統合し、出口戦略を具体化したものである。*
