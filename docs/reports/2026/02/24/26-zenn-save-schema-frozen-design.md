---
title: "セーブデータスキーマを凍結した設計判断"
emoji: "💾"
type: "tech"
topics: ["claudecode", "typescript", "設計", "ゲーム開発"]
published: false
---

## はじめに

ゲームのセーブデータは、一度リリースしたら**後方互換を壊せない**。

プレイヤーが 50 時間かけて進めたセーブデータが、アップデートで読めなくなったら——それは致命的なバグだ。レビューに星 1 が並び、信頼は崩壊する。

kaedevn では、セーブデータのスキーマを**プロジェクトの初期段階で凍結（frozen）** した。この記事では、その設計判断の理由と、スキーマの具体的な構造を解説する。

## 凍結されたスキーマ

CLAUDE.md に記載されたセーブスキーマは以下の通り。

```json
{
  "save_schema_version": 1,
  "engine_version": "",
  "work_id": "",
  "scenario_id": "",
  "node_id": "",
  "vars": {},
  "read": {},
  "timestamp": 0
}
```

このスキーマは **frozen** と明記されている。つまり、フィールドの追加・削除・型変更は原則禁止だ。

## 各フィールドの設計意図

### save_schema_version: バージョン管理の要

```json
"save_schema_version": 1
```

このフィールドが存在する唯一の理由は、**将来の破壊的変更に備える**ためだ。

現在のバージョンは 1。もし将来的にスキーマを変更する必要が生じた場合、`save_schema_version: 2` を導入し、ロード時にバージョンを見てマイグレーション処理を走らせる。

```typescript
// 将来のマイグレーション例
function loadSaveData(data: unknown): SaveData {
  const raw = data as Record<string, unknown>;
  const version = raw.save_schema_version as number;

  if (version === 1) {
    return migrateV1toV2(raw);
  }
  if (version === 2) {
    return raw as SaveData;
  }

  throw new Error(`未対応のセーブスキーマバージョン: ${version}`);
}
```

この方式は SQLite のスキーマバージョン管理や、Protobuf の `reserved` フィールドと同じ思想だ。

### engine_version: エンジン側の互換性チェック

```json
"engine_version": ""
```

セーブデータがどのバージョンのエンジンで作成されたかを記録する。

これにより、以下のようなガードが可能になる。

```typescript
if (semver.gt(saveData.engine_version, currentEngineVersion)) {
  // セーブデータが現在のエンジンより新しい
  // → 新しいエンジンの機能に依存している可能性があるため警告
  showWarning("このセーブデータは新しいバージョンのエンジンで作成されました");
}
```

`save_schema_version` と `engine_version` は役割が異なる。`save_schema_version` はスキーマ構造の互換性、`engine_version` はゲームロジックの互換性を管理する。

### work_id と scenario_id: コンテンツの特定

```json
"work_id": "",
"scenario_id": ""
```

`work_id` はゲーム作品を一意に特定し、`scenario_id` はその中のシナリオファイルを特定する。

この分離により、1 つのエンジンで複数のゲーム作品を扱える。ゲームプラットフォーム（App Store 的なもの）を将来構築する場合、`work_id` でセーブデータをゲームごとに分離できる。

### node_id: 実行位置の記録

```json
"node_id": ""
```

スクリプト内の現在位置を記録する。kaedevn のスクリプトはラベルベースなので、`node_id` にはラベル名が入る。

ここで重要なのは、`node_id` が**行番号ではない**ことだ。行番号でセーブすると、スクリプトを 1 行追加しただけで全セーブデータの復帰位置がずれる。ラベル名なら、スクリプトの行を追加・削除しても正しい位置に復帰できる。

```ksc
*chapter1_scene3    // ← node_id = "chapter1_scene3"
bg("classroom")
#hero
教室に入った。
#
```

### vars: ゲーム変数のスナップショット

```json
"vars": {}
```

KSC の全変数（グローバル変数）をキーバリューで保存する。

```json
{
  "vars": {
    "affection": 5,
    "name": "太郎",
    "flag_library": true,
    "flag_rooftop": false
  }
}
```

ローカルスコープの変数は保存しない。セーブが実行されるのはトップレベル（関数外）であり、ローカル変数はその時点で存在しないためだ。

### read: 既読管理

```json
"read": {}
```

プレイヤーが既に読んだシナリオのノードを記録する。これにより以下の機能を実現する。

- **スキップ機能**: 既読テキストのみ高速スキップ
- **既読率表示**: シナリオの何%を読了したか
- **NEW マーク**: 未読の選択肢にマークを表示

```json
{
  "read": {
    "chapter1_scene1": true,
    "chapter1_scene2": true,
    "chapter1_scene3": false
  }
}
```

### timestamp: セーブ時刻

```json
"timestamp": 0
```

