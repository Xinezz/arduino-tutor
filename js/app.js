// Entry point: wires the sidebar, lesson panel, editor, and challenge panel together.
// This is the only file that "knows about" all the other modules - each other module
// only knows about its own job (rendering lessons, running the editor, saving progress).
// That separation is what "modular design" means in practice: you can open editor.js
// without needing to understand data.js at all.
//
// The game layer (js/game/*) follows the same rule: the HUD, reward flow, shop,
// map and so on are separate modules that render things and report back, and
// THIS file is where "the learner solved a challenge" turns into "mutate
// progress, then play the celebration" - always in that order, always through
// the one reward flow, so no screen has its own private copy of the logic.

import {
  loadProgress,
  saveProgress,
  markLessonViewed,
  toggleLessonFlag,
  setPlayerName,
  markChallengeCompleted,
  markFirstCircuitDone,
  markOnboarded,
  recordProjectHint,
  recordProjectComplete,
  saveProjectLog,
  recordCheck,
  recordPrediction,
  recordQuizResult,
  recordAnswer,
  recordMistake,
  recordProjectCheck,
  recordRevisionSession,
  setGoal,
  removeGoal,
  markGoalsDone,
  markProjectStageDone,
  startPathway,
  markPathwayLessonDone,
  awardPathwayCertificate,
  touchStreak,
  spendCredits,
  recordHintUse,
  recordRun,
  bumpDailyCounter,
  incrementStat,
  setStat,
  purchaseItem,
  equipItem,
  claimMission,
  claimDailyChest,
  ensureDaily,
  exportSaveCode,
  parseSaveCode,
  resetProgress,
  getLevelInfo,
} from "./progress/progress.js";
import {
  renderSidebar,
  setActiveSidebarLink,
  renderLesson,
  findLesson,
  getAdjacentLessonId,
  getChallengeForLesson,
  getFirstLessonId,
  setFlagButton,
  renderNextStep,
  sectionHeading,
  onPrediction,
  onLessonQuestion,
} from "./lessons/render.js";
import { moduleParts } from "./lessons/levels.js";
import { lessons } from "./lessons/data.js";
import { renderLearnView } from "./learn/learnView.js";
import { openWelcomeTour } from "./learn/welcomeTour.js";
import { renderLearningProgress, openRevisionSession, renderFeedback } from "./progress/progressView.js";
import { masteryReport } from "./progress/skills.js";
import { recommendations } from "./progress/recommend.js";
import { feedbackFor } from "./progress/insights.js";
import { goalById, newlyReached } from "./progress/goals.js";
import { mistakeFromProblem } from "./progress/mistakes.js";
import { QUESTION_BANK } from "./progress/questionBank.js";
import { openTutor } from "./tutor/tutorView.js";
import { renderPathways, confirmPathwayLesson } from "./pathways/pathwaysView.js";
import { pathwayById, pathwayLessonById, pathwayProjectById, PATHWAY_PROJECTS } from "./pathways/data.js";
import { pathwayStatus } from "./pathways/progress.js";
import { renderPortfolio } from "./portfolio/portfolioView.js";
import {
  loadPortfolio, savePortfolio, captureCompletion, captureImprovement, entryIdFor,
  exportPortfolio, parsePortfolioFile, importPortfolio,
} from "./portfolio/portfolio.js";
import { nextLesson, missingNeeds } from "./progress/learning.js";
import { renderChallenge } from "./lessons/challenge.js";
import { getQuizForLesson } from "./quiz/data.js";
import { renderQuiz } from "./quiz/quiz.js";
import { findProject } from "./projects/data.js";
import { renderProjectList, renderProjectDetail } from "./projects/projects.js";
import { BEGINNER_PROJECTS } from "./projects/beginner.js";
import { renderProjectPage, renderProjectBuilder, MODES } from "./projects/projectView.js";
import { runCheck } from "./lessons/checks.js";
import { renderDashboard } from "./dashboard/dashboard.js";
import {
  renderMentorBox,
  getLessonIntroLine,
  getLessonCompleteLine,
  getChallengeCompleteLine,
  getLevelUpLine,
  getPromotionLine,
  getBossIntroLine,
  getBossDefeatLine,
  getDebtLine,
  getPurchaseLine,
  getBrokeLine,
  setPokeHandler,
} from "./npc/mentor.js";
import { renderMenuScreen } from "./menu/menu.js";
import { createSimulatorPanel } from "./simulator/panel.js";
import { createFirstCircuitGuide } from "./guide/firstCircuit.js";

// ---- the game layer ----
import { hydrateSprites, icon } from "./game/sprites.js";
import { playSfx, setMusicTrack } from "./game/audio.js";
import { getSettings, setSetting } from "./game/settings.js";
import {
  installCursors,
  installCrt,
  installFavicon,
  installAudioUnlock,
  installUiSounds,
  installShortcuts,
  installKonami,
} from "./game/setup.js";
import { createHud } from "./game/hud.js";
import { createRewardFlow } from "./game/rewardFlow.js";
import { openSettings, openHelp } from "./game/settingsModal.js";
import { openChest } from "./game/cinematics.js";
import { renderWorldMap, focusCurrentNode } from "./game/worldmap.js";
import { renderShop } from "./game/shopView.js";
import { applyTheme, itemKey, getShopItem } from "./game/shop.js";
import { pendingRewardCount, CHEST_REWARD } from "./game/missions.js";
import { runSplash } from "./game/splash.js";
import { showToast } from "./game/toast.js";
import { confirmDialog } from "./game/modal.js";
import { floatText, coinShower, shake, banner, confetti, pixelWipe, centerOf } from "./game/fx.js";

const menuScreenEl = document.getElementById("menu-screen");
const appShellEl = document.getElementById("app-shell");
const sidebarEl = document.getElementById("sidebar");
const mentorBoxEl = document.getElementById("mentor-box");
const lessonContentEl = document.getElementById("lesson-content");
const editorSectionEl = document.querySelector(".editor-section");
const simulatorSectionEl = document.querySelector(".simulator-section");
const challengeSectionEl = document.getElementById("challenge-section");
const quizSectionEl = document.getElementById("quiz-section");
const statusTextEl = document.getElementById("status-text");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdropEl = document.getElementById("sidebar-backdrop");
const sidebarCollapseBtn = document.getElementById("sidebar-collapse-btn");
const layoutEl = document.querySelector(".layout");
const viewTabsEl = document.getElementById("view-tabs");
const viewEls = {
  learn: document.getElementById("view-learn"),
  lessons: document.getElementById("view-lessons"),
  map: document.getElementById("view-map"),
  projects: document.getElementById("view-projects"),
  pathways: document.getElementById("view-pathways"),
  portfolio: document.getElementById("view-portfolio"),
  practice: document.getElementById("view-practice"),
  shop: document.getElementById("view-shop"),
  dashboard: document.getElementById("view-dashboard"),
};
// The six tabs, in order - also what the number-key shortcuts index into.
const VIEW_ORDER = ["learn", "projects", "pathways", "practice", "dashboard", "portfolio"];
// Which tab is lit for each screen: a lesson and the map belong to Learn,
// the shop to Progress (it's where your rewards are).
const TAB_FOR_VIEW = { learn: "learn", lessons: "learn", map: "learn", projects: "projects", pathways: "pathways", portfolio: "portfolio", practice: "practice", dashboard: "dashboard", shop: "dashboard" };
const learnPanelEl = document.getElementById("learn-panel");
const nextStepEl = document.getElementById("next-step-section");
const projectsPanelEl = document.getElementById("projects-panel");
const pathwaysPanelEl = document.getElementById("pathways-panel");
const portfolioPanelEl = document.getElementById("portfolio-panel");
const dashboardPanelEl = document.getElementById("dashboard-panel");
const mapPanelEl = document.getElementById("map-panel");
const shopPanelEl = document.getElementById("shop-panel");
const mainPanelEl = document.querySelector(".main-panel");

