// Turns lesson data (plain objects from data.js) into DOM elements.
// Keeping this separate from data.js follows a common pattern: "data" describes
// WHAT to show, "render" decides HOW to show it. You could swap this file for a
// completely different visual style without touching a single lesson's content.

import { lessons } from "./data.js";
import { typewriterText } from "../utils/typewriter.js";
import { levelName, levelTitle, levelIcon, levelNumber } from "./levels.js";
import { icon } from "../game/sprites.js";
import { CREDIT_REWARDS } from "../progress/progress.js";
import { getQuizForLesson } from "../quiz/data.js";
import { renderDemo } from "./demos.js";
import { withTerms } from "./terms.js";
import { renderDiagram } from "./diagrams.js";
import { lessonPosition, lessonById, nextLesson, missingNeeds, challengeEvidence } from "../progress/learning.js";

export function renderSidebar(container, progress, onSelect) {
  container.innerHTML = "";

  const done = new Set(progress.viewedLessons);
  const questLogHeading = document.createElement("div");
  questLogHeading.className = "sidebar-heading";
  questLogHeading.innerHTML = `${icon("scroll", 2)}<span>Quest Log</span><span class="sidebar-count">${done.size}/${lessons.length}</span>`;
  container.appendChild(questLogHeading);

  const overall = document.createElement("div");
  overall.className = "sidebar-progress";
  const overallFill = document.createElement("div");
  overallFill.className = "sidebar-progress-fill";
  overallFill.style.width = `${lessons.length ? (done.size / lessons.length) * 100 : 0}%`;
  overall.appendChild(overallFill);
  container.appendChild(overall);

  let currentLevel = null;
  for (const lesson of lessons) {
    if (lesson.level !== currentLevel) {
      currentLevel = lesson.level;
      const inLevel = lessons.filter((l) => l.level === currentLevel);
      const doneInLevel = inLevel.filter((l) => done.has(l.id)).length;
      const heading = document.createElement("div");
      heading.className = "sidebar-level" + (doneInLevel === inLevel.length ? " is-cleared" : "");
      heading.innerHTML = `<span class="sidebar-level-ico">${icon(levelIcon(currentLevel), 2)}</span><span class="sidebar-level-text"><span class="sidebar-level-eyebrow">MODULE ${levelNumber(currentLevel)}</span><span class="sidebar-level-name"></span></span><span class="sidebar-level-count">${doneInLevel}/${inLevel.length}</span>`;
      heading.querySelector(".sidebar-level-name").textContent = levelTitle(currentLevel);
      container.appendChild(heading);
    }

    const link = document.createElement("div");
    link.className = "lesson-link";
    if (progress.viewedLessons.includes(lesson.id)) link.classList.add("done");

    const check = document.createElement("span");
    check.className = "lesson-check";
    if (done.has(lesson.id)) check.innerHTML = icon("check", 1);
    const label = document.createElement("span");
    label.className = "lesson-link-title";
    label.textContent = lesson.title;

    link.appendChild(check);
    link.appendChild(label);

    // A little skull on boss lessons, so you can see what's coming at a glance.
    if (lesson.challenge?.difficulty === "boss") {
      const skull = document.createElement("span");
      skull.className = "lesson-boss-icon";
      skull.title = "Boss challenge";
      skull.innerHTML = icon("skull", 1);
      link.appendChild(skull);
    }

    // A flagged lesson (see the "Flag for Review" button on the lesson page
    // itself) gets a small marker here too, so scanning the Quest Log is
    // enough to remember where you got stuck - you don't have to click back
    // into every lesson to check.
    if (progress.flaggedLessons?.includes(lesson.id)) {
      const flagIcon = document.createElement("span");
      flagIcon.className = "lesson-flag-icon";
      flagIcon.innerHTML = icon("flag", 1);
      flagIcon.title = "Flagged for review";
      link.appendChild(flagIcon);
    }

    link.addEventListener("click", () => onSelect(lesson.id));
    // reachable and usable from the keyboard, like a button
    link.tabIndex = 0;
    link.setAttribute("role", "button");
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(lesson.id);
      }
    });
    link.dataset.lessonId = lesson.id;

    container.appendChild(link);
  }
}

export function setActiveSidebarLink(container, lessonId) {
  container.querySelectorAll(".lesson-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.lessonId === lessonId);
    if (el.dataset.lessonId === lessonId) el.setAttribute("aria-current", "true");
    else el.removeAttribute("aria-current");
  });
}

