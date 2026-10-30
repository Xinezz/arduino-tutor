// Saved progress: finishing the guided first circuit is recorded once, pays
// out once, and survives the save file round trip.
import { test } from "node:test";
import assert from "node:assert/strict";

// progress.js saves to localStorage - a tiny in-memory stand-in for Node.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadProgress, markFirstCircuitDone, exportSaveCode, parseSaveCode, CREDIT_REWARDS } = await import("../js/progress/progress.js");

test("a new save hasn't done the first circuit", () => {
  store.clear();
  assert.equal(loadProgress().firstCircuitDone, false);
});

test("finishing the first circuit pays out once, like a challenge", () => {
  store.clear();
  const p = loadProgress();
  const credits = p.credits;
  markFirstCircuitDone(p);
  assert.equal(p.firstCircuitDone, true);
  assert.equal(p.credits, credits + CREDIT_REWARDS.challenge);
  assert.equal(p.xp, CREDIT_REWARDS.challenge);
  markFirstCircuitDone(p);
  assert.equal(p.credits, credits + CREDIT_REWARDS.challenge, "replaying it earns nothing new");
  assert.equal(loadProgress().firstCircuitDone, true, "it's saved");
});

test("old saves (from before the guide existed) load with it not done", () => {
  store.clear();
  store.set("arduinoTutorProgress", JSON.stringify({ viewedLessons: ["l1-1"], credits: 40, xp: 10 }));
  const p = loadProgress();
  assert.equal(p.firstCircuitDone, false);
  assert.deepEqual(p.viewedLessons, ["l1-1"]);
});

test("the save code carries it over to another device", () => {
  store.clear();
  const p = markFirstCircuitDone(loadProgress());
  assert.equal(parseSaveCode(exportSaveCode(p)).firstCircuitDone, true);
});
