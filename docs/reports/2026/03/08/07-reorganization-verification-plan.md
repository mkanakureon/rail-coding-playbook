# 大規模整理の検証計画

作成日: 2026-03-08

## 対象コミット

| コミット | 内容 |
|---------|------|
| `47f246e` | テストファイル 61個を `tests/{local,azure,shared}/` に移動 + AI ヘッダー追加 |
| `5102563` | スクリプト 69個を `scripts/` 14カテゴリに移動 + パス修正 |
| `3219fac` | スクリーンショット gitignore 追加 |

## 影響範囲

- 106 ファイル変更（テスト 61 + スクリプト 69 + config/skill/package.json）
- テストファイルの import パス変更
- スクリプト内の source / サブスクリプト呼出パス変更
- package.json の npm script パス変更
- 7 スキルのパス変更
- .husky/pre-commit のパス変更
- e2e.sh のテストファイル解決方式変更（find → ルックアップテーブル）

---

## Phase 1: 静的検証（パス参照の整合性）

サーバー起動不要。grep/find で壊れたパスがないか確認。

### 1-1. 旧パスの残存チェック

```bash
# scripts/ 直下の旧ファイル名が参照されていないか
grep -rn 'scripts/test-azure\|scripts/test-local\|scripts/azure-env\|scripts/local-env' \
  scripts/ .claude/skills/ .husky/ package.json tests/ \
  --include='*.sh' --include='*.md' --include='*.json' --include='*.ts' --include='*.mjs' \
  2>/dev/null | grep -v node_modules | grep -v 'reorganization\|plan'
# 期待: 出力なし

# 旧テストパス（tests/*.spec.ts 直下）が参照されていないか
grep -rn 'tests/[a-z].*\.spec\.ts' scripts/ .husky/ 2>/dev/null \
  | grep -v 'tests/shared\|tests/local\|tests/azure\|tests/configs' \
  | grep -v 'e2e/ksc-demo'
# 期待: 出力なし
```

### 1-2. source パスの存在確認

```bash
# 各スクリプトの source 先が実在するか
grep -rn 'source.*env\.sh' scripts/test/ | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  dir=$(dirname "$file")
  if [ ! -f "$dir/env.sh" ]; then
    echo "MISSING: $line"
  fi
done
# 期待: 出力なし
```

### 1-3. サブスクリプト呼出パスの存在確認

```bash
# run-all.sh が呼ぶサブスクリプトが全て実在するか
for f in health api editor-api security e2e auth ks-editor; do
  [ -f scripts/test/azure/$f.sh ] || echo "MISSING: scripts/test/azure/$f.sh"
done
for f in health unit api security e2e editor auth ks-editor; do
  [ -f scripts/test/local/$f.sh ] || echo "MISSING: scripts/test/local/$f.sh"
done
# 期待: 出力なし
```

### 1-4. テストファイルの存在確認（ルックアップテーブル）

```bash
# e2e.sh のルックアップテーブル内の全パスが実在するか
grep ']=tests/' scripts/test/local/e2e.sh | sed "s/.*]=//;s/'$//" | while read path; do
  [ -f "$path" ] || echo "MISSING: $path"
done
# 期待: 出力なし
```

### 1-5. editor.sh のテストパス存在確認

```bash
# editor.sh が指定する全テストファイルが実在するか
grep '\.spec\.ts' scripts/test/local/editor.sh | sed 's/.*  //' | sed 's/ \\//' | while read path; do
  [ -z "$path" ] && continue
  [ "$path" = '"$@"' ] && continue
  [ -f "$path" ] || echo "MISSING: $path"
done
# 期待: 出力なし
```

### 1-6. check-e2e-sync.sh のマッピング存在確認

```bash
# マッピング内のテストファイルが全て実在するか
grep 'tests/' scripts/test/check-e2e-sync.sh | tr ',' '\n' | grep 'tests/' | sed 's/.*|//' | while read path; do
  [ -z "$path" ] && continue
  [ -f "$path" ] || echo "MISSING: $path"
done
# 期待: 出力なし
```

---

## Phase 2: ビルド・型チェック

```bash
# TypeScript 型チェック（全パッケージ）
npm run typecheck
# 期待: エラーなし

# Lint
npm run lint
# 期待: エラーなし
```

---

## Phase 3: ユニットテスト

