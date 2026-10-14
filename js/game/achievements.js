// Achievements: the trophy-room goals. Each one is a plain definition (id,
// name, how to earn it, an icon, a one-time credit reward) plus a check()
// that reads the numbers in `ctx`. evaluateAchievements() is pure - it just
// says which ones are newly earned - and progress.js's unlockAchievements()
// is what actually records them and pays the credits (guarded so a trophy can
// never pay twice).
//
// Rewards are credits only, never XP, for the same reason daily missions are:
// the level curve is tuned to the lesson content.

import { lessons } from "../lessons/data.js";
import { quizzes } from "../quiz/data.js";
import { projects } from "../projects/data.js";
import { computeCurrentRankIndex, RANKS } from "../progress/ranks.js";
import { getLevelInfo } from "../progress/progress.js";
import { levelTitle } from "../lessons/levels.js";

const bossChallengeIds = lessons
  .filter((l) => l.challenge?.difficulty === "boss")
  .map((l) => l.challenge.id);
const allChallengeIds = lessons.filter((l) => l.challenge).map((l) => l.challenge.id);
const totalStages = projects.reduce((n, p) => n + p.stages.length, 0);
const levelNumbers = [...new Set(lessons.map((l) => l.level))];

// Everything a check might want, computed once per evaluation.
export function buildContext(progress) {
  const done = new Set(progress.viewedLessons);
  const quizzesSolved = Object.values(progress.quizzes || {}).filter((q) => q.solved).length;
  const stagesDone = projects.reduce((n, p) => n + (progress.projects[p.id]?.stagesDone.length ?? 0), 0);
  const projectsFinished = projects.filter(
    (p) => (progress.projects[p.id]?.stagesDone.length ?? 0) >= p.stages.length && p.stages.length > 0
  ).length;
  const levelsCleared = new Set(
    levelNumbers.filter((n) => lessons.filter((l) => l.level === n).every((l) => done.has(l.id)))
  );
  return {
    progress,
    stats: progress.stats,
    lessonsDone: done.size,
    totalLessons: lessons.length,
    challengesDone: progress.completedChallenges.length,
    totalChallenges: allChallengeIds.length,
    bossesDone: bossChallengeIds.filter((id) => progress.completedChallenges.includes(id)).length,
    totalBosses: bossChallengeIds.length,
    quizzesSolved,
    totalQuizzes: Object.keys(quizzes).length,
    stagesDone,
    totalStages,
    projectsFinished,
    levelsCleared,
    level: getLevelInfo(progress.xp).level,
    streak: progress.streak || 0,
    rankIndex: computeCurrentRankIndex(progress),
    hour: new Date().getHours(),
  };
}

// A "reach N of something" achievement - these also drive the little progress
// bars in the trophy room.
const counter = (id, name, desc, icon, reward, get, target) => ({
  id, name, desc, icon, reward, target, get,
  check: (c) => get(c) >= target,
});

const flag = (id, name, desc, icon, reward, check, extra = {}) => ({
  id, name, desc, icon, reward, check, ...extra,
});

const levelClears = levelNumbers.map((n) =>
  flag(`clear-${n}`, `World ${n} Cleared`, `Finish every lesson in ${levelTitle(n)}`, "flag", 20, (c) => c.levelsCleared.has(n))
);

