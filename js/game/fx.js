// Screen-juice: floating "+10" text, pixel particle bursts, confetti, screen
// shake, big announcement banners, and the blocky dissolve used between
// screens. Everything is a short-lived DOM element animated with the Web
// Animations API and removed on a plain setTimeout as a backstop - so a
// throttled/backgrounded tab (where animation frames can stall) can never
// leave stray particles stuck on screen.
//
// All of it respects the "visual effects" setting (which itself starts OFF for
// people whose OS asks for reduced motion): when off, every function here is a
// quiet no-op and the underlying information still shows up in the status bar,
// mentor box and toasts.

import { getSettings } from "./settings.js";
import { icon } from "./sprites.js";

const fxOn = () => getSettings().fx;

let layer = null;
function getLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.getElementById("fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "fx-layer";
      document.body.appendChild(layer);
    }
  }
  return layer;
}

function pointOf(target) {
  if (target && typeof target.getBoundingClientRect === "function") {
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (target && typeof target.x === "number") return target;
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function run(el, keyframes, options, extraMs = 250) {
  const anim = el.animate(keyframes, { fill: "forwards", ...options });
  const done = () => el.remove();
  anim.onfinish = done;
  setTimeout(done, (options.duration ?? 800) + (options.delay ?? 0) + extraMs);
  return anim;
}

const PIXEL_COLORS = ["#4fc3f7", "#57d38c", "#ffd23f", "#ff7a59", "#b48ce8", "#ffffff"];

// A short line of text that pops up at an element and drifts upward, like a
// damage number. `html` may contain a sprite icon.
export function floatText(target, html, { kind = "xp", rise = 48, duration = 1100, dx = 0 } = {}) {
  if (!fxOn()) return;
  const { x, y } = pointOf(target);
  const el = document.createElement("div");
  el.className = `fx-float fx-float-${kind}`;
  el.innerHTML = html;
  el.style.left = `${x + dx}px`;
  el.style.top = `${y}px`;
  getLayer().appendChild(el);
  run(el, [
    { transform: "translate(-50%, 6px) scale(0.6)", opacity: 0 },
    { transform: "translate(-50%, -4px) scale(1.15)", opacity: 1, offset: 0.14 },
    { transform: "translate(-50%, -8px) scale(1)", opacity: 1, offset: 0.7 },
    { transform: `translate(-50%, -${rise}px) scale(1)`, opacity: 0 },
  ], { duration, easing: "steps(14, end)" });
}

// A radial puff of little squares (or custom html pieces, e.g. coins).
export function burst(target, { count = 16, colors = PIXEL_COLORS, size = 6, spread = 90, duration = 850, gravity = 70, html = null } = {}) {
  if (!fxOn()) return;
  const { x, y } = pointOf(target);
  const host = getLayer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "fx-particle";
    if (html) {
      p.innerHTML = html;
    } else {
      const s = size + Math.floor(Math.random() * 3) * 2;
      p.style.width = p.style.height = `${s}px`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
    }
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    host.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = spread * (0.35 + Math.random() * 0.65);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    run(p, [
      { transform: "translate(-50%, -50%) translate(0, 0)", opacity: 1 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy - 22}px)`, opacity: 1, offset: 0.45 },
      { transform: `translate(-50%, -50%) translate(${dx * 1.15}px, ${dy + gravity}px)`, opacity: 0 },
    ], { duration: duration * (0.8 + Math.random() * 0.4), easing: "steps(10, end)" });
  }
}

// A shower of gold coins from a point.
export function coinShower(target, count = 12) {
  burst(target, { count, html: icon("coin", 2), spread: 120, gravity: 120, duration: 1100 });
}

// Pixel confetti raining across the whole screen.
export function confetti({ count = 80, duration = 2600 } = {}) {
  if (!fxOn()) return;
  const host = getLayer();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "fx-particle";
    const s = 6 + Math.floor(Math.random() * 3) * 2;
    p.style.width = p.style.height = `${s}px`;
    p.style.background = PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)];
    p.style.left = `${Math.random() * vw}px`;
    p.style.top = "-20px";
    host.appendChild(p);
    const sway = (Math.random() - 0.5) * 160;
    run(p, [
      { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${sway}px, ${vh + 40}px) rotate(${Math.random() * 540}deg)`, opacity: 1 },
    ], { duration: duration * (0.7 + Math.random() * 0.6), delay: Math.random() * 500, easing: "steps(24, end)" }, 400);
  }
}

