// Priority 4: custom functions - parameters, arguments, return values, and
// correct local-variable scope.
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
const sketch = (globalsAndFunctions, setupBody) =>
  `${globalsAndFunctions}\nvoid setup() {\n  Serial.begin(9600);\n${setupBody}\n}\nvoid loop() { delay(1000); }`;

test("a void function with no parameters can be called", () => {
  const r = runSketch(sketch(`void hello() { Serial.println("hi"); }`, "hello(); hello();"), { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["hi", "hi"]);
});

test("parameters receive the arguments, and return values come back", () => {
  const r = runSketch(sketch(`int add(int a, int b) { return a + b; }`, "Serial.println(add(2, 3)); Serial.println(add(add(1, 1), 10));"), { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["5", "12"]);
});

test("arguments are passed by value - changing a parameter doesn't change the caller's variable", () => {
  const r = runSketch(sketch(`void bump(int n) { n = n + 100; Serial.println(n); }`, "int x = 1; bump(x); Serial.println(x);"), { ms: 10 });
  assert.deepEqual(r.lines, ["101", "1"]);
});

test("arguments are converted to the parameter type", () => {
  const r = runSketch(sketch(`void show(int n) { Serial.println(n); }\nvoid showF(float f) { Serial.println(f); }`, "show(9.7); showF(3);"), { ms: 10 });
  assert.deepEqual(r.lines, ["9", "3.00"]);
});

test("each call gets its own local variables (recursion works)", () => {
  const r = runSketch(sketch(`long factorial(int n) { if (n <= 1) return 1; return n * factorial(n - 1); }`, "Serial.println(factorial(10));"), { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["3628800"]);
});

test("a function can't see the caller's local variables", () => {
  const msg = compileError(`void show() {\n  Serial.println(secret);\n}\nvoid setup() {\n  int secret = 42;\n  show();\n}\nvoid loop() {}`);
  assert.match(msg, /^Line 2: 'secret' was not declared/);
});

test("locals declared inside a function don't leak out of it", () => {
  const msg = compileError(`void make() {\n  int temp = 5;\n}\nvoid setup() {\n  make();\n  temp = 6;\n}\nvoid loop() {}`);
  assert.match(msg, /^Line 6: 'temp' was not declared/);
});

test("functions can be called before they're written (Arduino adds prototypes automatically)", () => {
  const r = runSketch(`void setup() { Serial.begin(9600); Serial.println(twice(21)); }\nvoid loop() { delay(1000); }\nint twice(int x) { return 2 * x; }`, { ms: 10 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["42"]);
});

test("an explicit prototype is accepted, but has to match the definition", () => {
  const ok = runSketch(`int twice(int x);\nvoid setup() { Serial.begin(9600); Serial.println(twice(4)); }\nvoid loop() { delay(1000); }\nint twice(int x) { return 2 * x; }`, { ms: 10 });
  assert.deepEqual(ok.lines, ["8"]);
  assert.match(compileError(`int twice(float x);\nint twice(int x) { return 2 * x; }\nvoid setup() {}\nvoid loop() {}`), /doesn't match its definition/);
});

test("globals are only visible below where they're declared (real C++ rule)", () => {
  const msg = compileError(`void setup() {\n  ledPin = 5;\n}\nint ledPin = 13;\nvoid loop() {}`);
  assert.match(msg, /^Line 2: 'ledPin' was not declared/);
});

test("calling with the wrong number of arguments is reported clearly", () => {
  assert.match(compileError(sketch(`int add(int a, int b) { return a + b; }`, "add(1);")), /add\(\) needs 2 arguments \(a, b\) but was given 1/);
  assert.match(compileError(sketch("", "digitalWrite(13);")), /digitalWrite\(\) needs 2 arguments - digitalWrite\(pin, value\) - but was given 1/);
});

test("misspelled function names get a suggestion", () => {
  assert.match(compileError(sketch(`void blinkLed() {}`, "blinkLEd();")), /'blinkLEd' was not declared.*Did you mean 'blinkLed'\?/);
});

test("delay() inside a custom function pauses the whole sketch", () => {
  const r = runSketch(`
    void pause(int ms) { delay(ms); }
    void setup() { Serial.begin(9600); }
    void loop() { Serial.println(millis()); pause(250); }`, { ms: 600 });
  assert.deepEqual(r.lines, ["0", "250", "500"]);
});

test("runaway recursion stops with an explanation instead of hanging", () => {
  const r = runSketch(sketch(`void forever(int n) { forever(n + 1); }`, "forever(0);"), { ms: 10 });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /Too many functions calling each other/);
});

test("a function name that clashes with a built-in is rejected", () => {
  assert.match(compileError(`void delay(int ms) {}\nvoid setup() {}\nvoid loop() {}`), /'delay' is already a built-in Arduino function/);
});

test("using a function's result when it doesn't return one is rejected", () => {
  assert.match(compileError(sketch(`void nothing() {}`, "int x = nothing();")), /doesn't return a value/);
});
