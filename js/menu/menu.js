// Renders the main menu: the first thing a visitor sees after the title
// screen, before the rest of the app appears. There's no real backend here
// (this is a static site with no server - see progress.js), so "sign in" just
// means picking a name and a character, stored locally, used to personalize
// greetings - not an account in any real sense.
//
// Two very different screens live here: a "new game" form for a first-time
// visitor (name + pick your character), and a full "welcome back" menu once a
// name and some progress actually exist. Follows the same convention as every
// other view module in this project: this file only builds DOM and reports
// back via onStart - app.js owns progress/localStorage and decides what
// happens next. onStart(name, target, avatarId): name is a freshly-typed
// string on the new-game form, or null when nothing needs saving; target is
// undefined (resume the last lesson, the default), "welcome" (a new player:
// the welcome tour), "learn", "practice", "dashboard", "map", "shop",
// "first-circuit" (the guided first build), or a specific lesson id to jump
// straight to; avatarId is the character the
// player picked on the new-game form.

import { renderMentorBox, getMenuGreeting } from "../npc/mentor.js";
import { getLevelInfo } from "../progress/progress.js";
import { getCurrentRank } from "../progress/ranks.js";
import { lessons } from "../lessons/data.js";
import { icon } from "../game/sprites.js";
import { AVATARS, itemKey, avatarSpriteName } from "../game/shop.js";
import { getDailyBoard } from "../game/missions.js";
import { playSfx } from "../game/audio.js";
import { nextLesson, lessonPosition } from "../progress/learning.js";
import { recommendations } from "../progress/recommend.js";
import { ACHIEVEMENT_MAP } from "../game/achievements.js";
import { BEGINNER_PROJECTS } from "../projects/beginner.js";
import { PATHWAY_PROJECTS } from "../pathways/data.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const BRAND_ICON_SVG = `
<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
  <path d="M9 6V2M12 6V2M15 6V2M9 22v-4M12 22v-4M15 22v-4M6 9H2M6 12H2M6 15H2M22 9h-4M22 12h-4M22 15h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

export function renderMenuScreen(container, progress, { onStart, onPoke } = {}) {
  if (progress.playerName) {
    renderReturningScreen(container, progress, onStart, onPoke);
  } else {
    renderFirstTimeScreen(container, progress, onStart, onPoke);
  }
}

// ==================== New game ====================

// Only the avatars that are free from the start can be picked here; the rest
// are bought in the shop.
function buildAvatarPicker(progress, initialId, onChange) {
  const wrap = el("div", "avatar-picker");
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", "Choose your character");
  const owned = new Set(progress.inventory ?? []);
  const options = AVATARS.filter((a) => owned.has(itemKey("avatar", a.id)));
  const buttons = [];
  for (const a of options) {
    const b = el("button", "avatar-option");
    b.type = "button";
    b.dataset.sfx = "select";
    b.setAttribute("role", "radio");
    b.title = a.name;
    b.innerHTML = `${icon(avatarSpriteName(a.id), 5)}<span class="avatar-option-name"></span>`;
    b.querySelector(".avatar-option-name").textContent = a.name;
    const select = () => {
      buttons.forEach((x) => {
        const on = x === b;
        x.classList.toggle("is-selected", on);
        x.setAttribute("aria-checked", String(on));
      });
      onChange(a.id);
    };
    b.addEventListener("click", select);
    buttons.push(b);
    wrap.appendChild(b);
    if (a.id === initialId) b.classList.add("is-selected");
    b.setAttribute("aria-checked", String(a.id === initialId));
  }
  return wrap;
}

