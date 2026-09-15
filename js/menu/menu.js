// Renders the main menu: the first thing a visitor sees, before the rest of
// the app appears. There's no real backend here (this is a static site with
// no server - see progress.js), so "sign in" just means picking a name,
// stored locally, used to personalize greetings - not an account in any
// real sense.
//
// Two very different screens live here: a plain name-entry form for a
// first-time visitor (still a TEMPLATE, since there's no progress to show
// yet), and a full "welcome back" dashboard-style screen once a name and
// some progress actually exist. Follows the same convention as every other
// view module in this project: this file only builds DOM and reports back
// via onStart - app.js owns progress/localStorage and decides what happens
// next. onStart(name, target): name is a freshly-typed string on the
// first-time form, or null when nothing needs saving; target is undefined
// (resume the last lesson, the default), "dashboard", or a specific lesson
// id to jump straight to.

import { renderMentorBox, getMenuGreeting } from "../npc/mentor.js";
import { getLevelInfo } from "../progress/progress.js";
import { getCurrentRank } from "../progress/ranks.js";
import { lessons } from "../lessons/data.js";
import { animateCount } from "../utils/animateCount.js";

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

export function renderMenuScreen(container, progress, { onStart } = {}) {
  if (progress.playerName) {
    renderReturningScreen(container, progress, onStart);
  } else {
    renderFirstTimeScreen(container, progress, onStart);
  }
}

// ==================== First-time visitor ====================

function renderFirstTimeScreen(container, progress, onStart) {
  container.innerHTML = "";

  const card = el("div", "menu-card hud-frame");
  container.appendChild(card);

  const brand = el("div", "menu-brand");
  brand.innerHTML = `${BRAND_ICON_SVG}<span>Arduino<b>Tutor</b></span>`;
  card.appendChild(brand);
  card.appendChild(el("p", "menu-tagline", "Your first day at CircuitWorks Robotics."));

  const mentorSlot = el("div", "mentor-box hud-frame menu-mentor");
  card.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, { text: getMenuGreeting(progress.playerName), tag: "New Hire" });

  const label = el("label", "menu-input-label", "What should Sam call you?");
  label.htmlFor = "menu-name-input";
  card.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "menu-name-input";
  input.className = "menu-name-input";
  input.maxLength = 24;
  input.placeholder = "Your name";
  card.appendChild(input);

  const startBtn = el("button", "btn btn-complete menu-primary-btn", "Start Your Shift →");
  startBtn.disabled = true;
  card.appendChild(startBtn);

  input.addEventListener("input", () => {
    startBtn.disabled = input.value.trim().length === 0;
  });

  function submit() {
    if (input.value.trim().length === 0) return;
    onStart?.(input.value);
  }
  startBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  input.focus();
}

// ==================== Returning visitor ====================

function renderReturningScreen(container, progress, onStart) {
  container.innerHTML = "";

  const page = el("div", "menu-returning");
  container.appendChild(page);

  page.appendChild(buildHeader(progress, container, onStart));

  const hero = el("div", "menu-hero");
  const lastLesson = lessons.find((l) => l.id === progress.lastLessonId);
  hero.appendChild(buildHeroText(progress, onStart));
  hero.appendChild(buildIllustration(lastLesson));
  page.appendChild(hero);

  const cardRow = el("div", "menu-card-row");
  cardRow.appendChild(buildProgressCard(progress));
  cardRow.appendChild(buildNextCard(progress, lastLesson, onStart));
  page.appendChild(cardRow);
}

function buildHeader(progress, container, onStart) {
  const header = el("div", "menu-header hud-frame");

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
  rankPill.innerHTML = `<span class="menu-rank-pill-label">CURRENT RANK</span><span class="menu-rank-pill-value">${rank.name}</span>`;
  right.appendChild(rankPill);

  const switchBtn = el("button", "btn btn-secondary menu-switch-btn", `Not ${progress.playerName}?`);
  switchBtn.title = "Update your name";
  // A lightweight, non-persisted re-render into the name-entry state - only
  // actually saving a new name once one is submitted via onStart, not just
  // from clicking this.
  switchBtn.addEventListener("click", () => {
    renderMenuScreen(container, { ...progress, playerName: null }, { onStart });
  });
  right.appendChild(switchBtn);

  header.appendChild(right);
  return header;
}

