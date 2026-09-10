// Combines every level's lessons into one flat list. Each level lives in its
// own file (level1.js, level2.js, ...) so no single file becomes unmanageable
// as the course grows - this file's only job is to glue them together in order.
//
// Note: Level 5 (Programming Fundamentals) doesn't have dedicated lessons yet
// - the concepts it would cover (if/else, loops, functions) have already been
// introduced piece-by-piece through the Level 1-4 challenges. Levels 7+
// (Communication, millis()/state machines, and the full mini-projects list)
// are also still ahead.

import { level1Lessons } from "./level1.js";
import { level2Lessons } from "./level2.js";
import { level3Lessons } from "./level3.js";
import { level4Lessons } from "./level4.js";
import { level6Lessons } from "./level6.js";

export const lessons = [
  ...level1Lessons,
  ...level2Lessons,
  ...level3Lessons,
  ...level4Lessons,
  ...level6Lessons,
];
