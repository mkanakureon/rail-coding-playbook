# 設計原則アンソロジー — Open Core / frozen schema / IR が境界 / 抽象 4 兄弟

シリーズ: 11-documentation-plan / 関連: 02-guardrails-ts-techniques / 19-phase-incremental-pattern

## この文書の狙い

このリポジトリの **設計を支える 4 つの原則** をまとめる:

1. **Open Core** — 商用 / OSS の境界線
2. **Frozen schema** — リテラル型と forward compatibility
3. **IR が境界** — クロスプラットフォーム移植の最適化
4. **抽象 4 兄弟（IInput / IAudio / IStorage / IBilling）** — Switch 移植の基礎

各原則は独立に成立するが、組み合わせると **「3 プラットフォーム × 商用 OSS 両立」** の実装になる。

---

# 1. Open Core 戦略 — 商用 / OSS の境界線

## 1-1. 結論

| | 場所 | ライセンス |
|---|---|---|
| **OSS 部分** | `packages/interpreter/` のみ | Apache 2.0 |
| **商用部分** | エディタ・サーバー・運営機能 | proprietary |

`/sync-oss` スキルで `kaedevn-monorepo` から `kaedevn`（OSS リポ）へ **rsync 片方向同期**。

## 1-2. なぜ Apache 2.0 か

| 候補 | 採否 | 理由 |
|---|:---:|---|
| **Apache 2.0** | ◎ 採用 | 商用流用許可 + **特許条項で逆告訴リスクをカバー** |
| MIT | ○ | シンプル、特許条項なし |
| BSD 3-Clause | △ | MIT とほぼ同等 |
| LGPL | × | 動的リンク前提、モバイル静的リンク主流と相性悪 |
| GPL/AGPL | × | **採用者のゲーム本体まで GPL 化** される |
| BUSL | × | 「期限付き OSS」、本物の OSS と見られない |

選定理由: **企業採用率と特許保護のバランス**。Android エコシステムの標準でもある。

## 1-3. 何を OSS にして、何をしないか

### OSS 化（プレイヤー）
- `packages/interpreter/` — スクリプトインタプリタ
- 将来: `packages/web/` のレンダラー / `packages/core/` の型定義

### 非 OSS（差別化軸）
- `apps/editor` — エディタ
- `apps/hono` — 運営サーバー（課金・ガチャ・スタミナ）
- `apps/next` — ポータル
- AI 執筆支援（assist）

「**プレイヤーは OSS、作るための環境と運営機能は商用**」が Open Core の基本。

## 1-4. 同期方式

```bash
rsync -av --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='tsconfig.tsbuildinfo' \
  /Users/.../kaedevn-monorepo/packages/interpreter/ \
  /Users/.../kaedevn/packages/interpreter/
```

- **片方向**（monorepo → OSS）
- **`--delete`** で削除も同期
- 機密チェック（`.env` 等の混入を事前確認）

`/sync-oss` スキルが手順を自動化。

## 1-5. 商標は別途守る

Apache 2.0 は **商標を保護しない**（明示条項あり）。そのため:
- 「kaedevn」名・ロゴは別途商標登録
- フォークは可能だが「kaedevn」を名乗れない

---

# 2. Frozen Schema — リテラル型と version 固定

## 2-1. 結論

セーブデータ・スクリプトコマンド集合のような **「変えたくない構造」** はリテラル型で版固定:

```ts
export interface SaveData {
  save_schema_version: 2;   // ← リテラル型 2 で固定
  engine_version: string;
  work_id: string;
  // ...
}
```

`save_schema_version: 2` という型は **値も 2 しか受け付けない**。`{ save_schema_version: 3 }` を作ろうとすると型エラー。

## 2-2. なぜ Frozen にするか

セーブデータは **作者のプレイヤーのデバイスに永続化** されている:
- スマホアプリのローカルストレージ
- クラウドセーブ
- Switch のセーブストレージ

サーバー側で勝手に schema を変えると **既存セーブが読めなくなる**。

## 2-3. リテラル型での厳格化

```ts
const save: SaveData = {
  save_schema_version: 1,  // ← 型エラー！ Type '1' is not assignable to type '2'.
  // ...
};
```

`save_schema_version` を変えるには **型定義の変更が必須**。型定義は C ゾーン（前書 01）に置かれ、Design Change Note なしには変更できない。

## 2-4. forward compatibility（将来拡張）

将来 V3 を足すときは:

