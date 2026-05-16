# AI 改修ボタン — 学力 + 学習指導要領で枝分かれするゲーム

> **ステータス:** 設計スケッチのみ (実装未着手)。 ユーザ指示の item 4。
> 現状の foundation + scoring 基盤の **上に乗る** 次フェーズの機能。

## 1. やりたいこと

ユーザ (子供 + 保護者 / 教師) が「もう少し簡単に」 「もう少し難しく」 「漢字を増やして」 等の **AI 改修ボタン**
を押すと、 現在のゲームを **学習指導要領の単元マップ + 本人の学力プロファイル** に照らして
変種を生成する。 生成されたゲームは元のゲームから分岐した **ブランチ** として保管される。

### 4-1: ブランチとして残る

```
                      ┌─[ uni-math#easy.v1 ]─────────── 子供 A の「足し算 1〜9」
[ uni-math ] ─────┬──[ uni-math#easy.v2 ]── (AI: ×2 倍を導入)── 子供 A の「2 桁前段」
                  └──[ uni-math#easy.kanji-mix ]── (AI: 漢字表記混在) ── 子供 B
```

- 分岐は捨てない。 過去のブランチに戻って再プレイ可能
- ブランチには **生成パラメータ + 親 ID + 学力スナップショット** が付随する
- ローカル保存 (`ludellus.branches.v1`)

### 4-2: main 復帰のための段階提示

子供が遠くに分岐してしまった時、 「学習指導要領の本流 (= main)」 に戻るための **段階的な目標** を提示する。

```
現在地: uni-math#easy.kanji-mix (分岐 3 段)
   ↓ 1. 漢字表記を外す (→ uni-math#easy.v2)
   ↓ 2. ×2 を外す      (→ uni-math#easy.v1)
   ↓ 3. main 復帰      (→ uni-math#easy)
```

ステップごとにミニゲーム or 確認問題を 1 セット解いて段階を進む。
**「分岐は迷路ではなく寄り道」** であることを子供が直感できる UI にする。

## 2. データモデル (案)

```ts
// renderer/lib/ai-mod.js (将来)
interface GameBranch {
  id: string;                  // 例: "uni-math#easy.v2"
  baseGameId: string;          // "uni-math"
  parentBranchId: string|null; // ルート (main) は null
  mode: string;                // "easy" | "normal" | "hard" 等
  generationParams: {
    aiModel: string;           // "claude-haiku-4-5" 等 (将来 Claude API 使うなら)
    promptTemplate: string;    // どのテンプレで生成したか
    appliedDeltas: string[];   // 例: ["add-kanji-mix", "introduce-x2"]
  };
  curriculumUnits: string[];   // 例: ["math.g1.unit3.add", "math.g2.unit1.kanji-numeral"]
  createdAt: string;           // ISO
  scoreSnapshot: {             // 生成時の学力プロファイル (現スコア)
    [gameId: string]: { [mode: string]: number };
  };
  payload: object;             // ゲーム固有の差分パラメータ (難易度・対象漢字等)
}

interface BranchStore {
  byId: { [id: string]: GameBranch };
  rootByGameId: { [gameId: string]: string }; // "main" ブランチの id
}
```

localStorage key: `ludellus.branches.v1`

## 3. UI スケッチ

### ゲーム中のボタン

画面右上に **🤖 AI かいぞう** ボタン。 押すとモーダル:

```
┌────────────────────────────────┐
│  この問題を どう かいぞう する？             │
│                                │
│  ┌──────────┐ ┌──────────┐    │
│  │ もうすこし   │ │ もうすこし   │    │
│  │ かんたん    │ │ むずかしい   │    │
│  └──────────┘ └──────────┘    │
│                                │
│  ┌──────────┐ ┌──────────┐    │
│  │ 漢字を     │ │ 別の単元を   │    │
│  │ ふやす     │ │ ためす     │    │
│  └──────────┘ └──────────┘    │
│                                │
│   [ うにに もどる ]                  │
└────────────────────────────────┘
```

### 分岐ツリー UI

スタート画面の「もどる」 ボタンで分岐ツリーを表示:

