// The learning half of the Progress page: what you've actually learned, not
// how many coins you have. Next step, progress per module, every skill with
// an honest status, what needs revision (and a button to go and revise it),
// and a revision round - checkpoint questions from lessons you've finished,
// the ones you got wrong first. Rewards (XP, trophies, missions) follow below
// it, rendered by dashboard.js.
//
// Only renders and reports back (onOpenLesson, onQuizResult), like every
// other view module.

import { lessons } from "../lessons/data.js";
import { MODULES } from "../lessons/curriculum.js";
import { renderQuiz } from "../quiz/quiz.js";
import { openModal } from "../game/modal.js";
import { lessonPosition, nextLesson, skillReport, learningSummary, revisionQuizzes } from "./learning.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const SKILL_STATUS = {
  "not-started": { label: "Not started", title: "No lesson on this yet" },
  learning: { label: "Learning", title: "Some of its lessons are done" },
  learned: { label: "Learned", title: "Every lesson on it is done" },
  practised: { label: "Practised", title: "A challenge using it passed its check" },
  mastered: { label: "Mastered", title: "Its challenges passed with no hints, and its checkpoints are answered" },
};

function tile(value, label) {
  const t = el("div", "learning-tile");
  t.append(el("div", "learning-tile-value", value), el("div", "learning-tile-label", label));
  return t;
}

export function renderLearningProgress(container, progress, { onOpenLesson, onQuizResult, onRoundEnd } = {}) {
  container.innerHTML = "";
  const section = el("section", "learning-progress");
  section.appendChild(el("h1", null, "Your Learning"));
  section.appendChild(el("p", "learn-sub", "What you've learned and practised - and what's worth another look. (Coins and trophies are further down.)"));

  // ---- next step ----
  const next = nextLesson(progress);
  if (next) {
    const card = el("div", "learn-next hud-frame");
    card.appendChild(el("div", "lesson-list-heading", "YOUR NEXT STEP"));
    card.appendChild(el("h2", "learn-next-title", `${lessonPosition(next).label} ${next.title}`));
    if (next.why) card.appendChild(el("p", "learn-next-why", next.why));
    const go = el("button", "btn btn-complete", "Go to lesson");
    go.type = "button";
    go.addEventListener("click", () => onOpenLesson?.(next.id));
    card.appendChild(go);
    section.appendChild(card);
  }

  // ---- totals ----
  const s = learningSummary(progress);
  const skills = skillReport(progress);
  const tiles = el("div", "learning-tiles");
  tiles.append(
    tile(`${s.lessonsDone}/${s.lessonsTotal}`, "lessons done"),
    tile(`${s.challengesPassed}/${s.challengesTotal}`, "challenges passed their check"),
    tile(`${s.challengesIndependent}`, "of those with no hints"),
    tile(`${s.checkpointsPassed}/${s.checkpointsTotal}`, "checkpoints answered correctly"),
    tile(s.predictionsMade ? `${s.predictionsRight}/${s.predictionsMade}` : "-", "predictions right first time"),
    tile(`${skills.filter((k) => k.status === "mastered").length}/${skills.length}`, "skills mastered"),
  );
  section.appendChild(tiles);

  // ---- modules ----
  section.appendChild(el("div", "dashboard-section-title", "Modules"));
  const mods = el("div", "learning-modules");
  for (const m of MODULES) {
    const inModule = lessons.filter((l) => l.module === m.number);
    const done = inModule.filter((l) => progress.viewedLessons.includes(l.id)).length;
    const row = el("div", `learning-module${done === inModule.length ? " is-complete" : ""}`);
    row.appendChild(el("span", "learning-module-name", `${m.number} · ${m.title}`));
    const bar = el("span", "learn-module-bar");
    const fill = el("span", "learn-module-bar-fill");
    fill.style.width = `${(done / inModule.length) * 100}%`;
    bar.appendChild(fill);
    row.append(bar, el("span", "learning-module-count", done === inModule.length ? "✔ Complete" : `${done}/${inModule.length}`));
    mods.appendChild(row);
  }
  section.appendChild(mods);

  // ---- skills ----
  section.appendChild(el("div", "dashboard-section-title", "Skills"));
  section.appendChild(el("p", "learning-legend",
    "Learning → Learned (lessons done) → Practised (a challenge passed its check) → Mastered (passed with no hints, checkpoints answered)."));
  const grid = el("div", "skill-grid");
  for (const k of skills) {
    const chip = el("div", `skill-chip is-${k.status}${k.revision.length ? " needs-revision" : ""}`);
    chip.title = `${SKILL_STATUS[k.status].title}. Taught in: ${k.lessons.map((l) => l.title).join(", ")}`;
    chip.append(el("span", "skill-name", k.name), el("span", "skill-status", SKILL_STATUS[k.status].label + (k.revision.length ? " · revise" : "")));
    grid.appendChild(chip);
  }
  section.appendChild(grid);

  // ---- needs revision ----
  section.appendChild(el("div", "dashboard-section-title", "Worth another look"));
  const revise = skills.filter((k) => k.revision.length);
  if (!revise.length) {
    section.appendChild(el("p", "learning-empty", "Nothing flagged right now. Wrong checkpoint answers, challenges that needed hints, and lessons you flag show up here."));
  } else {
    const list = el("div", "revision-list");
    for (const k of revise) {
      const row = el("div", "revision-row");
      const text = el("div", "revision-text");
      text.append(el("strong", null, k.name), el("span", null, ` - ${k.revision[0]}`));
      const btn = el("button", "btn btn-hint", `Review ${lessonPosition(k.reviewLesson).label}`);
      btn.type = "button";
      btn.title = k.reviewLesson.title;
      btn.addEventListener("click", () => onOpenLesson?.(k.reviewLesson.id));
      row.append(text, btn);
      list.appendChild(row);
    }
    section.appendChild(list);
  }

  // ---- revision round ----
  const round = el("div", "revision-round hud-frame");
  round.appendChild(el("div", "lesson-list-heading", "REVISION ROUND"));
  const pool = revisionQuizzes(progress, 3);
  if (!pool.length) {
    round.appendChild(el("p", null, "Answer a lesson's knowledge checkpoint (or finish the lesson), and its question will turn up here for revision."));
  } else {
    round.appendChild(el("p", null, `${pool.length} checkpoint question${pool.length === 1 ? "" : "s"} from lessons you've finished - the ones you found tricky first. Revisiting earlier ideas is what makes them stick.`));
    const start = el("button", "btn btn-primary", "Start revision round");
    start.type = "button";
    start.addEventListener("click", () => openRevisionRound(pool, onQuizResult, onRoundEnd));
    round.appendChild(start);
  }
  section.appendChild(round);
  container.appendChild(section);
}

