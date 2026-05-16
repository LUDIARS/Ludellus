// Web Audio API ベースの効果音。 外部音源・データ URL 不要。
// uni-math の SE 設計 (ピンポーン / ブブー / デロロン / tick) と
// uni-writing-game の「うに」 ループをまとめた。

let ctx = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/**
 * ブラウザ自動再生ポリシー対策のため、 ユーザジェスチャ後に 1 回呼ぶ。
 */
export function unlock() {
  const c = ensureCtx();
  if (!c) return false;
  if (c.state === "suspended") c.resume().catch(() => {});
  return true;
}

function envelope(node, c, when, attack, peak, decay, sustain, release, end) {
  const g = node.gain;
  g.cancelScheduledValues(when);
  g.setValueAtTime(0.0001, when);
  g.exponentialRampToValueAtTime(peak, when + attack);
  g.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustain), when + attack + decay);
  g.exponentialRampToValueAtTime(0.0001, end - 0.001);
}

/* ── 正解 「ピンポーン」 ────────────────────────── */
export function playCorrect() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const tones = [
    { f: 1320, start: 0.00, dur: 0.32 },
    { f: 1050, start: 0.10, dur: 0.36 },
    { f: 1320, start: 0.46, dur: 0.32 },
    { f: 1050, start: 0.56, dur: 0.40 },
  ];
  for (const tn of tones) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = tn.f;
    const g = c.createGain();
    const start = t0 + tn.start;
    const end = start + tn.dur;
    envelope(g, c, start, 0.005, 0.5, 0.04, 0.3, 0.2, end);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(end);
  }
}

/* ── 不正解 「ブブー」 ─────────────────────────── */
export function playWrong() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const tones = [
    { f: 220, start: 0.00, dur: 0.22 },
    { f: 195, start: 0.26, dur: 0.30 },
  ];
  const lpf = c.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 800;
  lpf.connect(c.destination);
  for (const tn of tones) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = tn.f;
    const g = c.createGain();
    const start = t0 + tn.start;
    const end = start + tn.dur;
    envelope(g, c, start, 0.005, 0.35, 0.05, 0.5, 0.15, end);
    osc.connect(g).connect(lpf);
    osc.start(start);
    osc.stop(end);
  }
}

/* ── タイムアップ 「デロローン」 ────────────────── */
export function playTimeout() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = 0.95;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(140, t0 + dur);
  const lfo = c.createOscillator();
  lfo.frequency.value = 6;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 30;
  lfo.connect(lfoGain).connect(osc.frequency);
  const g = c.createGain();
  envelope(g, c, t0, 0.01, 0.4, 0.1, 0.5, 0.4, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + dur);
  lfo.stop(t0 + dur);
}

/* ── 残り時間警告 tick ────────────────────────── */
export function playTick() {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1800;
  const g = c.createGain();
  envelope(g, c, t0, 0.001, 0.15, 0.03, 0.0, 0.0, t0 + 0.05);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.05);
}

/* ── 「うに」 ループ (sawtooth+square BPF 母音遷移) ── */
let uniLoopId = null;

function playUniOnce(pitchJitter = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = 0.18;
  const f0 = 200 + pitchJitter;
  const osc1 = c.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = f0;
  const osc2 = c.createOscillator();
  osc2.type = "square";
  osc2.frequency.value = f0 * 0.5;

  // フォルマント 「う」 → 「い」
  const bpf1 = c.createBiquadFilter();
  bpf1.type = "bandpass";
  bpf1.frequency.setValueAtTime(320, t0);
  bpf1.frequency.linearRampToValueAtTime(280, t0 + dur);
  bpf1.Q.value = 8;
  const bpf2 = c.createBiquadFilter();
  bpf2.type = "bandpass";
  bpf2.frequency.setValueAtTime(800, t0);
  bpf2.frequency.linearRampToValueAtTime(2200, t0 + dur);
  bpf2.Q.value = 7;

  // tanh 風歪み (ボイスロイド風量子化)
  const ws = c.createWaveShaper();
  const curve = new Float32Array(513);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / 256) - 1;
    curve[i] = Math.tanh(x * 2.5) * 0.8;
  }
  ws.curve = curve;

  const g = c.createGain();
  envelope(g, c, t0, 0.005, 0.18, 0.04, 0.4, 0.04, t0 + dur);

  osc1.connect(bpf1);
  osc2.connect(bpf2);
  bpf1.connect(ws);
  bpf2.connect(ws);
  ws.connect(g).connect(c.destination);

  osc1.start(t0);
  osc2.start(t0);
  osc1.stop(t0 + dur);
  osc2.stop(t0 + dur);
}

export function startUniLoop() {
  if (uniLoopId) return;
  const schedule = () => {
    const jitter = (Math.random() - 0.5) * 14;
    playUniOnce(jitter);
    const interval = 260 + Math.random() * 50;
    uniLoopId = setTimeout(schedule, interval);
  };
  schedule();
}

export function stopUniLoop() {
  if (uniLoopId) {
    clearTimeout(uniLoopId);
    uniLoopId = null;
  }
}
