---
description: Use when the user asks to push commits to the remote repository. Triggers on "pushして", "プッシュ", "GitHubに上げて", "リモートに反映".
---

# Push Skill

作業中のリポジトリをリモートにプッシュする。

## トリガー

| ユーザーの表現 | 動作 |
|---|---|
| "pushして" | 現在のブランチをプッシュ |
| "プッシュして" | 同上 |
| "GitHubに上げて" | 同上 |
| "リモートに反映して" | 同上 |
| "上げておいて" | 同上 |

---

## 手順

1. `git status` で未コミットの変更がないか確認
   - 未コミットがある場合は commit スキルを先に発動するか確認する
2. `git branch --show-current` で現在のブランチを確認
3. `git push origin {ブランチ名}` を実行

```bash
git push origin $(git branch --show-current)
```

---

## 注意事項

- **pre-push フック**が typecheck + lint を自動実行する。失敗したら push はブロックされる
  - フック失敗時は原因を修正してから再 push する（`--no-verify` は使わない）
  - よくある失敗: TS 型エラー → `npm run typecheck` で確認・修正、lint エラー → `npm run lint` で確認・修正
- **main ブランチへの push はユーザーに確認してから実行する**
  - 「main に push します。よいですか？」と一言確認する
- `--force` / `--force-with-lease` はユーザーが明示的に要求した場合のみ使う
- push 先が upstream に設定されていない場合は `-u origin {ブランチ}` を付ける

---

## 対象リポジトリ

このスキルはメインリポジトリ（kaedevn-monorepo）を対象とする。

Zenn リポジトリ（`/tmp/zenn-repo`）へのプッシュは zenn スキルが担う。

---

## push 後の確認

```bash
git log --oneline -3   # 直近3件で push 内容を確認
```
