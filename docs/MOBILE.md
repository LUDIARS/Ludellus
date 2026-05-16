# UniLand モバイル化設計 (Android / iOS)

UniLand を Electron デスクトップから Android / iOS にも展開するための **比較検討 + 推奨経路 + 段階移行ロードマップ**。
現時点では中央サーバ不要 (`docs/DESIGN.md` 参照)、 backend = Electron main、 frontend = renderer HTML/JS。

## 制約と前提

| 項目 | 内容 |
|---|---|
| **データ永続化** | localStorage (foundation `score.js`) のみ。 OS 依存ファイル IO は使わない |
| **ネットワーク** | なし (完全ローカル動作) |
| **入力監視** | デスクトップは `uiohook-napi` でグローバル KB/Mouse、 モバイルは **触れるパネル** のみ取得 |
| **音声** | Web Audio API + SpeechSynthesis (`ja-JP`) — モバイル WebView でも動く |
| **画面** | 縦横両対応、 既存サンプルは縦持ち優先 |
| **配布** | Android: Play Store / 直 APK、 iOS: TestFlight / App Store |

## 選択肢比較

| 方式 | バンドルサイズ | 開発コスト | ネイティブ機能 | 既存コード再利用 | 学習コスト |
|---|---|---|---|---|---|
| **A. Capacitor** | 中 (5〜10MB) | 低 | プラグイン経由で豊富 | renderer 100% 流用 | 低 (web 寄り) |
| **B. Tauri 2 mobile** | 小 (3〜6MB) | 中 | Rust プラグイン経由 | renderer 100% 流用 | 中 (Rust 必要) |
| **C. PWA** | なし (ブラウザ) | 最低 | 限定的 | renderer 100% 流用 | 最低 |
| **D. React Native / Flutter 再実装** | 大 | 最大 | フル | 0% | 最大 |

### A. Capacitor (Ionic Team)

```
[ HTML/JS renderer ] ── WebView ── [ Capacitor Bridge ] ── [ Android/iOS Native ]
```

- 既存 `renderer/` を **そのまま** Android/iOS WebView で動かせる
- プラグインで `Storage` / `Filesystem` / `Haptics` / `LocalNotifications` 等を呼べる
- Electron 版と並行運用しやすい (renderer は共通)
- 入力監視はパネル内タッチに限定 (グローバルキー監視は OS 規約で不可)

### B. Tauri 2 mobile

- LUDIARS では Hora / Calicula / cocoiru-pc が Tauri 2 採用 ([[project_hora]] 等)
- バンドル最小、 起動高速、 ただし mobile サポートはまだ alpha/beta
- Rust 側ブリッジが必要 (現状 UniLand main は Node TypeScript)
- 将来的に統一感を取るならアリだが、 学習コスト + Tauri mobile の成熟待ち

### C. PWA

- 既存 `renderer/` に `manifest.json` + service worker を足すだけ
- iOS は「ホーム画面に追加」 で疑似アプリ化、 Android Chrome なら自動でアプリ化提案
- ストア配布不可、 アイコン経由インストールのみ
- **最低コストで「とりあえずスマホでも動かせる」 状態を作るには有効**

### D. React Native / Flutter 再実装

- canvas ゲームをネイティブ描画にする実利が薄い (既存サンプルが web 前提)
- バンドル増 + 再実装コスト + 既存サンプルからの乖離
- **却下**

## 推奨経路

```
v0 (現在)            v1 (PWA)              v2 (Capacitor)         v3 (将来)
Electron Desktop  →  PWA を併設         →  Capacitor で Store    →  必要なら Tauri 2 へ
                     (manifest+SW のみ)     配布開始                  統一
```

### Phase 1: PWA 化 (最小コスト)

- `renderer/` に `manifest.json` を追加 (アプリ名、 アイコン、 縦持ち、 standalone)
- `service-worker.js` で `renderer/` 一式をキャッシュ (オフライン動作)
- 検証用に `npm run serve` (静的サーバ) を追加
- **コスト目安:** 数日

#### manifest.json (例)

```json
{
  "name": "UniLand",
  "short_name": "UniLand",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f7f1e8",
  "theme_color": "#f7f1e8",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Phase 2: Capacitor で Android / iOS 配布

- `@capacitor/core` + `@capacitor/android` + `@capacitor/ios`
- 既存 `renderer/` を `capacitor.config.json` の `webDir` に向ける
- `Capacitor.Preferences` / `Capacitor.Filesystem` でローカルデータ強化 (localStorage は WebView 単位で消える可能性あるため)
- 必要プラグイン:
  - **Haptics** — 正解時のバイブ
  - **Status Bar** — クリーム色テーマに合わせる
  - **App** — バックグラウンド復帰時の monitor 制御
  - **Screen Orientation** — 縦持ちロック
- ビルド: `npx cap sync && npx cap open android|ios`
- **コスト目安:** 2〜4 週

### Phase 3: Tauri 2 統一 (オプション)

- LUDIARS の他デスクトップ系 (Hora / Calicula / cocoiru-pc) と運用統一したい場合
- Tauri 2 mobile が stable になってから検討
- backend = Rust に書き直し ( `uiohook-napi` → `rdev` 等)

## 入力監視のモバイル対応

デスクトップの `main/monitor/inputMonitor.ts` (uiohook-napi) は **そのままモバイルでは使えない**。
モバイルでは:

- **グローバルキーボード/マウス監視は OS が許さない** (Android Accessibility / iOS は基本不可)
- 取得できるのは **アプリ内のタッチ・スワイプ・キーイベント** のみ
- 集計対象: 画面内タップ数、 ドラッグ距離、 セッション中の idle 時間、 ジェスチャ種別

→ foundation 側に `lib/input-metrics.js` を追加し、 デスクトップ/モバイル両対応:

```js
// 仮 API
import { startMetrics, snapshot, stopMetrics } from "../lib/input-metrics.js";

startMetrics(canvas); // canvas 内のポインタイベントを集計
const m = snapshot(); // { taps, drags, dragPx, idleMs, ... }
```

デスクトップは Electron main 側 InputMonitor と並行運用 (グローバル指標 + アプリ内指標)、
モバイルは canvas 内集計のみ。

## ストア配布の注意

| ストア | UniLand 関連の留意点 |
|---|---|
| **Google Play** | 子供向けカテゴリ申請、 個人データなし宣言 (本アプリ準拠)、 Family ポリシー対応 |
| **App Store** | 子供カテゴリ Kids 5 and Under / 6-8 等、 トラッキングなし宣言 (本アプリ準拠) |
| **データ収集ラベル** | UniLand は **データ収集なし** で正直に宣言可能 (集計値も外部送信しない) |

## 残課題

- アイコンデザイン (うにモチーフ、 512px / 1024px)
- スプラッシュスクリーン
- 子供アカウント / 保護者制限 UI (将来)
- 物理キーボード接続時の挙動 (iPad の Smart Keyboard 等)
- VoiceOver / TalkBack 対応 (アクセシビリティ)

## 関連

- [`FOUNDATION.md`](./FOUNDATION.md) — 共通モジュール (mobile.js の touch-action 抑止はこの方針の前提)
- [`AI-MOD-BUTTON.md`](./AI-MOD-BUTTON.md) — モバイル UI でも動く前提でデザイン
- [`../spec/manabi-no-tabibito.md`](../spec/manabi-no-tabibito.md) — 教師ダッシュボード / 保護者レポートはモバイル/PC 両対応想定
