// One-time "game chrome" wiring that doesn't belong to any single screen:
// the pixel mouse cursors, the CRT overlay, unlocking audio on the first
// click, the little click sound on every button, keyboard shortcuts, and the
// Konami code.

import { spriteDataUri } from "./sprites.js";
import { unlockAudio, playSfx } from "./audio.js";
import { getSettings, onSettingsChange } from "./settings.js";
import { modalOpen } from "./modal.js";

// ------------------------------------------------------------------ cursors
// A cursor image needs a hotspot (the pixel that actually "points") and a
// fallback keyword; both are baked into the variable so style rules can just
// say `cursor: var(--cursor-arrow)`.
export function installCursors() {
  const root = document.documentElement;
  const arrow = spriteDataUri("arrow", 2);
  const hand = spriteDataUri("hand", 2);
  if (arrow) root.style.setProperty("--cursor-arrow", `${arrow} 0 0, auto`);
  if (hand) root.style.setProperty("--cursor-hand", `${hand} 9 0, pointer`);
}

// A little pixel chip in the browser tab instead of a generic page icon.
export function installFavicon() {
  const uri = spriteDataUri("chip", 4);
  if (!uri) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = uri.slice(5, -2); // unwrap url("...")
}

// ---------------------------------------------------------------------- CRT
export function installCrt() {
  let overlay = document.getElementById("crt-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "crt-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }
  const sync = () => document.documentElement.classList.toggle("crt-on", !!getSettings().crt);
  sync();
  onSettingsChange((_s, key) => { if (key === "crt") sync(); });
}

// -------------------------------------------------------------------- audio
// Browsers only allow sound after a real user gesture, so the first click,
// key press or touch anywhere unlocks it (and every later one just makes sure
// it's still running).
export function installAudioUnlock() {
  const go = () => unlockAudio();
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, go, { capture: true, passive: true });
  }
}

// A short tick on any button-ish thing. Elements opt out with data-sfx="none"
// (they play something better themselves) or pick another sound with
// data-sfx="select".
const CLICKABLE = "button, a[href], .lesson-link, .project-card, .map-node, .quiz-option, .quiz-match-item, .shop-card, .toast, [role='button'], [role='tab']";
export function installUiSounds() {
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target.closest?.(CLICKABLE);
      if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
      const sfx = target.dataset.sfx;
      if (sfx === "none") return;
      playSfx(sfx || "click");
    },
    true
  );
}

// ---------------------------------------------------------------- shortcuts
function typingTarget(el) {
  if (!el || !el.closest) return false;
  return !!el.closest("input, textarea, select, [contenteditable='true'], .CodeMirror");
}

// handlers: { active(): bool, tab(index), help(), settings(), mute(), prevLesson(), nextLesson() }
export function installShortcuts(handlers) {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typingTarget(e.target) || modalOpen()) return;
    if (!handlers.active()) return;
    const k = e.key;
    if (k >= "1" && k <= "6") {
      handlers.tab(Number(k) - 1);
    } else if (k === "?") {
      handlers.help();
    } else if (k === "m" || k === "M") {
      handlers.mute();
    } else if (k === "s" || k === "S") {
      handlers.settings();
    } else if (k === "Escape") {
      handlers.settings(); // like a game's pause menu
    } else if (k === "[") {
      handlers.prevLesson();
    } else if (k === "]") {
      handlers.nextLesson();
    } else {
      return;
    }
    e.preventDefault();
  });
}

// ------------------------------------------------------------------- konami
const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

export function installKonami(onTrigger) {
  let buffer = [];
  document.addEventListener("keydown", (e) => {
    if (typingTarget(e.target)) return;
    buffer.push(e.key.toLowerCase());
    if (buffer.length > KONAMI.length) buffer.shift();
    if (buffer.length === KONAMI.length && KONAMI.every((k, i) => k === buffer[i])) {
      buffer = [];
      onTrigger();
    }
  });
}
