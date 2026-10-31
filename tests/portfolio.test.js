// The engineering portfolio (Phase 7): a completed project's real code and
// circuit are captured as a version; documentation drafts persist; versions
// are snapshots that are never overwritten; comparisons are correct; how much
// documentation is required follows difficulty; backups restore without
// overwriting anything; broken storage never crashes; circuits round-trip.

import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const PF = await import("../js/portfolio/portfolio.js");
const M = await import("../js/portfolio/model.js");
const { BEGINNER_PROJECTS, toggleLamp } = await import("../js/projects/beginner.js");
const { PATHWAY_PROJECTS } = await import("../js/pathways/data.js");
const { alarmDesign, dividerMeter } = await import("../js/pathways/electronicsProjects.js");
const { runCheck } = await import("../js/lessons/checks.js");
const { createBoard } = await import("../js/simulator/board.js");
const { createFakeSvg } = await import("./helpers/fakeDom.js");
const P = await import("../js/progress/progress.js");

const boardWith = (wiring) => { const b = createBoard(createFakeSvg(), { random: () => 0.25 }); b.loadCircuit(wiring); return b; };
const fresh = () => { store.clear(); return PF.loadPortfolio(); };
function complete(pf, project, mode = "guided", code = project.reference) {
  const b = boardWith(project.wiring);
  const result = runCheck(project.final, code, b.inspectCircuit().findings);
  assert.equal(result.status, "pass");
  return PF.captureCompletion(pf, project, { mode, hints: 1, result, code, circuit: b.exportCircuit(), log: { problems: "It flickered at first." } });
}

test("the board exports a circuit that loads back identically", () => {
  for (const project of [...BEGINNER_PROJECTS, ...PATHWAY_PROJECTS]) {
    const a = boardWith(project.wiring);
    const spec = a.exportCircuit();
    const b = boardWith(spec);
    assert.deepEqual(b.exportCircuit(), spec, project.id);
    assert.deepEqual(b.inspectCircuit().findings, a.inspectCircuit().findings, `${project.id}: same circuit, same findings`);
  }
});

test("completing a project captures the real code, circuit and check results as version 1", () => {
  const pf = fresh();
  const e = complete(pf, toggleLamp);
  assert.equal(e.id, PF.entryIdFor(toggleLamp.id));
  assert.equal(e.code, toggleLamp.reference);
  assert.equal(e.circuit.parts.length, toggleLamp.wiring.parts.length);
  assert.ok(e.evidence.checks.length > 0 && e.evidence.checks.every((c) => c.ok));
  assert.deepEqual(e.evidence.modes, ["guided"]);
  assert.equal(e.versions.length, 1);
  assert.match(e.versions[0].name, /Version 1/);
  assert.equal(e.versions[0].source, "completion");
  // pre-filled from the library and the project log - and still editable
  assert.equal(e.doc.overview.what, toggleLamp.summary);
  assert.equal(e.doc.problems.what, "It flickered at first.");
  assert.equal(M.categoryFor(toggleLamp), e.category);
  assert.equal(e.difficulty, "beginner");
});

test("completing again adds a version - nothing is overwritten", () => {
  const pf = fresh();
  complete(pf, alarmDesign, "guided");
  const v1 = JSON.stringify(pf.entries[PF.entryIdFor(alarmDesign.id)].versions[0]);
  const alt = alarmDesign.reference.replace("tone(BUZZER, 1000);", "tone(BUZZER, 1500);");
  const e = complete(pf, alarmDesign, "independent", alt);
  assert.equal(e.versions.length, 2);
  assert.equal(JSON.stringify(e.versions[0]), v1, "version 1 is untouched");
  assert.equal(e.code, alt);
  assert.deepEqual(e.evidence.modes, ["guided", "independent"]);
  assert.equal(e.difficulty, "advanced");
  assert.equal(e.category, "design");
});

test("an improvement that passes its check is saved as its own version", () => {
  const pf = fresh();
  complete(pf, dividerMeter);
  const imp = dividerMeter.improvements.find((i) => i.check);
  const v = PF.captureImprovement(pf, dividerMeter, imp, { code: "// improved", circuit: null });
  assert.equal(v.n, 2);
  assert.match(v.name, /Improvement: Over-voltage warning/);
  assert.equal(PF.captureImprovement(pf, toggleLamp, imp, { code: "" }), null, "no record, no version");
});

