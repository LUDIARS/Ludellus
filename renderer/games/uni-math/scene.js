// うにけいさん — sample/uni-math.md の最終仕様 (v8) を scene 形式にポート。
// 10 問構成 + 3 モード (easy/normal/hard) + op-hole 曖昧性チェック + 降下うにキャッチ。
// PC マウス前提、 multi-touch は省略。 火の粉/呼吸等の装飾は最小限。

import { Scene, Uni } from "../../lib/index.js";

const SESSION_LENGTH = 10;
const QUESTION_TIME = 10;        // 秒
const SHAKE_FROM = 3;            // 残 3 秒で shake
const SCORE_KEY = "uni-math";
const COVERAGE_MAX_FALL_RAIN = 60;

const OPS = ["+", "−", "×", "÷"];

const MODE_CONFIG = {
  easy:   { ops: ["+"],            opHole: false, twoDigitC: false, exclude0: true,  numericMax: 8, choicesNum: 2, choicesOp: 0 },
  normal: { ops: ["+", "−"],       opHole: true,  twoDigitC: false, exclude0: false, numericMax: 9, choicesNum: 3, choicesOp: 2 },
  hard:   { ops: ["+", "−", "×", "÷"], opHole: true, twoDigitC: true, exclude0: false, numericMax: 12, choicesNum: 4, choicesOp: 4 },
};

const MESSAGES = [
  { min: 10, text: "すごいね！ ぱーふぇくと！" },
  { min: 8,  text: "とっても じょうず！" },
  { min: 6,  text: "やったね！" },
  { min: 4,  text: "もうすこし！" },
  { min: 1,  text: "つぎは がんばろう！" },
  { min: 0,  text: "がんばろう！" },
];

export class UniMathScene extends Scene {
  static id = "uni-math";
  static label = "🧮 うにけいさん";
  static description = "10 もん といて けいさんを おぼえよう";

  init(ctx) {
    this.ctx = ctx;
    this.mode = "easy";
    this.state = "idle";   // idle | playing | resolving | session-end
    this.problem = null;
    this.choices = [];
    this.timeLeft = QUESTION_TIME;
    this.results = [];     // "ok" | "ng" | "to" の配列
    this.score = 0;
    this.index = 0;
    this.falling = [];     // 正解時の降下うに
    this.bgUnis = [];
    this._buildBg();
    this._showStart();
  }

  enter() {
    this._showStart();
  }

  exit() {
    this.ctx.audio.stopUniLoop();
    this.ctx.voice.cancel();
  }

  onResize() {
    if (!this.ctx) return;
    this._buildBg();
  }

  _buildBg() {
    const { width, height } = this.ctx.viewport;
    const r = Math.min(width, height) * 0.05;
    this.bgUnis = [
      new Uni({ x: width * 0.12, y: height * 0.78, radius: r, idleMotion: false }),
      new Uni({ x: width * 0.88, y: height * 0.78, radius: r, idleMotion: false }),
      new Uni({ x: width * 0.50, y: height * 0.90, radius: r, idleMotion: false }),
    ];
  }

  _showStart() {
    this.state = "idle";
    this.problem = null;
    this.results = [];
    this.score = 0;
    this.index = 0;
  }

  _newProblem() {
    const cfg = MODE_CONFIG[this.mode];
    let attempts = 0;
    while (attempts++ < 200) {
      const op = cfg.ops[Math.floor(Math.random() * cfg.ops.length)];
      const { a, b, c } = randomOperands(op, cfg);
      if (c == null) continue;
      if (cfg.exclude0 && (a === 0 || b === 0 || c === 0)) continue;
      if (!cfg.twoDigitC && c >= 10) continue;

      // 穴決定: 数字穴 or 演算子穴
      const canOpHole = cfg.opHole && !(a === 0 || b === 0); // op 穴は A/B=0 禁止
      const canCHole = !(cfg.twoDigitC && c >= 10);
      const holeCandidates = ["a", "b"];
      if (canCHole) holeCandidates.push("c");
      if (canOpHole) holeCandidates.push("op");

      const hole = holeCandidates[Math.floor(Math.random() * holeCandidates.length)];

      // op 穴の場合は曖昧性チェック (他の op でも同じ c が出るなら除外)
      if (hole === "op") {
        let matchCount = 0;
        for (const o of cfg.ops) {
          const v = applyOp(a, b, o);
          if (v != null && Number.isInteger(v) && v === c) matchCount++;
        }
        if (matchCount > 1) continue; // 曖昧
      }

      const problem = { a, b, c, op, hole };
      const choices = makeChoices(problem, cfg);
      if (!choices) continue;
      return { problem, choices };
    }
    return null;
  }