function buildHeroText(progress, onStart) {
  const heroText = el("div", "menu-hero-text");

  const mentorSlot = el("div", "mentor-box hud-frame menu-hero-mentor");
  heroText.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, { text: getMenuGreeting(progress.playerName), tag: "Welcome back" });

  heroText.appendChild(el("h1", "menu-hero-heading", `Good to have you back, ${progress.playerName}.`));
  heroText.appendChild(el(
    "p",
    "menu-hero-sub",
    "Pick up exactly where you left off, or jump straight to your progress and rank."
  ));

  const actions = el("div", "menu-hero-actions");

  const continueBtn = el("button", "menu-circle-btn menu-circle-primary", "▶");
  continueBtn.title = "Continue where you left off";
  continueBtn.setAttribute("aria-label", "Continue where you left off");
  continueBtn.addEventListener("click", () => onStart?.(null));
  actions.appendChild(continueBtn);

  const dashboardBtn = el("button", "menu-circle-btn menu-circle-secondary", "📊");
  dashboardBtn.title = "Go to your Dashboard";
  dashboardBtn.setAttribute("aria-label", "Go to your Dashboard");
  dashboardBtn.addEventListener("click", () => onStart?.(null, "dashboard"));
  actions.appendChild(dashboardBtn);

  heroText.appendChild(actions);
  return heroText;
}

// An animated "the bench is live" scene: a couple of slow-pulsing LEDs, a
// row of signal bars looping at slightly different speeds so they don't
// all move in lockstep, and a floating chip icon - all respect
// prefers-reduced-motion via CSS alone (see .menu-illustration rules), so
// there's no JS branching needed here for that.
function buildIllustration(lastLesson) {
  const box = el("div", "menu-illustration hud-frame");

  const icons = el("div", "menu-illustration-icons");
  icons.innerHTML = `
    <span class="menu-led menu-led-a"></span>
    <span class="menu-led menu-led-b"></span>
    <span class="menu-illustration-chip">${BRAND_ICON_SVG}</span>`;
  box.appendChild(icons);

  const bars = el("div", "menu-bars");
  for (let i = 0; i < 7; i++) {
    bars.appendChild(el("div", "menu-bar"));
  }
  box.appendChild(bars);

  box.appendChild(el(
    "div",
    "menu-illustration-label",
    lastLesson ? `🔧 RESUME: ${lastLesson.title}` : "🔧 READY WHEN YOU ARE"
  ));

  return box;
}

function buildStat(label, value, suffix = "") {
  const wrap = el("div", "menu-stat");
  wrap.appendChild(el("div", "menu-stat-label", label));
  const valueEl = el("div", "menu-stat-value");
  wrap.appendChild(valueEl);
  animateCount(valueEl, value, suffix);
  return wrap;
}

function buildProgressCard(progress) {
  const card = el("div", "menu-stat-card hud-frame");
  card.appendChild(el("div", "menu-card-eyebrow", "📋 YOUR FILE"));
  card.appendChild(el("div", "menu-card-heading", "Progress Summary"));

  const { level, xpIntoLevel, xpForLevel, pct } = getLevelInfo(progress.xp);
  const row = el("div", "menu-stat-row");
  row.appendChild(buildStat("LEVEL", level));
  row.appendChild(buildStat("XP", progress.xp));
  row.appendChild(buildStat("🔥 STREAK", progress.streak || 0));
  card.appendChild(row);

  const track = el("div", "menu-stat-bar-track");
  const fill = el("div", "menu-stat-bar-fill");
  track.appendChild(fill);
  card.appendChild(track);
  // Starts at 0 width and animates to the real value on the next frame -
  // the same "force a fresh transition" trick used elsewhere in this app
  // (see replayFadeIn in app.js), just via rAF instead of a reflow hack
  // since this element is brand new rather than reused.
  requestAnimationFrame(() => { fill.style.width = `${pct}%`; });

  card.appendChild(el("div", "menu-card-caption", `${xpForLevel - xpIntoLevel} XP to the next level`));
  return card;
}

function buildNextCard(progress, lastLesson, onStart) {
  const card = el("div", "menu-next-card hud-frame");
  const flagged = (progress.flaggedLessons || [])
    .map((id) => lessons.find((l) => l.id === id))
    .filter(Boolean);

  if (flagged.length > 0) {
    const target = flagged[flagged.length - 1];
    card.appendChild(el("div", "menu-card-eyebrow menu-card-eyebrow-flag", "🚩 FLAGGED FOR REVIEW"));
    card.appendChild(el("div", "menu-card-heading", target.title));
    card.appendChild(el(
      "p",
      "menu-card-body",
      `You've flagged ${flagged.length} lesson${flagged.length === 1 ? "" : "s"} to revisit - this was the most recent.`
    ));
    const btn = el("button", "btn btn-hint menu-card-btn", "Review →");
    btn.addEventListener("click", () => onStart?.(null, target.id));
    card.appendChild(btn);
  } else {
    card.appendChild(el("div", "menu-card-eyebrow", "🎯 KEEP GOING"));
    card.appendChild(el("div", "menu-card-heading", lastLesson ? lastLesson.title : "Getting Started"));
    card.appendChild(el(
      "p",
      "menu-card-body",
      lastLesson
        ? "Right where you left off - pick back up whenever you're ready."
        : "Your very first lesson is waiting on the other side."
    ));
    const btn = el("button", "btn btn-complete menu-card-btn", "Continue →");
    btn.addEventListener("click", () => onStart?.(null));
    card.appendChild(btn);
  }

  return card;
}
