// うにランチャー — sample/claude-launcher.md の scene 形式ポート。
//
// ↑ ボタン: 画面下端からランダム位置で打ち上げ
// ↓ ボタン: 画面上端からランダム位置で落下
// 飛び出したうには重力で運動し、 互いに衝突 (簡易弾性衝突)。
// うにをタップすると burst (2 アクション同時) + 周囲に衝撃波。

import { Scene, Uni } from "../../lib/index.js";

const GRAVITY = 480;     // px/s^2
const SPAWN_VY_UP = 700;  // 上方向射出時の初速 (-y)
const SPAWN_VY_DOWN = 320; // 下方向射出時の初速
const MAX_PROJECTILES = 80;
const SHOCKWAVE_RADIUS = 140;
const SHOCKWAVE_STRENGTH = 280;

export class UniLauncherScene extends Scene {
  static id = "uni-launcher";
  static label = "🚀 うにランチャー";
  static description = "↑ ボタンで うちあげ、 ↓ ボタンで おとす。 うにを クリックで しょうげきは";

  init(ctx) {
    this.ctx = ctx;
    /** @type {Array<{uni: Uni, vx: number, vy: number}>} */
    this.projectiles = [];
    this.shockwaves = []; // { x, y, t, max }
    this._buildButtons();
  }

  enter() {
    this.projectiles = [];
    this.shockwaves = [];
  }

  exit() {
    this.ctx.audio.stopUniLoop();
  }

  onResize() {
    if (!this.ctx) return;
    this._buildButtons();
  }

