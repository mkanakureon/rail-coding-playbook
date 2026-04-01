# block-coverage テスト反省 — 「56テスト全通過」なのに動かない

**作成日**: 2026-03-13
**分類**: テスト品質・ポストモーテム

---

## 何が起きたか

全14ブロック型を3段階（API・コンパイラ・ブラウザ）でテストし、56テスト全通過と報告した。
しかし実際にプレビューでシナリオを再生すると **`completed=false`** — 最後まで再生できなかった。

テストが通っているのに動かない。**テストが嘘をついている。**

---

## 根本原因: テストの設計思想が間違っていた

### 「存在確認」しかしていない。「動作確認」をしていない。

テスト全体が「データが壊れずに往復するか」「文字列が含まれているか」「要素が見えるか」だけを検証しており、**「最終的にユーザーが体験する動作が正しいか」を一切検証していなかった。**

これは「車のパーツが全部箱に入っているか確認した」だけで「車が走るか」を確認していないのと同じ。

---

## 問題の詳細分析

### 1. trivially true な expect（常に通る assert）

**最も深刻な問題。** 以下の expect は入力に関わらず常に通る：

```typescript
// ❌ 常に通る — スクリプトが undefined でなければ OK
expect(script).toBeDefined();

// ❌ 常に通る — canvas のスクリーンショットは空でもバイナリバッファを返す
expect(screenshot.length).toBeGreaterThan(0);

// ❌ ほぼ常に通る — @bg が1つでもあれば OK（全部あるかは不問）
expect(script).toContain('@bg');
```

**何が悪いか**: テストの目的は「失敗を検出する」こと。常に通る assert はテストではなく装飾。

**対策**:
- `toBeDefined()` を使う場面は「null が返る可能性がある API のレスポンス」だけ。値の中身まで検証する
- スクリーンショット比較は「既知の正常状態」との差分で行う。`length > 0` は禁止
- `toContain` は「含まれている」だけでなく「全て含まれている」「余計なものが含まれていない」を検証

### 2. 失敗状態の無視

```typescript
// ❌ completed=false でもテストは通る
let completed = false;
// ... 40回クリック ...
console.log(`Done: completed=${completed}`); // ← ログに出すだけ

// ❌ コンソールエラーをフィルタで除外
const criticalErrors = consoleErrors.filter(
  (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR'),
);
```

**何が悪いか**: テストが「エラーを見つけてはいけない」という前提で書かれている。フィルタが増えるほどテストは甘くなる。

**対策**:
- `completed === true` を `expect` で検証する。false ならテスト失敗
- コンソールエラーのフィルタは最小限にする。許容するエラーを明示的にリスト化し、**未知のエラーは必ず失敗させる**
- `console.log` でログに出すだけでは検証にならない。`expect` を通す

### 3. End-to-End の完走確認がない

Phase 3 の7テスト中、「シナリオが最後まで再生できる」を検証するテストが **0個**。

- Canvas が描画される → 起動確認
- テキストが画面に表示される → 表示確認
- クリックで進める → 1ステップ確認

しかし「全ブロックを通過して最後のテキストが表示される」テストがない。

**何が悪いか**: 各ステップが通ってもパイプライン全体が通るとは限らない。未実装のコマンド（timeline_play）やデータ不整合（存在しない troopId）で途中停止する可能性を検出できない。

**対策**:
- **必ず「最後まで到達した」ことを検証するテストを入れる**
- シナリオ完了イベント（`Scenario completed`）を `expect` で待つ
- 完了しない場合はタイムアウトではなく、どこで止まったかを報告する

### 4. 入力と出力の対応検証がない

Phase 2 で「14ブロックを入力して、KSC に変換する」テストをしたが、**出力に14ブロック全てが反映されているかを検証していない。**

```typescript
// ❌ 個別に @bg が含まれるか確認 — 他のブロックが消えていても気づかない
expect(script).toContain('@bg');
expect(script).toContain('@ch');
// ... ksc ブロックのテストは toBeDefined() で終わり
```

**実際に起きた問題**: `ksc` ブロックは `generateKSCScript` の switch 文で `default` case に落ち、**空文字列を返す**。テストはそれを検出できなかった。

**対策**:
- 入力ブロック数と出力コマンド数の対応を検証する
- 「各ブロック型が少なくとも1つのコマンドを出力する」ことを検証
- 空文字列を返すブロック型があればテスト失敗

### 5. テストデータが「都合のいいデータ」だけ

全てのテストが「正しい形式のデータ」だけを使っている。

- 存在しない `assetId` を指定したらどうなるか → 未検証
- 空の `body` のテキストブロック → 未検証
- `toPageId` が存在しないページを指す `jump` → 未検証
- `troopId` が存在しない `battle` → 未検証（**実際にプレビューで止まる原因の可能性**）

**何が悪いか**: 正常系だけテストしても、実運用では異常値が入る。エディタが不正な値を保存できてしまうなら、プレビューはそれを検出すべき。