// What a first-time visitor needs to know before signing in: what this is,
// who it's for, what they'll be able to do, and how to begin. Every number
// here is the real one from the course data.
function buildIntro() {
  const intro = el("section", "menu-intro");
  intro.setAttribute("aria-labelledby", "menu-intro-title");
  intro.appendChild(el("div", "menu-intro-eyebrow", "LEARN ELECTRONICS · CODE · ENGINEERING"));
  const h1 = el("h1", "menu-intro-title", "Learn Arduino from your very first LED to projects of your own.");
  h1.id = "menu-intro-title";
  intro.appendChild(h1);
  intro.appendChild(el("p", "menu-intro-lead",
    "A step-by-step course for complete beginners. Learn how circuits work, write real Arduino code, and build on a virtual Arduino right here in your browser - no hardware, no installs, no experience needed."));
  const points = el("ul", "menu-intro-points");
  const moduleCount = new Set(lessons.map((l) => l.module)).size;
  for (const [sprite, title, text] of [
    ["book", `${lessons.length} short lessons in ${moduleCount} modules`, "From what electricity is, through code, to sensors, motors and your own projects - each lesson builds on the last."],
    ["chip", "A simulator that checks your work", "Wire the parts, run your code, and see it work - with plain-English help when something's wrong."],
    ["trophy", "Projects you design yourself", "Checked projects, engineering pathways, and a portfolio of what you've built."],
  ]) {
    const li = el("li", "menu-intro-point");
    const ico = el("span", "menu-intro-icon");
    ico.innerHTML = icon(sprite, 3);
    const body = el("div");
    body.append(el("strong", null, title), el("span", null, text));
    li.append(ico, body);
    points.appendChild(li);
  }
  intro.appendChild(points);
  const steps = el("ol", "menu-intro-steps");
  steps.setAttribute("aria-label", "How to begin");
  for (const s of ["Pick a name", "Take the one-minute tour", "Build your first LED circuit"]) steps.appendChild(el("li", null, s));
  intro.appendChild(steps);
  return intro;
}

function renderFirstTimeScreen(container, progress, onStart, onPoke) {
  container.innerHTML = "";

  const layout = el("div", "menu-first");
  container.appendChild(layout);
  layout.appendChild(buildIntro());
  const card = el("div", "menu-card hud-frame");
  layout.appendChild(card);

  const brand = el("div", "menu-brand");
  brand.innerHTML = `${BRAND_ICON_SVG}<span>Arduino<b>Tutor</b></span>`;
  card.appendChild(brand);
  card.appendChild(el("p", "menu-tagline", "Your first day at CircuitWorks Robotics - Sam will show you around."));

  const mentorSlot = el("div", "mentor-box hud-frame menu-mentor");
  card.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, { text: getMenuGreeting(progress.playerName), tag: "New Hire", mood: "happy", onPoke });

  const label = el("label", "menu-input-label", "What should Sam call you?");
  label.htmlFor = "menu-name-input";
  card.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "menu-name-input";
  input.className = "menu-name-input";
  input.maxLength = 24;
  input.placeholder = "Your name";
  input.autocomplete = "off";
  card.appendChild(input);

  let avatarId = progress.equipped?.avatar ?? "rookie";
  card.appendChild(el("div", "menu-input-label", "Pick your character"));
  card.appendChild(buildAvatarPicker(progress, avatarId, (id) => { avatarId = id; }));

  // One way in: a new player gets the short welcome tour first (what
  // Arduino Tutor is, what an Arduino is, how the simulator and the course
  // work), which ends by offering the guided first LED build.
  const startBtn = el("button", "btn btn-complete menu-primary-btn", "Start");
  startBtn.title = "A one-minute tour of how this works, then your first guided LED build.";
  startBtn.disabled = true;
  startBtn.dataset.sfx = "none";
  card.appendChild(startBtn);
  const startNote = el("p", "menu-start-note", "Type your name first. No experience or hardware needed - everything is explained from the beginning.");
  card.appendChild(startNote);

  input.addEventListener("input", () => {
    const empty = input.value.trim().length === 0;
    startBtn.disabled = empty;
    startNote.textContent = empty
      ? "Type your name first. No experience or hardware needed - everything is explained from the beginning."
      : "No experience or hardware needed - everything is explained from the beginning.";
  });

  function submit() {
    if (input.value.trim().length === 0) {
      input.focus();
      return;
    }
    playSfx("confirm");
    onStart?.(input.value, "welcome", avatarId);
  }
  startBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  input.focus();
}

