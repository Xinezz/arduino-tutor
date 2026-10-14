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
  recordQuizResult,
  markProjectStageDone,
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
} from "./lessons/render.js";
import { renderChallenge } from "./lessons/challenge.js";
import { getQuizForLesson } from "./quiz/data.js";
import { renderQuiz } from "./quiz/quiz.js";
import { findProject } from "./projects/data.js";
import { renderProjectList, renderProjectDetail } from "./projects/projects.js";
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
} from "./npc/mentor.js";
import { renderMenuScreen } from "./menu/menu.js";
import { createSimulatorPanel } from "./simulator/panel.js";

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
  lessons: document.getElementById("view-lessons"),
  map: document.getElementById("view-map"),
  projects: document.getElementById("view-projects"),
  practice: document.getElementById("view-practice"),
  shop: document.getElementById("view-shop"),
  dashboard: document.getElementById("view-dashboard"),
};
// The order the tabs appear in - also what the number-key shortcuts index into.
const VIEW_ORDER = ["lessons", "map", "projects", "practice", "shop", "dashboard"];
const projectsPanelEl = document.getElementById("projects-panel");
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
});
const rewards = createRewardFlow({ getProgress: () => progress, hud });
hud.update(progress, { animate: false });
hud.setProfileBadge(pendingRewardCount(progress));

// Poking Sam is an easter egg with a secret trophy at the end of it.
function handlePoke() {
  progress = incrementStat(progress, "samClicks");
  if (progress.stats.samClicks >= 10) rewards.checkAchievements();
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
  onStatus: setStatus,
  onRun: handleRun,
  onRunError: () => playSfx("error"),
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
  onStatus: setStatus,
  onRun: handleRun,
  onRunError: () => playSfx("error"),
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
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  editor.refresh(); // the editor's container width just changed, so CodeMirror needs to re-measure
}
sidebarCollapseBtn.addEventListener("click", () => {
  setSidebarCollapsed(!layoutEl.classList.contains("sidebar-collapsed"));
});
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");

// =========================================================================
// Music: one tune per mood
// =========================================================================

function updateMusic() {
  setMusicTrack(currentView === "lessons" && bossActive ? "boss" : "study");
}

// =========================================================================
// Views
// =========================================================================

function switchView(viewName) {
  if (currentView === "shop" && viewName !== "shop") endThemePreview();
  currentView = viewName;
  for (const [name, el] of Object.entries(viewEls)) {
    el.hidden = name !== viewName;
  }
  viewTabsEl.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  if (viewName === "lessons") {
    editor.refresh(); // CodeMirror needs this after being hidden/shown to size itself correctly
  } else if (viewName === "practice") {
    practicePanel.editor.refresh(); // same deal - was hidden, needs to re-measure now that it's visible
  } else if (viewName === "projects") {
    renderProjectsView();
  } else if (viewName === "map") {
    renderMapView();
    focusCurrentNode(mapPanelEl);
  } else if (viewName === "shop") {
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

function renderProjectsView() {
  if (currentProjectId) {
    const project = findProject(currentProjectId);
    renderProjectDetail(projectsPanelEl, project, progress, {
      onBack: () => { currentProjectId = null; renderProjectsView(); },
      onStageComplete: (projectId, stageId, { at } = {}) => {
        const before = rewards.snapshot();
        progress = markProjectStageDone(progress, projectId, stageId);
        const result = rewards.settle(before, { kind: "stage", at });
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
    });
  }
  replayFadeIn(projectsPanelEl);
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

function renderDashboardView({ refresh = false } = {}) {
  const top = dashboardPanelEl.scrollTop;
  renderDashboard(dashboardPanelEl, progress, {
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

  renderLesson(lessonContentEl, lesson, isCompleted, isFlagged);
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
    onComplete: (challengeId, { at, isBoss } = {}) => {
      const firstTime = !progress.completedChallenges.includes(challengeId);
      const before = rewards.snapshot();
      progress = markChallengeCompleted(progress, challengeId);
      if (isBoss && firstTime) progress = incrementStat(progress, "bossesDefeated");
      const result = rewards.settle(before, { kind: "challenge", at });
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
            : `Challenge "${challenge.title}" marked as solved. +${result.gained} credits!`
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
      const before = rewards.snapshot();
      progress = recordQuizResult(progress, quizId, success, topic);
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
    const result = rewards.settle(before, { kind: "lesson", at });
    setStatus(
      alreadyDone
        ? `"${lesson.title}" marked as done.`
        : `"${lesson.title}" marked as done. +${result.gained} credits!`
    );
    if (!alreadyDone) renderMentorBox(mentorBoxEl, reactionFor(result, getLessonCompleteLine()));
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
        ? `"${lesson.title}" flagged for review - you'll see it in the sidebar and on your Profile.`
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
// "map" or "shop" open that screen, and anything else is treated as a lesson
// id to jump directly into (e.g. the menu's "Review" on a flagged lesson).
const SCREEN_TARGETS = new Set(["dashboard", "map", "shop"]);

function startApp(target) {
  appStarted = true;
  hud.update(progress, { animate: false });
  hud.setProfileBadge(pendingRewardCount(progress));
  renderSidebar(sidebarEl, progress, openLesson);
  const lessonTarget = target && !SCREEN_TARGETS.has(target) ? target : progress.lastLessonId || getFirstLessonId();
  openLesson(lessonTarget);
  editor.refresh(); // was created/sized while hidden behind the menu, needs a re-measure now that it's visible
  if (SCREEN_TARGETS.has(target)) switchView(target);
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
