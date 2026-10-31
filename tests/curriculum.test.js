// The course structure itself: every lesson placed once, prerequisites that
// only point backwards, starter circuits that really load and are wired
// right, and the learning model (what's next, skills, revision) working on
// real progress data.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lessons, unplacedLessonIds, missingLessonIds } from "../js/lessons/data.js";
import { MODULES, SKILLS } from "../js/lessons/curriculum.js";
import { DEMO_NAMES } from "../js/lessons/demos.js";
import { TERMS } from "../js/lessons/terms.js";
import { quizzes, getQuizForLesson } from "../js/quiz/data.js";
import { createBoard } from "../js/simulator/board.js";
import { createFakeSvg } from "./helpers/fakeDom.js";
import { nextLesson, lessonStatus, skillReport, revisionQuizzes, missingNeeds } from "../js/progress/learning.js";
import { recordCheck, recordQuizResult } from "../js/progress/progress.js";

const fresh = () => ({ viewedLessons: [], lastLessonId: null, quizzes: {}, checks: {}, completedChallenges: [], flaggedLessons: [], hintUses: {} });

test("every lesson is placed in the course exactly once", () => {
  assert.deepEqual(unplacedLessonIds, []);
  assert.deepEqual(missingLessonIds, []);
  const ids = lessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(MODULES[0].number, 0);
});

test("prerequisites only point to earlier lessons", () => {
  const order = new Map(lessons.map((l, i) => [l.id, i]));
  for (const l of lessons) {
    for (const need of l.needs ?? []) {
      assert.ok(order.has(need), `${l.id} needs unknown ${need}`);
      assert.ok(order.get(need) < order.get(l.id), `${l.id} needs ${need}, which comes later`);
    }
  }
});

test("every lesson says why it matters, what you'll be able to do, and which skills it teaches", () => {
  for (const l of lessons) {
    assert.ok(l.why?.length > 20, `${l.id} has no "why"`);
    assert.ok(l.objectives?.length >= 1, `${l.id} has no objectives`);
    for (const s of l.skills ?? []) assert.ok(SKILLS[s], `${l.id}: unknown skill ${s}`);
    assert.ok(!l.body.some((b) => b.type === "objectives"), `${l.id} still has an old objectives block`);
    if (l.summary) for (const s of l.summary) assert.ok(typeof s === "string" && s.length > 10, `${l.id}: empty summary point`);
  }
});

test("every demo block names a demo that exists", () => {
  for (const l of lessons) {
    for (const b of l.body.filter((x) => x.type === "demo")) assert.ok(DEMO_NAMES.includes(b.demo), `${l.id}: no demo "${b.demo}"`);
  }
});

// Lessons whose starter circuit is broken on purpose (the learner fixes it).
const BROKEN_ON_PURPOSE = new Set(["m1-7"]);

test("every lesson circuit loads onto a real board, wired the way the lesson says", () => {
  let loaded = 0;
  for (const l of lessons) {
    for (const block of l.body.filter((b) => b.type === "circuit")) {
      const board = createBoard(createFakeSvg(), { random: () => 0.25 });
      const ids = board.loadCircuit(block);
      assert.equal(board.listComponents().length, block.parts.length, `${l.id}: every part placed`);
      assert.equal(board.wireCount(), block.wires.length, `${l.id}: every wire placed`);
      for (const part of block.parts.filter((p) => p.ohms)) {
        assert.equal(board.listComponents().find((c) => c.id === ids[part.key]).ohms, part.ohms, `${l.id}: resistor value`);
      }
      const problems = board.inspectCircuit().findings.filter((f) => f.level === "problem");
      if (BROKEN_ON_PURPOSE.has(l.id)) assert.ok(problems.length > 0, `${l.id}'s circuit should be broken`);
      else assert.deepEqual(problems.map((f) => f.text), [], `${l.id}'s circuit has wiring problems`);
      loaded++;
    }
  }
  assert.ok(loaded >= 5, `loaded ${loaded} circuits`);
});

test("explained words point at the lesson that teaches them", () => {
  const ids = new Set(lessons.map((l) => l.id));
  for (const [term, [definition, lessonId]] of Object.entries(TERMS)) {
    assert.ok(definition.length > 10, term);
    assert.ok(ids.has(lessonId), `${term}: no lesson ${lessonId}`);
  }
});

