# SPA エディタと Next.js 統合 — アーキテクチャ比較評価

**作成日**: 2026-02-18
**対象**: ChatGPT 推奨設計 vs 現状実装

---

## 1. 全体アーキテクチャ比較

| 項目 | ChatGPT 推奨 | 現状実装 | 一致 |
|------|-------------|---------|------|
| **認証方式** | Cookie セッション (HttpOnly) | JWT Bearer + localStorage | 不一致 |
| **API アクセス** | Editor → Next.js BFF のみ | Editor → Hono API 直接 | 不一致 |
| **Editor の位置** | 別サブドメイン or 別パス | 別アプリ (port 5176) | 概ね一致 |
| **認証の主体** | Next.js が唯一管理 | Next.js + Editor 両方で保持 | 不一致 |
| **Editor ↔ API 間認証** | Cookie 自動送信（引き渡し不要） | ~~URL で JWT 受け渡し~~ Auth Code Exchange | **修正済** |

---

## 2. 現状のアーキテクチャ図

```
                    Next.js (port 3000)                    Editor SPA (port 5176)
                    ┌─────────────────┐                    ┌────────────────────┐
                    │  Login Page     │                    │  EditorPage        │
                    │  (JWT を        │  ── redirect ──>   │  (code を受け取り  │
                    │   localStorage  │  ?code=ONETIME     │   /api/auth/exchange│
                    │   に保存)       │                    │   で JWT 取得)     │
                    │                 │                    │                    │
                    │  AuthContext    │                    │  authFetch()       │
                    │  (GET /auth/me  │                    │  (Bearer token     │
                    │   で検証)       │                    │   を自動付与)      │
                    └────────┬────────┘                    └─────────┬──────────┘
                             │                                      │
                             │  Bearer token                        │  Bearer token
                             │  Authorization header                │  Authorization header
                             ▼                                      ▼
                    ┌──────────────────────────────────────────────────────────┐
                    │                  Hono API (port 8080)                    │
                    │                                                          │
                    │  CORS: localhost:3000, 5173, 5175, 5176                  │
                    │                                                          │
                    │  authMiddleware:                                          │
                    │    1. Bearer token 抽出                                  │
                    │    2. jwt.verify(token, JWT_SECRET)                       │
                    │    3. prisma.user.findUnique({ id: decoded.userId })     │
                    │    4. user.status !== 'suspended' チェック               │
                    │                                                          │
                    │  Auth Code Exchange:                                      │
                    │    POST /auth/code → 30秒有効・1回限りコード発行          │
                    │    POST /auth/exchange → コード → JWT 交換               │
                    └──────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                                        PostgreSQL (Prisma)
```

---

## 3. 項目別の詳細比較

### 3-1. 認証方式: Cookie vs JWT localStorage

| 観点 | ChatGPT 推奨 (Cookie) | 現状 (JWT localStorage) |
|------|----------------------|------------------------|
| XSS でトークン窃取 | **不可能**（HttpOnly） | **可能**（localStorage） |
| サーバー側ログアウト | セッション破棄で即無効 | JWT 7日間有効のまま（ブロックリストなし） |
| CSRF 攻撃 | **対策必要**（SameSite + token） | 不要（Bearer header 方式） |
| SSR/RSC との相性 | Cookie は自動送信で SSR 対応 | localStorage は Edge/SSR で読めない |
| 実装の単純さ | セッション管理が必要 | ステートレスで単純 |

**評価**: セキュリティは Cookie 方式が優れるが、CSRF 対策のコストが増える。現状は XSS リスクがあるが CSRF は安全。

### 3-2. API アクセス経路: BFF vs 直接

| 観点 | ChatGPT 推奨 (Next.js BFF) | 現状 (Hono API 直接) |
|------|---------------------------|---------------------|
| 構成 | Editor → Next.js → DB | Editor → Hono → DB |
| 認証一元化 | Next.js で Cookie 検証 | Hono の authMiddleware で JWT 検証 |
| CORS | 同一オリジンなら不要 | 別オリジンなので必要 |
| バックエンドの役割 | Next.js が BFF | **Hono が BFF** |

**評価**: ChatGPT は「Next.js を BFF にする」前提だが、現状の Hono API は実質 BFF の役割を果たしている。Editor が DB/Storage に直接触っていない点は推奨設計と一致。**Hono が BFF であること自体は問題ない**。

### 3-3. Editor ↔ Next.js 間のトークン受け渡し

