# UniLand サーバアーキテクチャ

ユーザ指示で「中央 Web は自由に決めれる」 + 「3 つの統合 (UniLand standalone server + Cernere 認証 + Memoria 学習活動) は全部やる」 となったため、 競合しない形で 3 サービスを並走させる構成。

## 全体像

```
┌─────────────────────── クライアント ───────────────────────┐
│ iOS / Android (Capacitor) ・ Web (PWA) ・ Desktop (Electron) │
│        WebView / renderer/ + Pictor (WASM or 直 Vulkan)       │
└──────────────────────────────────────────────────────────────┘
       │                          │                       │
       │ Cernere PASETO            │ UniLand REST           │ Memoria REST
       ▼                          ▼                       ▼
┌──────────────┐         ┌──────────────────┐    ┌───────────────────┐
│   Cernere    │←sub────│ UniLand サーバ      │───→│     Memoria       │
│   (大人 auth) │         │ (分岐 / score /     │    │ (学習活動の集計    │
│              │         │  AI 改修 / 同期)    │    │  + 保護者レポート) │
└──────────────┘         └──────────────────┘    └───────────────────┘
       │                          │                       │
       │ project-token (per-user) │ 自前 DB (Postgres)    │ Memoria DB
       ▼                          ▼                       ▼
   [ Cernere DB ]            [ UniLand DB ]           [ Memoria DB ]
```

## サービス境界 (誰が何を持つか)

| データ | 持ち主 | 理由 |
|---|---|---|
| **大人ユーザ identity** (保護者・教師) | Cernere | LUDIARS 共通の認証単一情報源 ([[project_personal_data_rule]] 準拠) |
| **子供プロファイル** (うにの名前・お気に入り色等) | UniLand | 子供の個人情報は最小、 親アカウント配下にぶら下げる |
| **スコア / 分岐ツリー / AI 改修履歴** | UniLand | ゲーム固有データ、 他サービスから参照されない |
| **学習活動ログ** (どの単元をいつ何分やった等) | Memoria | Memoria の活動トラッキング設計に乗る、 保護者レポートは Memoria が責任 |
| **学習指導要領マップ + 単元定義** | UniLand (spec/) | 教育コンテンツ固有、 静的データ |
| **音声合成キャッシュ・モックアップアセット** | クライアント (localStorage / CDN) | サーバ持ち回さない |

### Cernere との連携

- 親が Cernere で SSO ログイン (PASETO トークン取得)
- UniLand クライアントは Cernere の `/api/auth/project-token` で per-user × per-project トークンを取得 ([[feedback_secret_per_user_memory_only]])
- UniLand サーバは Cernere PASETO 公開鍵を起動時 fetch、 受け取った token の `sub` (= ユーザ ID) を検証
- **子供の auth はパスワードレス** — 親アカウント配下にぶら下がる「子供プロファイル ID」 のみ
  - 例: 親 user_id `usr_abc` の配下に child profile `child_xyz` がぶら下がる
  - 子供は端末を起動するだけ (親が初回設定したリンク済端末)、 端末 ID と child profile が紐付く

### UniLand サーバ自前範囲

#### REST API (ドラフト)

```
GET    /api/v1/profiles                  # 親の子供一覧
POST   /api/v1/profiles                  # 子供プロファイル作成
GET    /api/v1/profiles/:childId/scores  # スコア一覧
POST   /api/v1/profiles/:childId/scores  # セッション結果記録
GET    /api/v1/profiles/:childId/branches
POST   /api/v1/profiles/:childId/branches  # 分岐生成リクエスト
GET    /api/v1/curriculum                # 学習指導要領マップ (静的)
POST   /api/v1/ai-mod                    # AI 改修リクエスト (Claude API へ proxy)
```

- すべて Cernere PASETO Bearer 必須
- 自前 Postgres (Memoria と論理 DB 分離、 同一物理クラスタは可)
- Hono + Drizzle ORM、 もしくは Memoria に倣って Fastify + 生 SQL

#### Memoria 通知

