// Entry point: wires the sidebar, lesson panel, editor, and challenge panel together.
// This is the only file that "knows about" all the other modules - each other module
// only knows about its own job (rendering lessons, running the editor, saving progress).
// That separation is what "modular design" means in practice: you can open editor.js
// without needing to understand data.js at all.

import {
  loadProgress,
  saveProgress,
  markLessonViewed,
  toggleLessonFlag,
  markChallengeCompleted,
  recordQuizResult,
  markProjectStageDone,
  touchStreak,
  spendCredits,
  CREDIT_REWARDS,
  getLevelInfo,
  LEVEL_MILESTONES,
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
import { renderMentorBox, getLessonIntroLine, getLessonCompleteLine, getChallengeCompleteLine, getLevelUpLine } from "./npc/mentor.js";
import { createEditor } from "./editor/editor.js";
import { createBoard } from "./simulator/board.js";
import { startProgram } from "./simulator/interpreter.js";

const sidebarEl = document.getElementById("sidebar");
const mentorBoxEl = document.getElementById("mentor-box");
const lessonContentEl = document.getElementById("lesson-content");
const editorSectionEl = document.querySelector(".editor-section");
const simulatorSectionEl = document.querySelector(".simulator-section");
const challengeSectionEl = document.getElementById("challenge-section");
const quizSectionEl = document.getElementById("quiz-section");
const progressSummaryEl = document.getElementById("progress-summary");
const creditsDisplayEl = document.getElementById("credits-display");
const levelDisplayEl = document.getElementById("level-display");
const statusTextEl = document.getElementById("status-text");
const resetCodeBtn = document.getElementById("reset-code-btn");
const runBtn = document.getElementById("run-code-btn");
const stopBtn = document.getElementById("stop-code-btn");
const componentPickerEl = document.getElementById("component-picker");
const addComponentBtn = document.getElementById("add-component-btn");
const clearWiringBtn = document.getElementById("clear-wiring-btn");
const clearConsoleBtn = document.getElementById("clear-console-btn");
const consoleEl = document.getElementById("sim-console");
const wirePaletteEl = document.getElementById("wire-palette");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdropEl = document.getElementById("sidebar-backdrop");
const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
const layoutEl = document.querySelector(".layout");
const viewTabsEl = document.getElementById("view-tabs");
const viewEls = {
  lessons: document.getElementById("view-lessons"),
  projects: document.getElementById("view-projects"),
  dashboard: document.getElementById("view-dashboard"),
};
const projectsPanelEl = document.getElementById("projects-panel");
const dashboardPanelEl = document.getElementById("dashboard-panel");
const mainPanelEl = document.querySelector(".main-panel");

// A CSS animation only plays when an element first matches its selector -
// since lessonContentEl/viewEls are long-lived nodes we just refill with new
// children, adding the class back a second time would normally do nothing.
// Removing it, forcing a reflow, then re-adding it makes the browser treat
// it as a fresh trigger each time.
function replayFadeIn(el) {
  el.classList.remove("fade-in-content");
  void el.offsetWidth;
  el.classList.add("fade-in-content");
}

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

// Desktop-only sidebar collapse (separate from the mobile drawer above) -
// removes the sidebar from the layout entirely so the lesson content, editor,
// and circuit board can use the freed-up width instead of leaving it blank.
// Persisted so a collapsed sidebar stays collapsed across page reloads.
const SIDEBAR_COLLAPSED_KEY = "arduino-tutor-sidebar-collapsed";
function setSidebarCollapsed(collapsed) {
  layoutEl.classList.toggle("sidebar-collapsed", collapsed);
  sidebarCollapseBtn.textContent = collapsed ? "›" : "‹";
  const label = collapsed ? "Show lesson list" : "Collapse lesson list";
  sidebarCollapseBtn.title = label;
  sidebarCollapseBtn.setAttribute("aria-label", label);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  editor.refresh(); // the editor's container width just changed, so CodeMirror needs to re-measure
}
sidebarCollapseBtn.addEventListener("click", () => {
  setSidebarCollapsed(!layoutEl.classList.contains("sidebar-collapsed"));
});
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");

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
    renderDashboard(dashboardPanelEl, progress, {
      onReviewTopic: (lessonId) => {
        switchView("lessons");
        openLesson(lessonId);
      },
    });
  }
  replayFadeIn(viewEls[viewName]);
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
        const xpBefore = progress.xp;
        const milestonesBefore = progress.milestonesAwarded.length;
        progress = markProjectStageDone(progress, projectId, stageId);
        updateCreditsDisplay(); // was previously missing here - a stage completion earns credits same as anything else
        updateLevelDisplay();
        // Projects has no mentor box on screen (that stays scoped to Lessons/
        // Dashboard), so a level-up here rides along on the status line instead.
        const levelUp = checkLevelUp(xpBefore, milestonesBefore);
        statusTextEl.textContent = `Stage marked complete in "${project.title}".`
          + (levelUp ? ` ${getLevelUpLine(levelUp.level, levelUp.isMilestone, levelUp.bonus)}` : "");
        renderProjectsView(); // re-render so the stage tracker dots at the top update too
      },
      onOpenEditor: () => switchView("lessons"),
    });
  } else {
    renderProjectList(projectsPanelEl, progress, {
      onSelectProject: (id) => { currentProjectId = id; renderProjectsView(); },
    });
  }
  replayFadeIn(projectsPanelEl);
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
  for (const btn of [runBtn, stopBtn, addComponentBtn, clearWiringBtn]) {
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
    analogRead: board.analogRead,
    analogWrite: board.analogWrite,
    pulseIn: board.pulseIn,
    tone: board.tone,
    noTone: board.noTone,
    servoWrite: board.servoWrite,
    lcdBegin: board.lcdBegin,
    lcdPrint: board.lcdPrint,
    lcdSetCursor: board.lcdSetCursor,
    lcdClear: board.lcdClear,
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

addComponentBtn.addEventListener("click", guarded(() => board.addComponent(componentPickerEl.value)));
clearWiringBtn.addEventListener("click", guarded(() => board.clearWiring()));
clearConsoleBtn.addEventListener("click", guarded(() => { consoleEl.innerHTML = ""; }));

function updateProgressSummary() {
  const total = getTotalLessonCount();
  const done = progress.viewedLessons.length;
  progressSummaryEl.textContent = `${done} / ${total} lessons complete`;
}

// In the red is a normal, expected state (see spendCredits in progress.js -
// a hint always stays available even if it puts you into debt), so it gets
// its own look rather than reading like something went wrong.
function updateCreditsDisplay() {
  const inDebt = progress.credits < 0;
  creditsDisplayEl.textContent = `⚡ ${progress.credits}`;
  creditsDisplayEl.classList.toggle("credits-debt", inDebt);
  creditsDisplayEl.title = inDebt
    ? "You're in the red - finish a lesson or challenge to earn it back."
    : "Credits earned at CircuitWorks Robotics - spend them on hints.";
}

function updateLevelDisplay() {
  levelDisplayEl.textContent = `🎖️ Lv ${getLevelInfo(progress.xp).level}`;
}

// Call sites that can award XP snapshot progress.xp and
// progress.milestonesAwarded.length BEFORE calling the earn function, then
// pass those snapshots here afterward to find out whether that one action
// crossed a level - milestonesAwarded growing is the authoritative signal
// for "a milestone bonus was just paid" (it's guarded at the mutation site
// in progress.js, not just inferred from level numbers here).
function checkLevelUp(xpBefore, milestonesBefore) {
  if (progress.milestonesAwarded.length > milestonesBefore) {
    const level = progress.milestonesAwarded[progress.milestonesAwarded.length - 1];
    return { level, bonus: LEVEL_MILESTONES[level], isMilestone: true };
  }
  const levelAfter = getLevelInfo(progress.xp).level;
  if (levelAfter > getLevelInfo(xpBefore).level) {
    return { level: levelAfter, bonus: null, isMilestone: false };
  }
  return null;
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
  const isFlagged = progress.flaggedLessons.includes(lessonId);
  renderLesson(lessonContentEl, lesson, isCompleted, isFlagged);
  renderMentorBox(mentorBoxEl, { text: getLessonIntroLine(lesson), tag: "Quest Briefing" });
  setActiveSidebarLink(sidebarEl, lessonId);
  closeSidebarDrawer(); // on mobile, picking a lesson should close the slide-in drawer

  const challenge = getChallengeForLesson(lesson);
  renderChallenge(challengeSectionEl, challenge, {
    onComplete: (challengeId) => {
      const xpBefore = progress.xp;
      const milestonesBefore = progress.milestonesAwarded.length;
      progress = markChallengeCompleted(progress, challengeId);
      updateCreditsDisplay();
      updateLevelDisplay();
      const levelUp = checkLevelUp(xpBefore, milestonesBefore);
      renderMentorBox(mentorBoxEl, levelUp
        ? { text: getLevelUpLine(levelUp.level, levelUp.isMilestone, levelUp.bonus), tag: "Level Up!" }
        : { text: getChallengeCompleteLine(), tag: "Nice work" });
      statusTextEl.textContent = `Challenge "${challenge.title}" marked as solved. +${CREDIT_REWARDS.challenge} credits!`;
    },
    onSpend: (cost, label) => {
      progress = spendCredits(progress, cost);
      updateCreditsDisplay();
      statusTextEl.textContent = `${label} revealed. -${cost} credits.`;
    },
  });

  // The practice editor and circuit board only matter when THIS lesson has
  // something to actually build - a purely conceptual lesson (no challenge)
  // doesn't need an empty code editor sitting underneath it. A run already
  // in progress keeps running in the background either way (editor.js/board.js
  // are shared singletons, not recreated per lesson) - it's just not shown
  // while you're reading a lesson that doesn't need it.
  editorSectionEl.hidden = !challenge;
  simulatorSectionEl.hidden = !challenge;
  if (challenge) editor.refresh(); // CodeMirror needs this after being unhidden to size itself correctly

  const quiz = getQuizForLesson(lessonId);
  quizSectionEl.innerHTML = "";
  if (quiz) {
    renderQuiz(quizSectionEl, quiz, (quizId, success, topic) => {
      // Checked BEFORE recording, since recordQuizResult only pays out credits
      // the first time a quiz flips to solved - re-answering an
      // already-solved quiz (e.g. revisiting the lesson) correctly earns
      // nothing again, and the status message should say so honestly.
      const alreadySolved = progress.quizzes[quizId]?.solved;
      const xpBefore = progress.xp;
      const milestonesBefore = progress.milestonesAwarded.length;
      progress = recordQuizResult(progress, quizId, success, topic);
      updateCreditsDisplay();
      updateLevelDisplay();
      const earnedCredits = success && !alreadySolved;
      statusTextEl.textContent = success
        ? `Quiz correct! ("${topic}")` + (earnedCredits ? ` +${CREDIT_REWARDS.quiz} credits!` : "")
        : `Quiz attempt recorded - not quite right yet ("${topic}").`;
      // A quiz normally doesn't touch the mentor box at all (that stays
      // scoped to lessons/challenges) - a level-up is the one exception,
      // since it's a bigger moment than a routine correct answer.
      const levelUp = checkLevelUp(xpBefore, milestonesBefore);
      if (levelUp) {
        renderMentorBox(mentorBoxEl, { text: getLevelUpLine(levelUp.level, levelUp.isMilestone, levelUp.bonus), tag: "Level Up!" });
      }
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
    const alreadyDone = progress.viewedLessons.includes(lessonId);
    const xpBefore = progress.xp;
    const milestonesBefore = progress.milestonesAwarded.length;
    progress = markLessonViewed(progress, lessonId);
    updateProgressSummary();
    updateCreditsDisplay();
    updateLevelDisplay();
    renderSidebar(sidebarEl, progress, openLesson); // re-render so the "done" dot updates
    openLesson(lessonId); // re-render this lesson so the button flips to "✓ Completed"
    // openLesson() above sets its own "Viewing: ..." status text and its own
    // lesson-intro mentor line, which would instantly overwrite these if set
    // beforehand - set them AFTER instead so the completion reaction is
    // actually what's left on screen.
    statusTextEl.textContent = alreadyDone
      ? `"${lesson.title}" marked as done.`
      : `"${lesson.title}" marked as done. +${CREDIT_REWARDS.lesson} credits!`;
    if (!alreadyDone) {
      const levelUp = checkLevelUp(xpBefore, milestonesBefore);
      renderMentorBox(mentorBoxEl, levelUp
        ? { text: getLevelUpLine(levelUp.level, levelUp.isMilestone, levelUp.bonus), tag: "Level Up!" }
        : { text: getLessonCompleteLine(), tag: "Nice work" });
    }
  });
  // A lighter-weight update than the complete button above: flagging is
  // purely cosmetic bookkeeping, not a state change that affects credits,
  // XP, or the rest of the lesson - so this updates the button and sidebar
  // directly instead of re-running openLesson(), which would also restart
  // the fade-in, retype Sam's line, and reset scroll position for no reason.
  lessonContentEl.querySelector('[data-action="toggle-flag"]')?.addEventListener("click", (e) => {
    const nowFlagged = !progress.flaggedLessons.includes(lessonId);
    progress = toggleLessonFlag(progress, lessonId);
    e.currentTarget.classList.toggle("flagged", nowFlagged);
    e.currentTarget.textContent = nowFlagged ? "🚩 Flagged" : "🏳️ Flag for Review";
    renderSidebar(sidebarEl, progress, openLesson); // updates the flag icon in the Quest Log
    setActiveSidebarLink(sidebarEl, lessonId); // renderSidebar rebuilds the list, so the active highlight needs reapplying
    statusTextEl.textContent = nowFlagged
      ? `"${lesson.title}" flagged for review - you'll see it in the sidebar and on your Dashboard.`
      : `"${lesson.title}" unflagged.`;
  });

  statusTextEl.textContent = `Viewing: ${lesson.title}`;
  window.scrollTo({ top: 0 });
  // Scrolls .main-panel itself back to its top rather than scrolling
  // lessonContentEl into view - the mentor box now sits above it as the
  // first child, and scrolling THAT element into view would push Sam's
  // line straight back off-screen on every lesson change.
  mainPanelEl.scrollTo({ top: 0 });
  replayFadeIn(mainPanelEl);
}

resetCodeBtn.addEventListener("click", () => {
  stopRun();
  editor.reset();
  statusTextEl.textContent = "Editor reset to template.";
});

// initial boot
renderSidebar(sidebarEl, progress, openLesson);
updateProgressSummary();
updateCreditsDisplay();
updateLevelDisplay();
openLesson(progress.lastLessonId || getFirstLessonId());
editor.refresh();
