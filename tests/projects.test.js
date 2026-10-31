// The project library: every project's checks are proven on real code -
// a working reference passes every step, a DIFFERENT working solution passes
// too (projects accept any correct approach), and typical mistakes fail.
// The reference wiring passes every circuit check on a real board.

import { test } from "node:test";
import assert from "node:assert/strict";
import { BEGINNER_PROJECTS, runningLights, toggleLamp, pedestrianCrossing } from "../js/projects/beginner.js";
import { runCheck } from "../js/lessons/checks.js";
import { lessons } from "../js/lessons/data.js";
import { SKILLS } from "../js/lessons/curriculum.js";
import { createBoard } from "../js/simulator/board.js";
import { createFakeSvg } from "./helpers/fakeDom.js";

const findingsFor = (wiring) => {
  const b = createBoard(createFakeSvg(), { random: () => 0.25 });
  b.loadCircuit(wiring);
  return b.inspectCircuit().findings;
};
const failed = (r) => r.items.filter((i) => !i.ok).map((i) => i.text);
const EMPTY = "void setup() {}\nvoid loop() {}";

for (const project of BEGINNER_PROJECTS) {
  test(`${project.title}: the reference solution and wiring pass every step and the final check`, () => {
    const findings = findingsFor(project.wiring);
    for (const step of project.steps) {
      // a step that a later one replaces carries its own code for that stage
      const r = runCheck(step.check, step.reference ?? project.reference, findings);
      assert.equal(r.status, "pass", `${step.id}: ${failed(r).join(" | ")}`);
    }
    const r = runCheck(project.final, project.reference, findings);
    assert.equal(r.status, "pass", failed(r).join(" | "));
    assert.ok(r.circuitChecked);
  });

  test(`${project.title}: content is complete and points at real lessons and skills`, () => {
    const ids = new Set(lessons.map((l) => l.id));
    for (const id of project.needs) assert.ok(ids.has(id), `unknown lesson ${id}`);
    for (const c of project.concepts) assert.ok(SKILLS[c], `unknown skill ${c}`);
    for (const step of project.steps) assert.ok(step.hints.length >= 1 && step.task, step.id);
    assert.ok(project.challenge.objective && project.independent.problem && project.troubleshooting.length >= 3);
    for (const q of project.knowledge.questions) {
      assert.equal(q.why.length, q.options.length);
      assert.ok(q.options[q.answer]);
    }
    // an empty sketch passes nothing that checks code
    assert.equal(runCheck(project.final, EMPTY, findingsFor(project.wiring)).status, "fail");
  });
}

test("Running Lights: a different correct solution (no for loop) passes; wrong order or two-at-once fails", () => {
  const unrolled = [
    "void setup() {",
    "  pinMode(2, OUTPUT); pinMode(3, OUTPUT); pinMode(4, OUTPUT); pinMode(5, OUTPUT);",
    "}",
    "void loop() {",
    "  digitalWrite(2, HIGH); delay(200); digitalWrite(2, LOW);",
    "  digitalWrite(3, HIGH); delay(200); digitalWrite(3, LOW);",
    "  digitalWrite(4, HIGH); delay(200); digitalWrite(4, LOW);",
    "  digitalWrite(5, HIGH); delay(200); digitalWrite(5, LOW);",
    "}",
  ].join("\n");
  assert.equal(runCheck(runningLights.final, unrolled).status, "pass");
  const backwards = runningLights.reference.replace(
    "for (int pin = 2; pin <= 5; pin++) {\n    digitalWrite",
    "for (int pin = 5; pin >= 2; pin--) {\n    digitalWrite");
  assert.notEqual(backwards, runningLights.reference);
  assert.equal(runCheck(runningLights.final, backwards).status, "fail");
  const noOff = runningLights.reference.replace("    digitalWrite(pin, LOW);\n", "");
  assert.notEqual(noOff, runningLights.reference);
  assert.equal(runCheck(runningLights.final, noOff).status, "fail");
  // the bounce improvement has a real check: the plain project fails it, a scanner passes
  const bounce = runningLights.improvements.find((i) => i.check);
  assert.equal(runCheck(bounce.check, runningLights.reference).status, "fail");
  const scanner = [
    "void setup() { for (int p = 2; p <= 5; p++) pinMode(p, OUTPUT); }",
    "void flash(int p) { digitalWrite(p, HIGH); delay(200); digitalWrite(p, LOW); }",
    "void loop() { for (int p = 2; p <= 5; p++) flash(p); for (int p = 4; p >= 3; p--) flash(p); }",
  ].join("\n");
  assert.equal(runCheck(bounce.check, scanner).status, "pass");
});

