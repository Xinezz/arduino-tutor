// The learner profile: ten skill areas, each with a level worked out from
// what the learner has actually DONE - never from lessons opened alone.
// Read-only: it reads the saved progress and changes nothing.
//
// The evidence for an area comes from:
//   - its lessons (done or not),
//   - its questions: every checkpoint question and in-lesson question, each
//     tracked on its own (progress.answers - see recordAnswer): right first
//     time, wrong and not yet put right, or put right after a gap,
//   - its practical work: lesson challenges that passed "Check My Solution"
//     and projects that passed their checks - and whether that happened
//     without hints,
//   - mistakes met while working (progress.mistakes), when one keeps coming back.
//
// The five levels, and what each one needs (every line has to be true, and
// every line of the levels below it):
//   Not started - nothing done in this area yet.
//   Learning    - started: a lesson done, a question answered or a challenge tried.
//   Developing  - at least half its lessons done, AND at least one question
//                 answered right or one practical activity passed.
//   Proficient  - every lesson done; at least 80% of its questions answered;
//                 at least 70% of those understood (right first time, or
//                 put right after a gap); at least one practical activity passed.
//   Mastered    - at least 90% of all its questions understood, none still wrong;
//                 every challenge passed, and at least two pieces of practical
//                 work done with no hints (one, if the area only has one);
//                 no mistake repeated in the last 7 days.
// A line that can't apply (an area with no questions, or no practical work
// yet) is shown as "not needed here" rather than silently passed.

import { lessons } from "../lessons/data.js";
import { SKILLS } from "../lessons/curriculum.js";
import { BEGINNER_PROJECTS } from "../projects/beginner.js";
import { QUESTION_BANK } from "./questionBank.js";
import { SECURE_BOX, dayString } from "./progress.js";

export const AREAS = [
  { id: "electronics", name: "Electronics fundamentals", icon: "bolt",
    about: "Electricity, voltage, current, resistance, ground, series and parallel.",
    skills: ["electricity", "voltage", "current", "resistance", "ground", "seriesparallel"] },
  { id: "circuits", name: "Circuit construction", icon: "led",
    about: "Building complete circuits: the Uno's pins, breadboards, LEDs and resistors, polarity.",
    skills: ["board", "circuits", "breadboard", "led", "polarity"] },
  { id: "programming", name: "Arduino programming fundamentals", icon: "chip",
    about: "What an Arduino is, sketch structure, the Serial Monitor, variables, types and maths.",
    skills: ["arduino", "simulator", "structure", "comments", "serial", "variables", "types", "constants", "operators", "hardware"] },
  { id: "digital", name: "Digital inputs and outputs", icon: "play",
    about: "pinMode, digitalWrite, delay, digitalRead, buttons, pull-ups and millis() timing.",
    skills: ["digital", "pinmode", "digitalwrite", "delay", "blink", "digitalread", "buttons", "pullups", "millis"] },
  { id: "analog", name: "Analog inputs and PWM", icon: "chart",
    about: "analogRead, potentiometers, map(), PWM with analogWrite, RGB LEDs.",
    skills: ["analog", "analogread", "potentiometer", "map", "pwm", "rgb"] },
  { id: "sensors", name: "Sensors and actuators", icon: "target",
    about: "Light, temperature, distance and IR sensors; buzzers, servos and motors.",
    skills: ["light", "temperature", "ultrasonic", "ir", "automation", "buzzer", "servo", "motors"] },
  { id: "logic", name: "Conditions and loops", icon: "list",
    about: "if / else, comparisons and logic, for and while loops.",
    skills: ["if", "logic", "loops"] },
  { id: "functions", name: "Functions and problem-solving", icon: "puzzle",
    about: "Splitting a sketch into named, reusable functions.",
    skills: ["functions"] },
  { id: "debugging", name: "Debugging and troubleshooting", icon: "bulb",
    about: "Reading error messages, finding bugs in code and faults in circuits.",
    skills: ["errors"],
    // also: the "find the bug" checkpoints, the circuit fault-finding lesson,
    // and every challenge you fixed yourself after a failed check
    extraLessons: ["m1-7"], debugQuizzes: true },
  { id: "projects", name: "Independent project development", icon: "trophy",
    about: "Planning and building complete projects on your own.",
    skills: ["projects", "planning"], allProjects: true },
];
export const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