// ==================== Returning visitor ====================
// A dashboard with one obvious next action. In order of importance:
// welcome, CONTINUE LEARNING (the big card), then smaller supporting cards -
// progress, the recommended activity (with its reason), recently completed,
// current projects, achievements - and quick links to every section.

function renderReturningScreen(container, progress, onStart, onPoke) {
  container.innerHTML = "";

  const page = el("div", "menu-returning");
  container.appendChild(page);
  page.appendChild(buildHeader(progress, container, onStart, onPoke));

  const upNext = nextLesson(progress);
  const home = el("div", "menu-home");
  const main = el("div", "menu-home-main");
  main.appendChild(buildWelcome(progress, onPoke));
  main.appendChild(buildContinueCard(progress, upNext, onStart));
  main.appendChild(buildQuickLinks(onStart));
  const side = el("div", "menu-home-side");
  side.append(
    buildProgressCard(progress),
    ...[buildRecommendedCard(progress, upNext, onStart), buildRecentCard(progress, onStart), buildProjectsCard(progress, onStart), buildAchievementsCard(progress, onStart)].filter(Boolean),
  );
  home.append(main, side);
  page.appendChild(home);
}

function buildHeader(progress, container, onStart, onPoke) {
  const header = el("div", "menu-header");

  const brandBlock = el("div", "menu-header-brand");
  brandBlock.innerHTML = `${BRAND_ICON_SVG}
    <div>
      <div class="menu-header-title">Arduino<b>Tutor</b></div>
      <div class="menu-header-tagline">BUILD · CODE · DEBUG</div>
    </div>`;
  header.appendChild(brandBlock);

  const right = el("div", "menu-header-right");
  const rank = getCurrentRank(progress);
  const rankPill = el("div", "menu-rank-pill");
  rankPill.innerHTML = `<span class="menu-rank-pill-label">RANK</span><span class="menu-rank-pill-value"></span>`;
  rankPill.querySelector(".menu-rank-pill-value").textContent = rank.name;
  right.appendChild(rankPill);

  const switchBtn = el("button", "btn btn-secondary btn-small menu-switch-btn", `Not ${progress.playerName}?`);
  switchBtn.title = "Update your name";
  // A lightweight, non-persisted re-render into the name-entry state - only
  // actually saving a new name once one is submitted via onStart, not just
  // from clicking this.
  switchBtn.addEventListener("click", () => {
    renderMenuScreen(container, { ...progress, playerName: null }, { onStart, onPoke });
  });
  right.appendChild(switchBtn);

  header.appendChild(right);
  return header;
}

function buildWelcome(progress, onPoke) {
  const box = el("div", "menu-welcome");
  box.appendChild(el("h1", "menu-welcome-title", `Welcome back, ${progress.playerName}.`));
  const mentorSlot = el("div", "mentor-box menu-hero-mentor");
  box.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, { text: getMenuGreeting(progress.playerName), tag: "Your mentor", mood: "happy", onPoke });
  return box;
}

