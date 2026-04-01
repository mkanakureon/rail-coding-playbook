# Cloud Editor の配置戦略：共有コアと非公開アダプターの分離

## 1. 概要
「クラウド上で直接編集できるエディタ（Cloud Editor）」を、OSS版のエディタとどのように差別化し、非公開リポジトリ（kaedevn-cloud）で管理すべきかを分析しました。

## 2. リポジトリ間の役割分担

### A. kaedevn-oss（公開）: Editor Core
- **コンポーネント**: `packages/editor-core`
- **内容**: UIコンポーネント（タイムライン、プレビュー、プロパティパネル）、基本編集ロジック、スクリプトエディタ。
- **意図**: 汎用的なエディタ機能をOSS化し、世界中の開発者からUI改善や新機能の貢献を受ける。

### B. kaedevn-cloud（非公開）: Cloud Editor App
- **コンポーネント**: `apps/cloud-editor`
- **内容**: 
  - `editor-core` を利用した統合アプリ。
  - クラウド保存用アダプター（Azure Blob/PostgreSQL 連携）。
  - ユーザー認証・権限管理（Auth0/NextAuth等）。
  - リアルタイム共同編集サーバー（WebSocket/WebRTC）。
- **意図**: プラットフォーム固有の機密ロジック（保存先、認証、通信）を非公開リポジトリに完全に隠蔽し、セキュリティを担保する。

## 3. アダプターパターンによる抽象化
OSS版とクラウド版で同一のコードベースを維持するため、保存や通信を抽象化（Interface化）します。

```typescript
// packages/core (OSS) で定義
interface IStorageAdapter {
  saveProject(data: ProjectData): Promise<void>;
  loadProject(id: string): Promise<ProjectData>;
}

// apps/local-studio (OSS) での実装
class FileSystemAdapter implements IStorageAdapter {
  // ローカルファイルシステムへの書き込み
}

// apps/cloud-editor (Private) での実装
class CloudStorageAdapter implements IStorageAdapter {
  // 非公開APIを通じたクラウド保存
}
```

## 4. この戦略の利点
- **セキュリティ**: クラウド版の保存先URLや認証プロトコルがOSS側に漏洩することを物理的に防ぎます。
- **開発効率**: AIエージェント（Claude Code等）は、この抽象化レイヤーを理解することで、OSSコアの機能追加とクラウド版の対応を同時に実行できます。
- **ブランディング**: 「ローカルで動く無料版」と「クラウドで便利な公式版」という、ユーザーへの価値提供の差別化が明確になります。

## 結論
「製品としてのエディタ」は非公開リポジトリに配置し、その「エンジン（コア）」をOSSとして開放することが、安全性とコミュニティの熱量を両立させるための最適なアーキテクチャです。
