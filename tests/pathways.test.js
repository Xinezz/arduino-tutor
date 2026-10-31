// Engineering pathways (Phase 6): the formulas behind every calculated
// demonstration, the lesson content (and that its own answers agree with
// those formulas), the projects (a reference passes, other correct designs
// pass, mistakes fail), completion and certificate rules, prerequisites,
// recommendations, revision - and old or broken saves.

import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const F = await import("../js/pathways/formulas.js");
const { PATHWAYS, PATHWAY_LESSONS, PATHWAY_PROJECTS, pathwayLessonById, RUNS } = await import("../js/pathways/data.js");
const { ledControl, dividerMeter, lightCircuit, alarmDesign } = await import("../js/pathways/electronicsProjects.js");
const { pathwayStatus, lessonGaps, DESIGN_LOG_MIN } = await import("../js/pathways/progress.js");
await import("../js/pathways/visuals.js");
const { demoNames } = await import("../js/lessons/demos.js");
const P = await import("../js/progress/progress.js");
const { recommendations } = await import("../js/progress/recommend.js");
const { buildSession } = await import("../js/progress/revision.js");
const { QUESTION_BANK } = await import("../js/progress/questionBank.js");
const { AREA_BY_ID, areaReport } = await import("../js/progress/skills.js");
const { runCheck } = await import("../js/lessons/checks.js");
const { lessons } = await import("../js/lessons/data.js");
const { SKILLS } = await import("../js/lessons/curriculum.js");
const { createBoard } = await import("../js/simulator/board.js");
const { createFakeSvg } = await import("./helpers/fakeDom.js");

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const fresh = () => { store.clear(); return P.loadProgress(); };
const findingsFor = (wiring) => {
  const b = createBoard(createFakeSvg(), { random: () => 0.25 });
  b.loadCircuit(wiring);
  return b.inspectCircuit().findings;
};
const failed = (r) => r.items.filter((i) => !i.ok).map((i) => i.text).join(" | ");

// ---------------------------------------------------------------- the formulas

test("Ohm's law, power, series and parallel", () => {
  const r = F.resistorPower(12, 100);
  close(r.current, 0.12);
  close(r.power, 1.44);
  assert.equal(r.ok, false);
  assert.equal(F.resistorPower(3, 220).ok, true, "an LED resistor at ~41 mW is fine on ¼ W");
  close(F.series([220, 330]), 550);
  close(F.parallel([1000, 1000]), 500);
  close(F.parallel([220, 330]), 132);
  assert.ok(F.parallel([100, 10000]) < 100, "parallel is below the smallest");
});

test("Kirchhoff: the drops round a loop add up to the supply; branch currents add up", () => {
  for (const [vf, r] of [[1.8, 220], [2.1, 330], [3.0, 100]]) {
    const loop = F.ledLoop(5, vf, r);
    close(loop.vResistor + loop.vLed, 5);
    close(loop.current, (5 - vf) / r);
  }
  const off = F.ledLoop(2.5, 3.0, 220);
  assert.equal(off.current, 0, "below its forward voltage an LED doesn't conduct");
  close(off.vLed, 2.5);
  const b = F.branchCurrents(5, 2, [220, 330]);
  close(b.total, 3 / 220 + 3 / 330);
});

test("the voltage divider, its loading, and analogRead()", () => {
  close(F.divider(5, 1000, 1000).vout, 2.5);
  close(F.divider(5, 1000, 3000).vout, 3.75);
  const loaded = F.divider(5, 10000, 10000, 10000);
  close(loaded.vout, 5 / 3, 1e-9);
  assert.ok(loaded.vout < 2.5, "a load pulls the output down");
  assert.equal(F.adcReading(0), 0);
  assert.equal(F.adcReading(2.5), 512);
  assert.equal(F.adcReading(5), 1023);
  assert.equal(F.adcReading(7), 1023, "clamped to 10 bits");
  close(F.readingToVolts(1023), 5);
});