function buildContinueCard(progress, upNext, onStart) {
  const card = el("section", "menu-continue hud-frame");
  card.setAttribute("aria-labelledby", "menu-continue-title");
  card.appendChild(el("div", "menu-card-eyebrow", "CONTINUE LEARNING"));
  if (!upNext) {
    const h2 = el("h2", "menu-continue-title", "You've finished every lesson");
    h2.id = "menu-continue-title";
    card.appendChild(h2);
    card.appendChild(el("p", "menu-continue-why", "Build a project, take an engineering pathway, or plan something of your own."));
    const row = el("div", "menu-continue-actions");
    row.append(button("Open the projects", "btn btn-primary btn-large", () => onStart?.(null, "projects")),
      button("Engineering pathways", "btn btn-secondary btn-large", () => onStart?.(null, "pathways")));
    card.appendChild(row);
    return card;
  }
  const inModule = lessons.filter((l) => l.module === upNext.module);
  const doneInModule = inModule.filter((l) => progress.viewedLessons.includes(l.id)).length;
  const pos = lessonPosition(upNext);
  card.appendChild(el("div", "menu-continue-module", `Module ${upNext.module} · lesson ${pos.index} of ${pos.count}`));
  const h2 = el("h2", "menu-continue-title", `${pos.label} ${upNext.title}`);
  h2.id = "menu-continue-title";
  card.appendChild(h2);
  if (upNext.why) card.appendChild(el("p", "menu-continue-why", upNext.why));
  const bar = el("div", "menu-continue-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", `Module ${upNext.module} progress`);
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(inModule.length));
  bar.setAttribute("aria-valuenow", String(doneInModule));
  const fill = el("span", "menu-continue-fill");
  fill.style.width = `${(doneInModule / inModule.length) * 100}%`;
  bar.appendChild(fill);
  card.appendChild(bar);
  card.appendChild(el("div", "menu-continue-meta", `${doneInModule} of ${inModule.length} lessons done in this module`));
  const row = el("div", "menu-continue-actions");
  const go = button("Continue lesson", "btn btn-primary btn-large", () => onStart?.(null));
  go.dataset.sfx = "confirm";
  row.appendChild(go);
  if (!progress.firstCircuitDone) row.appendChild(button("Build your first LED (10 min)", "btn btn-secondary btn-large", () => onStart?.(null, "first-circuit")));
  row.appendChild(button("Course overview", "btn btn-secondary btn-large", () => onStart?.(null, "learn")));
  card.appendChild(row);
  return card;
}

function buildQuickLinks(onStart) {
  const nav = el("nav", "menu-quick");
  nav.setAttribute("aria-label", "Go to");
  for (const [sprite, label, target, hint] of [
    ["chip", "Projects", "projects", "Bigger builds, checked step by step"],
    ["flag", "Pathways", "pathways", "Engineering beyond the core course"],
    ["led", "Practice", "practice", "The editor and every part, no lesson"],
    ["person", "Progress", "dashboard", "What you've learned and what to revise"],
    ["scroll", "Portfolio", "portfolio", "Your projects, code and notes"],
  ]) {
    const b = el("button", "menu-quick-link");
    b.type = "button";
    b.innerHTML = icon(sprite, 2);
    const text = el("span", "menu-quick-text");
    text.append(el("strong", null, label), el("span", null, hint));
    b.appendChild(text);
    b.addEventListener("click", () => onStart?.(null, target));
    nav.appendChild(b);
  }
  return nav;
}

function sideCard(eyebrow, title) {
  const card = el("section", "menu-side-card");
  card.appendChild(el("div", "menu-card-eyebrow", eyebrow));
  if (title) card.appendChild(el("h2", "menu-side-title", title));
  return card;
}

function buildProgressCard(progress) {
  const done = lessons.filter((l) => progress.viewedLessons.includes(l.id)).length;
  const card = sideCard("YOUR PROGRESS", `${done} of ${lessons.length} lessons`);
  const bar = el("div", "menu-continue-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Course progress");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(lessons.length));
  bar.setAttribute("aria-valuenow", String(done));
  const fill = el("span", "menu-continue-fill");
  fill.style.width = `${(done / lessons.length) * 100}%`;
  bar.appendChild(fill);
  card.appendChild(bar);
  const { level, xpIntoLevel, xpForLevel } = getLevelInfo(progress.xp);
  const stats = el("dl", "menu-side-stats");
  for (const [k, v] of [["Level", String(level)], ["To next level", `${xpForLevel - xpIntoLevel} XP`], ["Streak", `${progress.streak || 0} day${progress.streak === 1 ? "" : "s"}`]]) {
    const d = el("div");
    d.append(el("dt", null, k), el("dd", null, v));
    stats.appendChild(d);
  }
  card.appendChild(stats);
  return card;
}

