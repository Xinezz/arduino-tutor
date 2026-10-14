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
// undefined (resume the last lesson, the default), "dashboard", "map", "shop",
// or a specific lesson id to jump straight to; avatarId is the character the
// player picked on the new-game form.

import { renderMentorBox, getMenuGreeting } from "../npc/mentor.js";
import { getLevelInfo } from "../progress/progress.js";
import { getCurrentRank } from "../progress/ranks.js";
import { lessons } from "../lessons/data.js";
import { animateCount } from "../utils/animateCount.js";
import { icon } from "../game/sprites.js";
import { AVATARS, itemKey, avatarSpriteName } from "../game/shop.js";
import { getDailyBoard } from "../game/missions.js";
import { playSfx } from "../game/audio.js";

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

function renderFirstTimeScreen(container, progress, onStart, onPoke) {
  container.innerHTML = "";

  const card = el("div", "menu-card hud-frame");
  container.appendChild(card);

  const brand = el("div", "menu-brand");
  brand.innerHTML = `${BRAND_ICON_SVG}<span>Arduino<b>Tutor</b></span>`;
  card.appendChild(brand);
  card.appendChild(el("p", "menu-tagline", "Your first day at CircuitWorks Robotics."));

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

  const startBtn = el("button", "btn btn-complete menu-primary-btn", "Start Your Shift");
  startBtn.disabled = true;
  startBtn.dataset.sfx = "none";
  card.appendChild(startBtn);

  input.addEventListener("input", () => {
    startBtn.disabled = input.value.trim().length === 0;
  });

  function submit() {
    if (input.value.trim().length === 0) return;
    playSfx("confirm");
    onStart?.(input.value, undefined, avatarId);
  }
  startBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  input.focus();
}

// ==================== Returning visitor ====================

function renderReturningScreen(container, progress, onStart, onPoke) {
  container.innerHTML = "";

  const page = el("div", "menu-returning");
  container.appendChild(page);

  page.appendChild(buildHeader(progress, container, onStart, onPoke));

  const hero = el("div", "menu-hero");
  const lastLesson = lessons.find((l) => l.id === progress.lastLessonId);
  hero.appendChild(buildHeroText(progress, onStart, onPoke));
  hero.appendChild(buildIllustration(progress, lastLesson));
  page.appendChild(hero);

  const cardRow = el("div", "menu-card-row");
  cardRow.appendChild(buildProgressCard(progress));
  cardRow.appendChild(buildNextCard(progress, lastLesson, onStart));
  cardRow.appendChild(buildMissionsCard(progress, onStart));
  page.appendChild(cardRow);
}

function buildHeader(progress, container, onStart, onPoke) {
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
  rankPill.innerHTML = `<span class="menu-rank-pill-label">CURRENT RANK</span><span class="menu-rank-pill-value"></span>`;
  rankPill.querySelector(".menu-rank-pill-value").textContent = rank.name;
  right.appendChild(rankPill);

  const switchBtn = el("button", "btn btn-secondary menu-switch-btn", `Not ${progress.playerName}?`);
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

// One of the big round buttons: an icon, with a caption under it.
function circleButton({ sprite, label, kind, onClick, badge }) {
  const wrap = el("div", "menu-action");
  const btn = el("button", `menu-circle-btn menu-circle-${kind}`);
  btn.type = "button";
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = icon(sprite, 3);
  btn.addEventListener("click", onClick);
  if (badge) {
    const b = el("span", "menu-action-badge", String(badge));
    btn.appendChild(b);
  }
  wrap.appendChild(btn);
  wrap.appendChild(el("div", "menu-action-label", label));
  return wrap;
}

function buildHeroText(progress, onStart, onPoke) {
  const heroText = el("div", "menu-hero-text");

  const mentorSlot = el("div", "mentor-box hud-frame menu-hero-mentor");
  heroText.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, { text: getMenuGreeting(progress.playerName), tag: "Welcome back", mood: "happy", onPoke });

  heroText.appendChild(el("h1", "menu-hero-heading", `Good to have you back, ${progress.playerName}.`));
  heroText.appendChild(el(
    "p",
    "menu-hero-sub",
    "Pick up exactly where you left off, or jump straight to the map, the shop, or your profile."
  ));

  const board = getDailyBoard(progress);
  const pending = board.claimable.length + (board.chestReady ? 1 : 0);

  const actions = el("div", "menu-hero-actions");
  actions.appendChild(circleButton({ sprite: "play", label: "Continue", kind: "primary", onClick: () => onStart?.(null) }));
  actions.appendChild(circleButton({ sprite: "map", label: "World Map", kind: "secondary", onClick: () => onStart?.(null, "map") }));
  actions.appendChild(circleButton({ sprite: "bag", label: "Shop", kind: "secondary", onClick: () => onStart?.(null, "shop") }));
  actions.appendChild(circleButton({ sprite: "person", label: "Profile", kind: "secondary", badge: pending || null, onClick: () => onStart?.(null, "dashboard") }));
  heroText.appendChild(actions);
  return heroText;
}

