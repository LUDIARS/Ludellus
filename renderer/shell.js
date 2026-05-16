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
  getOrCreateMain, listBranches, applyRule, listRules, pathToMain,
  getAbilityProfile, stepsToMain,
} from "./lib/index.js";
import { CURRICULUM_UNITS, findUnit, defaultUnitTags } from "./lib/curriculum.js";

import { UniTapScene } from "./games/uni-tap/scene.js";
import { UniRainScene } from "./games/uni-rain/scene.js";
import { UniLauncherScene } from "./games/uni-launcher/scene.js";
import { UniMathScene } from "./games/uni-math/scene.js";
import { UniSuikaScene } from "./games/uni-suika/scene.js";
import { UniWritingScene } from "./games/uni-writing/scene.js";

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
manager.register(UniMathScene);
manager.register(UniSuikaScene);
manager.register(UniWritingScene);

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

// ── AI 改修 modal ─────────────────────────────────
const btnAiMod = document.getElementById("btnAiMod");
const aiModModal = document.getElementById("aiModModal");
const aiModRules = document.getElementById("aiModRules");
const aiModBranchList = document.getElementById("aiModBranchList");
const btnAiModClose = document.getElementById("btnAiModClose");

function openAiModModal() {
  if (!manager.activeId) {
    showToast("まず あそびを えらんでね");
    return;
  }
  renderAiModRules();
  renderAiModBranches();
  aiModModal.hidden = false;
}

function closeAiModModal() {
  aiModModal.hidden = true;
}

function renderAiModRules() {
  aiModRules.innerHTML = "";
  for (const r of listRules()) {
    const card = document.createElement("button");
    card.className = "ai-mod-modal__rule";
    card.innerHTML = `<div class="ai-mod-modal__rule-label">${r.label}</div><div class="ai-mod-modal__rule-desc">${r.description}</div>`;
    card.addEventListener("click", () => applyAiMod(r.key));
    aiModRules.appendChild(card);
  }
}

function renderAiModBranches() {
  aiModBranchList.innerHTML = "";
  const gameId = manager.activeId;
  const mode = "default";
  getOrCreateMain(gameId, mode);
  const branches = listBranches(gameId);

  // 学力プロファイル (このゲームの単元のみ抜き出して表示)
  const profile = getAbilityProfile();
  const ownUnits = defaultUnitTags(gameId, mode);
  if (ownUnits.length > 0) {
    const profDiv = document.createElement("div");
    profDiv.className = "ai-mod-branch";
    profDiv.innerHTML = `<div class="ai-mod-branch__path">📚 たんげん:</div>`;
    for (const unitId of ownUnits) {
      const unit = findUnit(unitId);
      const p = profile[unitId];
      const levelLabel = p ? levelLabelJa(p.level) : "まだ";
      const ratio = p ? `(${p.best}/${p.total})` : "";
      profDiv.innerHTML += `<div style="margin-left:0.6rem;font-size:0.78rem;">• ${unit?.label ?? unitId} — ${levelLabel} ${ratio}</div>`;
    }
    aiModBranchList.appendChild(profDiv);
  }

  if (branches.length === 0) {
    aiModBranchList.innerHTML += `<div class="ai-mod-branch">まだ えだは ないよ</div>`;
    return;
  }
  for (const b of branches) {
    const div = document.createElement("div");
    div.className = "ai-mod-branch";
    const path = pathToMain(b.id);
    const hops = path.length - 1;
    const created = new Date(b.createdAt).toLocaleDateString();
    const steps = stepsToMain(b.id);
    div.innerHTML = `
      <div><strong>${b.id}</strong> (${created})</div>
      <div class="ai-mod-branch__path">main まで ${hops} だん${hops > 0 ? "" : " (これが main)"}</div>
      ${steps.length > 0 ? `<div class="ai-mod-branch__path">↩ ${steps.map(s => s.humanLabel).join(" → ")}</div>` : ""}
    `;
    aiModBranchList.appendChild(div);
  }
}

function levelLabelJa(level) {
  switch (level) {
    case "mastered":   return "🌟 ばっちり";
    case "competent":  return "✨ できる";
    case "learning":   return "✏ おぼえちゅう";
    case "untouched":
    default:           return "—";
  }
}

function applyAiMod(ruleKey) {
  const gameId = manager.activeId;
  const mode = "default";
  const main = getOrCreateMain(gameId, mode);
  // 現状は main 直下に作る (将来: 現在 active なブランチ id を保持して下流に伸ばす)
  const child = applyRule(main.id, ruleKey);
  if (child) {
    showToast(`✨ あたらしい えだ「${child.id}」 を つくったよ`);
    renderAiModBranches();
  }
}

btnAiMod.addEventListener("click", openAiModModal);
btnAiModClose.addEventListener("click", closeAiModModal);
aiModModal.addEventListener("click", (e) => {
  if (e.target === aiModModal) closeAiModModal();
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
