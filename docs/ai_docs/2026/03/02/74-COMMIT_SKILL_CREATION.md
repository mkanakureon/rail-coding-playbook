# コミット Skill の作成記録

## 概要
Claude Code に実装されていた「コミットスキル」を Gemini CLI 向けに移植し、プロジェクト独自のコミットルール（プレフィックス、日本語、Geminiの一言など）を自動適用できるようにしました。

## 構成
- **場所**: `.agents/skills/commit/SKILL.md`
- **内容**: 
  - `git add` → `git commit` の自動化。
  - プレフィックス (`feat:`, `fix:`, `docs:` 等) の自動付与。
  - コミットメッセージ末尾への「Gemini CLI の一言」の強制。
  - プレコミットフック（URLチェック）の考慮。

## インストール手順
1. `gemini skills install commit.skill --scope workspace` を実行。
2. `/skills reload` でスキルを有効化。

## 以降のワークフロー
「コミットして」「全部コミットして」などの言葉でこのスキルが起動し、定められたフォーマットで安全にコミットが行われます。