export const ACHIEVEMENTS = [
  // ---- lessons ----
  counter("lessons-1", "Clocked In", "Finish your first lesson", "book", 5, (c) => c.lessonsDone, 1),
  counter("lessons-5", "Getting the Hang", "Finish 5 lessons", "scroll", 10, (c) => c.lessonsDone, 5),
  counter("lessons-15", "On a Roll", "Finish 15 lessons", "list", 20, (c) => c.lessonsDone, 15),
  counter("lessons-30", "Seasoned Tech", "Finish 30 lessons", "chart", 40, (c) => c.lessonsDone, 30),
  counter("lessons-all", "Walking Manual", "Finish every lesson", "gem", 100, (c) => c.lessonsDone, lessons.length),
  ...levelClears,

  // ---- challenges ----
  counter("challenge-1", "It Works!", "Solve your first challenge", "bolt", 10, (c) => c.challengesDone, 1),
  counter("challenge-5", "Problem Solver", "Solve 5 challenges", "target", 20, (c) => c.challengesDone, 5),
  counter("challenge-12", "Troubleshooter", "Solve 12 challenges", "sword", 40, (c) => c.challengesDone, 12),
  counter("boss-1", "Boss Slayer", "Defeat a boss challenge", "skull", 30, (c) => c.bossesDone, 1),
  counter("boss-all", "Boss Rush Champion", "Defeat every boss challenge", "crown", 80, (c) => c.bossesDone, bossChallengeIds.length),
  counter("clean-1", "Own Two Hands", "Solve a challenge without any hints", "bulb", 10, (c) => c.stats.noHintSolves, 1),
  counter("clean-5", "Self-Reliant", "Solve 5 challenges without any hints", "shield", 40, (c) => c.stats.noHintSolves, 5),

  // ---- quizzes & projects ----
  counter("quiz-1", "Quiz Whiz", "Solve your first quiz game", "question", 5, (c) => c.quizzesSolved, 1),
  counter("quiz-10", "Brain Trust", "Solve 10 quiz games", "puzzle", 30, (c) => c.quizzesSolved, 10),
  counter("quiz-all", "Perfect Recall", "Solve every quiz game", "gem", 60, (c) => c.quizzesSolved, Object.keys(quizzes).length),
  counter("stage-1", "Builder", "Finish a project stage", "chip", 10, (c) => c.stagesDone, 1),
  counter("project-1", "Ship It", "Finish every stage of a project", "medal", 50, (c) => c.projectsFinished, 1),

  // ---- the simulator ----
  counter("run-1", "Power On", "Run your first program", "play", 5, (c) => c.stats.runs, 1),
  counter("run-25", "Tinkerer", "Run 25 programs", "led", 20, (c) => c.stats.runs, 25),
  counter("run-100", "Mad Scientist", "Run 100 programs", "monitor", 40, (c) => c.stats.runs, 100),

  // ---- levels, ranks & streaks ----
  counter("level-5", "Rising Star", "Reach level 5", "star", 10, (c) => c.level, 5),
  counter("level-10", "Veteran", "Reach level 10", "star", 25, (c) => c.level, 10),
  counter("level-20", "Legend", "Reach level 20", "crown", 60, (c) => c.level, 20),
  flag("rank-1", "Promoted!", `Reach the rank of ${RANKS[1].name}`, "medal", 30, (c) => c.rankIndex >= 1),
  flag("rank-2", "Sensor Savvy", `Reach the rank of ${RANKS[2].name}`, "trophy", 60, (c) => c.rankIndex >= 2),
  counter("streak-3", "Regular", "Visit 3 days in a row", "flame", 15, (c) => c.streak, 3),
  counter("streak-7", "Weekly Warrior", "Visit 7 days in a row", "flame", 40, (c) => c.streak, 7),
  counter("streak-30", "Fixture", "Visit 30 days in a row", "calendar", 150, (c) => c.streak, 30),

  // ---- credits & shopping ----
  counter("coins-100", "Saver", "Hold 100 credits at once", "coin", 10, (c) => c.stats.maxCredits, 100),
  counter("coins-500", "Tycoon", "Hold 500 credits at once", "gem", 50, (c) => c.stats.maxCredits, 500),
  counter("buy-1", "Treat Yourself", "Buy something from the shop", "bag", 10, (c) => c.stats.purchases, 1),
  counter("buy-5", "Regular Customer", "Buy 5 things from the shop", "bag", 30, (c) => c.stats.purchases, 5),
  flag("hint-1", "Asked for Help", "Use a hint. No shame in it!", "bulb", 3, (c) => c.stats.hintsUsed + c.stats.solutionsViewed >= 1),
  flag("red-ink", "In the Red", "Dip below zero credits", "cross", 5, (c) => c.stats.wentNegative),

  // ---- secrets ----
  flag("konami", "Old School", "Enter a very famous code", "sparkle", 30, (c) => c.stats.konami, { secret: true, hint: "Up, up, down, down..." }),
  flag("sam-poke", "Personal Space", "Poke Sam one too many times", "heart", 10, (c) => c.stats.samClicks >= 10, { secret: true, hint: "Sam has feelings, you know." }),
  flag("night-owl", "Night Shift", "Study in the small hours", "monitor", 10, (c) => c.hour < 5, { secret: true, hint: "Some techs work when everyone else sleeps." }),
];

// The one that needs every other (non-secret) trophy.
const REQUIRED_FOR_COMPLETIONIST = ACHIEVEMENTS.filter((a) => !a.secret).map((a) => a.id);
ACHIEVEMENTS.push(
  flag("completionist", "Completionist", "Earn every non-secret trophy", "trophy", 150, () => false, { needsOthers: true })
);

export const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Which achievements are newly earned right now (not yet recorded)?
export function evaluateAchievements(progress) {
  const ctx = buildContext(progress);
  const have = new Set(Object.keys(progress.achievements));
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || a.needsOthers) continue;
    let ok = false;
    try { ok = a.check(ctx); } catch { ok = false; }
    if (ok) earned.push(a);
  }
  const afterIds = new Set([...have, ...earned.map((a) => a.id)]);
  if (!have.has("completionist") && REQUIRED_FOR_COMPLETIONIST.every((id) => afterIds.has(id))) {
    earned.push(ACHIEVEMENT_MAP.completionist);
  }
  return earned;
}

// [current, target] for achievements that have a numeric goal, else null.
export function achievementProgress(def, ctx) {
  if (!def.get) return null;
  return [Math.min(def.get(ctx), def.target), def.target];
}