  _buildButtons() {
    const { width, height } = this.ctx.viewport;
    this.btnUp = { x: width * 0.36, y: height - 60, w: 110, h: 44, label: "↑ うちあげ" };
    this.btnDown = { x: width * 0.64, y: height - 60, w: 110, h: 44, label: "↓ おとす" };
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;
    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    // 物理: 重力 + 床/壁衝突 + 相互衝突
    for (const p of this.projectiles) {
      p.vy += GRAVITY * dt;
      p.uni.x += p.vx * dt;
      p.uni.y += p.vy * dt;
      p.uni.update(dt, now);

      // 床
      const floor = viewport.height - p.uni.baseRadius - 8;
      if (p.uni.y > floor && p.vy > 0) {
        p.uni.y = floor;
        p.vy = -p.vy * 0.55;
        p.vx *= 0.85;
      }
      // 壁
      if (p.uni.x < p.uni.baseRadius && p.vx < 0) {
        p.uni.x = p.uni.baseRadius;
        p.vx = -p.vx * 0.7;
      }
      if (p.uni.x > viewport.width - p.uni.baseRadius && p.vx > 0) {
        p.uni.x = viewport.width - p.uni.baseRadius;
        p.vx = -p.vx * 0.7;
      }
      // 上端 (↓ 射出の弾が画面に入ってきた後だけ衝突判定したいので簡易)
      if (p.uni.y < p.uni.baseRadius && p.vy < 0) {
        p.uni.y = p.uni.baseRadius;
        p.vy = -p.vy * 0.55;
      }
    }

    // 相互衝突 (簡易: 重複ペア 1 度だけ)
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        resolveCollision(this.projectiles[i], this.projectiles[j]);
      }
    }

    // 衝撃波: 周囲のうにに impulse
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.t += dt;
      const r = (w.t / 0.4) * w.max;
      for (const p of this.projectiles) {
        const dx = p.uni.x - w.x;
        const dy = p.uni.y - w.y;
        const d = Math.hypot(dx, dy);
        if (d < r && d > 1) {
          const falloff = 1 - d / w.max;
          const k = SHOCKWAVE_STRENGTH * falloff * dt * 6;
          p.vx += (dx / d) * k;
          p.vy += (dy / d) * k - 80 * falloff * dt;
        }
      }
      if (w.t > 0.4) this.shockwaves.splice(i, 1);
    }

    // 描画
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].uni.drawAbstract(renderer, `proj${i}`);
    }

    // 衝撃波エフェクト (薄い円)
    for (let i = 0; i < this.shockwaves.length; i++) {
      const w = this.shockwaves[i];
      const r = (w.t / 0.4) * w.max;
      // submitCircle は塗りつぶしなので、 reach 端のリングは 2 円の重ね合わせで表現
      // ここではシンプルに小さい半透明円で起点を示すだけ
      if (w.t < 0.1) {
        const alpha = Math.floor((1 - w.t / 0.1) * 80);
        renderer.submitCircle(`sw-core${i}`, {
          x: w.x, y: w.y, r: 8 + w.t * 60,
          color: 0xff7a3a00 | alpha,
        });
      }
    }

    // ボタン
    this._drawButton(renderer, this.btnUp, "btn-up");
    this._drawButton(renderer, this.btnDown, "btn-down");

    // カウンタ
    renderer.submitText("count", {
      x: viewport.width / 2,
      y: 28,
      text: `うに: ${this.projectiles.length}`,
      size: 18,
      color: 0x6b5a48ff,
    });

    renderer.endScene();
  }

  _drawButton(renderer, btn, idPrefix) {
    renderer.submitQuad(`${idPrefix}-bg`, {
      x: btn.x - btn.w / 2, y: btn.y - btn.h / 2,
      w: btn.w, h: btn.h, color: 0xff7a3aff,
    });
    renderer.submitText(`${idPrefix}-label`, {
      x: btn.x, y: btn.y, text: btn.label, size: 18, color: 0xffffffff,
    });
  }

  onPointer(kind, ev) {
    if (kind !== "down") return;

    // ボタン判定
    if (hitRect(ev, this.btnUp)) {
      this._launchUp();
      return;
    }
    if (hitRect(ev, this.btnDown)) {
      this._launchDown();
      return;
    }

    // うにタップ → burst + 衝撃波
    const now = performance.now();
    for (const p of this.projectiles) {
      if (p.uni.hitTest(ev.x, ev.y)) {
        p.uni.triggerActions(now);
        this.shockwaves.push({ x: p.uni.x, y: p.uni.y, t: 0, max: SHOCKWAVE_RADIUS });
        this.ctx.audio.playCorrect();
        return;
      }
    }
  }

  _launchUp() {
    if (this.projectiles.length >= MAX_PROJECTILES) this.projectiles.shift();
    const { width, height } = this.ctx.viewport;
    const x = 40 + Math.random() * (width - 80);
    const uni = new Uni({ x, y: height - 30, radius: 22 + Math.random() * 10 });
    const vx = (Math.random() - 0.5) * 200;
    const vy = -SPAWN_VY_UP - Math.random() * 120;
    this.projectiles.push({ uni, vx, vy });
  }

  _launchDown() {
    if (this.projectiles.length >= MAX_PROJECTILES) this.projectiles.shift();
    const { width } = this.ctx.viewport;
    const x = 40 + Math.random() * (width - 80);
    const uni = new Uni({ x, y: 20, radius: 22 + Math.random() * 10 });
    const vx = (Math.random() - 0.5) * 160;
    const vy = SPAWN_VY_DOWN + Math.random() * 100;
    this.projectiles.push({ uni, vx, vy });
  }
}

function hitRect(ev, rect) {
  return ev.x >= rect.x - rect.w / 2 && ev.x <= rect.x + rect.w / 2 &&
         ev.y >= rect.y - rect.h / 2 && ev.y <= rect.y + rect.h / 2;
}

function resolveCollision(a, b) {
  const dx = b.uni.x - a.uni.x;
  const dy = b.uni.y - a.uni.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.uni.baseRadius + b.uni.baseRadius;
  if (dist >= minDist || dist === 0) return;

  // めり込み解消
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;
  a.uni.x -= nx * overlap * 0.5;
  a.uni.y -= ny * overlap * 0.5;
  b.uni.x += nx * overlap * 0.5;
  b.uni.y += ny * overlap * 0.5;

  // 速度交換 (簡易、 同質量・反発係数 0.6)
  const va = a.vx * nx + a.vy * ny;
  const vb = b.vx * nx + b.vy * ny;
  const impulse = (vb - va) * 0.8;
  a.vx += nx * impulse;
  a.vy += ny * impulse;
  b.vx -= nx * impulse;
  b.vy -= ny * impulse;
}
