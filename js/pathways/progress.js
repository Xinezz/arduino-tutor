// Where a learner is in a pathway - read from saved progress, never changing
// it. A level is complete only when there's evidence for every part of it:
//   - each lesson marked done,
//   - each lesson's checkpoint answered right (the same per-question record
//     as the core course, so a missed question also comes back in revision),
//   - each project passed its final check (any mode),
//   - and for the design level: the design project built WITHOUT Guided mode
//     (Challenge or Independent), with its design decisions written in the
//     project log. (Written, not marked - the site can't grade your reasons,
//     and doesn't pretend to; it only checks you've recorded them.)
// The certificate needs all three levels. Opening a lesson counts for nothing.

import { lessons } from "../lessons/data.js";
import { PATHWAYS, LEVEL_NAMES, pathwayById, pathwayLessonById, pathwayProjectById } from "./data.js";

const coreLesson = (id) => lessons.find((l) => l.id === id) ?? null;
export const DESIGN_LOG_MIN = 60; // characters: a couple of real sentences

const criterion = (text, met) => ({ text, met: !!met });

export function missingCore(pathway, progress) {
  return (pathway.needs ?? []).filter((id) => !(progress.viewedLessons ?? []).includes(id)).map(coreLesson).filter(Boolean);
}

// A pathway lesson's own unmet prerequisites: core lessons and earlier pathway lessons.
export function lessonGaps(lesson, progress) {
  const entry = progress.pathways?.[lesson.pathway];
  const done = new Set(entry?.lessonsDone ?? []);
  return {
    core: (lesson.needs ?? []).filter((id) => !(progress.viewedLessons ?? []).includes(id)).map(coreLesson).filter(Boolean),
    pathway: (lesson.after ?? []).filter((id) => !done.has(id)).map(pathwayLessonById).filter(Boolean),
  };
}

function projectEvidence(project, progress) {
  const entry = progress.projects?.[project.id] ?? {};
  const modes = Object.keys(entry.completed ?? {});
  return {
    project, modes, passed: modes.length > 0,
    withoutGuide: modes.includes("challenge") || modes.includes("independent"),
    fails: entry.checks?.fails ?? 0,
    log: entry.log ?? {},
  };
}

export function pathwayStatus(pathway, progress) {
  if (typeof pathway === "string") pathway = pathwayById(pathway);
  const entry = progress.pathways?.[pathway.id] ?? null;
  if (pathway.status !== "available") return { pathway, available: false, started: false, levels: [], complete: false };
  const done = new Set(entry?.lessonsDone ?? []);
  const levels = [];
  for (const n of [1, 2, 3]) {
    const def = pathway.levels[n];
    const lessonRows = def.lessons.map((id) => {
      const lesson = pathwayLessonById(id);
      const quiz = progress.quizzes?.[lesson.quiz.id];
      return { lesson, done: done.has(id), checkpoint: !!quiz?.solved, tried: !!quiz };
    });
    const projectRows = def.projects.map((id) => projectEvidence(pathwayProjectById(id), progress));
    const criteria = [
      criterion(`Every lesson done (${lessonRows.filter((r) => r.done).length} of ${lessonRows.length})`, lessonRows.every((r) => r.done)),
      criterion(`Every checkpoint answered right (${lessonRows.filter((r) => r.checkpoint).length} of ${lessonRows.length})`, lessonRows.every((r) => r.checkpoint)),
    ];
    const ordinary = projectRows.filter((r) => r.project.id !== def.designProject);
    if (ordinary.length) criteria.push(criterion(`Every project passed its final check (${ordinary.filter((r) => r.passed).length} of ${ordinary.length})`, ordinary.every((r) => r.passed)));
    const design = projectRows.find((r) => r.project.id === def.designProject);
    if (design) {
      criteria.push(criterion(`"${design.project.title}" built in Challenge or Independent mode`, design.withoutGuide));
      const logLength = (design.log.decisions ?? "").trim().length;
      criteria.push(criterion(`Design decisions written in its project log (${logLength >= DESIGN_LOG_MIN ? "done" : `at least a couple of sentences - ${logLength} of ${DESIGN_LOG_MIN} characters so far`})`, logLength >= DESIGN_LOG_MIN));
    }
    levels.push({ n, name: LEVEL_NAMES[n], lessons: lessonRows, projects: projectRows, criteria, complete: criteria.every((c) => c.met) });
  }
  levels.forEach((l, i) => { l.open = i === 0 || levels[i - 1].complete; });

  // what needs work: checkpoints not yet right, projects failing checks
  const weak = [];
  for (const l of levels) {
    for (const r of l.lessons) if (r.tried && !r.checkpoint) weak.push({ text: `The "${r.lesson.title}" checkpoint isn't answered right yet`, lessonId: r.lesson.id });
    for (const r of l.projects) if (!r.passed && r.fails >= 3) weak.push({ text: `"${r.project.title}" has failed ${r.fails} checks`, projectId: r.project.id });
  }

  // the next thing to do: the first unfinished lesson or project, in order
  let next = null;
  for (const l of levels) {
    const lesson = l.lessons.find((r) => !r.done || !r.checkpoint);
    if (lesson) { next = { type: "lesson", id: lesson.lesson.id, title: lesson.lesson.title, level: l.n }; break; }
    const project = l.projects.find((r) => !r.passed || (r.project.id === pathway.levels[l.n].designProject && !l.complete));
    if (project) { next = { type: "project", id: project.project.id, title: project.project.title, level: l.n }; break; }
  }

  const complete = levels.every((l) => l.complete);
  return {
    pathway, available: true, started: !!entry, entry, levels, weak, next, complete,
    levelsComplete: levels.filter((l) => l.complete).length,
    certificateAt: entry?.certificateAt ?? null,
    missingCore: missingCore(pathway, progress),
  };
}

export const allPathwayStatuses = (progress) => PATHWAYS.map((p) => pathwayStatus(p, progress));
