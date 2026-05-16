// Ludellus 分岐 (branches) ストア + ルールベース AI 改修 — docs/AI-MOD-BUTTON.md Phase 1。
//
// localStorage に分岐ツリーを保存。 各ブランチは「親ブランチ + 適用された delta + 学力スナップショット」 を持つ。
// Phase 1 はルールベースのみ (Claude API は呼ばない)。 docs/AI-MOD-BUTTON.md 第 4 節の選択肢 A 相当。

import { getAllScores } from "./score.js";

const STORAGE_KEY = "ludellus.branches.v1";

/**
 * @typedef {object} GameBranch
 * @property {string} id                例: "uni-math#easy.v2"
 * @property {string} baseGameId        "uni-math"
 * @property {string|null} parentBranchId  ルート (main) は null
 * @property {string} mode              "easy" 等、 ベースモード
 * @property {object} generationParams  { kind: "rule"|"api", appliedDeltas: string[] }
 * @property {string[]} curriculumUnits  単元タグ (将来 spec/manabi-no-tabibito.md と結ぶ)
 * @property {string} createdAt          ISO
 * @property {object} scoreSnapshot      生成時の getAllScores 結果
 * @property {object} payload            ゲーム固有の差分パラメータ
 */

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { byId: {}, rootByGameId: {} };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { byId: {}, rootByGameId: {} };
  } catch {
    return { byId: {}, rootByGameId: {} };
  }
}

function safeWrite(store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); return true; }
  catch { return false; }
}

let cache = null;
function load() {
  if (cache) return cache;
  cache = safeRead();
  return cache;
}

function persist() {
  if (cache) safeWrite(cache);
}

function genId(baseGameId, mode, suffix) {
  return `${baseGameId}#${mode}.${suffix}`;
}

/**
 * baseGameId × mode の main ブランチを取得 (無ければ作成)。
 * @returns {GameBranch}
 */
export function getOrCreateMain(baseGameId, mode) {
  const store = load();
  const mainId = genId(baseGameId, mode, "main");
  if (store.byId[mainId]) return store.byId[mainId];

  const branch = {
    id: mainId,
    baseGameId,
    parentBranchId: null,
    mode,
    generationParams: { kind: "main", appliedDeltas: [] },
    curriculumUnits: [],
    createdAt: new Date().toISOString(),
    scoreSnapshot: getAllScores(baseGameId),
    payload: {},
  };
  store.byId[mainId] = branch;
  if (!store.rootByGameId[baseGameId]) store.rootByGameId[baseGameId] = mainId;
  persist();
  return branch;
}

/**
 * 指定 baseGameId のブランチ全部を返す (ツリー UI 用)。
 */
export function listBranches(baseGameId) {
  const store = load();
  return Object.values(store.byId).filter((b) => b.baseGameId === baseGameId);
}

/**
 * 親ブランチからルートまでの経路を返す (子供に「main 復帰まで N 段」 を見せる用)。
 */
export function pathToMain(branchId) {
  const store = load();
  const path = [];
  let current = store.byId[branchId];
  while (current && current.parentBranchId) {
    path.push(current);
    current = store.byId[current.parentBranchId];
  }
  if (current) path.push(current); // main 自身も入れる
  return path;
}

/* ── ルールベース AI 改修 ──────────────────────────── */

/**
 * 利用可能な改修ルール。 各ルールは payload (game 固有差分) を返す。
 * 「ちょっと簡単」「ちょっと難しい」 等の典型的な改修をルール化。
 */
const RULES = {
  "easier": {
    label: "もうすこし やさしく",
    description: "出題範囲を しぼる",
    apply(parent) {
      // ベース payload に対して 「簡単側」 の調整を加える。
      // ゲーム側で payload を見て解釈する想定 (ルール側は契約だけ定める)。
      const numericRange = parent.payload.numericRange ?? { min: 1, max: 9 };
      return {
        ...parent.payload,
        numericRange: {
          min: numericRange.min,
          max: Math.max(numericRange.min + 1, numericRange.max - 2),
        },
        questionCount: Math.max(5, (parent.payload.questionCount ?? 10) - 2),
      };
    },
  },
  "harder": {
    label: "もうすこし むずかしく",
    description: "出題範囲を ひろげる",
    apply(parent) {
      const numericRange = parent.payload.numericRange ?? { min: 1, max: 9 };
      return {
        ...parent.payload,
        numericRange: {
          min: numericRange.min,
          max: numericRange.max + 3,
        },
        questionCount: (parent.payload.questionCount ?? 10) + 2,
      };
    },
  },
  "kanji-mix": {
    label: "かんじを ふやす",
    description: "ひらがな問題に 漢字を まぜる",
    apply(parent) {
      return {
        ...parent.payload,
        includeKanji: true,
        kanjiRatio: (parent.payload.kanjiRatio ?? 0) + 0.3,
      };
    },
  },
};

export function listRules() {
  return Object.entries(RULES).map(([key, rule]) => ({
    key,
    label: rule.label,
    description: rule.description,
  }));
}

/**
 * 既存ブランチに対してルール改修を適用し、 新しい子ブランチを作成する。
 * @param {string} parentBranchId
 * @param {string} ruleKey
 * @returns {GameBranch|null}
 */
export function applyRule(parentBranchId, ruleKey) {
  const store = load();
  const parent = store.byId[parentBranchId];
  const rule = RULES[ruleKey];
  if (!parent || !rule) return null;

  // 兄弟数からサフィックス決定 (例: v2, v3, ...)
  const siblings = Object.values(store.byId).filter((b) => b.parentBranchId === parentBranchId);
  const suffix = `${ruleKey}-${siblings.length + 1}`;

  const child = {
    id: genId(parent.baseGameId, parent.mode, suffix),
    baseGameId: parent.baseGameId,
    parentBranchId: parent.id,
    mode: parent.mode,
    generationParams: {
      kind: "rule",
      appliedDeltas: [...parent.generationParams.appliedDeltas, ruleKey],
    },
    curriculumUnits: [...parent.curriculumUnits],
    createdAt: new Date().toISOString(),
    scoreSnapshot: getAllScores(parent.baseGameId),
    payload: rule.apply(parent),
  };

  store.byId[child.id] = child;
  persist();
  return child;
}

/**
 * テスト用全消し。
 */
export function _resetAll() {
  cache = { byId: {}, rootByGameId: {} };
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
