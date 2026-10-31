// The Portfolio tab: the learner's project records (home), one record laid
// out as an engineering report (with its documentation editor, evidence,
// circuit, code and versions), and a comparison of two versions.
//
// Renders and reports back; the caller (app.js) owns the portfolio object
// and saves it (ctx.persist) after every change.

import { openModal, confirmDialog } from "../game/modal.js";
import { createBoard } from "../simulator/board.js";
import { SKILLS } from "../lessons/curriculum.js";
import {
  CATEGORIES, DIFFICULTIES, TEMPLATES, SECTIONS, REQUIRED, categoryName, difficultyName, templateById,
  docStatus, sectionComplete, lineDiff, docChanges, circuitSummary,
} from "./model.js";
import {
  addCompletedEarlier, createOwnEntry, updateDoc, updateMeta, saveVersion, deleteEntry,
  storageBytes, SOFT_LIMIT_BYTES, entryIdFor,
} from "./portfolio.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(text, kind, onClick, title) {
  const b = el("button", `btn ${kind}`, text);
  b.type = "button";
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}
function selectEl(options, value, label) {
  const s = el("select", "goal-select");
  s.setAttribute("aria-label", label);
  for (const [v, t] of options) s.appendChild(Object.assign(el("option", null, t), { value: v }));
  s.value = value;
  return s;
}
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
const SOURCE = { completion: "Passed its checks", improvement: "Improvement passed its check", manual: "Saved by you", import: "Imported" };

// ctx: { portfolio, progress, projects: library projects, persist(), getPracticeWork(), loadIntoPractice(code, circuit),
//        onOpenProject(id), setStatus(text) }
// state: { view: "home"|"entry"|"compare", id, a, b, editing, category, query, sort }
export function renderPortfolio(container, ctx, state, rerender) {
  container.innerHTML = "";
  if (state.view === "entry" && ctx.portfolio.entries[state.id]) return renderEntry(container, ctx, state, rerender);
  if (state.view === "compare" && ctx.portfolio.entries[state.id]) return renderCompare(container, ctx, state, rerender);
  renderHome(container, ctx, state, rerender);
}

