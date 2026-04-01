# Web 認証設計の業界標準と現状の位置づけ

**作成日**: 2026-02-18

---

## 1. 結論

**部品ごとの標準はある。組み合わせ方の標準はない。**

「SPA + 別オリジン API + 別アプリのエディタ」のような構成をどう繋ぐかの統一規格は存在しない。各プロジェクトが RFC の部品を組み合わせて「うちはこう決めた」とやるのが現実。

---

## 2. 標準仕様の一覧

### 確立された RFC・仕様

| 部品 | 標準 | 概要 |
|------|------|------|
| JWT の形式 | **RFC 7519** | JSON Web Token の構造・署名・クレーム定義 |
| Bearer Token の送り方 | **RFC 6750** | `Authorization: Bearer <token>` ヘッダーの仕様 |
| OAuth 2.0 フロー | **RFC 6749** | Authorization Code, Client Credentials 等の認可フロー |
| OAuth 2.0 セキュリティ BCP | **RFC 9700** | Refresh Token Rotation、PKCE 等のベストプラクティス |
| Cookie 属性 | **RFC 6265bis** | HttpOnly, Secure, SameSite の仕様 |
| JWS (署名) | **RFC 7515** | JWT の署名検証方式 |
| JWE (暗号化) | **RFC 7516** | JWT の暗号化方式（任意） |
| OpenID Connect | **OIDC Core 1.0** | OAuth 2.0 上のID認証レイヤー |
| PKCE | **RFC 7636** | 認可コード横取り攻撃の防止 |

### 標準が存在しない領域

| 問題 | 状況 |
|------|------|
| SPA でトークンをどこに保存するか | localStorage vs メモリ vs Cookie — 議論が継続中 |
| マルチアプリ間の認証引き渡し | 構成ごとに異なるため標準化不可能 |
| BFF をどこに置くか | Next.js, 専用 API, API Gateway — プロジェクト依存 |
| Access Token の有効期限 | 5分〜24時間 — プロジェクトが「決め打ち」する |
| Cookie vs Bearer どちらを使うか | セキュリティ要件と構成による |

---

## 3. 業界の実態

### 認証を「設計しない」のが主流

実際の Web 開発プロジェクトの大多数は、認証を自前実装しない。

| サービス | 方式 | 特徴 |
|----------|------|------|
| **Auth0** | OAuth 2.0 / OIDC | エンタープライズ向け、高機能 |
| **Clerk** | セッション Cookie | Next.js 特化、開発体験重視 |
| **Firebase Auth** | JWT + SDK | Google エコシステム統合 |
| **Supabase Auth** | JWT + Cookie | PostgreSQL 統合 |
| **NextAuth.js (Auth.js)** | セッション / JWT 選択可 | OSS、Next.js 向け |

これらを使えば「Cookie か JWT か」「トークンの保管場所は」といった設計判断を丸投げできる。

### 自前実装が必要なケース

以下の条件に該当すると自前設計が避けられない：

- 複数アプリ（SPA + SSR + API）を跨ぐ認証
- 独自のトークン戦略が必要
- 外部サービスに依存できないセキュリティ要件
- Switch 等のプラットフォーム移植を見据えた抽象化

**本プロジェクト（kaedevn）は全てに該当する。**

---

## 4. 現在の kaedevn の認証設計の位置づけ

### 採用している標準

| 部品 | 準拠する標準 | 実装状況 |
|------|-------------|---------|
| JWT 形式 | RFC 7519 | `jsonwebtoken` ライブラリで HS256 署名 |
| Bearer Token 送信 | RFC 6750 | `Authorization: Bearer <token>` ヘッダー |
| Auth Code Exchange | RFC 6749 の Authorization Code Flow に類似 | 30秒有効・1回限りコード |
| CORS 設定 | Fetch Standard | 許可オリジン固定 + `credentials: true` |

### 現在の設計判断（「決め打ち」した部分）

| 判断項目 | 採用した方式 | 根拠 |
|----------|------------|------|
| トークン保管 | localStorage | 実装の単純さ（Phase 2 で改善予定） |
| Access Token 有効期限 | 24時間 | 7日から短縮。ユーザー体験とのバランス |
| Refresh Token | なし | 現段階では過剰。Phase 2 で導入予定 |
| サーバー側ログアウト | なし | ユーザー規模が小さい段階では不要 |
| アプリ間認証 | Auth Code Exchange | URL トークン漏洩を防止 |
| BFF | Hono API が担当 | Next.js BFF ではないが同等の役割 |

---

## 5. 設計判断が難しい理由

### トレードオフの構造

認証設計はセキュリティ・利便性・実装コストの三方トレードオフになる。

```
        セキュリティ
           ▲
          / \
         /   \
        /     \
       /  理想  \
      /   だが   \
     /  実装困難  \
    ▼─────────────▼
利便性           実装コスト
```

| 方式 | セキュリティ | 利便性 | 実装コスト |
|------|------------|--------|-----------|
| HttpOnly Cookie + Refresh Rotation | 高 | 中（リロード時自動回復） | **高** |
| JWT localStorage + 24h | 中 | 高（単純） | **低** |
| 外部サービス (Auth0 等) | 高 | 高 | **低**（ただし依存） |

### なぜ「正解が1つ」にならないか

- **構成が違えば最適解が違う**: 単一アプリ vs マルチアプリで設計が根本的に異なる
- **リスク許容度が違う**: 銀行アプリと個人ツールでは求められるセキュリティレベルが違う
- **ステージが違う**: MVP と10万ユーザーのサービスでは必要な堅牢性が違う

---

## 6. kaedevn の現在のセキュリティレベル（客観評価）

### 対応済み

- [x] パスワードハッシュ化（bcrypt, salt rounds 10）
- [x] JWT 署名検証（HS256）
- [x] CORS オリジン制限
- [x] Auth Code Exchange（URL トークン漏洩防止）
- [x] JWT 有効期限短縮（24時間）
- [x] ユーザー停止（suspended）チェック
- [x] 管理者権限分離（adminMiddleware）
- [x] SQL インジェクション対策（Prisma パラメータバインド）
- [x] SELECT 専用クエリ制限（admin query）

### 未対応（Phase 2 以降）

- [ ] XSS 対策強化（CSP ヘッダー）
- [ ] HttpOnly Cookie 移行
- [ ] Refresh Token + Rotation
- [ ] サーバー側ログアウト（トークン revoke）
- [ ] Rate limiting（ブルートフォース対策）

### 評価

**MVP ～ 初期ユーザー向けサービスとしては十分なセキュリティレベル。**
ユーザー規模が拡大した段階、またはセキュリティ監査を受ける段階で Phase 2 を実施すればよい。

---

## 7. 参考文献

- [RFC 7519 - JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [RFC 6750 - Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)
- [RFC 6749 - OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 9700 - OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
