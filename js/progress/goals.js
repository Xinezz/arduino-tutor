// Learning goals the learner can choose. Only goals that today's content can
// really complete are offered (there's no "finish an intermediate project"
// until intermediate projects are checked), and each one's progress comes
// from tracked work - the same evidence as the skill levels, never clicks.
//
// Each goal: { id, title, why, measure(progress, report) -> { current, target, detail } }
// A goal is reached when current >= target; reaching it is saved once
// (progress.markGoalsDone) and stays reached.

import { lessons } from "../lessons/data.js";
import { MODULES } from "../lessons/curriculum.js";
import { quizzes } from "../quiz/data.js";
import { BEGINNER_PROJECTS } from "../projects/beginner.js";
import { masteryReport, levelIndex } from "./skills.js";
import { pendingQuestions } from "./revision.js";
import { pathwayStatus } from "../pathways/progress.js";

export const MAX_ACTIVE_GOALS = 3;

const area = (report, id) => report.find((a) => a.id === id);
const atLeast = (a, level) => a.levelIndex >= levelIndex(level);

function moduleGoal(m) {
  const inModule = lessons.filter((l) => l.module === m.number);
  const quizIds = inModule.map((l) => quizzes[l.id]?.id).filter(Boolean);
  return {
    id: `module-${m.number}`,
    title: `Complete Module ${m.number}: ${m.title}`,
    why: "Every lesson done and every checkpoint in it answered right - not just read.",
    measure: (progress) => {
      const done = inModule.filter((l) => progress.viewedLessons.includes(l.id)).length;
      const right = quizIds.filter((id) => progress.quizzes[id]?.solved).length;
      return { current: done + right, target: inModule.length + quizIds.length,
        detail: `${done} of ${inModule.length} lessons, ${right} of ${quizIds.length} checkpoints right` };
    },
  };
}

const independentModes = (progress) => BEGINNER_PROJECTS.filter((p) => {
  const c = progress.projects?.[p.id]?.completed ?? {};
  return c.challenge || c.independent;
});

export const GOALS = [
  ...MODULES.map(moduleGoal),
  { id: "electronics", title: "Understand basic electronics",
    why: "Electronics fundamentals at Proficient: every lesson done and most of its questions understood.",
    measure: (progress, report) => {
      const a = area(report, "electronics");
      const met = a.criteria.developing.concat(a.criteria.proficient);
      return { current: met.filter((c) => c.met).length, target: met.length, detail: `${a.name}: ${a.level.replace("-", " ")}` };
    } },
  { id: "challenges-5", title: "Pass five programming challenges",
    why: "Five lesson challenges that passed Check My Solution - your own code, checked by running it.",
    measure: (progress) => {
      const passed = Object.values(progress.checks ?? {}).filter((c) => c.passed).length;
      return { current: Math.min(passed, 5), target: 5, detail: `${passed} passed` };
    } },
  { id: "independent-5", title: "Solve five challenges without hints",
    why: "Solving it with no hint is the clearest sign you can do it on your own.",
    measure: (progress) => {
      const n = Object.values(progress.checks ?? {}).filter((c) => c.passed && c.independent).length;
      return { current: Math.min(n, 5), target: 5, detail: `${n} without hints` };
    } },
  { id: "projects-3", title: "Build all three beginner projects without Guided mode",
    why: "Challenge or Independent mode: you plan the steps yourself.",
    measure: (progress) => {
      const n = independentModes(progress).length;
      return { current: n, target: BEGINNER_PROJECTS.length, detail: `${n} of ${BEGINNER_PROJECTS.length} built` };
    } },
  { id: "inputs", title: "Master digital and analog inputs",
    why: "Both Digital inputs and outputs and Analog inputs and PWM at Mastered.",
    measure: (progress, report) => {
      const d = area(report, "digital");
      const an = area(report, "analog");
      return { current: d.levelIndex + an.levelIndex, target: 2 * levelIndex("mastered"),
        detail: `Digital: ${d.level.replace("-", " ")} · Analog: ${an.level.replace("-", " ")}` };
    } },
  { id: "pathway-electronics", title: "Complete the Electronics Engineering pathway",
    why: "All three levels: lessons, checkpoints right, every project passing its checks, and your own design.",
    measure: (progress) => {
      const s = pathwayStatus("electronics", progress);
      return { current: s.levelsComplete, target: 3, detail: `${s.levelsComplete} of 3 levels complete` };
    } },
  { id: "revision-clear", title: "Clear my revision list",
    why: "Every question you've missed put right after a gap - remembered, not just re-read.",
    measure: (progress, report, goal) => {
      const left = pendingQuestions(progress).length;
      const start = Math.max(goal?.baseline ?? left, left, 1);
      return { current: start - left, target: start, detail: left ? `${left} still to put right` : "nothing left to revise" };
    },
    baseline: (progress) => pendingQuestions(progress).length },
];
const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
export const goalById = (id) => GOAL_BY_ID[id] ?? null;

// The learner's goals with their progress: { goal, saved, current, target, detail, pct, reached }
export function goalStatus(progress, report = masteryReport(progress)) {
  return (progress.goals ?? []).filter((g) => GOAL_BY_ID[g.id]).map((saved) => {
    const goal = GOAL_BY_ID[saved.id];
    const m = goal.measure(progress, report, saved);
    const reached = !!saved.doneAt || m.current >= m.target;
    return { goal, saved, ...m, pct: Math.round((Math.min(m.current, m.target) / Math.max(1, m.target)) * 100), reached };
  });
}

// Goals that have just been reached (active, now met) - app.js saves them.
export const newlyReached = (progress, report) => goalStatus(progress, report).filter((s) => s.reached && !s.saved.doneAt).map((s) => s.goal.id);

// Goals that can still be chosen: not active, not already reached, and not
// already met (a goal you've already met isn't a goal).
export function availableGoals(progress, report = masteryReport(progress)) {
  const taken = new Set((progress.goals ?? []).map((g) => g.id));
  return GOALS.filter((g) => {
    if (taken.has(g.id)) return false;
    const m = g.measure(progress, report, { baseline: g.baseline?.(progress) });
    if (g.id === "revision-clear") return m.target > 0 && pendingQuestions(progress).length > 0;
    return m.current < m.target;
  });
}
