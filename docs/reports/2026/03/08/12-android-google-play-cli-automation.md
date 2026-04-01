# Android アプリリリース・Google Play Store 提出の CLI 自動化 調査レポート

**調査日: 2026-03-08**

## 1. 主要 CLI ツール一覧

| ツール | 種別 | 開発元 | 概要 |
|--------|------|--------|------|
| **Gradle** | ビルドツール | Google (公式) | `assembleRelease` / `bundleRelease` でビルド・署名 |
| **bundletool** | CLIツール | Google (公式) | AAB → APK 変換、デバイスインストール |
| **keytool** | CLIツール | Oracle (JDK付属) | Keystore 生成・管理 |
| **Google Play Developer API v3** | REST API | Google (公式) | Publishing API + Monetization API |
| **fastlane supply** | CLIツール | fastlane (OSS) | メタデータ・バイナリのアップロード、トラック管理 |
| **Gradle Play Publisher (GPP)** | Gradle プラグイン | Triple-T (OSS) | ビルド→アップロード→プロモートを一気通貫 |
| **playconsole-cli (gpc)** | CLIツール | AndroidPoet (OSS) | 30コマンドグループ・80+サブコマンド。JSON/CSV/YAML出力 |

## 2. リリース工程ごとの自動化レベル

### 凡例

- **CLI完全自動化**: Claude Code で人間の介入なく完了可能
- **CLI部分自動化**: CLI で主要操作は可能だが一部手動ステップあり
- **手動必須**: Play Console Web UI または人間の判断が必要

---

### 2.1 署名（Signing）

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| Keystore 生成 | **CLI完全自動化** | `keytool -genkey` | 全パラメータをフラグ指定可 |
| Upload Key での署名 | **CLI完全自動化** | Gradle `signingConfigs` | 環境変数でパスワード注入 |
| Play App Signing 有効化 | **手動必須（初回のみ）** | Play Console Web UI | 初回 opt-in のみ手動 |
| 署名鍵のローテーション | **CLI部分自動化** | Play Developer API | リクエスト可能だが承認は Google 側 |

### 2.2 ビルド（Building）

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| AAB ビルド | **CLI完全自動化** | `./gradlew bundleRelease` | |
| APK ビルド | **CLI完全自動化** | `./gradlew assembleRelease` | AAB 推奨 |
| AAB → APK 変換 | **CLI完全自動化** | `bundletool build-apks` | テスト用 |
| バージョンコード自動インクリメント | **CLI完全自動化** | Gradle / fastlane / GPP | |

### 2.3 Play Store 掲載情報の作成

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| アプリ作成（初回） | **手動必須** | Play Console Web UI | アプリ名・カテゴリ・無料/有料 |
| アプリの説明文 | **CLI完全自動化** | fastlane supply / GPP / API | 多言語対応 |
| スクリーンショット | **CLI完全自動化** | fastlane supply / GPP / API | ディレクトリから自動アップロード |
| フィーチャーグラフィック | **CLI完全自動化** | fastlane supply / GPP | |
| コンテンツレーティング質問票 | **手動必須** | Play Console Web UI | IARC 質問回答 |
| データセーフティフォーム | **手動必須** | Play Console Web UI | プライバシー宣言 |
| ターゲットオーディエンス設定 | **手動必須** | Play Console Web UI | 子供向け設定等 |

**注意:** fastlane supply は**初回は Play Console で手動アップロードが必要**。初回後から API 操作可能。

### 2.4 ビルドのアップロード

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| AAB/APK アップロード | **CLI完全自動化** | fastlane supply / GPP / API | |
| リリースノート添付 | **CLI完全自動化** | 同上 | 多言語対応 |
| OBB ファイルアップロード | **CLI完全自動化** | Publishing API | 拡張ファイル |

```bash
# fastlane supply
fastlane supply --aab app.aab --track internal --json_key key.json

# Gradle Play Publisher
./gradlew publishBundle --track internal

# playconsole-cli
gpc bundles upload --file app.aab --track internal
```

### 2.5 トラック管理（Internal / Alpha / Beta / Production）

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| Internal テスト | **CLI完全自動化** | `--track internal` | 審査なし即配信 |
| Closed テスト（Alpha） | **CLI完全自動化** | `--track alpha` | |
| Open テスト（Beta） | **CLI完全自動化** | `--track beta` | |
| Production リリース | **CLI完全自動化** | `--track production` | |
| トラック間プロモート | **CLI完全自動化** | fastlane / GPP / gpc | `gpc tracks promote --from internal --to production --rollout 10` |
| 段階的ロールアウト（%指定） | **CLI完全自動化** | 同上 | `--rollout_percentage 10` |
| ロールアウト停止（Halt） | **CLI完全自動化** | API / gpc | 2025年〜 100%リリース済みでも停止可能 |
| ロールアウト再開 | **CLI完全自動化** | 同上 | |
| カスタムトラック作成 | **CLI完全自動化** | Publishing API | 任意名のテストトラック |

### 2.6 Play Store 審査への提出

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| 審査提出 | **CLI完全自動化** | Publishing API（edits.commit） | アップロード + トラック設定 → commit |
| 審査状況の確認 | **CLI部分自動化** | Publishing API | トラックステータス確認可。詳細進捗は不可 |
| 審査結果の通知 | **手動確認** | Play Console メール | リアルタイム通知なし |

**iOS との違い:** Internal/Closed テストは審査なし即配信。Production のみ審査対象（通常数時間〜数日）。

