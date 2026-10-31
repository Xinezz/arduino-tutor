// The Pathways tab: the overview of every engineering pathway (with search
// and filters), a pathway's own page (what it teaches and builds, its
// prerequisites, its three levels as a track with each level's completion
// criteria), a pathway lesson, and the certificate.
//
// Lessons reuse the course's lesson blocks (lessons/render.js), checkpoints
// reuse the quiz renderer, and projects open on the existing project page -
// this module only lays them out. It renders and reports back through
// callbacks, like every view module.

import { renderBlock, lessonSections, sectionHeading } from "../lessons/render.js";
import { renderQuiz } from "../quiz/quiz.js";
import { confirmDialog } from "../game/modal.js";
import { icon } from "../game/sprites.js";
import { lessons } from "../lessons/data.js";
import { lessonPosition } from "../progress/learning.js";
import {
  PATHWAYS, PATHWAY_LESSONS, PATHWAY_PROJECTS, LEVEL_NAMES, LEVEL_ABOUT, RUNS,
  pathwayById, pathwayLessonById, pathwayProjectById, pathwayLessonLabel, pathwayLessons,
} from "./data.js";
import { pathwayStatus, lessonGaps } from "./progress.js";
import "./visuals.js"; // registers the pathway demos

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(text, kind, onClick, title) {
  const b = el("button", `btn ${kind}`, text);
  b.type = "button";
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}
const runsBadge = (runs) => {
  const b = el("span", `runs-badge is-${runs}`, RUNS[runs].label);
  b.title = RUNS[runs].about;
  return b;
};
const levelBadge = (n) => el("span", `level-badge is-l${n}`, `L${n} ${LEVEL_NAMES[n]}`);
const coreLabel = (l) => `${lessonPosition(l).label} ${l.title}`;

// ================================================================ overview
export function renderPathways(container, progress, state, cb) {
  container.innerHTML = "";
  if (state.view === "pathway") return renderPathwayPage(container, progress, state.pathwayId, cb);
  if (state.view === "lesson") return renderPathwayLesson(container, progress, state.lessonId, cb);
  if (state.view === "certificate") return renderCertificate(container, progress, state.pathwayId, cb);

  const head = el("section", "learn-head hud-frame pathways-head");
  head.appendChild(el("h1", null, "Engineering Pathways"));
  head.appendChild(el("p", "learn-sub", "Beyond the core course: choose a direction and work up through three levels - from the ideas, to checked practical projects, to designing a solution of your own."));
  const levels = el("div", "pathway-levels-legend");
  for (const n of [1, 2, 3]) {
    const d = el("div", "pathway-legend-item");
    d.append(levelBadge(n), el("span", null, LEVEL_ABOUT[n]));
    levels.appendChild(d);
  }
  head.appendChild(levels);
  const runsBox = el("details", "pathway-plan");
  runsBox.appendChild(el("summary", null, "What the Simulated / Calculated model / Real hardware labels mean"));
  const runs = el("div", "pathway-runs-legend");
  for (const key of Object.keys(RUNS)) {
    const d = el("div", "pathway-legend-item");
    d.append(runsBadge(key), el("span", null, RUNS[key].about));
    runs.appendChild(d);
  }
  runsBox.appendChild(runs);
  head.appendChild(runsBox);
  container.appendChild(head);

  // ---- search and filters ----
  const bar = el("div", "pathway-search");
  const input = el("input", "pathway-search-input");
  input.type = "search";
  input.placeholder = "Search lessons and projects (e.g. divider, transistor, alarm)";
  input.setAttribute("aria-label", "Search pathway lessons and projects");
  input.value = state.query ?? "";
  const levelSel = el("select", "goal-select");
  levelSel.setAttribute("aria-label", "Filter by level");
  for (const [v, t] of [["", "All levels"], ["1", "Level 1 Foundation"], ["2", "Level 2 Application"], ["3", "Level 3 Engineering design"]]) levelSel.appendChild(Object.assign(el("option", null, t), { value: v }));
  levelSel.value = state.level ?? "";
  const runsSel = el("select", "goal-select");
  runsSel.setAttribute("aria-label", "Filter by how it runs");
  for (const [v, t] of [["", "Any way it runs"], ...Object.entries(RUNS).map(([k, r]) => [k, r.label])]) runsSel.appendChild(Object.assign(el("option", null, t), { value: v }));
  runsSel.value = state.runs ?? "";
  bar.append(input, levelSel, runsSel);
  container.appendChild(bar);
  const results = el("div", "pathway-results");
  container.appendChild(results);
  const cards = el("div", "pathway-cards");
  container.appendChild(cards);

  const refresh = () => {
    state.query = input.value;
    state.level = levelSel.value;
    state.runs = runsSel.value;
    const filtering = !!(state.query.trim() || state.level || state.runs);
    results.innerHTML = "";
    results.hidden = !filtering;
    cards.hidden = filtering;
    if (filtering) renderResults(results, progress, state, cb);
  };
  input.addEventListener("input", refresh);
  levelSel.addEventListener("change", refresh);
  runsSel.addEventListener("change", refresh);

  for (const p of PATHWAYS) cards.appendChild(pathwayCard(p, progress, cb));
  refresh();
}

