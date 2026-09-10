// Renders the Dashboard view: the progression ladder, headline stats, and a
// "topics to review" list built from quiz attempts the learner hasn't
// gotten right yet. This is read-only - all it does is summarize state that
// progress.js already tracks, the same way a real dashboard sits on top of
// a database rather than owning its own data.

import { lessons } from "../lessons/data.js";
import { projects } from "../projects/data.js";
import { quizzes } from "../quiz/data.js";
import { getProjectProgress } from "../progress/progress.js";

// The full ladder from the course design. Only the first two ranks are
// reachable with the content built so far (Levels 1-2) - the rest are shown
// as genuinely locked rather than faked, since Levels 3+ don't exist yet.
const RANKS = [
  { name: "Arduino Beginner", desc: "Getting comfortable with the fundamentals: setup(), loop(), variables, the Serial Monitor." },
  { name: "Digital I/O Apprentice", desc: "Can wire and control LEDs and buttons, and reason about pin states." },
  { name: "Sensor Explorer", desc: "Reads and interprets real-world sensor data (analog input).", future: true },
  { name: "Arduino Programmer", desc: "Fluent in the programming fundamentals behind every sketch.", future: true },
  { name: "Embedded Systems Builder", desc: "Writes non-blocking, interrupt-aware, multi-part programs.", future: true },
  { name: "Mechatronics Engineer", desc: "Builds full multi-sensor, multi-actuator mechatronics projects.", future: true },
];

function computeCurrentRankIndex(progress) {
  const level1Ids = lessons.filter((l) => l.level === 1).map((l) => l.id);
  const level1Done = level1Ids.every((id) => progress.viewedLessons.includes(id));
  return level1Done ? 1 : 0;
}

function countChallenges() {
  let total = 0;
  for (const lesson of lessons) if (lesson.challenge) total++;
  return total;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderDashboard(container, progress) {
  container.innerHTML = "";

  const header = el("div", "dashboard-header");
  header.appendChild(el("h1", null, "Your Progress"));
  header.appendChild(el("p", null, "A snapshot of what you've learned, practiced, and built so far."));
  container.appendChild(header);

  // ---- stat tiles ----
  const totalLessons = lessons.length;
  const doneLessons = progress.viewedLessons.length;
  const totalChallenges = countChallenges();
  const doneChallenges = progress.completedChallenges.length;
  const quizEntries = Object.values(progress.quizzes || {});
  const solvedQuizzes = quizEntries.filter((q) => q.solved).length;
  const totalQuizzes = Object.keys(quizzes).length;
  const projectStagesDone = projects.reduce(
    (sum, p) => sum + getProjectProgress(progress, p.id).stagesDone.length,
    0
  );
  const projectStagesTotal = projects.reduce((sum, p) => sum + p.stages.length, 0);

  const statGrid = el("div", "stat-grid");
  statGrid.appendChild(statTile(`${doneLessons} / ${totalLessons}`, "Lessons Complete"));
  statGrid.appendChild(statTile(`${doneChallenges} / ${totalChallenges}`, "Challenges Solved"));
  statGrid.appendChild(statTile(`${solvedQuizzes} / ${totalQuizzes}`, "Quizzes Solved"));
  statGrid.appendChild(statTile(`${projectStagesDone} / ${projectStagesTotal}`, "Project Stages Built"));
  statGrid.appendChild(statTile(`${progress.streak || 0} 🔥`, "Day Streak"));
  container.appendChild(statGrid);

  // ---- rank ladder ----
  container.appendChild(el("div", "dashboard-section-title", "Progression"));
  const currentRankIndex = computeCurrentRankIndex(progress);
  const ladder = el("div", "rank-ladder");
  RANKS.forEach((rank, i) => {
    const step = el("div", "rank-step");
    if (i < currentRankIndex) step.classList.add("achieved");
    else if (i === currentRankIndex) step.classList.add("current");
    else step.classList.add("locked");

    const badge = el("div", "rank-step-badge", i < currentRankIndex ? "✓" : String(i + 1));
    step.appendChild(badge);

    const textWrap = document.createElement("div");
    textWrap.appendChild(el("div", "rank-step-name", rank.name));
    textWrap.appendChild(el("div", "rank-step-desc", rank.desc));
    step.appendChild(textWrap);

    const tag = el(
      "div",
      "rank-step-tag",
      i === currentRankIndex ? "Current" : rank.future ? "Future level" : i < currentRankIndex ? "Achieved" : "Locked"
    );
    step.appendChild(tag);

    ladder.appendChild(step);
  });
  container.appendChild(ladder);

  if (currentRankIndex === 1 && progress.viewedLessons.length >= lessons.length) {
    const note = el(
      "div",
      "quiz-result success",
      "You've completed every lesson currently available! Levels 3+ (sensors, PWM, communication, and beyond) are planned for a future update."
    );
    container.appendChild(note);
  }

  // ---- weak topics ----
  container.appendChild(el("div", "dashboard-section-title", "Topics to Review"));
  const weakTopics = quizEntries.filter((q) => !q.solved);
  if (weakTopics.length === 0) {
    const empty = el(
      "div",
      "dashboard-empty",
      quizEntries.length === 0
        ? "You haven't tried any quiz games yet - they show up inside lessons that have one."
        : "No outstanding weak spots - you've gotten every quiz you've attempted correct."
    );
    container.appendChild(empty);
  } else {
    const list = el("div", "weak-topic-list");
    for (const entry of weakTopics) {
      const row = el("div", "weak-topic-row");
      row.appendChild(el("span", null, entry.topic));
      row.appendChild(el("span", "tag", `${entry.attempts} attempt${entry.attempts === 1 ? "" : "s"}, not yet correct`));
      list.appendChild(row);
    }
    container.appendChild(list);
  }
}

function statTile(value, label) {
  const tile = el("div", "stat-tile");
  tile.appendChild(el("div", "stat-tile-value", value));
  tile.appendChild(el("div", "stat-tile-label", label));
  return tile;
}