| 観点 | ChatGPT 推奨 | 変更前 | 変更後（対応済） |
|------|-------------|--------|----------------|
| 方式 | Cookie 共有（引き渡し不要） | URL に JWT を付与 | Auth Code Exchange |
| URL 漏洩リスク | なし | **JWT 7日間有効** | コード 30秒 + 1回限り |
| ブラウザ履歴 | 安全 | JWT が残る | 無効なコードのみ |
| Referer 漏洩 | 安全 | JWT 窃取可能 | コード既に使用済み |

**評価**: Auth Code Exchange 導入により、URL 漏洩リスクは実質的に解消。Cookie 方式と同等のセキュリティレベルに到達。

### 3-4. 認証ガード

| 観点 | ChatGPT 推奨 | 現状 |
|------|-------------|------|
| Next.js middleware | Cookie 検証（サーバーサイド） | **no-op**（パススルー） |
| 認証判定の場所 | サーバーサイド | クライアントサイド（AuthContext） |
| SSR 保護 | あり | なし |

**評価**: 現状は全ページ `'use client'` なので実害はない。将来 SSR/RSC を活用する場合はサーバーサイドガードが必要になる。

### 3-5. 認証情報の保管場所

| 観点 | ChatGPT 推奨 | 現状 |
|------|-------------|------|
| トークン保管 | Cookie（1箇所） | localStorage（Next.js + Editor 各自） |
| リフレッシュ | セッション更新（サーバー側） | なし（JWT 7日で期限切れ） |
| 無効化 | サーバーでセッション削除 | 不可（JWT は自己完結） |

**評価**: 現状は「複数アプリが各自 localStorage に JWT を持つ」構成。トークン無効化ができない点が最大の弱点。

---

## 4. リスク評価マトリクス

| リスク | 深刻度 | 発生確率 | 対応状況 |
|--------|--------|----------|----------|
| URL でのトークン漏洩 | 高 | 中 | **対応済**（Auth Code Exchange） |
| XSS による JWT 窃取 | 高 | 低 | 未対応（Phase 2） |
| サーバー側ログアウト不可 | 中 | 低 | 未対応（Phase 2） |
| CORS 設定ミス | 中 | 低 | 環境変数で制御済み |
| JWT 長期有効（7日） | 中 | 低 | 未対応（Phase 2） |
| SSR での認証未保護 | 低 | 低 | 全ページ CSR なので実害なし |

---

## 5. 総合評価

### 現状の判定

| 評価軸 | 判定 |
|--------|------|
| **今すぐ壊れるか？** | No — 動作している |
| **本番運用可能か？** | Yes — Auth Code Exchange 対応済み |
| **セキュリティリスク** | 中 — XSS 対策は Phase 2 |
| **スケーラビリティ** | 問題なし — Hono API が BFF として機能 |
| **メンテナビリティ** | 良好 — 3アプリの責務が明確 |

### ChatGPT 推奨との乖離度

```
完全一致 ■■■□□□□□□□ 理想設計
         ↑ 現状はここ（30%一致）

ただし実用上の問題はない。
```

**一致している点**:
- Editor は別アプリとして分離されている
- Editor が DB/Storage に直接触らない
- 認証処理はバックエンド（Hono）に集約

**乖離している点**:
- Cookie セッション vs JWT localStorage
- Next.js BFF vs Hono API 直接
- サーバーサイド認証ガード vs クライアントサイドのみ

---

## 6. 改善ロードマップ

### 対応済み（2026-02-18）

- [x] URL トークン渡し廃止 → Auth Code Exchange 方式に移行
- [x] 計画書作成: `docs/09_reports/2026/02/18/auth-code-exchange-plan.md`

### Phase 2（推奨・別タスク）

| 項目 | 内容 | 優先度 | 工数 |
|------|------|--------|------|
| JWT 有効期限短縮 | 7日 → 1時間 + リフレッシュトークン | 高 | 中 |
| HttpOnly Cookie 移行 | localStorage → Cookie で XSS 対策 | 中 | 大 |
| サーバー側ログアウト | トークンブロックリスト or セッション DB | 中 | 中 |
| Nginx 同一ドメイン統合 | 本番で CORS 不要化 | 低 | 小 |
| Next.js middleware 認証 | SSR/RSC 対応（将来必要になった場合） | 低 | 小 |

### 移行の判断基準

Cookie セッション方式への全面移行は以下の条件が揃った場合に実施:
- SSR/RSC でサーバーサイドレンダリングが必要になった
- ユーザー数が増え、アカウント停止の即時反映が求められた
- セキュリティ監査で XSS 対策が要件になった

現時点では **JWT + Auth Code Exchange で十分な安全性** を確保できている。

---

## 7. 参考: ChatGPT 推奨設計の原文

`docs/01_in_specs/0218/SPAエディタとNext.js統合.md` を参照。
