// うにレイン — うにが画面上から落ちてくる。 クリックで キャッチ (= 消す)。
// 物理 (重力) + render 抽象 API + score 永続化を使うミニデモ。

import { Scene, Uni } from "../../lib/index.js";

const GRAVITY = 600; // px/s^2
const SPAWN_INTERVAL = 0.6; // 秒
const SCORE_KEY = { game: "uni-rain", mode: "default" };
const SESSION_DURATION = 30; // 秒

export class UniRainScene extends Scene {
  static id = "uni-rain";
  static label = "🌧 うにレイン";
  static description = "ふってくる うにを クリックして つかまえよう (30 びょう)";

  init(ctx) {
    this.ctx = ctx;
    this.falling = []; // { uni, vy }
    this.spawnTimer = 0;
    this.score = 0;
    this.elapsed = 0;
    this.finished = false;
    this.best = this.ctx.scoreApi.getBestScore(SCORE_KEY.game, SCORE_KEY.mode);
  }

  enter() {
    this.falling = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.elapsed = 0;
    this.finished = false;
  }

  exit() {
    this.ctx.audio.stopUniLoop();
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;
    if (!this.finished) this.elapsed += dt;
    if (!this.finished && this.elapsed >= SESSION_DURATION) {
      this.finished = true;
      const { updatedBest } = this.ctx.scoreApi.saveScore(SCORE_KEY.game, SCORE_KEY.mode, this.score, this.score + 99);
      this.ctx.voice.speak(updatedBest ? "ハイスコア" : `${this.score} こ`);
      if (updatedBest) this.best = this.score;
    }

    // スポーン (タイムアウトしてなければ)
    if (!this.finished) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawn(viewport.width);
        this.spawnTimer = SPAWN_INTERVAL * (0.6 + Math.random() * 0.8);
      }
    }

    // 物理 + 削除
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      item.vy += GRAVITY * dt;
      item.uni.y += item.vy * dt;
      item.uni.update(dt, now);
      if (item.uni.y - item.uni.baseRadius > viewport.height) {
        this.falling.splice(i, 1);
      }
    }

    // 描画
    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    // 残り時間バー
    const t = Math.max(0, 1 - this.elapsed / SESSION_DURATION);
    renderer.submitQuad("timer-bg", { x: 16, y: 12, w: viewport.width - 32, h: 6, color: 0xefe6d6ff });
    renderer.submitQuad("timer-fill", { x: 16, y: 12, w: (viewport.width - 32) * t, h: 6, color: 0xff7a3aff });

    // 降下うに
    for (let i = 0; i < this.falling.length; i++) {
      this.falling[i].uni.drawAbstract(renderer, `fall${i}`);
    }

    // スコア
    renderer.submitText("score", {
      x: viewport.width / 2,
      y: 48,
      text: `${this.score} こ`,
      size: 32,
      color: 0x2a2118ff,
    });
    renderer.submitText("best", {
      x: viewport.width / 2,
      y: 80,
      text: `ベスト: ${this.best}`,
      size: 16,
      color: 0x6b5a48ff,
    });

    if (this.finished) {
      renderer.submitText("end", {
        x: viewport.width / 2,
        y: viewport.height / 2,
        text: "おわり！ クリックで もういちど",
        size: 36,
        color: 0xb32616ff,
      });
    }

    renderer.endScene();
  }

  onPointer(kind, ev) {
    if (kind !== "down") return;

    if (this.finished) {
      this.enter();
      return;
    }

    // キャッチ判定 (近いものから)
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      if (item.uni.hitTest(ev.x, ev.y)) {
        item.uni.triggerActions(performance.now());
        this.score++;
        this.ctx.audio.playCorrect();
        // 0.2 秒後に消す (バースト演出を見せてから)
        setTimeout(() => {
          const idx = this.falling.indexOf(item);
          if (idx >= 0) this.falling.splice(idx, 1);
        }, 220);
        return;
      }
    }
    // ミス
    this.ctx.audio.playWrong();
  }

  _spawn(width) {
    const x = 40 + Math.random() * (width - 80);
    const r = 22 + Math.random() * 14;
    const uni = new Uni({ x, y: -r, radius: r, idleMotion: true });
    this.falling.push({ uni, vy: 40 + Math.random() * 80 });
  }
}

