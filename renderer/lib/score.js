// Ludellus 共通スコアモジュール (localStorage ベース)。
// 中央サーバ無しで動く前提。 sample/ 個別ゲームは uni-math のように独自キーで保存していたが、
// foundation 経由のゲームは本モジュール 1 つに集約する。
//
// LocalStorage key: "ludellus.scores.v1"
// 構造:
//   {
//     "<gameId>": {
//       "<mode>": {
//         best: number,        // モード内の最高得点
//         total: number,       // 同モードの最高得点時の満点 (例: 10 問中 10 点なら 10)
//         attempts: number,    // プレイ回数 (1 セッション = 1 attempt)
//         lastPlayed: string   // ISO 8601
//       }
//     }
//   }

const STORAGE_KEY = "ludellus.scores.v1";

// プロジェクト名変更 (UniLand → Ludellus) 前のキー。 起動時に 1 回だけ吸収する。
const STORE_LEGACY_KEY = "uniland.scores.v1";

// 旧キーから一回マイグレーション (uni-math が v1 の頃に使っていた個別キー)。
const LEGACY_KEYS = {
  "uni-math-best-scores-v1": "uni-math",
};

function safeRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function safeWrite(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch {
    return false;
  }
}

function migrateLegacy(store) {
  let changed = false;
  for (const [legacyKey, gameId] of Object.entries(LEGACY_KEYS)) {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (!raw) continue;
      const legacy = JSON.parse(raw);
      if (!legacy || typeof legacy !== "object") continue;
      if (!store[gameId]) store[gameId] = {};
      // uni-math 旧形式: { easy: number, normal: number, hard: number }
      for (const [mode, score] of Object.entries(legacy)) {
        if (typeof score !== "number") continue;
        if (!store[gameId][mode] || store[gameId][mode].best < score) {
          store[gameId][mode] = {
            best: score,
            total: 10,
            attempts: store[gameId][mode]?.attempts ?? 0,
            lastPlayed: store[gameId][mode]?.lastPlayed ?? new Date().toISOString(),
          };
          changed = true;
        }
      }
      // 旧キーは削除しない (他バージョンとの互換のため温存)。
    } catch {
      // 壊れていたら無視
    }
  }
  return changed;
}

let cache = null;

function migrateStoreKey(store) {
  // ludellus.scores.v1 がまだ空で、 uniland.scores.v1 (旧プロジェクト名) があれば取り込む。
  if (Object.keys(store).length > 0) return false;
  try {
    const raw = localStorage.getItem(STORE_LEGACY_KEY);
    if (!raw) return false;
    const legacy = JSON.parse(raw);
    if (!legacy || typeof legacy !== "object") return false;
    for (const [gameId, modes] of Object.entries(legacy)) {
      store[gameId] = { ...modes };
    }
    // 旧キーは温存 (バージョン併存運用中の他クライアント対応)
    return true;
  } catch {
    return false;
  }
}

function load() {
  if (cache) return cache;
  const store = safeRead();
  let changed = migrateStoreKey(store);
  if (migrateLegacy(store)) changed = true;
  if (changed) safeWrite(store);
  cache = store;
  return cache;
}

function persist() {
  if (cache) safeWrite(cache);
}

export function getBestScore(gameId, mode) {
  const store = load();
  return store[gameId]?.[mode]?.best ?? 0;
}

export function getEntry(gameId, mode) {
  const store = load();
  return store[gameId]?.[mode] ?? null;
}

/**
 * セッション結果を記録する。
 * total を満たした (= best === total) ことがあるかどうかは getAttainedFullScore で見る。
 * 過去最高未満でも attempts と lastPlayed は更新する。
 * @returns { updatedBest: boolean }
 */
export function saveScore(gameId, mode, score, total) {
  if (typeof score !== "number" || typeof total !== "number") return { updatedBest: false };
  const store = load();
  if (!store[gameId]) store[gameId] = {};
  const prev = store[gameId][mode];
  const updatedBest = !prev || score > prev.best;
  store[gameId][mode] = {
    best: updatedBest ? score : prev.best,
    total: updatedBest ? total : prev.total,
    attempts: (prev?.attempts ?? 0) + 1,
    lastPlayed: new Date().toISOString(),
  };
  persist();
  return { updatedBest };
}

/**
 * そのモードで満点を取ったことがあるか (uni-math のデフォルトモード判定用)。
 */
export function hasAttainedFullScore(gameId, mode) {
  const entry = getEntry(gameId, mode);
  return !!entry && entry.best >= entry.total && entry.total > 0;
}

/**
 * 指定ゲームの全モードの記録を返す。
 */
export function getAllScores(gameId) {
  const store = load();
  return store[gameId] ? { ...store[gameId] } : {};
}

/**
 * 全ゲームの集計 (アプリ起動画面等で表示する用)。
 */
export function getStats() {
  const store = load();
  const out = { totalAttempts: 0, totalFullScores: 0, byGame: {} };
  for (const [gameId, modes] of Object.entries(store)) {
    const games = { attempts: 0, fullScores: 0, byMode: {} };
    for (const [mode, entry] of Object.entries(modes)) {
      games.attempts += entry.attempts;
      out.totalAttempts += entry.attempts;
      const full = entry.best >= entry.total && entry.total > 0;
      if (full) {
        games.fullScores++;
        out.totalFullScores++;
      }
      games.byMode[mode] = { ...entry, full };
    }
    out.byGame[gameId] = games;
  }
  return out;
}

/**
 * 学習指導要領との対応用にゲーム + メタデータをハングさせるための予約 API。
 * 今は実体は持たないが、将来 spec/manabi-no-tabibito.md の単元マップと結ぶ。
 */
export function attachUnitTag(/* gameId, mode, unitTag */) {
  // TODO: 単元タグの永続化 (Phase 2)
}

/**
 * テスト用・全消し。 ユーザ向け UI には絶対繋がない。
 */
export function _resetAll() {
  cache = {};
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
