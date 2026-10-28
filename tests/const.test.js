// Priority 2: const really is constant - checked before the sketch runs, with
// the line number of the offending change.
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

test("valid const declarations work, globally and locally", () => {
  const r = runSketch(`
    const int LED_PIN = 13;
    const float RATIO = 2.5;
    void setup() {
      Serial.begin(9600);
      const int LOCAL = 7;
      Serial.println(LED_PIN + LOCAL);
      Serial.println(RATIO * 2);
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["20", "5.00"]);
});

test("reassigning a global const is rejected with its line number", () => {
  const msg = compileError(`const int x = 5;\nvoid setup() {\n  x = 6;\n}\nvoid loop() {}`);
  assert.match(msg, /^Line 3: 'x' is a const \(declared on line 1\)/);
});

test("compound assignment (+=, -=, *=, /=, %=) to a const is rejected", () => {
  for (const op of ["+=", "-=", "*=", "/=", "%="]) {
    const msg = compileError(`const int x = 5;\nvoid setup() { x ${op} 2; }\nvoid loop() {}`);
    assert.match(msg, /^Line 2: 'x' is a const/, `${op} should be rejected`);
  }
});

test("++ and -- (before or after) on a const are rejected", () => {
  for (const expr of ["x++", "++x", "x--", "--x"]) {
    const msg = compileError(`void setup() {\n  const int x = 1;\n  ${expr};\n}\nvoid loop() {}`);
    assert.match(msg, /^Line 3: 'x' is a const \(declared on line 2\)/, `${expr} should be rejected`);
  }
});

test("constants declared inside blocks are enforced too", () => {
  const inIf = compileError(`void setup() {\n  if (true) {\n    const int limit = 3;\n    limit = 4;\n  }\n}\nvoid loop() {}`);
  assert.match(inIf, /^Line 4: 'limit' is a const/);
  const inFor = compileError(`void setup() {\n  for (int i = 0; i < 3; i++) {\n    const int step = 2;\n    step++;\n  }\n}\nvoid loop() {}`);
  assert.match(inFor, /^Line 4: 'step' is a const/);
  const inFunction = compileError(`int f() {\n  const int k = 1;\n  k = 2;\n  return k;\n}\nvoid setup() {}\nvoid loop() {}`);
  assert.match(inFunction, /^Line 3: 'k' is a const/);
});

test("a const in an inner block doesn't freeze a different variable with the same name outside it", () => {
  const r = runSketch(`
    int count = 0;
    void setup() {
      Serial.begin(9600);
      { const int count = 100; Serial.println(count); }
      count = count + 1;
      Serial.println(count);
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["100", "1"]);
});

test("a const must be given a value when it's declared", () => {
  assert.match(compileError(`const int x;\nvoid setup(){}\nvoid loop(){}`), /^Line 1: The const 'x' must be given its value/);
});

test("built-in constants like HIGH can't be changed either", () => {
  assert.match(compileError(`void setup() {\n  HIGH = 0;\n}\nvoid loop() {}`), /^Line 2: HIGH is a built-in Arduino constant/);
});

test("ordinary variables are still mutable, with normal scoping", () => {
  const r = runSketch(`
    int total = 0;
    void setup() {
      Serial.begin(9600);
      for (int i = 1; i <= 4; i++) { total += i; }
      int local = 10;
      local -= 3;
      local++;
      Serial.println(total);
      Serial.println(local);
    }
    void loop() { delay(1000); }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["10", "8"]);
});