// { type: "action", text, label, action } - a call-out with a button, e.g.
// "build it hands-on in the guided first circuit". app.js wires up the
// button by its data-action.
function renderAction(block) {
  const box = document.createElement("div");
  box.className = "lesson-action";
  const text = document.createElement("p");
  text.textContent = block.text;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-complete";
  btn.dataset.action = block.action;
  btn.textContent = block.label;
  box.append(text, btn);
  return box;
}

// A complete sketch (it has both setup() and loop()) can be run as it is.
export function isFullSketch(code) {
  return /\bvoid\s+setup\s*\(/.test(code) && /\bvoid\s+loop\s*\(/.test(code);
}

// "Try it": loads a lesson's example into the editor to run and change (app.js
// handles the click by its data-action).
function tryItButton(code) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-hint try-it-btn";
  btn.dataset.action = "try-code";
  btn.dataset.code = code;
  btn.textContent = "▶ Try it in the editor";
  btn.title = "Load this example into the editor below, then press Run - and try changing it";
  return btn;
}

// { type: "objectives", items } and { type: "mistakes", items }: a short
// headed list - what the lesson teaches, and the slips worth watching for.
function renderList(block, heading, className) {
  const box = document.createElement("div");
  box.className = className;
  const h = document.createElement("div");
  h.className = "lesson-list-heading";
  h.textContent = heading;
  const ul = document.createElement("ul");
  for (const text of block.items) {
    const li = document.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  }
  box.append(h, ul);
  return box;
}

// { type: "predict", question, options, answer, explain, code?, output? }:
// commit to a guess first, THEN see why. Not graded - choosing reveals the
// explanation. `output` is what the sketch really prints; the tests check it
// against the simulator so the "right" answer can never be wrong.
// { type: "predict" } - "predict first" (before running something), or
// { type: "question" } - a quick check of understanding. Both: question,
// options, answer, explain, and optionally why[i] - why option i is wrong.
// A wrong pick says why and lets you think again; "Show the answer" is there
// for when you're stuck.
function renderPredict(block, label = "PREDICT FIRST") {
  const box = document.createElement("div");
  box.className = block.type === "question" ? "lesson-predict lesson-question" : "lesson-predict";
  const eyebrow = document.createElement("div");
  eyebrow.className = "lesson-list-heading";
  eyebrow.textContent = label;
  const q = document.createElement("p");
  q.className = "lesson-predict-q";
  q.textContent = block.question;
  box.append(eyebrow, q);
  if (block.code) {
    const pre = document.createElement("pre");
    pre.className = "code-block";
    pre.textContent = block.code;
    box.appendChild(pre);
  }
  const options = document.createElement("div");
  options.className = "lesson-predict-options";
  const reveal = document.createElement("div");
  reveal.className = "lesson-predict-reveal";
  reveal.hidden = true;
  const buttons = [];

  const showAnswer = (chosen) => {
    buttons.forEach((x, j) => {
      x.disabled = true;
      if (j === chosen) x.classList.add("is-chosen");
      if (j === block.answer) x.classList.add("is-correct");
    });
    const verdict = document.createElement("p");
    verdict.className = chosen === block.answer ? "guide-verdict is-right" : "guide-verdict is-wrong";
    verdict.textContent = chosen === block.answer
      ? (block.type === "question" ? "Right. Here's why:" : "Your prediction was right. Here's why:")
      : `It's "${block.options[block.answer]}". Here's why:`;
    const explain = document.createElement("p");
    explain.textContent = block.explain;
    reveal.replaceChildren(verdict, explain);
    if (block.code && isFullSketch(block.code)) reveal.appendChild(tryItButton(block.code));
    reveal.hidden = false;
  };

  block.options.forEach((text, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "guide-option";
    b.textContent = text;
    b.addEventListener("click", () => {
      if (i === block.answer) {
        showAnswer(i);
        return;
      }
      // wrong: say why, cross this one out, and let them think again
      b.disabled = true;
      b.classList.add("is-crossed");
      const verdict = document.createElement("p");
      verdict.className = "guide-verdict is-wrong";
      verdict.textContent = `Not quite. ${block.why?.[i] ?? ""}`.trim() + " Try another answer.";
      const show = document.createElement("button");
      show.type = "button";
      show.className = "btn btn-hint lesson-show-answer";
      show.textContent = "Show the answer";
      show.addEventListener("click", () => showAnswer(i));
      reveal.replaceChildren(verdict, show);
      reveal.hidden = false;
    });
    buttons.push(b);
    options.appendChild(b);
  });
  box.append(options, reveal);
  return box;
}

// { type: "diagram", diagram, caption }: a labelled drawing (diagrams.js).
function renderDiagramBlock(block) {
  const art = renderDiagram(block.diagram);
  if (!art) return document.createComment(`unknown diagram ${block.diagram}`);
  const fig = document.createElement("figure");
  fig.className = "lesson-diagram";
  fig.appendChild(art);
  if (block.caption) fig.appendChild(Object.assign(document.createElement("figcaption"), { textContent: block.caption }));
  return fig;
}

// { type: "table", head: [...], rows: [[...]] }: a comparison table. The
// first cell of each row is its label.
function renderTable(block, terms) {
  const wrap = document.createElement("div");
  wrap.className = "lesson-table-wrap";
  const table = document.createElement("table");
  table.className = "lesson-table";
  if (block.head) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const h of block.head) tr.appendChild(Object.assign(document.createElement("th"), { textContent: h, scope: "col" }));
    thead.appendChild(tr);
    table.appendChild(thead);
  }
  const tbody = document.createElement("tbody");
  for (const row of block.rows) {
    const tr = document.createElement("tr");
    row.forEach((cell, i) => {
      const td = document.createElement(i === 0 ? "th" : "td");
      if (i === 0) td.scope = "row";
      td.appendChild(withTerms(cell, terms));
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// { type: "annotated", lines: [[code, note], ...] }: code with a plain-words
// note beside each line (and Try it, when it's a whole sketch).
function renderAnnotated(block) {
  const wrap = document.createElement("div");
  wrap.className = "lesson-annotated";
  const scroll = document.createElement("div");
  scroll.className = "annotated-scroll";
  const table = document.createElement("table");
  table.className = "annotated-code";
  for (const [code, note] of block.lines) {
    const tr = document.createElement("tr");
    const c = document.createElement("td");
    c.className = "annotated-line";
    c.textContent = code;
    const n = document.createElement("td");
    n.className = "annotated-note";
    n.textContent = note ?? "";
    tr.append(c, n);
    table.appendChild(tr);
  }
  scroll.appendChild(table);
  wrap.appendChild(scroll);
  const sketch = annotatedSketch(block);
  if (isFullSketch(sketch)) wrap.appendChild(tryItButton(sketch));
  return wrap;
}
export const annotatedSketch = (block) => block.lines.map(([code]) => code).join("\n");

// { type: "exercise", kind: "modify" | "debug" | "independent", task, code?,
//   hint?, expected, solution? }: something to do on your own. The expected
// result is always there to check against; the hint and a solution sit
// behind buttons, so trying comes first.
const EXERCISE_LABELS = { modify: "MODIFY IT", debug: "DEBUG IT", independent: "YOUR TURN" };
function renderExercise(block, terms) {
  const box = document.createElement("div");
  box.className = `lesson-exercise is-${block.kind ?? "independent"}`;
  box.appendChild(Object.assign(document.createElement("div"), { className: "lesson-list-heading", textContent: EXERCISE_LABELS[block.kind] ?? "YOUR TURN" }));
  const task = document.createElement("p");
  task.appendChild(withTerms(block.task, terms));
  box.appendChild(task);
  if (block.code) {
    const wrap = document.createElement("div");
    wrap.className = "code-with-try";
    const pre = document.createElement("pre");
    pre.className = "code-block";
    pre.textContent = block.code;
    wrap.appendChild(pre);
    if (isFullSketch(block.code)) wrap.appendChild(tryItButton(block.code));
    box.appendChild(wrap);
  }
  const buttons = document.createElement("div");
  buttons.className = "exercise-buttons";
  const panel = document.createElement("div");
  panel.className = "exercise-reveal";
  const reveals = [
    block.hint && ["Hint", "HINT", block.hint, false],
    ["Expected result", "WHAT YOU SHOULD SEE", block.expected, false],
    block.solution && ["Show a solution", "ONE WAY TO DO IT", block.solution, true],
  ].filter(Boolean);
  for (const [label, heading, content, isCode] of reveals) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-hint";
    b.textContent = label;
    b.setAttribute("aria-expanded", "false");
    const part = document.createElement("div");
    part.className = "exercise-part";
    part.hidden = true;
    part.appendChild(Object.assign(document.createElement("div"), { className: "lesson-list-heading", textContent: heading }));
    if (isCode) {
      const pre = document.createElement("pre");
      pre.className = "code-block";
      pre.textContent = content;
      part.appendChild(pre);
      if (isFullSketch(content)) part.appendChild(tryItButton(content));
    } else {
      part.appendChild(Object.assign(document.createElement("p"), { textContent: content }));
    }
    b.addEventListener("click", () => {
      part.hidden = !part.hidden;
      b.setAttribute("aria-expanded", String(!part.hidden));
    });
    buttons.appendChild(b);
    panel.appendChild(part);
  }
  box.append(buttons, panel);
  return box;
}

// { type: "list", items }: a plain bulleted list.
function renderPlainList(block, terms) {
  const ul = document.createElement("ul");
  ul.className = "lesson-list";
  for (const text of block.items) {
    const li = document.createElement("li");
    li.appendChild(withTerms(text, terms));
    ul.appendChild(li);
  }
  return ul;
}

// { type: "example", code } - a runnable worked example (with Try it), or
// { type: "example", text } - a worked example in words (a calculation, a plan).
function renderExample(block) {
  if (block.code) {
    const wrap = document.createElement("div");
    wrap.className = "code-with-try";
    const pre = document.createElement("pre");
    pre.className = "code-block";
    typewriterText(pre, block.code);
    wrap.append(pre, tryItButton(block.code));
    return wrap;
  }
  const pre = document.createElement("pre");
  pre.className = "example-text";
  pre.textContent = block.text;
  return pre;
}

// { type: "guided", title, steps, code? }: follow-along instructions,
// optionally with the sketch they start from (with Try it). `broken: true`
// marks a sketch that's wrong on purpose (the tests check it really is).
function renderGuided(block) {
  const box = document.createElement("div");
  box.className = "lesson-guided";
  const h = document.createElement("div");
  h.className = "lesson-list-heading";
  h.textContent = block.title || "Follow along";
  box.appendChild(h);
  if (block.code) {
    const wrap = document.createElement("div");
    wrap.className = "code-with-try";
    const pre = document.createElement("pre");
    pre.className = "code-block";
    pre.textContent = block.code;
    wrap.append(pre, tryItButton(block.code));
    box.appendChild(wrap);
  }
  const ol = document.createElement("ol");
  for (const step of block.steps) {
    const li = document.createElement("li");
    li.textContent = step;
    ol.appendChild(li);
  }
  box.appendChild(ol);
  return box;
}

// { type: "circuit", label, parts, wires }: puts a starter circuit on the
// lesson's board (app.js handles the button by its data-action).
function renderCircuitLoader(block) {
  const box = document.createElement("div");
  box.className = "lesson-circuit";
  const p = document.createElement("p");
  // "2 LEDs and 2 resistors", "a push button, a resistor and an LED"
  const LABELS = { led: "LED", button: "push button", rgbled: "RGB LED", ldr: "light sensor", tempsensor: "temperature sensor" };
  const counts = new Map();
  for (const part of block.parts) counts.set(part.kind, (counts.get(part.kind) ?? 0) + 1);
  const items = [...counts].map(([kind, n]) => {
    const label = LABELS[kind] ?? kind;
    return n > 1 ? `${n} ${label}s` : `${/^[aeiouAEIOU]|^LED|^RGB/.test(label) ? "an" : "a"} ${label}`;
  });
  const names = items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0];
  p.textContent = `Puts ${names} on the board below, already wired - replacing whatever is on it now.`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-hint";
  btn.dataset.action = "load-circuit";
  btn.dataset.circuit = JSON.stringify({ parts: block.parts, wires: block.wires });
  btn.textContent = block.label || "Load this circuit";
  box.append(p, btn);
  return box;
}

// { type: "experiment", text, code? }: change something and see what happens.
function renderExperiment(block) {
  const box = document.createElement("div");
  box.className = "lesson-experiment";
  const p = document.createElement("p");
  p.textContent = block.text;
  box.appendChild(p);
  if (block.code) box.appendChild(tryItButton(block.code));
  return box;
}

// `terms` ({ seen, lessonId }) marks the first use of a word a beginner may
// not know (see terms.js) - in paragraphs, notes and lists.
function renderBlock(block, terms) {
  if (block.type === "action") return renderAction(block);
  if (block.type === "list") return renderPlainList(block, terms);
  if (block.type === "example") return renderExample(block);
  if (block.type === "guided") return renderGuided(block);
  if (block.type === "circuit") return renderCircuitLoader(block);
  if (block.type === "experiment") return renderExperiment(block);
  if (block.type === "demo") return renderDemo(block.demo) ?? document.createComment(`unknown demo ${block.demo}`);
  if (block.type === "objectives") return renderList(block, "IN THIS LESSON YOU'LL LEARN TO", "lesson-objectives");
  if (block.type === "mistakes") return renderList(block, "COMMON MISTAKES", "lesson-mistakes");
  if (block.type === "predict") return renderPredict(block);
  if (block.type === "question") return renderPredict(block, "CHECK YOUR UNDERSTANDING");
  if (block.type === "diagram") return renderDiagramBlock(block);
  if (block.type === "table") return renderTable(block, terms);
  if (block.type === "annotated") return renderAnnotated(block);
  if (block.type === "exercise") return renderExercise(block, terms);
  const el = document.createElement(
    block.type === "code" ? "pre" : block.type === "note" ? "div" : "p"
  );

  if (block.type === "code") {
    el.className = "code-block";
    typewriterText(el, block.text);
    if (isFullSketch(block.text)) {
      const wrap = document.createElement("div");
      wrap.className = "code-with-try";
      wrap.append(el, tryItButton(block.text));
      return wrap;
    }
  } else if (block.type === "note") {
    el.className = "note-box";
    el.appendChild(withTerms(block.text, terms));
  } else {
    el.appendChild(withTerms(block.text, terms));
  }
  return el;
}

// Paints the Flag-for-Review button for a given state. Exported so app.js can
// flip it in place when it's clicked, without re-rendering the whole lesson.
export function setFlagButton(btn, flagged) {
  btn.classList.toggle("flagged", flagged);
  btn.innerHTML = `${icon("flag", 2)} ${flagged ? "Flagged" : "Flag for Review"}`;
}

export function findLesson(lessonId) {
  return lessons.find((l) => l.id === lessonId);
}

// The little row of tags under a lesson's title that makes it read like a game
// quest: which quest number it is, what finishing it pays, and what else is
// waiting inside (a challenge, a quiz, a boss).
function buildQuestMeta(lesson, isCompleted) {
  const row = document.createElement("div");
  row.className = "quest-meta";
  const number = lessons.findIndex((l) => l.id === lesson.id) + 1;
  const chips = [];
  chips.push(`<span class="quest-chip">${icon("scroll", 1)}QUEST ${number}/${lessons.length}</span>`);
  chips.push(
    isCompleted
      ? `<span class="quest-chip quest-reward is-done">${icon("check", 1)}CLEARED</span>`
      : `<span class="quest-chip quest-reward">REWARD ${icon("star", 1)}+${CREDIT_REWARDS.lesson} XP ${icon("coin", 1)}+${CREDIT_REWARDS.lesson}</span>`
  );
  if (lesson.challenge?.difficulty === "boss") {
    chips.push(`<span class="quest-chip quest-boss">${icon("skull", 1)}BOSS</span>`);
  } else if (lesson.challenge) {
    chips.push(`<span class="quest-chip">${icon("bolt", 1)}CHALLENGE</span>`);
  }
  if (getQuizForLesson(lesson.id)) chips.push(`<span class="quest-chip">${icon("puzzle", 1)}QUIZ</span>`);
  row.innerHTML = chips.join("");
  return row;
}

// The lesson template. Every lesson renders in the same order, and a part
// only appears when the lesson really has it - no empty headings:
//   header -> why it matters / before you start / you'll be able to ->
//   numbered sections (Introduction, Visual explanation, Worked example,
//   Guided activity, Predict, Experiment, Common mistakes) -> navigation.
// The challenge ("Independent challenge"), the quiz ("Knowledge checkpoint")
// and the "What's next" card follow below, rendered by app.js.
const SECTION_OF_BLOCK = {
  demo: "visual", diagram: "visual", example: "example", annotated: "example", guided: "guided",
  predict: "predict", experiment: "experiment", exercise: "exercise", mistakes: "mistakes",
};
export const SECTION_TITLES = {
  intro: "Introduction",
  theory: "How it works",
  application: "In real projects",
  visual: "Visual explanation",
  example: "Worked example",
  guided: "Guided activity",
  predict: "Predict",
  experiment: "Modify and experiment",
  exercise: "Independent exercise",
  mistakes: "Common mistakes",
  challenge: "Independent challenge",
  checkpoint: "Knowledge checkpoint",
  summary: "Summary",
};

// Splits a lesson's blocks into template sections. A block that isn't an
// activity (text, a note, a snippet, a quick check) belongs to the section it
// follows; `section: "theory"` / `"application"` on a block starts that part.
export function lessonSections(lesson) {
  const sections = [];
  for (const block of lesson.body) {
    let kind = block.section ?? SECTION_OF_BLOCK[block.type];
    if (!kind && block.type === "code" && isFullSketch(block.text)) kind = "example";
    if (!kind) kind = sections.length ? sections[sections.length - 1].kind : "intro";
    if (!sections.length || sections[sections.length - 1].kind !== kind) sections.push({ kind, blocks: [] });
    sections[sections.length - 1].blocks.push(block);
  }
  return sections;
}

export function sectionHeading(number, kind) {
  const h = document.createElement("h2");
  h.className = "lesson-section-title";
  const n = document.createElement("span");
  n.className = "lesson-section-num";
  n.textContent = String(number);
  h.append(n, document.createTextNode(SECTION_TITLES[kind]));
  return h;
}

// "Why this matters", "Before you start" and "You'll be able to".
function buildLessonIntro(lesson, progress) {
  const box = document.createElement("div");
  box.className = "lesson-intro-box";
  if (lesson.why) {
    const why = document.createElement("p");
    why.className = "lesson-why";
    why.textContent = lesson.why;
    box.appendChild(why);
  }
  const cols = document.createElement("div");
  cols.className = "lesson-intro-cols";

  const before = document.createElement("div");
  before.className = "lesson-before";
  const bh = document.createElement("div");
  bh.className = "lesson-list-heading";
  bh.textContent = "BEFORE YOU START";
  before.appendChild(bh);
  const needs = (lesson.needs || []).map(lessonById).filter(Boolean);
  if (!needs.length) {
    before.appendChild(Object.assign(document.createElement("p"), { textContent: "Nothing - this is a good place to start." }));
  } else {
    const ul = document.createElement("ul");
    for (const need of needs) {
      const done = progress?.viewedLessons.includes(need.id);
      const li = document.createElement("li");
      li.className = done ? "is-done" : "is-todo";
      const mark = document.createElement("span");
      mark.className = "lesson-need-mark";
      mark.textContent = done ? "✔" : "○";
      const link = document.createElement("button");
      link.type = "button";
      link.className = "lesson-need-link";
      link.dataset.action = "open-lesson";
      link.dataset.lessonId = need.id;
      link.textContent = `${lessonPosition(need).label} ${need.title}`;
      li.append(mark, link);
      ul.appendChild(li);
    }
    before.appendChild(ul);
    if (progress && missingNeeds(lesson, progress).length) {
      before.appendChild(Object.assign(document.createElement("p"), {
        className: "lesson-need-warn",
        textContent: "This lesson builds on the ones marked ○ - doing those first will make it much easier.",
      }));
    }
  }
  cols.appendChild(before);

  if (lesson.objectives?.length) {
    const goals = document.createElement("div");
    goals.className = "lesson-goals";
    const gh = document.createElement("div");
    gh.className = "lesson-list-heading";
    gh.textContent = "YOU'LL BE ABLE TO";
    const ul = document.createElement("ul");
    for (const text of lesson.objectives) {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    }
    goals.append(gh, ul);
    cols.appendChild(goals);
  }
  box.appendChild(cols);
  return box;
}

// "In this lesson: 1 Introduction · 2 Worked example · ..." - the map of the
// lesson, so the structure is visible before you scroll.
function buildOutline(sections, lesson) {
  const kinds = sections.map((s) => s.kind);
  if (lesson.challenge) kinds.push("challenge");
  if (getQuizForLesson(lesson.id)) kinds.push("checkpoint");
  kinds.push("summary");
  const row = document.createElement("div");
  row.className = "lesson-outline";
  row.appendChild(Object.assign(document.createElement("span"), { className: "lesson-outline-label", textContent: "In this lesson:" }));
  kinds.forEach((kind, i) => {
    row.appendChild(Object.assign(document.createElement("span"), { className: "lesson-outline-item", textContent: `${i + 1} ${SECTION_TITLES[kind]}` }));
  });
  return row;
}

// Returns how many numbered sections it drew, so the challenge and the
// checkpoint below can carry on the numbering.
export function renderLesson(container, lesson, isCompleted, isFlagged, progress) {
  container.innerHTML = "";

  const topRow = document.createElement("div");
  topRow.className = "lesson-top-row";

  const eyebrow = document.createElement("div");
  eyebrow.className = "lesson-eyebrow";
  eyebrow.innerHTML = `${icon(levelIcon(lesson.level), 2)}<span></span>`;
  const pos = lessonPosition(lesson);
  eyebrow.querySelector("span").textContent = `${levelName(lesson.level)} · Lesson ${pos.index} of ${pos.count}`;
  topRow.appendChild(eyebrow);

  // A quick way to bookmark "I struggled here" the moment it happens, rather
  // than at the end of the lesson - it's a toggle (unlike "Mark as Done"),
  // since the whole point is clearing it again once you've gone back and it
  // actually clicked.
  const flagBtn = document.createElement("button");
  flagBtn.dataset.action = "toggle-flag";
  flagBtn.className = "flag-btn";
  flagBtn.dataset.sfx = "none";
  setFlagButton(flagBtn, isFlagged);
  topRow.appendChild(flagBtn);

  container.appendChild(topRow);

  const heading = document.createElement("h1");
  heading.textContent = lesson.title;
  container.appendChild(heading);
  container.appendChild(buildQuestMeta(lesson, isCompleted));
  container.appendChild(buildLessonIntro(lesson, progress));

  const sections = lessonSections(lesson);
  container.appendChild(buildOutline(sections, lesson));
  const terms = { seen: new Set(), lessonId: lesson.id };
  sections.forEach((section, i) => {
    container.appendChild(sectionHeading(i + 1, section.kind));
    for (const block of section.blocks) container.appendChild(renderBlock(block, terms));
  });

  // simple prev/next navigation between lessons, plus an explicit "mark done"
  // button - viewing a lesson no longer marks it complete automatically, you
  // decide when you've actually understood it.
  const index = lessons.findIndex((l) => l.id === lesson.id);
  const nav = document.createElement("div");
  nav.className = "lesson-nav";

  const prev = document.createElement("button");
  prev.className = "btn btn-secondary";
  prev.innerHTML = `<span class="arrow-ico flip">${icon("play", 1)}</span> Previous`;
  prev.disabled = index <= 0;
  prev.dataset.action = "prev";

  const navRight = document.createElement("div");
  navRight.className = "lesson-nav-right";

  const complete = document.createElement("button");
  complete.dataset.action = "complete";
  if (isCompleted) {
    complete.className = "btn btn-secondary";
    complete.innerHTML = `${icon("check", 2)} Completed`;
    complete.disabled = true;
  } else {
    complete.className = "btn btn-complete";
    complete.dataset.sfx = "none";
    complete.innerHTML = `${icon("check", 2)} Mark Lesson as Done`;
  }

  const next = document.createElement("button");
  next.className = "btn btn-primary";
  next.innerHTML = `Next <span class="arrow-ico">${icon("play", 1)}</span>`;
  next.disabled = index >= lessons.length - 1;
  next.dataset.action = "next";

  navRight.appendChild(complete);
  navRight.appendChild(next);
  nav.appendChild(prev);
  nav.appendChild(navRight);
  container.appendChild(nav);
  return sections.length;
}

// "What's next": after every lesson, one clear next step - finish what's
// left here first (the challenge, the checkpoint), then the next lesson, with
// why it matters. Buttons work by data-action (app.js).
export function renderNextStep(container, lesson, progress) {
  container.innerHTML = "";
  // The template's last numbered part: the summary - the key points (where
  // the lesson has them), and what you should now be able to do, as a
  // self-check.
  const number = lessonSections(lesson).length + (lesson.challenge ? 1 : 0) + (getQuizForLesson(lesson.id) ? 1 : 0) + 1;
  container.appendChild(sectionHeading(number, "summary"));
  const summary = document.createElement("div");
  summary.className = "lesson-summary";
  if (lesson.summary?.length) {
    summary.appendChild(Object.assign(document.createElement("div"), { className: "lesson-list-heading", textContent: "KEY POINTS" }));
    const ul = document.createElement("ul");
    for (const text of lesson.summary) ul.appendChild(Object.assign(document.createElement("li"), { textContent: text }));
    summary.appendChild(ul);
  }
  if (lesson.objectives?.length) {
    summary.appendChild(Object.assign(document.createElement("div"), { className: "lesson-list-heading", textContent: "YOU SHOULD NOW BE ABLE TO" }));
    const ul = document.createElement("ul");
    ul.className = "lesson-summary-check";
    for (const text of lesson.objectives) ul.appendChild(Object.assign(document.createElement("li"), { textContent: text }));
    summary.appendChild(ul);
    summary.appendChild(Object.assign(document.createElement("p"), {
      className: "lesson-summary-note",
      textContent: "Not sure about one of these? Go back over that part, or flag the lesson for review - it'll show up on your Progress page.",
    }));
  }
  container.appendChild(summary);

  const card = document.createElement("div");
  card.className = "next-step-card hud-frame";
  const h = document.createElement("div");
  h.className = "lesson-list-heading";
  h.textContent = "WHAT'S NEXT";
  card.appendChild(h);

  const todo = [];
  const challenge = challengeEvidence(lesson, progress);
  if (challenge && !challenge.passed) todo.push(`Try the challenge above - Check My Solution tells you whether you've really got it.`);
  const quiz = getQuizForLesson(lesson.id);
  if (quiz && !progress.quizzes[quiz.id]?.solved) todo.push("Answer the knowledge checkpoint above.");
  const done = progress.viewedLessons.includes(lesson.id);
  if (!done) todo.push("When you're happy with it, press \"Mark Lesson as Done\".");
  if (todo.length) {
    const ul = document.createElement("ul");
    ul.className = "next-step-todo";
    for (const t of todo) ul.appendChild(Object.assign(document.createElement("li"), { textContent: t }));
    card.appendChild(ul);
  } else {
    card.appendChild(Object.assign(document.createElement("p"), { className: "next-step-done", textContent: "✔ Lesson complete." }));
  }

  const index = lessons.indexOf(lesson);
  const next = lessons[index + 1];
  if (next) {
    const newModule = next.module !== lesson.module;
    const p = document.createElement("p");
    p.className = "next-step-lesson";
    p.textContent = newModule
      ? `That's the end of Module ${lesson.module}! Next up is Module ${next.module} · ${levelTitle(next.module)}, starting with "${next.title}": ${next.why ?? ""}`
      : `Next: ${lessonPosition(next).label} ${next.title} - ${next.why ?? ""}`;
    card.appendChild(p);
  } else {
    card.appendChild(Object.assign(document.createElement("p"), { className: "next-step-lesson", textContent: "That's the last lesson in the course - time for a project of your own!" }));
  }

  const actions = document.createElement("div");
  actions.className = "next-step-actions";
  if (next) {
    const go = document.createElement("button");
    go.type = "button";
    go.className = done ? "btn btn-complete" : "btn btn-primary";
    go.dataset.action = "open-lesson";
    go.dataset.lessonId = next.id;
    go.textContent = done ? `Start ${lessonPosition(next).label}: ${next.title}` : `Go to ${lessonPosition(next).label} anyway`;
    actions.appendChild(go);
  }
  const practice = document.createElement("button");
  practice.type = "button";
  practice.className = "btn btn-secondary";
  practice.dataset.action = "open-practice";
  practice.textContent = "Practise freely";
  practice.title = "Free Practice: the editor and every part, no lesson";
  const course = document.createElement("button");
  course.type = "button";
  course.className = "btn btn-secondary";
  course.dataset.action = "open-course";
  course.textContent = "Course overview";
  actions.append(practice, course);
  card.appendChild(actions);
  container.appendChild(card);
}

export function getAdjacentLessonId(lessonId, direction) {
  const index = lessons.findIndex((l) => l.id === lessonId);
  const targetIndex = direction === "next" ? index + 1 : index - 1;
  return lessons[targetIndex]?.id ?? null;
}

export function getChallengeForLesson(lesson) {
  return lesson.challenge || null;
}

export function getFirstLessonId() {
  return lessons[0].id;
}

export function getTotalLessonCount() {
  return lessons.length;
}
