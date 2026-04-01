# PR Skill

開発ブランチから main への Pull Request を作成する。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "PRを出して" | main マージ → push → PR 作成 |
| "プルリク作って" | 同上 |
| "PRだして" | 同上 |
| "レビューに出して" | 同上 |

---

## 手順

1. **未コミット変更の確認**
   - `git status` で未コミットの変更がないか確認
   - ある場合はユーザーに commit スキルの使用を提案

2. **main を取り込む**
   ```bash
   git fetch origin main
   git merge origin/main
   ```
   - コンフリクトが発生した場合はユーザーに報告して解決を依頼

3. **typecheck 確認**
   ```bash
   npm run typecheck
   ```
   - 失敗した場合は原因を修正してから再実行

4. **push**
   ```bash
   git push
   ```
   - pre-push フック（typecheck + lint）が自動実行される
   - upstream 未設定の場合は `-u origin {ブランチ名}` を付ける

5. **PR 作成**
   - `git diff main...HEAD --stat` で変更内容を把握
   - `git log main..HEAD --oneline` でコミット一覧を確認
   - `gh pr create` で PR を作成

---

## PR のフォーマット

```bash
gh pr create --title "{タイトル}" --body "$(cat <<'EOF'
## Summary
<変更内容の箇条書き>

## Test plan
- [x] `npm run typecheck` 通過
- [x] `npm run lint` 通過
- [ ] <手動確認項目>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### タイトル
- 70文字以内
- プレフィックス付き（feat: / fix: / refactor: / docs: / chore:）
- 日本語 OK

### 本文
- Summary: 変更内容を箇条書き
- Test plan: typecheck/lint は [x]、手動確認は [ ]

---

## 注意事項

- **main ブランチからは PR を作らない** — 開発ブランチからのみ
- main にいる場合は「開発ブランチに切り替えてください」と伝える
- PR 作成後に URL を返す
