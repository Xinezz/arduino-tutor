// Renders the Dashboard view: the progression ladder, headline stats, and a
// "topics to review" list built from quiz attempts the learner hasn't
// gotten right yet. This is read-only - all it does is summarize state that
// progress.js already tracks, the same way a real dashboard sits on top of
// a database rather than owning its own data.

import { lessons } from "../lessons/data.js";
import { projects } from "../projects/data.js";
import { quizzes } from "../quiz/data.js";
import { getProjectProgress, getLevelInfo, LEVEL_MILESTONES } from "../progress/progress.js";
import { renderMentorBox, getDashboardGreeting } from "../npc/mentor.js";
import { animateCount } from "../utils/animateCount.js";
import { RANKS, computeCurrentRankIndex } from "../progress/ranks.js";

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

// quizzes (imported above) is keyed by lesson id, each value carrying its
// own quiz id - this just walks it backwards, since all we have on a weak
// topic is the quiz id progress.js recorded the result under.
function findLessonIdForQuizId(quizId) {
  for (const [lessonId, quiz] of Object.entries(quizzes)) {
    if (quiz.id === quizId) return lessonId;
  }
  return null;
}

export function renderDashboard(container, progress, { onReviewTopic } = {}) {
  container.innerHTML = "";

  const mentorBox = el("div", "mentor-box hud-frame");
  container.appendChild(mentorBox);
  renderMentorBox(mentorBox, { text: getDashboardGreeting(progress), tag: "Check-in" });

  const header = el("div", "dashboard-header");
  header.appendChild(el("h1", null, "Your Progress"));
  header.appendChild(el("p", null, "Your record as a junior tech at CircuitWorks Robotics - what you've learned, practiced, and built so far."));
  container.appendChild(header);

  // ---- XP bar ----
  // Deliberately separate from the Credits stat tile below: credits are a
  // spendable balance (see spendCredits in progress.js), XP only goes up, so
  // this bar always reflects total progress even after a hint spends credits
  // down into the red.
  const { level, xpIntoLevel, xpForLevel, pct } = getLevelInfo(progress.xp);
  const xpBar = el("div", "xp-bar-wrap hud-frame");
  const xpHeader = el("div", "xp-bar-header");
  xpHeader.appendChild(el("span", "xp-level", `Level ${level}`));
  xpHeader.appendChild(el("span", "xp-numbers", `${xpIntoLevel} / ${xpForLevel} XP`));
  xpBar.appendChild(xpHeader);
  const xpTrack = el("div", "xp-bar-track");
  const xpFill = el("div", "xp-bar-fill");
  xpFill.style.width = `${pct}%`;
  xpTrack.appendChild(xpFill);
  xpBar.appendChild(xpTrack);
  const nextMilestone = Object.keys(LEVEL_MILESTONES).map(Number).find((lvl) => lvl > level);
  if (nextMilestone) {
    xpBar.appendChild(el("div", "xp-bar-note", `Next bonus at Level ${nextMilestone}: +${LEVEL_MILESTONES[nextMilestone]} credits`));
  }
  container.appendChild(xpBar);

  // ---- stat tiles ----
  const totalLessons = lessons.length;
  const doneLessons = progress.viewedLessons.length;
  const totalChallenges = countChallenges();
  const doneChallenges = progress.completedChallenges.length;
  const quizEntries = Object.entries(progress.quizzes || {}).map(([quizId, entry]) => ({ ...entry, quizId }));
  const solvedQuizzes = quizEntries.filter((q) => q.solved).length;
  const totalQuizzes = Object.keys(quizzes).length;
  const projectStagesDone = projects.reduce(
    (sum, p) => sum + getProjectProgress(progress, p.id).stagesDone.length,
    0
  );
  const projectStagesTotal = projects.reduce((sum, p) => sum + p.stages.length, 0);

  const statGrid = el("div", "stat-grid");
  statGrid.appendChild(statTile(doneLessons, ` / ${totalLessons}`, "Lessons Complete"));
  statGrid.appendChild(statTile(doneChallenges, ` / ${totalChallenges}`, "Challenges Solved"));
  statGrid.appendChild(statTile(solvedQuizzes, ` / ${totalQuizzes}`, "Quizzes Solved"));
  statGrid.appendChild(statTile(projectStagesDone, ` / ${projectStagesTotal}`, "Project Stages Built"));
  statGrid.appendChild(statTile(progress.streak || 0, " 🔥", "Day Streak"));
  const creditsTile = statTile(progress.credits, "", "⚡ Credits");
  if (progress.credits < 0) creditsTile.querySelector(".stat-tile-value").classList.add("credits-debt");
  statGrid.appendChild(creditsTile);
  container.appendChild(statGrid);

  // ---- rank ladder ----
  container.appendChild(el("div", "dashboard-section-title", "Progression at CircuitWorks Robotics"));
  const currentRankIndex = computeCurrentRankIndex(progress);
  const ladder = el("div", "rank-ladder hud-frame");
  RANKS.forEach((rank, i) => {
    const step = el("div", "rank-step");
    if (i < currentRankIndex) step.classList.add("achieved");
    else if (i === currentRankIndex) step.classList.add("current");
    else step.classList.add("locked");

    const badgeText = i < currentRankIndex ? "✓" : i === currentRankIndex ? String(i + 1) : "🔒";
    const badge = el("div", "rank-step-badge", badgeText);
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

  const lastAchievableRankIndex = RANKS.findIndex((r) => r.future) - 1;
  if (currentRankIndex === lastAchievableRankIndex && progress.viewedLessons.length >= lessons.length) {
    const note = el(
      "div",
      "quiz-result success",
      "You've completed every lesson currently available! Programming Fundamentals, Communication, and the full mini-projects list are planned for a future update."
    );
    container.appendChild(note);
  }

  // ---- flagged lessons ----
  // Reuses the exact weak-topic-list markup/classes below - both sections
  // are the same shape ("a list of things to jump back into"), just sourced
  // from a different signal (a manual flag vs. an unsolved quiz).
  container.appendChild(el("div", "dashboard-section-title", "Flagged for Review"));
  const flaggedLessons = (progress.flaggedLessons || [])
    .map((id) => lessons.find((l) => l.id === id))
    .filter(Boolean);
  if (flaggedLessons.length === 0) {
    container.appendChild(el(
      "div",
      "dashboard-empty",
      'Nothing flagged yet - use "Flag for Review" on any lesson page to bookmark it here.'
    ));
  } else {
    const flagList = el("div", "weak-topic-list");
    for (const lesson of flaggedLessons) {
      const row = el("div", "weak-topic-row");
      row.appendChild(el("span", null, lesson.title));

      const right = el("div", "weak-topic-row-right");
      right.appendChild(el("span", "tag", `Level ${lesson.level}`));

      if (onReviewTopic) {
        const reviewBtn = document.createElement("button");
        reviewBtn.className = "btn btn-hint weak-topic-review-btn";
        reviewBtn.textContent = "Review →";
        reviewBtn.addEventListener("click", () => onReviewTopic(lesson.id));
        right.appendChild(reviewBtn);
      }
      row.appendChild(right);
      flagList.appendChild(row);
    }
    container.appendChild(flagList);
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

      const right = el("div", "weak-topic-row-right");
      right.appendChild(el("span", "tag", `${entry.attempts} attempt${entry.attempts === 1 ? "" : "s"}, not yet correct`));

      // Passively listing what you got wrong doesn't help you get it right -
      // jump straight back to the actual quiz instead of just naming it.
      const lessonId = findLessonIdForQuizId(entry.quizId);
      if (lessonId && onReviewTopic) {
        const reviewBtn = document.createElement("button");
        reviewBtn.className = "btn btn-hint weak-topic-review-btn";
        reviewBtn.textContent = "Review →";
        reviewBtn.addEventListener("click", () => onReviewTopic(lessonId));
        right.appendChild(reviewBtn);
      }
      row.appendChild(right);

      list.appendChild(row);
    }
    container.appendChild(list);
  }
}

function statTile(toValue, suffix, label) {
  const tile = el("div", "stat-tile");
  const valueEl = el("div", "stat-tile-value", "0" + suffix);
  tile.appendChild(valueEl);
  tile.appendChild(el("div", "stat-tile-label", label));
  animateCount(valueEl, toValue, suffix);
  return tile;
}
