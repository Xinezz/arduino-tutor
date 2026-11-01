// Phase 8 regressions: a tampered or damaged save can never stop the app
// starting or silently destroy data; failed saves are reported; unsupported
// libraries are named as the simulator's limit; every theme meets WCAG AA
// contrast for text.

import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
let failWrites = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (failWrites) { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; } store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
};
const P = await import("../js/progress/progress.js");
const { simulate } = await import("../js/simulator/headless.js");
const { THEMES } = await import("../js/game/shop.js");

test("a tampered save has every single value coerced to a safe type", () => {
  store.clear();
  store.set("arduinoTutorProgress", JSON.stringify({
    playerName: { x: 1 }, lastLessonId: 42, streak: -3, xp: -10, onboarded: "yes",
    equipped: { theme: 5, avatar: "ghost" }, stats: { runs: "lots", konami: "true" },
    daily: { date: "x", counters: null, claimed: "y" }, achievements: { a: 5, b: "2026-01-01" },
    hintUses: { c1: "two" }, checks: { c1: "x" }, quizzes: { q: 1 }, inventory: [1, "theme:gold"],
  }));
  const p = P.loadProgress();
  assert.equal(p.playerName, null);
  assert.equal(p.lastLessonId, null);
  assert.equal(p.streak, 0);
  assert.equal(p.xp, 0);
  assert.equal(p.onboarded, false);
  assert.equal(p.equipped.theme, "default");
  assert.equal(p.equipped.avatar, "ghost", "an unknown string is kept - the shop falls back for unknown ids");
  assert.equal(p.stats.runs, 0);
  assert.equal(p.stats.konami, false);
  assert.deepEqual(p.daily.claimed, []);
  assert.equal(typeof p.daily.counters.lessons, "number");
  assert.deepEqual(p.achievements, { b: "2026-01-01" });
  assert.deepEqual(p.hintUses, {});
  assert.deepEqual(p.checks, {});
  assert.deepEqual(p.quizzes, {});
  assert.ok(p.inventory.includes("theme:gold") && !p.inventory.includes(1));
  // a long name is trimmed, not rejected
  store.set("arduinoTutorProgress", JSON.stringify({ playerName: `  ${"n".repeat(80)}  ` }));
  assert.equal(P.loadProgress().playerName.length, 40);
});

test("an unreadable save is kept aside, never silently overwritten", () => {
  store.clear();
  const broken = '{"viewedLessons":["l1-1"], BROKEN';
  store.set("arduinoTutorProgress", broken);
  const p = P.loadProgress();
  assert.deepEqual(p.viewedLessons, []);
  assert.equal(P.storageStatus.loadProblem, "corrupt");
  assert.equal(store.get(P.storageStatus.backupKey), broken);
  P.saveProgress(p);
  assert.equal(store.get(P.storageStatus.backupKey), broken, "still there after the fresh save");
});

test("a failed save is reported once, and cleared when saving works again", () => {
  store.clear();
  P.storageStatus.saveProblem = null;
  const heard = [];
  P.onSaveProblem((kind) => heard.push(kind));
  const p = P.loadProgress();
  failWrites = true;
  P.saveProgress(p);
  P.saveProgress(p);
  failWrites = false;
  assert.deepEqual(heard, ["QuotaExceededError"], "told once, not on every save");
  P.saveProgress(p);
  assert.equal(P.storageStatus.saveProblem, null);
});

test("an unsupported library is named as the simulator's limit, not a spelling mistake", () => {
  const r = simulate("#include <Wire.h>\nvoid setup() { Wire.begin(); }\nvoid loop() {}", { ms: 10 });
  assert.match(r.errors[0], /Wire library isn't supported in this simulator/);
  assert.equal(r.errorDetails[0].kind, "unsupported");
  for (const ok of ["<Servo.h>", "<LiquidCrystal.h>", "<Arduino.h>", "\"math.h\""]) {
    assert.deepEqual(simulate(`#include ${ok}\nvoid setup() {}\nvoid loop() {}`, { ms: 10 }).errors, [], ok);
  }
});

test("every theme meets WCAG AA (4.5:1) for its text colours", () => {
  // the default theme as css/system.css defines it (shop themes override these)
  const base = { "--bg": "#0b0f19", "--panel": "#141a26", "--panel-alt": "#1b2232", "--text": "#e6e9f0", "--text-dim": "#a1a9bd", "--accent": "#4fc3f7", "--green": "#57d38c", "--yellow": "#e8c547", "--red": "#ef6461", "--purple": "#b48ce8", "--code-bg": "#0a0d16", "--code-text": "#8ff0a4", "--on-accent": "#06202b", "--on-green": "#06301b", "--on-yellow": "#3a2c02" };
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [["--text", "--bg"], ["--text", "--panel"], ["--text-dim", "--panel"], ["--text-dim", "--panel-alt"], ["--accent", "--panel"], ["--green", "--panel"], ["--yellow", "--panel"], ["--red", "--panel"], ["--purple", "--panel"], ["--code-text", "--code-bg"], ["--on-accent", "--accent"], ["--on-green", "--green"], ["--on-yellow", "--yellow"]];
  for (const t of THEMES) {
    const v = { ...base, ...t.vars };
    for (const [f, b] of pairs) assert.ok(ratio(v[f], v[b]) >= 4.5, `${t.id}: ${f} on ${b} is ${ratio(v[f], v[b]).toFixed(2)}:1`);
  }
});