function pathwayCard(p, progress, cb) {
  const card = el("div", `pathway-card hud-frame${p.status === "available" ? "" : " is-planned"}`);
  const top = el("div", "pathway-card-top");
  const ico = el("span", "pathway-card-icon");
  ico.innerHTML = icon(p.icon, 3);
  top.append(ico, el("div", "pathway-card-letter", `PATHWAY ${p.letter}`));
  card.appendChild(top);
  card.appendChild(el("h2", "pathway-card-title", p.title));
  card.appendChild(el("p", "pathway-card-summary", p.summary));
  if (p.status !== "available") {
    card.appendChild(el("div", "pathway-status is-planned", "NOT BUILT YET"));
    const d = el("details", "pathway-plan");
    d.appendChild(el("summary", null, "What it will cover"));
    const ul = el("ul");
    for (const t of p.teaches) ul.appendChild(el("li", null, t));
    d.appendChild(ul);
    d.appendChild(el("p", "learning-legend", `Planned projects: ${p.builds.join("; ")}.`));
    d.appendChild(el("p", "learning-legend", p.hardware));
    card.appendChild(d);
    return card;
  }
  const s = pathwayStatus(p, progress);
  card.appendChild(el("div", "pathway-status", s.certificateAt ? "✔ CERTIFICATE EARNED" : s.started ? `${s.levelsComplete} OF 3 LEVELS COMPLETE` : "AVAILABLE"));
  const track = el("div", "pathway-mini-track");
  for (const l of s.levels) track.appendChild(el("span", `pathway-mini-step${l.complete ? " is-done" : ""}`, `L${l.n}`));
  card.appendChild(track);
  card.appendChild(el("p", "learning-legend", `You'll build: ${p.builds.join("; ")}.`));
  if (s.missingCore.length) card.appendChild(el("p", "pathway-prereq-note", `Before you start: ${s.missingCore.map(coreLabel).join(", ")}.`));
  card.appendChild(button(s.started ? "Continue" : "Explore this pathway", "btn-primary", () => cb.onOpenPathway(p.id)));
  return card;
}

function renderResults(container, progress, state, cb) {
  const q = state.query.trim().toLowerCase();
  const match = (text) => !q || text.toLowerCase().includes(q);
  const rows = [];
  for (const l of PATHWAY_LESSONS) {
    const text = [l.title, l.why, ...(l.objectives ?? []), ...(l.summary ?? [])].join(" ");
    if (match(text) && (!state.level || String(l.level) === state.level) && (!state.runs || l.runs === state.runs)) rows.push({ kind: "lesson", item: l });
  }
  for (const p of PATHWAY_PROJECTS) {
    const text = [p.title, p.summary, p.problem, ...(p.objectives ?? [])].join(" ");
    if (match(text) && (!state.level || String(p.pathwayLevel) === state.level) && (!state.runs || state.runs === "simulated")) rows.push({ kind: "project", item: p });
  }
  container.appendChild(el("div", "lesson-list-heading", `${rows.length} RESULT${rows.length === 1 ? "" : "S"} (BUILT PATHWAYS ONLY)`));
  if (!rows.length) container.appendChild(el("p", "learning-empty", "Nothing matches. Try a broader word - like \"resistor\", \"voltage\" or \"design\" - or clear the filters."));
  for (const r of rows) container.appendChild(itemRow(r.kind, r.item, progress, cb, true));
}

