// The learner profile (Phase 5): skill levels come from evidence, spaced
// revision follows its schedule, recommendations always carry their reason,
// goals measure real work, saves survive corruption, and the tutor answers
// the questions it should - honestly, and from the learner's real board.

import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const P = await import("../js/progress/progress.js");
const { masteryReport, AREAS, unplacedSkills, areaReport, AREA_BY_ID } = await import("../js/progress/skills.js");
const { QUESTION_BANK, itemByKey, revisionQuiz } = await import("../js/progress/questionBank.js");
const { buildSession, pendingQuestions, revisionSummary } = await import("../js/progress/revision.js");
const { recommendations } = await import("../js/progress/recommend.js");
const { nextChallenge, activitiesFor } = await import("../js/progress/challenges.js");
const { GOALS, goalStatus, availableGoals, newlyReached } = await import("../js/progress/goals.js");
const { mistakeFromProblem } = await import("../js/progress/mistakes.js");
const { feedbackFor, overview } = await import("../js/progress/insights.js");
const { answer, diagnoseLed, diagnoseError } = await import("../js/tutor/tutor.js");
const { TOPICS } = await import("../js/tutor/knowledge.js");
const { lessons } = await import("../js/lessons/data.js");
const { BEGINNER_PROJECTS } = await import("../js/projects/beginner.js");
const { createBoard } = await import("../js/simulator/board.js");
const { createFakeSvg } = await import("./helpers/fakeDom.js");

const fresh = () => { store.clear(); return P.loadProgress(); };
const DAY = 86400000;
const at = (daysAgo) => new Date(Date.now() - daysAgo * DAY);
const area = (p, id, now) => areaReport(AREA_BY_ID[id], p, now);
const itemsOf = (id) => area(fresh(), id).items;
// answer every question of an area, right first time
function answerAll(p, id, right = true) {
  for (const item of itemsOf(id)) P.recordAnswer(p, item.key, right);
}
const doLessons = (p, list) => { for (const l of list) if (!p.viewedLessons.includes(l.id)) p.viewedLessons.push(l.id); };

// ---------------------------------------------------------------- the model

test("every fine skill belongs to exactly one skill area, and every area has lessons", () => {
  assert.deepEqual(unplacedSkills, []);
  assert.equal(AREAS.length, 10);
  for (const a of masteryReport(fresh())) assert.ok(a.lessons.length > 0, a.id);
});

test("question keys are unique, and every one can be shown again in revision", () => {
  const keys = QUESTION_BANK.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const item of QUESTION_BANK) {
    const quiz = revisionQuiz(item);
    assert.ok(quiz.type, item.key);
    if (!item.quiz) assert.deepEqual(quiz.keys, [item.key], "a single question reports under its own key");
  }
});

test("a brand-new learner: nothing started, and the only suggestion is the first lesson, saying why", () => {
  const p = fresh();
  for (const a of masteryReport(p)) assert.equal(a.level, "not-started", a.id);
  const recs = recommendations(p);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].action.id, lessons[0].id);
  assert.match(recs[0].why, /no experience needed/i);
  assert.equal(overview(masteryReport(p)).started, false);
});

test("finishing lessons alone never gets past Learning", () => {
  const p = fresh();
  doLessons(p, area(p, "electronics").lessons);
  const a = area(p, "electronics");
  assert.equal(a.level, "learning");
  assert.ok(a.toNext.some((c) => /question/.test(c.text)), "says what's missing");
});

test("Developing -> Proficient -> Mastered need answers, then understanding, then no repeated mistakes", () => {
  const p = fresh();
  const lessonsE = area(p, "electronics").lessons;
  doLessons(p, lessonsE.slice(0, Math.ceil(lessonsE.length / 2)));
  P.recordAnswer(p, itemsOf("electronics")[0].key, true);
  assert.equal(area(p, "electronics").level, "developing");

  doLessons(p, lessonsE);
  answerAll(p, "electronics");
  const items = itemsOf("electronics");
  // one wrong and not put right: Proficient, but not Mastered
  P.recordAnswer(p, items[1].key, false);
  let a = area(p, "electronics");
  assert.equal(a.level, "proficient");
  assert.ok(a.criteria.mastered.some((c) => !c.met && /none still wrong/.test(c.text)));
  // put right after a gap (due day reached) -> understood -> Mastered
  P.recordAnswer(p, items[1].key, true, new Date(Date.now() + 2 * DAY));
  a = area(p, "electronics", new Date(Date.now() + 2 * DAY));
  assert.equal(a.level, "mastered");
  // electronics has no practical work yet: shown as not needed, not silently passed
  assert.ok(a.criteria.proficient.some((c) => c.na));
  // a mistake repeated this week takes Mastered away again
  const lessonId = lessonsE[0].id;
  p.mistakes["error:test"] = { label: "test", lessonId, times: [at(2).toISOString(), at(1).toISOString()] };
  assert.equal(area(p, "electronics").level, "proficient");
});

