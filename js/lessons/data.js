// Combines every level's lessons into one flat list. Each level lives in its
// own file (level1.js, level2.js, ...) so no single file becomes unmanageable
// as the course grows - this file's only job is to glue them together in order.
//
// The order here is the TEACHING order, and has to match LEVEL_ORDER in
// levels.js. Program Flow (level 5) comes second: everything from Digital
// I/O onwards leans on if/else and loops, so they're taught first.

import { level1Lessons } from "./level1.js";
import { level5Lessons } from "./level5.js";
import { level2Lessons } from "./level2.js";
import { level3Lessons } from "./level3.js";
import { level4Lessons } from "./level4.js";
import { level6Lessons } from "./level6.js";

export const lessons = [
  ...level1Lessons,
  ...level5Lessons,
  ...level2Lessons,
  ...level3Lessons,
  ...level4Lessons,
  ...level6Lessons,
];