test("every checkpoint belongs to a lesson in the course, and quiz ids are unique", () => {
  const ids = new Set(lessons.map((l) => l.id));
  for (const lessonId of Object.keys(quizzes)) assert.ok(ids.has(lessonId), `quiz for unknown lesson ${lessonId}`);
  const quizIds = Object.values(quizzes).map((q) => q.id);
  assert.equal(new Set(quizIds).size, quizIds.length);
});

test("the next lesson is the unfinished one you were on, else the first unfinished", () => {
  const p = fresh();
  assert.equal(nextLesson(p).id, lessons[0].id);
  p.viewedLessons.push(lessons[0].id);
  assert.equal(nextLesson(p).id, lessons[1].id);
  p.lastLessonId = lessons[5].id;
  assert.equal(nextLesson(p).id, lessons[5].id, "part-way through lesson 6, so that's next");
  p.viewedLessons = lessons.map((l) => l.id);
  assert.equal(nextLesson(p), null);
});

test("lesson status: done, next, ready, locked (a warning, not a wall)", () => {
  const p = fresh();
  const [first, second] = lessons;
  assert.equal(lessonStatus(first, p, nextLesson(p)), "next");
  assert.equal(lessonStatus(second, p, nextLesson(p)), second.needs?.length ? "locked" : "ready");
  p.viewedLessons.push(first.id);
  assert.equal(lessonStatus(first, p, nextLesson(p)), "done");
  assert.deepEqual(missingNeeds(second, p), []);
});

test("passing a check without hints counts as independent; a wrong checkpoint is flagged for revision", () => {
  let p = { ...fresh(), stats: {}, daily: { counters: {} }, achievements: {}, credits: 0, xp: 0, milestonesAwarded: [] };
  const withChallenge = lessons.find((l) => l.challenge);
  p = recordCheck(p, withChallenge.challenge.id, true);
  assert.equal(p.checks[withChallenge.challenge.id].independent, true);
  const quizLesson = lessons.find((l) => getQuizForLesson(l.id));
  const quiz = getQuizForLesson(quizLesson.id);
  p = recordQuizResult(p, quiz.id, false, quiz.topic);
  const skill = skillReport(p).find((k) => quizLesson.skills.includes(k.id));
  assert.ok(skill.revision.length > 0, "the missed checkpoint shows up as something to revise");
});

test("a revision round offers checkpoints you've tried, even in an unfinished lesson - missed ones first", () => {
  const p = fresh();
  const [a, b] = lessons.filter((l) => getQuizForLesson(l.id));
  p.viewedLessons.push(a.id);
  p.quizzes[getQuizForLesson(b.id).id] = { attempts: 1, solved: false, lastResult: "failure" };
  const round = revisionQuizzes(p, 3, () => 0.5);
  assert.equal(round[0].lesson.id, b.id, "the missed checkpoint comes first");
  assert.ok(round.some((x) => x.lesson.id === a.id), "the finished lesson's checkpoint is in too");
});

// ---- Phase 2: the lesson parts and checkpoints for Modules 0-2 ----
import { DIAGRAM_NAMES } from "../js/lessons/diagrams.js";
import { runSketch } from "./helpers/sim.js";
import { isFullSketch } from "../js/lessons/render.js";

const runCode = (code, ms = 3000) =>
  runSketch(isFullSketch(code) ? code : `void setup() {\nSerial.begin(9600);\n${code}\n}\nvoid loop() {}`, { ms });

test("every diagram block names a diagram that exists", () => {
  for (const l of lessons) {
    for (const b of l.body.filter((x) => x.type === "diagram")) assert.ok(DIAGRAM_NAMES.includes(b.diagram), `${l.id}: no diagram "${b.diagram}"`);
  }
});

