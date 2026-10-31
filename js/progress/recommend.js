// What to do next - a short list of suggestions, each from a written rule and
// each carrying WHY: the actual evidence that triggered it. Nothing here is
// random and nothing is guessed: no evidence, no suggestion (except the
// plain "next lesson in the course", which always says that's all it is).
//
// The rules, in priority order:
//   1. Questions due for spaced review         -> a revision session
//   2. An area with questions missed and not put right -> revise that area
//   3. A mistake that keeps coming back        -> the lesson that explains it
//   4. A challenge that keeps failing its check -> what it builds on
//   5. A project build that keeps failing      -> the lesson it relies on
//   6. Practical work passing without hints    -> a harder challenge (challenges.js)
//   7. A beginner project whose lessons are all done -> build it, in the mode that fits
//   8. Otherwise                                -> the next lesson in the course
// Each suggestion: { id, rule, title, why, action: { type, id?, area?, mode? }, area? }
//   action.type: "revise" | "lesson" | "challenge" | "project"

import { lessons } from "../lessons/data.js";
import { BEGINNER_PROJECTS } from "../projects/beginner.js";
import { lessonPosition, nextLesson, missingNeeds } from "./learning.js";
import { masteryReport, levelIndex } from "./skills.js";
import { pendingQuestions } from "./revision.js";
import { dayString } from "./progress.js";
import { nextChallenge } from "./challenges.js";

