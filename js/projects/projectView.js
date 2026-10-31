// The project library's two screens:
//
//   renderProjectPage  - on the Projects tab: the project, laid out as an
//     engineering process (introduction with the expected behaviour, objectives,
//     prerequisites, components, planning), then a choice of mode, then
//     troubleshooting, improvements, the knowledge check and your project log.
//   renderProjectBuilder - beside the editor and board in Free Practice while
//     you build: guided (one checked step at a time), challenge (goal,
//     constraints, optional hints) or independent (just the problem). Every
//     check runs YOUR code and reads YOUR circuit - see projects/beginner.js.
//
// Like the other view modules, these only render and report back.

import { simulate } from "../simulator/headless.js";
import { SKILLS } from "../lessons/curriculum.js";
import { renderQuiz } from "../quiz/quiz.js";
import { renderCheckResult } from "../lessons/challenge.js";
import { lessonById, lessonPosition } from "../progress/learning.js";
import { ENGINEERING_STEPS } from "./beginner.js";
import { icon } from "../game/sprites.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(text, kind, onClick) {
  const b = el("button", `btn btn-${kind}`, text);
  b.type = "button";
  if (onClick) b.addEventListener("click", onClick);
  return b;
}
const section = (n, title) => {
  const s = el("section", "project-part hud-frame");
  const h = el("h2", "lesson-section-title");
  h.append(el("span", "lesson-section-num", String(n)), title);
  s.appendChild(h);
  return s;
};
const list = (items, ordered = false) => {
  const l = el(ordered ? "ol" : "ul", "lesson-list");
  for (const t of items) l.appendChild(el("li", null, t));
  return l;
};

export const MODES = {
  guided: { label: "Guided", blurb: "Step by step: build the circuit, then the code, one checked step at a time, with hints." },
  challenge: { label: "Challenge", blurb: "The goal, the parts and the rules. You plan and build it; hints only if you ask." },
  independent: { label: "Independent", blurb: "Just the real-world problem and its requirements. Your design, your way." },
};

// The expected behaviour, drawn from a REAL run of a working solution: one
// row per output pin, filled while it's on.
export function behaviourTimeline(project) {
  const ms = project.previewMs ?? 2000;
  const sim = simulate(project.reference, { ms, inputs: { digitalRead: () => 1, ...project.previewInputs } });
  const pins = project.previewPins;
  const W = 560, rowH = 26, left = 70, top = 8;
  const H = top + pins.length * rowH + 24;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "diagram project-timeline");
  svg.setAttribute("role", "img");
  const add = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text !== undefined) e.textContent = text; svg.appendChild(e); return e; };
  const x = (t) => left + (t / ms) * (W - left - 10);
  const description = [];
  pins.forEach((pin, row) => {
    const y = top + row * rowH;
    add("text", { x: 4, y: y + 16, class: "dg-small" }, `pin ${pin}${project.previewLabels?.[pin] ? ` ${project.previewLabels[pin]}` : ""}`);
    add("rect", { x: left, y: y + 4, width: W - left - 10, height: rowH - 10, class: "dg-box" });
    let start = null;
    for (let t = 0; t <= ms; t += 10) {
      const on = sim.hardware.levelAt(pin, t) > 0;
      if (on && start === null) start = t;
      if ((!on || t === ms) && start !== null) {
        add("rect", { x: x(start), y: y + 4, width: Math.max(1, x(t) - x(start)), height: rowH - 10, class: "dg-on" });
        description.push(`pin ${pin} on from ${start} to ${t} ms`);
        start = null;
      }
    }
  });
  for (let s = 0; s * 1000 <= ms; s++) add("text", { x: x(s * 1000), y: H - 4, class: "dg-small", "text-anchor": "middle" }, `${s} s`);
  svg.setAttribute("aria-label", `Expected behaviour: ${description.join("; ")}.`);
  return svg;
}

function expectedBehaviour(project) {
  const fig = el("figure", "lesson-diagram");
  fig.appendChild(behaviourTimeline(project));
  fig.appendChild(el("figcaption", null, `What a working version does - drawn from a real run in the simulator.${project.previewNote ? ` ${project.previewNote}` : ""}`));
  return fig;
}

