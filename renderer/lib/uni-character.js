// うに (Claude スターバーストロゴ) キャラの正式実装。
// sample/uni-math.html / sample/uni-writing-game.html の Uni クラスをそのまま踏襲。
//
// 仕様:
//   - 11 触手は固定角度・固定長 (ロゴ画像準拠の非対称配置)
//   - 色は Claude orange #d97757
//   - 触手の先端に thick*0.42 の小さな円 (光沢点)
//   - quadraticCurveTo で perpendicular 方向に curve、 自然な曲げ
//   - idleMotion: true で wig 進行による wiggle、 false で完全静止 (賑やかし用)
//   - アクション 4 種 (jump/tentacle/rotate/scale) を duration 0.65〜0.9s で重ねがけ可能
//
// 既存 scene の互換のため Uni({ x, y, radius, idleMotion, color }) を受け付け、
// 内部で scale = radius / DESIGN_BASE_RADIUS に変換する。

const TENT_ANGLES = [0.05, 0.55, 1.05, 1.5, 1.95, 2.45, 2.95, 3.55, 4.1, 4.65, 5.25];
const TENT_LENS   = [22,   28,   24,   30,  26,   22,   28,   24,   30,  25,   27];
const DESIGN_BASE_RADIUS = 30; // scale 1.0 のときの最大触手長
const UNI_COLOR = "#d97757";

const ACTION_TYPES = ["jump", "tentacle", "rotate", "scale"];

