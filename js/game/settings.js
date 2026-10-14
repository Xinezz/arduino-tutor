// Per-device comfort settings for the game layer: sound, music, and the
// visual effects. Deliberately stored apart from progress.js - progress is
// the player's save file (what they've learned, earned, bought), while these
// are preferences about how this particular screen/speaker setup should
// behave, and shouldn't travel with an exported save or get wiped by a
// progress reset.

const KEY = "arduinoTutorSettings";

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// fx covers JS-driven effects (particles, confetti, screen shake, transition
// wipes). It starts OFF for anyone whose OS asks for reduced motion - they can
// still switch it on themselves from the settings panel, but nothing flashes
// or shakes at them by default.
function defaults() {
  return {
    muted: false,
    sfxVolume: 0.7,
    musicOn: false,
    musicVolume: 0.5,
    crt: true,
    fx: !prefersReducedMotion(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    // corrupted/blocked storage - just run with defaults
  }
  return defaults();
}

let current = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // storage blocked (private mode etc.) - settings just won't persist
  }
}

export function getSettings() {
  return current;
}

export function setSetting(key, value) {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  save();
  for (const fn of listeners) fn(current, key);
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function fxEnabled() {
  return current.fx;
}
