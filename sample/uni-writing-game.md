# uni-writing-game

Ludellus のマスコット **「うに」** (Claude スターバーストロゴ) が触手で文字を書き、 子供がなぞって覚える
ひらがな / カタカナ / 簡単な漢字 (小学 3 年生までの常用漢字) の知育コンテンツ。 これまでで最も長く・最も
仕様変更が多かったサンプル。

> **重要:** ここで初めて 「うに」 がプロジェクトのマスコット名であることが明示された。
> `claude-launcher` / `claude-suika` のスターバーストもすべて「うに」 と呼ぶのが正しい。

## 最終形 (v11) の仕様

### コンセプト

- 250 語の単語バンクからランダム抽選 → 1 文字ずつ画面に出して子供がなぞる → 最後まで終わったら読み上げる
- 単語例: 「すいか」 「めろん」 「あんぱんまん」 「学校」 「電車」 等
- モードフィルタ: ぜんぶ / あ (ひらがな) / ア (カタカナ) / 漢 (漢字)
  - `charCodeAt` で各単語の文字種を判定して `wordsByCategory` に分類
  - 直前と同じ単語を避ける `lastPickedWord` ガード
- 単語の品質チェック: 「むらさき」 は 6 年漢字 (紫) を含むので除外 (3 年制約遵守)

### 文字なぞりロジック

1. **文字マスク作成** — 220×220 のオフスクリーンキャンバスに Zen Maru Gothic でグリフ描画 → `offCanvas` をマスクとして保持
2. **ピクセル数事前計算** — `totalMaskPixels` を保持 (coverage 計算用)
3. **ゴースト表示** — メインキャンバスに `offCanvas` を `globalAlpha = 0.10` で常時描画 (薄い影として文字全体の形が見える)
4. **自由なぞり** — pointerdown/move でユーザの指の軌跡を `drawnInk` (文字ごとのインク蓄積用キャンバス) に太さ **42px** で描画
5. **マスククリップ** — `globalCompositeOperation = 'destination-in'` で `offCanvas` を重ね、 インクが文字形状にだけ残るようクリップ
6. **指離しでストローク区切り** — `state.lastPaintMask = null` で連結リセット (一筆ごと別ストローク扱い)
7. **進行トリガー:**

| タイミング | 閾値 | 動作 |
|---|---|---|
| ペイント中 0.4 s 毎 | coverage ≥ 99% | 即進行 |
| pointerup の瞬間 | coverage ≥ 90% | 即進行 |
| タップ | (ユーザ操作) | 次の単語へ |

> 自動進行 (10 s timeout / 2.5 s inactive) は **撤廃** — 子供のペースを優先。

### 単語完成時

- 完成した各文字の `drawnInk` と `offCanvas` をコピーして `state.completedInks` / `completedMasks` に保存
- `state.showBigWord = true` で `drawBigWord()` に切替
- 中央 (`y = H * 0.52`) に全文字を並べて大きく表示
  - 左右パディング `W * 0.06` を取り、 横/縦の slot 制約から最小値の 96% を実描画サイズに
  - 下に薄いマスクゴースト (`alpha 0.08`) を敷いてフルシェイプも見せる
- `SpeechSynthesisUtterance` (`lang: ja-JP`, `rate: 0.85`) で単語読み上げ
- 読み上げ中は単語行に `speaking` クラス + 文字単位 `now-speaking` ハイライト
  - **同期方式:** `onstart` で開始 → `onboundary` が来れば `ev.charIndex` で文字を切替、 来なければ 280 ms/文字でフォールバック
  - CSS `char-pop`: 1.0 → 1.32 → 1.1 スケール + `--uni-deep` 色フラッシュ
  - 単語行全体は `word-breathe` 1.4 s 周期で呼吸スケール (1.0 ↔ 1.06)

### うに (キャラクター)

#### メインうに

- 位置: **画面上中央** (`W * 0.50, H * 0.13`)
- 11 本の触手 (Claude ロゴに合わせた不規則な基準長)
- ポインタに最も近い触手をアクティブにし、 本体回転/スケールを逆変換した上で先端を指の位置へ正確に伸ばす
- 本体は描画点の少し後ろから追従、 軽く scale 変形
- `idleMotion = true` (常時 wiggle アニメ)

#### 背景うに ×3 (賑やかし)

- 位置: 左下 (`W * 0.12, H * 0.86`) / 右下 (`W * 0.88, H * 0.86`) / 下中央 (`W * 0.50, H * 0.93`)
- `idleMotion = false` — **アクション時のみ動く** (普段は静止)
- タップで `{ jump, tentacle, rotate, scale }` から **重複なし 2 つ** ランダム選択 → 約 0.7 秒同時実行
- アクション中は再トリガー不可

### 音

#### 「うに」 ループ音

なぞり中 (`pointer.active && state === 'tracing'`) に **260〜310 ms ランダム間隔** で再生し続ける。
指を離すと即停止。