export const LEVELS = [
  { id: "not-started", label: "Not started", short: "—", meaning: "Nothing done in this area yet." },
  { id: "learning", label: "Learning", short: "1", meaning: "You've started: a lesson done, a question answered or a challenge tried." },
  { id: "developing", label: "Developing", short: "2", meaning: "Half the lessons done, and you've shown some of it works for you." },
  { id: "proficient", label: "Proficient", short: "3", meaning: "All the lessons done, most questions understood, and practical work that passed its check." },
  { id: "mastered", label: "Mastered", short: "4", meaning: "Almost every question understood, practical work done without hints, and no repeated mistakes." },
];
export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);

const DAY = 86400000;
const recentTimes = (m, days, now) => m.times.filter((t) => now - new Date(t) <= days * DAY).length;

// Areas a fine skill belongs to (exactly one - checked by the tests).
export const areaOfSkill = (skill) => AREAS.find((a) => a.skills.includes(skill)) ?? null;
export const areasOfLesson = (lesson) => AREAS.filter((a) => lessonInArea(lesson, a));
function lessonInArea(lesson, area) {
  return (lesson.skills ?? []).some((s) => area.skills.includes(s)) || (area.extraLessons ?? []).includes(lesson.id);
}

// One answer record, falling back to what an older save knows: before
// questions were tracked one by one, only "this checkpoint set was solved,
// after N attempts" was kept. Solved at the first attempt means every
// question in it was right first time; anything else is treated as needing
// a review (it can't be told which question was missed).
export function answerFor(progress, item) {
  const a = progress.answers?.[item.key];
  if (a) return a;
  const legacy = item.quizId && progress.quizzes?.[item.quizId];
  if (!legacy || !legacy.attempts) return null;
  const clean = legacy.solved && legacy.attempts === 1;
  return { n: legacy.attempts, first: clean, last: legacy.lastResult === "success", box: clean ? 0 : 1, due: clean ? null : dayString(), legacy: true };
}

// "Understood": right first time, or put right after a gap (box 2 or more).
export const understood = (a) => !!a && a.last && (a.first || a.box >= 2);

function practicalsFor(area, progress, areaLessons) {
  const out = [];
  for (const l of areaLessons) {
    const c = l.challenge;
    if (!c) continue;
    const check = progress.checks?.[c.id];
    const hints = progress.hintUses?.[c.id] ?? 0;
    const legacy = !check?.passed && progress.completedChallenges?.includes(c.id);
    out.push({
      kind: "challenge", id: c.id, title: c.title, lessonId: l.id, difficulty: c.difficulty ?? "medium",
      passed: !!check?.passed || legacy, independent: !!check?.passed && !!check.independent,
      attempts: check?.attempts ?? 0, fails: Math.max(0, (check?.attempts ?? 0) - (check?.passed ? 1 : 0)), hints,
      selfFixed: !!check?.passed && !!check.independent && check.attempts > 1,
    });
  }
  for (const p of BEGINNER_PROJECTS) {
    if (!area.allProjects && !p.concepts.some((s) => area.skills.includes(s))) continue;
    const entry = progress.projects?.[p.id] ?? {};
    const done = entry.completed ?? {};
    out.push({
      kind: "project", id: p.id, title: p.title, lessonId: null, difficulty: "project",
      passed: Object.keys(done).length > 0,
      independent: !!done.independent || (!!done.challenge && !done.challenge.hints),
      modes: Object.keys(done), attempts: entry.checks?.attempts ?? 0, fails: entry.checks?.fails ?? 0, hints: entry.hints ?? 0,
    });
  }
  return out;
}

