// Entry point: wires the sidebar, lesson panel, editor, and challenge panel together.
// This is the only file that "knows about" all the other modules - each other module
// only knows about its own job (rendering lessons, running the editor, saving progress).
// That separation is what "modular design" means in practice: you can open editor.js
// without needing to understand data.js at all.

import {
  loadProgress,
  saveProgress,
  markLessonViewed,
  markChallengeCompleted,
  recordQuizResult,
  markProjectStageDone,
  touchStreak,
} from "./progress/progress.js";
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
import { getQuizForLesson } from "./quiz/data.js";
import { renderQuiz } from "./quiz/quiz.js";
import { findProject } from "./projects/data.js";
import { renderProjectList, renderProjectDetail } from "./projects/projects.js";
import { renderDashboard } from "./dashboard/dashboard.js";
import { createEditor } from "./editor/editor.js";
import { createBoard } from "./simulator/board.js";
import { startProgram } from "./simulator/interpreter.js";

const sidebarEl = document.getElementById("sidebar");
const lessonContentEl = document.getElementById("lesson-content");
const challengeSectionEl = document.getElementById("challenge-section");
const quizSectionEl = document.getElementById("quiz-section");
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
const wirePaletteEl = document.getElementById("wire-palette");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdropEl = document.getElementById("sidebar-backdrop");
const viewTabsEl = document.getElementById("view-tabs");
const viewEls = {
  lessons: document.getElementById("view-lessons"),
  projects: document.getElementById("view-projects"),
  dashboard: document.getElementById("view-dashboard"),
};
const projectsPanelEl = document.getElementById("projects-panel");
const dashboardPanelEl = document.getElementById("dashboard-panel");

function closeSidebarDrawer() {
  sidebarEl.classList.remove("open");
  sidebarBackdropEl.classList.remove("open");
}
sidebarToggleBtn.addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
  sidebarBackdropEl.classList.toggle("open");
});
sidebarBackdropEl.addEventListener("click", closeSidebarDrawer);

let progress = loadProgress();
touchStreak(progress);
const editor = createEditor(document.getElementById("code-editor"));
let activeRun = null;
let currentView = "lessons";
let currentProjectId = null;

function switchView(viewName) {
  currentView = viewName;
  for (const [name, el] of Object.entries(viewEls)) {
    el.hidden = name !== viewName;
  }
  viewTabsEl.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  if (viewName === "lessons") {
    editor.refresh(); // CodeMirror needs this after being hidden/shown to size itself correctly
  } else if (viewName === "projects") {
    renderProjectsView();
  } else if (viewName === "dashboard") {
    renderDashboard(dashboardPanelEl, progress);
  }
}

viewTabsEl.querySelectorAll(".view-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function renderProjectsView() {
  if (currentProjectId) {
    const project = findProject(currentProjectId);
    renderProjectDetail(projectsPanelEl, project, progress, {
      onBack: () => { currentProjectId = null; renderProjectsView(); },
      onStageComplete: (projectId, stageId) => {
        progress = markProjectStageDone(progress, projectId, stageId);
        statusTextEl.textContent = `Stage marked complete in "${project.title}".`;
        renderProjectsView(); // re-render so the stage tracker dots at the top update too
      },
      onOpenEditor: () => switchView("lessons"),
    });
  } else {
    renderProjectList(projectsPanelEl, progress, {
      onSelectProject: (id) => { currentProjectId = id; renderProjectsView(); },
    });
  }
}

// The circuit board is built separately from the lesson viewer below, and
// wrapped in try/catch, so that if IT fails for some reason, the rest of the
// site (lessons, editor) still works instead of the whole page going dead.
let board = null;
try {
  board = createBoard(document.getElementById("sim-board"));
  buildWirePalette();
} catch (err) {
  console.error("Failed to start the circuit simulator:", err);
  for (const btn of [runBtn, stopBtn, addLedBtn, addButtonBtn, clearWiringBtn]) {
    btn.disabled = true;
    btn.title = "The simulator failed to load - check the browser console for details.";
  }
}

function buildWirePalette() {
  wirePaletteEl.innerHTML = "";

  const autoBtn = document.createElement("button");
  autoBtn.className = "wire-swatch auto active";
  autoBtn.title = "Auto (red=5V, black=GND, rotates colors for signal wires)";
  autoBtn.addEventListener("click", () => selectWireColor("auto", autoBtn));
  wirePaletteEl.appendChild(autoBtn);

  for (const { name, value } of board.getWirePalette()) {
    const btn = document.createElement("button");
    btn.className = "wire-swatch";
    btn.style.background = value;
    btn.title = name;
    btn.addEventListener("click", () => selectWireColor(value, btn));
    wirePaletteEl.appendChild(btn);
  }
}

function selectWireColor(color, btnEl) {
  board.setWireColor(color);
  wirePaletteEl.querySelectorAll(".wire-swatch").forEach((el) => el.classList.remove("active"));
  btnEl.classList.add("active");
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
  board?.setRunning(false);
}

function runCode() {
  stopRun();
  board.reset();
  board.setRunning(true);
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
      board.setRunning(false);
    },
    onStopped: (message) => {
      if (message) consoleWrite(`${message}\n`, "sim-status");
      else consoleWrite(`--- loop() finished ---\n`, "sim-status");
      runBtn.disabled = false;
      stopBtn.disabled = true;
      activeRun = null;
      board.setRunning(false);
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
  closeSidebarDrawer(); // on mobile, picking a lesson should close the slide-in drawer

  const challenge = getChallengeForLesson(lesson);
  renderChallenge(challengeSectionEl, challenge, (challengeId) => {
    progress = markChallengeCompleted(progress, challengeId);
    statusTextEl.textContent = `Challenge "${challenge.title}" marked as solved.`;
  });

  const quiz = getQuizForLesson(lessonId);
  quizSectionEl.innerHTML = "";
  if (quiz) {
    renderQuiz(quizSectionEl, quiz, (quizId, success, topic) => {
      progress = recordQuizResult(progress, quizId, success, topic);
      statusTextEl.textContent = success
        ? `Quiz correct! ("${topic}")`
        : `Quiz attempt recorded - not quite right yet ("${topic}").`;
    });
  }

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
