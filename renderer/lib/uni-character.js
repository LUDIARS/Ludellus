// うに (Claude スターバーストロゴ) キャラのキャンバス描画 + 簡易アクションシステム。
// uni-writing-game / uni-math から共通仕様を抽出した。
//
// 11 本の触手を放射状に配置、 各触手の基準長は微妙に揺らがせる (ロゴの不規則感を再現)。
// idleMotion = true で常時 wiggle、 false で完全静止。
// 背景うにの賑やかしは idleMotion = false + タップで { jump, tentacle, rotate, scale } から
// 2 つ重複なしで同時実行。

const TENTACLE_COUNT = 11;
const ACTION_KEYS = ["jump", "tentacle", "rotate", "scale"];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pickTwo(arr) {
  const a = Math.floor(Math.random() * arr.length);
  let b = Math.floor(Math.random() * (arr.length - 1));
  if (b >= a) b++;
  return [arr[a], arr[b]];
}

export class Uni {
  /**
   * @param {object} opts
   * @param {number} opts.x         キャンバス座標
   * @param {number} opts.y
   * @param {number} opts.radius    基本半径 (px)
   * @param {boolean} [opts.idleMotion=true]
   * @param {string} [opts.color]   触手の色 (デフォルトは --uni-orange 相当)
   */
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.baseRadius = opts.radius;
    this.idleMotion = opts.idleMotion ?? true;
    this.color = opts.color ?? "#ff7a3a";
    this.coreColor = opts.coreColor ?? "#fffaf1";

    // 触手ごとに微妙に違う基準長 (Claude ロゴの不規則感)
    this.tentacles = [];
    for (let i = 0; i < TENTACLE_COUNT; i++) {
      const baseAngle = (i / TENTACLE_COUNT) * Math.PI * 2 + rand(-0.05, 0.05);
      this.tentacles.push({
        baseAngle,
        baseLen: 1.0 + rand(-0.18, 0.18),
        wig: rand(0, Math.PI * 2),
        len: 1.0,
        curve: 0,
        curveTarget: rand(-0.08, 0.08),
      });
    }

