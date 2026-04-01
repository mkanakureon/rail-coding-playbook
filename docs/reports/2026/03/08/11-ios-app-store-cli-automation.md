# iOS アプリリリース・App Store 提出の CLI 自動化 調査レポート

**調査日: 2026-03-08**

## 1. 主要 CLI ツール一覧

| ツール | 提供元 | 用途 |
|--------|--------|------|
| **xcodebuild** | Apple (Xcode CLI Tools) | ビルド・アーカイブ・テスト実行 |
| **xcrun altool** | Apple (Xcode CLI Tools) | App Store / TestFlight へのビルドアップロード |
| **Transporter** | Apple | ビルドアップロード（JWT 認証対応） |
| **fastlane** | OSS (Ruby) | ビルド・署名・スクショ生成・メタデータ管理・アップロード・提出の統合自動化 |
| **fastlane match** | OSS (fastlane の一部) | 証明書・プロビジョニングプロファイルの一元管理（Git/S3/GCS 保存） |
| **App Store Connect API** | Apple (REST API) | メタデータ・IAP・サブスク・ビルド管理・TestFlight・提出の API 操作 |

## 2. リリース工程ごとの自動化レベル

### 凡例

- **CLI完全自動化**: Claude Code で人間の介入なく完了可能
- **CLI部分自動化**: CLI で主要操作は可能だが一部手動ステップあり
- **手動必須**: Web UI または人間の判断が必要

---

### 2.1 証明書・プロビジョニングプロファイル管理

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| 証明書の作成 | **CLI完全自動化** | App Store Connect API / fastlane `cert` / `match` | |
| プロビジョニングプロファイル作成 | **CLI完全自動化** | App Store Connect API / fastlane `sigh` / `match` | |
| チーム間の証明書共有 | **CLI完全自動化** | fastlane match（Git/S3/GCS に暗号化保存） | |
| Apple Developer Program 登録 | **手動必須** | Apple Web ポータル | 初回登録・年次更新 |

### 2.2 ビルド

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| xcodebuild ビルド | **CLI完全自動化** | `xcodebuild archive` | |
| IPA エクスポート | **CLI完全自動化** | `xcodebuild -exportArchive` | |
| exportOptionsPlist 作成 | **CLI完全自動化** | テンプレートファイル生成 | |

### 2.3 コード署名

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| 自動署名 | **CLI完全自動化** | `CODE_SIGN_STYLE=Automatic` | |
| 手動署名 | **CLI完全自動化** | fastlane match + xcodebuild | |
| Keychain 操作 | **CLI完全自動化** | `security create-keychain`, `security import` | CI 環境にも対応 |

### 2.4 App Store リスティング作成

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| アプリ名・説明・キーワード | **CLI完全自動化** | App Store Connect API / fastlane `deliver` | 多言語対応 |
| スクリーンショットアップロード | **CLI完全自動化** | API / fastlane `deliver` | 各デバイスサイズ最大10枚 |
| スクリーンショット自動撮影 | **CLI完全自動化** | fastlane `snapshot` | シミュレータ使用 |
| アプリプレビュー動画 | **CLI完全自動化** | API | 最大3本/デバイスサイズ |
| 初回のアプリ作成（App ID 登録） | **CLI完全自動化** | API / fastlane `produce` | |

### 2.5 ビルドのアップロード

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| xcrun altool | **CLI完全自動化** | `xcrun altool --upload-package` | JWT 認証可 |
| Transporter | **CLI完全自動化** | JWT 認証対応 CLI | |
| App Store Connect API（WWDC 2025〜） | **CLI完全自動化** | API 直接アップロード | リアルタイムステータス更新 |
| fastlane | **CLI完全自動化** | `pilot` / `deliver` | 内部で altool/API 使用 |

### 2.6 TestFlight 配信

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| 内部テスターへの配信 | **CLI完全自動化** | API / fastlane `pilot` | |
| 外部テスターグループ管理 | **CLI完全自動化** | API | グループ作成・テスター追加削除 |
| ベータ版のレビュー提出 | **CLI完全自動化** | API | |
| テスターフィードバック取得（WWDC 2025〜） | **CLI完全自動化** | API | スクショ付きフィードバック・クラッシュレポート |