test("pull-up, pull-down and floating inputs", () => {
  assert.deepEqual(F.buttonInput("pullup", false, 10000), { volts: 5, reading: "HIGH", current: 0 });
  const pressed = F.buttonInput("pullup", true, 10000);
  assert.equal(pressed.reading, "LOW");
  close(pressed.current, 0.0005);
  assert.equal(F.buttonInput("pulldown", true, 10000).reading, "HIGH");
  assert.equal(F.buttonInput("none", false, 10000).volts, null);
});

test("RC charging: 63% at one time constant, over 99% at five", () => {
  close(F.timeConstant(10000, 100e-6), 1);
  close(F.rcVoltage(5, 10000, 100e-6, 1) / 5, 1 - Math.exp(-1));
  assert.ok(F.rcVoltage(5, 10000, 100e-6, 5) / 5 > 0.99);
  assert.equal(F.rcVoltage(5, 1000, 1e-6, 0), 0);
});

test("the transistor switch: base resistor from the ÷10 rule, rounded down to a standard value", () => {
  const t = F.transistorSwitch(60, 100);
  close(t.ibDesign, 0.006);
  close(t.rbExact, 4.3 / 0.006);
  assert.equal(t.rb, 680);
  assert.ok(t.ibActual >= t.ibDesign, "rounding down gives at least the design current");
  assert.equal(t.pinOk, true);
  assert.equal(t.directOk, false);
  assert.equal(F.e12AtOrBelow(717), 680);
  assert.equal(F.e12AtOrBelow(4700), 4700);
  assert.equal(F.e12AtOrBelow(4699), 3900);
  assert.equal(F.transistorSwitch(15).directOk, true);
  assert.equal(F.transistorSwitch(250).pinOk, false, "the ÷10 rule would overload the pin for a 250 mA motor - and the demo says so");
});

// ---------------------------------------------------------------- the content

test("every pathway lesson is complete, points at real lessons and demos, and has a valid checkpoint", () => {
  const core = new Set(lessons.map((l) => l.id));
  const demos = new Set(demoNames());
  const seen = new Set();
  for (const l of PATHWAY_LESSONS) {
    assert.ok([1, 2, 3].includes(l.level), l.id);
    assert.ok(RUNS[l.runs], `${l.id}: runs`);
    for (const id of l.needs) assert.ok(core.has(id), `${l.id} needs ${id}`);
    for (const id of l.after) assert.ok(seen.has(id), `${l.id} comes after ${id}, which must be earlier`);
    seen.add(l.id);
    assert.ok(l.why && l.objectives.length >= 2 && l.summary.length >= 2, l.id);
    for (const b of l.body.filter((x) => x.type === "demo")) assert.ok(demos.has(b.demo), `${l.id}: demo ${b.demo}`);
    assert.ok(l.body.some((b) => b.section === "application"), `${l.id}: a real-world application`);
    assert.ok(l.body.some((b) => b.type === "mistakes"), `${l.id}: common mistakes`);
    assert.ok(l.quiz.questions.length >= 3, `${l.id}: checkpoint`);
    for (const q of l.quiz.questions) {
      assert.equal(q.why.length, q.options.length, `${l.id}: every option explained`);
      assert.ok(q.options[q.answer], `${l.id}: answer exists`);
    }
  }
  // every calculated-model lesson has an interactive demo; hardware ones say so
  for (const l of PATHWAY_LESSONS.filter((x) => x.runs === "calculated")) assert.ok(l.body.some((b) => b.type === "demo"), l.id);
  for (const l of PATHWAY_LESSONS.filter((x) => x.runs === "hardware")) assert.ok(l.body.some((b) => b.type === "note" && /real hardware/.test(b.text)), l.id);
});