- **合成:** sawtooth + square のフォルマント風 BPF 加算
- **母音遷移:** 「う」(F1=320, F2=800) → 「い」(F1=280, F2=2200)
- **歪み:** tanh で軽く量子化 → ボイスロイド風
- **バリエーション:** ピッチ ±7 Hz、 間隔 ±35 ms ジッタで単調回避

#### 単語読み上げ

`SpeechSynthesisUtterance(ja-JP, rate=0.85)`。 文字完成タイミングで loop を停止 → 即 readout に切替。

### 演出

- **完成スパークル:** 単語完成時に画面中央から 18 個の十字きらめきがコーラル色で放射、 重力落下しながらフェード
- **インク雫:** ペイント中に触手の先からたまにポタッと落ちる
- **delta time ベース** で `updateParticles(dt)` (requestAnimationFrame のタイムスタンプから算出)

### モバイル / iframe 対策

子供のスマホ操作で親ウィンドウがスクロールしてアーティファクトが閉じてしまうのを防ぐ。

#### CSS

```css
html, body, #stage, #canvas-wrap, canvas {
  touch-action: none;
  overscroll-behavior: none;
}
```

#### JS

`{ passive: false }` でないと `preventDefault()` が無視されるので明示:

```js
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => {
  if (!e.target.closest('button')) e.preventDefault();
}, { passive: false });
```

ボタンだけ touchstart を通すことで、 タップ合成クリックが壊れないようにする。

## 進化ログ (要点)

| 版 | 主変更 | 結果 |
|---|---|---|
| v1 | PCA で連結成分 → 主軸投影 → 等間隔サンプリングして、 うにが点列を辿って自動描画 | 動作 OK だが「子供がなぞる」 体験ではない |
| v2 | モード選択 UI + スパークル / インク雫 + 単語パルス | 演出強化 |
| v3 (大改修) | 状態機械 (tracing → completing → speaking → done)、 点線パスを子供がなぞる方式に変更、 背景うに 3 体追加 | 1 個のバグ + パス順序強制が窮屈 |
| v3.5 | PCA 点列を直線で結んで描画 → 文字の原形が崩れる | ゴースト + destination-in クリップ方式に戻す |
| v4 | iframe スクロール抑止 (touch-action + JS preventDefault) | モバイル動作改善 |
| v5 | 順序制約撤廃、 自由なぞり化、 ドット/PCA 完全削除 (~80 行) | シンプル化 |
| v6 | カバレッジトリガー導入 (99% during paint / 90% on lift) | 進行が直感的に |
| v7 | 背景うに `idleMotion = false` | 静かな佇まいに |
| v8 | 「うに」 ループ音 + 読み上げ同期ハイライト (onStart + onBoundary or fallback) | 当初仕様の音響演出を実装 |
| v9 | 自動進行撤廃、 単語完成時の中央拡大表示 (`drawBigWord`) | 子供のペースを尊重 |
| v10 | 90% トリガー復活、 `onStart` で同期ズレ解消、 `onBoundary` 優先 | 「すいか→す・い・か」 と発音/ハイライトがほぼ同期 |
| v11 | メインうにを左脇 → 上中央に移動、 背景うに 3 体を下半分に再配置 | 現状の最終形 |

## 設計上の学び (転用可能)

- **「うに」 はマスコット名** — Claude ロゴをキャラ化した呼び方。 Ludellus 全体での呼称統一が必要
- **文字描画は (ゴースト + destination-in クリップ) が確実** — PCA で点列化して直線結ぶと原形崩壊。 グリフを画像マスクとして使い、 子供のなぞった所だけ destination-in で残す方式が安定
- **書き順データを持たないと「正しい書き順」 は再現できない** — PCA 主軸ソートはあくまで近似。 厳密に必要なら漢字書き順データセット (AnimCJK / KanjiVG 等) を別途用意する話になる
- **iframe / アーティファクト埋め込み環境ではモバイル touch 抑止が必須** — `touch-action: none` だけだと iOS Safari で足りない。 `{ passive: false }` 付き `preventDefault` も併用
- **SpeechSynthesis 同期は `onstart` 基準 + `onboundary` 優先 + 時間フォールバック** — 単発 `setTimeout` だと音声エンジン起動遅延でズレる
- **自動進行は子供向けには邪魔** — 「子供がやめるまで自由に書ける」 が原則。 ただし進む合図 (90% / 99% / タップ) は複数用意
- **`idleMotion` フラグ** — 賑やかしキャラの「常時アニメ vs アクション時のみ」 を 1 フラグで切替できる設計は他のキャラにも転用できる

## 関連サンプル

- [`claude-launcher.md`](./claude-launcher.md) — 「うに」 を物理オブジェクトとして打ち上げる最初の形。 11 本棒のタップ伸縮演出はここから
- [`claude-suika.md`](./claude-suika.md) — 「うに」 を物理マージゲームのピースに。 ↑ ボタン + バースト演出が claude-launcher の延長
- [`happy-birthday-xylophone.md`](./happy-birthday-xylophone.md) — 並行サンプル (うに不在)、 楽器デモ