```bash
# 全パッケージのユニットテスト
npm test
# 期待: 全テスト pass（パス変更の影響でインポートが壊れていないか）
```

---

## Phase 4: スクリプト実行テスト（サーバー不要）

### 4-1. husky pre-commit hook

```bash
# 空コミットで pre-commit hook が動くか
git commit --allow-empty -m "test: pre-commit hook verification" --dry-run
# 期待: "All pre-commit checks passed!" が表示される
```

### 4-2. e2e.sh のルックアップテーブル

```bash
# 短縮名でテストファイルが解決されるか（dry-run 的に確認）
bash -c '
  source scripts/test/local/e2e.sh <<< "n"  # "Continue anyway?" に N で中断
' 2>&1 | head -5
# 期待: サーバーチェックまで到達する（パス解決エラーなし）
```

### 4-3. CLI スクリプトのヘルプ表示

```bash
# ブロック CLI
node scripts/cli/block/editor-cli.mjs 2>&1 | head -1
# 期待: Usage 表示

# マップ CLI
node scripts/cli/map/map-cli.mjs 2>&1 | head -1
# 期待: Usage or 正常動作
```

---

## Phase 5: E2E テスト（要サーバー起動）

サーバー起動後に実行:
```bash
./scripts/dev-start.sh all
```

### 5-1. ローカルテスト Phase 1（ヘルスチェック）

```bash
./scripts/test/local/health.sh
# 期待: 全サービス ✅
```

### 5-2. ローカルテスト Phase 2（ユニット）

```bash
./scripts/test/local/unit.sh
# 期待: 全テスト pass
```

### 5-3. ローカルテスト Phase 5（E2E）— 個別ファイル指定

```bash
./scripts/test/local/e2e.sh mypage
# 期待: ルックアップテーブルから tests/shared/flow/mypage.spec.ts を解決して実行
```

### 5-4. ローカルテスト Phase 6（エディタ）

```bash
./scripts/test/local/editor.sh
# 期待: 28個のテストパスが全て解決され実行される
```

### 5-5. ローカルテスト Phase 7（認証）

```bash
./scripts/test/local/auth.sh
# 期待: 3ファイルの認証テストが実行される
```

### 5-6. 統合テスト（Phase 1 のみ）

```bash
./scripts/test/local/run-all.sh --phase 1
# 期待: Phase 1 Health Check が実行される
```

### 5-7. Playwright config の動作確認

```bash
# local config がテストを検出するか
npx playwright test -c tests/configs/playwright.local.config.ts --list 2>&1 | tail -3
# 期待: テスト一覧が表示される（0 tests ではない）

# azure config がテストを検出するか
npx playwright test -c tests/configs/playwright.azure.config.ts --list 2>&1 | tail -3
# 期待: テスト一覧が表示される
```

---

## Phase 6: スキル動作確認

手動で各スキルが新パスを参照しているか確認:

| スキル | 確認コマンド |
|-------|------------|
| `edit-blocks` | `grep 'scripts/cli/block' .claude/skills/edit-blocks/skill.md` |
| `map` | `grep 'scripts/cli/map' .claude/skills/map/skill.md` |
| `test-azure` | `grep 'scripts/test/azure' .claude/skills/test-azure/skill.md` |
| `deploy-azure` | `grep 'scripts/test/deploy-verify\|scripts/deploy/' .claude/skills/deploy-azure/skill.md` |
| `stream` | `grep 'scripts/stream/' .claude/skills/stream/skill.md` |
| `youtube-upload` | `grep 'scripts/stream/' .claude/skills/youtube-upload/skill.md` |
| `rag-search` | `grep 'scripts/rag/' .claude/skills/rag-search/skill.md` |

---

## 実施順序と判定基準

| Phase | 内容 | 所要時間 | 判定 |
|-------|------|---------|------|
| 1 | 静的検証（パス残存チェック） | 1分 | grep 出力なし |
| 2 | typecheck + lint | 2分 | エラー 0 |
| 3 | ユニットテスト | 3分 | 全 pass |
| 4 | スクリプト実行テスト | 1分 | エラーなし |
| 5 | E2E テスト | 5分 | 全 pass |
| 6 | スキル参照確認 | 1分 | 全パス新形式 |

### 全 Phase 通過 → 整理完了として確定
### Phase 1-4 で問題発見 → サーバー不要で即修正可能
### Phase 5 で問題発見 → テストパスの修正漏れを特定して修正