### 2.7 App Store レビュー提出

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| レビューへの提出 | **CLI完全自動化** | API / fastlane `deliver` | `appStoreVersionSubmissions` |
| 段階的リリース | **CLI完全自動化** | API | 作成・一時停止・再開・完了 |
| 手動リリース（承認後の公開） | **CLI部分自動化** | API | 自動リリース設定なら不要。手動リリースの公開は Web UI 必要 |
| **Apple のレビュー審査** | **手動必須** | — | Apple 側の人的判断（通常 24-48 時間、最大 7 日） |

### 2.8 アプリメタデータ管理

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| バージョン情報の更新 | **CLI完全自動化** | API | 作成・更新・削除 |
| 年齢制限設定 | **CLI完全自動化** | API | |
| 価格・配信地域設定 | **CLI完全自動化** | API | |
| App Privacy 情報 | **CLI完全自動化** | API | |
| カテゴリ設定 | **CLI完全自動化** | API | |
| Webhook 通知（WWDC 2025〜） | **CLI完全自動化** | API | ビルド/バージョン/TestFlightステータス変更通知 |

### 2.9 App Review リジェクト対応

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| リジェクト理由の確認 | **CLI部分自動化** | API（ステータスのみ） | 詳細テキストは Web UI |
| Apple への返信・異議申し立て | **手動必須** | App Store Connect Web UI | API 非対応 |
| Developer Reject（自主取り下げ） | **手動必須** | Web UI のみ | API 非対応 |
| 修正後の再提出 | **CLI完全自動化** | API / fastlane | |

### 2.10 アプリ内課金・サブスクリプション管理

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| IAP の作成・更新・削除 | **CLI完全自動化** | App Store Connect API | REST API（XML フィード廃止済み） |
| サブスクリプション作成 | **CLI完全自動化** | API | グループ・価格設定含む |
| サブスクリプション価格変更 | **CLI完全自動化** | API | |
| IAP のレビュー提出 | **CLI完全自動化** | API | |
| Game Center 設定 | **手動必須** | Web ポータル | |

## 3. App Store Connect API の制限事項

### API 非対応（手動が必要）

| 項目 | 代替手段 |
|------|---------|
| Apple Developer Program の初回登録・更新 | Apple Web ポータル |
| App Review リジェクトへの返信・異議申し立て | App Store Connect Web UI |
| Developer Reject（自主取り下げ） | App Store Connect Web UI |
| 手動リリースの「公開」操作 | Web UI（自動リリース設定で回避可） |
| Game Center 設定 | Web UI |
| 契約・税務・銀行情報の管理 | Web UI |
| Apple の審査プロセス自体 | 待つのみ |

### レート制限

- 1時間あたり 3,600 リクエスト
- 1分あたり約 300-350 リクエスト（非公式）

## 4. Claude Code での実行可能性まとめ

| カテゴリ | Claude Code で自動化 | 前提条件 |
|----------|---------------------|---------|
| ビルド | **可能** | macOS + Xcode 必須 |
| コード署名 | **可能** | fastlane match + Keychain |
| ビルドアップロード | **可能** | altool / API / Transporter |
| TestFlight 配信 | **可能** | API / fastlane pilot |
| メタデータ管理 | **可能** | API / fastlane deliver |
| スクショ自動撮影 | **可能** | fastlane snapshot（シミュレータ必要） |
| IAP/サブスク管理 | **可能** | API 完全対応 |
| レビュー提出 | **可能** | API / fastlane |
| **レビュー審査** | **不可** | Apple の人的プロセス |
| **リジェクト対応** | **不可** | Web UI でのやり取り必須 |
| **Developer 登録・契約管理** | **不可** | Web ポータル + 法的手続き |

## 5. 推奨ツールスタック

```
fastlane match        → 証明書・プロファイル管理
xcodebuild            → ビルド・アーカイブ
fastlane deliver      → メタデータ・スクショ・アップロード・提出
App Store Connect API → IAP/サブスク管理・Webhook・細かい制御
```

fastlane は内部的に App Store Connect API を使用。WWDC 2025 の新機能（ビルドアップロード API、Webhook）は fastlane が未対応の可能性あり。
