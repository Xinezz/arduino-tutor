// Renders the Projects view: a grid of project cards, and a staged
// step-by-step detail view for whichever project is selected. Mirrors the
// challenge system's philosophy - goal + hint first, example code only if
// you reveal it, and you decide when a stage is "done" by testing it
// yourself in the practice editor (shared with the Lessons view).

import { projects } from "./data.js";
import { getProjectProgress } from "../progress/progress.js";
import { typewriterText } from "../utils/typewriter.js";
import { icon } from "../game/sprites.js";
import { centerOf } from "../game/fx.js";

export function renderProjectList(container, progress, { onSelectProject }) {
  container.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "projects-intro";
  intro.innerHTML = `<h1>Mini Projects</h1><p>Combine everything you've learned so far into a real, working build. Each project unlocks once you've completed enough lessons to have the tools for it.</p>`;
  container.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "project-grid";

  for (const project of projects) {
    const isUnlocked = project.requiredLessons.every((id) => progress.viewedLessons.includes(id));
    const stagesDone = getProjectProgress(progress, project.id).stagesDone.length;
    const totalStages = project.stages.length;

    const card = document.createElement("div");
    card.className = "project-card hud-frame" + (isUnlocked ? "" : " locked");

    const iconEl = document.createElement("div");
    iconEl.className = "project-card-icon";
    iconEl.innerHTML = icon(isUnlocked ? project.sprite || "chip" : "lock", 5);
    card.appendChild(iconEl);

    const h3 = document.createElement("h3");
    h3.textContent = project.title;
    card.appendChild(h3);

    const p = document.createElement("p");
    p.textContent = project.description;
    card.appendChild(p);

    if (isUnlocked) {
      const progressBar = document.createElement("div");
      progressBar.className = "project-progress-bar";
      const fill = document.createElement("div");
      fill.className = "project-progress-fill";
      fill.style.width = `${totalStages ? (stagesDone / totalStages) * 100 : 0}%`;
      progressBar.appendChild(fill);
      card.appendChild(progressBar);

      const label = document.createElement("div");
      label.className = "quiz-prompt";
      label.style.margin = "6px 0 0";
      label.style.fontSize = "0.78rem";
      label.style.color = "var(--text-dim)";
      label.textContent = `${stagesDone} / ${totalStages} stages complete`;
      card.appendChild(label);

      card.addEventListener("click", () => onSelectProject(project.id));
    } else {
      const lockNote = document.createElement("div");
      lockNote.className = "project-lock-note";
      lockNote.innerHTML = icon("lock", 1);
      lockNote.appendChild(document.createTextNode(" " + project.requiredLabel));
      card.appendChild(lockNote);
    }

    grid.appendChild(card);
  }

  container.appendChild(grid);
}

export function renderProjectDetail(container, project, progress, { onBack, onStageComplete, onOpenEditor }) {
  container.innerHTML = "";
  const done = new Set(getProjectProgress(progress, project.id).stagesDone);

  const header = document.createElement("div");
  header.className = "project-detail-header";
  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-secondary";
  backBtn.innerHTML = `<span class="arrow-ico flip">${icon("play", 1)}</span> All Projects`;
  backBtn.addEventListener("click", onBack);
  header.appendChild(backBtn);

  const h1 = document.createElement("h1");
  h1.innerHTML = icon(project.sprite || "chip", 3);
  h1.appendChild(document.createTextNode(" " + project.title));
  header.appendChild(h1);

  const desc = document.createElement("p");
  desc.style.color = "var(--text-dim)";
  desc.textContent = project.description;
  header.appendChild(desc);

  const openEditorBtn = document.createElement("button");
  openEditorBtn.className = "btn btn-primary";
  openEditorBtn.style.marginTop = "10px";
  openEditorBtn.innerHTML = `Open Practice Editor & Circuit Board <span class="arrow-ico">${icon("play", 1)}</span>`;
  openEditorBtn.addEventListener("click", onOpenEditor);
  header.appendChild(openEditorBtn);

  container.appendChild(header);

  const tracker = document.createElement("div");
  tracker.className = "project-stage-tracker";
  project.stages.forEach((stage, i) => {
    const dot = document.createElement("div");
    dot.className = "project-stage-dot" + (done.has(stage.id) ? " done" : "");
    if (done.has(stage.id)) dot.innerHTML = icon("check", 1);
    else dot.textContent = String(i + 1);
    dot.title = stage.title;
    tracker.appendChild(dot);
  });
  container.appendChild(tracker);

  for (const stage of project.stages) {
    container.appendChild(renderStageCard(project, stage, done.has(stage.id), onStageComplete));
  }
}

function renderStageCard(project, stage, isDone, onStageComplete) {
  const card = document.createElement("div");
  card.className = "project-stage-card hud-frame" + (isDone ? " done" : "");

  const h3 = document.createElement("h3");
  h3.textContent = stage.title;
  if (isDone) h3.insertAdjacentHTML("beforeend", ` ${icon("check", 2)}`);
  card.appendChild(h3);

  const goal = document.createElement("p");
  goal.textContent = stage.goal;
  card.appendChild(goal);

  const controls = document.createElement("div");
  controls.className = "hint-controls";

  const hintBtn = document.createElement("button");
  hintBtn.className = "btn btn-hint";
  hintBtn.textContent = "Show Hint";

  const exampleBtn = document.createElement("button");
  exampleBtn.className = "btn btn-hint";
  exampleBtn.textContent = "Show Example Code";

  const doneBtn = document.createElement("button");
  doneBtn.className = "btn btn-primary";
  doneBtn.dataset.sfx = "none";
  if (isDone) doneBtn.innerHTML = `${icon("check", 2)} Stage Complete`;
  else doneBtn.innerHTML = `${icon("check", 2)} Mark Stage Complete`;
  doneBtn.disabled = isDone;

  controls.appendChild(hintBtn);
  controls.appendChild(exampleBtn);
  controls.appendChild(doneBtn);
  card.appendChild(controls);

  const revealArea = document.createElement("div");
  card.appendChild(revealArea);

  hintBtn.addEventListener("click", () => {
    const box = document.createElement("div");
    box.className = "hint-box";
    box.textContent = "Hint: " + stage.hint;
    revealArea.appendChild(box);
    hintBtn.disabled = true;
  });

  exampleBtn.addEventListener("click", () => {
    const box = document.createElement("div");
    box.className = "solution-box";
    const codeEl = document.createElement("pre");
    codeEl.className = "code-block";
    typewriterText(codeEl, stage.exampleCode);
    box.appendChild(codeEl);
    revealArea.appendChild(box);
    exampleBtn.disabled = true;
  });

  doneBtn.addEventListener("click", () => {
    const at = centerOf(doneBtn); // grab the position before the re-render replaces this button
    onStageComplete(project.id, stage.id, { at });
    doneBtn.innerHTML = `${icon("check", 2)} Stage Complete`;
    doneBtn.disabled = true;
    card.classList.add("done");
  });

  return card;
}
