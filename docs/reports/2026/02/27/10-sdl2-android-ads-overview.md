# SDL2 Android 広告実装 概要

**日時:** 2026-02-27
**対象:** SDL2 Android アプリへの AdMob 広告導入（バナー / 動画リワード）

---

## 1. アーキテクチャ

SDL2 は C/C++ で描画を行うため、Android の広告 SDK（Java/Kotlin）とは **JNI (Java Native Interface)** を介して連携する。

```
[SDL2 C/C++]          [Java/Kotlin (Android)]         [Ad SDK (AdMob)]

ボタンタップ検出 ──JNI──→ 広告表示メソッド ──────────→ 広告ロード・表示
                                                        │
コールバック受信 ←──JNI──← onAdEvent() ←────────────────┘
(SDL_USEREVENTで      (報酬付与 / 広告閉じ等)
 メインループに通知)
```

### スレッドモデル

- SDL2 のゲームループ: **SDL スレッド**
- Android 広告 API: **UI スレッド** (`runOnUiThread` 必須)
- Java → C の通知: `SDL_PushEvent()` でスレッド安全にイベントキューへプッシュ

---

## 2. バナー広告

### 概要

画面端（通常は下部）に 320×50dp のバナーを常時または条件付きで表示する。

### 特徴

- **実装が最も簡単** — Java 側だけでほぼ完結
- Java → C コールバック不要（報酬がない）
- C 側は表示/非表示の切り替えだけ

### フロー

```
[ゲーム起動] → バナーをプリロード → 画面下部に表示
[ゲーム中]   → hideBanner() で非表示
[メニュー]   → showBanner() で再表示
```

### 実装ポイント

1. `SDLActivity` を継承したクラスの `onCreate` で `AdView` を生成
2. SDL の `FrameLayout (mLayout)` に `addView` でオーバーレイ
3. `Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL` で画面下部に配置
4. C 側から JNI で `showBanner()` / `hideBanner()` を呼び分け

### 注意事項

- バナー高さ (50dp) 分だけゲーム描画領域が隠れる → SDL 側で下部マージンを確保
- `runOnUiThread` で UI スレッドから操作すること

### 工数目安: 約2時間

---

## 3. 動画リワード広告

### 概要

ユーザーが任意でボタンをタップ → 確認ダイアログ → OK で動画再生 → 完了でポイント付与。

### フロー

```
[SDL2]                     [Java]                    [AdMob]
ボタンタップ
  │
  ├──JNI──→ showRewardDialog()
  │           │
  │           ├─→ AlertDialog 表示
  │           │     ├─ キャンセル → 何もしない
  │           │     └─ OK ──→ rewardedAd.show() ───→ 動画再生
  │           │                                       │
  │           ← onUserEarnedReward(amount) ←──────────┘
  │           │
  ←──JNI──── nativeGrantPoints(amount)
  │
  ├─→ SDL_PushEvent(REWARD_GRANTED)
  │
  └─→ メインループで player_points += amount
```

### 実装ポイント

1. **プリロード**: 広告の `load()` は数秒かかる。ゲーム起動時やシーン遷移時にバックグラウンドでロードしておく
2. **ダイアログ**: Java 側の `AlertDialog` で確認 UI を表示
3. **JNI 双方向**:
   - C → Java: `showRewardDialog()` を `CallVoidMethod` で呼び出し
   - Java → C: `JNIEXPORT void nativeGrantPoints(int)` で報酬額を通知
4. **スレッド安全**: Java 側コールバックから直接 C のゲーム状態を変更せず、`SDL_PushEvent` 経由で `SDL_USEREVENT` をプッシュ

### 注意事項

- 開発中は AdMob のテスト広告 ID を使う（本番 ID で開発すると BAN リスク）
- 広告ロード失敗時のフォールバック処理を入れる（ボタンを無効化する等）
- ネットワーク未接続時は広告がロードできない → UI でフィードバック

### 工数目安: 約1日

---

## 4. 共通セットアップ

### build.gradle

```groovy
dependencies {
    implementation 'com.google.android.gms:play-services-ads:23.x.x'
}
```

### AndroidManifest.xml

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-xxxxxxxx~yyyyyyyy"/>
```

### AdMob 初期化 (Application または Activity)

```java
MobileAds.initialize(this, initializationStatus -> {});
```

---

## 5. 難易度比較

| 要素 | バナー | 動画リワード |
|------|--------|-------------|
| SDK 導入 | 共通 (低) | 共通 (低) |
| Java 側実装 | 低 | 中 |
| JNI C→Java | show/hide 2メソッド | ダイアログ表示 1メソッド |
| JNI Java→C | **不要** | 報酬コールバック 1メソッド |
| スレッド管理 | 低 | 中 (SDL_PushEvent) |
| UI (ダイアログ) | なし | AlertDialog |
| **合計工数** | **約2時間** | **約1日** |

---

## 6. 実装順序の推奨

1. **AdMob SDK 導入** + テスト広告 ID 設定 (共通)
2. **バナー広告** — 最も簡単。JNI の基本パターンを習得できる
3. **動画リワード広告** — バナーで JNI に慣れた上で取り組む
