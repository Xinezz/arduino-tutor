// Error feedback: a syntax error, a code problem, an unsupported feature and
// a runtime error are told apart, and each comes with a hint and a way back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainError, stripLinePrefix } from "../js/simulator/feedback.js";
import { runSketch } from "./helpers/sim.js";

// Runs a sketch and returns the details object the panel receives.
function errorOf(source) {
  const r = runSketch(source, { ms: 100 });
  assert.equal(r.errorDetails.length, 1, `expected exactly one error, got ${JSON.stringify(r.errors)}`);
  return r.errorDetails[0];
}

const sketch = (setupBody, globals = "") => `${globals}\nvoid setup() {\n${setupBody}\n}\nvoid loop() {}`;

test("a missing semicolon is a syntax error on the right line", () => {
  const d = errorOf(sketch("  pinMode(13, OUTPUT)\n  digitalWrite(13, HIGH);"));
  assert.deepEqual([d.kind, d.line], ["syntax", 3]);
  const e = explainError(d);
  assert.equal(e.title, "Syntax error");
  assert.equal(e.detail, "Missing ';' at the end of this line");
  assert.match(e.hint, /ends with a semicolon/);
  assert.match(e.recovery, /^Nothing ran\. Fix line 3 \(highlighted in the editor\), then press Run again - your circuit hasn't changed\./);
});

test("a missing closing brace is a syntax error", () => {
  const d = errorOf("void setup() {\n  pinMode(13, OUTPUT);\n\nvoid loop() {}");
  assert.equal(d.kind, "syntax");
  assert.match(d.message, /^Line 4: Missing '\}' - setup\(\) \(started on line 1\) is never closed before loop\(\) begins here/);
  assert.match(explainError(d).hint, /Every \{ needs a matching \}/);
});

test("a misspelled name is a code problem, with a hint about case", () => {
  const d = errorOf(sketch("  pinMode(ledpin, OUTPUT);", "int ledPin = 13;"));
  assert.equal(d.kind, "code");
  const e = explainError(d);
  assert.equal(e.title, "Code problem");
  assert.match(e.detail, /'ledpin' was not declared.*Did you mean 'ledPin'\?/);
  assert.match(e.hint, /case-sensitive/);
});

test("changing a const is a code problem with its own hint", () => {
  const d = errorOf(sketch("  LED = 12;", "const int LED = 13;"));
  assert.equal(d.kind, "code");
  assert.match(explainError(d).hint, /remove the word const/);
});

test("wrong number of arguments points at the usage", () => {
  const d = errorOf(sketch("  digitalWrite(13);"));
  assert.equal(d.kind, "code");
  assert.match(explainError(d).hint, /usage shown/);
});

test("unsupported features are labelled as the simulator's limit, not the learner's mistake", () => {
  for (const [src, what] of [
    [sketch("  int pins[3];"), /Arrays/],
    [sketch("  int x = 1;\n  switch (x) { case 1: break; }"), /switch/],
    [sketch("  if (Serial.available()) {}"), /Serial Monitor/],
    [sketch("  attachInterrupt(0, setup, RISING);"), /attachInterrupt/],
  ]) {
    const d = errorOf(src);
    assert.equal(d.kind, "unsupported", d.message);
    assert.match(d.message, what);
    const e = explainError(d);
    assert.equal(e.title, "Not supported in this simulator");
    assert.match(e.what, /may well be valid Arduino code/);
    assert.match(e.hint, /Simulator limits/);
  }
});

test("dividing by zero is a runtime error, with a debugging hint", () => {
  const d = errorOf(sketch("  int zero = 0;\n  Serial.begin(9600);\n  Serial.println(10 / zero);"));
  assert.deepEqual([d.kind, d.line], ["runtime", 5]);
  const e = explainError(d);
  assert.equal(e.title, "Runtime error");
  assert.match(e.hint, /print it with Serial\.println\(\)/);
  assert.match(e.recovery, /starts again from setup\(\)/);
});

test("errors with no line still get a sensible explanation", () => {
  const d = errorOf("void setup() {}\n");
  assert.equal(d.kind, "code");
  assert.equal(d.line, null);
  const e = explainError(d);
  assert.match(e.hint, /both must be there/);
  assert.match(e.recovery, /^Nothing ran\. Fix the code, then press Run again/);
});

test("stripLinePrefix only removes the leading line marker", () => {
  assert.equal(stripLinePrefix("Line 12: 'x' was not declared"), "'x' was not declared");
  assert.equal(stripLinePrefix("No line here"), "No line here");
});
