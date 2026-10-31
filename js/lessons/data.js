// The whole course as one ordered list. Lesson CONTENT lives in the level
// files (level1.js ... and foundations.js); the ORDER, the module each lesson
// belongs to, and what it's for (objectives, prerequisites, skills) all come
// from curriculum.js. This file just joins the two.
//
// Every lesson gets, from the curriculum:
//   module / level - its module number (the sidebar, map and trophies group by it)
//   why, objectives, needs, skills - see curriculum.js

import { MODULES } from "./curriculum.js";
import { level1Lessons } from "./level1.js";
import { level2Lessons } from "./level2.js";
import { level3Lessons } from "./level3.js";
import { level4Lessons } from "./level4.js";
import { level5Lessons } from "./level5.js";
import { level6Lessons } from "./level6.js";
import { foundationLessons } from "./foundations.js";

const allLessons = [
  ...level1Lessons,
  ...level2Lessons,
  ...level3Lessons,
  ...level4Lessons,
  ...level5Lessons,
  ...level6Lessons,
  ...foundationLessons,
];
const byId = new Map(allLessons.map((l) => [l.id, l]));

export const lessons = MODULES.flatMap((module) =>
  module.lessons
    .filter((meta) => byId.has(meta.id)) // a typo here is caught by tests/curriculum.test.js
    .map((meta) => Object.assign(byId.get(meta.id), {
      level: module.number,
      module: module.number,
      why: meta.why,
      objectives: meta.objectives,
      needs: meta.needs,
      skills: meta.skills,
    }))
);

// For the tests: lessons with content that the curriculum never places, and
// curriculum entries with no lesson behind them. Both must be empty.
export const unplacedLessonIds = allLessons.filter((l) => !lessons.includes(l)).map((l) => l.id);
export const missingLessonIds = MODULES.flatMap((m) => m.lessons.map((meta) => meta.id)).filter((id) => !byId.has(id));
