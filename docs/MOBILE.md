# UniLand モバイル化設計 (Android / iOS)

UniLand を Electron デスクトップから Android / iOS にも展開するための **比較検討 + 推奨経路 + 段階移行ロードマップ**。
**中央 Web サーバあり** ([`SERVER.md`](./SERVER.md)) + **Pictor で統一描画** ([`PICTOR.md`](./PICTOR.md)) を前提とする。

## 制約と前提

| 項目 | 内容 |
|---|---|
| **データ永続化** | localStorage 一次 + 中央サーバ非同期 sync (オフライン優先) |
| **ネットワーク** | あり (Cernere auth + UniLand サーバ + Memoria 通知) |
| **入力監視** | デスクトップは `uiohook-napi` でグローバル KB/Mouse、 モバイルは **触れるパネル** のみ取得 |
| **音声** | Web Audio API + SpeechSynthesis (`ja-JP`) — モバイル WebView でも動く |
| **描画** | 抽象 API ([`render.js`](../renderer/lib/render.js)) 経由。 Pictor backend (WebGL2/WASM or Vulkan native) が利用可能なら自動切替、 fallback は Canvas 2D |
| **画面** | 縦横両対応、 既存サンプルは縦持ち優先 |
| **配布** | Android: Play Store / 直 APK、 iOS: TestFlight / App Store |
| **OTA** | renderer/ web bundle を CDN (Cloudflare Pages 等) 配信、 Capacitor から fetch して即時反映 (Apple 規約範囲内) |

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

中央 Web + Pictor を前提に組み替えた構成。

```
v0 (現在)             v1 (PWA + サーバ MVP)     v2 (Capacitor + Pictor WASM)    v3 (Full Pictor)
Electron Desktop  →   PWA + UniLand サーバ   →  Capacitor で Store + WebGL    →  Native Pictor plugin
foundation 完成        + Cernere auth + sync     Pictor で render               Vulkan / MoltenVK
                       + Memoria 通知            (CDN OTA)                      iOS / Android で
                                                                                ネイティブ高速描画
```

主要点:

- **PWA は v1 から実用** — ブラウザだけで動かせるので、 アプリ審査前のテスト & デモに便利
- **Capacitor + Pictor WebGL2 backend** が Phase 2 の現実解 — WebView 上で Pictor WASM が動く想定
- **Native Pictor plugin** は最終形 — iOS は MoltenVK、 Android は Vulkan native

### Phase 1: PWA 化 (最小コスト) — **実装済み (PR #4)**

- `renderer/manifest.webmanifest` — アプリ名・縦持ち・standalone・theme color
- `renderer/sw.js` — service worker (cache-first 静的 + network-first API + オフライン fallback)
- `renderer/icons/uni-icon.svg` — マスター SVG (うに 11 触手 + コア + クリーム背景)
- `npm run serve` — 検証用 http-server (port 8080)
- **未実施:** PNG icon の export (192/512、 SVG → PNG)、 favicon、 apple-touch-icon (`renderer/icons/README.md` に手順あり)

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

### Phase 2: Capacitor + Pictor WebGL2 backend で Android / iOS 配布

- `@capacitor/core` + `@capacitor/android` + `@capacitor/ios`
- 既存 `renderer/` を `capacitor.config.json` の `webDir` に向ける
- `renderer/` を CDN (Cloudflare Pages) に置き、 Capacitor は **WebView の `serverUrl` をその CDN に向ける** ことで OTA 化 (Apple 規約: HTML/CSS/JS の更新は許容範囲)
- `Capacitor.Preferences` / `Capacitor.Filesystem` でローカルデータ強化 (localStorage は WebView 単位で消える可能性あるため)
- **Pictor は Emscripten ビルドの WebGL2 backend を WASM として同梱** ([`PICTOR.md`](./PICTOR.md) Phase 3〜4)
- 必要プラグイン:
  - **Haptics** — 正解時のバイブ
  - **Status Bar** — クリーム色テーマに合わせる
  - **App** — バックグラウンド復帰時の monitor 制御
  - **Screen Orientation** — 縦持ちロック
- ビルド: `npx cap sync && npx cap open android|ios`
- **コスト目安:** 2〜4 週

### Phase 3: Native Pictor plugin (高速化)

WebGL2 経由でも 60fps は出るが、 さらなる性能と省バッテリのため Pictor を **ネイティブビルドで Capacitor plugin** として組み込む。

- **iOS:** Vulkan via MoltenVK で `libpictor.a` をリンクした Swift plugin
- **Android:** Vulkan native で `libpictor.so` をリンクした Kotlin/JNI plugin
- Capacitor plugin 経由で `window.PictorBridge` を JS にエクスポート、 `renderer/lib/render.js` が自動検出
- 共通の C ABI ([`PICTOR.md`](./PICTOR.md) の export 案) を Pictor 側に追加してもらう必要あり

### Phase 4: Tauri 2 統一 (将来オプション)

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
| **Google Play** | 子供向けカテゴリ申請、 Family ポリシー対応、 親同意フロー必須 |
| **App Store** | 子供カテゴリ Kids 5 and Under / 6-8 等、 第三者 SDK 制限、 Kids 5 以下は外部リンク・課金不可 |
| **データ収集ラベル** | UniLand サーバには **集計値のみ** (raw 入力なし)、 個人情報は親アカウント (Cernere) で名前/メールのみ。 ラベルは「機能上のデータ」 「分析データ」 を明示 |
| **COPPA / 個人情報保護法 / GDPR kids** | 子供アカウントは親アカウント配下、 13 歳未満から直接の個人情報収集なし ([`SERVER.md`](./SERVER.md) のセキュリティ節参照) |

## 残課題

- アイコンデザイン (うにモチーフ、 512px / 1024px)
- スプラッシュスクリーン
- 子供アカウント / 保護者制限 UI (将来)
- 物理キーボード接続時の挙動 (iPad の Smart Keyboard 等)
- VoiceOver / TalkBack 対応 (アクセシビリティ)

## 関連

- [`FOUNDATION.md`](./FOUNDATION.md) — 共通モジュール (mobile.js の touch-action 抑止はこの方針の前提)
- [`SERVER.md`](./SERVER.md) — 中央 Web + Cernere + Memoria 3 統合の構成
- [`PICTOR.md`](./PICTOR.md) — レンダリング統一 (WebGL2 backend + Native plugin)
- [`AI-MOD-BUTTON.md`](./AI-MOD-BUTTON.md) — モバイル UI でも動く前提でデザイン
- [`../spec/manabi-no-tabibito.md`](../spec/manabi-no-tabibito.md) — 教師ダッシュボード / 保護者レポートはモバイル/PC 両対応想定