test("Toggle Lamp: another correct solution passes; following the button, or flickering while held, fails", () => {
  const alt = [
    "int lamp = LOW;",
    "int before = HIGH;",
    "void setup() { pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }",
    "void loop() {",
    "  int now = digitalRead(2);",
    "  if (now != before) {",
    "    if (now == LOW) {",
    "      if (lamp == LOW) lamp = HIGH; else lamp = LOW;",
    "    }",
    "    before = now;",
    "  }",
    "  digitalWrite(13, lamp);",
    "}",
  ].join("\n");
  assert.equal(runCheck(toggleLamp.final, alt).status, "pass");
  const follows = "void setup() { pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, digitalRead(2) == LOW); }";
  assert.equal(runCheck(toggleLamp.final, follows).status, "fail");
  assert.equal(runCheck(toggleLamp.steps[1].check, follows).status, "pass", "following the button IS step 2's goal");
  const flicker = "bool on = false;\nvoid setup() { pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }\nvoid loop() { if (digitalRead(2) == LOW) { on = !on; delay(100); } digitalWrite(13, on); }";
  const r = runCheck(toggleLamp.final, flicker);
  assert.equal(r.status, "fail");
  assert.match(failed(r).join(" "), /flicker/);
});

test("Pedestrian Crossing: a different correct solution passes; cycling without a press fails", () => {
  const alt = [
    "const int G = 8, Y = 9, R = 10, BTN = 2;",
    "void show(int g, int y, int r) { digitalWrite(G, g); digitalWrite(Y, y); digitalWrite(R, r); }",
    "void setup() { pinMode(G, OUTPUT); pinMode(Y, OUTPUT); pinMode(R, OUTPUT); pinMode(BTN, INPUT_PULLUP); show(HIGH, LOW, LOW); }",
    "void loop() {",
    "  if (digitalRead(BTN) == LOW) {",
    "    show(LOW, HIGH, LOW); delay(1000);",
    "    show(LOW, LOW, HIGH); delay(3000);",
    "    show(HIGH, LOW, LOW);",
    "  }",
    "}",
  ].join("\n");
  assert.equal(runCheck(pedestrianCrossing.final, alt).status, "pass");
  const alwaysCycles = pedestrianCrossing.reference.replace("if (digitalRead(2) == LOW) {", "if (true) {");
  assert.notEqual(alwaysCycles, pedestrianCrossing.reference);
  assert.equal(runCheck(pedestrianCrossing.final, alwaysCycles).status, "fail");
  assert.equal(runCheck(pedestrianCrossing.steps[2].check, alwaysCycles).status, "fail");
  const walk = pedestrianCrossing.improvements.find((i) => i.check);
  assert.equal(runCheck(walk.check, pedestrianCrossing.reference).status, "fail");
  const withWalk = pedestrianCrossing.reference
    .replace("void setup() {\n", "void setup() {\n  pinMode(7, OUTPUT);\n")
    .replace("    digitalWrite(10, HIGH);\n", "    digitalWrite(10, HIGH);\n    digitalWrite(7, HIGH);\n")
    .replace("    digitalWrite(10, LOW);\n  }", "    digitalWrite(10, LOW);\n    digitalWrite(7, LOW);\n  }");
  assert.equal(runCheck(walk.check, withWalk).status, "pass");
});

test("a circuit that's missing a part, or wired to the wrong pin, fails the circuit step", () => {
  const partial = { parts: toggleLamp.wiring.parts, wires: toggleLamp.wiring.wires.filter(([a]) => a !== "pin-2") };
  assert.equal(runCheck(toggleLamp.steps[0].check, EMPTY, findingsFor(partial)).status, "fail");
  const wrongPin = { parts: runningLights.wiring.parts, wires: runningLights.wiring.wires.map(([a, b]) => [a === "pin-5" ? "pin-6" : a, b]) };
  const r = runCheck(runningLights.steps[0].check, EMPTY, findingsFor(wrongPin));
  assert.equal(r.status, "fail");
  assert.match(failed(r).join(" "), /pin 5/);
});