- セッション終了時に UniLand サーバから Memoria の `/api/activities` (仮) に PUT
- スキーマ:
  ```json
  {
    "userId": "<親 user_id>",
    "childId": "<子供 profile id>",
    "kind": "uniland.session",
    "gameId": "uni-math",
    "mode": "easy",
    "score": 9,
    "total": 10,
    "unitTags": ["math.g1.unit1.add"],
    "durationMs": 245000,
    "startedAt": "2026-05-16T10:00:00Z",
    "endedAt": "2026-05-16T10:04:05Z"
  }
  ```
- **個人データは含めない** — 集計値のみ ([[project_personal_data_rule]])
- Memoria 側で kids 専用ビューを足してもらう (保護者ダッシュボード)

## Sync 戦略 (オフライン優先)

クライアント側 `renderer/lib/score.js` は localStorage を一次データとして持ち、 サーバへは非同期 sync:

```
[ Game ] → [ score.js (localStorage 即書込み) ]
              │
              └─ flushSyncQueue() ──→ POST /api/v1/profiles/:childId/scores
                       (リトライ + 失敗時はキュー温存)
```

- **オフラインでも動く** — サーバ未到達でも localStorage に残る
- **競合解決:** クライアント側のタイムスタンプを保持、 サーバ側で `lastPlayed` が新しい方を採用 (last-write-wins)
- **複数端末同期:** 親アカウントログイン時に他端末の最新ストアを fetch して merge

`renderer/lib/score.js` に sync フック予約 (Phase 2 で実装):

```js
// Phase 2:
import { syncWithServer } from "../lib/score.js";
await syncWithServer({ endpoint: "https://uniland.app/api/v1", token: pasetoToken });
```

## デプロイ構成 (案)

| サービス | デプロイ先 | スケール |
|---|---|---|
| UniLand サーバ | Cloudflare Workers / Fly.io / Railway | 個人運用なら Workers が一番安い |
| UniLand DB | Neon / Supabase Postgres | Memoria と論理分離した同一クラスタ可 |
| Cernere | LUDIARS 既存 | 統合のみ、 別管理 |
| Memoria | LUDIARS 既存 | 統合のみ、 別管理 |
| CDN (renderer 配信) | Cloudflare Pages / Vercel | OTA 用、 Capacitor が WebView から読む先 |

[[reference_ludiars_port_map]] と整合させる port 割り当ては別途。

## セキュリティ / コンプライアンス

| 項目 | 対応 |
|---|---|
| **COPPA (13 歳未満)** | 親アカウント介在、 子供から直接の個人情報収集なし |
| **個人情報保護法** | 名前・誕生日等は子供プロファイルに任意、 デフォルト「うに」 + 色だけ |
| **GDPR kids** | EU 配信時に親同意フロー (Cernere 側で対応) |
| **Apple Kids カテゴリ** | 5 歳以下選択時は外部リンク/課金不可、 Cernere SSO は親側だけに表示 |
| **データ最小化** | UniLand サーバには集計値のみ、 raw 入力 / 音声 / 画像は持たない |

## ロードマップ

| Phase | 内容 | クライアント | サーバ |
|---|---|---|---|
| **0 (現状)** | foundation + scoring + samples | localStorage 単独 | なし |
| **1** | UniLand サーバ MVP | sync フック追加 | プロファイル + スコア REST |
| **2** | Cernere 統合 | 親 SSO 画面 | PASETO 検証 |
| **3** | Memoria 通知 | (透過) | UniLand → Memoria PUT |
| **4** | AI 改修 (Claude API proxy) | 改修ボタン UI | `/api/v1/ai-mod` |
| **5** | OTA (Cloudflare Pages から renderer 配信) | Capacitor + manifest | CDN |

## 関連

- [`FOUNDATION.md`](./FOUNDATION.md) — クライアント側 score.js / 共通基盤
- [`MOBILE.md`](./MOBILE.md) — クライアント配布の構成 (Capacitor + PWA + Electron)
- [`PICTOR.md`](./PICTOR.md) — レンダリング層の方針 (Web + Mobile + Desktop すべて Pictor 経由を目指す)
- [`AI-MOD-BUTTON.md`](./AI-MOD-BUTTON.md) — ai-mod エンドポイントの呼び出し元仕様
- [`../spec/manabi-no-tabibito.md`](../spec/manabi-no-tabibito.md) — 学習指導要領マップの正本