// One lesson or project row, with its badges and status.
function itemRow(kind, item, progress, cb, showPathway = false) {
  const row = el("div", "pathway-item");
  const text = el("div", "pathway-item-text");
  const title = el("div", "pathway-item-title");
  if (kind === "lesson") {
    const done = (progress.pathways?.[item.pathway]?.lessonsDone ?? []).includes(item.id);
    const right = !!progress.quizzes?.[item.quiz.id]?.solved;
    title.textContent = `${pathwayLessonLabel(item)} ${item.title}`;
    text.append(title, el("div", "pathway-item-meta", `${done ? "✔ Done" : "○ Not done"} · ${right ? "✔ Checkpoint right" : "○ Checkpoint"}`));
  } else {
    const modes = Object.keys(progress.projects?.[item.id]?.completed ?? {});
    title.textContent = `Project: ${item.title}`;
    text.append(title, el("div", "pathway-item-meta", modes.length ? `✔ Passed (${modes.join(", ")} mode)` : "○ Not built yet"));
  }
  if (showPathway) text.appendChild(el("div", "pathway-item-meta", pathwayById(item.pathway).title));
  const badges = el("div", "pathway-item-badges");
  badges.append(levelBadge(kind === "lesson" ? item.level : item.pathwayLevel), runsBadge(kind === "lesson" ? item.runs : "simulated"));
  const open = button(kind === "lesson" ? "Open" : "Open project", "btn-secondary btn-small",
    () => (kind === "lesson" ? cb.onOpenLesson(item.id) : cb.onOpenProject(item.id)));
  row.append(text, badges, open);
  return row;
}

// ================================================================ a pathway
function renderPathwayPage(container, progress, pathwayId, cb) {
  const p = pathwayById(pathwayId);
  const s = pathwayStatus(p, progress);
  const back = button("← All pathways", "btn-secondary btn-small", () => cb.onOverview());
  container.appendChild(back);
  const head = el("section", "learn-head hud-frame pathways-head");
  head.appendChild(el("div", "lesson-list-heading", `PATHWAY ${p.letter}`));
  head.appendChild(el("h1", null, p.title));
  head.appendChild(el("p", "learn-sub", p.summary));
  const cols = el("div", "pathway-what");
  const learnBox = el("div");
  learnBox.appendChild(el("div", "lesson-list-heading", "WHAT YOU'LL LEARN"));
  const ul1 = el("ul");
  for (const t of p.teaches) ul1.appendChild(el("li", null, t));
  learnBox.appendChild(ul1);
  const buildBox = el("div");
  buildBox.appendChild(el("div", "lesson-list-heading", "WHAT YOU'LL BE ABLE TO BUILD"));
  const ul2 = el("ul");
  for (const t of p.builds) ul2.appendChild(el("li", null, t));
  buildBox.appendChild(ul2);
  cols.append(learnBox, buildBox);
  head.appendChild(cols);
  head.appendChild(el("p", "learning-legend", p.hardware));
  container.appendChild(head);

  // ---- prerequisites ----
  const pre = el("section", "pathway-section");
  pre.appendChild(el("h2", "dashboard-section-title", "Before you start"));
  const preList = el("div", "pathway-prereqs");
  for (const id of p.needs) {
    const l = lessons.find((x) => x.id === id);
    const done = progress.viewedLessons.includes(id);
    const row = el("div", `pathway-prereq${done ? " is-done" : ""}`);
    row.append(el("span", null, `${done ? "✔" : "○"} ${coreLabel(l)}`));
    if (!done) row.appendChild(button("Open", "btn-hint btn-small", () => cb.onOpenCoreLesson(id)));
    preList.appendChild(row);
  }
  pre.appendChild(preList);
  pre.appendChild(el("p", "learning-legend", s.missingCore.length
    ? "You can look around now, but the pathway builds directly on these lessons - finish them first and it will make far more sense."
    : "✔ You've done the lessons this pathway builds on."));
  container.appendChild(pre);

  // ---- needs work ----
  if (s.weak.length) {
    const w = el("section", "pathway-section");
    w.appendChild(el("h2", "dashboard-section-title", "Needs more work"));
    const ul = el("ul", "skill-area-weak");
    for (const x of s.weak) {
      const li = el("li", null, x.text);
      if (x.lessonId) li.appendChild(button("Open", "btn-hint btn-small", () => cb.onOpenLesson(x.lessonId)));
      if (x.projectId) li.appendChild(button("Open", "btn-hint btn-small", () => cb.onOpenProject(x.projectId)));
      ul.appendChild(li);
    }
    w.appendChild(ul);
    container.appendChild(w);
  }

  // ---- the three levels ----
  const track = el("section", "pathway-section");
  track.appendChild(el("h2", "dashboard-section-title", "Your progress through the levels"));
  const steps = el("ol", "pathway-track");
  for (const l of s.levels) {
    const li = el("li", `pathway-level${l.complete ? " is-complete" : l.open ? " is-open" : " is-locked"}`);
    const hd = el("div", "pathway-level-head");
    hd.append(levelBadge(l.n), el("span", "pathway-level-state", l.complete ? "✔ COMPLETE" : l.open ? "IN PROGRESS" : `FINISH LEVEL ${l.n - 1} FIRST`));
    li.appendChild(hd);
    li.appendChild(el("p", "learning-legend", LEVEL_ABOUT[l.n]));
    for (const r of l.lessons) li.appendChild(itemRow("lesson", r.lesson, progress, cb));
    for (const r of l.projects) li.appendChild(itemRow("project", r.project, progress, cb));
    if (l.n === 2) li.appendChild(el("p", "learning-legend", "Also in this level: the transistor-controlled LED, a real-hardware design worksheet in A8 (not checked, not counted)."));
    const crit = el("ul", "criteria-list");
    for (const c of l.criteria) crit.appendChild(el("li", c.met ? "is-met" : "", `${c.met ? "✔" : "○"} ${c.text}`));
    li.appendChild(el("div", "lesson-list-heading", "TO COMPLETE THIS LEVEL"));
    li.appendChild(crit);
    steps.appendChild(li);
  }
  track.appendChild(steps);
  container.appendChild(track);

  // ---- certificate ----
  const cert = el("section", "pathway-section revision-round hud-frame");
  cert.appendChild(el("div", "lesson-list-heading", "CERTIFICATE OF COMPLETION"));
  if (s.certificateAt) {
    cert.appendChild(el("p", null, `Earned ${new Date(s.certificateAt).toLocaleDateString()}.`));
    cert.appendChild(button("View certificate", "btn-primary", () => cb.onViewCertificate(p.id)));
  } else if (s.complete) {
    cert.appendChild(el("p", null, "Every level is complete - your certificate is ready."));
    cert.appendChild(button("Claim certificate", "btn-complete", () => cb.onClaimCertificate(p.id)));
  } else {
    cert.appendChild(el("p", null, `Complete all three levels - lessons, checkpoints answered right, every project passing its checks, and your own design - and you'll earn a certificate of completion. ${s.levelsComplete} of 3 levels done.`));
  }
  cert.appendChild(el("p", "learning-legend", "A record of what you've learned and built on this website - not an accredited or professional qualification."));
  container.appendChild(cert);
}

