# 抽象化レイヤー：プラットフォーム分離設計の深掘り

**作成日**: 2026-02-26
**対象**: 全エンジニア
**核心**: 「一度書けば、どこでも動く（Web/Switch）」を実現するアーキテクチャ

## 1. 抽象化の三権分立
本プロジェクトでは、ゲームの実行に必要な要素を 3 つ（+演出API）のインターフェースに分離しています。

### 1.1 IInput（入力の民主化）
物理的なデバイス（Keyboard, Mouse, Gamepad）を `Action` という論理概念に変換します。
- **Web**: `keydown` イベントを `Action.OK` に変換。
- **Switch**: Joy-Con の `Aボタン` 押下を `Action.OK` に変換。
- **ロジック層**: 常に `on(Action.OK, ...)` を監視するだけで済みます。

### 1.2 IAudio（音響の抽象）
ブラウザの `AudioContext` やネイティブのオーディオバッファを隠蔽します。
- **機能**: `playBgm`, `playSe`, `playVoice` の 3 系統を独立して音量管理。
- **移植性**: Switch 移植時は、このインターフェースの裏側を `nn::audio` に差し替えるだけで、全シナリオの音が鳴ります。

### 1.3 IStorage（記憶の抽象）
保存先がクラウド、IndexedDB、または Switch の専用保存領域であっても、同一のコードで扱えるようにします。
- **メソッド**: `getItem(key)`, `setItem(key, val)`, `removeItem(key)`。

## 2. インタプリタと IEngineAPI
`@kaedevn/interpreter` は、プラットフォーム固有の描画命令を一切持ちません。
すべての演出は `IEngineAPI` インターフェースを通じて行われます。

```typescript
// どこでも動くロジックの例
async executeBgCommand(slug: string) {
  const url = await this.resolveUrl(slug);
  await this.engine.showBackground(url, 'fade'); // engine は IEngineAPI
}
```

## 3. なぜここまで徹底するのか？
1.  **全書き直しの回避**: 過去のノベルゲーム開発では、プラットフォームごとにスクリプトエンジンを書き直す悲劇が多発していました。
2.  **Claude Code との相性**: 抽象化レイヤーが明確であれば、AI は「プラットフォームの細部」を気にせず、純粋なロジックの実装に集中でき、バグが減ります。
3.  **テストの容易性**: 本物の PixiJS や物理ボタンがなくても、Mock クラスを注入するだけで CI 上で全ロジックのテストが可能です。

---
*Created by AI Agent based on exhaustive search of abstraction-related docs.*
