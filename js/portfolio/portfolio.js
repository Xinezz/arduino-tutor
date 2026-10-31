// The learner's engineering portfolio: one record per project, holding its
// documentation, its code and circuit, the evidence that it works, and every
// saved version. Stored in this browser only, under its own key - separate
// from saved progress, so a big portfolio can never damage progress - and
// never sent anywhere. Every change goes through the functions below; none
// of them deletes or overwrites a saved version.
//
// A record:
//   { id, projectId (library project, or null for your own), title, category,
//     difficulty, template, createdAt, updatedAt,
//     evidence: { completedAt, mode, hints, checks: [{ ok, text }], legacy } | null,
//     code, circuit,                     - the current state
//     doc: { overview: { what, ... }, ... }  - sections A-I (see model.js)
//     versions: [{ n, name, savedAt, source, changes, notes, code, circuit, doc }] }

import { CATEGORIES, DIFFICULTIES, TEMPLATES, SECTIONS, prefillDoc, categoryFor, difficultyFor, templateFor } from "./model.js";

export const PORTFOLIO_KEY = "arduinoTutorPortfolio";
export const SOFT_LIMIT_BYTES = 2_500_000; // browsers allow ~5 MB per site; warn well before

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 20000) => (typeof v === "string" ? v.slice(0, max) : "");
const now = () => new Date().toISOString();
const clone = (x) => (x === undefined || x === null ? null : JSON.parse(JSON.stringify(x)));

export const emptyPortfolio = () => ({ version: 1, entries: {} });

function cleanDoc(doc) {
  const out = {};
  for (const s of SECTIONS) {
    out[s.id] = {};
    for (const [f] of s.fields) out[s.id][f] = str(doc?.[s.id]?.[f]);
  }
  return out;
}
function cleanCircuit(c) {
  if (!isObject(c) || !Array.isArray(c.parts) || !Array.isArray(c.wires)) return null;
  return {
    parts: c.parts.filter((p) => isObject(p) && typeof p.key === "string" && typeof p.kind === "string"),
    wires: c.wires.filter((w) => Array.isArray(w) && w.length === 2 && w.every((x) => typeof x === "string")),
  };
}
function cleanEntry(id, e) {
  if (!isObject(e)) return null;
  const pick = (list, v, fallback) => (list.some((x) => x.id === v) ? v : fallback);
  return {
    id,
    projectId: typeof e.projectId === "string" ? e.projectId : null,
    title: str(e.title, 200) || "Untitled project",
    category: pick(CATEGORIES, e.category, "programming"),
    difficulty: pick(DIFFICULTIES, e.difficulty, "beginner"),
    template: pick(TEMPLATES, e.template, "basic"),
    createdAt: str(e.createdAt, 40) || now(),
    updatedAt: str(e.updatedAt, 40) || str(e.createdAt, 40) || now(),
    evidence: isObject(e.evidence) ? {
      completedAt: str(e.evidence.completedAt, 40) || null,
      mode: str(e.evidence.mode, 40) || null,
      modes: Array.isArray(e.evidence.modes) ? e.evidence.modes.filter((m) => typeof m === "string") : [],
      hints: Number.isFinite(e.evidence.hints) ? e.evidence.hints : null,
      checks: Array.isArray(e.evidence.checks) ? e.evidence.checks.filter(isObject).map((c) => ({ ok: !!c.ok, text: str(c.text, 400) })) : [],
      legacy: !!e.evidence.legacy,
    } : null,
    code: typeof e.code === "string" ? e.code.slice(0, 100000) : null,
    circuit: cleanCircuit(e.circuit),
    doc: cleanDoc(e.doc),
    versions: (Array.isArray(e.versions) ? e.versions : []).filter(isObject).map((v, i) => ({
      n: Number.isFinite(v.n) ? v.n : i + 1,
      name: str(v.name, 200) || `Version ${i + 1}`,
      savedAt: str(v.savedAt, 40) || now(),
      source: ["completion", "improvement", "manual", "import"].includes(v.source) ? v.source : "manual",
      changes: str(v.changes, 4000),
      notes: str(v.notes, 4000),
      code: typeof v.code === "string" ? v.code.slice(0, 100000) : null,
      circuit: cleanCircuit(v.circuit),
      doc: cleanDoc(v.doc),
    })),
  };
}

export function normalizePortfolio(saved) {
  const p = emptyPortfolio();
  if (!isObject(saved) || !isObject(saved.entries)) return p;
  for (const [id, e] of Object.entries(saved.entries)) {
    const clean = cleanEntry(id, e);
    if (clean) p.entries[id] = clean;
  }
  return p;
}

export function loadPortfolio() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? normalizePortfolio(JSON.parse(raw)) : emptyPortfolio();
  } catch {
    return emptyPortfolio();
  }
}

// { ok, bytes, error } - storage can be full or blocked; the caller says so.
export function savePortfolio(pf) {
  const text = JSON.stringify(pf);
  try {
    localStorage.setItem(PORTFOLIO_KEY, text);
    return { ok: true, bytes: text.length * 2 };
  } catch (error) {
    return { ok: false, bytes: text.length * 2, error: String(error?.name ?? error) };
  }
}
export const storageBytes = (pf) => JSON.stringify(pf).length * 2; // localStorage keeps UTF-16

export const entryIdFor = (projectId) => `project-${projectId}`;
const nextN = (entry) => entry.versions.reduce((m, v) => Math.max(m, v.n), 0) + 1;