// ================================================================ a lesson
// Opening a lesson whose prerequisites aren't done is allowed - after saying
// exactly what's missing and what that will make harder.
export async function confirmPathwayLesson(lesson, progress) {
  const gaps = lessonGaps(lesson, progress);
  const s = pathwayStatus(lesson.pathway, progress);
  const levelLocked = lesson.level > 1 && !s.levels[lesson.level - 2].complete;
  if (!gaps.core.length && !gaps.pathway.length && !levelLocked) return true;
  const parts = [];
  if (gaps.core.length) parts.push(`the course lesson${gaps.core.length > 1 ? "s" : ""} ${gaps.core.map((l) => `"${l.title}"`).join(" and ")}`);
  if (gaps.pathway.length) parts.push(`${gaps.pathway.map((l) => `"${l.title}"`).join(" and ")} in this pathway`);
  const body = (parts.length ? `"${lesson.title}" builds on ${parts.join(", and ")}, which you haven't finished. ` : "")
    + (levelLocked ? `It's in Level ${lesson.level}, and Level ${lesson.level - 1} isn't complete yet - its ideas are used here without being explained again. ` : "")
    + "You can open it anyway - it may just be much harder to follow without them.";
  return confirmDialog({ title: "BEFORE YOU START", body, confirmLabel: "Open Anyway", cancelLabel: "Not Yet" });
}