const actionTarget = (action) => ({ lesson: action.id, challenge: action.id, revise: "dashboard", project: "projects", pathway: "pathways" }[action.type] ?? "dashboard");

function buildRecommendedCard(progress, upNext, onStart) {
  // the continue card already covers "the next lesson" - show the next-best reason instead
  const rec = recommendations(progress, { limit: 4 }).find((r) => !(r.action.type === "lesson" && r.action.id === upNext?.id));
  if (!rec) return null;
  const card = sideCard("RECOMMENDED FOR YOU", rec.title);
  card.appendChild(el("p", "menu-side-text", rec.why));
  card.appendChild(button("Go", "btn btn-hint btn-small", () => onStart?.(null, actionTarget(rec.action))));
  return card;
}

function buildRecentCard(progress, onStart) {
  const recent = [...progress.viewedLessons].reverse().map((id) => lessons.find((l) => l.id === id)).filter(Boolean).slice(0, 3);
  if (!recent.length) return null;
  const card = sideCard("RECENTLY COMPLETED");
  const ul = el("ul", "menu-side-list");
  for (const l of recent) {
    const li = el("li");
    const b = el("button", "menu-side-link", `${lessonPosition(l).label} ${l.title}`);
    b.type = "button";
    b.title = "Open this lesson again";
    b.addEventListener("click", () => onStart?.(null, l.id));
    li.append(el("span", "menu-side-tick", "✔"), b);
    ul.appendChild(li);
  }
  card.appendChild(ul);
  return card;
}

function buildProjectsCard(progress, onStart) {
  const all = [...BEGINNER_PROJECTS, ...PATHWAY_PROJECTS];
  const started = all.filter((p) => {
    const e = progress.projects?.[p.id];
    return e && (e.stagesDone?.length || e.checks?.attempts) && !Object.keys(e.completed ?? {}).length;
  });
  const completed = all.filter((p) => Object.keys(progress.projects?.[p.id]?.completed ?? {}).length);
  if (!started.length && !completed.length) return null;
  const card = sideCard("YOUR PROJECTS");
  const ul = el("ul", "menu-side-list");
  for (const p of started.slice(0, 2)) ul.appendChild(Object.assign(el("li"), { textContent: `◐ ${p.title} - in progress` }));
  for (const p of completed.slice(0, 3 - Math.min(2, started.length))) ul.appendChild(Object.assign(el("li"), { textContent: `✔ ${p.title} - completed` }));
  card.appendChild(ul);
  card.appendChild(button("Open projects", "btn btn-hint btn-small", () => onStart?.(null, "projects")));
  return card;
}

function buildAchievementsCard(progress, onStart) {
  const latest = Object.entries(progress.achievements ?? {})
    .filter(([id]) => ACHIEVEMENT_MAP[id]).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 2);
  const board = getDailyBoard(progress);
  const missionsDone = board.missions.filter((m) => m.done || m.claimed).length;
  const pending = board.claimable.length + (board.chestReady ? 1 : 0);
  const card = sideCard("ACHIEVEMENTS");
  const ul = el("ul", "menu-side-list");
  for (const [id] of latest) ul.appendChild(Object.assign(el("li"), { textContent: `★ ${ACHIEVEMENT_MAP[id].name} - ${ACHIEVEMENT_MAP[id].desc}` }));
  ul.appendChild(Object.assign(el("li"), { textContent: `Daily missions: ${missionsDone} of ${board.missions.length} done${pending ? ` · ${pending} reward${pending === 1 ? "" : "s"} to collect` : ""}` }));
  card.appendChild(ul);
  card.appendChild(button(pending ? `Collect rewards (${pending})` : "Trophies and missions", pending ? "btn btn-complete btn-small" : "btn btn-hint btn-small", () => onStart?.(null, "dashboard")));
  return card;
}

function button(text, className, onClick) {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