// ================================================================ home
function renderHome(container, ctx, state, rerender) {
  const { portfolio: pf, progress } = ctx;
  const entries = Object.values(pf.entries);
  const head = el("section", "learn-head hud-frame portfolio-head");
  head.appendChild(el("h1", null, "My Engineering Portfolio"));
  head.appendChild(el("p", "learn-sub", "A record of what you've designed, built, tested and improved - with the code, the circuit, the results and your own documentation."));
  head.appendChild(el("p", "portfolio-private", "🔒 Private: saved only in this browser, on this device. Nothing here is published or shared. Use \"Back up\" to keep a copy."));
  const actions = el("div", "dash-actions");
  actions.append(
    button("New record from my Free Practice work", "btn-primary", () => newOwnRecord(ctx, state, rerender)),
    button("Back up (download)", "btn-secondary", () => ctx.exportFile()),
    button("Restore from a backup", "btn-secondary", () => ctx.importFile()),
  );
  head.appendChild(actions);
  container.appendChild(head);

  // ---- honest totals ----
  const verified = entries.filter((e) => e.evidence && !e.evidence.legacy);
  const documented = entries.filter((e) => docStatus(e).complete);
  const multi = entries.filter((e) => e.versions.length > 1);
  const tiles = el("div", "learning-tiles");
  const tile = (v, l) => { const t = el("div", "learning-tile"); t.append(el("div", "learning-tile-value", v), el("div", "learning-tile-label", l)); return t; };
  tiles.append(
    tile(String(entries.length), "project records"),
    tile(String(entries.filter((e) => e.evidence).length), "library projects completed (checked)"),
    tile(String(documented.length), "fully documented"),
    tile(String(multi.length), "improved over several versions"),
  );
  container.appendChild(tiles);
  if (verified.length < entries.filter((e) => e.evidence).length) {
    container.appendChild(el("p", "learning-legend", "Projects completed before the portfolio existed show which modes they passed in, but have no saved code until you save a version."));
  }
  const bytes = storageBytes(pf);
  if (bytes > SOFT_LIMIT_BYTES * 0.6) {
    container.appendChild(el("p", bytes > SOFT_LIMIT_BYTES ? "pathway-prereq-note" : "learning-legend",
      `Portfolio storage: ${(bytes / 1e6).toFixed(1)} MB of about ${(SOFT_LIMIT_BYTES / 1e6).toFixed(1)} MB this browser comfortably allows. Back up, and remove records you don't need.`));
  }

  // ---- completed projects without a record ----
  const missing = ctx.projects.filter((p) => Object.keys(progress.projects?.[p.id]?.completed ?? {}).length && !pf.entries[entryIdFor(p.id)]);
  if (missing.length) {
    const box = el("section", "revision-round hud-frame");
    box.appendChild(el("div", "lesson-list-heading", "READY TO DOCUMENT"));
    box.appendChild(el("p", null, "You've completed these projects. Add them to your portfolio to document them - the description, components and requirements are filled in for you to edit."));
    for (const p of missing) {
      const row = el("div", "revision-row");
      row.append(el("div", "revision-text", `${p.title} - passed in ${Object.keys(progress.projects[p.id].completed).join(", ")} mode`),
        button("Add to portfolio", "btn-primary btn-small", () => {
          addCompletedEarlier(pf, p, progress.projects[p.id]);
          ctx.persist();
          Object.assign(state, { view: "entry", id: entryIdFor(p.id), editing: true });
          rerender();
        }));
      box.appendChild(row);
    }
    container.appendChild(box);
  }

  // ---- browse ----
  const bar = el("div", "pathway-search");
  const search = el("input", "pathway-search-input");
  search.type = "search";
  search.placeholder = "Search your records";
  search.setAttribute("aria-label", "Search your portfolio");
  search.value = state.query ?? "";
  const cat = selectEl([["", "All categories"], ...CATEGORIES.map((c) => [c.id, c.name])], state.category ?? "", "Filter by category");
  const sort = selectEl([["updated", "Recently updated"], ["title", "Title A-Z"]], state.sort ?? "updated", "Sort");
  bar.append(search, cat, sort);
  container.appendChild(bar);
  const grid = el("div", "portfolio-grid");
  container.appendChild(grid);
  const draw = () => {
    state.query = search.value; state.category = cat.value; state.sort = sort.value;
    const q = state.query.trim().toLowerCase();
    let list = entries.filter((e) => (!state.category || e.category === state.category)
      && (!q || [e.title, ...SECTIONS.flatMap((s) => Object.values(e.doc[s.id] ?? {}))].join(" ").toLowerCase().includes(q)));
    list = state.sort === "title" ? list.sort((a, b) => a.title.localeCompare(b.title)) : list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    grid.innerHTML = "";
    if (!entries.length) {
      grid.appendChild(el("p", "learning-empty", "Your portfolio is empty. Complete a project (Projects or Pathways tab) and it's added here automatically with its code and circuit - or start a record from anything you've built in Free Practice."));
      return;
    }
    if (!list.length) grid.appendChild(el("p", "learning-empty", "No records match."));
    for (const e of list) grid.appendChild(entryCard(e, () => { Object.assign(state, { view: "entry", id: e.id, editing: false }); rerender(); }));
  };
  search.addEventListener("input", draw);
  cat.addEventListener("change", draw);
  sort.addEventListener("change", draw);
  draw();
}