function renderPathwayLesson(container, progress, lessonId, cb) {
  const lesson = pathwayLessonById(lessonId);
  const p = pathwayById(lesson.pathway);
  const list = pathwayLessons(p.id);
  const index = list.indexOf(lesson);
  const done = (progress.pathways?.[p.id]?.lessonsDone ?? []).includes(lesson.id);
  const article = el("article", "lesson-content pathway-lesson");
  const top = el("div", "pathway-lesson-top");
  top.append(button(`← ${p.title}`, "btn-secondary btn-small", () => cb.onOpenPathway(p.id)), levelBadge(lesson.level), runsBadge(lesson.runs));
  article.appendChild(top);
  article.appendChild(el("div", "lesson-list-heading", `PATHWAY ${p.letter} · LESSON ${index + 1} OF ${list.length}`));
  article.appendChild(el("h1", null, `${pathwayLessonLabel(lesson)} ${lesson.title}`));
  const intro = el("div", "lesson-intro");
  intro.appendChild(el("p", "lesson-why", lesson.why));
  const gaps = lessonGaps(lesson, progress);
  if (gaps.core.length || gaps.pathway.length) {
    intro.appendChild(el("p", "pathway-prereq-note", `Builds on: ${[...gaps.core.map(coreLabel), ...gaps.pathway.map((l) => `${pathwayLessonLabel(l)} ${l.title}`)].join(", ")} - not done yet.`));
  }
  const obj = el("div", "lesson-objectives");
  obj.appendChild(el("div", "lesson-list-heading", "IN THIS LESSON YOU'LL LEARN TO"));
  const ul = el("ul");
  for (const o of lesson.objectives) ul.appendChild(el("li", null, o));
  obj.appendChild(ul);
  intro.appendChild(obj);
  article.appendChild(intro);

  const sections = lessonSections(lesson);
  const terms = { seen: new Set(), lessonId: lesson.id };
  sections.forEach((section, i) => {
    article.appendChild(sectionHeading(i + 1, section.kind));
    for (const block of section.blocks) article.appendChild(renderBlock(block, terms));
  });
  article.appendChild(sectionHeading(sections.length + 1, "checkpoint"));
  const quizBox = el("div", "quiz-section");
  article.appendChild(quizBox);
  renderQuiz(quizBox, lesson.quiz, (quizId, success, topic, detail) => cb.onQuizResult(quizId, success, topic, detail, quizBox, lesson));

  article.appendChild(sectionHeading(sections.length + 2, "summary"));
  const summary = el("div", "lesson-summary");
  summary.appendChild(el("div", "lesson-list-heading", "KEY POINTS"));
  const sl = el("ul");
  for (const t of lesson.summary) sl.appendChild(el("li", null, t));
  summary.appendChild(sl);
  article.appendChild(summary);

  const nav = el("div", "lesson-nav");
  const prev = button("← Previous", "btn-secondary", () => cb.onOpenLesson(list[index - 1].id));
  prev.disabled = index === 0;
  const right = el("div", "lesson-nav-right");
  const mark = button(done ? "✔ Completed" : "Mark Lesson as Done", done ? "btn-secondary" : "btn-complete", () => cb.onMarkDone(lesson));
  mark.disabled = done;
  const next = button("Next →", "btn-primary", () => cb.onOpenLesson(list[index + 1].id));
  next.disabled = index === list.length - 1;
  right.append(mark, next);
  nav.append(prev, right);
  article.appendChild(nav);
  article.appendChild(el("p", "learning-legend", "For the level to count, the lesson must be marked done AND its checkpoint answered right."));
  container.appendChild(article);
}

// ================================================================ certificate
function renderCertificate(container, progress, pathwayId, cb) {
  const p = pathwayById(pathwayId);
  const s = pathwayStatus(p, progress);
  container.appendChild(button(`← ${p.title}`, "btn-secondary btn-small", () => cb.onOpenPathway(p.id)));
  if (!s.certificateAt) {
    container.appendChild(el("p", "learning-empty", "This certificate hasn't been earned yet."));
    return;
  }
  const cert = el("section", "certificate hud-frame");
  cert.appendChild(el("div", "certificate-eyebrow", "ARDUINO TUTOR · CERTIFICATE OF COMPLETION"));
  cert.appendChild(el("h1", "certificate-title", `Pathway ${p.letter}: ${p.title}`));
  cert.appendChild(el("p", "certificate-name", progress.playerName ? `Awarded to ${progress.playerName}` : "Awarded to this learner"));
  cert.appendChild(el("p", null, `Completed on ${new Date(s.certificateAt).toLocaleDateString()}, for:`));
  const ul = el("ul", "certificate-evidence");
  for (const l of s.levels) {
    ul.appendChild(el("li", null, `Level ${l.n} ${l.name}: ${l.lessons.length} lesson${l.lessons.length === 1 ? "" : "s"} done with every checkpoint answered right${l.projects.length ? `; ${l.projects.map((r) => `${r.project.title} (${r.modes.join(", ")} mode)`).join("; ")}` : ""}.`));
  }
  cert.appendChild(ul);
  cert.appendChild(el("p", "certificate-note", "This is a record of learning completed on the Arduino Tutor website, checked by the site's own exercises. It is not an accredited or professional qualification."));
  cert.appendChild(button("Print", "btn-secondary btn-small certificate-print", () => window.print()));
  container.appendChild(cert);
}

export { pathwayProjectById };
