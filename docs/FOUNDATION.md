# UniLand Foundation Library

`renderer/lib/` 配下の共通モジュール群。 `sample/` の standalone HTML から共通パターンを抽出し、
新規ゲームが軽量に書ける土台にする。 各サンプル (uni-writing-game / uni-math 等) と同じ振る舞いを
再利用できる API として公開している。

## モジュール一覧

| ファイル | 役割 | 由来 |
|---|---|---|
| `score.js` | localStorage ベースのスコア記録 + 旧キーマイグレーション | uni-math の best-score 永続化 |
| `theme.css` | クリーム + 濃茶 + うにオレンジパレット、 自前不透明 #stage、 ダークモード抑止 | uni-writing-game / uni-math 共通 |
| `uni-character.js` | `Uni` クラス + メイン/背景 3 体配置ヘルパ | uni-writing-game v11 / uni-math |
| `voice.js` | SpeechSynthesis ja-JP ラッパ (onstart + onboundary + fallback) | uni-math v10 / uni-writing-game v8 |
| `sound.js` | SE シンセ (ピンポーン / ブブー / デロロン / tick / うにループ) | uni-math + uni-writing-game |
| `mobile.js` | touch-action 抑止 + JS preventDefault | uni-writing-game v4 + uni-math v8 |
| `render.js` | 抽象描画 API、 Canvas 2D / Pictor の backend 自動切替 | [PICTOR.md](./PICTOR.md) Phase 1 |
| `scene.js` | Scene インターフェース (ゲーム 1 つ = 1 scene) | seamless 切替設計 |
| `scene-manager.js` | scene の登録 + active 切替 + lifecycle 配送 | shell が永続的に持つ |
| `index.js` | barrel export | — |

新規ゲームのボイラープレート: [`renderer/templates/game.html`](../renderer/templates/game.html)

## score.js

```js
import { getBestScore, saveScore, hasAttainedFullScore, getAllScores, getStats } from "../../lib/index.js";

const best = getBestScore("uni-math", "easy");          // → number
const { updatedBest } = saveScore("uni-math", "easy", 10, 10);
if (hasAttainedFullScore("uni-math", "easy")) { /* 次モード解放 */ }
const all = getAllScores("uni-math");                   // → { easy: {best,total,attempts,lastPlayed}, ... }
const stats = getStats();                               // → 全ゲーム集計
```

- localStorage key: `uniland.scores.v1`
- 旧キー `uni-math-best-scores-v1` から自動マイグレーション (一回のみ、 旧キーは温存)

## theme.css

`#stage` に `class="uniland-stage"` を付けると **自前で画面全体を覆う不透明レイヤー** になる。
これが [[feedback_dark_mode_stage_layer]] にあたる手筋で、 OS ダークモードでも崩れない。

主なクラス:

- `.uniland-stage` — ルートコンテナ
- `.uniland-btn` / `.uniland-btn--ghost` — ボタン (オレンジ反転 / 透明枠線)
- `.uniland-panel` — 選択肢パネル (`.is-shaking` で残り 3 秒ぐらぐら)
- `.uniland-result` + `.uniland-result__text--big` / `--small` — 結果オーバーレイ (背景は `pointer-events: none`)
- `.uniland-word` + `.uniland-word .char.is-now-speaking` — 単語読み上げハイライト
- `.uniland-progress` + `.is-current` / `.is-correct` / `.is-wrong` — 10 問進捗ドット

## uni-character.js

```js
import { Uni, createMainUni, createBackgroundTrio } from "../../lib/index.js";

const main = createMainUni(canvas.width, canvas.height);
const bg = createBackgroundTrio(canvas.width, canvas.height); // idleMotion=false 既定

function tick(now) {
  main.update(dt, now); main.draw(ctx);
  for (const u of bg) { u.update(dt, now); u.draw(ctx); }
}

// 指追従 (メインうにの触手を伸ばす)
canvas.addEventListener("pointermove", e => main.reachToward(x, y));
canvas.addEventListener("pointerup",  () => main.releaseReach());

// 賑やかしタップ → 2 アクション同時実行
for (const u of bg) if (u.hitTest(x, y)) u.triggerActions(performance.now());
```

- 11 本触手、 各基準長ランダム揺らぎ
- `idleMotion` フラグで普段の wiggle を制御
- `triggerActions()` は `{ jump, tentacle, rotate, scale }` から重複なし 2 つ同時実行 (700 ms)
- `reachToward()` は最も近い触手だけ最大 2.4 倍に伸ばす

## voice.js

```js
import { speak, cancel, speakSequence } from "../../lib/index.js";

speak("すいか", {
  onChar: (i) => highlightChar(i),
  onStart: () => audioStart(),
  onComplete: () => goNext(),
});

// 擬音 → 答え読み上げ を連続で
await speakSequence([
  { text: "ピンポンピンポン" },
  { text: "3 たす 5 は 8" },
]);

cancel(); // 進行リセット時等
```

同期方式: `onstart` で開始 → `onboundary` が来れば即優先、 100 ms 経って来なければ 280 ms/文字の等分タイマー、
最大タイムアウト (1.5 s + 0.6 s/文字) で必ず onComplete を呼ぶ。

## sound.js

