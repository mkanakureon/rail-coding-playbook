---
title: "REST APIをAIエージェント対応にする：_ai_contextパターンの実装手順"
tags:
  - claudecode
  - API設計
  - REST
  - AI
  - typescript
private: false
updated_at: ""
id: null
organization_url_name: null
slide: false
ignorePublish: true
---

## はじめに

AIエージェント（Claude Code 等）がプロジェクトのデータを編集するとき、API のレスポンスだけでは情報が足りない。「どのアセットが使えるか」「どのキャラクターがいるか」「ジャンプ先にどのページがあるか」は、人間ならエディタ UI で確認できるが、AI は API レスポンスの JSON しか見えない。

この記事では、既存の REST API に **AI 向けメタデータを動的付与する `_ai_context` パターン**を実装した手順を解説する。

## 前提・環境

| 項目 | 値 |
|------|-----|
| フレームワーク | Hono |
| ORM | Prisma |
| 言語 | TypeScript |
| 対象 API | `GET /api/projects/:id`（プロジェクト詳細） |
| 新規 API | `GET /api/editor-schema`（静的スキーマ） |

## 設計: 2層のメタデータ

| 層 | エンドポイント | 内容 | キャッシュ |
|----|-------------|------|----------|
| 静的スキーマ | `GET /api/editor-schema` | 全14ブロック型の定義・制約・enum | 24時間 |
| 動的コンテキスト | `GET /api/projects/:id` の `_ai_context` | プロジェクト固有の利用可能リソース | リクエスト毎 |

## 手順①: 静的スキーマ API の実装

`/api/editor-schema` は認証不要。全ブロック型のプロパティ定義を返す。

```typescript
// apps/hono/src/lib/editor-schema.ts
export const EDITOR_SCHEMA = {
  version: 1,
  blockTypes: {
    bg: {
      description: "背景画像を設定する",
      properties: {
        assetId: { type: "string", required: true, description: "背景アセットID" },
        fadeMs: { type: "number", required: false, default: 500 },
      },
    },
    ch: {
      description: "キャラクターを表示する",
      properties: {
        characterId: { type: "string", required: true },
        expressionId: { type: "string", required: false },
        pos: { type: "string", enum: ["L", "C", "R"], default: "C" },
      },
    },
    // ... 全14ブロック型
  },
};
```

認証不要にした理由は、スキーマ情報に機密データが含まれないため。AI エージェントが最初にスキーマを取得してからプロジェクトを操作する流れを想定している。

## 手順②: 動的コンテキスト `_ai_context` の付与

既存の `GET /api/projects/:id` のレスポンスに `_ai_context` を追加する。

```typescript
// apps/hono/src/routes/projects.ts（GET ハンドラ内）
const aiContext = {
  schemaEndpoint: "/api/editor-schema",
  availableAssets: {
    backgrounds: assets
      .filter((a) => a.category === "background")
      .map((a) => ({ id: a.id, name: a.name })),
    overlays: assets
      .filter((a) => a.category === "overlay")
      .map((a) => ({ id: a.id, name: a.name })),
  },
  availableCharacters: characters.map((ch) => ({
    id: ch.id, slug: ch.slug, name: ch.name,
    expressions: ch.expressions.map((e) => ({ id: e.id, name: e.name })),
  })),
  availablePages: pages.map((p) => ({ id: p.id, name: p.name })),
  knownVariables: extractVariables(projectData),
};

return c.json({ ...projectData, _ai_context: aiContext });
```

AI エージェントはこの `_ai_context` を見て、背景に使えるアセット ID、キャラクターの表情 ID、ジャンプ先のページ ID を正確に指定できる。

## 手順③: 書き込み時の自動除去（strip on write）

`PUT /api/projects/:id` で AI が `_ai_context` を送り返しても DB に保存しない。

```typescript
// PUT ハンドラ内
const body = await c.req.json();
delete body._ai_context;
delete body._metadata;
// 以降は通常の更新処理
```

**なぜこれが重要か:** AI エージェントは `GET` で取得した JSON をそのまま `PUT` で送り返すことがある。`_ai_context` がそのまま DB に保存されると DB が汚染される。「読み取り時に付与、書き込み時に除去」なら DB は常にクリーン。

## テスト: 7件で round-trip を検証

| # | テスト | 検証内容 |
|---|-------|---------|
| 1 | GET /api/editor-schema | 200, 14ブロック型, Cache-Control |
| 2 | GET /api/projects/:id | `_ai_context` が存在する |
| 3 | PUT with _ai_context | レスポンスに `_ai_context` が含まれない |
| 4 | Re-GET 後 DB 汚染なし | DB 由来の `_ai_context` がない |
| 5 | Preview API 影響なし | 既存エンドポイント正常動作 |
| 6 | 認証不要の確認 | ヘッダーなしで schema アクセス可能 |
| 7 | 複数プロジェクト対応 | プロジェクトごとに固有の context |

全テスト PASS。DB マイグレーション不要。

## まとめ

| パターン | 内容 |
|---------|------|
| 静的スキーマ | 認証不要、24時間キャッシュ、全ブロック型の定義 |
| 動的コンテキスト | リクエスト毎に生成、プロジェクト固有のリソース情報 |
| strip on write | PUT 時に `_ai_context` を自動除去、DB 汚染を防止 |

既存の API を壊さずに AI 対応を追加でき、DB マイグレーションも不要。

---
AI が API を叩く時代になって、API 設計の考え方が少し変わった。
人間は UI で確認できるが、AI は JSON しか見えない。
「見えない情報を見えるようにする」だけで、AI の精度は大きく変わる。
kaedevn のエディタ API にこのパターンを入れてから、AI の編集ミスが明らかに減った。

　　　　　　　　　　Claude Opus 4.6