// ---------------------------------------------------------------- the project page
export function renderProjectPage(container, project, progress, { onBack, onStart, onOpenLesson, onQuizResult, onSaveLog } = {}) {
  container.innerHTML = "";
  const entry = progress.projects?.[project.id] ?? {};
  const completed = entry.completed ?? {};
  const done = Object.keys(completed).length > 0;

  const head = el("div", "projects-intro");
  head.appendChild(button("← All projects", "secondary", onBack));
  const h1 = el("h1");
  h1.innerHTML = icon(project.sprite, 3);
  h1.append(` ${project.title}`);
  head.appendChild(h1);
  const badges = el("div", "project-badges");
  badges.append(el("span", `project-level is-${project.level}`, project.level), el("span", "project-sim-ok", "✔ Fully simulated - every part and command runs in the simulator"));
  for (const m of Object.keys(completed)) badges.appendChild(el("span", "learn-tag is-done", `${MODES[m].label} ✔`));
  head.appendChild(badges);
  head.appendChild(el("p", null, project.summary));
  container.appendChild(head);

  // 1 introduction
  const intro = section(1, "Project introduction");
  intro.append(el("p", null, project.problem), el("p", null, `Why it's useful: ${project.why}`));
  const chips = el("div", "project-concepts");
  chips.appendChild(el("span", "project-builds-label", "You'll practise:"));
  for (const c of project.concepts) chips.appendChild(el("span", "learn-tag", SKILLS[c]));
  intro.append(chips, expectedBehaviour(project));
  container.appendChild(intro);

  // 2 objectives, 3 prerequisites
  const goals = section(2, "Learning objectives");
  goals.appendChild(list(project.objectives));
  container.appendChild(goals);
  const pre = section(3, "Before you start");
  pre.appendChild(el("p", null, "These lessons teach what this project uses. Not done them yet? You can still try - they're recommendations, not a lock."));
  const links = el("div", "project-lesson-links");
  for (const id of project.needs) {
    const l = lessonById(id);
    if (!l) continue;
    const ok = progress.viewedLessons.includes(id);
    const b = button(`${ok ? "✔" : "○"} ${lessonPosition(l).label} ${l.title}`, "hint", () => onOpenLesson?.(id));
    b.className = `project-lesson-link${ok ? " is-done" : ""}`;
    links.appendChild(b);
  }
  pre.appendChild(links);
  container.appendChild(pre);

  // 4 components
  const comps = section(4, "Components");
  const wrap = el("div", "lesson-table-wrap");
  const table = el("table", "lesson-table");
  table.innerHTML = "<thead><tr><th scope=col>Part</th><th scope=col>What it's for</th><th scope=col>How it works</th><th scope=col>Why this project needs it</th><th scope=col>How it connects</th></tr></thead>";
  const tb = el("tbody");
  for (const c of project.components) {
    const tr = el("tr");
    const th = el("th", null, `${c.kind} × ${c.count}`);
    th.scope = "row";
    tr.append(th, el("td", null, c.purpose), el("td", null, c.how), el("td", null, c.why), el("td", null, c.connects));
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  wrap.appendChild(table);
  comps.appendChild(wrap);
  container.appendChild(comps);

  // 5 planning - the engineering process
  const plan = section(5, "Plan it like an engineer");
  plan.appendChild(el("p", null, "Engineers plan before they build: a mistake in a plan costs a minute; the same mistake in a built circuit can cost hours. These are the steps every project here follows:"));
  const steps = el("ol", "project-engineering");
  for (const [title, q] of ENGINEERING_STEPS) {
    const li = el("li");
    li.append(el("strong", null, title), ` - ${q}`);
    steps.appendChild(li);
  }
  plan.appendChild(steps);
  plan.appendChild(el("p", null, "Try steps 1-6 yourself first. Write your plan here (it's saved), then compare it with a worked plan - yours may be different and still right."));
  const myPlan = el("textarea", "lesson-reasoning-box project-log-box");
  myPlan.rows = 4;
  myPlan.placeholder = "The problem in one sentence... the inputs... the outputs... the steps the program takes...";
  myPlan.value = entry.log?.plan ?? "";
  myPlan.addEventListener("change", () => onSaveLog?.("plan", myPlan.value));
  plan.appendChild(myPlan);
  const reveal = el("details", "project-plan");
  reveal.appendChild(el("summary", null, "Compare with a worked plan"));
  const p = project.plan;
  const pt = el("div", "lesson-table-wrap");
  const ptable = el("table", "lesson-table");
  const ptb = el("tbody");
  for (const [k, v] of [["Problem", p.problem], ["Inputs", p.inputs], ["Outputs", p.outputs], ["Circuit", p.circuit.join(" · ")]]) {
    const tr = el("tr");
    const th = el("th", null, k);
    th.scope = "row";
    tr.append(th, el("td", null, v));
    ptb.appendChild(tr);
  }
  ptable.appendChild(ptb);
  pt.appendChild(ptable);
  reveal.append(pt, el("div", "lesson-list-heading", "PROGRAM LOGIC (PSEUDOCODE)"), el("pre", "example-text", p.logic));
  plan.appendChild(reveal);
  container.appendChild(plan);

  // choose a mode
  const modes = section(6, "Build it - choose how");
  const cards = el("div", "project-modes");
  for (const [key, m] of Object.entries(MODES)) {
    const card = el("div", `project-mode${completed[key] ? " is-done" : ""}`);
    card.append(el("strong", null, `${m.label}${completed[key] ? " ✔" : ""}`), el("p", null, m.blurb));
    card.appendChild(button(completed[key] ? `Build it again (${m.label})` : `Start (${m.label})`, key === "guided" ? "complete" : "primary", () => onStart?.(key)));
    cards.appendChild(card);
  }
  modes.appendChild(cards);
  modes.appendChild(el("p", "learning-legend", "You build in Free Practice, with the project beside the editor and board. Every check runs your own code and reads your own circuit, so any solution that works is accepted."));
  container.appendChild(modes);

  // troubleshooting
  const tr = section(7, "Testing and troubleshooting");
  tr.appendChild(el("p", null, "Test against every requirement. If something's wrong, check the circuit first (Check Circuit), then the code. Common problems:"));
  const tt = el("div", "lesson-table-wrap");
  const ttable = el("table", "lesson-table");
  ttable.innerHTML = "<thead><tr><th scope=col>Problem</th><th scope=col>What to check</th></tr></thead>";
  const ttb = el("tbody");
  for (const t of project.troubleshooting) {
    const row = el("tr");
    const th = el("th", null, t.problem);
    th.scope = "row";
    row.append(th, el("td", null, t.fix));
    ttb.appendChild(row);
  }
  ttable.appendChild(ttb);
  tt.appendChild(ttable);
  tr.appendChild(tt);
  container.appendChild(tr);

  // improvements, knowledge check, log
  const imp = section(8, "Improve the design");
  imp.appendChild(el("p", null, done ? "Your project works - now make it better. Open the builder (any mode) to try these; the ones marked ✓ can be checked automatically." : "Once your project works, try these extensions."));
  imp.appendChild(list(project.improvements.map((i) => `${i.title}${i.check ? " ✓" : ""}: ${i.task}`)));
  container.appendChild(imp);

  const kc = section(9, "Final knowledge check");
  kc.appendChild(el("p", null, "Can you explain why it works? Building it is half the job."));
  const quizBox = el("div");
  kc.appendChild(quizBox);
  renderQuiz(quizBox, project.knowledge, onQuizResult);
  container.appendChild(kc);

  const log = section(10, "Your project log");
  log.appendChild(el("p", null, "Engineers keep notes. Write down what went wrong and how you fixed it, and what you changed - it's saved with your progress, in this browser."));
  for (const [field, label] of [["problems", "Problems I met, and how I solved them"], ["improvements", "Improvements I made"]]) {
    const lab = el("label", "lesson-reasoning", label);
    const box = el("textarea", "lesson-reasoning-box project-log-box");
    box.rows = 3;
    box.value = entry.log?.[field] ?? "";
    box.addEventListener("change", () => onSaveLog?.(field, box.value));
    lab.appendChild(box);
    log.appendChild(lab);
  }
  container.appendChild(log);
}

// ---------------------------------------------------------------- the builder panel
// runCheck(spec) -> a check result for the learner's current code and circuit.
export function renderProjectBuilder(container, project, mode, progress, { runCheck, onStepPassed, onComplete, onHint, onExit, onBackToPage }) {
  const entry = progress.projects?.[project.id] ?? { stagesDone: [] };
  let stepIndex = mode === "guided" ? Math.max(0, project.steps.findIndex((s) => !entry.stagesDone.includes(s.id))) : 0;
  if (mode === "guided" && project.steps.every((s) => entry.stagesDone.includes(s.id)) && !entry.completed?.guided) stepIndex = project.steps.length - 1;
  let finished = false;
  let hintsUsed = 0; // in THIS build - recorded with the completion, never penalised
  const useHint = () => { hintsUsed++; onHint?.(); };

  const header = () => {
    const head = el("div", "guide-head");
    head.append(el("div", "guide-eyebrow", `PROJECT · ${MODES[mode].label.toUpperCase()}`), button("Exit", "secondary", onExit));
    container.appendChild(head);
    container.appendChild(el("h2", "guide-title", project.title));
  };

  // a hint ladder: one at a time; the code only once every hint is used
  const hintLadder = (hints, code, onReveal) => {
    const box = el("div", "project-hints");
    let shown = 0;
    const out = el("div");
    const next = button(`Hint 1 of ${hints.length}`, "hint", () => {
      out.appendChild(el("p", "hint-box", `Hint ${shown + 1}: ${hints[shown]}`));
      shown++;
      useHint();
      onReveal?.();
      if (shown < hints.length) next.textContent = `Hint ${shown + 1} of ${hints.length}`;
      else if (code) {
        next.replaceWith(button("Show a working version of this code", "hint", (e) => {
          useHint();
          const pre = el("pre", "code-block", code);
          out.appendChild(el("p", "check-hint", "One way to do it - read it, then try writing it yourself:"));
          out.appendChild(pre);
          e.currentTarget.remove();
        }));
      } else next.remove();
    });
    box.append(next, out);
    return box;
  };

  const checkArea = () => { const a = el("div", "check-result"); a.hidden = true; return a; };

  const render = () => {
    container.innerHTML = "";
    header();
    if (finished) return renderDone();

    if (mode === "guided") {
      const step = project.steps[stepIndex];
      container.appendChild(el("div", "guide-eyebrow", `STEP ${stepIndex + 1} OF ${project.steps.length} · ${step.kind === "circuit" ? "CIRCUIT" : "CODE"}`));
      container.appendChild(el("h3", null, step.title));
      container.appendChild(el("p", null, step.task));
      if (step.explain) container.appendChild(el("p", "learning-legend", step.explain));
      container.appendChild(hintLadder(step.hints, step.kind === "code" ? (step.reference ?? project.reference) : null));
      const area = checkArea();
      const actions = el("div", "next-step-actions");
      actions.appendChild(button(step.kind === "circuit" ? "Check my circuit" : "Check this step", "complete", () => {
        const r = runCheck(step.check);
        renderCheckResult(area, r);
        if (r.status === "pass") {
          onStepPassed?.(step.id);
          actions.replaceChildren(button(stepIndex < project.steps.length - 1 ? "Next step →" : "Finish the project", "complete", () => {
            if (stepIndex < project.steps.length - 1) { stepIndex++; render(); } else finalCheck();
          }));
        }
      }));
      container.append(actions, area);
    } else {
      const brief = mode === "challenge" ? project.challenge : project.independent;
      if (mode === "challenge") {
        container.appendChild(el("div", "lesson-list-heading", "OBJECTIVE"));
        container.appendChild(el("p", null, brief.objective));
        container.appendChild(el("div", "lesson-list-heading", "CONSTRAINTS"));
        container.appendChild(list(brief.constraints));
      } else {
        container.appendChild(el("div", "lesson-list-heading", "THE PROBLEM"));
        container.appendChild(el("p", null, brief.problem));
        container.appendChild(el("div", "lesson-list-heading", "REQUIREMENTS"));
        container.appendChild(list(brief.requirements));
        container.appendChild(el("div", "lesson-list-heading", "LIMITS"));
        container.appendChild(list(brief.limits));
      }
      container.appendChild(el("div", "lesson-list-heading", "EXPECTED BEHAVIOUR"));
      container.appendChild(expectedBehaviour(project));
      if (mode === "challenge") container.appendChild(hintLadder(brief.hints, null));
      const area = checkArea();
      container.append(button("Check my project", "complete", () => {
        const r = runCheck(project.final);
        renderCheckResult(area, r);
        if (r.status === "pass") { finished = true; onComplete?.(mode, hintsUsed); render(); }
      }), area);
    }
    const help = el("details", "project-plan");
    help.appendChild(el("summary", null, "Stuck? Common problems"));
    help.appendChild(list(project.troubleshooting.map((t) => `${t.problem} → ${t.fix}`)));
    container.appendChild(help);
  };

  // after the last guided step: the whole project, checked together
  const finalCheck = () => {
    const r = runCheck(project.final);
    if (r.status === "pass") { finished = true; onComplete?.(mode, hintsUsed); render(); return; }
    const area = checkArea();
    renderCheckResult(area, r);
    container.appendChild(area);
  };

  const renderDone = () => {
    container.appendChild(el("div", "lesson-list-heading", "PROJECT COMPLETE ✔"));
    container.appendChild(el("p", null, `It does everything it should, and the check ran your own code and circuit. Concepts you applied: ${project.concepts.map((c) => SKILLS[c]).join(", ")}.`));
    container.appendChild(el("div", "lesson-list-heading", "IMPROVE THE DESIGN"));
    for (const imp of project.improvements) {
      const box = el("div", "lesson-exercise is-independent");
      box.append(el("strong", null, imp.title), el("p", null, imp.task));
      if (imp.check) {
        const area = checkArea();
        box.append(button("Check this improvement", "hint", () => renderCheckResult(area, runCheck(imp.check))), area);
      } else {
        box.appendChild(el("p", "learning-legend", "No automatic check for this one - test it on the board against your own plan."));
      }
      container.appendChild(box);
    }
    container.appendChild(button("Back to the project page (knowledge check and your log)", "primary", onBackToPage));
  };

  render();
}