test("the lessons' own answers agree with the formulas", () => {
  const answerOf = (id, n) => { const q = pathwayLessonById(id).quiz.questions[n]; return q.options[q.answer]; };
  assert.match(answerOf("pe-2", 0), new RegExp(String(F.resistorPower(12, 100).power)));
  assert.match(answerOf("pe-2", 1), new RegExp(String(Math.round(3 / 0.015))));
  assert.match(answerOf("pe-3", 0), new RegExp(String(F.parallel([1000, 1000]))));
  assert.match(answerOf("pe-5", 0), new RegExp(String(F.divider(5, 1000, 3000).vout)));
  assert.match(answerOf("pe-5", 1), new RegExp(F.readingToVolts(614).toFixed(1)));
  assert.match(answerOf("pe-6", 0), new RegExp(String(F.buttonInput("pullup", true, 10000).current * 1000)));
  assert.match(answerOf("pe-7", 0), new RegExp(`${F.timeConstant(1000, 0.001)} s`));
  assert.match(answerOf("pe-8", 0), new RegExp(`${150 / 10} mA`));
});

test("pathways: only built ones can be opened, levels list real lessons and projects", () => {
  for (const p of PATHWAYS) {
    assert.ok(p.title && p.summary && p.teaches.length && p.builds.length && p.hardware, p.id);
    for (const id of p.needs) assert.ok(lessons.some((l) => l.id === id), `${p.id} needs ${id}`);
    if (p.status !== "available") { assert.equal(p.levels, undefined, `${p.id} is planned: nothing to open`); continue; }
    const listed = [1, 2, 3].flatMap((n) => p.levels[n].lessons);
    assert.deepEqual(listed.sort(), PATHWAY_LESSONS.filter((l) => l.pathway === p.id).map((l) => l.id).sort());
    for (const n of [1, 2, 3]) {
      for (const id of p.levels[n].lessons) assert.equal(pathwayLessonById(id).level, n, `${id} is in level ${n}`);
      for (const id of p.levels[n].projects) assert.equal(PATHWAY_PROJECTS.find((x) => x.id === id).pathwayLevel, n);
    }
  }
  assert.match(PATHWAYS.find((p) => p.id === "iot").hardware, /ESP32 is NOT an Uno/);
});

// ---------------------------------------------------------------- the projects

for (const project of PATHWAY_PROJECTS) {
  test(`${project.title}: the reference and its wiring pass every step and the final check`, () => {
    const findings = findingsFor(project.wiring);
    for (const step of project.steps) {
      const r = runCheck(step.check, step.reference ?? project.reference, findings);
      assert.equal(r.status, "pass", `${step.id}: ${failed(r)}`);
    }
    const r = runCheck(project.final, project.reference, findings);
    assert.equal(r.status, "pass", failed(r));
    assert.ok(r.circuitChecked);
    assert.equal(runCheck(project.final, "void setup() {}\nvoid loop() {}", findings).status, "fail");
    for (const c of project.concepts) assert.ok(SKILLS[c], c);
    for (const id of project.needs) assert.ok(lessons.some((l) => l.id === id), id);
  });
}

test("LED control: switching instead of PWM, or fading a non-PWM pin, fails", () => {
  const noFade = "void setup() { analogWrite(10, 128); analogWrite(11, 255); pinMode(9, OUTPUT); }\nvoid loop() { digitalWrite(9, HIGH); delay(500); digitalWrite(9, LOW); delay(500); }";
  assert.match(failed(runCheck(ledControl.final, noFade)), /analogWrite|levels/);
  const pin13 = ledControl.reference.replaceAll("analogWrite(9, level)", "analogWrite(13, level)");
  assert.equal(runCheck(ledControl.final, pin13).status, "fail");
  const forLoop = [
    "void setup() { analogWrite(10, 128); analogWrite(11, 255); }",
    "void loop() {",
    "  for (int i = 0; i <= 255; i += 3) { analogWrite(9, i); delay(10); }",
    "  for (int i = 255; i >= 0; i -= 3) { analogWrite(9, i); delay(10); }",
    "}",
  ].join("\n");
  assert.equal(runCheck(ledControl.final, forLoop).status, "pass", failed(runCheck(ledControl.final, forLoop)));
});