function setStatus(message) {
  statusTextEl.textContent = message;
}

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

// =========================================================================
// Boot: load the save, dress the page (theme, cursors, scanlines), build the HUD
// =========================================================================

let progress = loadProgress();
touchStreak(progress);
ensureDaily(progress);

applyTheme(progress.equipped.theme);
installCursors();
installCrt();
installFavicon();
installAudioUnlock();
installUiSounds();
hydrateSprites();

let appStarted = false;
let currentView = "lessons";
let currentProjectId = null;
let currentLessonId = null;
let bossActive = false; // is the lesson on screen guarding an unbeaten boss? (picks the music)

const hud = createHud({
  onOpenProfile: () => switchView("dashboard"),
  onOpenSettings: () => openOptions(),
  onOpenShop: () => switchView("shop"),
});
const rewards = createRewardFlow({ getProgress: () => progress, hud });
hud.update(progress, { animate: false });
hud.setProfileBadge(pendingRewardCount(progress));

// Poking Sam is an easter egg with a secret trophy at the end of it.
function handlePoke() {
  progress = incrementStat(progress, "samClicks");
  if (progress.stats.samClicks >= 10) rewards.checkAchievements();
}
setPokeHandler(handlePoke);

// A program hit an error: a buzz, and the Serial Monitor shudders.
function runFailed(consoleId) {
  playSfx("error");
  shake(document.getElementById(consoleId));
}

// Every error, warning and wiring fault the simulator reports is checked
// against the known kinds of mistake (progress/mistakes.js); the learner's
// own ones are saved, so one that keeps coming back can be spotted.
const lastErrors = { lessons: null, practice: null };
function handleProblem(where, problem) {
  if (problem.type === "error") lastErrors[where] = problem.details ?? { kind: "code", message: problem.message };
  const m = mistakeFromProblem(problem);
  if (m) progress = recordMistake(progress, m.id, m.label, m.lessonId);
}

function handleRun() {
  const before = rewards.snapshot();
  progress = recordRun(progress);
  rewards.settle(before, { kind: "run" });
}

// Two fully independent editor+board+console units - one for the lesson
// view's built-in practice editor, one for the standalone Free Practice
// view below. Each is self-contained (see createSimulatorPanel), so
// nothing built in one leaks into or gets clobbered by the other.
const lessonsPanel = createSimulatorPanel({
  codeEditorEl: document.getElementById("code-editor"),
  boardSvgEl: document.getElementById("sim-board"),
  runBtn: document.getElementById("run-code-btn"),
  stopBtn: document.getElementById("stop-code-btn"),
  resetBtn: document.getElementById("reset-code-btn"),
  componentPickerEl: document.getElementById("component-picker"),
  addComponentBtn: document.getElementById("add-component-btn"),
  clearWiringBtn: document.getElementById("clear-wiring-btn"),
  clearConsoleBtn: document.getElementById("clear-console-btn"),
  consoleEl: document.getElementById("sim-console"),
  wirePaletteEl: document.getElementById("wire-palette"),
  checkCircuitBtn: document.getElementById("check-circuit-btn"),
  limitsBtn: document.getElementById("limits-btn"),
  circuitReportEl: document.getElementById("circuit-report"),
  onStatus: setStatus,
  onRun: () => { lastErrors.lessons = null; handleRun(); },
  onRunError: () => runFailed("sim-console"),
  onProblem: (p) => handleProblem("lessons", p),
  onReview: (lessonId) => reviewLesson(lessonId),
});
const editor = lessonsPanel.editor;

const practicePanel = createSimulatorPanel({
  codeEditorEl: document.getElementById("practice-code-editor"),
  boardSvgEl: document.getElementById("practice-sim-board"),
  runBtn: document.getElementById("practice-run-btn"),
  stopBtn: document.getElementById("practice-stop-btn"),
  resetBtn: document.getElementById("practice-reset-btn"),
  componentPickerEl: document.getElementById("practice-component-picker"),
  addComponentBtn: document.getElementById("practice-add-component-btn"),
  clearWiringBtn: document.getElementById("practice-clear-wiring-btn"),
  clearConsoleBtn: document.getElementById("practice-clear-console-btn"),
  consoleEl: document.getElementById("practice-sim-console"),
  wirePaletteEl: document.getElementById("practice-wire-palette"),
  checkCircuitBtn: document.getElementById("practice-check-circuit-btn"),
  limitsBtn: document.getElementById("practice-limits-btn"),
  circuitReportEl: document.getElementById("practice-circuit-report"),
  onStatus: setStatus,
  onRun: () => { lastErrors.practice = null; handleRun(); },
  onRunError: () => runFailed("practice-sim-console"),
  onProblem: (p) => handleProblem("practice", p),
  onReview: (lessonId) => reviewLesson(lessonId),
});

// A hint's "Review: <lesson>" button. Nothing is lost by following it: the
// editors and boards keep their code and wiring while you read.
function reviewLesson(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson) return;
  switchView("lessons");
  openLesson(lessonId);
  setStatus(`Reviewing "${lesson.title}" - your code and circuit are still where you left them.`);
}

// ---- "Start your first circuit": the guided walkthrough in Free Practice ----

const practiceIntroEl = document.getElementById("practice-intro");
const practiceWorkspaceEl = document.getElementById("practice-workspace");

const firstCircuitGuide = createFirstCircuitGuide({
  container: document.getElementById("first-circuit-guide"),
  panel: practicePanel,
  targets: {
    picker: document.getElementById("practice-component-picker"),
    board: document.getElementById("practice-sim-board"),
    editor: document.querySelector("#view-practice .editor-section"),
    run: document.getElementById("practice-run-btn"),
  },
  onStatus: setStatus,
  onExit: (byUser) => {
    practiceWorkspaceEl.classList.remove("is-guided");
    practiceIntroEl.hidden = false;
    practicePanel.editor.refresh();
    if (byUser) setStatus("Guide closed - your circuit and code are still here. Restart it any time from Free Practice.");
  },
  onFinish: (next) => {
    const firstTime = !progress.firstCircuitDone;
    const before = rewards.snapshot();
    progress = markFirstCircuitDone(progress);
    const result = rewards.settle(before, { kind: "challenge", label: "Your First Circuit" });
    if (next === "lessons") {
      switchView("lessons");
      openLesson(getFirstLessonId());
    } else if (next === "blink") {
      switchView("lessons");
      openLesson("l2-4");
    }
    // after opening a lesson, which sets its own "Viewing: ..." status
    setStatus(firstTime ? `First circuit complete! +${result.gained} credits.` : "First circuit complete - nice work.");
  },
});

