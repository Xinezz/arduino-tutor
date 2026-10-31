// Priority 1: delay() waits exactly as long as asked, millis() agrees with it,
// and Stop (or starting a new run) really ends the old run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startProgram } from "../js/simulator/interpreter.js";
import { runSketch, createFakeTiming, recordingHardware } from "./helpers/sim.js";

const PRINT_MILLIS_EVERY = (ms) => `
void setup() { Serial.begin(9600); }
void loop() {
  Serial.println(millis());
  delay(${ms});
}`;

test("short delays wait exactly their duration", () => {
  const r = runSketch(PRINT_MILLIS_EVERY(100), { ms: 1000 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["0", "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000"]);
});

test("long delays are NOT shortened (the old 1.5 s cap is gone)", () => {
  const clock = createFakeTiming();
  const r = runSketch(PRINT_MILLIS_EVERY(5000), { ms: 4999, clock });
  assert.deepEqual(r.lines, ["0"], "nothing new may print before 5000 ms have passed");
  clock.advance(1);
  assert.deepEqual(r.output.split("\n").filter(Boolean), ["0", "5000"]);
  clock.advance(5000);
  assert.deepEqual(r.output.split("\n").filter(Boolean), ["0", "5000", "10000"]);
});

test("a delay that wakes up early waits out the rest, so millis() never runs short", () => {
  // A timer that fires 3 ms early (browsers are allowed to be imprecise).
  const clock = createFakeTiming();
  const sloppy = { ...clock.timing, setTimer: (fn, ms) => clock.timing.setTimer(fn, Math.max(1, ms - 3)) };
  let out = "";
  startProgram(PRINT_MILLIS_EVERY(1000), recordingHardware(clock), { onOutput: (t) => { out += t; } }, { timing: sloppy });
  clock.advance(1000);
  assert.deepEqual(out.split("\n").filter(Boolean), ["0", "1000"]);
});

test("late timers don't make millis() drift: after delay(), it's exactly that much later", () => {
  // Every timer fires 18 ms late (what the live site showed in a background
  // tab: 0, 1018, 2043 instead of 0, 1000, 2000).
  const clock = createFakeTiming();
  const late = { ...clock.timing, setTimer: (fn, ms) => clock.timing.setTimer(fn, ms + 18) };
  let out = "";
  startProgram(PRINT_MILLIS_EVERY(1000), recordingHardware(clock), { onOutput: (t) => { out += t; } }, { timing: late });
  clock.advance(3100);
  assert.deepEqual(out.split("\n").filter(Boolean), ["0", "1000", "2000", "3000"]);
});

test("millis() advances with simulated time, even in a loop with no delay()", () => {
  const r = runSketch(`
    unsigned long start;
    void setup() { Serial.begin(9600); start = millis(); }
    void loop() {
      if (millis() - start >= 250) { Serial.println("250 ms passed"); start = millis(); }
    }`, { ms: 1000 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.lines.length, 4);
});

test("Stop during a long delay: the sketch never resumes", () => {
  const clock = createFakeTiming();
  const r = runSketch(`
    void setup() { Serial.begin(9600); pinMode(13, OUTPUT); }
    void loop() {
      Serial.println("before");
      delay(5000);
      Serial.println("after");
      digitalWrite(13, HIGH);
    }`, { ms: 1000, clock });
  assert.deepEqual(r.lines, ["before"]);
  r.controller.stop();
  assert.equal(clock.pendingTimers(), 0, "stop() cancels the pending delay timer");
  clock.advance(20000);
  assert.deepEqual(r.output.split("\n").filter(Boolean), ["before"]);
  assert.ok(!r.calls.some((c) => c.name === "digitalWrite"), "no hardware calls after Stop");
});

test("a stopped run can't resume even if its timer still fires", () => {
  // Simulate a timer that can't be cancelled: the run must still refuse to resume.
  const clock = createFakeTiming();
  const leaky = { ...clock.timing, clearTimer: () => {} };
  let out = "";
  const run = startProgram(PRINT_MILLIS_EVERY(500), recordingHardware(clock), { onOutput: (t) => { out += t; } }, { timing: leaky });
  clock.advance(100);
  run.stop();
  clock.advance(2000);
  assert.deepEqual(out.split("\n").filter(Boolean), ["0"]);
});

test("restarting after Stop runs a fresh program and the old one stays dead", () => {
  const clock = createFakeTiming();
  const hw = recordingHardware(clock);
  let out = "";
  const first = startProgram(`void setup(){ Serial.begin(9600); } void loop(){ Serial.println("old"); delay(1000); }`, hw, { onOutput: (t) => { out += t; } }, { timing: clock.timing });
  clock.advance(1500);
  first.stop();
  const second = startProgram(`void setup(){ Serial.begin(9600); } void loop(){ Serial.println("new"); delay(1000); }`, hw, { onOutput: (t) => { out += t; } }, { timing: clock.timing });
  clock.advance(2500);
  second.stop();
  assert.deepEqual(out.split("\n").filter(Boolean), ["old", "old", "new", "new", "new"]);
});

test("after Stop, only the newly started run touches the board", () => {
  const clock = createFakeTiming();
  const hw = recordingHardware(clock);
  const old = startProgram(`void setup(){ pinMode(9, OUTPUT); } void loop(){ delay(300); digitalWrite(9, HIGH); }`, hw, {}, { timing: clock.timing });
  clock.advance(100);
  old.stop();
  startProgram(`void setup(){ pinMode(8, OUTPUT); } void loop(){ delay(300); digitalWrite(8, HIGH); }`, hw, {}, { timing: clock.timing });
  clock.advance(1000);
  const writes = hw.calls.filter((c) => c.name === "digitalWrite").map((c) => c.args[0]);
  assert.ok(writes.length > 0);
  assert.ok(writes.every((pin) => pin === 8), `only the new run writes pins (saw ${writes})`);
});

test("delay(0) returns immediately", () => {
  const r = runSketch(`void setup(){ Serial.begin(9600); Serial.println(millis()); delay(0); Serial.println(millis()); } void loop(){ delay(1000); }`, { ms: 5 });
  assert.deepEqual(r.lines, ["0", "0"]);
});

test("a negative delay is explained (it becomes a huge unsigned wait, like on an Uno)", () => {
  const r = runSketch(`void setup(){ delay(-100); } void loop(){ }`, { ms: 100 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /negative/);
  assert.match(r.warnings[0], /4294967196 ms/);
});

test("timeScale is an explicit fast mode: delays shrink and millis() speeds up to match", () => {
  const clock = createFakeTiming();
  const r = runSketch(PRINT_MILLIS_EVERY(1000), { ms: 499, clock, timeScale: 2 });
  assert.deepEqual(r.lines, ["0"]);
  clock.advance(1);
  assert.deepEqual(r.output.split("\n").filter(Boolean), ["0", "1000"], "after 500 real ms, the sketch saw a full 1000 ms");
});

test("a loop with no delay() keeps handing control back, so Stop always works", () => {
  const clock = createFakeTiming();
  const r = runSketch(`long n = 0; void setup(){} void loop(){ n = n + 1; }`, { ms: 50, clock });
  assert.deepEqual(r.errors, []);
  assert.equal(clock.pendingTimers(), 1, "the run is paused on a 'yield to the browser' timer, not spinning");
  r.controller.stop();
  assert.equal(clock.pendingTimers(), 0);
});