// An animated "the bench is live" scene: a couple of slow-pulsing LEDs, a
// row of signal bars looping at slightly different speeds so they don't
// all move in lockstep, and your character standing on the bench - all
// respect prefers-reduced-motion via CSS alone (see .menu-illustration rules),
// so there's no JS branching needed here for that.
function buildIllustration(progress, lastLesson) {
  const box = el("div", "menu-illustration hud-frame");

  const icons = el("div", "menu-illustration-icons");
  icons.innerHTML = `
    <span class="menu-led menu-led-a"></span>
    <span class="menu-led menu-led-b"></span>
    <span class="menu-illustration-chip">${icon(avatarSpriteName(progress.equipped?.avatar), 6)}</span>`;
  box.appendChild(icons);

  const bars = el("div", "menu-bars");
  for (let i = 0; i < 7; i++) {
    bars.appendChild(el("div", "menu-bar"));
  }
  box.appendChild(bars);

  const label = el("div", "menu-illustration-label");
  label.innerHTML = icon("led", 1);
  label.appendChild(document.createTextNode(lastLesson ? ` RESUME: ${lastLesson.title}` : " READY WHEN YOU ARE"));
  box.appendChild(label);

  return box;
}

function buildStat(label, value, suffix = "", spriteName = null) {
  const wrap = el("div", "menu-stat");
  const labelEl = el("div", "menu-stat-label");
  if (spriteName) labelEl.innerHTML = icon(spriteName, 1);
  labelEl.appendChild(document.createTextNode(spriteName ? ` ${label}` : label));
  wrap.appendChild(labelEl);
  const valueEl = el("div", "menu-stat-value");
  wrap.appendChild(valueEl);
  animateCount(valueEl, value, suffix);
  return wrap;
}

function buildProgressCard(progress) {
  const card = el("div", "menu-stat-card hud-frame");
  const eyebrow = el("div", "menu-card-eyebrow");
  eyebrow.innerHTML = icon("scroll", 1);
  eyebrow.appendChild(document.createTextNode(" YOUR FILE"));
  card.appendChild(eyebrow);
  card.appendChild(el("div", "menu-card-heading", "Progress Summary"));

  const { level, xpIntoLevel, xpForLevel, pct } = getLevelInfo(progress.xp);
  const row = el("div", "menu-stat-row");
  row.appendChild(buildStat("LEVEL", level));
  row.appendChild(buildStat("XP", progress.xp));
  row.appendChild(buildStat("STREAK", progress.streak || 0, "", "flame"));
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
  setTimeout(() => { fill.style.width = `${pct}%`; }, 60); // rAF can be starved in a hidden tab

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
    const eyebrow = el("div", "menu-card-eyebrow menu-card-eyebrow-flag");
    eyebrow.innerHTML = icon("flag", 1);
    eyebrow.appendChild(document.createTextNode(" FLAGGED FOR REVIEW"));
    card.appendChild(eyebrow);
    card.appendChild(el("div", "menu-card-heading", target.title));
    card.appendChild(el(
      "p",
      "menu-card-body",
      `You've flagged ${flagged.length} lesson${flagged.length === 1 ? "" : "s"} to revisit - this was the most recent.`
    ));
    const btn = el("button", "btn btn-hint menu-card-btn", "Review");
    btn.addEventListener("click", () => onStart?.(null, target.id));
    card.appendChild(btn);
  } else {
    const eyebrow = el("div", "menu-card-eyebrow");
    eyebrow.innerHTML = icon("target", 1);
    eyebrow.appendChild(document.createTextNode(" KEEP GOING"));
    card.appendChild(eyebrow);
    card.appendChild(el("div", "menu-card-heading", lastLesson ? lastLesson.title : "Getting Started"));
    card.appendChild(el(
      "p",
      "menu-card-body",
      lastLesson
        ? "Right where you left off - pick back up whenever you're ready."
        : "Your very first lesson is waiting on the other side."
    ));
    const btn = el("button", "btn btn-complete menu-card-btn", "Continue");
    btn.addEventListener("click", () => onStart?.(null));
    card.appendChild(btn);
  }

  return card;
}

function buildMissionsCard(progress, onStart) {
  const board = getDailyBoard(progress);
  const card = el("div", "menu-missions-card hud-frame");
  const eyebrow = el("div", "menu-card-eyebrow");
  eyebrow.innerHTML = icon("calendar", 1);
  eyebrow.appendChild(document.createTextNode(" DAILY MISSIONS"));
  card.appendChild(eyebrow);

  const list = el("div", "menu-mission-list");
  for (const m of board.missions) {
    const row = el("div", `menu-mission${m.claimed ? " is-claimed" : m.done ? " is-ready" : ""}`);
    row.innerHTML = `${icon(m.claimed ? "check" : m.icon, 2)}<span class="menu-mission-name"></span><span class="menu-mission-count"></span>`;
    row.querySelector(".menu-mission-name").textContent = m.name;
    row.querySelector(".menu-mission-count").textContent = m.claimed ? "DONE" : m.done ? "READY!" : `${m.have}/${m.target}`;
    list.appendChild(row);
  }
  card.appendChild(list);

  const pending = board.claimable.length + (board.chestReady ? 1 : 0);
  const btn = el(
    "button",
    `btn menu-card-btn ${pending ? "btn-complete" : "btn-hint"}`,
    pending ? `Claim Rewards (${pending})` : "View Missions"
  );
  btn.addEventListener("click", () => onStart?.(null, "dashboard"));
  card.appendChild(btn);
  return card;
}
