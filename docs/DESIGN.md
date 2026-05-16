# UniLand 設計メモ

## 目的

知育系教材プロジェクトの 1 つとして、 Claude Web フロントエンドが書き出した HTML/CSS/JS モックアップを
**軽量に・作り込んだ状態で** 動かす。 マスコット「うに」 (Claude スターバーストロゴ) を介して、
キーボード/マウス・タッチの動態を集計して学習分析のシグナルにする。

## 非機能要件

- マルチプラットフォーム (Electron / PWA / Capacitor) で同一の renderer/ を共有
- LUDIARS 個人データ保管禁止ルール (AIFormat §5) 準拠。 raw 入力は永続化しない
- Foundation UI に準拠 (角丸 + やや大きめ padding + token 共通)
- オフライン優先 — 中央 Web 不到達でもゲームは完結する

## アーキテクチャ (全体)

```
┌──────────────────────── クライアント ───────────────────────┐
│ iOS / Android (Capacitor) ・ Web (PWA) ・ Desktop (Electron)  │
│   WebView 上で renderer/lib/ + Pictor (WebGL2/WASM or native) │
└──────────────────────────────────────────────────────────────┘
       │                       │                      │
       ▼ Cernere PASETO        ▼ UniLand REST         ▼ Memoria REST
┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
│   Cernere    │    │ UniLand サーバ     │    │     Memoria       │
│ (大人 auth)   │←──→│ (scores/branches/  │───→│ (学習活動の集計    │
│              │ sub│  ai-mod / sync)   │PUT │  + 保護者レポート) │
└──────────────┘    └──────────────────┘    └───────────────────┘
```

詳細: [SERVER.md](./SERVER.md) / [PICTOR.md](./PICTOR.md) / [MOBILE.md](./MOBILE.md)

## クライアント内部

### Electron / WebView 共通

```
+----------------------+    IPC / Bridge    +-------------------+
| renderer (UI shell)  |  <-------->        | main / native     |
|  - ゲーム             |                    |  - InputMonitor    |
|  - foundation lib    |                    |  - MockupRegistry |
|  - Pictor (描画)      |                    |  - Sync queue     |
+----------------------+                    +-------------------+
```

- Electron desktop: `main/` が Node、 OS グローバル入力を `uiohook-napi` で取得
- Capacitor mobile: native plugin が `App` / `Preferences` / `Filesystem` / 将来 `Pictor` を提供
- PWA: service worker でオフラインキャッシュ、 入力は WebView 内タッチのみ

### foundation lib (`renderer/lib/`)

| モジュール | 役割 |
|---|---|
| `score.js` | localStorage + sync queue (オフライン優先) |
| `theme.css` | クリーム + 濃茶 + うにオレンジ、 自前不透明 #stage (ダークモード耐性) |
| `uni-character.js` | うにキャラ (11 触手・idleMotion・2 アクション同時実行) |
| `voice.js` | SpeechSynthesis ja-JP (onstart + onboundary + fallback) |
| `sound.js` | SE シンセ (ピンポーン/ブブー/デロロン/tick/うにループ) |
| `mobile.js` | touch-action 抑止 + JS preventDefault |
| `render.js` | 抽象 draw API、 Canvas 2D / Pictor 自動切替 |

詳細: [FOUNDATION.md](./FOUNDATION.md)

### InputMonitor (desktop のみ)

`uiohook-napi` を遅延 require して OS 入力フックを取り、 5 秒バケットに集計する。
emit するのは `InputMetric` (keyPresses / mouseClicks / mouseMoves / mouseTravelPx / idleMs) のみ。
raw な keycode / 座標は **emit しない**。

モバイルは canvas 内タッチのみ取得 (OS グローバル監視は不可)。 詳細: [MOBILE.md](./MOBILE.md)。

### MockupRegistry

`renderer/mockups/<id>/manifest.json` を列挙して renderer に返す:

```json
{
  "id": "sample-hello",
  "title": "Hello UniLand",
  "description": "...",
  "entry": "index.html",
  "tags": ["sample"]
}
```

renderer は iframe sandbox="allow-scripts allow-pointer-lock" でロードする。

## 段階的拡張案

| Phase | 内容 |
|---|---|
| **v0.1 (現状)** | scaffold + foundation lib + 抽象 render API (Canvas 2D backend) |
| **v0.2** | PWA manifest + service worker + UniLand サーバ MVP + score sync |
| **v0.3** | Cernere 親 SSO + 子供プロファイル + Memoria 通知 |
| **v0.4** | Capacitor + Pictor WebGL2 backend (WASM)、 Store 配布開始 |
| **v0.5** | Native Pictor plugin (iOS/Android Vulkan/MoltenVK) |
| **v0.6** | AI 改修ボタン (ルールベース → Claude API opt-in) |
| **v0.7** | 集中度推定、 セッションリプレイ、 Curare 知育コンテンツ pack 連携 |