function entryCard(e, onOpen) {
  const s = docStatus(e);
  const card = el("button", "portfolio-card hud-frame");
  card.type = "button";
  card.addEventListener("click", onOpen);
  card.appendChild(el("div", "portfolio-card-cat", `${categoryName(e.category).toUpperCase()} · ${difficultyName(e.difficulty).toUpperCase()}`));
  card.appendChild(el("div", "portfolio-card-title", e.title));
  card.appendChild(el("div", "portfolio-card-desc", e.doc.overview.what || "No overview yet."));
  const meta = el("div", "portfolio-card-meta");
  meta.append(
    el("span", `doc-pill is-${s.complete ? "done" : s.started.length ? "draft" : "none"}`, `${s.label} · ${s.done.length}/${s.required.length}`),
    el("span", null, e.evidence ? (e.evidence.legacy ? "✔ Completed earlier" : `✔ Checked (${e.evidence.modes.join(", ")})`) : "Your own project"),
    el("span", null, `${e.versions.length} version${e.versions.length === 1 ? "" : "s"}`),
    el("span", null, `Updated ${fmtDate(e.updatedAt)}`),
  );
  card.appendChild(meta);
  return card;
}

function newOwnRecord(ctx, state, rerender) {
  const work = ctx.getPracticeWork();
  const body = el("div", "portfolio-form");
  const title = el("input", "tutor-input");
  title.placeholder = "Project title";
  title.maxLength = 120;
  const cat = selectEl(CATEGORIES.map((c) => [c.id, c.name]), "programming", "Category");
  const diff = selectEl(DIFFICULTIES.map((d) => [d.id, d.name]), "beginner", "Difficulty");
  const tpl = selectEl(TEMPLATES.map((t) => [t.id, t.name]), "basic", "Template");
  tpl.addEventListener("change", () => { cat.value = templateById(tpl.value).category; });
  const lab = (t, input) => { const l = el("label", "portfolio-field"); l.append(el("span", null, t), input); return l; };
  body.append(lab("Title", title), lab("Template", tpl), lab("Category", cat), lab("Difficulty", diff));
  const summary = circuitSummary(work.circuit);
  body.appendChild(el("p", "learning-legend", `It starts with what's in Free Practice now: ${work.code?.trim() ? `${work.code.split("\n").length} lines of code` : "no code"}, and ${summary.parts ? `${summary.text} with ${summary.wires} wires` : "no circuit"}. Saved as Version 1.`));
  openModal({
    title: "NEW PROJECT RECORD", content: body, className: "modal-wide",
    actions: [
      { label: "Cancel", kind: "secondary" },
      { label: "Create record", kind: "primary", onClick: () => {
        const e = createOwnEntry(ctx.portfolio, { title: title.value.trim() || "My project", category: cat.value, difficulty: diff.value, template: tpl.value,
          code: work.code?.trim() ? work.code : null, circuit: summary.parts ? work.circuit : null });
        ctx.persist();
        Object.assign(state, { view: "entry", id: e.id, editing: true });
        rerender();
      } },
    ],
    onOpen: () => title.focus(),
  });
}