```js
import { unlock, playCorrect, playWrong, playTimeout, playTick, startUniLoop, stopUniLoop } from "../../lib/index.js";

// 起動時 (ユーザジェスチャ後) に 1 回
document.getElementById("btnStart").addEventListener("click", () => unlock());

// イベント時
playCorrect();   // ピンポーン×2 ベル
playWrong();     // ブブー (sawtooth 220/195 + LPF)
playTimeout();   // デロロン (triangle 520→140 + LFO)
playTick();      // 残り 3 秒の警告 tick

// なぞり中ループ
startUniLoop();
// 離した時
stopUniLoop();
```

## render.js

```js
import { createRenderer, COLORS } from "../../lib/index.js";

const renderer = createRenderer(canvas, { preferBackend: "auto" });
renderer.setSize(800, 600);

function frame() {
  renderer.beginScene({ clearColor: COLORS.cream });
  renderer.submitCircle("uni-core", { x: 400, y: 100, r: 30, color: COLORS.white });
  renderer.submitLine("uni-tentacle-0", { x1: 400, y1: 100, x2: 460, y2: 60, w: 6, color: COLORS.uniOrange });
  renderer.submitText("title", { x: 400, y: 30, text: "せいかい", size: 88, color: COLORS.uniDeep });
  renderer.endScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- **backend 自動選択** — `window.PictorBridge` があれば pictor、 なければ canvas2d
- **retained-mode 風 API** — id を渡せば backend 側で保持される (Pictor の DOD 向け)
  - canvas2d backend では id 無しと同じ振る舞い (毎フレーム再描画)
- 色は `0xRRGGBBAA` の uint32 (theme.css の CSS 変数と同色) または CSS 文字列
- 詳細: [`PICTOR.md`](./PICTOR.md)

## scene.js + scene-manager.js (Seamless 切替)

ユーザ要請の「同一エンジンを保ったままゲーム切替、 読み込みリソース最小限」 のための層。
`renderer/shell.html` が永続的に動き、 AudioContext / SpeechSynthesis / renderer は 1 回だけ初期化される。
個別ゲームは `Scene` を継承し、 切替時は scene.exit() → scene.enter() で完結 (heavy 初期化を繰り返さない)。

### 最小実装例

```js
import { Scene } from "../../lib/index.js";

export class MyGameScene extends Scene {
  static id = "my-game";
  static label = "🎮 マイゲーム";
  static description = "短い説明 (ヒント領域に出る)";

  init(ctx) {
    // ctx.renderer / ctx.canvas / ctx.viewport / ctx.audio / ctx.voice / ctx.scoreApi / ctx.showToast
    this.ctx = ctx;
  }

  enter() { /* 切替で active になった */ }
  exit() { /* 切替で非 active になった */ }

  frame(dt, now) {
    this.ctx.renderer.beginScene({ clearColor: 0xf7f1e8ff });
    // ...描画...
    this.ctx.renderer.endScene();
  }

  onPointer(kind, ev) { /* "down"/"up"/"move" + 論理 px の x,y,button */ }
  onKey(kind, ev) { /* "down"/"up" + KeyboardEvent */ }
  onResize() { /* ctx.viewport は最新 */ }
}
```

shell.js に登録するだけで切替 chip に出る:

```js
manager.register(MyGameScene);
```

### 実装例

- `renderer/games/uni-tap/scene.js` — メイン + 背景うに 3 体、 タップで burst
- `renderer/games/uni-rain/scene.js` — うに降下 + キャッチ 30 秒セッション + ベスト記録

### 既存 sample との関係

`sample/*.html` はリファレンスとして温存、 scene 形式への移植は別作業。
`renderer/index.html` (iframe ベースの旧モックアップ閲覧) と `renderer/shell.html` (scene 形式の seamless 切替)
は併存。

## mobile.js

```js
import { installTouchGuard, applyTouchAction, getOrientation } from "../../lib/index.js";

// 起動時 1 回 (再呼び出しは無害)
installTouchGuard();

// 例外でタップ通したい要素には data-uniland-allow-touch を付ける
// (button/input/select/textarea は既定で通す)
```

`touch-action: none` と `overscroll-behavior: none` は `theme.css` で全要素既定。
それでも iOS Safari が漏らす分を JS の `{ passive: false }` preventDefault で塞ぐ。

## 既存サンプルとの対応表

| sample | 共通化される要素 |
|---|---|
| `uni-writing-game.md` | うに描画、 voice (onboundary 同期)、 sound (うにループ)、 mobile (touch-action) |
| `uni-math.md` | 全モジュール (10 問構成、 SE、 結果オーバーレイ、 ダークモード対策、 スコア永続化) |
| `claude-suika.md` | うに描画 (バースト演出は派生)、 sound (タップ反応) |
| `claude-launcher.md` | うに描画、 mobile |
| `happy-birthday-xylophone.md` | (共通モジュール非対応 — 音源サンプルベース、 別系統) |
| `word-sniper.md` | 全モジュール + 別途音声認識 |

## 設計方針

- **既存の `sample/*.html` は書き換えない**。 standalone のリファレンスとして温存
- **新規ゲームは `renderer/templates/game.html` をベース** に書く
- 共通化により 1 ゲームあたりの実装量は 30〜50% 削減見込み (SE + voice + うに + 進捗 + 結果 が共通化対象)
- 将来追加: `session.js` (10 問構成の状態機械)、 `falling.js` (降下うに物理 + キャッチ)、 `panel.js` (選択肢パネル)
