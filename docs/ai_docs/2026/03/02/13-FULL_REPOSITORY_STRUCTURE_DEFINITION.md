# kaedevn 全リポジトリ構成完全定義書：OSS Studio と Cloud Platform の分離

## 1. コンセプト
「制作環境の民主化（OSS Studio）」と「配信・収益プラットフォームの独占（Cloud Platform）」を両立させる、マルチリポジトリ戦略。

## 2. kaedevn-studio (OSS / 個人開発環境)
ユーザーのローカルPC上で動作し、ゲームの「制作・テスト・確認」を行う。

### A. フォルダ構成
- **apps/**
  - **editor/**: GUIエディタ（React/Vite）。
  - **hono-local/**: ローカルファイルシステム（projects/）操作API。
  - **dashboard/**: ローカルプロジェクト管理（Next.js Lite版）。
- **packages/** (Core SDK / 全プラットフォーム共通)
  - **core/**: 基本型・インターフェース。
  - **web/**: PixiJSベースの描画エンジン（プレイ画面）。
  - **interpreter/ compiler/**: スクリプト実行・変換。
  - **ui/ battle/**: 共通UI・バトルロジック。
- **projects/**: ユーザー作成データ（画像・JSON等）の保存領域。
- **GEMINI.md / CLAUDE.md**: AIエージェント（Claude Code等）用コンテキスト。

---

## 3. kaedevn-cloud (非公開 / 配信・商用プラットフォーム)
制作された作品の「投稿・配信・SNS機能」および「スマホ・Switch版のビルド」を独占提供。

### A. フォルダ構成
- **apps/**
  - **portal/**: 投稿・閲覧サイト（SNS、ランキング、認証、決済）。
  - **hono-api/**: クラウドAPI（Azure SQL/Blob Storage連携）。
  - **reader/**: Web配信用の最適化ランタイム（しおり同期等）。
- **services/** (非公開ビルドパイプライン)
  - **builder-native/**: iOS/Androidアプリ向けパッケージ作成。
  - **builder-switch/**: Nintendo Switch 向けネイティブビルドエンジン（SDK連携）。
  - **builder-steam/**: PC/Steam 向けパッケージ・実績連携。
- **internal-packages/** (商用限定機能)
  - **cloud-sync/**: セーブデータのクラウド保存。
  - **payment-sdk/**: 課金・投げ銭システム。
- **infra/**: Azure/Docker のインフラ定義 (Bicep等)。

---

## 4. 連携・運用フロー
1. **制作 (Studio OSS)**: ユーザーはローカルで自由に制作・テスト。
2. **投稿 (Cloud)**: 完成したデータをクラウドポータルへアップロード。
3. **配信 (Cloud Reader)**: 一般読者はクラウド版プレイヤーで作品を閲覧。
4. **商用化 (Cloud Builder)**: 有料ライセンス購入者に対し、Switchやアプリ版のバイナリをビルド・提供。

## 結論
「制作（Studio）」をOSSとして開放し、AIエージェントの力を借りて高速進化させる一方で、「出口（Cloud/Builder）」を非公開とすることで、プラットフォームとしての価値と収益性を強固に維持する。