// ================================================================ one record
function renderEntry(container, ctx, state, rerender) {
  const pf = ctx.portfolio;
  const e = pf.entries[state.id];
  const s = docStatus(e);
  const report = el("article", "portfolio-report hud-frame");
  const top = el("div", "portfolio-toolbar no-print");
  top.append(
    button("← Portfolio", "btn-secondary btn-small", () => { Object.assign(state, { view: "home" }); rerender(); }),
    button(state.editing ? "Done editing" : "Edit documentation", state.editing ? "btn-complete btn-small" : "btn-primary btn-small", () => { state.editing = !state.editing; rerender(); }),
    button("Save a new version", "btn-secondary btn-small", () => saveVersionDialog(ctx, e, rerender)),
    button("Print report", "btn-secondary btn-small", () => window.print()),
  );
  container.appendChild(top);

  // ---- title block ----
  report.appendChild(el("div", "portfolio-card-cat", `${categoryName(e.category).toUpperCase()} · ${difficultyName(e.difficulty).toUpperCase()} · ${templateById(e.template).name.toUpperCase()}`));
  report.appendChild(el("h1", "portfolio-title", e.title));
  const meta = el("div", "portfolio-meta");
  meta.append(
    el("span", null, `Record started ${fmtDate(e.createdAt)}`),
    el("span", null, `Last updated ${fmtDate(e.updatedAt)}`),
    el("span", `doc-pill is-${s.complete ? "done" : s.started.length ? "draft" : "none"}`, `${s.label}: ${s.done.length} of ${s.required.length} required sections`),
  );
  report.appendChild(meta);
  if (state.editing) report.appendChild(metaEditor(ctx, e, rerender));

  // ---- evidence ----
  const ev = el("section", "portfolio-evidence");
  ev.appendChild(el("h2", "portfolio-h2", "Evidence"));
  if (e.evidence && !e.evidence.legacy) {
    ev.appendChild(el("p", null, `Completed ${fmtDate(e.evidence.completedAt)} - passed every check in ${e.evidence.modes.join(" and ")} mode${e.evidence.modes.length > 1 ? "s" : ""}${e.evidence.hints ? ` (${e.evidence.hints} hint${e.evidence.hints === 1 ? "" : "s"} in the last build)` : " (no hints in the last build)"}. The check ran this code on this circuit:`));
    const ul = el("ul", "criteria-list");
    for (const c of e.evidence.checks) ul.appendChild(el("li", c.ok ? "is-met" : "", `${c.ok ? "✔" : "✖"} ${c.text}`));
    ev.appendChild(ul);
  } else if (e.evidence?.legacy) {
    ev.appendChild(el("p", null, `Completed before the portfolio existed (passed in ${e.evidence.modes.join(", ") || "an earlier"} mode). Its code and circuit weren't saved then - build it in Free Practice and use "Save a new version" to add them.`));
  } else {
    ev.appendChild(el("p", null, "Your own project: there's no automatic check for it, so the evidence is what you document below - especially your tests (section F)."));
  }
  if (e.projectId) ev.appendChild(button("Open the project page", "btn-secondary btn-small no-print", () => ctx.onOpenProject(e.projectId)));
  report.appendChild(ev);

  const hint = templateById(e.template).hint;
  if (state.editing) report.appendChild(el("p", "portfolio-template-hint", `${templateById(e.template).name}: ${hint} Sections marked REQUIRED are expected for a ${difficultyName(e.difficulty).toLowerCase()} project; the rest are optional.`));

  // ---- sections A-I ----
  const required = new Set(REQUIRED[e.difficulty]);
  for (const sec of SECTIONS) {
    const filledAny = sec.fields.some(([f]) => e.doc[sec.id][f].trim());
    const extra = { circuit: !!e.circuit, programming: e.code !== null, components: true };
    if (!state.editing && !filledAny && !required.has(sec.id) && !extra[sec.id]) continue;
    const box = el("section", `portfolio-section${sectionComplete(e.doc, sec.id) ? " is-done" : ""}`);
    const h = el("h2", "portfolio-h2", `${sec.letter}. ${sec.title}`);
    if (required.has(sec.id)) h.appendChild(el("span", `portfolio-req${sectionComplete(e.doc, sec.id) ? " is-done" : ""}`, sectionComplete(e.doc, sec.id) ? "✔ written" : "required"));
    box.appendChild(h);
    for (const [field, question, prompt] of sec.fields) {
      const value = e.doc[sec.id][field];
      if (state.editing) {
        const lab = el("label", "portfolio-field");
        lab.appendChild(el("span", "portfolio-q", question));
        const ta = el("textarea", "lesson-reasoning-box");
        ta.rows = Math.min(8, Math.max(2, value.split("\n").length + 1));
        ta.placeholder = prompt;
        ta.value = value;
        const saved = el("span", "portfolio-saved", "");
        let timer = null;
        ta.addEventListener("input", () => {
          updateDoc(pf, e.id, sec.id, field, ta.value);
          saved.textContent = "…";
          clearTimeout(timer);
          timer = setTimeout(() => { const r = ctx.persist(); saved.textContent = r.ok ? "Draft saved" : "Couldn't save - storage full?"; }, 400);
        });
        lab.append(ta, saved);
        box.appendChild(lab);
      } else if (value.trim()) {
        box.appendChild(el("div", "portfolio-q", question));
        box.appendChild(el("p", "portfolio-a", value));
      } else if (required.has(sec.id)) {
        box.appendChild(el("p", "learning-empty", `${question} - not written yet.`));
      }
    }
    if (sec.id === "components") box.appendChild(componentsBlock(ctx, e));
    if (sec.id === "circuit") box.appendChild(circuitBlock(e.circuit));
    if (sec.id === "programming") box.appendChild(codeBlock(e.code));
    report.appendChild(box);
  }

  // ---- versions ----
  const vs = el("section", "portfolio-section portfolio-versions");
  vs.appendChild(el("h2", "portfolio-h2", "Version history"));
  if (!e.versions.length) vs.appendChild(el("p", "learning-empty", "No versions yet. \"Save a new version\" records your current Free Practice code and circuit, with a note of what changed."));
  const picks = new Set();
  const compareBtn = button("Compare the two selected", "btn-primary btn-small no-print", () => {
    const [a, b] = [...picks].sort((x, y) => x - y);
    Object.assign(state, { view: "compare", a, b });
    rerender();
  });
  compareBtn.disabled = true;
  for (const v of [...e.versions].reverse()) {
    const row = el("div", "portfolio-version");
    const pick = el("input");
    pick.type = "checkbox";
    pick.className = "no-print";
    pick.setAttribute("aria-label", `Select ${v.name} to compare`);
    pick.addEventListener("change", () => {
      if (pick.checked) picks.add(v.n); else picks.delete(v.n);
      if (picks.size > 2) { const first = [...picks][0]; picks.delete(first); vs.querySelector(`[data-n="${first}"]`).checked = false; }
      compareBtn.disabled = picks.size !== 2;
    });
    pick.dataset.n = String(v.n);
    const text = el("div", "portfolio-version-text");
    text.append(el("strong", null, `v${v.n} · ${v.name}`), el("span", "pathway-item-meta", ` ${fmtDate(v.savedAt)} · ${SOURCE[v.source]}`));
    if (v.changes) text.appendChild(el("div", null, v.changes));
    if (v.notes) text.appendChild(el("div", "pathway-item-meta", `Notes: ${v.notes}`));
    text.appendChild(el("div", "pathway-item-meta", `${v.code ? `${v.code.split("\n").length} lines of code` : "no code"} · ${circuitSummary(v.circuit).text}`));
    row.append(pick, text, button("Load into Free Practice", "btn-secondary btn-small no-print", () => ctx.loadIntoPractice(v.code, v.circuit, `${e.title} v${v.n}`)));
    vs.appendChild(row);
  }
  if (e.versions.length > 1) vs.appendChild(compareBtn);
  report.appendChild(vs);

  const foot = el("div", "portfolio-foot no-print");
  foot.appendChild(button("Delete this record", "btn-secondary btn-small", async () => {
    const yes = await confirmDialog({ title: "DELETE THIS RECORD?", body: `"${e.title}" and all ${e.versions.length} of its versions will be removed from your portfolio. Your course progress isn't affected. This can't be undone - back up first if you might want it.`, confirmLabel: "Delete It", danger: true });
    if (!yes) return;
    deleteEntry(pf, e.id);
    ctx.persist();
    Object.assign(state, { view: "home" });
    rerender();
  }));
  report.appendChild(foot);
  report.appendChild(el("p", "portfolio-print-note", "Arduino Tutor engineering portfolio - a private record of the learner's own work."));
  container.appendChild(report);
}

