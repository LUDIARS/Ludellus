// Ludellus shell — 永続的に動く外殻。 foundation の AudioContext / SpeechSynthesis / renderer を
// 1 回だけ初期化し、 SceneManager に scene を登録 + 切替する。 これで scene 間遷移時に重い初期化を
// 繰り返さない (ユーザ指示の「読み込むリソースを最小限度」)。
//
// PC 専用前提 (マウス + キーボード)。 タッチも一応受けるが multi-touch は考えない。

import {
  SceneManager,
  createRenderer,
  unlock as audioUnlock,
  playCorrect, playWrong, playTimeout, playTick,
  startUniLoop, stopUniLoop,
  speak, cancel as cancelSpeech,
  getBestScore, saveScore, hasAttainedFullScore, getStats,
} from "./lib/index.js";

import { UniTapScene } from "./games/uni-tap/scene.js";
import { UniRainScene } from "./games/uni-rain/scene.js";
import { UniLauncherScene } from "./games/uni-launcher/scene.js";

// ── DOM ───────────────────────────────────────────
const canvas = document.getElementById("game");
const switcher = document.getElementById("switcher");
const btnStart = document.getElementById("btnStart");
const hint = document.getElementById("hint");
const fade = document.getElementById("fade");
const toastEl = document.getElementById("toast");

// ── 共有サービス (一度だけ初期化) ─────────────────
const renderer = createRenderer(canvas, { preferBackend: "auto" });
let viewport = { width: 0, height: 0 };

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  viewport.width = Math.max(1, Math.floor(r.width));
  viewport.height = Math.max(1, Math.floor(r.height));
  renderer.setSize(viewport.width, viewport.height);
  manager.resize();
}
window.addEventListener("resize", resize);

// ── トースト ──────────────────────────────────────
let toastTimer = null;
function showToast(text, ms = 1500) {
  toastEl.textContent = text;
  toastEl.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), ms);
}

// ── Scene 用 context ──────────────────────────────
const ctx = {
  renderer,
  canvas,
  viewport,
  scoreApi: {
    getBestScore,
    saveScore,
    hasAttainedFullScore,
    getStats,
  },
  audio: {
    playCorrect, playWrong, playTimeout, playTick,
    startUniLoop, stopUniLoop,
    unlock: audioUnlock,
  },
  voice: {
    speak,
    cancel: cancelSpeech,
  },
  showToast,
};

// ── SceneManager + 登録 ───────────────────────────
const manager = new SceneManager(ctx);
manager.register(UniTapScene);
manager.register(UniRainScene);
manager.register(UniLauncherScene);

// ── 切替 chip UI ─────────────────────────────────
function renderSwitcher() {
  switcher.innerHTML = "";
  for (const { id, label, description } of manager.list()) {
    const chip = document.createElement("button");
    chip.className = "shell-chip" + (manager.activeId === id ? " is-active" : "");
    chip.textContent = label;
    chip.title = description;
    chip.dataset.sceneId = id;
    chip.addEventListener("click", () => switchSceneWithFade(id));
    switcher.appendChild(chip);
  }
}
manager.onChange(() => {
  renderSwitcher();
  const entry = manager.list().find((s) => s.id === manager.activeId);
  hint.textContent = entry?.description ?? "";
});

async function switchSceneWithFade(id) {
  fade.classList.add("is-fading");
  await new Promise((r) => setTimeout(r, 180));
  await manager.switchTo(id);
  fade.classList.remove("is-fading");
}

renderSwitcher();

// ── 入力 ──────────────────────────────────────────
function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, button: e.button };
}
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  manager.pointer("down", canvasPos(e));
});
canvas.addEventListener("pointermove", (e) => manager.pointer("move", canvasPos(e)));
canvas.addEventListener("pointerup", (e) => {
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
  manager.pointer("up", canvasPos(e));
});
window.addEventListener("keydown", (e) => manager.key("down", e));
window.addEventListener("keyup", (e) => manager.key("up", e));

// ── スタートボタン ────────────────────────────────
btnStart.addEventListener("click", async () => {
  audioUnlock();
  if (!manager.activeId) {
    const first = manager.list()[0];
    if (first) await switchSceneWithFade(first.id);
  }
});

// ── メインループ ──────────────────────────────────
let last = performance.now();
function tick(now) {
  const dt = (now - last) / 1000;
  last = now;
  manager.frame(dt, now);
  requestAnimationFrame(tick);
}

resize();
requestAnimationFrame(tick);
