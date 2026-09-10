// Turns lesson data (plain objects from data.js) into DOM elements.
// Keeping this separate from data.js follows a common pattern: "data" describes
// WHAT to show, "render" decides HOW to show it. You could swap this file for a
// completely different visual style without touching a single lesson's content.

import { lessons, standaloneChallenges } from "./data.js";

const LEVEL_NAMES = {
  1: "Level 1 · Arduino Basics",
};

export function renderSidebar(container, progress, onSelect) {
  container.innerHTML = "";

  let currentLevel = null;
  for (const lesson of lessons) {
    if (lesson.level !== currentLevel) {
      currentLevel = lesson.level;
      const heading = document.createElement("div");
      heading.className = "sidebar-level";
      heading.textContent = LEVEL_NAMES[currentLevel] || `Level ${currentLevel}`;
      container.appendChild(heading);
    }

    const link = document.createElement("div");
    link.className = "lesson-link";
    if (progress.viewedLessons.includes(lesson.id)) link.classList.add("done");

    const check = document.createElement("span");
    check.className = "lesson-check";
    const label = document.createElement("span");
    label.textContent = lesson.title;

    link.appendChild(check);
    link.appendChild(label);
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

function renderBlock(block) {
  const el = document.createElement(
    block.type === "code" ? "pre" : block.type === "note" ? "div" : "p"
  );

  if (block.type === "code") {
    el.className = "code-block";
    el.textContent = block.text;
  } else if (block.type === "note") {
    el.className = "note-box";
    el.textContent = block.text;
  } else {
    el.textContent = block.text;
  }
  return el;
}

export function findLesson(lessonId) {
  return lessons.find((l) => l.id === lessonId);
}

export function renderLesson(container, lesson) {
  container.innerHTML = "";

  const eyebrow = document.createElement("div");
  eyebrow.className = "lesson-eyebrow";
  eyebrow.textContent = `Level ${lesson.level}`;
  container.appendChild(eyebrow);

  const heading = document.createElement("h1");
  heading.textContent = lesson.title;
  container.appendChild(heading);

  for (const block of lesson.body) {
    container.appendChild(renderBlock(block));
  }

  // simple prev/next navigation between lessons
  const index = lessons.findIndex((l) => l.id === lesson.id);
  const nav = document.createElement("div");
  nav.className = "lesson-nav";

  const prev = document.createElement("button");
  prev.className = "btn btn-secondary";
  prev.textContent = "← Previous";
  prev.disabled = index <= 0;
  prev.dataset.action = "prev";

  const next = document.createElement("button");
  next.className = "btn btn-primary";
  next.textContent = "Next →";
  next.disabled = index >= lessons.length - 1;
  next.dataset.action = "next";

  nav.appendChild(prev);
  nav.appendChild(next);
  container.appendChild(nav);
}

export function getAdjacentLessonId(lessonId, direction) {
  const index = lessons.findIndex((l) => l.id === lessonId);
  const targetIndex = direction === "next" ? index + 1 : index - 1;
  return lessons[targetIndex]?.id ?? null;
}

export function getChallengeForLesson(lesson) {
  return lesson.challenge || standaloneChallenges[lesson.id] || null;
}

export function getFirstLessonId() {
  return lessons[0].id;
}

export function getTotalLessonCount() {
  return lessons.length;
}
