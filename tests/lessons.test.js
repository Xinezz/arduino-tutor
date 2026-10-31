// Regression: every runnable piece of course content still works.
//  - every challenge's official solution
//  - every lesson code example that is a complete sketch
//  - every project stage's example code that is a complete sketch
// must compile, run for a while without errors, and produce NO warnings
// (official solutions should be model code). Lesson snippets that are only
// fragments must at least compile. "Predict the output" quizzes must agree
// with what the simulator prints.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../js/simulator/interpreter.js";
import { lessons } from "../js/lessons/data.js";
import { projects } from "../js/projects/data.js";
import { quizzes } from "../js/quiz/data.js";
import { runSketch } from "./helpers/sim.js";

const isFullSketch = (code) => /\bvoid\s+setup\s*\(/.test(code) && /\bvoid\s+loop\s*\(/.test(code);
// The bare "setup() + loop()" skeleton (lesson l1-4) has nothing to do.
// The runnable sketch in a lesson block, if it has one: a complete sketch in
// a code block or a worked example.
const sketchOf = (block) => {
  const code = block.type === "code" ? block.text : block.type === "example" ? block.code : null;
  return code && isFullSketch(code) ? code : null;
};
const isEmptySkeleton = (code) => /^\s*void setup\(\) \{\s*\}\s*void loop\(\) \{\s*\}\s*$/.test(code.replace(/\/\/.*$/gm, ""));

// Neutral inputs: buttons read HIGH (released, INPUT_PULLUP style), sensors
// sit mid-range, the ultrasonic sensor sees something 20 cm away.
const neutralInputs = { digitalRead: () => 1, analogRead: () => 512, pulseIn: 1160 };

const sketches = [];
for (const lesson of lessons) {
  if (lesson.challenge) {
    sketches.push({ name: `challenge ${lesson.challenge.id} "${lesson.challenge.title}" (lesson ${lesson.id})`, code: lesson.challenge.solution });
  }
  lesson.body.forEach((block, i) => {
    const code = sketchOf(block);
    if (code) sketches.push({ name: `lesson ${lesson.id} example #${i + 1}`, code });
  });
}
for (const project of projects) {
  for (const stage of project.stages) {
    if (isFullSketch(stage.exampleCode)) sketches.push({ name: `project ${project.id} ${stage.id}`, code: stage.exampleCode });
  }
}

test("there is course content to check", () => {
  assert.ok(sketches.length >= 30, `found only ${sketches.length} sketches`);
  assert.equal(lessons.filter((l) => l.challenge).length, 28, "all 28 challenge solutions are included");
});

for (const s of sketches) {
  test(`runs cleanly: ${s.name}`, () => {
    const r = runSketch(s.code, { ms: 5000, inputs: neutralInputs });
    assert.deepEqual(r.errors, [], `errors in ${s.name}`);
    assert.deepEqual(r.warnings, [], `warnings in ${s.name}`);
    if (!isEmptySkeleton(s.code)) assert.ok(r.calls.length > 0 || r.output.length > 0, `${s.name} did nothing observable`);
  });
}

// Lesson snippets that are deliberately NOT valid code (they demonstrate an
// error) or that only make sense inside a bigger sketch. Lesson code blocks
// are display-only (never loaded into the editor), so these are fine as-is.
const FRAGMENTS_NOT_EXPECTED_TO_COMPILE = new Map([
  ["l1-2#3", "a plain-text spec table (pins, PWM, 16 MHz), not code"],
  ["l1-12#2", "a plain-text pinout table, not code"],
  ["l1-15#2", "deliberately missing ';' - the lesson is about reading that compiler error"],
  ["l2-1#2", "shows the words HIGH and LOW with comments, not statements"],
  ["l6-5#2", "an excerpt: '... trigger + measure distance as before ...' stands in for the code that declares duration"],
  ["l5-2#2", "a reference table of the six comparison operators, not statements"],
]);

test("every lesson code fragment compiles once wrapped into a sketch", () => {
  const failures = [];
  for (const lesson of lessons) {
    lesson.body.forEach((block, i) => {
      if (block.type !== "code" || isFullSketch(block.text)) return;
      const key = `${lesson.id}#${i + 1}`;
      // A fragment either has its own functions (wrap nothing) or is a run of
      // statements (put it inside setup()).
      const hasFunction = /^\s*(void|int|float|long|bool|byte|unsigned)\s+\w+\s*\([^;]*\)\s*\{/m.test(block.text);
      const program = hasFunction
        ? `${block.text}\n${/void\s+setup/.test(block.text) ? "" : "void setup() {}"}\n${/void\s+loop/.test(block.text) ? "" : "void loop() {}"}`
        : `void setup() {\n${block.text}\n}\nvoid loop() {}`;
      try {
        compile(program);
        if (FRAGMENTS_NOT_EXPECTED_TO_COMPILE.has(key)) failures.push(`${key} compiled but is listed as not expected to`);
      } catch (e) {
        if (!FRAGMENTS_NOT_EXPECTED_TO_COMPILE.has(key)) failures.push(`${key} (${lesson.title}): ${e.message}\n${block.text}`);
      }
    });
  }
  assert.deepEqual(failures, []);
});

// A lesson's "predict first" question states what the sketch really prints
// (its own code, or the full sketch just above it). If the simulator ever
// disagreed, the lesson would be teaching something wrong.
test("every lesson prediction's answer is what the simulator really prints", () => {
  let checked = 0;
  for (const lesson of lessons) {
    lesson.body.forEach((block, i) => {
      if (block.type !== "predict") return;
      assert.ok(block.options[block.answer] !== undefined, `${lesson.id}: the answer is one of the options`);
      if (block.output === undefined) return;
      const code = block.code ?? [...lesson.body.slice(0, i)].reverse().map(sketchOf).find(Boolean);
      assert.ok(code, `${lesson.id}: a prediction with an output needs a sketch to run`);
      const r = runSketch(code, { ms: 3000 });
      assert.deepEqual(r.errors, [], `${lesson.id}: ${r.errors}`);
      assert.equal(r.lines.join("\n"), block.output, `${lesson.id}: the stated output must be what the sketch prints`);
      checked++;
    });
  }
  assert.ok(checked >= 6, `checked ${checked} predictions`);
});

test('"predict the output" quizzes agree with the simulator', () => {
  const predicts = Object.values(quizzes).filter((q) => q.type === "predict" && /Serial\.print/.test(q.code));
  assert.ok(predicts.length >= 2);
  for (const q of predicts) {
    const r = runSketch(`void setup() {\nSerial.begin(9600);\n${q.code}\n}\nvoid loop() { delay(1000); }`, { ms: 1000 });
    assert.deepEqual(r.errors, [], q.id);
    assert.equal(r.lines.join("\n"), q.options[q.correctIndex], `${q.id}: the simulator must print the quiz's correct answer`);
  }
});

test("the editor's starting template compiles and runs", () => {
  const r = runSketch("void setup() {\n  \n}\n\nvoid loop() {\n  \n}\n", { ms: 100 });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});
