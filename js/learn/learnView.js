// The Learn page: the whole course on one screen, so nobody has to hunt for
// their next lesson. At the top, one big "continue" button for the next
// lesson (and why it matters); below, every module with each lesson's status:
//   ✔ done · ▶ next · ○ ready · 🔒 locked (a prerequisite isn't done yet -
//   it can still be opened, after a warning).
// Like the other view modules, this only renders and reports back: opening a
// lesson goes through onOpenLesson.

import { lessons } from "../lessons/data.js";
import { MODULES } from "../lessons/curriculum.js";
import { getQuizForLesson } from "../quiz/data.js";
import { icon } from "../game/sprites.js";
import { lessonPosition, lessonStatus, nextLesson, missingNeeds, challengeEvidence, learningSummary } from "../progress/learning.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const STATUS = {
  done: { mark: "✔", label: "Done" },
  next: { mark: "▶", label: "Up next" },
  ready: { mark: "○", label: "Ready" },
  locked: { mark: "🔒", label: "Do the earlier lessons first" },
};

export function renderLearnView(container, progress, { onOpenLesson, onOpenMap, onStartFirstCircuit, onShowTour } = {}) {
  container.innerHTML = "";
  const next = nextLesson(progress);
  const summary = learningSummary(progress);

  // ---- heading ----
  const head = el("div", "learn-head hud-frame");
  head.appendChild(el("h1", null, "Your Arduino Course"));
  head.appendChild(el("p", "learn-sub",
    `${MODULES.length} modules, from "what is an Arduino?" to projects of your own. Work through them in order - each lesson builds on the ones before it, and every lesson tells you what you should know first.`));
  const stats = el("div", "learn-stats");
  stats.append(
    el("span", "learn-stat", `${summary.lessonsDone} / ${summary.lessonsTotal} lessons`),
    el("span", "learn-stat", `${summary.challengesPassed} / ${summary.challengesTotal} challenges passed`),
    el("span", "learn-stat", `${summary.checkpointsPassed} / ${summary.checkpointsTotal} checkpoints`),
  );
  head.appendChild(stats);
  const headActions = el("div", "learn-head-actions");
  if (!progress.firstCircuitDone) {
    const fc = el("button", "btn btn-hint", "Guided first circuit");
    fc.type = "button";
    fc.title = "A 10-minute guided build: wire an LED and make it blink";
    fc.addEventListener("click", () => onStartFirstCircuit?.());
    headActions.appendChild(fc);
  }
  const tourBtn = el("button", "btn btn-secondary", "How this course works");
  tourBtn.type = "button";
  tourBtn.title = "The one-minute welcome tour: Arduino, the simulator, and how the lessons are organised";
  tourBtn.addEventListener("click", () => onShowTour?.());
  headActions.appendChild(tourBtn);
  const mapBtn = el("button", "btn btn-secondary", "Map view");
  mapBtn.type = "button";
  mapBtn.title = "The same course, drawn as an arcade world map";
  mapBtn.addEventListener("click", () => onOpenMap?.());
  headActions.appendChild(mapBtn);
  head.appendChild(headActions);
  container.appendChild(head);

  // ---- up next ----
  if (next) {
    const pos = lessonPosition(next);
    const card = el("div", "learn-next hud-frame");
    card.appendChild(el("div", "lesson-list-heading", progress.lastLessonId === next.id ? "CONTINUE WHERE YOU LEFT OFF" : "UP NEXT"));
    card.appendChild(el("div", "learn-next-eyebrow", `Module ${pos.module} · Lesson ${pos.index} of ${pos.count}`));
    card.appendChild(el("h2", "learn-next-title", next.title));
    if (next.why) card.appendChild(el("p", "learn-next-why", next.why));
    const missing = missingNeeds(next, progress);
    if (missing.length) card.appendChild(el("p", "lesson-need-warn", `Builds on: ${missing.map((l) => l.title).join(", ")}.`));
    const go = el("button", "btn btn-complete learn-next-btn", progress.lastLessonId === next.id ? "Continue lesson" : "Start lesson");
    go.type = "button";
    go.addEventListener("click", () => onOpenLesson?.(next.id));
    card.appendChild(go);
    container.appendChild(card);
  } else {
    const card = el("div", "learn-next hud-frame");
    card.appendChild(el("h2", "learn-next-title", "You've finished every lesson!"));
    card.appendChild(el("p", "learn-next-why", "Revisit anything below, try the Projects, or plan a project of your own (Module 7)."));
    container.appendChild(card);
  }

  // ---- modules ----
  const list = el("div", "learn-modules");
  for (const module of MODULES) {
    const inModule = lessons.filter((l) => l.module === module.number);
    const doneCount = inModule.filter((l) => progress.viewedLessons.includes(l.id)).length;
    const details = document.createElement("details");
    details.className = "learn-module hud-frame";
    details.open = (next && next.module === module.number) || false;
    const summaryEl = document.createElement("summary");
    summaryEl.className = "learn-module-summary";
    const ico = el("span", "learn-module-icon");
    ico.innerHTML = icon(module.icon, 2);
    const text = el("span", "learn-module-text");
    text.append(el("span", "learn-module-eyebrow", `MODULE ${module.number}`), el("span", "learn-module-title", module.title));
    const count = el("span", `learn-module-count${doneCount === inModule.length ? " is-complete" : ""}`, doneCount === inModule.length ? "✔ Complete" : `${doneCount} / ${inModule.length}`);
    summaryEl.append(ico, text, count);
    details.appendChild(summaryEl);

    details.appendChild(el("p", "learn-module-summary-text", module.summary));
    const bar = el("div", "learn-module-bar");
    const fill = el("div", "learn-module-bar-fill");
    fill.style.width = `${inModule.length ? (doneCount / inModule.length) * 100 : 0}%`;
    bar.appendChild(fill);
    details.appendChild(bar);

    const ol = el("ol", "learn-lessons");
    for (const lesson of inModule) {
      const status = lessonStatus(lesson, progress, next);
      const li = el("li", `learn-lesson is-${status}`);
      const btn = el("button", "learn-lesson-btn");
      btn.type = "button";
      btn.title = `${STATUS[status].label}${lesson.why ? ` - ${lesson.why}` : ""}`;
      btn.appendChild(el("span", "learn-lesson-mark", STATUS[status].mark));
      btn.appendChild(el("span", "learn-lesson-num", lessonPosition(lesson).label));
      btn.appendChild(el("span", "learn-lesson-title", lesson.title));
      const tags = el("span", "learn-lesson-tags");
      const ev = challengeEvidence(lesson, progress);
      if (ev) tags.appendChild(el("span", `learn-tag${ev.passed ? " is-done" : ""}`, ev.passed ? (ev.independent ? "Challenge ✔ solo" : "Challenge ✔") : lesson.challenge.difficulty === "boss" ? "Boss" : "Challenge"));
      const quiz = getQuizForLesson(lesson.id);
      if (quiz) tags.appendChild(el("span", `learn-tag${progress.quizzes[quiz.id]?.solved ? " is-done" : ""}`, progress.quizzes[quiz.id]?.solved ? "Quiz ✔" : "Quiz"));
      btn.appendChild(tags);
      btn.setAttribute("aria-label", `${lessonPosition(lesson).label} ${lesson.title} - ${STATUS[status].label}`);
      btn.addEventListener("click", () => onOpenLesson?.(lesson.id));
      li.appendChild(btn);
      ol.appendChild(li);
    }
    details.appendChild(ol);
    list.appendChild(details);
  }
  container.appendChild(list);
}
