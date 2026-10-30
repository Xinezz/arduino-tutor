// The names of the course's levels (a.k.a. "worlds" on the map). Lives in its
// own tiny module so the sidebar, the world map and the achievements can all
// agree on them without any of those importing each other.
//
// A level has two numbers:
//  - its ID (the `level` field on every lesson, and the key below), which
//    never changes, because saved progress and trophies ("clear-2") use it;
//  - its POSITION in the course, which is what the learner sees ("Level 2").
// Program Flow has ID 5 but is taught second, straight after the basics:
// every later level leans on if/else and loops. LEVEL_ORDER is the teaching
// order, and must match the order data.js lists the lessons in.

export const LEVEL_TITLES = {
  1: "Arduino Basics",
  5: "Program Flow",
  2: "Digital I/O",
  3: "Analog Input",
  4: "PWM & Outputs",
  6: "Sensors",
};

export const LEVEL_ORDER = [1, 5, 2, 3, 4, 6];

// One sprite per world, used by the sidebar headings and the world map.
export const LEVEL_ICONS = {
  1: "book",
  5: "puzzle",
  2: "led",
  3: "chart",
  4: "bolt",
  6: "chip",
};

// The number the learner sees for a level (its place in the course).
export const levelNumber = (id) => {
  const i = LEVEL_ORDER.indexOf(id);
  return i === -1 ? id : i + 1;
};
export const levelTitle = (n) => LEVEL_TITLES[n] ?? `Level ${levelNumber(n)}`;
export const levelName = (n) => `Level ${levelNumber(n)} · ${levelTitle(n)}`;
export const levelIcon = (n) => LEVEL_ICONS[n] ?? "map";