// One question at a time, in a window. onDone runs when it closes, so the
// page behind it can show what changed.
function openRevisionRound(pool, onQuizResult, onDone) {
  let i = 0;
  let correct = 0;
  let answered = false;
  let nextBtn = null;
  const body = el("div", "revision-body");
  const counter = el("div", "lesson-list-heading");
  const from = el("p", "revision-from");
  const quizBox = el("div", "quiz-section");
  body.append(counter, from, quizBox);

  const show = () => {
    answered = false;
    const { lesson, quiz } = pool[i];
    counter.textContent = `QUESTION ${i + 1} OF ${pool.length}`;
    from.textContent = `From ${lessonPosition(lesson).label} ${lesson.title}`;
    renderQuiz(quizBox, quiz, (quizId, success, topic) => {
      if (!answered && success) correct++;
      answered = true;
      onQuizResult?.(quizId, success, topic);
      nextBtn.disabled = false;
    });
    nextBtn.disabled = true;
    nextBtn.textContent = i === pool.length - 1 ? "Finish" : "Next question";
  };

  // The window may wait in a queue behind another one (a reward, say), so
  // its button is only looked up - and the first question dealt - once it
  // is actually on screen.
  const handle = openModal({
    title: "REVISION ROUND",
    content: body,
    className: "modal-wide",
    actions: [{ label: "Next question", kind: "primary", closes: false, onClick: () => advance() }],
    onOpen: (box) => {
      nextBtn = box.querySelector(".modal-actions .btn");
      show();
    },
    onClose: () => onDone?.(),
  });
  let finished = false;
  function advance() {
    if (finished) {
      handle.close();
    } else if (i < pool.length - 1) {
      i++;
      show();
    } else {
      finished = true;
      body.innerHTML = "";
      body.append(el("div", "lesson-list-heading", "ROUND COMPLETE"),
        el("p", null, `${correct} of ${pool.length} right first time. ${correct === pool.length ? "Those ideas have stuck." : "The ones you missed stay on your revision list until you get them."}`));
      nextBtn.textContent = "Done";
    }
  }
}
