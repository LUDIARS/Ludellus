# Ludellus

LUDIARS 知育プロジェクトの 1 アプリ。 Claude Web フロントエンドで作った HTML/CSS/JS モックアップを軽量に動かしつつ、
ユーザの入力動態を学習分析に回す。 マスコットは **「うに」** (Claude スターバーストロゴ)。
プロジェクト名 *Ludellus* は親組織 LUDIARS の "Ludus" (遊び・学び・学校) の縮小辞で「ちっちゃい学び・あそび」 の意。

## アーキテクチャ概要

```
[ iOS / Android (Capacitor) ・ Web (PWA) ・ Desktop (Electron) ]
              │      WebView + Pictor (WebGL2/WASM or 直 Vulkan)
              │
   ┌──────────┴──────────┐
   │                     │                       │
   ▼                     ▼                       ▼
[ Cernere ]      [ Ludellus サーバ ]        [ Memoria ]
  大人 auth         分岐 / score              学習活動の集計
                   AI 改修 proxy             保護者レポート
```

- **クライアント:** renderer/ (HTML/JS) + foundation lib (`renderer/lib/`)
- **描画:** Canvas 2D (今) → 抽象 API → Pictor 統一 (最終形、 [docs/PICTOR.md](./docs/PICTOR.md))
- **サーバ:** 3 サービス並走、 詳細は [docs/SERVER.md](./docs/SERVER.md)
- **モバイル:** Capacitor、 詳細は [docs/MOBILE.md](./docs/MOBILE.md)

## ディレクトリ構成

```
main/        Electron main プロセス
  monitor/   入力動態の集計 (uiohook-napi)
  mockups/   renderer/mockups/<id>/manifest.json レジストリ
preload/     contextBridge 経由 API
renderer/
  lib/       foundation 共通モジュール (score / theme / うに / voice / sound / mobile / render)
  templates/ 新規ゲームのボイラープレート
  mockups/   各ゲームモックアップ
sample/      Claude Web 製プロンプトログ要約 + ソース (リファレンス、 書き換え不可)
spec/        学習指導要領ベースの上位プラン文書
docs/        各設計書 (FOUNDATION / SERVER / PICTOR / MOBILE / AI-MOD-BUTTON)
data/        セッションログ等 (.gitignore 対象)
```

## 動作確認 (scaffold 段階)

```
npm install
npm run build
npm start
```

## データ取り扱い方針

LUDIARS の個人データ保管禁止ルール (AIFormat §5) 準拠。 raw な keystroke / 座標履歴は **どこにも永続化しない**。

| データ | 持ち主 | 内容 |
|---|---|---|
| 大人ユーザ identity | Cernere | 保護者・教師。 PASETO + per-user project-token |
| 子供プロファイル | Ludellus サーバ | 親アカウント配下、 デフォルト「うに」 + 色のみ |
| スコア / 分岐ツリー | Ludellus サーバ | localStorage 一次 + 非同期 sync (オフライン優先) |
| 学習活動ログ (集計) | Memoria | セッション単位の集計値のみ、 raw なし |

子供 auth は **パスワードレス** (親 Cernere アカウント配下のサブプロファイル)。 COPPA / 個人情報保護法 / GDPR kids 対応。

## 次の TODO

- PWA manifest + service worker ([docs/MOBILE.md](./docs/MOBILE.md) Phase 1)
- Ludellus サーバ MVP (`/api/v1/profiles` + `/scores`)、 別リポ `LUDIARS/Ludellus-Server` 案
- Capacitor scaffold (Android / iOS ビルド)
- Pictor の C ABI export + WASM パッケージング ([docs/PICTOR.md](./docs/PICTOR.md))
- 既存 sample を抽象 render API ベースに移植 (任意、 リファレンス温存も可)
- AI 改修ボタン Phase 1 (ルールベースのみ、 [docs/AI-MOD-BUTTON.md](./docs/AI-MOD-BUTTON.md))

## 関連リポジトリ

- [LUDIARS/Cernere](https://github.com/LUDIARS/Cernere) — 大人 auth
- [LUDIARS/Memoria](https://github.com/LUDIARS/Memoria) — 学習活動の集計先
- [LUDIARS/Pictor](https://github.com/LUDIARS/Pictor) — 描画エンジン (WebGL2 backend あり)
