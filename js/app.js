// Entry point: wires the sidebar, lesson panel, editor, and challenge panel together.
// This is the only file that "knows about" all the other modules - each other module
// only knows about its own job (rendering lessons, running the editor, saving progress).
// That separation is what "modular design" means in practice: you can open editor.js
// without needing to understand data.js at all.

import { loadProgress, markLessonViewed, markChallengeCompleted } from "./progress/progress.js";
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

const sidebarEl = document.getElementById("sidebar");
const lessonContentEl = document.getElementById("lesson-content");
const challengeSectionEl = document.getElementById("challenge-section");
const progressSummaryEl = document.getElementById("progress-summary");
const statusTextEl = document.getElementById("status-text");
const resetCodeBtn = document.getElementById("reset-code-btn");

let progress = loadProgress();
const editor = createEditor(document.getElementById("code-editor"));

function updateProgressSummary() {
  const total = getTotalLessonCount();
  const done = progress.viewedLessons.length;
  progressSummaryEl.textContent = `Level 1 · ${done} / ${total} lessons`;
}

function openLesson(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson) return;

  progress = markLessonViewed(progress, lessonId);

  renderLesson(lessonContentEl, lesson);
  setActiveSidebarLink(sidebarEl, lessonId);
  updateProgressSummary();
  renderSidebar(sidebarEl, progress, openLesson); // re-render so the "done" dot updates

  const challenge = getChallengeForLesson(lesson);
  renderChallenge(challengeSectionEl, challenge, (challengeId) => {
    progress = markChallengeCompleted(progress, challengeId);
    statusTextEl.textContent = `Challenge "${challenge.title}" marked as solved.`;
  });

  // wire up the prev/next buttons that renderLesson just created
  lessonContentEl.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
    const prevId = getAdjacentLessonId(lessonId, "prev");
    if (prevId) openLesson(prevId);
  });
  lessonContentEl.querySelector('[data-action="next"]')?.addEventListener("click", () => {
    const nextId = getAdjacentLessonId(lessonId, "next");
    if (nextId) openLesson(nextId);
  });

  statusTextEl.textContent = `Viewing: ${lesson.title}`;
  window.scrollTo({ top: 0 });
  lessonContentEl.scrollIntoView({ block: "start" });
}

resetCodeBtn.addEventListener("click", () => {
  editor.reset();
  statusTextEl.textContent = "Editor reset to template.";
});

// initial boot
renderSidebar(sidebarEl, progress, openLesson);
openLesson(progress.lastLessonId || getFirstLessonId());
editor.refresh();