export class Uni {
  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} [opts.radius]    最大触手長 (px)。 既定 30
   * @param {number} [opts.scale]     代替指定 (radius と排他、 1.0 = 標準)
   * @param {boolean} [opts.idleMotion=true]
   * @param {string} [opts.color]
   */
  constructor(opts) {
    this.x = this.tx = opts.x;
    this.y = this.ty = opts.y;

    const scale = opts.scale ?? ((opts.radius ?? DESIGN_BASE_RADIUS) / DESIGN_BASE_RADIUS);
    this.baseScale = scale;
    this.scale = this.scaleTarget = scale;
    this.baseRadius = scale * DESIGN_BASE_RADIUS;

    this.color = opts.color ?? UNI_COLOR;
    this.idleMotion = opts.idleMotion ?? true;
    this.rotation = 0; // 永続回転 (降下うに用)

    // 触手 (固定角度 + 固定長)
    this.tentacles = [];
    for (let i = 0; i < TENT_ANGLES.length; i++) {
      this.tentacles.push({
        baseAngle: TENT_ANGLES[i],
        baseLen: TENT_LENS[i],
        len: TENT_LENS[i], lenTarget: TENT_LENS[i],
        wig: Math.random() * Math.PI * 2,
        wigSpeed: 0.05 + Math.random() * 0.04,
        thick: 4.5 + Math.random() * 1.8,
        curve: (Math.random() - 0.5) * 1.6,
        curveTarget: (Math.random() - 0.5) * 1.6,
      });
    }

    // アクション状態
    this.actions = [];
    this.actYOffset = 0;
    this.actScale = 1;
    this.actRot = 0;
    this.actTentBoost = null;

    // Reach (uni-writing のメインうにが指追従するため)
    this.reachActive = false;
    this.reachX = 0;
    this.reachY = 0;
    this.reachTentIdx = 0;
  }

  setTarget(x, y) {
    this.tx = x;
    this.ty = y;
  }

  /**
   * 物理シミュレーション側で uni の座標を直接動かしたい時用。
   * update() の smoothing が効かないよう x/y と tx/ty を両方同時に設定する。
   */
  physicsMove(x, y) {
    this.x = this.tx = x;
    this.y = this.ty = y;
  }

  reach(targetX, targetY) {
    this.reachActive = true;
    this.reachX = targetX;
    this.reachY = targetY;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    if (Math.hypot(dx, dy) < 1) return;
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI * 2;
    // 最も近い触手を選ぶ
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < this.tentacles.length; i++) {
      let d = Math.abs(this.tentacles[i].baseAngle - ang);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    this.reachTentIdx = best;
  }

  // 旧 API 互換: reachToward / releaseReach
  reachToward(x, y) { this.reach(x, y); }
  releaseReach() { this.reachActive = false; }

  triggerActions(_now /* compat */) {
    const pool = ACTION_TYPES.slice();
    const a1 = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const a2 = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const dur = 0.65 + Math.random() * 0.25;
    this.actions = [this._buildAction(a1, dur), this._buildAction(a2, dur)];
  }

  _buildAction(type, dur) {
    const a = { type, time: 0, duration: dur };
    if (type === "tentacle") a.tentIdx = (Math.random() * this.tentacles.length) | 0;
    if (type === "rotate")   a.dir = Math.random() < 0.5 ? 1 : -1;
    return a;
  }

  isPlayingActions() {
    return this.actions.length > 0;
  }

  /**
   * setTarget で指定した tx/ty に滑らかに近づく (opt-in)。
   * 物理駆動の scene では呼ばない (x/y を直接書き換えるため smoothing は逆効果)。
   */
  tweenToTarget(dt) {
    const bodyRate = 1 - Math.exp(-12 * dt);
    this.x += (this.tx - this.x) * bodyRate;
    this.y += (this.ty - this.y) * bodyRate;
    this.scale += (this.scaleTarget - this.scale) * bodyRate;
  }

  update(dt, _now /* compat */) {
    const tentRate = 1 - Math.exp(-15 * dt);
    for (const t of this.tentacles) {
      if (this.idleMotion) {
        t.wig += t.wigSpeed * (dt * 60);
        t.len += (t.lenTarget - t.len) * tentRate;
        if (Math.random() < 0.015) t.curveTarget = (Math.random() - 0.5) * 1.6;
        t.curve += (t.curveTarget - t.curve) * (1 - Math.exp(-4 * dt));
      }
    }

    // アクション
    this.actYOffset = 0;
    this.actScale = 1;
    this.actRot = 0;
    this.actTentBoost = null;
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const a = this.actions[i];
      a.time += dt;
      const t = a.time / a.duration;
      if (t >= 1) { this.actions.splice(i, 1); continue; }
      switch (a.type) {
        case "jump":     this.actYOffset = -50 * Math.sin(Math.PI * t); break;
        case "tentacle": this.actTentBoost = { idx: a.tentIdx, mult: 1 + 1.0 * Math.sin(Math.PI * t) }; break;
        case "rotate":   this.actRot = Math.PI * 2 * t * a.dir; break;
        case "scale":    this.actScale = 1 + 0.4 * Math.sin(Math.PI * t); break;
      }
    }
  }

  /**
   * Canvas 2D context に直接描画する (sample 完全踏襲)。
   */
  draw(ctx) {
    const drawX = this.x;
    const drawY = this.y + this.actYOffset;
    const drawScale = this.scale * this.actScale;
    const totalRot = this.rotation + this.actRot;

    ctx.save();
    ctx.translate(drawX, drawY);
    if (totalRot !== 0) ctx.rotate(totalRot);
    ctx.scale(drawScale, drawScale);

    for (let i = 0; i < this.tentacles.length; i++) {
      const t = this.tentacles[i];
      const isReach = this.reachActive && i === this.reachTentIdx;

      let angle = this.idleMotion ? t.baseAngle + Math.sin(t.wig) * 0.18 : t.baseAngle;
      let len = this.idleMotion ? t.len + Math.sin(t.wig * 1.4) * 3 : t.baseLen;
      if (this.actTentBoost && this.actTentBoost.idx === i) len *= this.actTentBoost.mult;

      // reach: 触手 1 本だけ指の方向に伸ばす
      if (isReach) {
        const dx = this.reachX - drawX;
        const dy = this.reachY - drawY;
        const reachDist = Math.hypot(dx, dy);
        // local 座標系では scale 適用前なので reachDist / drawScale が「触手長さの local 値」
        const localTarget = reachDist / drawScale;
        len = Math.max(len, Math.min(localTarget * 0.85, 90));
        angle = Math.atan2(dy, dx) - (this.rotation + this.actRot);
      }

      const ex = Math.cos(angle) * len;
      const ey = Math.sin(angle) * len;
      const perp = angle + Math.PI / 2;
      const cAmt = this.idleMotion ? t.curve * 6 + Math.sin(t.wig * 0.7) * 4 : 0;
      const cx = Math.cos(angle) * len * 0.5 + Math.cos(perp) * cAmt;
      const cy = Math.sin(angle) * len * 0.5 + Math.sin(perp) * cAmt;

      ctx.strokeStyle = isReach ? "#b85a3e" : this.color;
      ctx.lineWidth = t.thick;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();

      ctx.fillStyle = isReach ? "#b85a3e" : this.color;
      ctx.beginPath();
      ctx.arc(ex, ey, t.thick * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 抽象 renderer 経由 (Canvas 2D backend のみ実装、 Pictor backend は将来)。
   * id 引数は将来 retained-mode 対応のため受け取るが、 Canvas 2D 経路では未使用。
   */
  drawAbstract(renderer, _idPrefix) {
    const ctx = renderer?.ctx ?? renderer;
    if (ctx && typeof ctx.beginPath === "function") {
      this.draw(ctx);
    }
    // Pictor backend は Phase 3 で別実装
  }

  hitTest(px, py, pad = 0) {
    const r = 50 * this.baseScale + pad;
    return Math.hypot(px - this.x, py - this.y) < r;
  }
}

/**
 * 背景うに 3 体を sample 既定位置で配置 (uni-math: 左上 / 右上 / 下中央)。
 * @param {number} W キャンバス幅 (論理 px)
 * @param {number} H キャンバス高 (論理 px)
 */
export function createBackgroundTrio(W, H, opts = {}) {
  const scale = opts.scale ?? (opts.radius ? opts.radius / DESIGN_BASE_RADIUS : 0.62);
  const idle = opts.idleMotion ?? false;
  return [
    new Uni({ x: W * 0.15, y: H * 0.30, scale, idleMotion: idle }),
    new Uni({ x: W * 0.85, y: H * 0.30, scale, idleMotion: idle }),
    new Uni({ x: W * 0.50, y: H * 0.78, scale, idleMotion: idle }),
  ];
}

/**
 * メインうに (画面中央上)。
 */
export function createMainUni(W, H, opts = {}) {
  const scale = opts.scale ?? (opts.radius ? opts.radius / DESIGN_BASE_RADIUS : 1.0);
  return new Uni({
    x: W * 0.50,
    y: H * 0.13,
    scale,
    idleMotion: opts.idleMotion ?? true,
  });
}
