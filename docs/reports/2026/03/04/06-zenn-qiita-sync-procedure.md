# Zenn → Qiita 記事同期 手順書・調査レポート

作成日: 2026-03-04

## 概要

Zenn にあって Qiita にない記事を特定し、Qiita フォーマットに変換して `docs/qiita/drafts/` に追加する作業の手順書。

---

## 調査結果（2026-03-04 時点）

### 記事数

| プラットフォーム | ドラフト数 |
|:---:|:---:|
| Zenn (`docs/zenn/drafts/`) | 60 |
| Qiita (`docs/qiita/drafts/`) | 17 → **27**（今回10件追加） |
| 差分（未変換） | **40 件** |

### 同期済みファイル一覧

既存の Qiita 記事は Zenn と**同一ファイル名**で管理されている。差分の特定には `comm` コマンドを使う。

### 今回変換した 10 件（古い順）

| # | ファイル名 | タイトル |
|---|-----------|---------|
| 1 | `01kj1f4nzz-claude-code-6skills-workflow.md` | Claude Code のスキル6本で開発ワークフローを全自動化した話 |
| 2 | `01kj1f4p00-claude-code-skills-workflow.md` | Claude Code のスキルシステムで開発ワークフローを自動化した話 |
| 3 | `01kj1fytet-kaedevn-ks-ksc-interpreter.md` | 自作ノベルゲームエンジン kaedevn — KS・KSC の2言語とインタープリタ開発の記録 |
| 4 | `01kj1hhnq6-azure-transfer-cost-optimization.md` | Azure のサーバー費用を見積もったら転送量が支配的だったので全力で最適化した |
| 5 | `01kj1j55ps-nextjs-spa-mobile-novel-game.md` | Next.js で SPA を選んだ理由 — スマホのノベルゲーム体験を Web で再現するために |
| 6 | `01kj4r9vte-1week-145commits-zero-human-code.md` | 1週間・145コミット・14万行——人間はコードを1行も書いていない |
| 7 | `01kj4xg5xs-why-claude-code-works-for-novel-game.md` | ノベルゲームPF開発がClaude Codeで「異常にうまくいく」構造的理由 |
| 8 | `01kj55xn9x-half-year-zero-code-150k-lines.md` | コードを半年間1行も書いていない——15万行のノベルゲームPFができるまで |
| 9 | `01kj6xw0rm-claude-md-context-design.md` | CLAUDE.md一枚でAI開発が安定する：コンテキスト設計の実例 |
| 10 | `01kj6xw0w7-claude-code-8skills-automation.md` | Claude Code skillsで開発を自動化する（commit/deploy/report/sync/zenn） |

### 残り 40 件（未変換）

```
01kj6z4xbk-ksc-compiler-phase0-to-5.md
01kj6z4xj3-console-test-engine-oss.md
01kj6z4xrg-choice-if-block-editor.md
01kj6z4xyr-monorepo-vn-engine-design.md
01kj6z4y53-ksc-language-design.md
01kj6z4ybg-interpreter-pipeline-design.md
01kj6z4yht-levenshtein-error-handling.md
01kj6z4yra-debug-system-breakpoint-watch.md
01kj6z4yyn-save-schema-frozen-design.md
01kj6z4z53-three-column-preview-sync.md
01kj6z4zbp-op-array-unified-runtime.md
01kj6z4zhz-asset-taxonomy-3tier.md
01kj6z4zrc-24files-5000lines-docs-generation.md
01kj6z4zyr-short-instruction-ai-autopilot.md
01kj6z5054-flywheel-docs-ai-accuracy.md
01kj6z50bg-278commits-1week-zero-human-code.md
01kj6z50j0-commit-message-ai-impression.md
01kj6z50rr-monorepo-oss-sync-automation.md
01kj6z50z1-practice-log-console-test-engine.md
01kj6z515e-practice-log-8-sample-scripts.md
01kj6z51bz-practice-log-compiler-phase0-5.md
01kj6z51jc-practice-log-editor-mobile-ux.md
01kj6z51rv-practice-log-azure-4services.md
01kj6z51zb-practice-log-security-hardening.md
01kj6z525k-practice-log-asset-management.md
01kj6z52c0-oss-30files-docs-ai-strategy.md
01kj6z52jk-readme-as-oss-face.md
01kj6zthqq-fork-only-oss-style.md
01kj6zthzg-6packages-4servers-monorepo.md
01kj6ztj7b-azure-monorepo-deploy-automation.md
01kj6ztjez-playwright-e2e-screenshot.md
01kj6ztjps-react-state-lca-rule.md
01kj6ztjya-278commits-38articles-extraction.md
01kj7kbywh-blueprint-ai-screen-definition.md
01kj8ywf20-deploy-5traps-local-vs-prod.md
01kj8zpsd8-azure-deploy-4fails-no-ci.md
01kj96fz<YOUR_OPENAI_API_KEY>-fail-test-antipattern.md
01kje4nv6z-gemini-claude-sdl2-novel-engine.md
01kjhp4e8v-web-engine-phase2-6-one-day-sprint.md
01kjhp7ea0-glsl-17filters-novel-engine.md
```

