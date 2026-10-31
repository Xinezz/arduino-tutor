// What the learner has actually learned - read from their saved progress,
// never changing it. Used by the Learn page (what's next, which lessons are
// ready), the lesson header (prerequisites) and the Progress page (skills,
// what needs revision).
//
// Evidence of understanding, from weakest to strongest:
//   a lesson marked done -> its checkpoint quiz answered correctly ->
//   its challenge passing "Check My Solution" -> passing it with no hints.
// XP, coins and trophies are deliberately not part of this.

import { lessons } from "../lessons/data.js";
import { SKILLS } from "../lessons/curriculum.js";
import { getQuizForLesson } from "../quiz/data.js";

export const lessonById = (id) => lessons.find((l) => l.id === id) ?? null;

// Where a lesson sits: Module 2, lesson 3 of 11 ("2.3").
export function lessonPosition(lesson) {
  const inModule = lessons.filter((l) => l.module === lesson.module);
  const index = inModule.indexOf(lesson) + 1;
  return { module: lesson.module, index, count: inModule.length, label: `${lesson.module}.${index}` };
}

// The prerequisite lessons that aren't done yet.
export function missingNeeds(lesson, progress) {
  const done = new Set(progress.viewedLessons);
  return (lesson.needs || []).filter((id) => !done.has(id)).map(lessonById).filter(Boolean);
}

// The one lesson to do next: the lesson you were last on if you haven't
// finished it, otherwise the first unfinished lesson in course order.
export function nextLesson(progress) {
  const done = new Set(progress.viewedLessons);
  const last = lessonById(progress.lastLessonId);
  if (last && !done.has(last.id)) return last;
  return lessons.find((l) => !done.has(l.id)) ?? null;
}

// "done" | "next" | "ready" | "locked". Locked means a prerequisite isn't
// done yet - it's a recommendation, not a wall: the lesson can still be opened.
export function lessonStatus(lesson, progress, next = nextLesson(progress)) {
  if (progress.viewedLessons.includes(lesson.id)) return "done";
  if (next && next.id === lesson.id) return "next";
  return missingNeeds(lesson, progress).length ? "locked" : "ready";
}

// How a lesson's challenge went: null (no challenge), or
// { passed, independent, attempts, legacy } - legacy = marked solved before
// solutions were checked.
export function challengeEvidence(lesson, progress) {
  const c = lesson.challenge;
  if (!c) return null;
  const check = progress.checks?.[c.id];
  if (check?.passed) return { passed: true, independent: !!check.independent, attempts: check.attempts, legacy: false };
  const legacy = progress.completedChallenges.includes(c.id);
  return { passed: legacy, independent: false, attempts: check?.attempts ?? 0, legacy };
}

// One entry per skill in the curriculum:
// { id, name, lessons, status, revision: [reasons], reviewLesson }
// status: "not-started" | "learning" | "learned" | "practised" | "mastered"
export function skillReport(progress) {
  const done = new Set(progress.viewedLessons);
  const report = [];
  for (const [id, name] of Object.entries(SKILLS)) {
    const teaching = lessons.filter((l) => l.skills?.includes(id));
    if (!teaching.length) continue;
    const doneCount = teaching.filter((l) => done.has(l.id)).length;
    const challenges = teaching.map((l) => challengeEvidence(l, progress)).filter(Boolean);
    const quizzes = teaching.map((l) => getQuizForLesson(l.id)).filter(Boolean).map((q) => progress.quizzes[q.id]);

    let status = "not-started";
    if (doneCount > 0) status = "learning";
    if (doneCount === teaching.length) status = "learned";
    if (challenges.some((c) => c.passed)) status = "practised";
    if (challenges.length && challenges.every((c) => c.passed && c.independent) && quizzes.every((q) => !q || q.solved)) status = "mastered";

    const revision = [];
    let reviewLesson = teaching[0];
    for (const l of teaching) {
      const q = getQuizForLesson(l.id);
      const result = q && progress.quizzes[q.id];
      if (result && !result.solved) { revision.push(`the "${q.topic}" checkpoint isn't answered correctly yet`); reviewLesson = l; }
      if (l.challenge && progress.hintUses[l.challenge.id] > 0 && !progress.checks?.[l.challenge.id]?.passed) {
        revision.push(`"${l.challenge.title}" needed hints and hasn't passed its check yet`);
        reviewLesson = l;
      }
      if (progress.flaggedLessons.includes(l.id)) { revision.push(`you flagged "${l.title}"`); reviewLesson = l; }
    }
    report.push({ id, name, lessons: teaching, doneCount, status, revision, reviewLesson });
  }
  return report;
}

// Totals for the Progress page.
export function learningSummary(progress) {
  const withChallenge = lessons.filter((l) => l.challenge);
  const evidence = withChallenge.map((l) => challengeEvidence(l, progress));
  const quizLessons = lessons.filter((l) => getQuizForLesson(l.id));
  return {
    lessonsDone: lessons.filter((l) => progress.viewedLessons.includes(l.id)).length,
    lessonsTotal: lessons.length,
    challengesPassed: evidence.filter((e) => e.passed).length,
    challengesIndependent: evidence.filter((e) => e.passed && e.independent).length,
    challengesTotal: withChallenge.length,
    checkpointsPassed: quizLessons.filter((l) => progress.quizzes[getQuizForLesson(l.id).id]?.solved).length,
    checkpointsTotal: quizLessons.length,
  };
}

// Questions for a revision round: checkpoints from lessons you've finished
// or checkpoints you've tried - the ones you got wrong first, then the rest
// in a random order, up to `count`.
export function revisionQuizzes(progress, count = 3, random = Math.random) {
  // lessons you've finished, plus any checkpoint you've already tried
  const pool = lessons
    .map((l) => ({ lesson: l, quiz: getQuizForLesson(l.id) }))
    .filter((x) => x.quiz && (progress.viewedLessons.includes(x.lesson.id) || progress.quizzes[x.quiz.id]));
  const weak = pool.filter((x) => progress.quizzes[x.quiz.id] && !progress.quizzes[x.quiz.id].solved);
  const rest = pool.filter((x) => !weak.includes(x));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...weak, ...rest].slice(0, count);
}