async function startFirstCircuit() {
  if (currentView !== "practice") switchView("practice");
  document.getElementById("practice-beginner-note").hidden = true; // the guide is the instructions now
  document.getElementById("project-guide").hidden = true; // one guide at a time
  if (!firstCircuitGuide.isActive()) {
    const b = practicePanel.board;
    const hasWork = b.listComponents().length > 0 || b.wireCount() > 0 || !practicePanel.editor.isTemplate();
    if (hasWork) {
      const yes = await confirmDialog({
        title: "START WITH A CLEAN BOARD?",
        body: "The guide starts from an empty board and editor, so the circuit and code you have in Free Practice right now will be cleared.",
        confirmLabel: "Clear and Start",
        danger: true,
      });
      if (!yes) return;
    }
    practicePanel.stopRun();
    b.clearWiring();
    for (const c of b.listComponents()) b.removeComponent(c.id);
    practicePanel.editor.reset();
  }
  practiceIntroEl.hidden = true;
  practiceWorkspaceEl.classList.add("is-guided");
  practicePanel.editor.refresh();
  firstCircuitGuide.start();
  setStatus("Guided first circuit - follow the steps in the guide panel.");
}
document.getElementById("start-first-circuit-btn").addEventListener("click", startFirstCircuit);

// "Try it": a lesson's example goes into the lesson's own editor, which is
// shown even on lessons without a challenge, so it can be run and changed.
async function tryLessonCode(code) {
  if (!editor.isTemplate() && editor.getValue() !== code) {
    const yes = await confirmDialog({
      title: "REPLACE YOUR CODE?",
      body: "This puts the lesson's example in the editor, replacing the code that's in it now.",
      confirmLabel: "Replace It",
    });
    if (!yes) return;
  }
  lessonsPanel.stopRun();
  editorSectionEl.hidden = false;
  simulatorSectionEl.hidden = false;
  editor.setValue(code);
  editor.refresh();
  editorSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Example loaded into the editor - press Run to try it, then change something and run it again.");
}

// A lesson's starter circuit ({ type: "circuit" } in the lesson data) goes
// onto the lesson's own board.
async function loadLessonCircuit(spec) {
  const b = lessonsPanel.board;
  if (b.listComponents().length || b.wireCount()) {
    const yes = await confirmDialog({
      title: "REPLACE YOUR CIRCUIT?",
      body: "This puts the lesson's circuit on the board, replacing the parts and wires that are there now. Your code isn't touched.",
      confirmLabel: "Replace It",
    });
    if (!yes) return;
  }
  lessonsPanel.stopRun();
  editorSectionEl.hidden = false;
  simulatorSectionEl.hidden = false;
  editor.refresh();
  b.loadCircuit(spec);
  simulatorSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("Circuit loaded onto the board below.");
}

// Buttons inside a lesson (render.js) - one listener for all of them, since
// some (a prediction's Try it) only appear after the learner answers, and the
// "What's next" card sits below the lesson text.
mainPanelEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  const action = btn?.dataset.action;
  if (action === "first-circuit") startFirstCircuit();
  else if (action === "try-code") tryLessonCode(btn.dataset.code);
  else if (action === "load-circuit") loadLessonCircuit(JSON.parse(btn.dataset.circuit));
  else if (action === "open-lesson") goToLesson(btn.dataset.lessonId);
  else if (action === "open-practice") switchView("practice");
  else if (action === "open-course") switchView("learn");
});

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
  try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* storage blocked - the preference just won't persist */ }
  editor.refresh(); // the editor's container width just changed, so CodeMirror needs to re-measure
}
sidebarCollapseBtn.addEventListener("click", () => {
  setSidebarCollapsed(!layoutEl.classList.contains("sidebar-collapsed"));
});
let sidebarWasCollapsed = false;
try { sidebarWasCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { /* storage blocked */ }
setSidebarCollapsed(sidebarWasCollapsed);

// =========================================================================
// Music: one tune per mood
// =========================================================================

function updateMusic() {
  setMusicTrack(currentView === "lessons" && bossActive ? "boss" : "study");
}

// =========================================================================
// Views
// =========================================================================

// Counts a visit to a screen (for the "explorer" trophies) - only the first
// one matters, so after that this does nothing at all.
function noteVisit(stat) {
  if (progress.stats[stat]) return;
  progress = incrementStat(progress, stat);
  rewards.checkAchievements();
}

function switchView(viewName) {
  if (currentView === "shop" && viewName !== "shop") endThemePreview();
  currentView = viewName;
  for (const [name, el] of Object.entries(viewEls)) {
    el.hidden = name !== viewName;
  }
  viewTabsEl.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === TAB_FOR_VIEW[viewName]);
  });
  if (viewName === "learn") {
    renderLearnView(learnPanelEl, progress, {
      onOpenLesson: goToLesson,
      onOpenMap: () => switchView("map"),
      onStartFirstCircuit: startFirstCircuit,
      onShowTour: showWelcomeTour,
    });
    learnPanelEl.scrollTop = 0;
  } else if (viewName === "lessons") {
    editor.refresh(); // CodeMirror needs this after being hidden/shown to size itself correctly
  } else if (viewName === "practice") {
    practicePanel.editor.refresh(); // same deal - was hidden, needs to re-measure now that it's visible
    // Until the introduction module is done, point beginners back to the
    // course (Free Practice itself stays fully usable) - but not while the
    // guided first circuit is giving instructions.
    document.getElementById("practice-beginner-note").hidden =
      firstCircuitGuide.isActive() || lessons.filter((l) => l.module === 0).every((l) => progress.viewedLessons.includes(l.id));
  } else if (viewName === "projects") {
    renderProjectsView();
  } else if (viewName === "pathways") {
    renderPathwaysView();
  } else if (viewName === "portfolio") {
    renderPortfolioView();
  } else if (viewName === "map") {
    noteVisit("mapVisits");
    renderMapView();
    focusCurrentNode(mapPanelEl);
  } else if (viewName === "shop") {
    noteVisit("shopVisits");
    shopLine = null; // a fresh greeting each visit
    renderShopView();
  } else if (viewName === "dashboard") {
    renderDashboardView();
  }
  replayFadeIn(viewEls[viewName]);
  updateMusic();
}