Unix タイムスタンプ（ミリ秒）でセーブ時刻を記録する。セーブスロットの一覧表示で「2026/02/24 14:30」のように日時を表示するために使う。

ISO 8601 文字列ではなく Unix タイムスタンプを採用した理由は、**比較とソートが整数比較で済む**ためだ。タイムゾーンの問題もない。

## 「参照 ID のみ」の原則

スキーマ設計で最も重要な判断は、**画像や音声のデータをセーブデータに埋め込まない**ことだ。

### 埋め込みの誘惑

セーブスロットの UI には、通常「セーブ時のスクリーンショット」が表示される。素朴に考えると、スクリーンショットの Base64 データをセーブデータに含めたくなる。

```json
{
  "screenshot": "data:image/png;base64,iVBORw0KGgo...",
  "bgm_playing": "data:audio/mp3;base64,..."
}
```

しかし、これには致命的な問題がある。

1. **サイズの爆発**: 1 枚のスクリーンショット（720p PNG）は約 500KB-2MB。セーブスロットが 100 個あれば 50MB-200MB
2. **ロード時間**: 巨大なセーブファイルのパースに時間がかかる
3. **Switch のストレージ制限**: Nintendo Switch のセーブデータ領域は限られており、画像データを含めると上限に達しやすい

### 参照方式

kaedevn では、セーブデータには**参照 ID のみ**を保存する。

```json
{
  "node_id": "chapter1_scene3",
  "vars": {
    "current_bg": "classroom",
    "current_bgm": "daily_life"
  }
}
```

セーブスロットの UI でスクリーンショットを表示したい場合は、`node_id` からシナリオを読み、そのノードで使用される背景画像のアセット ID を取得し、アセットのサムネイルを表示する。

```typescript
// セーブスロット表示時
const bg = saveData.vars["current_bg"];    // "classroom"
const thumbnail = assetManager.getThumbnail(bg);  // ローカルのサムネイル
```

この方式なら、セーブデータのサイズは数 KB に収まる。

### Switch と Web の両立

参照方式のもう一つの利点は、**プラットフォーム間の差異を吸収**できることだ。

Switch ではセーブデータを NAND ストレージに書き込むが、Web では IndexedDB に保存する。データ形式が異なっても、セーブデータの構造（参照 ID の JSON）は同じだ。画像データを埋め込んでいたら、IndexedDB のサイズ制限に引っかかる可能性がある。

## なぜ凍結したのか

「スキーマの凍結」とは、**追加・削除・型変更を禁止し、変更が必要な場合は `save_schema_version` を上げる**というルールだ。

### 凍結の動機

開発初期にスキーマを凍結する最大の理由は、**スキーマの変更は実装よりコストが高い**からだ。

スキーマが変わると、以下のすべてが影響を受ける。

1. **セーブ処理の実装** — 各フィールドの書き込みロジック
2. **ロード処理の実装** — 各フィールドの読み込み＋バリデーション
3. **マイグレーション** — 旧バージョンからのアップグレード処理
4. **テスト** — 全バージョン間のマイグレーションテスト
5. **ドキュメント** — スキーマ仕様書の更新

フィールドを 1 つ追加するだけで、これらすべてに波及する。初期段階で「これで十分か」を慎重に検討し、凍結することで、後続の実装を安定させる。

### 凍結しなかった場合のリスク

凍結しなかった場合の典型的な失敗パターン：

1. 開発中に「ここに画面の明るさ設定も保存しよう」と思いつき、`brightness` フィールドを追加
2. しばらく後に「やっぱり設定は別ファイルにしよう」と判断し、`brightness` を削除
3. テスターが古いセーブデータをロードしたら `brightness` がないためエラー
4. マイグレーション処理を書くが、テストが不十分で別のバグを生む

スキーマを凍結しておけば、こうした「軽い気持ちの変更」が入り込む余地がない。

## 凍結ルールの運用

CLAUDE.md に明記することで、AI ペアプログラミング時にも凍結ルールが守られる。

```markdown
### Save Schema (frozen)

\```json
{
  "save_schema_version": 1,
  ...
}
\```

- No embedded images/audio — reference IDs only
- Backward compatibility managed via `save_schema_version`
```

Claude Code がセーブ関連の機能を実装する際、CLAUDE.md の `frozen` 表記を見て「スキーマの変更は提案せず、既存のフィールドの範囲で実装する」という判断をしてくれる。これは実際に効果的だった。

## 代替案の検討

### Protobuf / FlatBuffers

バイナリフォーマットを採用する選択肢もある。

| 方式 | メリット | デメリット |
|------|---------|-----------|
| JSON | 可読性が高い、デバッグしやすい | サイズが大きい |
| Protobuf | サイズ小、型安全 | 可読性が低い、ツール依存 |
| FlatBuffers | ゼロコピーアクセス | 学習コスト高 |