    // アクション状態
    this.actYOffset = 0;
    this.actRot = 0;
    this.actScale = 1;
    this.actTentBoost = 0;
    this.actUntil = 0;
    this.actStartAt = 0;
    this.actSet = null;
  }

  update(dt, now) {
    if (this.idleMotion) {
      for (const t of this.tentacles) {
        t.wig += dt * 1.4;
        t.len += (t.baseLen - t.len) * 0.06;
        if (Math.random() < 0.01) t.curveTarget = rand(-0.08, 0.08);
        t.curve += (t.curveTarget - t.curve) * 0.05;
      }
    }

    // アクションの更新
    if (this.actSet && now < this.actUntil) {
      const p = (now - this.actStartAt) / (this.actUntil - this.actStartAt);
      const wave = Math.sin(p * Math.PI);
      this.actYOffset = this.actSet.includes("jump") ? -this.baseRadius * 0.9 * wave : 0;
      this.actRot = this.actSet.includes("rotate") ? p * Math.PI * 2 : 0;
      this.actScale = this.actSet.includes("scale") ? 1 + 0.35 * wave : 1;
      this.actTentBoost = this.actSet.includes("tentacle") ? 0.6 * wave : 0;
    } else if (this.actSet) {
      this.actSet = null;
      this.actYOffset = 0;
      this.actRot = 0;
      this.actScale = 1;
      this.actTentBoost = 0;
    }
  }

  /**
   * { jump, tentacle, rotate, scale } から 2 つ重複なしで同時実行する。
   * 既にアクション中なら無視。
   * @param {number} now performance.now() などの ms 単位の現在時刻
   * @param {number} [durationMs=700]
   */
  triggerActions(now, durationMs = 700) {
    if (this.actSet && now < this.actUntil) return false;
    this.actSet = pickTwo(ACTION_KEYS);
    this.actStartAt = now;
    this.actUntil = now + durationMs;
    return true;
  }

  /**
   * 指定の絶対座標 (キャンバス座標) に触手の先端を向ける。
   * メインうにの「指追従」 用。 距離に応じて 1 本だけ伸長させる。
   */
  reachToward(targetX, targetY) {
    let bestIdx = 0;
    let bestDot = -Infinity;
    const dx = targetX - this.x;
    const dy = (targetY - this.y) + this.actYOffset;
    const targetAngle = Math.atan2(dy, dx);
    for (let i = 0; i < this.tentacles.length; i++) {
      const a = this.tentacles[i].baseAngle;
      const d = Math.cos(a - targetAngle);
      if (d > bestDot) {
        bestDot = d;
        bestIdx = i;
      }
    }
    const dist = Math.hypot(dx, dy);
    const stretch = Math.min(2.4, dist / this.baseRadius);
    for (let i = 0; i < this.tentacles.length; i++) {
      this.tentacles[i].baseLen = i === bestIdx ? 1.0 + stretch : 1.0 + rand(-0.18, 0.18);
    }
  }

  /**
   * 既存の reach をリセットして通常状態に戻す。
   */
  releaseReach() {
    for (const t of this.tentacles) {
      t.baseLen = 1.0 + rand(-0.18, 0.18);
    }
  }

  draw(ctx) {
    const cx = this.x;
    const cy = this.y + this.actYOffset;
    const r = this.baseRadius * this.actScale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.actRot);

    // 触手
    ctx.strokeStyle = this.color;
    ctx.lineCap = "round";
    for (const t of this.tentacles) {
      const angle = this.idleMotion ? t.baseAngle + Math.sin(t.wig) * 0.05 : t.baseAngle;
      const len = (t.len + this.actTentBoost) * r * 1.4;
      const curve = this.idleMotion ? t.curve : 0;
      ctx.lineWidth = Math.max(2, r * 0.18);

      const ax = Math.cos(angle) * r * 0.35;
      const ay = Math.sin(angle) * r * 0.35;
      const bx = Math.cos(angle) * len;
      const by = Math.sin(angle) * len;
      // 軽く curve を効かせる (法線方向にオフセット)
      const nx = -Math.sin(angle) * curve * len;
      const ny = Math.cos(angle) * curve * len;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + bx * 0.5 + nx, ay + by * 0.5 + ny, bx, by);
      ctx.stroke();
    }

    // 中央コア
    ctx.fillStyle = this.coreColor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * このうにに pointer がヒットしているか (アクション発動用)。
   */
  hitTest(px, py, pad = 8) {
    const dx = px - this.x;
    const dy = py - (this.y + this.actYOffset);
    return Math.hypot(dx, dy) <= this.baseRadius * 1.4 * this.actScale + pad;
  }

  /**
   * 抽象 render API ([[render.js]] の createRenderer 返り値) 経由で描画する。
   * id を渡すと触手 + コアをユニークな retain id で submit (Pictor backend で差分更新が効く)。
   * 既存サンプルが Canvas 2D で書かれていた頃の `draw(ctx)` と等価。
   */
  drawAbstract(renderer, idPrefix) {
    const r = this.baseRadius * this.actScale;
    const cx = this.x;
    const cy = this.y + this.actYOffset;
    const lineColor = this.color === "#ff7a3a" ? 0xff7a3aff : this.color;
    const coreColor = this.coreColor === "#fffaf1" ? 0xfffaf1ff : this.coreColor;

    for (let i = 0; i < this.tentacles.length; i++) {
      const t = this.tentacles[i];
      const angle = (this.idleMotion ? t.baseAngle + Math.sin(t.wig) * 0.05 : t.baseAngle) + this.actRot;
      const len = (t.len + this.actTentBoost) * r * 1.4;
      const ax = cx + Math.cos(angle) * r * 0.35;
      const ay = cy + Math.sin(angle) * r * 0.35;
      const bx = cx + Math.cos(angle) * len;
      const by = cy + Math.sin(angle) * len;
      renderer.submitLine(`${idPrefix}:t${i}`, {
        x1: ax, y1: ay, x2: bx, y2: by,
        w: Math.max(2, r * 0.18),
        color: lineColor,
      });
    }
    renderer.submitCircle(`${idPrefix}:core`, {
      x: cx, y: cy, r: r * 0.35,
      color: coreColor,
    });
  }
}

/**
 * 背景うに 3 体を画面の左下・右下・下中央に配置するヘルパ。
 * uni-math / uni-writing-game の配置基準 (W*0.12, H*0.86) 等に合わせる。
 */
export function createBackgroundTrio(canvasWidth, canvasHeight, opts = {}) {
  const r = opts.radius ?? Math.min(canvasWidth, canvasHeight) * 0.06;
  const idle = opts.idleMotion ?? false;
  return [
    new Uni({ x: canvasWidth * 0.12, y: canvasHeight * 0.86, radius: r, idleMotion: idle }),
    new Uni({ x: canvasWidth * 0.88, y: canvasHeight * 0.86, radius: r, idleMotion: idle }),
    new Uni({ x: canvasWidth * 0.50, y: canvasHeight * 0.93, radius: r, idleMotion: idle }),
  ];
}

/**
 * メインうにを画面上中央に配置するヘルパ (uni-writing-game v11 の最終配置)。
 */
export function createMainUni(canvasWidth, canvasHeight, opts = {}) {
  const r = opts.radius ?? Math.min(canvasWidth, canvasHeight) * 0.08;
  return new Uni({
    x: canvasWidth * 0.50,
    y: canvasHeight * 0.13,
    radius: r,
    idleMotion: opts.idleMotion ?? true,
  });
}