function snapshot(entry, { name, changes = "", notes = "", source = "manual", code = entry.code, circuit = entry.circuit }) {
  const n = nextN(entry);
  const v = { n, name: name || `Version ${n}`, savedAt: now(), source, changes, notes, code: code ?? null, circuit: clone(circuit), doc: clone(entry.doc) };
  entry.versions.push(v);
  entry.code = v.code;
  entry.circuit = clone(v.circuit);
  entry.updatedAt = v.savedAt;
  return v;
}

function newLibraryEntry(project, log) {
  const t = now();
  return {
    id: entryIdFor(project.id), projectId: project.id, title: project.title,
    category: categoryFor(project), difficulty: difficultyFor(project), template: templateFor(project),
    createdAt: t, updatedAt: t, evidence: null, code: null, circuit: null,
    doc: cleanDoc(prefillDoc(project, log)), versions: [],
  };
}

// A library project passed its final check: record the evidence and the code
// and circuit that passed, as a new version. Completing it again (another
// mode) adds another version - nothing earlier is replaced.
export function captureCompletion(pf, project, { mode, hints = 0, result, code, circuit, log = {} }) {
  const id = entryIdFor(project.id);
  const entry = pf.entries[id] ?? (pf.entries[id] = newLibraryEntry(project, log));
  const modes = [...new Set([...(entry.evidence?.modes ?? []), mode])];
  entry.evidence = {
    completedAt: entry.evidence?.completedAt && !entry.evidence.legacy ? entry.evidence.completedAt : now(),
    mode, modes, hints,
    checks: (result?.items ?? []).map((i) => ({ ok: !!i.ok, text: i.ok ? i.goal ?? i.text : i.text })),
    legacy: false,
  };
  snapshot(entry, {
    name: entry.versions.length ? `Completed in ${mode} mode` : "Version 1: first working build",
    changes: entry.versions.length ? `Built again in ${mode} mode and passed every check.` : `Passed every check in ${mode} mode.`,
    source: "completion", code, circuit,
  });
  return entry;
}

// An improvement passed its check: saved as a new version.
export function captureImprovement(pf, project, improvement, { code, circuit }) {
  const entry = pf.entries[entryIdFor(project.id)];
  if (!entry) return null;
  return snapshot(entry, { name: `Improvement: ${improvement.title}`, changes: improvement.task, source: "improvement", code, circuit });
}

// A project completed before the portfolio existed: its record starts with
// what progress knows (which modes), and no code - nothing is made up.
export function addCompletedEarlier(pf, project, progressEntry) {
  const id = entryIdFor(project.id);
  if (pf.entries[id]) return pf.entries[id];
  const entry = newLibraryEntry(project, progressEntry?.log);
  entry.evidence = { completedAt: null, mode: null, modes: Object.keys(progressEntry?.completed ?? {}), hints: null, checks: [], legacy: true };
  pf.entries[id] = entry;
  return entry;
}

// The learner's own project (e.g. from Free Practice).
export function createOwnEntry(pf, { title, category = "programming", difficulty = "beginner", template = "basic", code = null, circuit = null }) {
  const t = now();
  const id = `own-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const entry = { id, projectId: null, title: str(title, 200) || "My project", category, difficulty, template, createdAt: t, updatedAt: t, evidence: null, code: null, circuit: null, doc: cleanDoc({}), versions: [] };
  pf.entries[id] = entry;
  if (code || circuit) snapshot(entry, { name: "Version 1", changes: "First saved version.", code, circuit });
  return entry;
}

// Drafts: each answer is saved as it's typed.
export function updateDoc(pf, id, section, field, value) {
  const entry = pf.entries[id];
  if (!entry || !entry.doc[section] || !(field in entry.doc[section])) return null;
  entry.doc[section][field] = str(value);
  entry.updatedAt = now();
  return entry;
}

export function updateMeta(pf, id, meta) {
  const entry = pf.entries[id];
  if (!entry) return null;
  const clean = cleanEntry(id, { ...entry, ...meta });
  for (const k of ["title", "category", "template"]) entry[k] = clean[k];
  if (!entry.projectId) entry.difficulty = clean.difficulty; // a library project's difficulty is fixed
  entry.updatedAt = now();
  return entry;
}

export function saveVersion(pf, id, opts) {
  const entry = pf.entries[id];
  return entry ? snapshot(entry, { ...opts, source: opts.source ?? "manual" }) : null;
}

export function deleteEntry(pf, id) {
  delete pf.entries[id];
}

// ---- backup ----
export function exportPortfolio(pf) {
  return JSON.stringify({ app: "arduino-tutor-portfolio", format: 1, exportedAt: now(), portfolio: pf }, null, 2);
}
// The portfolio inside an export file, cleaned - or null if it isn't one.
export function parsePortfolioFile(text) {
  try {
    const data = JSON.parse(text);
    if (!isObject(data) || data.app !== "arduino-tutor-portfolio" || !isObject(data.portfolio)) return null;
    return normalizePortfolio(data.portfolio);
  } catch {
    return null;
  }
}
// Adds an imported portfolio's records. A record that already exists is never
// overwritten: if it differs, the imported one is kept alongside, renamed.
export function importPortfolio(pf, incoming) {
  let added = 0, kept = 0, same = 0;
  for (const [id, e] of Object.entries(incoming.entries)) {
    const mine = pf.entries[id];
    if (!mine) { pf.entries[id] = e; added++; continue; }
    if (JSON.stringify(mine) === JSON.stringify(e)) { same++; continue; }
    const copyId = `${id}-imported-${Date.now().toString(36)}`;
    pf.entries[copyId] = { ...e, id: copyId, projectId: null, title: `${e.title} (imported copy)` };
    kept++;
  }
  return { added, kept, same };
}
