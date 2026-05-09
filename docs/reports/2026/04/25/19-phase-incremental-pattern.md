# Phase 単位の段階実装パターン — 動く状態を保ちながら積む

シリーズ: 11-documentation-plan / 関連: 04-document-implementation-workflow / 07-workflow-actual-elapsed-time

## この文書の狙い

「大きな機能を 1 セッションで作る」ための分解法 — **Phase A → B → C → D → E** の段階実装パターンを解説する。VRM 実装が **1 日で 14 表情まで動いた**のはこの構造のおかげ。Phase 1（KSC VM 移植 + 課金）が **26 コミットで完走** したのも同じ。

---

## 1. パターンの定義

### 1-1. 核となる原則

```
各 Phase は「動く状態」を保ちながら積む。
1 Phase = 1 commit、各 commit は緑（テスト pass）。
```

つまり:

- Phase A: 最小実装でも **動く** ものを作る
- Phase B: その上に薄く積む、**動き続ける**
- Phase C, D, E: 同様に追加、各時点で **緑**

「全部書いてから動かそう」ではなく、**「常に動く前提で機能を積む」**。

### 1-2. なぜ機能するか

- 各 Phase が **小さい diff**（1 commit 数百行以内）
- AI が **1 ターンで 1 Phase** をこなしやすい
- 失敗しても **1 Phase 戻すだけ**
- レビューしやすい
- 段階的に **複雑度が増す** ので疲れない

---

## 2. 実例 1 — VRM 実装（Phase A〜E）

### 2-1. 計画書での分解

`docs/09_reports/2026/04/13/04-vrm-implementation-plan.md` で:

| Phase | 目標 |
|---|---|
| **Phase A** | VRM ロード・3D マップに主人公として配置 |
| **Phase B** | トゥーンシェーダー（最小 3 段ランプ） |
| **Phase B+** | フレネル擬似アウトライン（強化） |
| **Phase C** | BlendShape 表情パース・API |
| **Phase D** | SpringBone Verlet 物理 |
| **Phase E** | 手続き型歩行・球コライダー・VRM 0.x 互換 |

### 2-2. 実コミット履歴

| コミット | Phase | 内容 |
|---|---|---|
| `9db6b03e` | VRM-A | VRM ロード・主人公として 3D マップに配置 |
| `92450db1` | VRM-B | トゥーンシェーダー（最小 3 段ランプ） |
| `861ebc69` | VRM-B+ | フレネル擬似アウトライン |
| `99a85921` | VRM-C | BlendShape 表情パース・API |
| `4de9d421` | VRM-D | SpringBone Verlet 物理 |
| `be78347b` | VRM-E | 手続き型歩行・球コライダー |

**6 コミット = 6 Phase**。各 Phase 後にデモが動く。

### 2-3. デバッグ Phase の追加

ふたつめの設計判断: **見つけた不具合を Phase B+ / C+ として追加**:

| コミット | 種類 | 内容 |
|---|---|---|
| `282b6967` | デバッグ 1 | トゥーン真っ黒問題修正 |
| `9f9349bd` | デバッグ 2 | トゥーン VRM 公式風に |
| `9983cdfa` | デバッグ 3 | 表情 14 種完全動作（sparse → dense） |

「Phase A〜E が緑で、後から 3 つの問題を Phase でラップして潰す」流れ。

### 2-4. 結果

- 計画 12:36 → 表情完全動作 19:39 = **7 時間 02 分**
- 6 主要 Phase + 3 デバッグ Phase = **9 コミット**
- 各コミットがデモで確認可能

---

## 3. 実例 2 — Phase 1 KSC VM 移植（Day 1〜26）

### 3-1. 26 段階の分解

Phase 1 計画書（`09_reports/2026/04/21/01-phase1-...-plan.md`）で **Day 単位** に分解:

