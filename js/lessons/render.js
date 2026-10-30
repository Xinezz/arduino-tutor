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
      heading.innerHTML = `<span class="sidebar-level-ico">${icon(levelIcon(currentLevel), 2)}</span><span class="sidebar-level-text"><span class="sidebar-level-eyebrow">LEVEL ${levelNumber(currentLevel)}</span><span class="sidebar-level-name"></span></span><span class="sidebar-level-count">${doneInLevel}/${inLevel.length}</span>`;
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
    link.dataset.lessonId = lesson.id;

    container.appendChild(link);
  }
}

export function setActiveSidebarLink(container, lessonId) {
  container.querySelectorAll(".lesson-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.lessonId === lessonId);
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
function renderPredict(block) {
  const box = document.createElement("div");
  box.className = "lesson-predict";
  const eyebrow = document.createElement("div");
  eyebrow.className = "lesson-list-heading";
  eyebrow.textContent = "PREDICT FIRST";
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
  block.options.forEach((text, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "guide-option";
    b.textContent = text;
    b.addEventListener("click", () => {
      options.querySelectorAll("button").forEach((x, j) => {
        x.disabled = true;
        if (j === i) x.classList.add("is-chosen");
        if (j === block.answer) x.classList.add("is-correct");
      });
      const verdict = document.createElement("p");
      verdict.className = i === block.answer ? "guide-verdict is-right" : "guide-verdict is-wrong";
      verdict.textContent = i === block.answer ? "Your prediction was right. Here's why:" : `Not quite - it's "${block.options[block.answer]}". Here's why:`;
      const explain = document.createElement("p");
      explain.textContent = block.explain;
      reveal.replaceChildren(verdict, explain);
      if (block.code) reveal.appendChild(tryItButton(block.code));
      reveal.hidden = false;
    });
    options.appendChild(b);
  });
  box.append(options, reveal);
  return box;
}

function renderBlock(block) {
  if (block.type === "action") return renderAction(block);
  if (block.type === "objectives") return renderList(block, "IN THIS LESSON YOU'LL LEARN TO", "lesson-objectives");
  if (block.type === "mistakes") return renderList(block, "COMMON MISTAKES", "lesson-mistakes");
  if (block.type === "predict") return renderPredict(block);
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
    el.textContent = block.text;
  } else {
    el.textContent = block.text;
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

export function renderLesson(container, lesson, isCompleted, isFlagged) {
  container.innerHTML = "";

  const topRow = document.createElement("div");
  topRow.className = "lesson-top-row";

  const eyebrow = document.createElement("div");
  eyebrow.className = "lesson-eyebrow";
  eyebrow.innerHTML = `${icon(levelIcon(lesson.level), 2)}<span></span>`;
  eyebrow.querySelector("span").textContent = levelName(lesson.level);
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

  for (const block of lesson.body) {
    container.appendChild(renderBlock(block));
  }

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