const lessonById = new Map(lessons.map((l) => [l.id, l]));
const label = (id) => {
  const l = lessonById.get(id);
  return l ? `${lessonPosition(l).label} ${l.title}` : null;
};
const when = (iso, now) => {
  if (!iso) return "earlier";
  const days = Math.round((now - new Date(iso)) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

export function recommendations(progress, { now = new Date(), report = masteryReport(progress, now), limit = 4 } = {}) {
  const out = [];
  const seen = new Set();
  const add = (rec) => {
    const key = `${rec.action.type}:${rec.action.id ?? rec.action.area ?? ""}:${rec.action.mode ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  };

  // 1. spaced review
  const pending = pendingQuestions(progress, now);
  const due = pending.filter((x) => x.isDue);
  const dueKeys = new Set(due.map((x) => x.item.key));
  if (due.length) {
    const oldest = due.map((x) => x.a.at).filter(Boolean).sort()[0];
    add({
      id: "review-due", rule: 1, title: `Revision: ${due.length} question${due.length === 1 ? "" : "s"} due`,
      why: `You missed ${due.length === 1 ? "this question" : "these questions"} before${oldest ? ` (the first ${when(oldest, now)})` : ""} and ${due.length === 1 ? "it's" : "they're"} due for a check. Each one comes with a quick recap and a new question on the same idea, so you'll know it's really stuck.`,
      action: { type: "revise" },
    });
  }

  const byWeight = [...report].sort((a, b) =>
    b.weak.filter((w) => w.severity >= 3).length - a.weak.filter((w) => w.severity >= 3).length);
  for (const area of byWeight) {
    for (const w of area.weak) {
      // 2. questions answered wrong, not put right - from an earlier day: one
      // missed today is already scheduled for tomorrow, and revising it a
      // minute later would only test short-term memory
      // (and not when rule 1's session already covers every one of them)
      const missedBefore = w.kind === "question" && w.keys.some((k) => {
        const at = progress.answers?.[k]?.at;
        return !at || dayString(new Date(at)) < dayString(now);
      }) && !w.keys.every((k) => dueKeys.has(k));
      if (missedBefore) {
        add({
          id: `revise-${area.id}`, rule: 2, area: area.id, title: `Revise: ${area.name}`,
          why: `${w.text}. A short session goes over the idea again${label(w.lessonId) ? ` (from ${label(w.lessonId)})` : ""}, asks it once more, then checks with a different question.`,
          action: { type: "revise", area: area.id },
        });
      }
      // 3. a repeated mistake
      if (w.kind === "mistake" && w.lessonId && label(w.lessonId)) {
        add({
          id: `mistake-${w.mistake.id}`, rule: 3, area: area.id, title: `Review ${label(w.lessonId)}`,
          why: `${w.text}. ${label(w.lessonId)} explains how it happens and how to spot it.`,
          action: { type: "lesson", id: w.lessonId },
        });
      }
      // 4. a challenge that keeps failing
      if (w.kind === "practical" && w.practical.kind === "challenge") {
        const lesson = lessonById.get(w.lessonId);
        const missing = lesson ? missingNeeds(lesson, progress) : [];
        if (missing.length) {
          add({
            id: `needs-${missing[0].id}`, rule: 4, area: area.id, title: `Do ${label(missing[0].id)} first`,
            why: `${w.text}. It builds on ${label(missing[0].id)}, which isn't done yet.`,
            action: { type: "lesson", id: missing[0].id },
          });
        } else {
          add({
            id: `retry-${w.practical.id}`, rule: 4, area: area.id, title: `Back to "${w.practical.title}"`,
            why: `${w.text}. Re-read the part of ${label(w.lessonId)} the check result mentions, then use the first hint - it points at the idea without giving the answer away.`,
            action: { type: "challenge", id: w.lessonId },
          });
        }
      }
    }
  }

  // 5. a project build that keeps failing
  for (const p of BEGINNER_PROJECTS) {
    const entry = progress.projects?.[p.id];
    if (!entry || Object.keys(entry.completed ?? {}).length || (entry.checks?.fails ?? 0) < 3) continue;
    const missing = p.needs.find((id) => !(progress.viewedLessons ?? []).includes(id));
    const weakArea = report.find((a) => a.weak.some((w) => w.severity >= 3) && a.practicals.some((x) => x.id === p.id));
    if (missing) {
      add({ id: `project-needs-${p.id}`, rule: 5, title: `Do ${label(missing)} before "${p.title}"`,
        why: `Your "${p.title}" build has failed ${entry.checks.fails} checks. It relies on ${label(missing)}, which isn't done yet.`,
        action: { type: "lesson", id: missing } });
    } else if (weakArea) {
      add({ id: `project-revise-${p.id}`, rule: 5, area: weakArea.id, title: `Revise ${weakArea.name} for "${p.title}"`,
        why: `Your "${p.title}" build has failed ${entry.checks.fails} checks, and ${weakArea.weak[0].text.charAt(0).toLowerCase() + weakArea.weak[0].text.slice(1)} - the project uses that idea.`,
        action: { type: "revise", area: weakArea.id } });
    } else {
      add({ id: `project-lesson-${p.id}`, rule: 5, title: `Review ${label(p.needs[p.needs.length - 1])}`,
        why: `Your "${p.title}" build has failed ${entry.checks.fails} checks. ${label(p.needs[p.needs.length - 1])} covers the idea it leans on most - or try Guided mode, which checks one step at a time.`,
        action: { type: "lesson", id: p.needs[p.needs.length - 1] } });
    }
  }

  // 6. ready for something harder
  const independent = report.flatMap((a) => a.practicals).filter((p) => p.passed && p.independent);
  const independentIds = [...new Set(independent.map((p) => p.id))];
  if (independentIds.length >= 2) {
    const strong = [...report].filter((a) => a.levelIndex >= levelIndex("developing")).sort((a, b) => b.levelIndex - a.levelIndex);
    for (const area of strong) {
      const next = nextChallenge(area, progress);
      if (next && next.level >= 2) {
        add({ id: `step-up-${area.id}`, rule: 6, area: area.id, title: `Level ${next.level} challenge: ${next.activity.title}`,
          why: `You've passed ${independentIds.length} practical activities without hints. ${next.why}`,
          action: next.activity.kind === "project"
            ? { type: "project", id: next.activity.projectId, mode: next.activity.mode }
            : { type: next.activity.kind === "challenge" ? "challenge" : "lesson", id: next.activity.lessonId } });
        break;
      }
    }
  }

  // 7. a project that's ready
  for (const p of BEGINNER_PROJECTS) {
    const entry = progress.projects?.[p.id];
    if (Object.keys(entry?.completed ?? {}).length) continue;
    if (!p.needs.every((id) => (progress.viewedLessons ?? []).includes(id))) continue;
    const areas = report.filter((a) => a.practicals.some((x) => x.id === p.id) && a.id !== "projects");
    const lowest = Math.min(...areas.map((a) => a.levelIndex));
    const mode = lowest >= levelIndex("mastered") ? "independent" : lowest >= levelIndex("proficient") ? "challenge" : "guided";
    const reason = mode === "guided"
      ? "Guided mode suits where you are now - each step is checked before the next"
      : mode === "challenge" ? "You're Proficient in the skills it uses, so Challenge mode: the goal and rules, hints if you want them"
        : "You've mastered the skills it uses, so Independent mode: just the problem and the requirements";
    add({ id: `project-${p.id}`, rule: 7, title: `Build "${p.title}"`,
      why: `You've done every lesson it builds on (${p.needs.map(label).filter(Boolean).join(", ")}). ${reason}.`,
      action: { type: "project", id: p.id, mode } });
    break;
  }

  // 8. the course
  const next = nextLesson(progress);
  if (next) {
    const missing = missingNeeds(next, progress);
    add({ id: `next-${next.id}`, rule: 8, title: `Next lesson: ${label(next.id)}`,
      why: progress.lastLessonId === next.id
        ? "It's the lesson you were last on, and it isn't marked done yet."
        : missing.length
          ? `It's next in the course order - though ${label(missing[0].id)} should come first.`
          : (progress.viewedLessons?.length ? "It's next in the course, and the lessons it builds on are done." : "It's where the course starts - no experience needed."),
      action: { type: "lesson", id: next.id } });
  }

  return out.sort((a, b) => a.rule - b.rule).slice(0, limit);
}