```
Day 1:  パッケージ骨格 + Value/IR/IRLoader
Day 2:  KscVM 本体 + 算術 / 比較 / 論理 / スタック 20 opcode
Day 3:  制御フロー（JMP / JMP_IF_FALSE / CALL / RET / SWITCH）
Day 4:  オブジェクト・配列 6 opcode
Day 5:  CALL_METHOD / HOST_CALL / AWAIT — 全 37 opcode 完走
Day 6+7: VMState シリアライズ
Day 8:  TS/C++ parity テストハーネス
...
Day 26: ksc_runner ctest smoke test
```

### 3-2. 各 Day = 1 commit

実観測:

```
9c5096b4 Day 1
45cb742c Day 2
54ccd4fd Day 3
95c0a45d Day 4
a02cd058 Day 5
51a5a4af Day 6+7
4a7e6ed1 Day 8 (Week 1 完遂)
f0d6f7c0 Day 9
...
5f0678d8 Day 26
```

各 Day で:
- 該当 Day の機能を実装
- 該当のテストを追加 / 既存テストが緑
- コミット → 次の Day へ

### 3-3. 集計

- 26 commit、連続作業 約 4 時間 09 分（前書 07）
- **平均 1 コミット 9 分**
- 各 Day 成果物が計画書の D1〜D11 に対応（1:1)

---

## 4. パターンの構造化

### 4-1. Phase の粒度設計

| 粒度 | 適合状況 |
|---|---|
| 1 Phase = 数時間 | 中規模機能（VRM 実装、文法拡張） |
| 1 Phase = 数十分（Day） | 大規模 Phase 内の細分化（KSC VM Day 1〜26） |
| 1 Phase = 数分（コミット粒度） | 言語実装の opcode 単位 |

**「動く最小単位」** を Phase の目安にする。

### 4-2. Phase 間の依存

```
Phase A      ── 必須、後続全ての土台
   ↓
Phase B      ── A 上に積む
   ↓
Phase B+     ── B の強化（任意）
   ↓
Phase C      ── B 上、A も使う
   ↓
Phase D      ── C と並列可能
   ↓
Phase E      ── 全部の上
```

並列可能な Phase は **同じ Day で 2 commit** にする選択肢もある。

### 4-3. 「動く状態」の定義

Phase 完了 = 以下のいずれか:

- 関連テストが pass
- ブラウザで目視確認済み
- API が curl で叩ける
- KSC parity が通る

**「コードが書けた」ではなく「動いた」を Phase の完了条件** にする。

### 4-4. デバッグ Phase の追加

実装中に見つけた問題は:
- 小さければ **同 Phase 内で修正**
- 大きければ **Phase B+ や Phase D' として追加 commit**

VRM のトゥーン真っ黒問題（`282b6967`）はこの形。Phase B 後の「修正 Phase」。

---

## 5. なぜそうするか（優位性）

### 5-1. 各時点で「動く」のが安全

`feature` ブランチで全部書いてから merge するスタイルだと:
- 中間で失敗しても **どこから壊れたか不明**
- 大規模 diff の見落とし
- AI が混乱する

Phase 単位では:
- **どの Phase で壊れたか git bisect で 1 commit に絞れる**
- 各 Phase が小規模 → AI が読みやすい
- ロールバック単位が明確

### 5-2. AI が 1 ターンで 1 Phase をこなしやすい

LLM のコンテキスト窓は有限。1 Phase = 数百行に絞れば:
- AI が **全コードを把握しながら書ける**
- 関連テストも同じターンで書ける
- 「あれ何だっけ」が起きにくい

### 5-3. 計画書と実装が 1:1 対応

Phase 1 完了レポート（`09_reports/2026/04/21/02-...-completion-report.md`）が機械的に書ける理由:
- 計画書に Day 1〜26 が列挙
- コミット履歴に Day 1〜26 が対応
- **1:1 マッピング** で「達成 / 未達」判定が客観的

### 5-4. デバッグが Phase 単位で再現できる

postmortem に「Phase B+ で起きたトゥーン真っ黒問題」と書くと、当時のコードに戻れる:

```bash
git checkout 92450db1   # Phase B
# 問題を再現
git checkout 282b6967   # 修正
# 修正後を確認
```

**コミット粒度がデバッグの解像度** になる。