**対策**:
- 異常値テストを Phase 1 と Phase 3 に追加
- 「不正なデータでもクラッシュせずエラーメッセージを出す」ことを検証
- 境界値テスト（空文字、null、存在しないID）

### 6. テストの独立性が低い

Phase 3 が Phase 1 で作ったプロジェクトを「暗黙的に」前提としている。Phase 1 が失敗すると Phase 3 も全滅するが、エラーメッセージからは原因が分からない。

**対策**:
- 各フェーズは独立して実行可能にする
- Phase 3 は自分でプロジェクトを作成する（既に `beforeAll` で作っているが、Phase 1 と同じ fixtures を流用）
- 前提条件が満たされない場合は明確なエラーメッセージを出す

### 7. 「テストが通った = 機能が動く」という報告

56テスト全通過を「完了」として報告した。しかし：

- Phase 2 は 30 テスト通過 → `ksc` ブロックのテストは実質スキップ
- Phase 3 は 7 テスト通過 → シナリオ完走を検証していない
- 録画で `completed=false` → 実際には動いていない

**何が悪いか**: テスト通過率だけを報告し、テストの品質（何を検証しているか）を報告していない。

**対策**:
- テスト結果報告には「何を検証したか」と「何を検証していないか」を明記する
- 通過率だけでなく、カバレッジ（どのブロック型のどの動作を検証したか）を示す

---

## 実際に検出できなかった問題の一覧

| # | 問題 | 原因 | テストが見逃した理由 |
|---|------|------|-------------------|
| 1 | `ksc` ブロックが KSC に出力されない | `generateKSCScript` の switch に case がない | `toBeDefined()` で検証した |
| 2 | `@timeline_play` が未実装で停止する | WebEngine に実装がない | ブラウザテストが完走を検証しない |
| 3 | `@battle` で存在しない troopId を参照 | テストデータに架空の ID | 異常値テストがない |
| 4 | Page 1 → Page 2 への自動遷移がない | Page 1 末尾に jump がない | スクリプト全体のフロー検証がない |
| 5 | エディタのページタブ切替が動かない | セレクタが間違っている | 録画テストにページ遷移の assert がない |

---

## 改善指針（今後のテスト設計ルール）

### 原則

1. **expect は「失敗させる」ために書く** — 常に通る assert は書かない
2. **End-to-End は「完走」を検証する** — 途中の状態確認だけでは不十分
3. **失敗状態を握りつぶさない** — エラーフィルタは最小限に。未知のエラーは失敗させる
4. **入力と出力の対応を検証する** — N個入れたらN個出るか
5. **異常値テストを必ず入れる** — 正常系だけでは実運用の問題を検出できない

### 禁止パターン

```typescript
// ❌ 禁止: trivially true
expect(value).toBeDefined();
expect(array.length).toBeGreaterThan(0);  // 空でなければいい、ではダメ
expect(screenshot.length).toBeGreaterThan(0);

// ❌ 禁止: ログに出すだけ
console.log(`completed=${completed}`);  // → expect(completed).toBe(true);

// ❌ 禁止: エラーの大量フィルタ
const errors = allErrors.filter(e => !e.includes('X') && !e.includes('Y') && ...);

// ❌ 禁止: 部分一致だけで全体を検証した気になる
expect(script).toContain('@bg');  // 他のブロックは？
```

### 推奨パターン

```typescript
// ✅ 具体的な値を検証
expect(script).toContain('@bg forest_bg');
expect(blocks.filter(b => b.type === 'ksc')).toHaveLength(1);

// ✅ 完走を検証
await expect(page.locator('text=Scenario completed')).toBeVisible({ timeout: 60000 });

// ✅ 全ブロック型が出力されているか検証
const expectedCommands = ['@bg', '@ch', '@shake', '@filter', '@overlay', '@camera', '@jump', '@battle', '@timeline_play'];
for (const cmd of expectedCommands) {
  expect(script, `${cmd} が出力に含まれること`).toContain(cmd);
}

// ✅ 未知のエラーは失敗させる
const KNOWN_HARMLESS = ['favicon.ico'];
const unknownErrors = errors.filter(e => !KNOWN_HARMLESS.some(k => e.includes(k)));
expect(unknownErrors).toHaveLength(0);

// ✅ 異常値テスト
const res = await saveProject(request, token, projectId, { data: { pages: [{ blocks: [{ type: 'bg', assetId: '' }] }] } });
expect(res.status).toBe(400); // or expect the preview to show an error, not crash
```

---

## まとめ

テスト56個を書いて全通過と報告したが、実態は **「データの往復」と「文字列の部分一致」と「要素の存在」** しか検証していなかった。ユーザーが実際に体験する「シナリオが最後まで再生できるか」は1つもテストしていない。

テストの数は品質を保証しない。**何を検証しているか**が全て。