```ts
export interface SaveDataV2 {
  save_schema_version: 2;
  // ...
}
export interface SaveDataV3 {
  save_schema_version: 3;
  // ...
}
export type SaveData = SaveDataV2 | SaveDataV3;
```

判別共用体（前書 02）にして、`switch (save.save_schema_version)` で網羅性チェック:

```ts
function migrate(save: SaveData): SaveDataV3 {
  switch (save.save_schema_version) {
    case 2: return migrateV2toV3(save);
    case 3: return save;
    default: const _: never = save; throw new Error('unreachable');
  }
}
```

新 version を足し忘れたら型エラーで止まる。

## 2-5. 「reference IDs only」原則

このリポジトリのセーブデータは **画像・音声を埋め込まない**:

```ts
// NG: 画像を base64 で埋める
{ thumbnail: "data:image/png;base64,..." }

// OK: 参照 ID だけ
{ asset_id: "asset-bg-forest" }
```

理由:
- セーブが軽い（数 KB）
- アセット差し替え時にセーブを直さなくて良い
- Switch / モバイルの容量制約に優しい

---

# 3. IR が境界 — クロスプラットフォーム移植の最適化

## 3-1. 結論

```
コンパイラ (TS、固定)  →  IR (JSON / CBOR)  →  VM (TS / C++、両方)
```

**コンパイラは TS のみ、VM は TS と C++ の両方**。**IR が両者の唯一の境界**。

## 3-2. なぜこの分割か

| | コンパイラ | VM |
|---|---|---|
| 実装難度 | 高（パーサー、型チェック、最適化） | 中（switch ループ） |
| 移植コスト | 巨大 | 中 |
| 性能要求 | 開発時のみ | 実行時、フレーム毎 |
| クロスプラットフォーム要求 | 不要 | 必須（Switch / Android / iOS） |

→ 実行時に必要な部分（VM）だけ C++ に移植。**移植コスト最小**。

## 3-3. IR の選定

```ts
// IR は単純なオブジェクトの配列
[
  { op: "LOAD_CONST", value: 42 },
  { op: "LOAD_CONST", value: 8 },
  { op: "ADD" },
  { op: "RET" }
]
```

- JSON で表現可能
- CBOR で圧縮可能（30〜50% サイズ）
- C++ で nlohmann::json でパース容易

## 3-4. parity test で「TS = C++」を保証

`packages/ksc-vm-cpp/tests/parity/` で:
- 同じ IR を TS VM と C++ VM で実行
- **bit-exact** で結果一致を確認

「移植したら微妙に動作が違う」を防ぐ。前書 09 第 4 部参照。

## 3-5. なぜコンパイラを移植しないか

「フル C++ 化したほうが性能良いのでは？」と思うが:
- コンパイラは **開発時にしか動かない** → 性能不要
- パーサー / 型チェッカーの C++ 化は **巨大な工数**（4 週間以上）
- IR を境界にすれば **コンパイラの進化を VM に伝搬する手間が最小**

VM だけ C++ にすると:
- 共通 IR で **3 プラットフォーム同時対応**
- TS で書いたツール群（IDE 連携・テスト）がそのまま使える
- **コスト最小、利益最大**

## 3-6. 「境界を IR に置く」の一般化

```
A 言語のコンパイラ  →  共通 IR  →  B 言語の VM
```

このパターンは:
- LLVM IR（C/C++/Rust → ネイティブコード）
- WebAssembly（多言語 → ブラウザ）
- JVM bytecode（Java/Kotlin/Scala → JVM）

「**実行時の境界 = IR**」は確立した設計。本リポジトリの選択は妥当。

---

# 4. 抽象 4 兄弟（IInput / IAudio / IStorage / IBilling）

## 4-1. 結論

プラットフォーム差を吸収する **4 つのインターフェース**:

```
packages/core/src/interfaces/
├── IInput.ts       入力ディスパッチ
├── IAudio.ts       BGM / SE / VOICE 再生
├── IStorage.ts     セーブ / ロード
└── IBilling.ts     課金（Phase 1 で追加）
```

## 4-2. 各インターフェースの責務

### IInput — `packages/core/src/interfaces/IInput.ts`

```ts
export interface IInput {
  dispatch(action: Action): void;
  on(action: Action, handler: () => void): void;
  off(action: Action, handler: () => void): void;
}
```

