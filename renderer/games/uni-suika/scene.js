// うにスイカ — sample/claude-suika.md の最終仕様 (v3 + 後続) を scene 形式に最小ポート。
// 5 サイズ (1x/2x/4x/8x/16x) × 3〜5 色 で同色同サイズが触れるとマージ。 16x+16x で消滅。
// 下のバーを動かしてうにを落とす (ドラッグ → 離す)。 画面上部の line を越えると game over。
// PC 専用、 ピンチ/multi-touch は省略。 火の粉等の装飾は省く。

import { Scene, Uni } from "../../lib/index.js";

const GRAVITY = 900;
const GAMEOVER_LINE_Y_RATIO = 0.10;
const COOLDOWN_S = 0.45;
const UNLOCK_INTERVAL = 20;     // 20 個落とすごとに色解放
const COLORS = [
  0xff7a3aff, // orange
  0x3fa66aff, // green
  0x4a8edcff, // blue
  0x9b59b6ff, // purple (20 個で解放)
  0xf0bb38ff, // yellow (40 個で解放)
];
const COLOR_NAMES = ["オレンジ", "みどり", "あお", "むらさき", "きいろ"];
const SIZE_BASE = 18; // level 1 の半径
const RARE_SIZE_CHANCE = 0.20;
const BIG_BONUS = 350;
const MAX_LEVEL = 5; // 1x..16x = 5 段階

export class UniSuikaScene extends Scene {
  static id = "uni-suika";
  static label = "🍉 うにスイカ";
  static description = "おなじ いろ・おなじ おおきさを つなげて おおきく しよう";

  init(ctx) {
    this.ctx = ctx;
    this.balls = []; // { uni, vx, vy, level, color, justSpawned: number }
    this.aimX = 0;
    this.cooldown = 0;
    this.score = 0;
    this.totalDropped = 0;
    this.dragging = false;
    this.gameOver = false;
    this.next = this._rollNext();
    this.best = this.ctx.scoreApi.getBestScore("uni-suika", "default");
  }

  enter() {
    this._reset();
  }

  exit() {
    this.ctx.audio.stopUniLoop();
  }

  _reset() {
    this.balls = [];
    this.score = 0;
    this.totalDropped = 0;
    this.gameOver = false;
    this.cooldown = 0;
    this.next = this._rollNext();
    this.aimX = this.ctx.viewport.width / 2;
  }

  _unlockedColors() {
    const stages = Math.min(2, Math.floor(this.totalDropped / UNLOCK_INTERVAL));
    return 3 + stages;
  }

  _rollNext() {
    const palette = this._unlockedColors();
    const colorIdx = Math.floor(Math.random() * palette);
    let level = 1;
    if (Math.random() < RARE_SIZE_CHANCE) {
      level = 1 + Math.floor(Math.random() * MAX_LEVEL);
    }
    return { level, color: COLORS[colorIdx], colorIdx };
  }

  _radiusForLevel(level) {
    return SIZE_BASE * Math.pow(1.5, level - 1);
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;
    if (!this.gameOver) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      this._updatePhysics(dt, now);
      this._checkMerges();
      this._checkGameOver(viewport);
    }

    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    // game over line
    const lineY = viewport.height * GAMEOVER_LINE_Y_RATIO;
    renderer.submitQuad("line", { x: 0, y: lineY - 1, w: viewport.width, h: 2, color: 0xd04f2e60 });

