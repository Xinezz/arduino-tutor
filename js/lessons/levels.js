// Names and icons for the course's modules, for the sidebar, the course map
// and the trophies - so none of those has to import the others. Everything
// comes from curriculum.js. (The functions are still called level* because a
// lesson's module number is kept in its `level` field, which the older
// modules group by.)

import { MODULES } from "./curriculum.js";

const byNumber = new Map(MODULES.map((m) => [m.number, m]));

// The teaching order of the modules.
export const LEVEL_ORDER = MODULES.map((m) => m.number);

export const levelNumber = (n) => n;
export const levelTitle = (n) => byNumber.get(n)?.title ?? `Module ${n}`;
export const levelName = (n) => `Module ${n} · ${levelTitle(n)}`;
export const levelIcon = (n) => byNumber.get(n)?.icon ?? "map";
export const moduleSummary = (n) => byNumber.get(n)?.summary ?? "";
// The parts a module's lesson board offers (null = every part).
export const moduleParts = (n) => byNumber.get(n)?.parts ?? null;