function metaEditor(ctx, e, rerender) {
  const box = el("div", "portfolio-meta-edit no-print");
  const title = el("input", "tutor-input");
  title.value = e.title;
  title.maxLength = 120;
  title.setAttribute("aria-label", "Title");
  const cat = selectEl(CATEGORIES.map((c) => [c.id, c.name]), e.category, "Category");
  const tpl = selectEl(TEMPLATES.map((t) => [t.id, t.name]), e.template, "Template");
  const diff = selectEl(DIFFICULTIES.map((d) => [d.id, d.name]), e.difficulty, "Difficulty");
  diff.disabled = !!e.projectId;
  if (e.projectId) diff.title = "Set by the project itself";
  const apply = () => { updateMeta(ctx.portfolio, e.id, { title: title.value, category: cat.value, template: tpl.value, difficulty: diff.value }); ctx.persist(); };
  title.addEventListener("change", () => { apply(); rerender(); });
  for (const s of [cat, tpl, diff]) s.addEventListener("change", () => { apply(); rerender(); });
  box.append(title, tpl, cat, diff);
  return box;
}

function componentsBlock(ctx, e) {
  const wrap = el("div");
  const project = e.projectId ? ctx.projects.find((p) => p.id === e.projectId) : null;
  if (project) {
    const t = el("table", "lesson-table portfolio-table");
    t.innerHTML = "<thead><tr><th>Component</th><th>Job</th><th>Runs</th></tr></thead>";
    const tb = el("tbody");
    for (const c of project.components) {
      const tr = el("tr");
      tr.append(el("td", null, `${c.count} × ${c.kind}`), el("td", null, c.purpose), el("td", null, "Simulated"));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    wrap.appendChild(t);
    wrap.appendChild(el("p", "pathway-item-meta", `Concepts applied: ${project.concepts.map((c) => SKILLS[c]).join(", ")}.`));
  } else if (e.circuit?.parts?.length) {
    wrap.appendChild(el("p", "pathway-item-meta", `On the saved circuit: ${circuitSummary(e.circuit).text}.`));
  }
  return wrap;
}

// The saved circuit, drawn on a read-only board, plus its connections as text.
function circuitBlock(circuit) {
  const wrap = el("div", "portfolio-circuit");
  if (!circuit?.parts?.length && !circuit?.wires?.length) {
    wrap.appendChild(el("p", "learning-empty", "No circuit saved yet."));
    return wrap;
  }
  const frame = el("div", "board-snapshot");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 780 600"); // the simulator board's own drawing size (index.html)
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Saved circuit: ${circuitSummary(circuit).text}`);
  frame.appendChild(svg);
  wrap.appendChild(frame);
  try {
    createBoard(svg).loadCircuit(circuit);
  } catch {
    frame.replaceChildren(el("p", "learning-empty", "This circuit couldn't be drawn."));
  }
  const d = el("details", "pathway-plan");
  d.appendChild(el("summary", null, `Connections (${circuit.wires.length} wires)`));
  const ul = el("ul", "portfolio-wires");
  for (const [a, b] of circuit.wires) ul.appendChild(el("li", null, `${a} ↔ ${b}`));
  d.appendChild(ul);
  wrap.appendChild(d);
  return wrap;
}

function codeBlock(code) {
  if (code === null) return el("p", "learning-empty", "No code saved yet.");
  return el("pre", "code-block portfolio-code", code);
}

function saveVersionDialog(ctx, e, rerender) {
  const work = ctx.getPracticeWork();
  const body = el("div", "portfolio-form");
  const name = el("input", "tutor-input");
  name.placeholder = `Version ${e.versions.length + 1}: what's new (e.g. "Added button control")`;
  name.maxLength = 120;
  const changes = el("textarea", "lesson-reasoning-box");
  changes.rows = 3;
  changes.placeholder = "What changed, and why?";
  const notes = el("textarea", "lesson-reasoning-box");
  notes.rows = 2;
  notes.placeholder = "Notes about improvements (optional)";
  const from = selectEl([
    ["practice", "Use my current Free Practice code and circuit"],
    ["keep", "Keep this record's code and circuit (documentation snapshot)"],
  ], work.code?.trim() || circuitSummary(work.circuit).parts ? "practice" : "keep", "What to save");
  const lab = (t, input) => { const l = el("label", "portfolio-field"); l.append(el("span", null, t), input); return l; };
  body.append(lab("Name", name), lab("Description of changes", changes), lab("Notes", notes), lab("Code and circuit", from));
  body.appendChild(el("p", "learning-legend", `Free Practice has ${work.code?.trim() ? `${work.code.split("\n").length} lines of code` : "no code"} and ${circuitSummary(work.circuit).text.toLowerCase()}. Earlier versions are never changed.`));
  openModal({
    title: "SAVE A NEW VERSION", content: body, className: "modal-wide",
    actions: [
      { label: "Cancel", kind: "secondary" },
      { label: "Save version", kind: "primary", onClick: () => {
        const usePractice = from.value === "practice";
        saveVersion(ctx.portfolio, e.id, { name: name.value.trim(), changes: changes.value.trim(), notes: notes.value.trim(),
          ...(usePractice ? { code: work.code ?? null, circuit: work.circuit } : {}) });
        const r = ctx.persist();
        ctx.setStatus(r.ok ? `Saved v${e.versions.length} of "${e.title}".` : "Couldn't save - this browser's storage may be full.");
        rerender();
      } },
    ],
    onOpen: () => name.focus(),
  });
}

// ================================================================ compare
function renderCompare(container, ctx, state, rerender) {
  const e = ctx.portfolio.entries[state.id];
  const va = e.versions.find((v) => v.n === state.a);
  const vb = e.versions.find((v) => v.n === state.b);
  container.appendChild(button(`← ${e.title}`, "btn-secondary btn-small", () => { Object.assign(state, { view: "entry" }); rerender(); }));
  const box = el("article", "portfolio-report hud-frame");
  box.appendChild(el("h1", "portfolio-title", `v${va.n} → v${vb.n}`));
  box.appendChild(el("p", null, `${va.name} (${fmtDate(va.savedAt)})  →  ${vb.name} (${fmtDate(vb.savedAt)})`));
  if (vb.changes) box.appendChild(el("p", "portfolio-a", `What changed, in v${vb.n}'s own words: ${vb.changes}`));

  box.appendChild(el("h2", "portfolio-h2", "Code"));
  const diff = lineDiff(va.code ?? "", vb.code ?? "");
  const added = diff.filter((d) => d.type === "add").length, removed = diff.filter((d) => d.type === "del").length;
  box.appendChild(el("p", "pathway-item-meta", added || removed ? `${added} line${added === 1 ? "" : "s"} added, ${removed} removed.` : "The code is the same."));
  if (added || removed) {
    const pre = el("pre", "code-block portfolio-diff");
    for (const d of diff) pre.appendChild(el("span", `diff-${d.type}`, `${d.type === "add" ? "+ " : d.type === "del" ? "- " : "  "}${d.text}`));
    box.appendChild(pre);
  }

  box.appendChild(el("h2", "portfolio-h2", "Circuit"));
  const ca = circuitSummary(va.circuit), cb = circuitSummary(vb.circuit);
  const sameCircuit = JSON.stringify(va.circuit?.wires ?? []) === JSON.stringify(vb.circuit?.wires ?? []) && ca.text === cb.text;
  box.appendChild(el("p", null, sameCircuit ? "The circuit is the same." : `v${va.n}: ${ca.text} (${ca.wires} wires) → v${vb.n}: ${cb.text} (${cb.wires} wires).`));

  box.appendChild(el("h2", "portfolio-h2", "Documentation"));
  const changes = docChanges(va.doc, vb.doc);
  if (!changes.length) box.appendChild(el("p", null, "No answers changed."));
  for (const c of changes) {
    const d = el("div", "portfolio-doc-change");
    d.appendChild(el("div", "portfolio-q", `${c.section.letter}. ${c.question}`));
    d.appendChild(el("p", "diff-del-text", va.doc[c.section.id][c.field] || "(empty)"));
    d.appendChild(el("p", "diff-add-text", vb.doc[c.section.id][c.field] || "(empty)"));
    box.appendChild(d);
  }
  container.appendChild(box);
}