    // ボール
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      b.uni.x = b.x; b.uni.y = b.y;
      b.uni.color = `#${(b.color >>> 8).toString(16).padStart(6, "0")}`;
      b.uni.drawAbstract(renderer, `ball${i}`);
    }

    if (!this.gameOver) {
      // 照準
      const aimY = viewport.height * 0.16;
      renderer.submitText("aim", { x: this.aimX, y: aimY, text: "↑", size: 36, color: 0xff7a3aff });
      // next preview
      renderer.submitText("next-label", { x: viewport.width - 80, y: 30, text: "NEXT", size: 14, color: 0x6b5a48ff });
      const r = this._radiusForLevel(this.next.level);
      renderer.submitCircle("next-circle", { x: viewport.width - 40, y: 30, r: Math.min(20, r * 0.6), color: this.next.color });

      // ドロップバー (画面下端の操作領域)
      const barY = viewport.height - 30;
      renderer.submitQuad("bar", { x: 16, y: barY - 8, w: viewport.width - 32, h: 12, color: 0xefe6d6ff });
      renderer.submitText("bar-hint", { x: viewport.width / 2, y: barY + 18, text: "↓ ここを ドラッグ", size: 12, color: 0x6b5a48ff });
    } else {
      renderer.submitText("over", { x: viewport.width / 2, y: viewport.height * 0.4, text: "ゲームオーバー", size: 56, color: 0xb32616ff });
      renderer.submitText("over-score", { x: viewport.width / 2, y: viewport.height * 0.55, text: `スコア: ${this.score}`, size: 32, color: 0x2a2118ff });
      renderer.submitText("over-best", { x: viewport.width / 2, y: viewport.height * 0.65, text: `ベスト: ${this.best}`, size: 18, color: 0x6b5a48ff });
      renderer.submitText("over-tap", { x: viewport.width / 2, y: viewport.height * 0.78, text: "クリックで もういちど", size: 18, color: 0xff7a3aff });
    }

    // スコア
    renderer.submitText("score", { x: 80, y: 30, text: `${this.score}`, size: 28, color: 0x2a2118ff });
    renderer.submitText("dropped", { x: 80, y: 56, text: `落: ${this.totalDropped}`, size: 12, color: 0x6b5a48ff });

    renderer.endScene();
  }

  _updatePhysics(dt, now) {
    for (const b of this.balls) {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const r = this._radiusForLevel(b.level);
      const { width, height } = this.ctx.viewport;
      // 床 (画面下端 - barH)
      const floorY = height - 30;
      if (b.y + r > floorY) {
        b.y = floorY - r;
        if (b.vy > 50) b.vy = -b.vy * 0.3; else b.vy = 0;
        b.vx *= 0.85;
      }
      if (b.x - r < 0) { b.x = r; b.vx = -b.vx * 0.5; }
      if (b.x + r > width) { b.x = width - r; b.vx = -b.vx * 0.5; }
      b.uni.update(dt, now);
    }
    // 相互衝突 (簡易、 二回パス)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.balls.length; i++) {
        for (let j = i + 1; j < this.balls.length; j++) {
          this._resolveCollision(this.balls[i], this.balls[j]);
        }
      }
    }
  }

  _resolveCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minDist = this._radiusForLevel(a.level) + this._radiusForLevel(b.level);
    if (dist >= minDist || dist === 0) return;
    const overlap = minDist - dist;
    const nx = dx / dist, ny = dy / dist;
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;
    const va = a.vx * nx + a.vy * ny;
    const vb = b.vx * nx + b.vy * ny;
    if (va < vb) return;
    const impulse = (va - vb) * 0.6;
    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
  }

  _checkMerges() {
    // 同色同サイズで接触しているペアを 1 回パスでマージ
    const merged = new Set();
    for (let i = 0; i < this.balls.length; i++) {
      if (merged.has(i)) continue;
      for (let j = i + 1; j < this.balls.length; j++) {
        if (merged.has(j)) continue;
        const a = this.balls[i], b = this.balls[j];
        if (a.colorIdx !== b.colorIdx || a.level !== b.level) continue;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist > this._radiusForLevel(a.level) + this._radiusForLevel(b.level) + 2) continue;

        // マージ実行
        if (a.level === MAX_LEVEL) {
          // 16x + 16x = 消滅 + ボーナス
          merged.add(i); merged.add(j);
          this.score += BIG_BONUS;
          this.ctx.audio.playCorrect();
        } else {
          // a を大きくして b を消す
          a.level++;
          a.x = (a.x + b.x) / 2;
          a.y = (a.y + b.y) / 2;
          a.vx = (a.vx + b.vx) / 2;
          a.vy = (a.vy + b.vy) / 2;
          merged.add(j);
          this.score += Math.pow(2, a.level);
          this.ctx.audio.playTick();
        }
      }
    }
    if (merged.size > 0) {
      this.balls = this.balls.filter((_, idx) => !merged.has(idx));
    }
  }

  _checkGameOver(viewport) {
    const lineY = viewport.height * GAMEOVER_LINE_Y_RATIO;
    for (const b of this.balls) {
      const r = this._radiusForLevel(b.level);
      const age = (performance.now() - b.justSpawned) / 1000;
      if (age < 0.6) continue; // 射出直後の猶予
      if (b.y - r < lineY) {
        this._endGame();
        return;
      }
    }
  }

  _endGame() {
    this.gameOver = true;
    const { updatedBest } = this.ctx.scoreApi.saveScore("uni-suika", "default", this.score, this.score + 100);
    if (updatedBest) this.best = this.score;
    this.ctx.audio.playTimeout();
    this.ctx.voice.speak(`${this.score} てん`);
  }

  onPointer(kind, ev) {
    if (this.gameOver) {
      if (kind === "down") this._reset();
      return;
    }
    const { height } = this.ctx.viewport;
    const barY = height - 30;

    if (kind === "down" && Math.abs(ev.y - barY) < 40) {
      this.dragging = true;
      this.aimX = ev.x;
    } else if (kind === "move" && this.dragging) {
      this.aimX = ev.x;
    } else if (kind === "up" && this.dragging) {
      this.dragging = false;
      this._drop();
    }
  }

  _drop() {
    if (this.cooldown > 0) return;
    const r = this._radiusForLevel(this.next.level);
    const uni = new Uni({ x: this.aimX, y: 60, radius: r, color: `#${(this.next.color >>> 8).toString(16).padStart(6, "0")}` });
    this.balls.push({
      uni,
      x: this.aimX, y: 60, vx: 0, vy: 0,
      level: this.next.level, color: this.next.color, colorIdx: this.next.colorIdx,
      justSpawned: performance.now(),
    });
    this.cooldown = COOLDOWN_S;
    this.totalDropped++;
    // 色解放のトースト
    if (this.totalDropped === UNLOCK_INTERVAL) {
      this.ctx.showToast(`✨ ${COLOR_NAMES[3]} かいほう！`);
    } else if (this.totalDropped === UNLOCK_INTERVAL * 2) {
      this.ctx.showToast(`✨ ${COLOR_NAMES[4]} かいほう！`);
    }
    this.next = this._rollNext();
  }
}
