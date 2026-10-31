// The learning half of the Progress page - the learner's dashboard. It
// answers three questions first, in plain words:
//   What have I learned?  What am I finding tricky?  What should I do next?
// then shows the detail behind them: the ten skill areas (each level with
// the exact criteria it needs, met or not), revision, the next challenge at
// the right level, learning goals, and recent history. Rewards (XP,
// trophies, missions) follow below it, rendered by dashboard.js.
//
// Everything shown is computed from saved progress (skills.js, recommend.js,
// revision.js, goals.js, insights.js) - nothing is estimated or made up.
// Only renders and reports back through callbacks, like every view module.

import { lessons } from "../lessons/data.js";
import { MODULES } from "../lessons/curriculum.js";
import { renderQuiz } from "../quiz/quiz.js";
import { openModal } from "../game/modal.js";
import { icon } from "../game/sprites.js";
import { ACHIEVEMENT_MAP } from "../game/achievements.js";
import { lessonPosition, learningSummary } from "./learning.js";
import { masteryReport, LEVELS, levelIndex } from "./skills.js";
import { recommendations } from "./recommend.js";
import { buildSession, revisionSummary } from "./revision.js";
import { revisionQuiz } from "./questionBank.js";
import { nextChallenge, CHALLENGE_LEVELS } from "./challenges.js";
import { goalStatus, availableGoals, MAX_ACTIVE_GOALS } from "./goals.js";
import { overview } from "./insights.js";
import { pathwayLessonById, pathwayLessonLabel } from "../pathways/data.js";

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
const lessonLabel = (id) => {
  const l = lessons.find((x) => x.id === id);
  if (l) return `${lessonPosition(l).label} ${l.title}`;
  const p = pathwayLessonById(id);
  return p ? `${pathwayLessonLabel(p)} ${p.title}` : "";
};
function ago(iso, now = new Date()) {
  const mins = Math.round((now - new Date(iso)) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// The four-step pixel meter for a level: Learning, Developing, Proficient, Mastered.
function levelMeter(level) {
  const n = levelIndex(level);
  const meter = el("span", `level-meter is-${level}`);
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", `${LEVELS[n].label} (${n} of 4)`);
  for (let i = 1; i <= 4; i++) meter.appendChild(el("span", i <= n ? "level-seg is-on" : "level-seg"));
  return meter;
}
const levelPill = (level) => el("span", `level-pill is-${level}`, LEVELS[levelIndex(level)].label);

// ---- what a suggestion does when you press its button ----
function actionButton(action, cb, label) {
  const kind = "btn-primary";
  if (action.type === "revise") return button(label ?? "Start revision", kind, () => cb.onRevise?.(action.area ?? null));
  if (action.type === "lesson") return button(label ?? "Open lesson", kind, () => cb.onOpenLesson?.(action.id));
  if (action.type === "challenge") return button(label ?? "Go to the challenge", kind, () => cb.onOpenChallenge?.(action.id));
  if (action.type === "project") return button(label ?? "Open the project", kind, () => cb.onOpenProject?.(action.id, action.mode));
  if (action.type === "pathway") return button(label ?? "Open the pathway", kind, () => cb.onOpenPathway?.(action.id, action.lessonId ?? null));
  return el("span");
}

function recCard(rec, cb, compact = false) {
  const card = el("div", "rec-card");
  card.appendChild(el("div", "rec-title", rec.title));
  card.appendChild(el("p", "rec-why", rec.why));
  if (!compact) card.appendChild(actionButton(rec.action, cb));
  else card.appendChild(actionButton(rec.action, cb, "Go"));
  return card;
}

export function renderLearningProgress(container, progress, cb = {}) {
  container.innerHTML = "";
  const now = new Date();
  const report = masteryReport(progress, now);
  const recs = recommendations(progress, { now, report });
  const view = overview(report);
  const section = el("section", "learning-progress");
  section.appendChild(el("h1", null, "Your Learning"));
  section.appendChild(el("p", "learn-sub", "What you've learned, what's worth more practice, and what to do next - worked out from your own answers, checks and builds. (Coins and trophies are further down.)"));

  // ---- a brand-new learner: how this page fills in ----
  if (!view.started) {
    const welcome = el("div", "learn-next hud-frame dash-welcome");
    welcome.appendChild(el("div", "lesson-list-heading", "YOUR LEARNING PROFILE STARTS HERE"));
    welcome.appendChild(el("p", null, "As you work through lessons, answer questions and build circuits, this page shows what you've learned, what needs more practice, and what to try next - each with the reason why."));
    welcome.appendChild(el("p", "learning-legend", "No experience needed: the first lesson starts from \"what is an Arduino?\"."));
    const row = el("div", "dash-actions");
    const first = recs.find((r) => r.action.type === "lesson");
    if (first) row.appendChild(button("Start the first lesson", "btn-complete", () => cb.onOpenLesson?.(first.action.id)));
    row.appendChild(button("Ask Sam a question", "btn-secondary", () => cb.onAskTutor?.()));
    welcome.appendChild(row);
    section.appendChild(welcome);
  }

  // ---- overall ----
  const s = learningSummary(progress);
  const proficient = report.filter((a) => a.levelIndex >= levelIndex("proficient")).length;
  const overall = el("div", "dash-overall");
  const bar = el("div", "dash-overall-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(s.lessonsTotal));
  bar.setAttribute("aria-valuenow", String(s.lessonsDone));
  bar.setAttribute("aria-label", "Lessons done");
  const fill = el("span", "dash-overall-fill");
  fill.style.width = `${(s.lessonsDone / s.lessonsTotal) * 100}%`;
  bar.appendChild(fill);
  overall.append(
    el("div", "dash-overall-text", `Course: ${s.lessonsDone} of ${s.lessonsTotal} lessons done · ${proficient} of ${report.length} skill areas at Proficient or above`),
    bar,
  );
  section.appendChild(overall);

  // ---- the three questions ----
  if (view.started) {
    const three = el("div", "dash-three");
    const learned = el("div", "dash-q hud-frame is-learned");
    learned.appendChild(el("h2", "dash-q-title", "What have I learned?"));
    if (view.learned.length) {
      const ul = el("ul", "dash-q-list");
      for (const x of view.learned.slice(0, 4)) {
        const li = el("li");
        li.append(el("strong", null, x.area.name), el("span", null, ` - ${x.text}`));
        ul.appendChild(li);
      }
      learned.appendChild(ul);
      if (view.learned.length > 4) learned.appendChild(el("p", "learning-legend", `…and ${view.learned.length - 4} more below.`));
    } else {
      learned.appendChild(el("p", "learning-empty", "Nothing at Developing yet. An area gets there once you've done half its lessons and shown it works for you - a right answer or a passed challenge."));
    }
    three.appendChild(learned);

    const tricky = el("div", "dash-q hud-frame is-tricky");
    tricky.appendChild(el("h2", "dash-q-title", "What am I finding tricky?"));
    if (view.struggling.length) {
      const ul = el("ul", "dash-q-list");
      for (const x of view.struggling.slice(0, 3)) {
        const li = el("li");
        li.append(el("strong", null, x.area.name), el("span", null, ` - ${x.text}`));
        if (x.lessonId) {
          const review = button(`Review ${lessonPosition(lessons.find((l) => l.id === x.lessonId)).label}`, "btn-hint btn-small", () => cb.onOpenLesson?.(x.lessonId), lessonLabel(x.lessonId));
          li.appendChild(review);
        }
        ul.appendChild(li);
      }
      tricky.appendChild(ul);
    } else {
      tricky.appendChild(el("p", "learning-empty", "Nothing right now. Questions you miss, challenges that keep failing their check, and mistakes that keep coming back show up here."));
    }
    three.appendChild(tricky);

    const next = el("div", "dash-q hud-frame is-next");
    next.appendChild(el("h2", "dash-q-title", "What should I do next?"));
    for (const rec of recs.slice(0, 3)) next.appendChild(recCard(rec, cb, true));
    if (!recs.length) next.appendChild(el("p", "learning-empty", "You've done everything on offer - try a project of your own in Free Practice."));
    three.appendChild(next);
    section.appendChild(three);
  }

  // ---- skill areas ----
  section.appendChild(el("h2", "dashboard-section-title", "Skill areas"));
  const how = el("details", "dash-how");
  how.appendChild(el("summary", null, "How are levels worked out?"));
  const howList = el("ul");
  for (const l of LEVELS) {
    const li = el("li");
    li.append(levelPill(l.id), el("span", null, ` ${l.meaning}`));
    howList.appendChild(li);
  }
  how.appendChild(howList);
  how.appendChild(el("p", "learning-legend", "Opening a lesson never raises a level on its own: each level needs answers you got right, practical work that passed its check, and - for Mastered - work done without hints. Open an area to see exactly what its next level needs."));
  section.appendChild(how);

  const areas = el("div", "skill-areas");
  for (const a of report) areas.appendChild(areaRow(a, cb));
  section.appendChild(areas);

  // ---- revision ----
  section.appendChild(el("h2", "dashboard-section-title", "Revision"));
  const rs = revisionSummary(progress, now);
  const rev = el("div", "revision-round hud-frame");
  if (!rs.pending) {
    rev.appendChild(el("p", null, rs.missedAtFirst
      ? `Every question you've missed has been put right after a gap (${rs.corrected} of ${rs.missedAtFirst}). Nothing to revise right now.`
      : "Nothing to revise yet. When you miss a question, it comes back here a day later - with a recap of the idea and a new question to check you've got it."));
  } else {
    rev.appendChild(el("p", null,
      `${rs.pending} question${rs.pending === 1 ? "" : "s"} you missed ${rs.pending === 1 ? "is" : "are"} on your review schedule${rs.due ? ` - ${rs.due} due now` : " - none due today"}.` +
      (rs.corrected ? ` ${rs.corrected} of ${rs.missedAtFirst} missed questions put right after a gap${rs.secure ? `, ${rs.secure} now secure` : ""}.` : "")));
    rev.appendChild(el("p", "learning-legend", "A missed question comes back after 1 day, then 3, then 7. Right each time, and it counts as secure. A session takes a few minutes: for each idea, a short recap, the question again, then a different question on the same idea."));
    if (rs.actionable) {
      const row = el("div", "dash-actions");
      row.appendChild(button(rs.due ? "Start revision session" : "Revise now anyway", "btn-primary", () => cb.onRevise?.(null)));
      for (const x of rs.byArea.slice(0, 3)) row.appendChild(button(`${x.area.name} (${x.pending})`, "btn-secondary", () => cb.onRevise?.(x.area.id)));
      rev.appendChild(row);
    }
  }
  if (rs.lastSession) rev.appendChild(el("p", "learning-legend", `Last session ${ago(rs.lastSession.at, now)}: ${rs.lastSession.right} of ${rs.lastSession.total} right first time.`));
  section.appendChild(rev);

  // ---- next challenges ----
  section.appendChild(el("h2", "dashboard-section-title", "Your next challenges"));
  section.appendChild(el("p", "learning-legend", "Levels: 1 Foundation · 2 Developing · 3 Independent · 4 Engineering. Each area offers the level you've shown you're ready for - and a step back down if something keeps failing."));
  const active = report.filter((a) => a.level !== "not-started").sort((x, y) => y.weak.length - x.weak.length || y.levelIndex - x.levelIndex);
  const picks = active.map((a) => nextChallenge(a, progress)).filter(Boolean).slice(0, 3);
  if (!picks.length) {
    section.appendChild(el("p", "learning-empty", active.length
      ? "Your next challenge opens when you've finished the lesson you're on - each one builds on the lessons before it."
      : "Start a lesson and your first challenges appear here, matched to what you've done."));
  } else {
    const grid = el("div", "dash-challenges");
    for (const c of picks) {
      const card = el("div", "rec-card challenge-card");
      card.appendChild(el("div", "challenge-level", `LEVEL ${c.level} · ${CHALLENGE_LEVELS[c.level].name.toUpperCase()}`));
      card.appendChild(el("div", "rec-title", c.activity.title));
      card.appendChild(el("p", "rec-why", c.why));
      const act = c.activity;
      card.appendChild(actionButton(act.kind === "project" ? { type: "project", id: act.projectId, mode: act.mode }
        : act.kind === "challenge" ? { type: "challenge", id: act.lessonId } : { type: "lesson", id: act.lessonId }, cb,
      act.kind === "quiz" ? "Open the checkpoint" : undefined));
      grid.appendChild(card);
    }
    section.appendChild(grid);
  }

  // ---- goals ----
  section.appendChild(el("h2", "dashboard-section-title", "Learning goals"));
  section.appendChild(goalsPanel(progress, report, cb));

  // ---- history ----
  section.appendChild(el("h2", "dashboard-section-title", "Recent learning"));
  section.appendChild(historyPanel(progress, now));

  // ---- totals and modules ----
  const tiles = el("div", "learning-tiles");
  const tile = (value, label) => {
    const t = el("div", "learning-tile");
    t.append(el("div", "learning-tile-value", value), el("div", "learning-tile-label", label));
    return t;
  };
  tiles.append(
    tile(`${s.challengesPassed}/${s.challengesTotal}`, "challenges passed their check"),
    tile(`${s.challengesIndependent}`, "of those with no hints"),
    tile(`${s.checkpointsPassed}/${s.checkpointsTotal}`, "checkpoints answered correctly"),
    tile(s.predictionsMade ? `${s.predictionsRight}/${s.predictionsMade}` : "-", "predictions right first time"),
  );
  section.appendChild(el("h2", "dashboard-section-title", "Totals and modules"));
  section.appendChild(tiles);
  const mods = el("div", "learning-modules");
  for (const m of MODULES) {
    const inModule = lessons.filter((l) => l.module === m.number);
    const done = inModule.filter((l) => progress.viewedLessons.includes(l.id)).length;
    const row = el("div", `learning-module${done === inModule.length ? " is-complete" : ""}`);
    row.appendChild(el("span", "learning-module-name", `${m.number} · ${m.title}`));
    const mbar = el("span", "learn-module-bar");
    const mfill = el("span", "learn-module-bar-fill");
    mfill.style.width = `${(done / inModule.length) * 100}%`;
    mbar.appendChild(mfill);
    row.append(mbar, el("span", "learning-module-count", done === inModule.length ? "✔ Complete" : `${done}/${inModule.length}`));
    mods.appendChild(row);
  }
  section.appendChild(mods);
  container.appendChild(section);
}

// One skill area: a summary row that opens into its evidence and criteria.
function areaRow(a, cb) {
  const d = el("details", `skill-area is-${a.level}${a.weak.some((w) => w.severity >= 2) ? " needs-revision" : ""}`);
  const sum = el("summary", "skill-area-head");
  const ico = el("span", "skill-area-icon");
  ico.innerHTML = icon(a.icon, 2);
  const name = el("span", "skill-area-name", a.name);
  const right = el("span", "skill-area-level");
  right.append(levelMeter(a.level), levelPill(a.level));
  sum.append(ico, name, right);
  if (a.weak.some((w) => w.severity >= 2)) sum.appendChild(el("span", "skill-area-flag", "needs practice"));
  d.appendChild(sum);

  const body = el("div", "skill-area-body");
  body.appendChild(el("p", "skill-area-about", a.about));
  const e = a.evidence;
  const facts = el("ul", "skill-area-facts");
  const fact = (t) => facts.appendChild(el("li", null, t));
  fact(`Lessons: ${e.lessonsDone} of ${e.lessonsTotal} done`);
  fact(e.questionsTotal
    ? `Questions: ${e.answered} of ${e.questionsTotal} answered, ${e.firstRight} right first time${e.understood > e.firstRight ? `, ${e.understood - e.firstRight} put right after a gap` : ""}${e.unresolved ? `, ${e.unresolved} still wrong` : ""}`
    : "Questions: none in this area yet");
  fact(e.practicalsTotal
    ? `Practical work: ${e.practicalsPassed} of ${e.practicalsTotal} passed their check${e.independent ? `, ${e.independent} with no hints` : ""}${e.hints ? ` · ${e.hints} hint${e.hints === 1 ? "" : "s"} used` : ""}`
    : "Practical work: none in this area yet");
  if (a.id === "debugging" && a.strengths.some((x) => /fixed yourself/.test(x))) fact(a.strengths.find((x) => /fixed yourself/.test(x)));
  if (a.mistakes.length) fact(`Mistakes met: ${a.mistakes.map((m) => `${m.label} (×${m.total})`).slice(0, 3).join("; ")}`);
  body.appendChild(facts);

  if (a.nextLevel) {
    body.appendChild(el("div", "lesson-list-heading", `TO REACH ${LEVELS[levelIndex(a.nextLevel)].label.toUpperCase()}`));
    const list = el("ul", "criteria-list");
    const crit = a.criteria[a.nextLevel] ?? a.toNext;
    for (const c of crit) list.appendChild(el("li", c.na ? "is-na" : c.met ? "is-met" : "", `${c.na ? "– " : c.met ? "✔ " : "○ "}${c.text}${c.na ? " (not needed here)" : ""}`));
    body.appendChild(list);
  } else {
    body.appendChild(el("p", "next-step-done", "✔ Mastered - every criterion met."));
  }
  if (a.weak.length) {
    body.appendChild(el("div", "lesson-list-heading", "WORTH ANOTHER LOOK"));
    const list = el("ul", "skill-area-weak");
    for (const w of a.weak.slice(0, 4)) {
      const li = el("li", null, w.text);
      if (w.lessonId) li.appendChild(button("Review", "btn-hint btn-small", () => cb.onOpenLesson?.(w.lessonId), lessonLabel(w.lessonId)));
      list.appendChild(li);
    }
    body.appendChild(list);
  }
  const fine = el("p", "learning-legend", `Lessons in this area: ${a.lessons.map((l) => lessonPosition(l).label).join(", ")}`);
  body.appendChild(fine);
  d.appendChild(body);
  return d;
}

function goalsPanel(progress, report, cb) {
  const box = el("div", "goals-panel");
  const statuses = goalStatus(progress, report);
  const activeGoals = statuses.filter((g) => !g.saved.doneAt);
  const reached = statuses.filter((g) => g.saved.doneAt);
  if (!activeGoals.length) box.appendChild(el("p", "learning-empty", "No goal set. Pick one below - its progress comes from your real work, so it moves when you've actually learned something."));
  for (const g of activeGoals) {
    const row = el("div", "goal-row");
    const head = el("div", "goal-head");
    head.append(el("strong", null, g.goal.title), button("Remove", "btn-secondary btn-small", () => cb.onRemoveGoal?.(g.goal.id), "Stop tracking this goal"));
    const gbar = el("div", "dash-overall-bar goal-bar");
    gbar.setAttribute("role", "progressbar");
    gbar.setAttribute("aria-valuenow", String(g.pct));
    gbar.setAttribute("aria-valuemin", "0");
    gbar.setAttribute("aria-valuemax", "100");
    gbar.setAttribute("aria-label", g.goal.title);
    const gf = el("span", "dash-overall-fill");
    gf.style.width = `${g.pct}%`;
    gbar.appendChild(gf);
    row.append(head, gbar, el("p", "learning-legend", `${g.detail} · ${g.goal.why}`));
    box.appendChild(row);
  }
  const options = availableGoals(progress, report);
  if (activeGoals.length < MAX_ACTIVE_GOALS && options.length) {
    const add = el("div", "goal-add");
    const lab = el("label", "goal-add-label", "Add a goal: ");
    const select = el("select", "goal-select");
    select.appendChild(Object.assign(el("option", null, "Choose a goal…"), { value: "" }));
    for (const g of options) select.appendChild(Object.assign(el("option", null, g.title), { value: g.id }));
    lab.appendChild(select);
    const go = button("Set goal", "btn-primary", () => { if (select.value) cb.onSetGoal?.(select.value); });
    add.append(lab, go);
    box.appendChild(add);
  } else if (activeGoals.length >= MAX_ACTIVE_GOALS) {
    box.appendChild(el("p", "learning-legend", `Up to ${MAX_ACTIVE_GOALS} goals at a time - fewer goals, more focus.`));
  }
  if (reached.length) {
    box.appendChild(el("div", "lesson-list-heading", "MILESTONES REACHED"));
    const ul = el("ul", "goal-reached");
    for (const g of reached) ul.appendChild(el("li", null, `✔ ${g.goal.title} - ${new Date(g.saved.doneAt).toLocaleDateString()}`));
    box.appendChild(ul);
  }
  return box;
}

function historyPanel(progress, now) {
  const box = el("div", "history-panel");
  const items = [...(progress.activity ?? [])].reverse().slice(0, 8);
  const trophies = Object.entries(progress.achievements ?? {})
    .filter(([id]) => ACHIEVEMENT_MAP[id]).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 3);
  const cols = el("div", "history-cols");
  const left = el("div");
  left.appendChild(el("div", "lesson-list-heading", "LEARNING HISTORY"));
  if (!items.length) left.appendChild(el("p", "learning-empty", "Lessons you finish, checkpoints you answer and challenges you pass are listed here."));
  else {
    const ul = el("ul", "history-list");
    for (const it of items) {
      const li = el("li");
      const text = it.lessonId ? `${it.label}: ${lessonLabel(it.lessonId)}` : it.label;
      li.append(el("span", "history-when", ago(it.at, now)), el("span", null, text));
      ul.appendChild(li);
    }
    left.appendChild(ul);
  }
  const right = el("div");
  right.appendChild(el("div", "lesson-list-heading", "RECENT ACHIEVEMENTS"));
  if (!trophies.length) right.appendChild(el("p", "learning-empty", "None yet - the full trophy room is further down."));
  else {
    const ul = el("ul", "history-list");
    for (const [id, at] of trophies) {
      const li = el("li");
      li.append(el("span", "history-when", ago(at, now)), el("span", null, `${ACHIEVEMENT_MAP[id].name} - ${ACHIEVEMENT_MAP[id].desc}`));
      ul.appendChild(li);
    }
    right.appendChild(ul);
  }
  cols.append(left, right);
  box.appendChild(cols);
  return box;
}

// ---- a revision session, one step at a time, in a window ----
// cb: onAnswer(item, quizId, success, topic, detail) - record one answer;
//     onDone(area, right, total) - the session finished.
export function openRevisionSession(progress, area, { onAnswer, onDone, onOpenLesson } = {}) {
  const session = buildSession(progress, { area });
  const body = el("div", "revision-body");
  if (!session) {
    openModal({ title: "REVISION", content: el("p", null, "Nothing to revise here right now - no missed questions are waiting."), actions: [{ label: "OK", kind: "primary" }] });
    return;
  }
  let i = 0;
  let right = 0;
  let asked = 0;
  let nextBtn = null;
  let finished = false;
  const results = [];

  const show = () => {
    body.innerHTML = "";
    const step = session.steps[i];
    const qNumber = session.steps.slice(0, i + 1).filter((s) => s.type === "question").length;
    if (step.type === "recap") {
      body.appendChild(el("div", "lesson-list-heading", `RECAP · ${lessonLabel(step.recap.lessonId).toUpperCase()}`));
      if (step.recap.why) body.appendChild(el("p", "revision-from", step.recap.why));
      const ul = el("ul", "revision-recap");
      for (const p of step.recap.points) ul.appendChild(el("li", null, p));
      body.appendChild(ul);
      body.appendChild(el("p", "learning-legend", "Read it through, then try the question."));
      nextBtn.disabled = false;
      nextBtn.textContent = "I'm ready - ask me";
      return;
    }
    body.appendChild(el("div", "lesson-list-heading", `QUESTION ${qNumber} OF ${session.questions}`));
    body.appendChild(el("p", "revision-from", step.role === "missed"
      ? (step.legacy ? "From a checkpoint you found tricky before (recorded before single questions were tracked)." : `You missed this one ${step.missedOn ? ago(step.missedOn) : "before"}. Try it again.`)
      : "A new question on the same idea - to check it's understood, not just remembered."));
    const quizBox = el("div", "quiz-section");
    body.appendChild(quizBox);
    let answered = false;
    const quiz = revisionQuiz(step.item);
    renderQuiz(quizBox, quiz, (quizId, success, topic, detail) => {
      if (!answered) {
        answered = true;
        asked += 1;
        if (success) right += 1;
        results.push({ step, success });
      }
      onAnswer?.(step.item, quizId, success, topic, detail);
      nextBtn.disabled = false;
    });
    nextBtn.disabled = true;
    nextBtn.textContent = i === session.steps.length - 1 ? "Finish" : "Next";
  };

  const handle = openModal({
    title: "REVISION SESSION",
    content: body,
    className: "modal-wide",
    actions: [{ label: "Next", kind: "primary", closes: false, onClick: () => advance() }],
    onOpen: (box) => {
      nextBtn = box.querySelector(".modal-actions .btn");
      show();
    },
    onClose: () => { if (asked) onDone?.(area, right, asked); },
  });
  function advance() {
    if (finished) { handle.close(); return; }
    if (i < session.steps.length - 1) { i += 1; show(); return; }
    finished = true;
    body.innerHTML = "";
    body.appendChild(el("div", "lesson-list-heading", "SESSION COMPLETE"));
    const missedRight = results.filter((r) => r.step.role === "missed" && r.success).length;
    const missedTotal = results.filter((r) => r.step.role === "missed").length;
    const checkRight = results.filter((r) => r.step.role === "check" && r.success).length;
    const checkTotal = results.filter((r) => r.step.role === "check").length;
    body.appendChild(el("p", null, `${right} of ${asked} right first time.`));
    const ul = el("ul", "revision-recap");
    if (missedTotal) ul.appendChild(el("li", null, `Questions you'd missed: ${missedRight} of ${missedTotal} right${missedRight ? " - each one right after a gap moves further along, until it counts as secure" : ""}.`));
    if (checkTotal) ul.appendChild(el("li", null, `New questions on the same ideas: ${checkRight} of ${checkTotal} right${checkRight === checkTotal ? " - you've understood the idea, not just the answer." : "."}`));
    if (right < asked) ul.appendChild(el("li", null, "Anything you missed comes back tomorrow, with its recap."));
    body.appendChild(ul);
    const weakLesson = results.find((r) => !r.success)?.step.item.lessonId;
    if (weakLesson && onOpenLesson) {
      body.appendChild(button(`Read ${lessonLabel(weakLesson)} again`, "btn-hint", () => { handle.close(); onOpenLesson(weakLesson); }));
    }
    nextBtn.textContent = "Done";
    nextBtn.disabled = false;
  }
}

// The "what this shows" note after a checkpoint, challenge or project.
export function renderFeedback(container, lines) {
  container.querySelector(".learning-feedback")?.remove();
  if (!lines?.length) return;
  const box = el("div", "learning-feedback");
  box.appendChild(el("div", "lesson-list-heading", "WHAT THIS SHOWS"));
  const ul = el("ul");
  for (const l of lines) ul.appendChild(el("li", `fb-${l.kind}`, l.text));
  box.appendChild(ul);
  container.appendChild(box);
}