### 2.7 アプリメタデータ管理

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| タイトル・説明文の更新 | **CLI完全自動化** | fastlane supply / GPP / API | 多言語一括 |
| スクリーンショット更新 | **CLI完全自動化** | 同上 | |
| What's New（更新情報） | **CLI完全自動化** | 同上 | |
| カテゴリ変更 | **手動必須** | Play Console Web UI | API 非対応 |
| 価格変更 | **手動必須** | Play Console Web UI | 無料→有料変更不可 |

### 2.8 審査リジェクション対応

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| リジェクション通知 | **手動確認** | メール / Play Console | API 検知困難 |
| 異議申し立て（Appeal） | **手動必須** | Play Console Web UI / メール | API なし |
| 修正後の再提出 | **CLI完全自動化** | fastlane / GPP / API | |
| ポリシー違反詳細確認 | **手動必須** | Play Console Web UI | |

### 2.9 アプリ内課金・サブスクリプション管理

| 工程 | 自動化レベル | ツール | 備考 |
|------|-------------|--------|------|
| 一回限りの商品（IAP）作成・更新 | **CLI完全自動化** | Publishing API (`inappproducts`) | CRUD 全対応 |
| サブスクリプション作成 | **CLI完全自動化** | Publishing API (`monetization.subscriptions`) | 2024年〜新API |
| ベースプラン管理 | **CLI完全自動化** | API | 複数プラン対応 |
| オファー管理 | **CLI完全自動化** | API | 紹介価格・プロモ |
| アーカイブ・削除 | **CLI完全自動化** | API | |
| 購入状況の照会 | **CLI完全自動化** | API (`purchases.subscriptionsv2`) | |
| 返金処理 | **CLI完全自動化** | Voided Purchases API | |
| 価格テンプレート管理 | **手動必須** | Play Console Web UI | 地域別一括設定 |

**注意:** Monetization API は「edits」トランザクションモデルを使わない。変更は即座に反映される。

## 3. Google Play Developer API の制限事項

### API 非対応（手動が必要）

| 項目 | 代替手段 |
|------|---------|
| アプリ作成（初回） | Play Console Web UI |
| コンテンツレーティング | Play Console Web UI（IARC 質問票） |
| データセーフティ | Play Console Web UI |
| カテゴリ変更 | Play Console Web UI |
| 審査申し立て | Play Console Web UI / メール |
| 開発者アカウント管理 | Play Console Web UI |
| 価格テンプレート | Play Console Web UI |

### レート制限

- edits は 1日あたりの上限あり
- alpha/beta 更新は 1日1回以下を推奨
- Production はさらに低頻度推奨

## 4. 初回リリース時の手動必須ステップ

完全に CLI のみでゼロからリリースすることは**不可能**。以下は初回のみ手動が必要:

1. **Google Play Developer アカウント登録**（$25、Web UI）
2. **Play Console でアプリ作成**（アプリ名・カテゴリ・無料/有料設定）
3. **Play App Signing の有効化**（opt-in）
4. **コンテンツレーティング質問票の回答**（IARC）
5. **データセーフティフォームの記入**
6. **初回ビルドの手動アップロード**（fastlane supply の前提条件）
7. **新規個人アカウント**: Closed テスト 12人×14日 + 実機認証（2025年〜）

**2回目以降のリリースは、ビルド→署名→アップロード→トラック設定→提出まで全て CLI で自動化可能。**

## 5. Claude Code での実行可能性まとめ

| カテゴリ | Claude Code で自動化 | 前提条件 |
|----------|---------------------|---------|
| ビルド | **可能** | JDK + Android SDK 必須 |
| 署名 | **可能** | Keystore + Gradle signingConfigs |
| ビルドアップロード | **可能** | サービスアカウント JSON キー |
| テスト配信（Internal） | **可能** | 審査なし即配信 |
| メタデータ管理 | **可能** | API / fastlane supply |
| IAP/サブスク管理 | **可能** | Monetization API |
| Production リリース | **可能** | 段階的ロールアウト含む |
| **アプリ初回作成** | **不可** | Play Console Web UI |
| **レビュー審査** | **不可** | Google の審査プロセス |
| **リジェクト対応** | **不可** | Web UI でのやり取り |
| **Developer 登録** | **不可** | Web UI + 支払い |

## 6. 推奨ツール選定

| ユースケース | 推奨ツール | 理由 |
|-------------|-----------|------|
| Gradle ベースのプロジェクト | **Gradle Play Publisher (GPP)** | `./gradlew publishBundle` 一発 |
| CI/CD パイプライン（iOS/Android 共通） | **fastlane supply** | クロスプラットフォーム対応 |
| スクリプト・CLI 操作重視 | **playconsole-cli (gpc)** | 80+ コマンド、JSON 出力 |
| 直接 API 操作 | **Google Play Developer API v3** | 最大の自由度 |

## 7. iOS（App Store）との比較

| 観点 | Google Play | App Store (iOS) |
|------|-------------|-----------------|
| 初回アプリ作成 | Web UI 必須 | API で可能 |
| ビルドアップロード | CLI 完全自動化 | CLI 完全自動化 |
| 審査 | Production のみ。通常数時間〜数日 | 全トラック。通常 24〜48時間 |
| テスト配信 | Internal は審査なし即配信 | TestFlight は軽量審査あり |
| メタデータ管理 | API ほぼ完全（カテゴリ除く） | API 完全対応 |
| 審査リジェクション対応 | 手動のみ | 手動のみ |
| 課金商品管理 | API 完全対応 | API 完全対応 |
| 段階的ロールアウト | % 指定 + halt/resume | 7日間自動 |
| 開発者登録費 | $25（一回のみ） | $99/年 |
| 初回リリースの壁 | 高い（Closed テスト 12人×14日） | 低い |
