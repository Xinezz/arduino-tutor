// The names of the course's levels (a.k.a. "worlds" on the map). Lives in its
// own tiny module so the sidebar, the world map and the achievements can all
// agree on them without any of those importing each other.
//
// Level 5 (Programming Fundamentals) has no dedicated lessons yet - its ideas
// are introduced piece by piece through Levels 1-4 - so the numbering skips
// from 4 to 6. See the note in data.js.

export const LEVEL_TITLES = {
  1: "Arduino Basics",
  2: "Digital I/O",
  3: "Analog Input",
  4: "PWM & Outputs",
  6: "Sensors",
};

// One sprite per world, used by the sidebar headings and the world map.
export const LEVEL_ICONS = {
  1: "book",
  2: "led",
  3: "chart",
  4: "bolt",
  6: "chip",
};

export const levelTitle = (n) => LEVEL_TITLES[n] ?? `Level ${n}`;
export const levelName = (n) => `Level ${n} · ${levelTitle(n)}`;
export const levelIcon = (n) => LEVEL_ICONS[n] ?? "map";