test("practical areas need passed checks, and Mastered needs work done without hints", () => {
  const p = fresh();
  const a0 = area(p, "logic");
  doLessons(p, a0.lessons);
  answerAll(p, "logic");
  assert.equal(area(p, "logic").level, "developing", "no practical passed yet");
  const challenges = a0.practicals.filter((x) => x.kind === "challenge");
  for (const c of challenges) {
    p.hintUses[c.id] = 1; // solved with a hint
    P.recordCheck(p, c.id, true);
  }
  let a = area(p, "logic");
  assert.equal(a.level, "proficient");
  assert.ok(a.criteria.mastered.some((c) => !c.met && /no hints/.test(c.text)));
  // two projects using if/loops, built in Independent mode
  for (const pr of BEGINNER_PROJECTS.slice(0, 2)) p.projects[pr.id] = { stagesDone: [], completed: { independent: { hints: 0 } } };
  a = area(p, "logic");
  assert.equal(a.level, "mastered");
});

// ---------------------------------------------------------------- spaced revision

test("spaced revision: a miss is due tomorrow; right the same day doesn't count; then 3 days, 7 days, secure", () => {
  const p = fresh();
  const key = QUESTION_BANK[0].key;
  const d0 = new Date(2026, 0, 10, 12);
  P.recordAnswer(p, key, false, d0);
  assert.equal(p.answers[key].box, 1);
  assert.equal(p.answers[key].due, "2026-01-11");
  P.recordAnswer(p, key, true, new Date(2026, 0, 10, 12, 5));
  assert.equal(p.answers[key].box, 1, "same-day correction doesn't move it on");
  P.recordAnswer(p, key, true, new Date(2026, 0, 11, 9));
  assert.deepEqual([p.answers[key].box, p.answers[key].due], [2, "2026-01-14"]);
  P.recordAnswer(p, key, true, new Date(2026, 0, 12, 9));
  assert.equal(p.answers[key].box, 2, "too early - not due yet");
  P.recordAnswer(p, key, true, new Date(2026, 0, 14, 9));
  assert.deepEqual([p.answers[key].box, p.answers[key].due], [3, "2026-01-21"]);
  P.recordAnswer(p, key, true, new Date(2026, 0, 21, 9));
  assert.deepEqual([p.answers[key].box, p.answers[key].due], [P.SECURE_BOX, null]);
  P.recordAnswer(p, key, false, new Date(2026, 0, 25, 9));
  assert.equal(p.answers[key].box, 1, "a later miss starts again");
  assert.equal(p.answers[key].first, false);
});

test("a revision session: recap, the missed question, then a different question on the same idea", () => {
  const p = fresh();
  assert.equal(buildSession(p), null, "nothing missed, nothing to revise");
  const target = QUESTION_BANK.find((i) => i.question && QUESTION_BANK.filter((j) => j.lessonId === i.lessonId && !j.quiz).length > 1);
  P.recordAnswer(p, target.key, false, at(1));
  const s = buildSession(p);
  assert.equal(s.steps[0].type, "recap");
  assert.equal(s.steps[0].recap.lessonId, target.lessonId);
  assert.equal(s.steps[1].item.key, target.key);
  assert.equal(s.steps[1].role, "missed");
  assert.equal(s.steps[2].role, "check");
  assert.notEqual(s.steps[2].item.key, target.key);
  assert.equal(s.steps[2].item.lessonId, target.lessonId, "same idea: same lesson first");
  assert.equal(revisionSummary(p).due, 1);
});

test("a revision session prefers due questions over ones missed a minute ago, and holds at most three ideas", () => {
  const p = fresh();
  const singles = QUESTION_BANK.filter((i) => i.question);
  for (const item of singles.slice(0, 5)) P.recordAnswer(p, item.key, false, at(2));
  P.recordAnswer(p, singles[10].key, false); // today
  const s = buildSession(p);
  const missed = s.steps.filter((x) => x.role === "missed").map((x) => x.item.key);
  assert.equal(missed.length, 3);
  assert.ok(!missed.includes(singles[10].key));
  assert.equal(pendingQuestions(p).length, 6);
});

// ---------------------------------------------------------------- recommendations

