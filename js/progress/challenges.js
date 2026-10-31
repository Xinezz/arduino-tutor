// Personalised challenges: every practical or checked activity on the site
// sorted into four levels, and for each skill area the next one at the level
// the learner has shown they're ready for - with the reason.
//
//   Level 1 Foundation  - recognising the idea: checkpoint questions,
//                         a project in Guided mode.
//   Level 2 Developing  - working with code that's there: spot the bug,
//                         fill the gap, put the lines in order; easy challenges.
//   Level 3 Independent - writing it yourself: medium and hard challenges,
//                         a project in Challenge mode.
//   Level 4 Engineering - combining ideas and designing: boss challenges, a
//                         project in Independent mode, a project improvement.
//
// The level offered follows the area's mastery level (skills.js): Learning ->
// 1, Developing -> 2, Proficient -> 3, Mastered -> 4. If an activity at that
// level has failed its check twice and still hasn't passed, the next one
// offered is a level LOWER - more practice at the step below, never a harder
// one to "keep it interesting".

import { lessons } from "../lessons/data.js";
import { quizzes } from "../quiz/data.js";
import { BEGINNER_PROJECTS } from "../projects/beginner.js";
import { lessonPosition } from "./learning.js";

export const CHALLENGE_LEVELS = [
  null,
  { n: 1, name: "Foundation", what: "recognise the idea and follow guided steps" },
  { n: 2, name: "Developing", what: "work with existing code: modify it, finish it, find the mistake" },
  { n: 3, name: "Independent", what: "build and program it yourself from the requirements" },
  { n: 4, name: "Engineering", what: "combine several ideas, design a solution and improve it" },
];

const QUIZ_LEVEL = { questions: 1, match: 1, predict: 1, debug: 2, fill: 2, order: 2 };
const CHALLENGE_LEVEL = { easy: 2, medium: 3, hard: 3, boss: 4 };

// Every activity of an area: { id, level, kind, title, lessonId?, projectId?, mode?, done, fails, ready }
export function activitiesFor(areaReport, progress) {
  const done = new Set(progress.viewedLessons ?? []);
  const out = [];
  for (const l of areaReport.lessons) {
    const quiz = quizzes[l.id];
    const label = `${lessonPosition(l).label} ${l.title}`;
    const ready = (l.needs ?? []).every((id) => done.has(id)) || done.has(l.id);
    if (quiz) {
      out.push({ id: quiz.id, level: QUIZ_LEVEL[quiz.type] ?? 1, kind: "quiz", quizType: quiz.type, lessonId: l.id, ready,
        title: `${quiz.title} (${label})`, done: !!progress.quizzes?.[quiz.id]?.solved, fails: 0 });
    }
    if (l.challenge) {
      const p = areaReport.practicals.find((x) => x.id === l.challenge.id);
      out.push({ id: l.challenge.id, level: CHALLENGE_LEVEL[l.challenge.difficulty] ?? 3, kind: "challenge", lessonId: l.id, ready,
        title: `${l.challenge.title} (${label})`, done: !!p?.passed, fails: p?.fails ?? 0 });
    }
  }
  for (const p of areaReport.practicals.filter((x) => x.kind === "project")) {
    const project = BEGINNER_PROJECTS.find((b) => b.id === p.id);
    const ready = project.needs.every((id) => done.has(id));
    const modes = p.modes ?? [];
    out.push({ id: `${p.id}:guided`, level: 1, kind: "project", projectId: p.id, mode: "guided", ready, title: `${p.title} - Guided mode`, done: modes.length > 0, fails: p.fails });
    out.push({ id: `${p.id}:challenge`, level: 3, kind: "project", projectId: p.id, mode: "challenge", ready, title: `${p.title} - Challenge mode`, done: modes.includes("challenge") || modes.includes("independent"), fails: 0 });
    out.push({ id: `${p.id}:independent`, level: 4, kind: "project", projectId: p.id, mode: "independent", ready, title: `${p.title} - Independent mode`, done: modes.includes("independent"), fails: 0 });
  }
  return out;
}

const levelFromMastery = (levelIndex) => Math.max(1, Math.min(4, levelIndex));

// { area, level, activity, why } - the next challenge for one area, or null
// when every activity in it is done (or none is ready).
export function nextChallenge(areaReport, progress) {
  const all = activitiesFor(areaReport, progress);
  if (!all.length) return null;
  let level = levelFromMastery(areaReport.levelIndex);
  const e = areaReport.evidence;
  let why;
  const stuck = all.find((a) => a.level === level && !a.done && a.fails >= 2);
  if (stuck && level > 1) {
    level -= 1;
    why = `"${stuck.title}" has failed its check ${stuck.fails} times, so here's a Level ${level} activity first - practising the step below usually makes the harder one click.`;
  } else {
    why = {
      1: `You're starting out in ${areaReport.name}, so this is a Level 1 activity: ${CHALLENGE_LEVELS[1].what}.`,
      2: `You're Developing in ${areaReport.name} (${e.lessonsDone} of ${e.lessonsTotal} lessons${e.answered ? `, ${e.understood} of ${e.answered} questions understood` : ""}) - ready for Level 2: ${CHALLENGE_LEVELS[2].what}.`,
      3: `You're Proficient in ${areaReport.name}${e.practicalsPassed ? ` and have passed ${e.practicalsPassed} practical activit${e.practicalsPassed === 1 ? "y" : "ies"}` : ""} - ready for Level 3: ${CHALLENGE_LEVELS[3].what}.`,
      4: `You've mastered ${areaReport.name}, so this is Level 4: ${CHALLENGE_LEVELS[4].what}.`,
    }[level];
  }
  // at the chosen level first; if that's all done, the next level up, then down
  const order = [level, level + 1, level + 2, level - 1, level - 2, level - 3].filter((n) => n >= 1 && n <= 4);
  for (const n of order) {
    const candidate = all.find((a) => a.level === n && !a.done && a.ready);
    if (candidate) {
      if (n !== level) why += ` (Everything at Level ${level} here is done or not open yet, so this one is Level ${n}.)`;
      return { area: areaReport, level: n, activity: candidate, why };
    }
  }
  return null;
}
