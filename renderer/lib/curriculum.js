// 学習指導要領 × 学年 × 教科 × 単元の静的マップ。
// spec/manabi-no-tabibito.md の概要に対応する単元タグだけ最小実装。
// 将来は Ludellus-Server `/api/v1/curriculum` から fetch する想定だが、 オフライン優先のため
// クライアントにも同等データを bundle して持つ ([[project-ludellus]] のオフライン方針)。

export const CURRICULUM_UNITS = [
  // 国語
  { id: "japanese.g1.hiragana",   label: "ひらがな",   grade: 1, subject: "japanese" },
  { id: "japanese.g1.katakana",   label: "カタカナ",   grade: 1, subject: "japanese" },
  { id: "japanese.g2.kanji",      label: "2 年漢字",   grade: 2, subject: "japanese" },
  { id: "japanese.g3.kanji",      label: "3 年漢字",   grade: 3, subject: "japanese" },
  // 算数
  { id: "math.g1.unit1.add",      label: "たしざん",   grade: 1, subject: "math" },
  { id: "math.g1.unit2.sub",      label: "ひきざん",   grade: 1, subject: "math" },
  { id: "math.g2.unit1.add2digit",label: "2 ケタの たしざん", grade: 2, subject: "math" },
  { id: "math.g2.unit3.mul",      label: "かけざん",   grade: 2, subject: "math" },
  { id: "math.g3.unit1.div",      label: "わりざん",   grade: 3, subject: "math" },
];

/**
 * game × mode の標準単元タグ。 各ゲームの default branch がこの単元を持つ。
 */
export const DEFAULT_UNIT_TAGS = {
  "uni-math": {
    "easy":   ["math.g1.unit1.add"],
    "normal": ["math.g1.unit1.add", "math.g1.unit2.sub"],
    "hard":   ["math.g2.unit1.add2digit", "math.g2.unit3.mul", "math.g3.unit1.div"],
    "default": ["math.g1.unit1.add"],
  },
  "uni-writing-game": {
    "hira":   ["japanese.g1.hiragana"],
    "kata":   ["japanese.g1.katakana"],
    "kanji":  ["japanese.g2.kanji", "japanese.g3.kanji"],
    "all":    ["japanese.g1.hiragana", "japanese.g1.katakana", "japanese.g2.kanji", "japanese.g3.kanji"],
    "default": ["japanese.g1.hiragana"],
  },
  "uni-suika":   { "default": [] },
  "uni-tap":     { "default": [] },
  "uni-rain":    { "default": [] },
  "uni-launcher":{ "default": [] },
};

export function findUnit(unitId) {
  return CURRICULUM_UNITS.find(u => u.id === unitId) ?? null;
}

export function defaultUnitTags(gameId, mode = "default") {
  return DEFAULT_UNIT_TAGS[gameId]?.[mode] ?? [];
}