test("every recommendation follows a rule and says why, from real evidence", () => {
  const p = fresh();
  doLessons(p, lessons.slice(0, 20));
  const key = QUESTION_BANK.find((i) => i.question).key;
  P.recordAnswer(p, key, false, at(1));
  for (let i = 3; i >= 1; i--) P.recordMistake(p, "error:semicolon", "a missing semicolon", "l1-15", at(i));
  const recs = recommendations(p);
  assert.ok(recs.length >= 2);
  for (const r of recs) assert.ok(r.why.length > 20 && r.rule >= 1 && r.action.type, r.id);
  assert.equal(recs[0].rule, 1, "due revision comes first");
  const m = recs.find((r) => r.rule === 3);
  assert.ok(m, "the repeated mistake is picked up");
  assert.equal(m.action.id, "l1-15");
  assert.match(m.why, /3 times/);
});

test("a challenge that keeps failing, and a project that keeps failing, each get a targeted suggestion", () => {
  const p = fresh();
  const lesson = lessons.find((l) => l.challenge && l.needs.length);
  doLessons(p, lessons.slice(0, lessons.indexOf(lesson) + 1));
  for (let i = 0; i < 3; i++) P.recordCheck(p, lesson.challenge.id, false);
  const project = BEGINNER_PROJECTS[1];
  for (let i = 0; i < 3; i++) P.recordProjectCheck(p, project.id, false);
  const recs = recommendations(p, { limit: 10 });
  const c = recs.find((r) => r.rule === 4);
  assert.ok(c);
  assert.match(c.why, /failed its check 3 times/);
  const pr = recs.find((r) => r.rule === 5);
  assert.ok(pr);
  assert.match(pr.why, new RegExp(project.title));
});

test("recent questions missed today aren't pushed back at the learner straight away", () => {
  const p = fresh();
  P.recordAnswer(p, QUESTION_BANK.find((i) => i.question).key, false);
  assert.ok(!recommendations(p).some((r) => r.rule === 1 || r.rule === 2));
});

test("practical work without hints unlocks a harder challenge, explained", () => {
  const p = fresh();
  const a = area(p, "digital");
  doLessons(p, a.lessons);
  answerAll(p, "digital");
  const easy = a.practicals.filter((x) => x.kind === "challenge").slice(0, 2);
  for (const c of easy) P.recordCheck(p, c.id, true);
  const rec = recommendations(p, { limit: 10 }).find((r) => r.rule === 6);
  assert.ok(rec, "a step-up suggestion");
  assert.match(rec.why, /without hints/);
});

// ---------------------------------------------------------------- adaptive challenges

test("the challenge level follows the area's level, and steps DOWN when one keeps failing", () => {
  const p = fresh();
  const a0 = area(p, "digital");
  doLessons(p, a0.lessons);
  P.recordAnswer(p, area(p, "digital").items[0].key, true);
  let a = area(p, "digital");
  assert.equal(a.level, "developing");
  let next = nextChallenge(a, p);
  assert.equal(next.level, 2);
  assert.match(next.why, /Developing/);
  // a level-2 activity that has failed twice -> offered something at level 1
  const level2 = activitiesFor(a, p).find((x) => x.level === 2 && x.kind === "challenge");
  P.recordCheck(p, level2.id, false);
  P.recordCheck(p, level2.id, false);
  a = area(p, "digital");
  next = nextChallenge(a, p);
  assert.equal(next.level, 1);
  assert.match(next.why, /failed its check 2 times/);
});

// ---------------------------------------------------------------- goals

test("goals measure real work, are reached once, and aren't offered when already met", () => {
  const p = fresh();
  assert.ok(GOALS.every((g) => g.title && g.why));
  P.setGoal(p, "module-0");
  let [status] = goalStatus(p, masteryReport(p));
  assert.equal(status.current, 0);
  const m0 = lessons.filter((l) => l.module === 0);
  doLessons(p, m0);
  assert.equal(newlyReached(p, masteryReport(p)).length, 0, "lessons alone don't finish it - the checkpoints count too");
  for (const l of m0) {
    const quiz = QUESTION_BANK.find((i) => i.lessonId === l.id && i.quizId)?.quizId;
    if (quiz) P.recordQuizResult(p, quiz, true, "t", { answers: [] });
  }
  assert.deepEqual(newlyReached(p, masteryReport(p)), ["module-0"]);
  P.markGoalsDone(p, ["module-0"], { "module-0": "Module 0" });
  [status] = goalStatus(p, masteryReport(p));
  assert.ok(status.reached && status.saved.doneAt);
  assert.ok(!availableGoals(p).some((g) => g.id === "module-0"));
  assert.ok(p.activity.some((a) => /Goal reached/.test(a.label)));
});