test("documentation drafts persist across a reload; unknown sections are refused", () => {
  const pf = fresh();
  const e = complete(pf, toggleLamp);
  PF.updateDoc(pf, e.id, "reflection", "learned", "Comparing with the last reading catches the moment of a press.");
  assert.equal(PF.updateDoc(pf, e.id, "nonsense", "x", "y"), null);
  assert.ok(PF.savePortfolio(pf).ok);
  const again = PF.loadPortfolio();
  assert.equal(again.entries[e.id].doc.reflection.learned, "Comparing with the last reading catches the moment of a press.");
});

test("required documentation grows with difficulty", () => {
  assert.deepEqual(M.REQUIRED.beginner, ["overview", "components", "testing", "reflection"]);
  assert.equal(M.REQUIRED.advanced.length, 9);
  const pf = fresh();
  const e = complete(pf, toggleLamp);
  let s = M.docStatus(e);
  assert.equal(s.complete, false);
  assert.ok(s.done.includes("overview"), "pre-filled overview counts once every answer is there");
  for (const sec of M.REQUIRED.beginner) for (const [f] of M.sectionById(sec).fields) PF.updateDoc(pf, e.id, sec, f, "A real answer here.");
  s = M.docStatus(e);
  assert.equal(s.complete, true);
  assert.equal(s.label, "Documented");
  const adv = complete(pf, alarmDesign);
  for (const sec of M.REQUIRED.beginner) for (const [f] of M.sectionById(sec).fields) PF.updateDoc(pf, adv.id, sec, f, "A real answer here.");
  assert.equal(M.docStatus(adv).complete, false, "an advanced project needs all nine sections");
});

test("your own record: starts from Free Practice work, and versions snapshot the documentation too", () => {
  const pf = fresh();
  const circuit = boardWith(toggleLamp.wiring).exportCircuit();
  const e = PF.createOwnEntry(pf, { title: "Night light", category: "sensors", difficulty: "intermediate", template: "sensors", code: "void setup(){}\nvoid loop(){}", circuit });
  assert.equal(e.projectId, null);
  assert.equal(e.evidence, null, "no check, so no claimed evidence");
  assert.equal(e.versions.length, 1);
  PF.updateDoc(pf, e.id, "overview", "what", "First idea");
  PF.saveVersion(pf, e.id, { name: "Added a threshold", changes: "LED switches at 300.", code: "void setup(){}\nvoid loop(){ /* v2 */ }" });
  PF.updateDoc(pf, e.id, "overview", "what", "Changed later");
  assert.equal(e.versions[1].doc.overview.what, "First idea", "a version keeps the documentation as it was");
  assert.equal(e.versions[0].code, "void setup(){}\nvoid loop(){}");
  const keep = PF.saveVersion(pf, e.id, { name: "Docs only" });
  assert.equal(keep.code, e.versions[1].code, "keeping the code carries it forward");
  PF.updateMeta(pf, e.id, { title: "Night light v2", difficulty: "advanced", category: "not-a-category" });
  assert.equal(e.title, "Night light v2");
  assert.equal(e.difficulty, "advanced");
  assert.equal(e.category, "programming", "an unknown category falls back safely");
  const lib = complete(pf, toggleLamp);
  PF.updateMeta(pf, lib.id, { difficulty: "advanced" });
  assert.equal(lib.difficulty, "beginner", "a library project's difficulty is fixed");
});

test("projects completed before the portfolio: recorded without inventing code", () => {
  const pf = fresh();
  const e = PF.addCompletedEarlier(pf, toggleLamp, { stagesDone: [], completed: { challenge: { hints: 0 } }, log: { decisions: "Used a bool." } });
  assert.equal(e.code, null);
  assert.equal(e.evidence.legacy, true);
  assert.deepEqual(e.evidence.modes, ["challenge"]);
  assert.equal(e.versions.length, 0);
  assert.equal(e.doc.programming.decisions, "Used a bool.");
  assert.equal(PF.addCompletedEarlier(pf, toggleLamp, {}), e, "added once");
});