### 5-5. レビューの負荷が分散

```
NG: 5,000 行の PR
OK: 各 200〜500 行の Phase コミット 10 個
```

Phase 単位だと **1 コミットずつレビュー** できる。AI レビュー（ultrareview 等）も Phase 単位で動かしやすい。

### 5-6. 「動かない期間ゼロ」がもたらす心理効果

開発者の「不安」が消える:
- ✅ 緑 → ✅ 緑 → ✅ 緑 ... と進む
- 「いつか動くはず」を信じる必要がない
- やる気が続く（短い達成サイクル）

---

## 6. 自分のプロジェクトへの移植手順

### Step 1: 機能を Phase に分解する

まず計画書（前書 04）で:

```markdown
## Phase A
最小実装：機能 X が「動く」最小コード

## Phase B
A の上に追加機能 Y を載せる

## Phase C
A + B + 機能 Z

...
```

**各 Phase の完了条件** を明示。

### Step 2: 「動く」の定義を書く

各 Phase の末尾に:

```markdown
### Phase A 完了条件
- [ ] 機能 X のテストが pass
- [ ] ブラウザで X が画面に出る
```

これがないと「書けた」と「動いた」が混ざる。

### Step 3: 1 Phase 1 コミット

実装時に:

```bash
# Phase A 実装
git commit -m "feat: Phase A — 最小実装"
# Phase B 実装
git commit -m "feat: Phase B — Y を追加"
```

各コミット **緑であることを確認**してから進む。

### Step 4: Phase が大きすぎたら細分化

実装中に「Phase A が 1,000 行超えた」と感じたら:
- Phase A1 / A2 に分ける
- A1 commit → A2 commit

**「1 Phase が 1 ターンで読み切れない」を Phase 細分化のサイン** にする。

### Step 5: デバッグも Phase で

実装中に見つけたバグを:

```bash
git commit -m "fix: Phase B+ — A で見つけた問題 Z を修正"
```

「Phase B+」のような **修正 Phase** を作る。

### Step 6: 完了レポートで集計

Phase が全部終わったら:

```markdown
## 成果物
| Phase | コミット | 内容 |
|---|---|---|
| A | abc1234 | ... |
| B | def5678 | ... |
| C | ghi9abc | ... |
```

計画書と 1:1 で対応する完了レポート（前書 04 の構造）。

---

## 7. アンチパターン

### NG-1. Phase A が大きすぎる

「最小実装」と称して 2,000 行書く → AI も人間も把握できない。**1 Phase 数百行** が経験則。

### NG-2. Phase 間で動かない期間がある

Phase A → Phase B の間で **テストが落ちたまま** 進めると、後で原因切り分けが地獄。**各 Phase 完了時に緑** を厳守。

### NG-3. Phase の粒度が機能に合っていない

「Phase 1: 全部書く」のような乱暴な分け方 → 結局 1 Phase になる。**「動く最小単位」を見つけるのが計画段階の仕事**。

### NG-4. デバッグを Phase 化しない

修正を **既存 Phase の commit に amend** する → 履歴が壊れる。`fix: Phase B+ ...` で **新規コミット** にする。

### NG-5. Phase 完了後に過去 Phase を直す

Phase D を実装中に「Phase A の設計が悪かった」と気づいた時:

```
NG: Phase A の commit を rewrite
OK: Phase A' commit で再設計、後続 Phase を更新
```

**履歴は変えない**。

---

## まとめ

- **Phase = 動く最小単位**、各 Phase で緑を保つ
- **1 Phase = 1 commit**、commit メッセージに `Phase A — ...` を含める
- 計画書の Phase 一覧 → コミット → 完了レポートが **1:1 対応**
- VRM 実装で Phase A〜E + 強化 + 修正の 9 コミット、Phase 1 で Day 1〜26 の 26 コミット
- AI のコンテキスト窓に収まる粒度に分解するほど、AI 実装が速くなる

「全部書いてから動かす」ではなく **「常に動かしながら積む」**。これが AI 時代の段階実装の核心。