// ---------------------------------------------------------------- saves

test("an old save without the profile fields keeps everything and gains the new ones", () => {
  store.clear();
  store.set("arduinoTutorProgress", JSON.stringify({
    viewedLessons: ["l1-1", "l1-2"], completedChallenges: ["c1"], credits: 140, xp: 300,
    quizzes: { "quiz-structure": { attempts: 3, solved: true, lastResult: "success", topic: "Program Structure" } },
    checks: { c1: { attempts: 2, passed: true, independent: true } },
  }));
  const p = P.loadProgress();
  assert.equal(p.credits, 140);
  assert.deepEqual(p.viewedLessons, ["l1-1", "l1-2"]);
  assert.deepEqual([p.answers, p.mistakes, p.activity, p.goals, p.revisionLog], [{}, {}, [], [], []]);
  // the old checkpoint, solved only after retries, is treated as worth a review
  const pend = pendingQuestions(p);
  assert.ok(pend.some((x) => x.item.quizId === "quiz-structure" && x.a.legacy));
  assert.doesNotThrow(() => masteryReport(p));
  assert.doesNotThrow(() => recommendations(p));
});

test("corrupted saves load safely instead of crashing", () => {
  for (const bad of [
    "{not json",
    "null",
    "42",
    JSON.stringify({ viewedLessons: "l1-1", quizzes: [], answers: "x", activity: { a: 1 }, goals: null, mistakes: { e: { times: "x" } }, projects: { p: 5 }, credits: "lots" }),
    JSON.stringify({ answers: { k: { n: "one", last: true }, good: { n: 1, last: false, first: false, box: 1, due: "2026-01-01" } }, activity: [{ at: 1 }, { at: "2026-01-01T00:00:00Z", label: "ok", kind: "lesson" }] }),
  ]) {
    store.clear();
    store.set("arduinoTutorProgress", bad);
    const p = P.loadProgress();
    assert.ok(Array.isArray(p.viewedLessons) && Array.isArray(p.activity) && Array.isArray(p.goals));
    assert.ok(Number.isFinite(p.credits));
    assert.doesNotThrow(() => masteryReport(p));
    assert.doesNotThrow(() => recommendations(p));
    assert.doesNotThrow(() => P.recordAnswer(p, QUESTION_BANK[0].key, true));
  }
  store.set("arduinoTutorProgress", JSON.stringify({ answers: { k: { n: "one", last: true }, good: { n: 1, last: false, first: false } } }));
  assert.deepEqual(Object.keys(P.loadProgress().answers), ["good"], "only the malformed entry is dropped");
});

test("the learning history is capped, and pressing Check again isn't logged twice", () => {
  const p = fresh();
  for (let i = 0; i < 100; i++) P.recordQuizResult(p, `quiz-${i}`, true, "t");
  assert.equal(p.activity.length, 80);
  const q = fresh();
  for (let i = 0; i < 5; i++) P.recordQuizResult(q, "quiz-order", false, "Order");
  assert.equal(q.activity.length, 1);
});

// ---------------------------------------------------------------- mistakes and feedback

test("simulator problems become named mistakes; the simulator's own limits never count", () => {
  assert.deepEqual(mistakeFromProblem({ type: "error", message: "Line 2: Missing ';' at the end of this line", details: { kind: "syntax", line: 2, message: "Line 2: Missing ';' at the end of this line" } }),
    { id: "error:semicolon", label: "a missing semicolon ( ; ) at the end of a line", lessonId: "l1-15" });
  assert.equal(mistakeFromProblem({ type: "error", message: "x is not supported", details: { kind: "unsupported" } }), null);
  assert.equal(mistakeFromProblem({ type: "warning", message: "pin 13 was never set up with pinMode(13, OUTPUT)" }).id, "warning:no-pinmode");
  const c = mistakeFromProblem({ type: "circuit", message: "It's in backwards: the long leg (+) goes to GND", finding: { level: "problem", subject: "LED", text: "It's in backwards: the long leg (+) goes to GND" } });
  assert.deepEqual([c.id, c.lessonId], ["circuit:backwards", "m1-7"]);
  const p = fresh();
  const t = new Date();
  P.recordMistake(p, "error:semicolon", "x", "l1-15", t);
  P.recordMistake(p, "error:semicolon", "x", "l1-15", new Date(t.getTime() + 5000));
  assert.equal(p.mistakes["error:semicolon"].times.length, 1, "the same moment isn't counted twice");
});

