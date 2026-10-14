// Renders the Profile (formerly "Dashboard") view: your player card, today's
// missions, the progression ladder, headline stats, the trophy room, and a
// "topics to review" list built from quiz attempts the learner hasn't gotten
// right yet. It only summarizes state that progress.js already tracks, the
// same way a real dashboard sits on top of a database rather than owning its
// own data - anything that CHANGES state (claiming a mission reward) is
// reported out through a callback for app.js to handle.

import { lessons } from "../lessons/data.js";
import { projects } from "../projects/data.js";
import { quizzes } from "../quiz/data.js";
import { getProjectProgress, getLevelInfo, LEVEL_MILESTONES } from "../progress/progress.js";
import { renderMentorBox, getDashboardGreeting } from "../npc/mentor.js";
import { animateCount } from "../utils/animateCount.js";
import { RANKS, computeCurrentRankIndex } from "../progress/ranks.js";
import { icon } from "../game/sprites.js";
import { buildPlayerCard, buildMissionsPanel, buildTrophyRoom } from "../game/profileCards.js";

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

// refresh: this is a re-render of a screen that's already showing (after
// claiming a reward) - skip the count-ups and Sam's typing so nothing replays.
export function renderDashboard(container, progress, { onReviewTopic, onClaimMission, onClaimChest, onChangeAvatar, onPoke, refresh = false } = {}) {
  container.innerHTML = "";
  const animate = !refresh;

  const mentorBox = el("div", "mentor-box hud-frame");
  container.appendChild(mentorBox);
  renderMentorBox(mentorBox, { text: getDashboardGreeting(progress), tag: "Check-in", onPoke, instant: refresh });

  // ---- player card ----
  // XP is deliberately separate from the credits shown beside it: credits are
  // a spendable balance (see spendCredits in progress.js), XP only goes up, so
  // the bar always reflects total progress even after a hint spends credits
  // down into the red.
  container.appendChild(buildPlayerCard(progress, { onChangeAvatar, animate }));
  const { level } = getLevelInfo(progress.xp);
  const nextMilestone = Object.keys(LEVEL_MILESTONES).map(Number).find((lvl) => lvl > level);
  if (nextMilestone) {
    const note = el("div", "xp-bar-note", `Next bonus at Level ${nextMilestone}: +${LEVEL_MILESTONES[nextMilestone]} credits`);
    note.prepend(Object.assign(el("span", "note-ico"), { innerHTML: icon("chest", 1) }));
    container.appendChild(note);
  }

  // ---- today's missions ----
  container.appendChild(buildMissionsPanel(progress, { onClaim: onClaimMission, onClaimChest }));

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

  container.appendChild(el("div", "dashboard-section-title", "Career Stats"));
  const statGrid = el("div", "stat-grid");
  statGrid.appendChild(statTile(doneLessons, ` / ${totalLessons}`, "Lessons Complete", "book", animate));
  statGrid.appendChild(statTile(doneChallenges, ` / ${totalChallenges}`, "Challenges Solved", "bolt", animate));
  statGrid.appendChild(statTile(solvedQuizzes, ` / ${totalQuizzes}`, "Quizzes Solved", "puzzle", animate));
  statGrid.appendChild(statTile(projectStagesDone, ` / ${projectStagesTotal}`, "Project Stages Built", "chip", animate));
  statGrid.appendChild(statTile(progress.stats?.bossesDefeated ?? 0, "", "Bosses Defeated", "skull", animate));
  statGrid.appendChild(statTile(progress.stats?.runs ?? 0, "", "Programs Run", "play", animate));
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

    const badge = el("div", "rank-step-badge");
    if (i < currentRankIndex) badge.innerHTML = icon("check", 2);
    else if (i === currentRankIndex) badge.textContent = String(i + 1);
    else badge.innerHTML = icon("lock", 2);
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

  // ---- trophy room ----
  container.appendChild(buildTrophyRoom(progress, { animate }));

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
        reviewBtn.textContent = "Review";
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
        reviewBtn.textContent = "Review";
        reviewBtn.addEventListener("click", () => onReviewTopic(lessonId));
        right.appendChild(reviewBtn);
      }
      row.appendChild(right);

      list.appendChild(row);
    }
    container.appendChild(list);
  }
}

function statTile(toValue, suffix, label, spriteName, animate = true) {
  const tile = el("div", "stat-tile");
  if (spriteName) {
    const ico = el("div", "stat-tile-icon");
    ico.innerHTML = icon(spriteName, 3);
    tile.appendChild(ico);
  }
  const valueEl = el("div", "stat-tile-value", "0" + suffix);
  tile.appendChild(valueEl);
  tile.appendChild(el("div", "stat-tile-label", label));
  if (animate) animateCount(valueEl, toValue, suffix);
  else valueEl.textContent = toValue + suffix;
  return tile;
}