  startSession() {
    this.state = "playing";
    this.results = [];
    this.score = 0;
    this.index = 0;
    this.falling = [];
    this._nextQuestion();
  }

  _nextQuestion() {
    if (this.index >= SESSION_LENGTH) {
      this._finishSession();
      return;
    }
    const gen = this._newProblem();
    if (!gen) {
      console.warn("[uni-math] question generation failed");
      this._finishSession();
      return;
    }
    this.problem = gen.problem;
    this.choices = gen.choices;
    this.timeLeft = QUESTION_TIME;
    this.state = "playing";
  }

  _finishSession() {
    this.state = "session-end";
    const msg = MESSAGES.find(m => this.score >= m.min)?.text ?? "がんばろう！";
    this.ctx.scoreApi.saveScore(SCORE_KEY, this.mode, this.score, SESSION_LENGTH);
    this.ctx.voice.speak(msg);
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;

    // タイマー
    if (this.state === "playing") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) this._timeout();
    }

    // 降下うに物理
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const item = this.falling[i];
      item.vy += 500 * dt;
      item.uni.y += item.vy * dt;
      item.uni.update(dt, now);
      if (item.uni.y - item.uni.baseRadius > viewport.height) {
        this.falling.splice(i, 1);
      }
    }

    // 背景うに
    for (const u of this.bgUnis) u.update(dt, now);

    // ── 描画
    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    // 背景うに
    for (let i = 0; i < this.bgUnis.length; i++) {
      this.bgUnis[i].drawAbstract(renderer, `bg${i}`);
    }
    // 降下うに
    for (let i = 0; i < this.falling.length; i++) {
      this.falling[i].uni.drawAbstract(renderer, `fall${i}`);
    }

    if (this.state === "idle") {
      this._drawStart(renderer, viewport);
    } else if (this.state === "playing" || this.state === "resolving") {
      this._drawProblem(renderer, viewport, now);
    } else if (this.state === "session-end") {
      this._drawSessionEnd(renderer, viewport);
    }

    renderer.endScene();
  }

  _drawStart(renderer, viewport) {
    renderer.submitText("title", { x: viewport.width / 2, y: viewport.height * 0.3, text: "うにけいさん", size: 48, color: 0xb32616ff });
    const modes = ["easy", "normal", "hard"];
    const labels = { easy: "やさしい", normal: "ふつう", hard: "むずかしい" };
    const y = viewport.height * 0.5;
    for (let i = 0; i < modes.length; i++) {
      const x = viewport.width * (0.25 + 0.25 * i);
      const isActive = this.mode === modes[i];
      renderer.submitQuad(`mode-${modes[i]}`, {
        x: x - 60, y: y - 22, w: 120, h: 44,
        color: isActive ? 0xff7a3aff : 0xfffaf1ff,
      });
      renderer.submitText(`mode-label-${modes[i]}`, {
        x, y, text: labels[modes[i]], size: 18, color: isActive ? 0xffffffff : 0x2a2118ff,
      });
    }
    renderer.submitText("start", { x: viewport.width / 2, y: viewport.height * 0.72, text: "▶ はじめる (クリック)", size: 22, color: 0xff7a3aff });
    const best = this.ctx.scoreApi.getBestScore(SCORE_KEY, this.mode);
    if (best > 0) {
      renderer.submitText("best", { x: viewport.width / 2, y: viewport.height * 0.83, text: `ベスト: ${best}/${SESSION_LENGTH}`, size: 16, color: 0x6b5a48ff });
    }
  }

  _drawProblem(renderer, viewport, now) {
    // 進捗ドット
    const dotY = 32;
    const dotSpacing = 22;
    const startX = viewport.width / 2 - (SESSION_LENGTH - 1) * dotSpacing / 2;
    for (let i = 0; i < SESSION_LENGTH; i++) {
      const x = startX + i * dotSpacing;
      const r = i === this.index ? 8 : 6;
      let color = 0xc8b8a4ff;
      if (this.results[i] === "ok") color = 0x3fa66aff;
      else if (this.results[i] === "ng" || this.results[i] === "to") color = 0xd04f2eff;
      renderer.submitCircle(`dot-${i}`, { x, y: dotY, r, color });
    }

    // タイマーバー
    const barW = (this.timeLeft / QUESTION_TIME) * (viewport.width - 60);
    renderer.submitQuad("timer", { x: 30, y: 56, w: Math.max(0, barW), h: 5, color: 0xff7a3aff });

    // 式
    const p = this.problem;
    const yEq = viewport.height * 0.35;
    const cx = viewport.width / 2;
    const itemW = 80;
    renderer.submitText("eq-a", { x: cx - itemW * 2, y: yEq, text: p.hole === "a" ? "？" : String(p.a), size: 56, color: 0x2a2118ff });
    renderer.submitText("eq-op", { x: cx - itemW, y: yEq, text: p.hole === "op" ? "？" : p.op, size: 56, color: 0x2a2118ff });
    renderer.submitText("eq-b", { x: cx, y: yEq, text: p.hole === "b" ? "？" : String(p.b), size: 56, color: 0x2a2118ff });
    renderer.submitText("eq-eq", { x: cx + itemW, y: yEq, text: "=", size: 56, color: 0x2a2118ff });
    renderer.submitText("eq-c", { x: cx + itemW * 2, y: yEq, text: p.hole === "c" ? "？" : String(p.c), size: 56, color: 0x2a2118ff });

    // 選択肢パネル
    const panelY = viewport.height * 0.62;
    const shake = this.timeLeft < SHAKE_FROM && this.state === "playing";
    const shakeOff = shake ? Math.sin(now * 0.04) * 3 : 0;
    const totalW = this.choices.length * 110;
    for (let i = 0; i < this.choices.length; i++) {
      const x = cx - totalW / 2 + i * 110 + 55;
      const ch = this.choices[i];
      renderer.submitQuad(`choice-${i}-bg`, {
        x: x - 50, y: panelY - 28 + shakeOff,
        w: 100, h: 56, color: 0xfffaf1ff,
      });
      renderer.submitText(`choice-${i}-label`, {
        x, y: panelY + shakeOff, text: String(ch), size: 36, color: 0xb32616ff,
      });
    }
  }

  _drawSessionEnd(renderer, viewport) {
    const msg = MESSAGES.find(m => this.score >= m.min)?.text ?? "がんばろう！";
    renderer.submitText("res-score", { x: viewport.width / 2, y: viewport.height * 0.4, text: `${this.score} / ${SESSION_LENGTH}`, size: 72, color: 0xb32616ff });
    renderer.submitText("res-msg", { x: viewport.width / 2, y: viewport.height * 0.55, text: msg, size: 32, color: 0x2a2118ff });
    renderer.submitText("res-restart", { x: viewport.width / 2, y: viewport.height * 0.78, text: "クリックで もういちど", size: 18, color: 0x6b5a48ff });
  }

  onPointer(kind, ev) {
    if (kind !== "down") return;
    const { width, height } = this.ctx.viewport;

    if (this.state === "idle") {
      // モードボタン判定
      const y = height * 0.5;
      if (Math.abs(ev.y - y) < 25) {
        const modes = ["easy", "normal", "hard"];
        for (let i = 0; i < modes.length; i++) {
          const x = width * (0.25 + 0.25 * i);
          if (Math.abs(ev.x - x) < 60) {
            this.mode = modes[i];
            this.ctx.audio.playTick();
            return;
          }
        }
      }
      // start ボタン (画面下半分どこでも)
      if (ev.y > height * 0.6) {
        this.startSession();
        return;
      }
    }

    if (this.state === "playing") {
      // 選択肢タップ判定
      const panelY = height * 0.62;
      if (Math.abs(ev.y - panelY) < 32) {
        const cx = width / 2;
        const totalW = this.choices.length * 110;
        for (let i = 0; i < this.choices.length; i++) {
          const x = cx - totalW / 2 + i * 110 + 55;
          if (Math.abs(ev.x - x) < 50) {
            this._answer(this.choices[i]);
            return;
          }
        }
      }
    }

    if (this.state === "session-end") {
      this._showStart();
    }
  }

  _answer(picked) {
    const p = this.problem;
    const correct = this._correctAnswer();
    const isCorrect = String(picked) === String(correct);
    this.results[this.index] = isCorrect ? "ok" : "ng";
    if (isCorrect) {
      this.score++;
      this.ctx.audio.playCorrect();
      this.ctx.voice.speak(`${p.a} ${opVerbal(p.op)} ${p.b} は ${p.c}`);
      this._spawnFalling();
    } else {
      this.ctx.audio.playWrong();
      this.ctx.voice.speak(`${p.a} ${opVerbal(p.op)} ${p.b} は ${p.c}`);
    }
    this.state = "resolving";
    setTimeout(() => {
      this.index++;
      this._nextQuestion();
    }, isCorrect ? 1500 : 2200);
  }

  _timeout() {
    this.results[this.index] = "to";
    this.ctx.audio.playTimeout();
    this.ctx.voice.speak(`こたえは ${this.problem.c}`);
    this.state = "resolving";
    setTimeout(() => {
      this.index++;
      this._nextQuestion();
    }, 2200);
  }

  _correctAnswer() {
    const p = this.problem;
    if (p.hole === "a") return p.a;
    if (p.hole === "b") return p.b;
    if (p.hole === "c") return p.c;
    if (p.hole === "op") return p.op;
    return null;
  }

  _spawnFalling() {
    if (this.falling.length >= COVERAGE_MAX_FALL_RAIN) return;
    const { width } = this.ctx.viewport;
    const count = Math.min(this.problem.c + this.choices.length, 12);
    for (let i = 0; i < count; i++) {
      const x = 40 + Math.random() * (width - 80);
      const uni = new Uni({ x, y: -10, radius: 16 + Math.random() * 8 });
      this.falling.push({ uni, vy: 50 + Math.random() * 60 });
    }
  }
}