test("checkpoint questions: every option is explained, and stated outputs are what the simulator prints", () => {
  let ran = 0;
  for (const quiz of Object.values(quizzes).filter((x) => x.type === "questions")) {
    assert.ok(quiz.questions.length >= 2, `${quiz.id}: a set has at least two questions`);
    for (const [i, question] of quiz.questions.entries()) {
      const where = `${quiz.id} question ${i + 1}`;
      assert.ok(question.options[question.answer] !== undefined, `${where}: the answer is one of the options`);
      assert.equal(question.why.length, question.options.length, `${where}: one explanation per option`);
      for (const w of question.why) assert.ok(w.length > 10, `${where}: an empty explanation`);
      if (question.output !== undefined) {
        const r = runCode(question.code, question.ms);
        assert.deepEqual(r.errors, [], where);
        assert.equal(r.lines.join("\n"), question.output, `${where}: the stated output must be what the sketch prints`);
        ran++;
      }
    }
  }
  assert.ok(ran >= 2, `ran ${ran} checkpoint sketches`);
});

test("lesson questions and predictions explain each wrong option", () => {
  for (const l of lessons) {
    for (const b of l.body.filter((x) => x.type === "question" || x.type === "predict")) {
      if (b.why) assert.equal(b.why.length, b.options.length, `${l.id}: one "why" per option`);
      if (b.why) b.why.forEach((w, i) => { if (i !== b.answer) assert.ok(w.length > 10, `${l.id}: option ${i + 1} isn't explained`); });
    }
  }
});

test("exercises have an expected result; debug ones are really broken and their fix really works", () => {
  for (const l of lessons) {
    for (const b of l.body.filter((x) => x.type === "exercise")) {
      assert.ok(["modify", "debug", "independent"].includes(b.kind), `${l.id}: exercise kind`);
      assert.ok(b.expected?.length > 20, `${l.id}: exercise needs an expected result`);
      if (b.kind === "debug" && b.code) {
        assert.notEqual(b.code, b.solution, `${l.id}: the fix differs from the bug`);
        assert.ok(b.solution, `${l.id}: a debug exercise shows a fix`);
      }
    }
    for (const b of l.body.filter((x) => x.type === "guided" && x.broken)) {
      assert.ok(runCode(b.code, 200).errors.length > 0, `${l.id}: a guided sketch marked broken should really fail`);
    }
  }
});

test("Modules 0-2 follow the full lesson structure", () => {
  for (const l of lessons.filter((x) => x.module <= 2)) {
    const kinds = new Set(l.body.map((b) => b.section ?? b.type));
    assert.ok(l.summary?.length >= 2, `${l.id}: summary`);
    assert.ok(getQuizForLesson(l.id), `${l.id}: knowledge checkpoint`);
    assert.ok(kinds.has("application"), `${l.id}: real-world application`);
    assert.ok(l.challenge || kinds.has("exercise") || kinds.has("experiment"), `${l.id}: something to do independently`);
  }
});

// What the Module 1 guided activities tell the learner will happen.
test("Module 1's guided circuits behave the way their steps say", () => {
  const board = (wires) => {
    const b = createBoard(createFakeSvg(), { random: () => 0.25 });
    b.loadCircuit({ parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }], wires });
    b.setRunning(true);
    return b;
  };
  const problems = (b) => b.inspectCircuit().findings.filter((f) => f.level === "problem").map((f) => f.text);
  const lit = (b) => b.ledLevels()["led-1"] > 0;
  // Open and Closed Circuits: lit while closed; remove the 5V wire and it's dark, and Check Circuit says why
  assert.ok(lit(board([["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]])));
  const open = board([["r.2", "led.a"], ["led.k", "gnd"]]);
  assert.ok(!lit(open));
  assert.match(problems(open)[0], /doesn't reach a pin or 5V/);
  // Ground: the other GND pin works too; 5V straight to GND is called a short circuit
  assert.ok(lit(board([["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd-pwr2"]])));
  assert.ok(problems(board([["5v", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"], ["5v", "gnd-pwr2"]])).some((t) => /short circuit/.test(t)));
  // Breadboards: built through the rails and one column, it's a complete circuit
  const bb = board([["5v-railtop-2", "r.1"], ["r.2", "grid-c5-t0"], ["led.a", "grid-c5-t3"], ["led.k", "gnd-railtop-4"]]);
  assert.ok(lit(bb));
  assert.ok(bb.inspectCircuit().findings.some((f) => f.level === "ok" && /Complete circuit: 5V → resistor → LED → GND/.test(f.text)));
});
