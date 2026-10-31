// "Ask Sam" - the tutor window. Type a question (or pick a suggested one) and
// the answer comes in small steps: the first step straight away, the rest
// one press at a time; a question to think about before its answer is shown;
// and, for "it doesn't work" questions, a look at your actual board and code
// as a ladder of hints. Every answer links to the lessons that teach it.
//
// It says plainly what it is: a rule-based tutor built from this course's
// own explanations - not an AI model. Questions aren't saved or sent anywhere.

import { openModal } from "../game/modal.js";
import { answer, lessonRef, STARTER_QUESTIONS } from "./tutor.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(text, className, onClick) {
  const b = el("button", `btn ${className}`, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

// getContext(): { code, findings, lastError, where, lessonId } for the workspace on screen
// onOpenLesson(id): leave the tutor and open that lesson
export function openTutor({ getContext, onOpenLesson, suggestions = [], initialQuestion = null } = {}) {
  const root = el("div", "tutor");
  const log = el("div", "tutor-log");
  log.setAttribute("aria-live", "polite");
  const form = el("form", "tutor-form");
  const input = el("input", "tutor-input");
  input.type = "text";
  input.placeholder = "Ask about electronics, code, or something that isn't working…";
  input.setAttribute("aria-label", "Your question");
  input.maxLength = 300;
  form.append(input, Object.assign(el("button", "btn btn-primary", "Ask"), { type: "submit" }));
  const chips = el("div", "tutor-chips");
  const disclosure = el("p", "tutor-disclosure",
    "Sam is a rule-based tutor: answers come from this course's own lessons, matched to the words in your question - not from an AI model. Nothing you type is saved or sent anywhere.");
  root.append(log, form, chips, disclosure);

  const setChips = (list) => {
    chips.innerHTML = "";
    for (const q of [...new Set(list)].slice(0, 6)) chips.appendChild(btn(q, "btn-secondary btn-small tutor-chip", () => ask(q)));
  };

  let handle = null;
  const ask = (question) => {
    const q = String(question).trim();
    if (!q) return;
    input.value = "";
    let context = {};
    try { context = getContext?.() ?? {}; } catch { context = {}; }
    const a = answer(q, context);
    log.appendChild(el("div", "tutor-q", q));
    log.appendChild(renderAnswer(a, { ask, openLesson: (id) => { handle?.close(); onOpenLesson?.(id); } }));
    // below the box: what to ask next - the answer's own related links are already on its card
    const related = new Set((a.related ?? []).map((r) => r.title));
    setChips(a.suggestions?.length ? a.suggestions : STARTER_QUESTIONS.filter((s) => s.toLowerCase() !== q.toLowerCase() && !related.has(s)).slice(0, 4));
    log.lastElementChild.previousElementSibling.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

  log.appendChild(el("div", "tutor-a tutor-hello",
    "Hi - ask me about anything in the course: what voltage is, what a command does, why your LED won't light, or what an error means. I'll explain it a step at a time."));
  setChips([...suggestions, ...STARTER_QUESTIONS]);
  handle = openModal({
    title: "ASK SAM",
    content: root,
    className: "modal-wide tutor-modal",
    actions: [{ label: "Close", kind: "secondary" }],
    onOpen: () => { input.focus(); if (initialQuestion) ask(initialQuestion); },
  });
  return handle;
}

function renderAnswer(a, { ask, openLesson }) {
  const card = el("div", `tutor-a tutor-${a.kind}`);
  card.appendChild(el("div", "tutor-title", a.title));
  if (a.usage) card.appendChild(Object.assign(el("pre", "code-block"), { textContent: a.usage }));

  // "I looked at your work": a ladder of hints, one at a time
  if (a.diagnosis) {
    const d = a.diagnosis;
    const box = el("div", `tutor-diagnosis${d.fine ? " is-fine" : ""}`);
    box.appendChild(el("div", "lesson-list-heading", d.heading));
    box.appendChild(el("p", null, d.summary));
    const hints = el("ol", "tutor-hints");
    box.appendChild(hints);
    let shown = 0;
    const more = btn("Show a hint", "btn-hint btn-small", () => {
      hints.appendChild(el("li", null, d.hints[shown]));
      shown += 1;
      if (shown >= d.hints.length) more.remove();
      else more.textContent = shown === d.hints.length - 1 ? "Show the fix" : "Next hint";
    });
    if (d.hints.length) box.appendChild(more);
    if (d.lessonId && lessonRef(d.lessonId)) box.appendChild(btn(`Review ${lessonRef(d.lessonId).label}`, "btn-secondary btn-small", () => openLesson(d.lessonId)));
    card.appendChild(box);
    if (!d.none) card.appendChild(el("div", "lesson-list-heading tutor-general", "IN GENERAL"));
  }

  // the explanation, a step at a time
  const steps = el("ol", "tutor-steps");
  card.appendChild(steps);
  let i = 0;
  const extras = el("div", "tutor-extras");
  extras.hidden = true;
  const showStep = () => {
    steps.appendChild(el("li", null, a.steps[i]));
    i += 1;
    if (i >= a.steps.length) { stepBtn.remove(); extras.hidden = false; }
  };
  const stepBtn = btn("Next step", "btn-primary btn-small", showStep);
  showStep();
  if (i < a.steps.length) card.appendChild(stepBtn);

  if (a.example) {
    extras.appendChild(el("div", "lesson-list-heading", "EXAMPLE"));
    extras.appendChild(Object.assign(el("pre", "code-block"), { textContent: a.example }));
  }
  if (a.realWorld) {
    extras.appendChild(el("div", "lesson-list-heading", "IN THE REAL WORLD"));
    extras.appendChild(el("p", null, a.realWorld));
  }
  if (a.think) {
    const think = el("div", "tutor-think");
    think.appendChild(el("div", "lesson-list-heading", "THINK ABOUT IT"));
    think.appendChild(el("p", null, a.think.q));
    const reveal = btn("Show the answer", "btn-hint btn-small", () => {
      reveal.replaceWith(el("p", "tutor-think-answer", a.think.a));
    });
    think.appendChild(reveal);
    extras.appendChild(think);
  }
  card.appendChild(extras);
  if (!a.example && !a.realWorld && !a.think) extras.hidden = false;

  if (a.lessons?.length) {
    const row = el("div", "tutor-links");
    row.appendChild(el("span", "tutor-links-label", "Learn it properly:"));
    for (const l of a.lessons) row.appendChild(btn(l.label, "btn-secondary btn-small", () => openLesson(l.id)));
    card.appendChild(row);
  }
  if (a.suggestions?.length && a.kind === "unknown") {
    card.appendChild(el("p", "learning-legend", "Questions I can answer are below - or try naming the idea or command."));
  }
  if (a.related?.length) {
    const row = el("div", "tutor-links");
    row.appendChild(el("span", "tutor-links-label", "Related:"));
    for (const r of a.related) row.appendChild(btn(r.title, "btn-secondary btn-small", () => ask(r.title)));
    card.appendChild(row);
  }
  return card;
}
