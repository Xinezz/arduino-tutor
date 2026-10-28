// Priority 5: hardware diagnostics. Warnings explain code that RUNS but
// probably doesn't do what was meant; they never stop the sketch (errors do).
import { test } from "node:test";
import assert from "node:assert/strict";
import { runSketch } from "./helpers/sim.js";

const run = (setupBody, loopBody = "delay(1000);", opts = {}) =>
  runSketch(`void setup() {\n  Serial.begin(9600);\n${setupBody}\n}\nvoid loop() {\n${loopBody}\n}`, { ms: 3000, ...opts });

test("digitalWrite() on a pin that was never set to OUTPUT warns - once, with its line", () => {
  const r = run("", "digitalWrite(13, HIGH);\ndelay(500);");
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1, "warned once, not every time loop() runs");
  assert.match(r.warnings[0], /^Line 6: digitalWrite\(13, HIGH\): pin 13 was never set up with pinMode\(13, OUTPUT\)/);
  assert.match(r.warnings[0], /weak internal pull-up/);
});

test("digitalWrite() on a pin set to INPUT warns with INPUT-specific advice", () => {
  const r = run("pinMode(7, INPUT);\ndigitalWrite(7, HIGH);");
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /pin 7 is set to INPUT, not OUTPUT/);
  assert.match(r.warnings[0], /INPUT_PULLUP/);
});

test("no warning for correct OUTPUT use (a standard blink)", () => {
  const r = runSketch(`
    void setup() { pinMode(LED_BUILTIN, OUTPUT); }
    void loop() { digitalWrite(LED_BUILTIN, HIGH); delay(500); digitalWrite(LED_BUILTIN, LOW); delay(500); }`, { ms: 3000 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  const writes = r.calls.filter((c) => c.name === "digitalWrite").map((c) => [c.t, c.args[1]]);
  assert.deepEqual(writes.slice(0, 4), [[0, 1], [500, 0], [1000, 1], [1500, 0]]);
});

test("analogWrite() on a pin without PWM warns and explains what really happens", () => {
  const r = run("pinMode(13, OUTPUT);\nanalogWrite(13, 100);");
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /pin 13 can't do PWM on an Arduino Uno - only pins 3, 5, 6, 9, 10 and 11/);
  assert.match(r.warnings[0], /fully ON for values of 128 or more and fully OFF below 128/);
});

test("analogWrite() on every PWM pin is fine, and needs no pinMode() (like the real core)", () => {
  const r = run([3, 5, 6, 9, 10, 11].map((p) => `analogWrite(${p}, 128);`).join("\n"));
  assert.deepEqual(r.warnings, []);
});

test("analogWrite() values outside 0-255 are explained", () => {
  const r = run("analogWrite(9, 300);");
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /analogWrite\(9, 300\): the value has to be between 0 and 255.*300 comes out as 44/);
});

test("reading a floating input pin warns (when the board says it's floating)", () => {
  const r = run("pinMode(2, INPUT);", "int v = digitalRead(2);\ndelay(100);", {
    inputs: { pinStatus: () => ({ mode: "INPUT", floating: true }) },
  });
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /it's "floating"/);
  assert.match(r.warnings[0], /pinMode\(2, INPUT_PULLUP\)/);
});

test("pins that don't exist on an Uno are reported and ignored", () => {
  const r = run("pinMode(20, OUTPUT);\ndigitalWrite(20, HIGH);");
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0], /an Arduino Uno has no pin 20/);
  assert.ok(!r.calls.some((c) => c.args[0] === 20), "the bad calls never reach the board");
});

test("analogRead() works with A0-A5 and with 0-5, and explains other pins", () => {
  const reads = [];
  const r = run("Serial.println(analogRead(A2));\nSerial.println(analogRead(2));\nSerial.println(analogRead(7));", "delay(1000);", {
    inputs: { analogRead: (pin) => { reads.push(pin); return 321; } },
  });
  assert.deepEqual(r.lines, ["321", "321", "0"]);
  assert.deepEqual(reads, [16, 16]);
  assert.match(r.warnings[0], /only A0-A5 can read analog values/);
});

test("printing before Serial.begin() warns that a real Uno would show nothing", () => {
  const r = runSketch(`void setup() { Serial.println("hello"); } void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.lines, ["hello"]);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /before Serial\.begin\(\)/);
});

test("using pins 0/1 while Serial is running warns", () => {
  const r = run("pinMode(1, OUTPUT);");
  assert.match(r.warnings[0], /Pin 1 is the Uno's Serial TX/);
});

test("warnings never stop the sketch; errors do", () => {
  const warned = run("", "digitalWrite(13, HIGH);\nSerial.println(\"still running\");\ndelay(1000);");
  assert.equal(warned.errors.length, 0);
  assert.deepEqual(warned.lines, ["still running", "still running", "still running", "still running"], "printed at 0, 1000, 2000 and 3000 ms");
  const failed = run("", "int zero = 0;\nSerial.println(1 / zero);\nSerial.println(\"never\");");
  assert.equal(failed.errors.length, 1);
  assert.deepEqual(failed.lines, []);
});