test("Divider meter: whole-number maths is caught and explained; 1024 is accepted; an unpowered pot fails", () => {
  const ints = dividerMeter.reference.replace("float volts = reading * 5.0 / 1023;", "int volts = reading * 5 / 1023;");
  assert.notEqual(ints, dividerMeter.reference);
  const r = runCheck(dividerMeter.final, ints);
  assert.equal(r.status, "fail");
  assert.match(failed(r), /whole numbers/);
  const by1024 = dividerMeter.reference.replace("/ 1023", "/ 1024");
  assert.equal(runCheck(dividerMeter.final, by1024).status, "pass", failed(runCheck(dividerMeter.final, by1024)));
  const unpowered = { parts: dividerMeter.wiring.parts, wires: [["p.w", "pin-14"]] };
  assert.equal(runCheck(dividerMeter.steps[0].check, "void setup() {}\nvoid loop() {}", findingsFor(unpowered)).status, "fail");
  const warn = dividerMeter.improvements.find((i) => i.check);
  assert.equal(runCheck(warn.check, dividerMeter.reference).status, "fail");
  const withWarn = dividerMeter.reference.replace("void setup() {\n", "void setup() {\n  pinMode(13, OUTPUT);\n").replace("  Serial.println(volts);\n", "  Serial.println(volts);\n  digitalWrite(13, volts > 4.0);\n");
  assert.equal(runCheck(warn.check, withWarn).status, "pass", failed(runCheck(warn.check, withWarn)));
});

test("Light circuit: the comparison the wrong way round fails; hysteresis is checked properly", () => {
  const reversed = lightCircuit.reference.replace("light < DARK", "light > DARK");
  assert.equal(runCheck(lightCircuit.final, reversed).status, "fail");
  const otherThreshold = lightCircuit.reference.replace("const int DARK = 300;", "const int DARK = 500;");
  assert.equal(runCheck(lightCircuit.final, otherThreshold).status, "pass", "any threshold between the readings is right");
  const hyst = lightCircuit.improvements.find((i) => i.check);
  assert.equal(runCheck(hyst.check, lightCircuit.reference).status, "fail", "one threshold isn't hysteresis");
  const withHyst = [
    "bool on = false;",
    "void setup() { pinMode(13, OUTPUT); }",
    "void loop() {",
    "  int light = analogRead(A0);",
    "  if (light < 300) on = true;",
    "  if (light > 400) on = false;",
    "  digitalWrite(13, on);",
    "  delay(50);",
    "}",
  ].join("\n");
  assert.equal(runCheck(hyst.check, withHyst).status, "pass", failed(runCheck(hyst.check, withHyst)));
});

