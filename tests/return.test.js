// Priority 3: return leaves the CURRENT function immediately - and only that
// function. It never stops the whole simulator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/simulator/interpreter.js";
import { runSketch } from "./helpers/sim.js";

const compileError = (source) => {
  try {
    compile(source);
  } catch (e) {
    return e.message;
  }
  return null;
};

test("statements after `return;` in loop() don't run, and loop() still repeats", () => {
  const r = runSketch(`
    void setup() { Serial.begin(9600); }
    void loop() {
      Serial.println("a");
      delay(100);
      return;
      Serial.println("b");
    }`, { ms: 450 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["a", "a", "a", "a", "a"]);
});

test("`return;` in setup() ends setup early, then loop() starts as usual", () => {
  const r = runSketch(`
    void setup() {
      Serial.begin(9600);
      Serial.println("setup start");
      return;
      Serial.println("never printed");
    }
    void loop() { Serial.println("loop"); delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.lines, ["setup start", "loop"]);
});

test("a return nested inside if / for / while exits the whole enclosing function", () => {
  const r = runSketch(`
    int findFirstAbove(int limit) {
      for (int i = 0; i < 100; i++) {
        while (true) {
          if (i * i > limit) {
            return i;
          }
          break;
        }
      }
      return -1;
    }
    void setup() {
      Serial.begin(9600);
      Serial.println(findFirstAbove(50));
      Serial.println("after the call");
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["8", "after the call"]);
});

test("statements after return have no hardware effect", () => {
  const r = runSketch(`
    void blinkOnce(bool reallyBlink) {
      if (!reallyBlink) return;
      digitalWrite(13, HIGH);
    }
    void setup() { pinMode(13, OUTPUT); blinkOnce(false); }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.ok(!r.calls.some((c) => c.name === "digitalWrite"));
});

test("return values come back at the call site, converted to the return type", () => {
  const r = runSketch(`
    int half(int x) { return x / 2; }
    int truncated() { return 3.99; }
    float precise(int x) { return x / 2.0; }
    void setup() {
      Serial.begin(9600);
      Serial.println(half(7) + 10);
      Serial.println(truncated());
      Serial.println(precise(7));
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["13", "3", "3.50"]);
});

test("returning a value from a void function is a compile error", () => {
  assert.match(compileError(`void setup() {\n  return 5;\n}\nvoid loop() {}`), /^Line 2: setup\(\) is a void function/);
});

test("`return;` without a value in an int function is a compile error", () => {
  assert.match(compileError(`int f() {\n  return;\n}\nvoid setup() {}\nvoid loop() {}`), /^Line 2: f\(\) has to return an int/);
});

test("an int function that can fall off its end gets a warning", () => {
  const r = runSketch(`
    int sign(int x) {
      if (x > 0) return 1;
      if (x < 0) return -1;
    }
    void setup() { Serial.begin(9600); Serial.println(sign(0)); }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /'sign' can reach its end without returning a value/);
});