```
[ uni-math main ]
   └─ easy
      ├─ v1 (3 days ago, score 7/10) ← 現在地マーク
      ├─ v2 (2 days ago, score 9/10)
      └─ kanji-mix (today, score 5/10)  ★ unfinished
```

タップで各ブランチに切替。 main 復帰には [§4-2](#4-2-main-復帰のための段階提示) の段階が示される。

## 4. AI 生成のバックエンド

### 選択肢

| 方式 | 長所 | 短所 |
|---|---|---|
| **Claude API (online)** | 高品質、 学習指導要領との照合まで AI に任せられる | **Ludellus のローカル方針と衝突**、 コスト、 オフライン不可 |
| **ローカル LLM (WebGPU)** | オフライン、 プライバシー | 数百 MB、 子供 PC では遅い、 品質下がる |
| **ルールベース + テンプレート** | 確実、 軽量、 オフライン | 表現の幅が狭い |

### 推奨: ハイブリッド

- **第一段 (ルールベース):** 「もうすこし簡単」 「もうすこし難しい」 等の **典型的な改修** はルールテーブルで処理 (例: easy → 数字範囲を 1-5 に狭める)
- **第二段 (Claude API, opt-in):** 「漢字混在」 「自分でリクエスト文を書く」 等の自由度の高い改修だけ Claude API を呼ぶ。 ユーザに **明示的同意** + 通信発生表示
- 第一段だけでも 8 割の改修要望はカバーできる想定

これにより Ludellus 既定はローカル動作、 AI 改修だけオンライン opt-in という形が取れる。
[[project-ludellus]] の方針との折り合いも保てる。

## 5. 学習指導要領との結線

`spec/manabi-no-tabibito.md` で定義する **学年 × 教科 × 単元** マップに、 各ゲーム/ブランチを **タグ付け**:

```
uni-math#easy           → math.g1.unit1.add
uni-math#easy.kanji-mix → math.g1.unit1.add + japanese.g2.unit3.kanji-numeral
uni-writing-game#hiragana → japanese.g1.unit1.hiragana
```

これにより:

- **保護者レポート:** 「子供 A は math.g1 を 80% 達成、 japanese.g1 を 60% 達成」
- **教師ダッシュボード:** クラス全員の単元到達度ヒートマップ
- **AI 改修の制約:** 「学年範囲を逸脱しない」 「未習単元を勝手に持ち込まない」

`score.js` の `attachUnitTag(gameId, mode, unitTag)` API は将来この単元結線の入口として予約済み。

## 6. 段階的実装ロードマップ

| Phase | 内容 | 依存 |
|---|---|---|
| **Phase 1** | 分岐ストア (`lib/branches.js`) + ルールベース改修 + 分岐ツリー UI | foundation 基盤 (本 PR で達成) |
| **Phase 2** | 単元タグの導入 + 学力プロファイル算出 + main 復帰の段階生成 | 単元マップの整備 (spec/) |
| **Phase 3** | Claude API opt-in 改修 (自由度高い改修向け) | ネットワーク機能の追加、 ユーザ同意 UI |
| **Phase 4** | 保護者レポート / 教師ダッシュボード | データモデルの整備、 集計 UI |

## 7. 未解決事項

- **「学力プロファイル」** の具体定義 — 単純な score だけか、 試行回数 / つまずきパターンも含めるか
- **改修の可逆性** — 「もうすこし難しい」 → やってみて合わなかった → 親に戻すまでの UX
- **子供が分岐しすぎた場合** の整理機能 (古いブランチの archive / 削除)
- **複数子供で同端末を共有する場合** のプロファイル切替 (`ludellus.profiles.v1` を別途用意?)
- **AI 改修の品質保証** — 生成された問題が解けない/不適切な場合のフィードバックループ

## 関連

- [`FOUNDATION.md`](./FOUNDATION.md) — score.js が分岐ストアの基盤になる
- [`MOBILE.md`](./MOBILE.md) — モバイルでも AI 改修 UI が動く前提でデザイン
- [`../spec/manabi-no-tabibito.md`](../spec/manabi-no-tabibito.md) — 学習指導要領 × 単元マップ + 教師ダッシュボード / 保護者レポートの上位構想