---

## 変換手順（再現用）

### 1. 差分の特定

```bash
cd <PROJECT_ROOT>
comm -23 <(ls docs/zenn/drafts/ | sort) <(ls docs/qiita/drafts/ | sort)
```

### 2. フロントマターの変換ルール

Zenn と Qiita の frontmatter フォーマットは以下のように対応する。

**Zenn:**
```yaml
---
title: "記事タイトル"
emoji: "🔧"
type: "tech"
topics: ["claudecode", "typescript", "tag3"]
published: false
---
```

**Qiita:**
```yaml
---
title: "記事タイトル"
tags:
  - claudecode
  - typescript
  - tag3
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---
```

| Zenn フィールド | Qiita フィールド | 変換 |
|---|---|---|
| `title` | `title` | そのまま |
| `emoji` | _(削除)_ | Qiita にはない |
| `type` | _(削除)_ | Qiita にはない |
| `topics` | `tags` | 配列 → YAML リスト形式 |
| `published` | _(削除)_ | `ignorePublish` で制御 |
| _(なし)_ | `private` | `false` 固定 |
| _(なし)_ | `updated_at` | `""` 固定 |
| _(なし)_ | `id` | `null` 固定（公開後に自動付与） |
| _(なし)_ | `organization_url_name` | `null` 固定 |
| _(なし)_ | `slide` | `false` 固定 |
| _(なし)_ | `ignorePublish` | `false`（公開）/ `true`（下書き） |

本文はそのままコピー。

### 3. 一括変換スクリプト

```bash
#!/bin/bash
# Zenn → Qiita frontmatter 一括変換
ZENN_DIR="docs/zenn/drafts"
QIITA_DIR="docs/qiita/drafts"

# 差分ファイルを取得
FILES=$(comm -23 <(ls "$ZENN_DIR" | sort) <(ls "$QIITA_DIR" | sort))

for f in $FILES; do
  src="$ZENN_DIR/$f"
  dst="$QIITA_DIR/$f"

  # title 抽出
  title=$(sed -n 's/^title: *"\(.*\)"/\1/p' "$src")

  # topics → tags 変換
  topics_line=$(sed -n 's/^topics: *\[\(.*\)\]/\1/p' "$src")
  tags=$(echo "$topics_line" | sed 's/"//g' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | sed 's/^/  - /')

  # 本文抽出（2番目の --- 以降）
  body=$(awk 'BEGIN{c=0} /^---$/{c++; if(c==2){found=1; next}} found{print}' "$src")

  # Qiita フォーマットで出力
  cat > "$dst" << EOF
---
title: "$title"
tags:
$tags
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: false
---
$body
EOF

  echo "Created: $f"
done
```

### 4. 動作確認

```bash
# 変換後の件数を確認
echo "Zenn: $(ls docs/zenn/drafts/ | wc -l) / Qiita: $(ls docs/qiita/drafts/ | wc -l)"

# 差分がゼロになっていることを確認（全件変換時）
comm -23 <(ls docs/zenn/drafts/ | sort) <(ls docs/qiita/drafts/ | sort) | wc -l
```

### 5. Qiita リポジトリへのプッシュ（任意）

```bash
gh repo clone mkanakureon/my-qiita-repo /tmp/qiita-repo
git -C /tmp/qiita-repo pull origin main
cp docs/qiita/drafts/{ファイル名} /tmp/qiita-repo/public/{ファイル名}
git -C /tmp/qiita-repo add public/{ファイル名}
git -C /tmp/qiita-repo commit -m "feat: {記事タイトル}を追加"
git -C /tmp/qiita-repo push origin main
```

---

## 注意事項

- **Qiita-only の記事**（`01kjhqf2hf-*`, `01kjhtw5k7-*`, `01kjpx18*`, `01kjscm000-*`）は Zenn に存在しない Qiita 固有記事。逆方向の同期は不要
- `ignorePublish: false` にすると GitHub Actions で自動公開される。下書きのままにしたい場合は `true` にする
- `tags` には `claudecode` を必ず含める（Qiita スキルのルール）
- ファイル名は Zenn と同一にする（ULID ベース）