/* ── ヘルパ ────────────────────────────────────── */

function randomOperands(op, cfg) {
  const max = cfg.numericMax;
  let a = Math.floor(Math.random() * (max + 1));
  let b = Math.floor(Math.random() * (max + 1));
  let c;
  switch (op) {
    case "+": c = a + b; break;
    case "−":
      if (a < b) [a, b] = [b, a]; // 負にならないように
      c = a - b;
      break;
    case "×":
      a = Math.floor(Math.random() * 9) + 1;
      b = Math.floor(Math.random() * 9) + 1;
      c = a * b;
      break;
    case "÷":
      b = Math.floor(Math.random() * 9) + 1;
      const result = Math.floor(Math.random() * 9) + 1;
      a = b * result;
      c = result;
      break;
    default: return { a, b, c: null };
  }
  return { a, b, c };
}

function applyOp(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}

function makeChoices(problem, cfg) {
  const target = problem.hole === "op" ? problem.op : problem[problem.hole];
  const count = problem.hole === "op" ? cfg.choicesOp : cfg.choicesNum;
  if (count < 2) return null;

  const choices = new Set([target]);
  let attempts = 0;
  while (choices.size < count && attempts++ < 50) {
    let candidate;
    if (problem.hole === "op") {
      candidate = cfg.ops[Math.floor(Math.random() * cfg.ops.length)];
    } else {
      const min = cfg.exclude0 ? 1 : 0;
      candidate = min + Math.floor(Math.random() * (cfg.numericMax + 1 - min));
    }
    choices.add(candidate);
  }
  if (choices.size < count) return null;
  const arr = [...choices];
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function opVerbal(op) {
  switch (op) {
    case "+": return "たす";
    case "−": return "ひく";
    case "×": return "かける";
    case "÷": return "わる";
    default: return op;
  }
}