export function shake(el, ms = 450) {
  if (!fxOn() || !el) return;
  el.classList.remove("fx-shake");
  void el.offsetWidth;
  el.classList.add("fx-shake");
  setTimeout(() => el.classList.remove("fx-shake"), ms);
}

// A quick full-screen tint (damage flash, level-up flash).
export function screenFlash(color = "rgba(255,255,255,0.5)", ms = 280) {
  if (!fxOn()) return;
  const el = document.createElement("div");
  el.className = "fx-flash";
  el.style.background = color;
  getLayer().appendChild(el);
  run(el, [{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "steps(6, end)" });
}

// Big centered announcement text ("QUEST COMPLETE!") that stamps in, holds,
// then fades.
export function banner(text, { kind = "good", duration = 1700, sub = "" } = {}) {
  if (!fxOn()) return;
  const el = document.createElement("div");
  el.className = `fx-banner fx-banner-${kind}`;
  el.innerHTML = `<div class="fx-banner-main"></div>${sub ? '<div class="fx-banner-sub"></div>' : ""}`;
  el.querySelector(".fx-banner-main").textContent = text;
  if (sub) el.querySelector(".fx-banner-sub").textContent = sub;
  getLayer().appendChild(el);
  run(el, [
    { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 },
    { transform: "translate(-50%, -50%) scale(1.18)", opacity: 1, offset: 0.12 },
    { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.2 },
    { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.78 },
    { transform: "translate(-50%, -62%) scale(1)", opacity: 0 },
  ], { duration, easing: "steps(20, end)" });
}

// Quick pop on a HUD element when its value changes.
export function bump(el) {
  if (!fxOn() || !el) return;
  el.classList.remove("fx-bump");
  void el.offsetWidth;
  el.classList.add("fx-bump");
  setTimeout(() => el.classList.remove("fx-bump"), 450);
}

// The classic diagonal block dissolve between two screens: blocks cover the
// screen (diagonally, top-left first), onMid() swaps what's underneath, then
// the blocks clear away the same way. Resolves once the screen is fully
// uncovered. With effects off it just runs onMid() straight away.
export function pixelWipe(onMid) {
  if (!fxOn()) {
    onMid?.();
    return Promise.resolve();
  }
  const cell = 76;
  const cols = Math.ceil(window.innerWidth / cell);
  const rows = Math.ceil(window.innerHeight / cell);
  const wrap = document.createElement("div");
  wrap.className = "fx-wipe";
  wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  wrap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  const step = 16;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = document.createElement("i");
      i.style.setProperty("--d", `${(x + y) * step}ms`);
      wrap.appendChild(i);
    }
  }
  document.body.appendChild(wrap);
  const cover = (cols + rows) * step + 240;
  return new Promise((resolve) => {
    requestAnimationFrame(() => wrap.classList.add("in"));
    setTimeout(() => {
      onMid?.();
      wrap.classList.remove("in");
      wrap.classList.add("out");
      setTimeout(() => {
        wrap.remove();
        resolve();
      }, cover);
    }, cover);
    // rAF can be starved in a hidden tab - make sure the cover still starts.
    setTimeout(() => wrap.classList.add("in"), 60);
  });
}

// Counts a displayed number toward a new value (coin counters, etc.) using
// setTimeout, for the same reason animateCount does: rAF stalls in background
// tabs.
const tweenIds = new WeakMap();

export function tweenNumber(el, from, to, { format = (n) => String(n), duration = 450 } = {}) {
  // A newer tween on the same element supersedes an older one still running,
  // so back-to-back rewards can't make the number flicker between two counts.
  const id = (tweenIds.get(el) ?? 0) + 1;
  tweenIds.set(el, id);
  if (!fxOn() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = Date.now();
  const tick = () => {
    if (tweenIds.get(el) !== id) return;
    const t = Math.min((Date.now() - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (t < 1) setTimeout(tick, 16);
  };
  tick();
}

// Screen position of an element's center, captured BEFORE a re-render replaces
// it (a detached element has no position, so floating rewards need this up front).
export const centerOf = pointOf;
