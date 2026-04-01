# Nintendo Switch 移植・SDL2 関連リソース目録

**作成日**: 2026-02-26
**対象**: Switch 移植エンジニア、ネイティブ実装担当

## 1. 核心的なドキュメント (Core Resources)

本プロジェクトにおける Switch 移植の「憲法」となる主要なドキュメントです。

### 1.1 `docs/CODE_REUSABILITY_ANALYSIS.md`
- **内容**: 現状の TS コードの Switch における再利用率をコンポーネント別に評価。
- **要点**: 
    - `@kaedevn/web` (PixiJS) は Switch では 20% 程度の再利用（ロジックのみ）に留まる。
    - インタプリタやコンパイラは 100% 再利用可能。
    - Switch 固有のレンダリングエンジン（将来的に SDL2 や C++ 等を想定）の新規実装が必要。

### 1.2 `docs/zenn/drafts/01kj6z4xyr-monorepo-vn-engine-design.md`
- **内容**: Switch 移植時の「全書き直し」を避けるための、入力・音声・ストレージの抽象化設計の解説。
- **要点**: 
    - 入力マッピング（Web の Enter → Switch の A ボタン）の Action レイヤーによる吸収。
    - テレビモードの「オーバースキャン」を考慮したセーフエリア設計（Logical 1280x720 / 5% margin）。

### 1.3 `docs/zenn/drafts/01kj1fytet-kaedevn-ks-ksc-interpreter.md`
- **内容**: なぜ「コンパイラ+VM」方式ではなく「インタプリタ」方式が Switch 移植に有利かの技術的背景。
- **要点**: `.ksc` テキストファイルをそのまま Switch 環境へ持ち込める柔軟性の強調。

## 2. 抽象化インターフェース（将来のネイティブ実装対象）

Switch 移植時に SDL2 や C++ ネイティブ API で再実装すべきインターフェースの一覧です。

- **`IInput`**: ボタン入力、スティック操作の Action への変換。
- **`IAudio`**: BGM、SE、VOICE のカテゴリ別再生（Switch 版では `nn::audio` 等を想定）。
- **`IStorage`**: セーブデータの保存（Switch 版ではセーブデータ領域へのアクセス）。
- **`IEngineAPI`**: レンダリングの抽象（Switch 版では固有の `SwitchRenderer` 実装）。

## 3. 現時点での技術的結論
- **SDL2 について**: 現在のドキュメントに「SDL2」という固有名詞は出現しませんが、PixiJS を使用しない「独自レンダリングエンジン」の実装方針が明確に定義されています。ネイティブ移植時には、これらの抽象インターフェースを実装するライブラリとして SDL2 が有力な候補となります。
- **Switch ポータビリティ**: アセット管理 (`Asset`) も slug ベースの参照体系により、データ形式を変えずに Switch へ持ち込めるよう「ポータビリティ」が維持されています。

---
*Created by AI Agent based on keyword search and architectural analysis.*