test("comparing versions: a correct line diff and the changed answers", () => {
  const d = M.lineDiff("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(d.map((x) => `${x.type}:${x.text}`), ["same:a", "del:b", "add:B", "same:c", "add:d"]);
  assert.deepEqual(M.lineDiff("x", "x"), [{ type: "same", text: "x" }]);
  assert.equal(M.lineDiff("", "one\ntwo").filter((x) => x.type === "add").length, 2);
  const ch = M.docChanges({ overview: { what: "A" } }, { overview: { what: "B" }, testing: { tests: "ran it" } });
  assert.deepEqual(ch.map((c) => `${c.section.id}.${c.field}`), ["overview.what", "testing.tests"]);
});

test("backups: export and import round-trip; nothing existing is ever overwritten", () => {
  const pf = fresh();
  const e = complete(pf, toggleLamp);
  const text = PF.exportPortfolio(pf);
  assert.equal(PF.parsePortfolioFile("not json"), null);
  assert.equal(PF.parsePortfolioFile(JSON.stringify({ app: "something-else", portfolio: {} })), null);
  const incoming = PF.parsePortfolioFile(text);
  assert.deepEqual(incoming, PF.normalizePortfolio(pf));
  assert.deepEqual(PF.importPortfolio(pf, incoming), { added: 0, kept: 0, same: 1 });
  // the backup's copy differs from what's here now: both are kept
  PF.updateDoc(pf, e.id, "overview", "what", "Edited since the backup");
  const r = PF.importPortfolio(pf, PF.parsePortfolioFile(text));
  assert.deepEqual(r, { added: 0, kept: 1, same: 0 });
  assert.equal(pf.entries[e.id].doc.overview.what, "Edited since the backup");
  const copy = Object.values(pf.entries).find((x) => /imported copy/.test(x.title));
  assert.ok(copy && copy.id !== e.id);
  const empty = fresh();
  assert.deepEqual(PF.importPortfolio(empty, PF.parsePortfolioFile(text)), { added: 1, kept: 0, same: 0 });
});

test("broken or tampered storage loads safely", () => {
  for (const bad of ["{oops", "null", "[]", JSON.stringify({ entries: 5 }),
    JSON.stringify({ entries: { a: null, b: { title: 7, category: "x", versions: "no", doc: { overview: { what: 3 } }, circuit: { parts: "x" }, evidence: { checks: [1, { ok: 1, text: "fine" }] } } } })]) {
    store.clear();
    store.set(PF.PORTFOLIO_KEY, bad);
    const pf = PF.loadPortfolio();
    assert.ok(pf.entries && typeof pf.entries === "object");
    for (const e of Object.values(pf.entries)) {
      assert.equal(typeof e.title, "string");
      assert.ok(Array.isArray(e.versions));
      assert.equal(e.circuit, null);
      assert.equal(typeof e.doc.overview.what, "string");
      assert.doesNotThrow(() => M.docStatus(e));
    }
  }
  store.clear();
  store.set(PF.PORTFOLIO_KEY, JSON.stringify({ entries: { b: { evidence: { checks: [1, { ok: 1, text: "fine" }] } } } }));
  assert.deepEqual(PF.loadPortfolio().entries.b.evidence.checks, [{ ok: true, text: "fine" }]);
});

test("the portfolio is stored separately: it can't damage saved progress", () => {
  store.clear();
  const progress = P.loadProgress();
  P.markLessonViewed(progress, "l1-1");
  store.set(PF.PORTFOLIO_KEY, "{corrupt");
  assert.deepEqual(P.loadProgress().viewedLessons, ["l1-1"]);
  const pf = PF.loadPortfolio();
  PF.createOwnEntry(pf, { title: "x" });
  PF.savePortfolio(pf);
  assert.deepEqual(P.loadProgress().viewedLessons, ["l1-1"]);
  assert.ok(PF.storageBytes(pf) > 0);
});

test("a full storage is reported, not hidden", () => {
  const pf = fresh();
  const real = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; };
  const r = PF.savePortfolio(pf);
  globalThis.localStorage.setItem = real;
  assert.equal(r.ok, false);
  assert.equal(r.error, "QuotaExceededError");
});