**Action は固定セット**: `OK / Back / Menu / SkipToggle / AutoToggle / Log / QuickSave / QuickLoad`。
ゲーム側はこの Action だけ気にする。プラットフォーム差（タッチ / キーボード / コントローラ）は実装側で吸収。

### IAudio

```ts
export interface IAudio {
  play(category: 'bgm' | 'se' | 'voice', url: string): void;
  stop(category: 'bgm' | 'se' | 'voice'): void;
  setVolume(category: 'bgm' | 'se' | 'voice', vol: number): void;
}
```

カテゴリ別音量管理。Web は WebAudio、Switch は SDL_mixer 等。

### IStorage

```ts
export interface IStorage {
  save(slotId: string, data: SaveData): Promise<void>;
  load(slotId: string): Promise<SaveData | null>;
  delete(slotId: string): Promise<void>;
  list(): Promise<string[]>;
}
```

Web は IndexedDB、Native は OS のセーブ API。

### IBilling — Phase 1 で追加

```ts
export interface IBilling {
  fetchProducts(productIds: string[]): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<Entitlement[]>;
  getEntitlements(): Promise<Entitlement[]>;
  platform(): Platform;
}
```

Android Play Billing v7 / iOS StoreKit 2 / Switch eShop DLC / Web preview の差を吸収。

## 4-3. なぜ 4 つに絞るか

「他にも抽象できそう」(レンダリング、ネットワーク、フォント...) のうち:

- **Switch 移植時に書き換え必須** = 抽象化 → IInput / IAudio / IStorage / IBilling
- **Web のみで動けばよい** = 直接利用可 → PixiJS（レンダリング）

ルール: **「Switch で全書き換えするのか」** を抽象化判定の基準に。

## 4-4. C ゾーン保護

これら 4 インターフェースは `packages/core/src/interfaces/` に置かれ、`scripts/lint/architecture-check.sh` で **Design Change Note 必須**:

```sh
C_ZONE_PATTERNS=(
  "packages/core/src/interfaces/"  ← ここ
  ...
)
```

無断変更を git push でブロック（前書 01）。

## 4-5. `implements` で実装漏れ検出

```ts
class WebStorage implements IStorage {
  async save(...) { ... }
  async load(...) { ... }
  // delete を実装し忘れた → 型エラー
}
```

メソッド漏れ・引数違いを **クラス定義時点で検出**（前書 03）。

## 4-6. 新規抽象を追加する条件

CLAUDE.md「New Abstraction Rules」:

> 新規 abstraction / helper / service / hook / util は以下の **全て** を満たす場合のみ許可:
> 1. 同じ処理が **3箇所以上** にある
> 2. ドメイン概念として **名前がある**
> 3. 今後も **再利用が見込める**
> 4. 依存方向を **改善する**
> 5. テストしやすく **なる**

→ 軽率に「IRenderer」「INetwork」を追加しない。**4 兄弟で十分** という判断。

---

# 5. 4 つの原則の連動

```
Open Core              ┐
                         ├─→ 「OSS には何を入れるか」を境界で線引き
Frozen Schema          ┤
                         ├─→ セーブの後方互換 = 商用と OSS 両方が依存する API
IR が境界              ┤
                         ├─→ 「TS は OSS、C++ は商用」の境界線
抽象 4 兄弟            ┘
                         ├─→ プラットフォーム実装は OSS 化対象外、抽象だけ OSS
```

つまり:
- **OSS にする = `packages/interpreter/` + 抽象インターフェース**
- **商用にする = 実装、エディタ、運営**
- **境界 = IR + frozen schema + 4 兄弟インターフェース**

これらが揃って **「Switch / Android / iOS / Web の 4 プラットフォーム × 商用 OSS 両立」** が成立する。

---

# まとめ — 設計原則のミニ図

| 原則 | 役割 | 実体 |
|---|---|---|
| Open Core | 商用 / OSS の境界 | `/sync-oss` スキル + Apache 2.0 |
| Frozen Schema | 永続データの後方互換 | `save_schema_version: 2` リテラル型 |
| IR が境界 | コンパイラ / VM 分離、移植最小化 | KSC IR (JSON/CBOR) |
| 抽象 4 兄弟 | プラットフォーム差吸収 | `IInput / IAudio / IStorage / IBilling` |

これら 4 つは独立に成立し、組み合わさって **クロスプラットフォーム + Open Core** の基盤を成す。新しい機能を作る時は **「どの境界に乗せるか」** を最初に判断する。