viewTabsEl.querySelectorAll(".view-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// A project from the library (projects/beginner.js): its page on the Projects
// tab, and its builder beside the editor and board in Free Practice.
const libraryProject = (id) => BEGINNER_PROJECTS.find((p) => p.id === id) ?? pathwayProjectById(id);
// Where "back" on a project page goes: the project list, or the pathway it was opened from.
let projectReturn = null;
const projectGuideEl = document.getElementById("project-guide");

function startProjectBuild(project, mode) {
  if (firstCircuitGuide.isActive()) firstCircuitGuide.stop();
  switchView("practice");
  practiceIntroEl.hidden = true;
  document.getElementById("first-circuit-guide").hidden = true;
  projectGuideEl.hidden = false;
  practiceWorkspaceEl.classList.add("is-guided");
  practicePanel.editor.refresh();
  const exit = () => {
    projectGuideEl.hidden = true;
    projectGuideEl.innerHTML = "";
    practiceWorkspaceEl.classList.remove("is-guided");
    practiceIntroEl.hidden = false;
    practicePanel.editor.refresh();
  };
  renderProjectBuilder(projectGuideEl, project, mode, progress, {
    runCheck: (spec) => {
      const result = runCheck(spec, practicePanel.editor.getValue(), practicePanel.board.inspectCircuit().findings);
      progress = recordProjectCheck(progress, project.id, result.status === "pass");
      return result;
    },
    onStepPassed: (stepId) => {
      const before = rewards.snapshot();
      progress = markProjectStageDone(progress, project.id, stepId);
      rewards.settle(before, { kind: "stage", label: project.title });
    },
    onHint: () => { progress = recordProjectHint(progress, project.id); },
    onComplete: (doneMode, hintsUsed, result) => {
      const before = rewards.snapshot();
      progress = recordProjectComplete(progress, project.id, doneMode, hintsUsed, project.title);
      // the code and circuit that passed go into the portfolio, as a new version
      captureCompletion(portfolio, project, { mode: doneMode, hints: hintsUsed, result, ...practiceWork(), log: progress.projects[project.id]?.log });
      if (!persistPortfolio().ok) setStatus("Couldn't save to your portfolio - this browser's storage may be full.");
      rewards.settle(before, { kind: "stage", label: project.title });
      afterLearning();
      playSfx("correct");
      setStatus(`"${project.title}" complete (${MODES[doneMode].label} mode) - your own code and circuit passed every check.`);
    },
    onExit: () => { exit(); setStatus("Project closed - your circuit and code are still in Free Practice."); },
    onBackToPage: () => { exit(); currentProjectId = project.id; switchView("projects"); },
    onSaveLog: (field, text) => { progress = saveProjectLog(progress, project.id, field, text); },
    onDocument: () => { exit(); portfolioState = { view: "entry", id: entryIdFor(project.id), editing: true }; switchView("portfolio"); },
    onImprovementPassed: (imp, area) => {
      const v = captureImprovement(portfolio, project, imp, practiceWork());
      if (v && persistPortfolio().ok) area.appendChild(Object.assign(document.createElement("p"), { className: "learning-legend", textContent: `Saved in your portfolio as v${v.n}: ${v.name}.` }));
    },
  });
  setStatus(`Building "${project.title}" (${MODES[mode].label}) - the project is beside the editor and board.`);
}

function renderProjectsView() {
  const library = currentProjectId && libraryProject(currentProjectId);
  if (library) {
    renderProjectPage(projectsPanelEl, library, progress, {
      backLabel: projectReturn ? `← ${pathwayById(projectReturn).title} pathway` : undefined,
      onBack: () => {
        currentProjectId = null;
        if (projectReturn) { const to = projectReturn; projectReturn = null; pathwaysState = { view: "pathway", pathwayId: to }; switchView("pathways"); }
        else renderProjectsView();
      },
      onStart: (mode) => startProjectBuild(library, mode),
      onOpenLesson: goToLesson,
      onQuizResult: (quizId, success, topic, detail) => {
        const before = rewards.snapshot();
        progress = recordQuizResult(progress, quizId, success, topic, detail);
        if (success) rewards.settle(before, { kind: "quiz" });
        afterLearning();
      },
      onSaveLog: (field, text) => { progress = saveProjectLog(progress, library.id, field, text); afterLearning(); },
    });
  } else if (currentProjectId) {
    const project = findProject(currentProjectId);
    renderProjectDetail(projectsPanelEl, project, progress, {
      onBack: () => { currentProjectId = null; renderProjectsView(); },
      onStageComplete: (projectId, stageId, { at } = {}) => {
        const before = rewards.snapshot();
        progress = markProjectStageDone(progress, projectId, stageId);
        const result = rewards.settle(before, { kind: "stage", at, label: project.title });
        // Projects has no mentor box on screen (that stays scoped to Lessons/
        // Dashboard), so a level-up here rides along on the status line instead.
        setStatus(
          `Stage marked complete in "${project.title}".` +
            (result.levelUp ? ` ${getLevelUpLine(result.levelUp.level, result.levelUp.isMilestone, result.levelUp.bonus)}` : "")
        );
        renderProjectsView(); // re-render so the stage tracker dots at the top update too
      },
      onOpenEditor: () => switchView("lessons"),
    });
  } else {
    renderProjectList(projectsPanelEl, progress, {
      onSelectProject: (id) => { currentProjectId = id; renderProjectsView(); },
      onOpenLesson: goToLesson,
    });
  }
  replayFadeIn(projectsPanelEl);
}

// ---- the engineering portfolio (portfolio/) ----
// Kept under its own storage key; saved after every change.
let portfolio = loadPortfolio();
let portfolioState = { view: "home" };
const persistPortfolio = () => savePortfolio(portfolio);
const practiceWork = () => ({ code: practicePanel.editor.getValue(), circuit: practicePanel.board.exportCircuit() });

async function loadIntoPractice(code, circuit, label) {
  const yes = await confirmDialog({
    title: "LOAD INTO FREE PRACTICE?",
    body: `This replaces the code and circuit in Free Practice with ${label}. Anything there now that you haven't saved as a version will be lost.`,
    confirmLabel: "Load It",
  });
  if (!yes) return;
  practicePanel.stopRun();
  switchView("practice");
  practicePanel.editor.setValue(code ?? "void setup() {\n}\n\nvoid loop() {\n}\n");
  practicePanel.board.loadCircuit(circuit ?? { parts: [], wires: [] });
  practicePanel.editor.refresh();
  setStatus(`Loaded ${label} into Free Practice.`);
}

function downloadPortfolio() {
  const blob = new Blob([exportPortfolio(portfolio)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `arduino-tutor-portfolio-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Portfolio backup downloaded - keep the file somewhere safe.");
}

function restorePortfolio() {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const incoming = parsePortfolioFile(await file.text());
    if (!incoming) { setStatus("That file isn't an Arduino Tutor portfolio backup."); return; }
    const count = Object.keys(incoming.entries).length;
    const yes = await confirmDialog({
      title: "RESTORE FROM BACKUP?",
      body: `The backup has ${count} record${count === 1 ? "" : "s"}. They're ADDED to your portfolio - nothing you have now is overwritten; if a record exists in both and differs, the backup's copy is kept alongside, marked "imported copy".`,
      confirmLabel: "Restore",
    });
    if (!yes) return;
    const r = importPortfolio(portfolio, incoming);
    persistPortfolio();
    setStatus(`Restored: ${r.added} added, ${r.kept} kept as imported copies, ${r.same} already here.`);
    renderPortfolioView();
  });
  input.click();
}

function renderPortfolioView() {
  const ctx = {
    portfolio, progress, projects: [...BEGINNER_PROJECTS, ...PATHWAY_PROJECTS],
    persist: persistPortfolio, getPracticeWork: practiceWork, loadIntoPractice, setStatus,
    exportFile: downloadPortfolio, importFile: restorePortfolio,
    onOpenProject: (id) => { currentProjectId = id; switchView("projects"); },
  };
  renderPortfolio(portfolioPanelEl, ctx, portfolioState, renderPortfolioView);
  replayFadeIn(portfolioPanelEl);
}

// ---- engineering pathways (pathways/) ----
let pathwaysState = { view: "overview" };

function renderPathwaysView() {
  renderPathways(pathwaysPanelEl, progress, pathwaysState, {
    onOverview: () => { pathwaysState = { view: "overview" }; renderPathwaysView(); },
    onOpenPathway: (id) => { pathwaysState = { view: "pathway", pathwayId: id }; renderPathwaysView(); },
    onOpenLesson: (id) => openPathwayLesson(id),
    onOpenCoreLesson: goToLesson,
    onOpenProject: (id) => {
      const project = pathwayProjectById(id);
      projectReturn = project?.pathway ?? null;
      currentProjectId = id;
      switchView("projects");
    },
    onQuizResult: (quizId, success, topic, detail, quizBox, lesson) => {
      const before = rewards.snapshot();
      progress = recordQuizResult(progress, quizId, success, topic, detail);
      progress = startPathway(progress, lesson.pathway, pathwayById(lesson.pathway).title);
      if (success) rewards.settle(before, { kind: "quiz" });
      else playSfx("wrong");
      const right = (detail?.answers ?? []).filter(([, r]) => r).length;
      renderFeedback(quizBox.parentElement, [
        { kind: success ? "good" : "work", text: `${right} of ${detail?.answers?.length ?? 1} right first time.` },
        ...(success ? [] : [{ kind: "work", text: "The ones you missed come back in your revision sessions - and the level only counts once this checkpoint is answered right. Try the set again when you're ready." }]),
      ]);
      afterLearning();
    },
    onMarkDone: (lesson) => {
      const before = rewards.snapshot();
      progress = markPathwayLessonDone(progress, lesson.pathway, lesson.id, lesson.title);
      rewards.settle(before, { kind: "lesson", label: lesson.title });
      afterLearning();
      setStatus(`"${lesson.title}" marked as done.${progress.quizzes[lesson.quiz.id]?.solved ? "" : " Answer its checkpoint right too - the level needs both."}`);
      renderPathwaysView();
    },
    onClaimCertificate: (id) => {
      if (!pathwayStatus(id, progress).complete) return;
      progress = awardPathwayCertificate(progress, id, pathwayById(id).title);
      playSfx("mission");
      afterLearning();
      pathwaysState = { view: "certificate", pathwayId: id };
      renderPathwaysView();
    },
    onViewCertificate: (id) => { pathwaysState = { view: "certificate", pathwayId: id }; renderPathwaysView(); },
  });
  pathwaysPanelEl.scrollTop = 0;
  replayFadeIn(pathwaysPanelEl);
}

async function openPathwayLesson(id, { confirm = true } = {}) {
  const lesson = pathwayLessonById(id);
  if (!lesson) return;
  if (confirm && !(progress.pathways?.[lesson.pathway]?.lessonsDone ?? []).includes(id) && !(await confirmPathwayLesson(lesson, progress))) return;
  progress = startPathway(progress, lesson.pathway, pathwayById(lesson.pathway).title);
  pathwaysState = { view: "lesson", lessonId: id, pathwayId: lesson.pathway };
  if (currentView !== "pathways") switchView("pathways");
  else renderPathwaysView();
  setStatus(`Viewing: ${lesson.title}`);
}

function renderMapView() {
  renderWorldMap(mapPanelEl, progress, {
    onOpenLesson: (lessonId) => {
      switchView("lessons");
      openLesson(lessonId);
    },
    onPoke: handlePoke,
  });
}

// The Progress page: what you've learned first (progressView.js), then the
// rewards side - rank, missions, trophies, and the way to the shop and map.
function renderDashboardView({ refresh = false } = {}) {
  const top = dashboardPanelEl.scrollTop;
  dashboardPanelEl.innerHTML = "";
  const learningEl = document.createElement("div");
  const rewardsHead = document.createElement("div");
  rewardsHead.className = "rewards-head";
  const rewardsTitle = document.createElement("h2");
  rewardsTitle.className = "dashboard-section-title";
  rewardsTitle.textContent = "Rewards, missions and trophies";
  const shopBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-secondary", textContent: "Parts Shop" });
  shopBtn.addEventListener("click", () => switchView("shop"));
  const mapBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn btn-secondary", textContent: "World Map" });
  mapBtn.addEventListener("click", () => switchView("map"));
  rewardsHead.append(rewardsTitle, shopBtn, mapBtn);
  const rewardsEl = document.createElement("div");
  dashboardPanelEl.append(learningEl, rewardsHead, rewardsEl);
  renderLearningProgress(learningEl, progress, {
    onOpenLesson: goToLesson,
    onOpenChallenge: openChallenge,
    onOpenProject: (id) => { currentProjectId = id; switchView("projects"); },
    onOpenPathway: (id, lessonId) => {
      if (lessonId) openPathwayLesson(lessonId);
      else { pathwaysState = { view: "pathway", pathwayId: id }; switchView("pathways"); }
    },
    onRevise: startRevision,
    onAskTutor: () => askTutor(),
    onSetGoal: (id) => {
      const goal = goalById(id);
      progress = setGoal(progress, id, goal?.baseline?.(progress) ?? null);
      setStatus(`Goal set: "${goal?.title}". Its progress bar moves as you learn.`);
      renderDashboardView({ refresh: true });
    },
    onRemoveGoal: (id) => {
      progress = removeGoal(progress, id);
      renderDashboardView({ refresh: true });
    },
  });
  renderDashboard(rewardsEl, progress, {
    refresh,
    onReviewTopic: (lessonId) => {
      switchView("lessons");
      openLesson(lessonId);
    },
    onClaimMission: claimMissionReward,
    onClaimChest: claimBonusChest,
    onChangeAvatar: () => switchView("shop"),
    onPoke: handlePoke,
  });
  dashboardPanelEl.scrollTop = top;
}

// ---- personalised learning: revision, goals, the tutor ----

// A revision session (progressView.openRevisionSession). A question from a
// set is recorded on its own; a one-piece checkpoint (order, debug...) is
// recorded like any attempt. Once every question of a set has been put right,
// the set itself counts as solved.
function startRevision(area = null) {
  openRevisionSession(progress, area, {
    onAnswer: (item, quizId, success, topic, detail) => {
      const before = rewards.snapshot();
      if (item.quiz) {
        progress = recordQuizResult(progress, quizId, success, topic, detail);
      } else {
        for (const [key, right] of detail?.answers ?? [[item.key, success]]) progress = recordAnswer(progress, key, right);
        const set = item.quizId ? QUESTION_BANK.filter((i) => i.quizId === item.quizId) : [];
        if (set.length && !progress.quizzes[item.quizId]?.solved && set.every((i) => progress.answers[i.key]?.last)) {
          progress = recordQuizResult(progress, item.quizId, true, item.topic, { answers: [] });
        }
      }
      if (success) rewards.settle(before, { kind: "quiz" });
    },
    onDone: (doneArea, right, total) => {
      progress = recordRevisionSession(progress, doneArea, right, total);
      afterLearning();
      setStatus(`Revision session finished: ${right} of ${total} right first time.`);
      if (currentView === "dashboard") renderDashboardView({ refresh: true });
    },
    onOpenLesson: goToLesson,
  });
}

// After anything that can move a skill level: goals that have now been
// reached are saved (once) and announced, and trophies re-checked.
function afterLearning() {
  const report = masteryReport(progress);
  const reached = newlyReached(progress, report);
  if (reached.length) {
    progress = markGoalsDone(progress, reached, Object.fromEntries(reached.map((id) => [id, goalById(id)?.title])));
    for (const id of reached) {
      playSfx("mission");
      showToast({ iconHtml: icon("flag", 3), title: "GOAL REACHED", text: goalById(id)?.title ?? id, kind: "mission", duration: 5000 });
    }
  }
  rewards.checkAchievements();
}

// Opens a lesson and scrolls to its challenge.
async function openChallenge(lessonId) {
  await goToLesson(lessonId);
  if (currentLessonId === lessonId) setTimeout(() => challengeSectionEl.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

// The tutor can read the workspace on screen: a lesson's editor and board,
// or Free Practice's. Elsewhere it answers from the course alone.
function tutorContext() {
  if (currentView === "practice") {
    return { where: "practice", code: practicePanel.editor.getValue(), findings: practicePanel.board.inspectCircuit().findings, lastError: lastErrors.practice };
  }
  if (currentView === "lessons" && !editorSectionEl.hidden) {
    return { where: "lessons", lessonId: currentLessonId, code: editor.getValue(), findings: lessonsPanel.board?.inspectCircuit().findings ?? null, lastError: lastErrors.lessons };
  }
  return { where: currentView };
}

function askTutor(question = null) {
  const lesson = currentView === "lessons" ? findLesson(currentLessonId) : null;
  const suggestions = [];
  if (lastErrors[currentView === "practice" ? "practice" : "lessons"] && (currentView === "practice" || currentView === "lessons")) suggestions.push("What does this error mean?");
  if (lesson?.title) suggestions.push(`What is ${lesson.title.replace(/^(What is|What are)\s+/i, "").replace(/\?$/, "").toLowerCase()}?`);
  openTutor({ getContext: tutorContext, onOpenLesson: goToLesson, suggestions, initialQuestion: question });
}
document.getElementById("hud-tutor").addEventListener("click", () => { if (appStarted) askTutor(); });

// ---- daily missions ----

function claimMissionReward(mission, btn) {
  const at = centerOf(btn);
  if (!claimMission(progress, mission.id, mission.reward)) return;
  playSfx("coin");
  floatText(at, `${icon("coin", 2)} +${mission.reward}`, { kind: "coin" });
  coinShower(at, 8);
  hud.update(progress);
  hud.setProfileBadge(pendingRewardCount(progress));
  rewards.checkAchievements();
  renderDashboardView({ refresh: true });
}

async function claimBonusChest() {
  if (!claimDailyChest(progress, CHEST_REWARD)) return;
  hud.holdCoins(CHEST_REWARD); // the chest is about to reveal these
  hud.setProfileBadge(pendingRewardCount(progress));
  renderDashboardView({ refresh: true }); // the chest already shows as collected behind the window
  await openChest({
    title: "DAILY BONUS CHEST",
    subtitle: "You cleared today's whole mission board. Nice shift!",
    reward: CHEST_REWARD,
  });
  hud.releaseCoins();
  rewards.checkAchievements();
}

// ---- the shop ----

let shopLine = null; // what Volt is currently saying (null = a random greeting)
let previewTheme = null; // a theme being tried on but not owned/equipped

function renderShopView(line) {
  if (line !== undefined) shopLine = line;
  const top = shopPanelEl.scrollTop;
  renderShop(
    shopPanelEl,
    progress,
    { onBuy: buyItem, onEquip: equipFromShop, onTry: startThemePreview, onStopTry: () => { endThemePreview(); renderShopView(); } },
    { line: shopLine, previewing: previewTheme }
  );
  shopPanelEl.scrollTop = top;
}

function startThemePreview(themeId) {
  previewTheme = themeId;
  applyTheme(themeId);
  playSfx("equip");
  renderShopView();
}

// Puts the equipped theme back (used on "Stop Preview" and when leaving the shop).
function endThemePreview() {
  if (previewTheme === null) return;
  previewTheme = null;
  applyTheme(progress.equipped.theme);
}

function buyItem(slot, id, price) {
  const key = itemKey(slot, id);
  const item = getShopItem(key);
  if (!item) return;
  if (progress.credits < price) {
    playSfx("error");
    renderShopView(getBrokeLine(price));
    shake(shopPanelEl.querySelector(".shop-wallet"));
    return;
  }
  if (!purchaseItem(progress, key, price)) return;
  playSfx("purchase");
  equipItem(progress, slot, id); // you'll want to wear it right away
  previewTheme = null;
  if (slot === "theme") applyTheme(id);
  hud.update(progress);
  floatText(hud.els.coins, `${icon("coin", 2)} -${price}`, { kind: "spend" });
  rewards.checkAchievements();
  renderShopView(getPurchaseLine(item.name));
}

function equipFromShop(slot, id) {
  if (!equipItem(progress, slot, id)) return;
  previewTheme = null;
  if (slot === "theme") applyTheme(id);
  playSfx("equip");
  hud.update(progress);
  renderShopView("Looking good. Wear it well.");
}

// =========================================================================
// Lessons
// =========================================================================

// A level-up, a promotion or a plain "nice work" - whichever is the biggest
// news gets Sam's line.
function reactionFor(result, fallbackText) {
  if (result.rankUp) return { text: getPromotionLine(result.rankUp.to.name), tag: "Promoted!", mood: "happy" };
  if (result.levelUp) {
    return {
      text: getLevelUpLine(result.levelUp.level, result.levelUp.isMilestone, result.levelUp.bonus),
      tag: "Level Up!",
      mood: "happy",
    };
  }
  return { text: fallbackText, tag: "Nice work", mood: "happy" };
}

function openLesson(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson) return;
  currentLessonId = lessonId;

  // Note: opening/viewing a lesson does NOT mark it complete - completion is
  // only recorded when the learner explicitly clicks "Mark Lesson as Done"
  // below, so the sidebar/progress reflect real understanding, not just clicks.
  progress.lastLessonId = lessonId;
  saveProgress(progress);

  const isCompleted = progress.viewedLessons.includes(lessonId);
  const isFlagged = progress.flaggedLessons.includes(lessonId);
  const challenge = getChallengeForLesson(lesson);
  const challengeSolved = challenge ? progress.completedChallenges.includes(challenge.id) : false;
  bossActive = challenge?.difficulty === "boss" && !challengeSolved;

  const sectionCount = renderLesson(lessonContentEl, lesson, isCompleted, isFlagged, progress);
  renderMentorBox(
    mentorBoxEl,
    bossActive
      ? { text: getBossIntroLine(), tag: "Boss Ahead!", mood: "surprised", onPoke: handlePoke }
      : { text: getLessonIntroLine(lesson), tag: "Quest Briefing", onPoke: handlePoke }
  );
  setActiveSidebarLink(sidebarEl, lessonId);
  closeSidebarDrawer(); // on mobile, picking a lesson should close the slide-in drawer

  renderChallenge(challengeSectionEl, challenge, {
    alreadySolved: challengeSolved,
    // "Check My Solution" checks the code in this lesson's editor and the
    // circuit on this lesson's board.
    getCode: () => editor.getValue(),
    getFindings: () => lessonsPanel.board?.inspectCircuit().findings ?? null,
    onCheckError: (err) => editor.markErrorLine(err.line),
    onCheck: (challengeId, passed) => {
      progress = recordCheck(progress, challengeId, passed, challenge?.title, lessonId);
      renderNextStep(nextStepEl, lesson, progress);
      const entry = progress.checks[challengeId];
      if (passed || entry.attempts >= 2) {
        const report = masteryReport(progress);
        renderFeedback(challengeSectionEl, feedbackFor(progress, report, {
          lessonId, challenge: { passed, title: challenge.title, independent: entry.independent, attempts: entry.attempts },
        }, passed ? recommendations(progress, { report, limit: 1 }) : []));
      }
      if (passed) afterLearning();
    },
    onComplete: (challengeId, { at, isBoss } = {}) => {
      const firstTime = !progress.completedChallenges.includes(challengeId);
      const before = rewards.snapshot();
      progress = markChallengeCompleted(progress, challengeId);
      if (isBoss && firstTime) progress = incrementStat(progress, "bossesDefeated");
      const result = rewards.settle(before, { kind: "challenge", at, label: challenge.title, skipBanner: isBoss }); // a boss has its own victory banner
      if (currentLessonId !== lessonId) return; // you've moved on to another lesson mid-fight
      if (isBoss) {
        bossActive = false;
        updateMusic();
      }
      renderMentorBox(
        mentorBoxEl,
        reactionFor(result, isBoss ? getBossDefeatLine() : getChallengeCompleteLine())
      );
      setStatus(
        !firstTime
          ? `"${challenge.title}" was already solved - no extra credits this time.`
          : isBoss
            ? `Boss defeated: "${challenge.title}". +${result.gained} credits!`
            : `Challenge "${challenge.title}" solved - every check passed! +${result.gained} credits!`
      );
    },
    onSpend: (cost, label, { challengeId, isSolution, at } = {}) => {
      const wasInDebt = progress.credits < 0;
      progress = spendCredits(progress, cost);
      progress = recordHintUse(progress, challengeId, isSolution);
      rewards.spent(cost, at);
      setStatus(`${label} revealed. -${cost} credits.`);
      if (!wasInDebt && progress.credits < 0) {
        renderMentorBox(mentorBoxEl, { text: getDebtLine(), tag: "Payroll", mood: "sad", onPoke: handlePoke });
      }
    },
  });

  // The practice editor and circuit board only matter when THIS lesson has
  // something to actually build - a purely conceptual lesson (no challenge)
  // doesn't need an empty code editor sitting underneath it. A run already
  // in progress keeps running in the background either way (editor.js/board.js
  // are shared singletons, not recreated per lesson) - it's just not shown
  // while you're reading a lesson that doesn't need it.
  // Hands-on lessons (a guided activity or a starter circuit) show it too.
  const handsOn = !!challenge || lesson.body.some((b) => b.type === "guided" || b.type === "circuit");
  editorSectionEl.hidden = !handsOn;
  simulatorSectionEl.hidden = !handsOn;
  if (handsOn) editor.refresh(); // CodeMirror needs this after being unhidden to size itself correctly
  // A beginner's board only offers the parts the course has introduced so
  // far (Free Practice always has every part).
  lessonsPanel.setParts(moduleParts(lesson.module));

  // The template carries on below the lesson text: the challenge and the
  // checkpoint get the next section numbers.
  let sectionNumber = sectionCount;
  if (challenge) challengeSectionEl.prepend(sectionHeading(++sectionNumber, "challenge"));

  const quiz = getQuizForLesson(lessonId);
  quizSectionEl.innerHTML = "";
  if (quiz) {
    // its own box, so "Try again" re-deals the quiz without the heading
    const quizBoxEl = document.createElement("div");
    quizSectionEl.appendChild(quizBoxEl);
    renderQuiz(quizBoxEl, quiz, (quizId, success, topic, detail) => {
      // Checked BEFORE recording, since recordQuizResult only pays out credits
      // the first time a quiz flips to solved - re-answering an
      // already-solved quiz (e.g. revisiting the lesson) correctly earns
      // nothing again, and the status message should say so honestly.
      const alreadySolved = progress.quizzes[quizId]?.solved;
      const before = rewards.snapshot();
      progress = recordQuizResult(progress, quizId, success, topic, detail);
      renderNextStep(nextStepEl, lesson, progress);
      // what this result shows, from the profile - after the quiz's own result
      const report = masteryReport(progress);
      renderFeedback(quizSectionEl, feedbackFor(progress, report, {
        lessonId, answers: detail?.answers ?? [[`${quizId}#0`, success]],
      }, recommendations(progress, { report, limit: 1 })));
      afterLearning();
      if (!success) {
        playSfx("wrong");
        shake(quizSectionEl);
        setStatus(`Quiz attempt recorded - not quite right yet ("${topic}").`);
        return;
      }
      if (alreadySolved) {
        playSfx("correct");
        setStatus(`Quiz correct! ("${topic}")`);
        return;
      }
      const result = rewards.settle(before, { kind: "quiz" });
      setStatus(`Quiz correct! ("${topic}") +${result.gained} credits!`);
      // A quiz normally doesn't touch the mentor box at all (that stays
      // scoped to lessons/challenges) - a level-up is the one exception,
      // since it's a bigger moment than a routine correct answer.
      if (result.levelUp || result.rankUp) renderMentorBox(mentorBoxEl, reactionFor(result, ""));
    });
    quizSectionEl.prepend(sectionHeading(++sectionNumber, "checkpoint"));
  }
  renderNextStep(nextStepEl, lesson, progress);

  // wire up the prev/next/complete buttons that renderLesson just created
  lessonContentEl.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
    const prevId = getAdjacentLessonId(lessonId, "prev");
    if (prevId) openLesson(prevId);
  });
  lessonContentEl.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    const nextId = getAdjacentLessonId(lessonId, "next");
    if (nextId) openLesson(nextId);
  });
  lessonContentEl.querySelector('[data-action="complete"]')?.addEventListener("click", (e) => {
    const at = centerOf(e.currentTarget); // before the re-render below replaces this button
    const alreadyDone = progress.viewedLessons.includes(lessonId);
    const before = rewards.snapshot();
    progress = markLessonViewed(progress, lessonId);
    renderSidebar(sidebarEl, progress, openLesson); // re-render so the "done" dot updates
    openLesson(lessonId); // re-render this lesson so the button flips to "Completed"
    // openLesson() above sets its own "Viewing: ..." status text and its own
    // lesson-intro mentor line, which would instantly overwrite these if set
    // beforehand - set them AFTER instead so the completion reaction is
    // actually what's left on screen.
    const result = rewards.settle(before, { kind: "lesson", at, label: lesson.title });
    afterLearning();
    setStatus(
      alreadyDone
        ? `"${lesson.title}" marked as done.`
        : `"${lesson.title}" marked as done. +${result.gained} credits!`
    );
    if (!alreadyDone) renderMentorBox(mentorBoxEl, reactionFor(result, getLessonCompleteLine()));
    // straight to the next step, rather than back to the top of the lesson
    nextStepEl.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  // A lighter-weight update than the complete button above: flagging is
  // purely cosmetic bookkeeping, not a state change that affects credits,
  // XP, or the rest of the lesson - so this updates the button and sidebar
  // directly instead of re-running openLesson(), which would also restart
  // the fade-in, retype Sam's line, and reset scroll position for no reason.
  lessonContentEl.querySelector('[data-action="toggle-flag"]')?.addEventListener("click", (e) => {
    const nowFlagged = !progress.flaggedLessons.includes(lessonId);
    const before = rewards.snapshot();
    progress = toggleLessonFlag(progress, lessonId);
    if (nowFlagged) progress = bumpDailyCounter(progress, "flagged");
    setFlagButton(e.currentTarget, nowFlagged);
    playSfx(nowFlagged ? "toggleOn" : "toggleOff");
    renderSidebar(sidebarEl, progress, openLesson); // updates the flag icon in the Quest Log
    setActiveSidebarLink(sidebarEl, lessonId); // renderSidebar rebuilds the list, so the active highlight needs reapplying
    if (nowFlagged) rewards.settle(before, { kind: "flag" }); // may complete a "flag a lesson" mission
    setStatus(
      nowFlagged
        ? `"${lesson.title}" flagged for review - you'll see it in the sidebar and on your Progress page.`
        : `"${lesson.title}" unflagged.`
    );
  });

  setStatus(`Viewing: ${lesson.title}`);
  window.scrollTo({ top: 0 });
  // Scrolls .main-panel itself back to its top rather than scrolling
  // lessonContentEl into view - the mentor box now sits above it as the
  // first child, and scrolling THAT element into view would push Sam's
  // line straight back off-screen on every lesson change.
  mainPanelEl.scrollTo({ top: 0 });
  replayFadeIn(mainPanelEl);
  updateMusic();
}

// =========================================================================
// Options, shortcuts and easter eggs
// =========================================================================

function openOptions() {
  openSettings({
    getSaveCode: () => exportSaveCode(progress),
    previewImport: (text) => {
      const parsed = parseSaveCode(text);
      if (!parsed) return { ok: false };
      const level = getLevelInfo(parsed.xp).level;
      return {
        ok: true,
        summary: `${parsed.playerName || "an unnamed player"} — level ${level}, ${parsed.viewedLessons.length} lessons done, ${parsed.credits} credits`,
      };
    },
    applyImport: (text) => {
      const parsed = parseSaveCode(text);
      if (!parsed) return;
      saveProgress(parsed);
      location.reload();
    },
    resetAll: () => {
      resetProgress();
      location.reload();
    },
    onHelp: () => openHelp(),
  });
}

// Opens a lesson from the course page, a "What's next" card, a review link...
// If its prerequisites aren't done it says so first - a warning, not a wall.
async function goToLesson(lessonId) {
  if (pathwayLessonById(lessonId)) return openPathwayLesson(lessonId);
  const lesson = findLesson(lessonId);
  if (!lesson) return;
  const missing = missingNeeds(lesson, progress);
  if (missing.length && !progress.viewedLessons.includes(lessonId)) {
    const yes = await confirmDialog({
      title: "BEFORE YOU START",
      body: `"${lesson.title}" builds on ${missing.map((l) => `"${l.title}"`).join(" and ")}, which you haven't finished yet. You can open it anyway - it may just be harder to follow.`,
      confirmLabel: "Open Anyway",
      cancelLabel: "Not Yet",
    });
    if (!yes) return;
  }
  switchView("lessons");
  openLesson(lessonId);
}

function stepLesson(direction) {
  if (currentView !== "lessons" || !currentLessonId) return;
  const id = getAdjacentLessonId(currentLessonId, direction);
  if (id) openLesson(id);
}

installShortcuts({
  active: () => appStarted,
  tab: (i) => {
    const view = VIEW_ORDER[i];
    if (!view) return;
    playSfx("select");
    switchView(view);
  },
  help: () => openHelp(),
  tutor: () => askTutor(),
  settings: () => openOptions(),
  mute: () => {
    setSetting("muted", !getSettings().muted);
    playSfx("toggleOn");
  },
  prevLesson: () => stepLesson("prev"),
  nextLesson: () => stepLesson("next"),
});

// Up up down down left right left right B A.
installKonami(() => {
  playSfx("konami");
  banner("+30 LIVES!", { kind: "good", sub: "Old school. Respect.", duration: 2400 });
  confetti({ count: 110 });
  if (getSettings().fx) {
    document.documentElement.classList.add("konami-mode");
    setTimeout(() => document.documentElement.classList.remove("konami-mode"), 4200);
  }
  if (!progress.stats.konami) {
    progress = setStat(progress, "konami", true);
    rewards.checkAchievements({ delay: 1600 });
  }
});

// =========================================================================
// Starting the game
// =========================================================================

// The actual app only boots once the main menu hands off, via onStart below -
// everything above this (editor, board, wire palette) is safe to create
// while #app-shell is still hidden, but rendering the lesson itself waits
// until there's somewhere visible to put it.
//
// target picks where you land, matching the menu's own action buttons:
// undefined/null resumes the last-viewed lesson (the default), "dashboard",
// "map" or "shop" open that screen, "first-circuit" starts the guided first
// circuit in Free Practice, and anything else is treated as a lesson
// id to jump directly into (e.g. the menu's "Review" on a flagged lesson).
const SCREEN_TARGETS = new Set(["welcome", "learn", "practice", "dashboard", "map", "shop", "first-circuit"]);

// The welcome tour (learn/welcomeTour.js): a new player's first stop, and
// the Learn page's "How this course works". It ends on the guided first LED
// build, or the course.
function showWelcomeTour() {
  progress = markOnboarded(progress);
  openWelcomeTour({
    firstCircuitDone: progress.firstCircuitDone,
    onFirstCircuit: startFirstCircuit,
    onStartCourse: () => switchView("learn"),
  });
}

function startApp(target) {
  appStarted = true;
  hud.update(progress, { animate: false });
  hud.setProfileBadge(pendingRewardCount(progress));
  renderSidebar(sidebarEl, progress, openLesson);
  const lessonTarget = target && !SCREEN_TARGETS.has(target) ? target : nextLesson(progress)?.id ?? progress.lastLessonId ?? getFirstLessonId();
  openLesson(lessonTarget);
  editor.refresh(); // was created/sized while hidden behind the menu, needs a re-measure now that it's visible
  if (target === "first-circuit") startFirstCircuit();
  else if (target === "welcome") {
    // the course is the starting point; the tour opens over it
    switchView("learn");
    setTimeout(showWelcomeTour, 400);
  } else if (SCREEN_TARGETS.has(target)) switchView(target);
  updateMusic();

  // Welcome-back flourishes, once per browser session.
  let shown = false;
  try { shown = sessionStorage.getItem("arduinoTutorWelcomed") === "1"; sessionStorage.setItem("arduinoTutorWelcomed", "1"); } catch { /* storage blocked */ }
  if (!shown && progress.streak >= 2) {
    setTimeout(() => {
      playSfx("mission");
      showToast({
        iconHtml: icon("flame", 3),
        title: `${progress.streak}-DAY STREAK`,
        text: "You keep showing up. That's how techs are made.",
        kind: "mission",
        duration: 5000,
      });
    }, 900);
  }
  // Catches anything a save from before trophies existed has already earned.
  rewards.checkAchievements({ delay: shown ? 600 : 2200 });
}

onPrediction((key, right) => { progress = recordPrediction(progress, key, right); });
onLessonQuestion((key, right) => { progress = recordAnswer(progress, key, right); });

document.getElementById("practice-to-course-btn").addEventListener("click", () => switchView("learn"));

// The logo: back to the home screen, from anywhere. Anything running stops
// first (as it would when leaving any screen); the code and circuits stay.
document.getElementById("brand-home").addEventListener("click", () => {
  if (!appStarted) return;
  lessonsPanel.stopRun();
  practicePanel.stopRun();
  pixelWipe(() => {
    appShellEl.hidden = true;
    showMenu();
  });
});

function showMenu() {
  menuScreenEl.hidden = false;
  setMusicTrack("title");
  renderMenuScreen(menuScreenEl, progress, {
    onPoke: handlePoke,
    // name is a freshly-typed string from the new-game form, or null when a
    // returning learner just clicked a button (nothing new to save then).
    onStart: (name, target, avatarId) => {
      if (name) {
        progress = setPlayerName(progress, name);
        if (avatarId) equipItem(progress, "avatar", avatarId);
        hud.update(progress, { animate: false });
      }
      pixelWipe(() => {
        menuScreenEl.hidden = true;
        appShellEl.hidden = false;
        startApp(target);
      });
    },
  });
}

runSplash({ progress, onStart: showMenu });
