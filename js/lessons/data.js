// Combines every level's lessons into one flat list. Each level lives in its
// own file (level1.js, level2.js, ...) so no single file becomes unmanageable
// as the course grows - this file's only job is to glue them together in order.

import { level1Lessons } from "./level1.js";
import { level2Lessons } from "./level2.js";

export const lessons = [...level1Lessons, ...level2Lessons];