function criterion(text, met, na = false) {
  return { text, met: na ? true : met, na };
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function areaReport(area, progress, now = new Date()) {
  const areaLessons = lessons.filter((l) => lessonInArea(l, area));
  const lessonIds = new Set(areaLessons.map((l) => l.id));
  const debugQuizIds = area.debugQuizzes ? new Set(QUESTION_BANK.filter((i) => i.quiz?.type === "debug").map((i) => i.key)) : new Set();
  const items = QUESTION_BANK.filter((i) => lessonIds.has(i.lessonId) || debugQuizIds.has(i.key));
  const done = new Set(progress.viewedLessons ?? []);
  const today = dayString(now);

  const answers = items.map((item) => ({ item, a: answerFor(progress, item) }));
  const answered = answers.filter((x) => x.a);
  const firstRight = answered.filter((x) => x.a.first);
  const understoodItems = answered.filter((x) => understood(x.a));
  const unresolved = answered.filter((x) => !x.a.last);
  const pending = answered.filter((x) => x.a.box > 0 && x.a.box < SECURE_BOX);
  const due = pending.filter((x) => x.a.due && x.a.due <= today);

  const practicals = practicalsFor(area, progress, areaLessons);
  const challenges = practicals.filter((p) => p.kind === "challenge");
  const passed = practicals.filter((p) => p.passed);
  // debugging also counts every challenge (anywhere) you fixed yourself
  const selfFixed = area.debugQuizzes
    ? AREAS.filter((a) => a !== area).flatMap((a) => practicalsFor(a, progress, lessons.filter((l) => lessonInArea(l, a)))).filter((p) => p.selfFixed)
    : [];
  const selfFixedIds = [...new Set(selfFixed.map((p) => p.id))];
  const independentCount = passed.filter((p) => p.independent).length + selfFixedIds.length;

  const mistakes = Object.entries(progress.mistakes ?? {})
    .filter(([, m]) => area.debugQuizzes || lessonIds.has(m.lessonId))
    .map(([id, m]) => ({ id, label: m.label, lessonId: m.lessonId, recent14: recentTimes(m, 14, now), recent7: recentTimes(m, 7, now), total: m.times.length }));
  const repeated14 = mistakes.filter((m) => m.recent14 >= 2);
  const repeated7 = mistakes.filter((m) => m.recent7 >= 2);

  const lessonsDone = areaLessons.filter((l) => done.has(l.id)).length;
  const hints = practicals.reduce((n, p) => n + p.hints, 0);
  const attemptedPracticals = practicals.filter((p) => p.attempts > 0 || p.passed);
  const started = lessonsDone > 0 || answered.length > 0 || attemptedPracticals.length > 0;

  const noQuestions = items.length === 0;
  const noPracticals = practicals.length === 0;
  const needIndependent = Math.min(2, practicals.length + selfFixedIds.length) || 0;

  const criteria = {
    developing: [
      criterion(`Done at least half of its lessons (${lessonsDone} of ${areaLessons.length})`, lessonsDone * 2 >= areaLessons.length),
      criterion("Answered one of its questions right, or passed one of its practical activities",
        answered.some((x) => x.a.first || x.a.last) || passed.length > 0),
    ],
    proficient: [
      criterion(`Done every lesson (${lessonsDone} of ${areaLessons.length})`, lessonsDone === areaLessons.length),
      criterion(`Answered at least 80% of its questions (${answered.length} of ${items.length})`, answered.length >= 0.8 * items.length, noQuestions),
      criterion(`Understood at least 70% of the questions answered (${understoodItems.length} of ${answered.length})`,
        answered.length > 0 && understoodItems.length >= 0.7 * answered.length, noQuestions),
      criterion(`Passed at least one practical activity (${passed.length} of ${practicals.length})`, passed.length > 0, noPracticals),
    ],
    mastered: [
      criterion(`Understood at least 90% of all its questions, none still wrong (${understoodItems.length} of ${items.length})`,
        understoodItems.length >= 0.9 * items.length && unresolved.length === 0, noQuestions),
      criterion(`Passed every challenge (${challenges.filter((c) => c.passed).length} of ${challenges.length})`,
        challenges.every((c) => c.passed), challenges.length === 0),
      criterion(`Practical work done with no hints (${independentCount} of ${needIndependent || 1} needed)`,
        independentCount >= needIndependent, needIndependent === 0),
      criterion(`No mistake repeated in the last 7 days${repeated7.length ? ` (${repeated7.length} repeated)` : ""}`, repeated7.length === 0),
    ],
  };
  const allMet = (list) => list.every((c) => c.met);
  let level = "not-started";
  if (started) level = "learning";
  if (started && allMet(criteria.developing)) {
    level = "developing";
    if (allMet(criteria.proficient)) {
      level = "proficient";
      if (allMet(criteria.mastered)) level = "mastered";
    }
  }
  const nextLevel = LEVELS[levelIndex(level) + 1]?.id ?? null;
  const toNext = nextLevel && criteria[nextLevel] ? criteria[nextLevel].filter((c) => !c.met) : [];
  if (nextLevel === "learning") toNext.push(criterion("Do a lesson, answer a question or try a challenge in this area", false));

  // ---- what's going wrong (weak) and what's going right (strengths) ----
  const weak = [];
  const byLesson = new Map();
  for (const x of unresolved) {
    const list = byLesson.get(x.item.lessonId) ?? [];
    list.push(x.item);
    byLesson.set(x.item.lessonId, list);
  }
  for (const [lessonId, list] of byLesson) {
    weak.push({ kind: "question", lessonId, keys: list.map((i) => i.key), severity: 3,
      text: `${list.length === 1 ? "A question" : `${list.length} questions`} on "${list[0].topic}" ${list.length === 1 ? "was" : "were"} answered wrong and not put right yet` });
  }
  for (const p of practicals) {
    if (!p.passed && p.fails >= 2) {
      weak.push({ kind: "practical", lessonId: p.lessonId, practical: p, severity: 3,
        text: `"${p.title}" has failed its check ${p.fails} times` });
    }
  }
  for (const m of repeated14) {
    weak.push({ kind: "mistake", lessonId: m.lessonId, mistake: m, severity: m.recent14 >= 3 ? 3 : 2,
      text: `The same mistake came up ${m.recent14} times in the last two weeks: ${m.label}` });
  }
  const dueOnly = due.filter((x) => x.a.last);
  if (dueOnly.length) {
    weak.push({ kind: "review", lessonId: dueOnly[0].item.lessonId, keys: dueOnly.map((x) => x.item.key), severity: 1,
      text: `${dueOnly.length === 1 ? "A question you once missed is" : `${dueOnly.length} questions you once missed are`} due for a check that it's stuck` });
  }
  for (const l of areaLessons) {
    if ((progress.flaggedLessons ?? []).includes(l.id)) weak.push({ kind: "flag", lessonId: l.id, severity: 1, text: `You flagged "${l.title}" for another look` });
  }
  weak.sort((a, b) => b.severity - a.severity);

  const strengths = [];
  if (firstRight.length) strengths.push(`${firstRight.length} of ${answered.length} question${answered.length === 1 ? "" : "s"} right first time`);
  const corrected = answered.filter((x) => !x.a.first && x.a.box >= 2);
  if (corrected.length) strengths.push(`${corrected.length} missed question${corrected.length === 1 ? "" : "s"} put right after a gap`);
  const indep = passed.filter((p) => p.independent);
  if (indep.length) strengths.push(`${indep.length} practical activit${indep.length === 1 ? "y" : "ies"} passed with no hints`);
  if (selfFixedIds.length) strengths.push(`${selfFixedIds.length} challenge${selfFixedIds.length === 1 ? "" : "s"} fixed yourself after a failed check`);
  if (passed.length > indep.length) strengths.push(`${passed.length - indep.length} more passed with some help`);

  return {
    id: area.id, name: area.name, icon: area.icon, about: area.about, area,
    level, levelIndex: levelIndex(level), nextLevel, toNext, criteria,
    lessons: areaLessons, items, practicals,
    evidence: {
      lessonsDone, lessonsTotal: areaLessons.length,
      questionsTotal: items.length, answered: answered.length, firstRight: firstRight.length,
      understood: understoodItems.length, unresolved: unresolved.length, pendingReview: pending.length, due: due.length,
      practicalsTotal: practicals.length, practicalsPassed: passed.length,
      independent: passed.filter((p) => p.independent).length, selfFixed: selfFixedIds.length,
      attempted: attemptedPracticals.length, hints, repeatedMistakes: repeated14.length,
      accuracy: answered.length ? pct(understoodItems.length, answered.length) : null,
    },
    weak, strengths, mistakes, dueKeys: due.map((x) => x.item.key), pendingKeys: pending.map((x) => x.item.key),
    unresolvedKeys: unresolved.map((x) => x.item.key),
  };
}

export function masteryReport(progress, now = new Date()) {
  return AREAS.map((area) => areaReport(area, progress, now));
}

// Every fine skill (SKILLS) should belong to exactly one area.
export const unplacedSkills = Object.keys(SKILLS).filter((s) => AREAS.filter((a) => a.skills.includes(s)).length !== 1);
