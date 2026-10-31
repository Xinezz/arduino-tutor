// Error feedback: a syntax error, a code problem, an unsupported feature and
// a runtime error are told apart, and each comes with a hint and a way back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainError, explainWarning, conceptForFinding, stripLinePrefix } from "../js/simulator/feedback.js";
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
  const e = explainError(d);
  assert.match(e.hints.at(-1), /remove the word const/);
  assert.deepEqual(e.review, { lessonId: "l1-11", title: "Constants: const and #define" });
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
    assert.match(e.hint, /Simulator Limits/);
  }
});

test("dividing by zero is a runtime error, with a debugging hint", () => {
  const d = errorOf(sketch("  int zero = 0;\n  Serial.begin(9600);\n  Serial.println(10 / zero);"));
  assert.deepEqual([d.kind, d.line], ["runtime", 5]);
  const e = explainError(d);
  assert.equal(e.title, "Runtime error");
  assert.match(e.hints.at(-1), /print it with Serial\.println\(\)/);
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

test("hints come gentlest first, and say which lesson to review", () => {
  const e = explainError(errorOf(sketch("  pinMode(ledpin, OUTPUT);", "int ledPin = 13;")));
  assert.equal(e.hints.length, 2);
  assert.match(e.hints[0], /case-sensitive/);
  assert.match(e.hints[1], /declared inside setup\(\) can't be used in loop\(\)/);
  assert.deepEqual(e.review, { lessonId: "l1-8", title: "Variables" });
});

test("forgetting pinMode(): the warning's hints explain the idea, then the exact fix", () => {
  const r = runSketch(sketch("", "") .replace("void loop() {}", "void loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n}"), { ms: 600 });
  assert.equal(r.warnings.length, 1);
  const w = explainWarning(r.warnings[0]);
  assert.match(w.hints[0], /Every pin starts out as an INPUT/);
  assert.match(w.hints[1], /pinMode\(pin, OUTPUT\) changes the pin's job/);
  assert.equal(w.hints[2], "Add pinMode(13, OUTPUT); inside setup().");
  assert.deepEqual(w.review, { lessonId: "l2-2", title: "pinMode(): Configuring a Pin's Job" });
});

test("every warning the simulator gives has hints and a lesson", () => {
  const sketches = [
    "void setup() { Serial.println(1); }\nvoid loop() { delay(1000); }",
    "void setup() { pinMode(7, INPUT); digitalWrite(7, HIGH); }\nvoid loop() { delay(1000); }",
    "void setup() { analogWrite(13, 100); }\nvoid loop() { delay(1000); }",
    "void setup() { analogWrite(9, 300); }\nvoid loop() { delay(1000); }",
    "void setup() { Serial.begin(9600); Serial.println(analogRead(7)); }\nvoid loop() { delay(1000); }",
    "void setup() { Serial.begin(9600); pinMode(1, OUTPUT); }\nvoid loop() { delay(1000); }",
    "void setup() { int x = 32767; x = x + 1; }\nvoid loop() { delay(1000); }",
    "int x = 0;\nvoid setup() { if (x = 5) {} }\nvoid loop() { delay(1000); }",
    "int x = 0;\nvoid setup() { if (x == 5); {} }\nvoid loop() { delay(1000); }",
    "int x = 0;\nvoid setup() { x == 6; }\nvoid loop() { delay(1000); }",
    "void setup() { delay(-5); }\nvoid loop() { }",
  ];
  for (const src of sketches) {
    const r = runSketch(src, { ms: 50 });
    assert.ok(r.warnings.length > 0, `expected a warning from: ${src}`);
    for (const w of r.warnings) {
      const help = explainWarning(w);
      assert.ok(help.hints.length > 0, `no hints for: ${w}`);
      assert.ok(help.review?.title, `no lesson for: ${w}`);
    }
  }
});

test("circuit findings point to the lesson that teaches that concept", () => {
  // polarity, resistors and short circuits each have their own lesson in Module 1
  assert.equal(conceptForFinding({ level: "problem", subject: "LED 1", text: "It's in backwards: the long leg (+) goes to GND" }).lessonId, "m1-7");
  assert.equal(conceptForFinding({ level: "real", subject: "LED 1", text: "No resistor in series." }).lessonId, "m1-6");
  assert.equal(conceptForFinding({ level: "problem", subject: "Button 2", text: "Nothing pulls pin 2 LOW, so it floats" }).lessonId, "l2-7");
  assert.equal(conceptForFinding({ level: "problem", subject: "Circuit", text: "5V is wired straight to GND - a short circuit." }).lessonId, "m1-4");
  assert.equal(conceptForFinding({ level: "real", subject: "Circuit", text: "You used the breadboard's − rail." }).lessonId, "l1-16");
  assert.equal(conceptForFinding({ level: "ok", subject: "LED 1", text: "Complete circuit" }), null);
});

test("stripLinePrefix only removes the leading line marker", () => {
  assert.equal(stripLinePrefix("Line 12: 'x' was not declared"), "'x' was not declared");
  assert.equal(stripLinePrefix("No line here"), "No line here");
});
