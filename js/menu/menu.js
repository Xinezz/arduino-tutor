// Renders the main menu: the first thing a visitor sees, before the rest of
// the app appears. There's no real backend here (this is a static site with
// no server - see progress.js), so "sign in" just means picking a name,
// stored locally, used to personalize greetings - not an account in any
// real sense. This is a TEMPLATE: structure and wiring first, meant to be
// restyled once a real design lands, so the markup stays plain and the
// classes stay easy to re-skin rather than fussy or decorative.
//
// Follows the same convention as every other view module in this project:
// this file only builds DOM and reports back via onStart - app.js is the
// one that owns progress/localStorage and decides what happens next.

import { renderMentorBox, getMenuGreeting } from "../npc/mentor.js";
import { getLevelInfo } from "../progress/progress.js";

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

// onStart(name): called with a freshly-typed name when a new/updated name
// is submitted, or with null when a returning learner just clicks Continue
// (nothing to change - setPlayerName only needs calling when name is truthy).
export function renderMenuScreen(container, progress, { onStart } = {}) {
  container.innerHTML = "";

  const card = el("div", "menu-card hud-frame");
  container.appendChild(card);

  const brand = el("div", "menu-brand");
  brand.innerHTML = `${BRAND_ICON_SVG}<span>Arduino<b>Tutor</b></span>`;
  card.appendChild(brand);
  card.appendChild(el("p", "menu-tagline", "Your first day at CircuitWorks Robotics."));

  const mentorSlot = el("div", "mentor-box hud-frame menu-mentor");
  card.appendChild(mentorSlot);
  renderMentorBox(mentorSlot, {
    text: getMenuGreeting(progress.playerName),
    tag: progress.playerName ? "Welcome back" : "New Hire",
  });

  if (progress.playerName) {
    renderReturningState(card, container, progress, onStart);
  } else {
    renderFirstTimeState(card, onStart);
  }
}

function renderReturningState(card, container, progress, onStart) {
  const { level } = getLevelInfo(progress.xp);
  const summary = el("div", "menu-summary");
  summary.appendChild(el("span", null, `🎖️ Level ${level}`));
  if ((progress.streak || 0) > 1) {
    summary.appendChild(el("span", null, `🔥 ${progress.streak}-day streak`));
  }
  card.appendChild(summary);

  const continueBtn = el("button", "btn btn-complete menu-primary-btn", "Continue →");
  continueBtn.addEventListener("click", () => onStart?.(null));
  card.appendChild(continueBtn);

  const switchBtn = el("button", "menu-switch-link", `Not ${progress.playerName}? Update your name`);
  // A lightweight, non-persisted re-render into the name-entry state - only
  // actually calling setPlayerName (and overwriting the saved name) once
  // they submit a new one via onStart, not just from clicking this.
  switchBtn.addEventListener("click", () => {
    renderMenuScreen(container, { ...progress, playerName: null }, { onStart });
  });
  card.appendChild(switchBtn);
}

function renderFirstTimeState(card, onStart) {
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