test("feedback after a checkpoint states what happened, from the record", () => {
  const p = fresh();
  const items = QUESTION_BANK.filter((i) => i.quizId === QUESTION_BANK[0].quizId);
  const answers = items.map((i, n) => [i.key, n !== 0]);
  for (const [k, r] of answers) P.recordAnswer(p, k, r);
  const lines = feedbackFor(p, masteryReport(p), { lessonId: items[0].lessonId, answers });
  assert.equal(lines[0].text, `${items.length - 1} of ${items.length} right first time.`);
  assert.ok(lines.some((l) => /revision list/.test(l.text)));
  assert.ok(lines.some((l) => l.kind === "area"));
});

// ---------------------------------------------------------------- the tutor

test("the tutor answers the questions a beginner asks, and links real lessons", () => {
  const expect = {
    "What is voltage?": "voltage",
    "Why does an LED need a resistor?": "ledResistor",
    "What does pinMode() do?": "pinMode",
    "What is the difference between digitalRead() and digitalWrite()?": "digitalReadWrite",
    "Why is my LED not turning on?": "troubleshootLed",
    "How do I understand this error message?": "errorMessage",
    "Why does my code use a variable?": "variables",
    "what is ohms law": "resistance",
    "how do I make an LED fade": "pwm",
  };
  for (const [q, id] of Object.entries(expect)) assert.equal(answer(q).id, id, q);
  const ids = new Set(lessons.map((l) => l.id));
  for (const t of TOPICS) {
    for (const l of t.lessons) assert.ok(ids.has(l), `${t.id} -> ${l}`);
    assert.ok(t.steps.length >= 2, t.id);
  }
  assert.equal(answer("tone").kind, "command");
  assert.equal(answer("what is the capital of France?").kind, "unknown");
  assert.match(answer("what is the capital of France?").steps[0], /rule-based/);
});

const findingsFor = (wiring) => {
  const b = createBoard(createFakeSvg(), { random: () => 0.25 });
  b.loadCircuit(wiring);
  return b.inspectCircuit().findings;
};
const LED_ON_13 = { parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }], wires: [["pin-13", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] };
const BLINK = (pin) => `void setup() { pinMode(${pin}, OUTPUT); }\nvoid loop() { digitalWrite(${pin}, HIGH); delay(500); digitalWrite(${pin}, LOW); delay(500); }`;

test("'why isn't my LED on?' reads the real board and code - and hints before it fixes", () => {
  const ok = diagnoseLed({ code: BLINK(13), findings: findingsFor(LED_ON_13) });
  assert.ok(ok.fine);
  assert.match(ok.summary, /pin 13/);

  const wrongPin = diagnoseLed({ code: BLINK(12), findings: findingsFor(LED_ON_13) });
  assert.match(wrongPin.summary, /wired to pin 13, but the sketch switches pin 12/);
  assert.match(wrongPin.hints[0], /\?$/, "the first hint is a question");

  const noMode = diagnoseLed({ code: "void setup() {}\nvoid loop() { digitalWrite(13, HIGH); }", findings: findingsFor(LED_ON_13) });
  assert.match(noMode.summary, /never sets it up as an OUTPUT/);

  const flash = diagnoseLed({ code: "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); digitalWrite(13, LOW); delay(500); }", findings: findingsFor(LED_ON_13) });
  assert.match(flash.summary, /too short to see/);

  const backwards = { ...LED_ON_13, wires: [["pin-13", "r.1"], ["r.2", "led.k"], ["led.a", "gnd"]] };
  const bw = diagnoseLed({ code: BLINK(13), findings: findingsFor(backwards) });
  assert.match(bw.hints[1], /backwards|wrong way/);
  assert.equal(bw.lessonId, "m1-7");

  assert.match(diagnoseLed({ code: BLINK(13), findings: findingsFor({ parts: [], wires: [] }) }).summary, /no LED/);
  assert.match(diagnoseLed({ code: "void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}", findings: findingsFor(LED_ON_13) }).summary, /error/);
  assert.equal(diagnoseLed({}), null, "outside a workspace there's nothing to look at");
});

test("'what does this error mean?' explains the last real error, or a pasted one", () => {
  const d = diagnoseError({ lastError: { kind: "syntax", line: 2, message: "Line 2: Missing ';' at the end of this line" } });
  assert.match(d.summary, /syntax error on line 2/);
  assert.ok(d.hints.length >= 1);
  assert.equal(d.lessonId, "l1-15");
  const pasted = answer("Line 4: 'ledpin' was not declared");
  assert.equal(pasted.id, "errorMessage");
  assert.match(pasted.diagnosis.summary, /not declared/);
  assert.ok(diagnoseError({}).none);
});