kaedevn で JSON を選んだ理由は、**開発中のデバッグしやすさ**が最優先だからだ。セーブデータをテキストエディタで開いて中身を確認できることは、初期開発で大きなメリットだ。パフォーマンスが問題になったら（Switch 移植時など）、`save_schema_version: 2` として Protobuf 版を導入すればよい。

### フィールドの拡張性

「将来追加したいフィールドが出てきたらどうするか」という懸念がある。回答は 2 つ。

**1. `vars` に入れる**: ゲーム固有の状態は `vars` に何でも入れられる。

```json
{
  "vars": {
    "affection": 5,
    "settings_brightness": 0.8,
    "inventory_sword": true
  }
}
```

`vars` はスキーマの一部だが、中身は自由だ。ゲーム側の都合で好きなキーバリューを追加できる。

**2. `save_schema_version` を上げる**: `vars` では対応できない構造的変更が必要な場合は、バージョンを上げてマイグレーション処理を書く。

### セーブスロットのメタデータ

セーブスロットの一覧表示には、以下のような追加情報が欲しい場合がある。

- プレイ時間
- チャプター名
- キャラクター名

これらは `vars` に入れるか、セーブスロットのメタデータとして別ファイルに持つかの 2 択だ。現在は `vars` 方式を採用しているが、メタデータのみの軽量読み込み（セーブデータ本体を読まずにスロット一覧を表示）が必要になったら、メタデータファイルの分離を検討する。

## IStorage 抽象化との連携

セーブデータの読み書きは `IStorage` インターフェースを通じて行う。

```typescript
interface IStorage {
  save(slot: number, data: SaveData): Promise<void>;
  load(slot: number): Promise<SaveData | null>;
  delete(slot: number): Promise<void>;
  list(): Promise<SaveSlotInfo[]>;
}
```

Web 実装では IndexedDB を使い、Switch 実装では NAND ストレージ API を使う。セーブスキーマが JSON であること自体は `IStorage` の実装に依存しない——IndexedDB は JSON を直接保存でき、Switch 側では JSON.stringify してバイト列に変換するだけだ。

この抽象化層があるおかげで、セーブスキーマの凍結は「データフォーマットの凍結」に留まり、「ストレージ実装の凍結」にはならない。ストレージの実装は各プラットフォームで自由に変更できる。

## テスト戦略

凍結されたスキーマのテスト方針は以下の通り。

### 1. バリデーションテスト

```typescript
describe("SaveData validation", () => {
  it("全フィールドが存在するデータを受け入れる", () => {
    const data = {
      save_schema_version: 1,
      engine_version: "0.1.0",
      work_id: "test_game",
      scenario_id: "chapter1",
      node_id: "scene1",
      vars: { affection: 5 },
      read: { scene1: true },
      timestamp: Date.now(),
    };
    expect(validateSaveData(data)).toBe(true);
  });

  it("save_schema_version が欠落しているデータを拒否する", () => {
    const data = { work_id: "test_game" };
    expect(validateSaveData(data)).toBe(false);
  });
});
```

### 2. ラウンドトリップテスト

```typescript
it("セーブ → ロードで同一データが復元される", async () => {
  const original = createTestSaveData();
  await storage.save(1, original);
  const loaded = await storage.load(1);
  expect(loaded).toEqual(original);
});
```

### 3. マイグレーションテスト（将来用）

```typescript
it("v1 データを v2 にマイグレーションできる", () => {
  const v1Data = { save_schema_version: 1, /* ... */ };
  const v2Data = migrateV1toV2(v1Data);
  expect(v2Data.save_schema_version).toBe(2);
  expect(validateV2(v2Data)).toBe(true);
});
```

## まとめ

kaedevn のセーブスキーマ凍結は、以下の原則に基づいている。

1. **参照 ID のみ**: 画像・音声データを埋め込まず、アセット ID で参照する
2. **バージョン管理**: `save_schema_version` で将来の破壊的変更に備える
3. **ラベルベースの位置記録**: 行番号ではなくラベル名で実行位置を保存
4. **vars の自由度**: 固定フィールドは最小限に、ゲーム固有データは `vars` に
5. **早期凍結**: 開発初期にスキーマを固定し、後続の実装を安定させる

---

セーブデータのスキーマ凍結は「早すぎる最適化」ではなく「早すぎる安定化」だ。スキーマが揺れている状態でセーブ/ロード機能を実装すると、マイグレーションのテスト負債が雪だるま式に膨らむ。7 フィールドという最小構成で凍結し、拡張性は vars に委ねるという設計は、VN エンジンに限らず、あらゆるゲームのセーブシステムに応用できるパターンだと考えている。

　　　　　　　　　　Claude Opus 4.6
