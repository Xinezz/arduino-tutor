// Smart revision: short sessions built from the questions the learner has
// actually missed. Read-only - answers are saved through recordQuizResult /
// recordAnswer like any other answer, which also moves each question along
// its spaced-review schedule (see recordAnswer in progress.js).
//
// A session works on at most three missed ideas. For each one:
//   1. a recap of the idea - the key points of the lesson that teaches it,
//   2. the question that was missed,
//   3. a DIFFERENT question on the same idea (from the same lesson, or the
//      same skill area), so a right answer means "understood", not
//      "remembered the answer from last time".
// Due questions come first: missed at least a day ago and not yet secure.
// A question missed today is only used if nothing is due - and always after
// its recap, never as a bare repeat.

import { lessons } from "../lessons/data.js";
import { QUESTION_BANK } from "./questionBank.js";
import { AREAS, areasOfLesson, answerFor, understood } from "./skills.js";
import { SECURE_BOX, dayString } from "./progress.js";

const lessonById = new Map(lessons.map((l) => [l.id, l]));
const MAX_TARGETS = 3;

// { item, a } for every question that has been missed and isn't secure yet.
export function pendingQuestions(progress, now = new Date()) {
  const today = dayString(now);
  return QUESTION_BANK
    .map((item) => ({ item, a: answerFor(progress, item) }))
    .filter(({ a }) => a && a.box > 0 && a.box < SECURE_BOX)
    .map((x) => ({ ...x, isDue: !!x.a.due && x.a.due <= today, missedToday: !x.a.last && dayString(new Date(x.a.at ?? now)) === today }));
}

export function dueCount(progress, now = new Date()) {
  return pendingQuestions(progress, now).filter((x) => x.isDue).length;
}

const inArea = (item, areaId) => !areaId || areasOfLesson(lessonById.get(item.lessonId) ?? {}).some((a) => a.id === areaId);

// The recap for a lesson: its key points if it has them, otherwise what it
// sets out to teach.
export function recapFor(lessonId) {
  const lesson = lessonById.get(lessonId);
  if (!lesson) return null;
  const points = lesson.summary?.length ? lesson.summary.slice(0, 3) : (lesson.objectives ?? []).slice(0, 3);
  return { lessonId, title: lesson.title, why: lesson.why ?? null, points };
}

// The "new question" for a target: another question from the same lesson
// first, then from a lesson in the same area - one the learner hasn't
// answered, or has understood least recently. Never the target itself, and
// never one already in the session.
function checkQuestionFor(target, progress, used, areaId) {
  const candidates = QUESTION_BANK.filter((i) => i.key !== target.key && !used.has(i.key) && !i.quiz);
  const score = (i) => {
    const a = answerFor(progress, i);
    if (a && !a.last) return -1; // itself still wrong: it'll be a target of its own
    return a ? 1 + (a.at ? (Date.now() - new Date(a.at)) / 1e12 : 0) : 2; // unseen first, then the longest ago
  };
  const pick = (list) => list.filter((i) => score(i) >= 0).sort((x, y) => score(y) - score(x))[0] ?? null;
  return pick(candidates.filter((i) => i.lessonId === target.lessonId))
    ?? pick(candidates.filter((i) => inArea(i, areaId ?? areasOfLesson(lessonById.get(target.lessonId) ?? {})[0]?.id)));
}

// A session: { area, steps: [{ type: "recap", recap } | { type: "question", item, role: "missed"|"check" }] }
// or null when there's nothing to revise.
export function buildSession(progress, { area = null } = {}, now = new Date()) {
  const pending = pendingQuestions(progress, now).filter((x) => inArea(x.item, area));
  const due = pending.filter((x) => x.isDue).sort((x, y) => (x.a.last === y.a.last ? 0 : x.a.last ? 1 : -1));
  const notDue = pending.filter((x) => !x.isDue && !x.a.last);
  const targets = [...due, ...(due.length ? [] : notDue)].slice(0, MAX_TARGETS);
  if (!targets.length) return null;
  const used = new Set(targets.map((t) => t.item.key));
  const steps = [];
  for (const t of targets) {
    const recap = recapFor(t.item.lessonId);
    if (recap) steps.push({ type: "recap", recap });
    steps.push({ type: "question", item: t.item, role: "missed", missedOn: t.a.at ?? null, legacy: !!t.a.legacy });
    const check = checkQuestionFor(t.item, progress, used, area);
    if (check) {
      used.add(check.key);
      steps.push({ type: "question", item: check, role: "check" });
    }
  }
  return { area, steps, questions: steps.filter((s) => s.type === "question").length, dueNow: due.length > 0 };
}

// How revision has gone, for the dashboard and feedback: questions missed at
// first and since put right after a gap, and still waiting.
export function revisionSummary(progress, now = new Date()) {
  const answered = QUESTION_BANK.map((item) => ({ item, a: answerFor(progress, item) })).filter((x) => x.a);
  const missedAtFirst = answered.filter((x) => !x.a.first);
  const corrected = missedAtFirst.filter((x) => understood(x.a));
  const pending = pendingQuestions(progress, now);
  return {
    missedAtFirst: missedAtFirst.length,
    corrected: corrected.length,
    secure: missedAtFirst.filter((x) => x.a.box >= SECURE_BOX).length,
    pending: pending.length,
    due: pending.filter((x) => x.isDue).length,
    // what a session could work on right now: due, or wrong and not put right
    actionable: pending.filter((x) => x.isDue || !x.a.last).length,
    sessions: progress.revisionLog?.length ?? 0,
    lastSession: progress.revisionLog?.[progress.revisionLog.length - 1] ?? null,
    byArea: AREAS.map((area) => ({ area, pending: pending.filter((x) => (x.isDue || !x.a.last) && inArea(x.item, area.id)).length })).filter((x) => x.pending),
  };
}