test("Alarm design: a different valid design passes; missing requirements each fail", () => {
  const alt = [
    "int countdown = 0;",
    "void setup() { pinMode(7, INPUT_PULLUP); pinMode(12, OUTPUT); }",
    "void loop() {",
    "  if (digitalRead(7) == LOW) countdown = 40;",
    "  if (countdown > 0) {",
    "    tone(9, 2000, 150);",
    "    digitalWrite(12, countdown % 2);",
    "    countdown = countdown - 1;",
    "  } else {",
    "    digitalWrite(12, LOW);",
    "  }",
    "  delay(100);",
    "}",
  ].join("\n");
  assert.equal(runCheck(alarmDesign.final, alt).status, "pass", failed(runCheck(alarmDesign.final, alt)));
  const altWiring = { parts: [{ key: "i", kind: "irsensor" }, { key: "z", kind: "buzzer" }, { key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
    wires: [["i.s", "pin-7"], ["i.g", "gnd"], ["pin-9", "z.s"], ["z.g", "gnd"], ["pin-12", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] };
  assert.equal(runCheck(alarmDesign.final, alt, findingsFor(altWiring)).status, "pass", "an IR sensor on other pins is just as valid");

  const follows = alarmDesign.steps[1].reference + "\n";
  assert.match(failed(runCheck(alarmDesign.final, follows)), /stops when the trigger goes away/);
  const always = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { tone(8, 1000); digitalWrite(13, (millis() / 250) % 2); }";
  assert.match(failed(runCheck(alarmDesign.final, always)), /before anything is detected/);
  const steady = alarmDesign.reference.replace("if (active && (millis() / 250) % 2 == 0) {", "if (active) {");
  assert.match(failed(runCheck(alarmDesign.final, steady)), /flash/);
});

// ---------------------------------------------------------------- completion

const solve = (p, lesson) => P.recordQuizResult(p, lesson.quiz.id, true, lesson.quiz.topic, { answers: lesson.quiz.questions.map((_, i) => [`${lesson.quiz.id}#${i}`, true]) });

test("a level needs lessons done AND checkpoints right AND projects passed - opening counts for nothing", () => {
  const p = fresh();
  let s = pathwayStatus("electronics", p);
  assert.equal(s.started, false);
  assert.equal(s.levelsComplete, 0);
  for (const id of ["pe-1", "pe-2", "pe-3", "pe-4"]) P.markPathwayLessonDone(p, "electronics", id);
  s = pathwayStatus("electronics", p);
  assert.equal(s.levels[0].complete, false, "done but not answered");
  assert.equal(s.next.id, "pe-1");
  for (const id of ["pe-1", "pe-2", "pe-3", "pe-4"]) solve(p, pathwayLessonById(id));
  s = pathwayStatus("electronics", p);
  assert.equal(s.levels[0].complete, true);
  assert.equal(s.levels[1].open, true);

  for (const id of ["pe-5", "pe-6", "pe-7", "pe-8"]) { P.markPathwayLessonDone(p, "electronics", id); solve(p, pathwayLessonById(id)); }
  assert.equal(pathwayStatus("electronics", p).levels[1].complete, false, "the projects are still needed");
  for (const pr of [ledControl, dividerMeter, lightCircuit]) P.recordProjectComplete(p, pr.id, "guided", 2);
  assert.equal(pathwayStatus("electronics", p).levels[1].complete, true);

  P.markPathwayLessonDone(p, "electronics", "pe-9");
  solve(p, pathwayLessonById("pe-9"));
  P.recordProjectComplete(p, alarmDesign.id, "guided", 0);
  s = pathwayStatus("electronics", p);
  assert.ok(s.levels[2].criteria.some((c) => !c.met && /Challenge or Independent/.test(c.text)), "Guided mode isn't a design");
  P.recordProjectComplete(p, alarmDesign.id, "independent", 0);
  P.saveProjectLog(p, alarmDesign.id, "decisions", "Short.");
  assert.equal(pathwayStatus("electronics", p).complete, false, "the design decisions must be written down");
  P.saveProjectLog(p, alarmDesign.id, "decisions", "x".repeat(DESIGN_LOG_MIN));
  s = pathwayStatus("electronics", p);
  assert.equal(s.complete, true);
  assert.equal(s.certificateAt, null);
  P.awardPathwayCertificate(p, "electronics", "Electronics");
  assert.ok(pathwayStatus("electronics", p).certificateAt);
  const when = p.pathways.electronics.certificateAt;
  P.awardPathwayCertificate(p, "electronics", "Electronics");
  assert.equal(p.pathways.electronics.certificateAt, when, "awarded once");
});

test("prerequisites are reported - core lessons and earlier pathway lessons", () => {
  const p = fresh();
  const gaps = lessonGaps(pathwayLessonById("pe-5"), p);
  assert.deepEqual(gaps.core.map((l) => l.id), ["l3-2", "l3-3"]);
  assert.deepEqual(gaps.pathway.map((l) => l.id), ["pe-4"]);
  assert.deepEqual(pathwayStatus("electronics", p).missingCore.map((l) => l.id), ["m1-7", "l2-4"]);
});

test("marking a pathway lesson done pays once, and is in the learning history", () => {
  const p = fresh();
  const xp = p.xp;
  P.markPathwayLessonDone(p, "electronics", "pe-1", "Electronic Components");
  P.markPathwayLessonDone(p, "electronics", "pe-1", "Electronic Components");
  assert.equal(p.xp, xp + P.CREDIT_REWARDS.lesson);
  assert.ok(p.activity.some((a) => /Pathway lesson done: Electronic Components/.test(a.label)));
});

// ---------------------------------------------------------------- integration

function readyLearner() {
  const p = fresh();
  for (const id of ["electronics", "circuits"]) {
    const a = areaReport(AREA_BY_ID[id], p);
    for (const l of a.lessons) if (!p.viewedLessons.includes(l.id)) p.viewedLessons.push(l.id);
    for (const item of a.items) P.recordAnswer(p, item.key, true);
  }
  for (const id of ["l2-4"]) if (!p.viewedLessons.includes(id)) p.viewedLessons.push(id);
  return p;
}

test("recommendations: ready -> start the pathway (with why); weak first -> revise; started -> next step", () => {
  let p = readyLearner();
  const start = recommendations(p, { limit: 10 }).find((r) => r.id === "pathway-start-electronics");
  assert.ok(start, "recommended");
  assert.match(start.why, /lessons it starts from/);
  assert.deepEqual(start.action, { type: "pathway", id: "electronics" });

  p = readyLearner();
  const item = areaReport(AREA_BY_ID.electronics, p).items[0];
  P.recordAnswer(p, item.key, false, new Date(Date.now() - 2 * 86400000));
  const recs = recommendations(p, { limit: 10 });
  assert.ok(!recs.some((r) => r.id === "pathway-start-electronics"));
  assert.ok(recs.some((r) => r.id === "pathway-revise-electronics"));

  p = readyLearner();
  P.startPathway(p, "electronics");
  const next = recommendations(p, { limit: 10 }).find((r) => r.id === "pathway-next-electronics");
  assert.equal(next.action.lessonId, "pe-1");
});

test("a missed pathway question comes back in revision, with its own lesson's recap", () => {
  const p = fresh();
  const key = "quiz-pe-5#0";
  assert.ok(QUESTION_BANK.some((i) => i.key === key));
  P.recordAnswer(p, key, false, new Date(Date.now() - 86400000));
  const s = buildSession(p);
  assert.equal(s.steps[0].recap.lessonId, "pe-5");
  assert.equal(s.steps[1].item.key, key);
  assert.equal(s.steps[2].item.lessonId, "pe-5", "the check question is from the same lesson");
});

test("pathway questions don't change the core skill areas", () => {
  const p = fresh();
  for (const l of PATHWAY_LESSONS) solve(p, l);
  for (const id of ["electronics", "circuits"]) assert.equal(areaReport(AREA_BY_ID[id], p).level, "not-started");
});

test("old saves gain pathways; broken pathway entries are dropped safely", () => {
  store.clear();
  store.set("arduinoTutorProgress", JSON.stringify({ viewedLessons: ["l1-1"], pathways: { electronics: { lessonsDone: "pe-1" }, bad: 5 } }));
  const p = P.loadProgress();
  assert.deepEqual(p.pathways, { electronics: { lessonsDone: [] } });
  assert.doesNotThrow(() => pathwayStatus("electronics", p));
  store.set("arduinoTutorProgress", JSON.stringify({ viewedLessons: [] }));
  assert.deepEqual(P.loadProgress().pathways, {});
});
