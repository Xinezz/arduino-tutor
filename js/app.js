// Entry point: wires the sidebar, lesson panel, editor, and challenge panel together.
// This is the only file that "knows about" all the other modules - each other module
// only knows about its own job (rendering lessons, running the editor, saving progress).
// That separation is what "modular design" means in practice: you can open editor.js
// without needing to understand data.js at all.

import { loadProgress, saveProgress, markLessonViewed, markChallengeCompleted } from "./progress/progress.js";
import {
  renderSidebar,
  setActiveSidebarLink,
  renderLesson,
  findLesson,
  getAdjacentLessonId,
  getChallengeForLesson,
  getFirstLessonId,
  getTotalLessonCount,
} from "./lessons/render.js";
import { renderChallenge } from "./lessons/challenge.js";
import { createEditor } from "./editor/editor.js";
import { createBoard } from "./simulator/board.js";
import { startProgram } from "./simulator/interpreter.js";

const sidebarEl = document.getElementById("sidebar");
const lessonContentEl = document.getElementById("lesson-content");
const challengeSectionEl = document.getElementById("challenge-section");
const progressSummaryEl = document.getElementById("progress-summary");
const statusTextEl = document.getElementById("status-text");
const resetCodeBtn = document.getElementById("reset-code-btn");
const runBtn = document.getElementById("run-code-btn");
const stopBtn = document.getElementById("stop-code-btn");
const addLedBtn = document.getElementById("add-led-btn");
const addButtonBtn = document.getElementById("add-button-btn");
const clearWiringBtn = document.getElementById("clear-wiring-btn");
const clearConsoleBtn = document.getElementById("clear-console-btn");
const consoleEl = document.getElementById("sim-console");

let progress = loadProgress();
const editor = createEditor(document.getElementById("code-editor"));
let activeRun = null;

// The circuit board is built separately from the lesson viewer below, and
// wrapped in try/catch, so that if IT fails for some reason, the rest of the
// site (lessons, editor) still works instead of the whole page going dead.
let board = null;
try {
  board = createBoard(document.getElementById("sim-board"));
} catch (err) {
  console.error("Failed to start the circuit simulator:", err);
  for (const btn of [runBtn, stopBtn, addLedBtn, addButtonBtn, clearWiringBtn]) {
    btn.disabled = true;
    btn.title = "The simulator failed to load - check the browser console for details.";
  }
}

function consoleWrite(text, cls) {
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text;
  consoleEl.appendChild(span);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function stopRun() {
  if (activeRun) activeRun.stop();
  activeRun = null;
  runBtn.disabled = false;
  stopBtn.disabled = true;
}

function runCode() {
  stopRun();
  board.reset();
  consoleWrite(`--- Run started ---\n`, "sim-status");
  runBtn.disabled = true;
  stopBtn.disabled = false;

  activeRun = startProgram(editor.getValue(), {
    pinMode: board.pinMode,
    digitalWrite: board.digitalWrite,
    digitalRead: board.digitalRead,
  }, {
    onOutput: (text) => consoleWrite(text),
    onError: (message) => {
      consoleWrite(`Error: ${message}\n`, "sim-error");
      runBtn.disabled = false;
      stopBtn.disabled = true;
      activeRun = null;
    },
    onStopped: (message) => {
      if (message) consoleWrite(`${message}\n`, "sim-status");
      else consoleWrite(`--- loop() finished ---\n`, "sim-status");
      runBtn.disabled = false;
      stopBtn.disabled = true;
      activeRun = null;
    },
  });
}

runBtn.addEventListener("click", runCode);
stopBtn.addEventListener("click", () => {
  stopRun();
  consoleWrite(`--- Stopped ---\n`, "sim-status");
});
function guarded(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (err) {
      console.error(err);
      statusTextEl.textContent = `Something went wrong: ${err.message}`;
    }
  };
}

addLedBtn.addEventListener("click", guarded(() => board.addComponent("led")));
addButtonBtn.addEventListener("click", guarded(() => board.addComponent("button")));
clearWiringBtn.addEventListener("click", guarded(() => board.clearWiring()));
clearConsoleBtn.addEventListener("click", guarded(() => { consoleEl.innerHTML = ""; }));

function updateProgressSummary() {
  const total = getTotalLessonCount();
  const done = progress.viewedLessons.length;
  progressSummaryEl.textContent = `${done} / ${total} lessons complete`;
}

function openLesson(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson) return;

  // Note: opening/viewing a lesson does NOT mark it complete - completion is
  // only recorded when the learner explicitly clicks "Mark Lesson as Done"
  // below, so the sidebar/progress reflect real understanding, not just clicks.
  progress.lastLessonId = lessonId;
  saveProgress(progress);

  const isCompleted = progress.viewedLessons.includes(lessonId);
  renderLesson(lessonContentEl, lesson, isCompleted);
  setActiveSidebarLink(sidebarEl, lessonId);

  const challenge = getChallengeForLesson(lesson);
  renderChallenge(challengeSectionEl, challenge, (challengeId) => {
    progress = markChallengeCompleted(progress, challengeId);
    statusTextEl.textContent = `Challenge "${challenge.title}" marked as solved.`;
  });

  // wire up the prev/next/complete buttons that renderLesson just created
  lessonContentEl.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
    const prevId = getAdjacentLessonId(lessonId, "prev");
    if (prevId) openLesson(prevId);
  });
  lessonContentEl.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    const nextId = getAdjacentLessonId(lessonId, "next");
    if (nextId) openLesson(nextId);
  });
  lessonContentEl.querySelector('[data-action="complete"]')?.addEventListener("click", () => {
    progress = markLessonViewed(progress, lessonId);
    updateProgressSummary();
    renderSidebar(sidebarEl, progress, openLesson); // re-render so the "done" dot updates
    statusTextEl.textContent = `"${lesson.title}" marked as done.`;
    openLesson(lessonId); // re-render this lesson so the button flips to "✓ Completed"
  });

  statusTextEl.textContent = `Viewing: ${lesson.title}`;
  window.scrollTo({ top: 0 });
  lessonContentEl.scrollIntoView({ block: "start" });
}

resetCodeBtn.addEventListener("click", () => {
  stopRun();
  editor.reset();
  statusTextEl.textContent = "Editor reset to template.";
});

// initial boot
renderSidebar(sidebarEl, progress, openLesson);
updateProgressSummary();
openLesson(progress.lastLessonId || getFirstLessonId());
editor.refresh();
