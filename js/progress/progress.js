// Handles saving/loading the learner's progress in the browser's localStorage.
// localStorage is a tiny key-value store the browser keeps per-website, on disk,
// so it survives page reloads and closing the tab. It only stores strings, so we
// convert our progress object to JSON text to save it, and parse it back to read it.

const STORAGE_KEY = "arduinoTutorProgress";

// The career layer: you're a junior tech at CircuitWorks Robotics, paid in
// Credits for finished work. Credits CAN go negative (see spendCredits) -
// a hint always stays available even if you can't currently afford it, it
// just puts you in the red until your next bit of finished work pays it
// back down. The point is real stakes, not a wall that locks anyone out of
// help - see the "hint gating" decision this was built around.
const STARTING_CREDITS = 25;
export const CREDIT_REWARDS = {
  lesson: 10,
  challenge: 20,
  quiz: 5,
  projectStage: 15,
};
export const HINT_COSTS = [5, 10, 15]; // cost of hint 1, hint 2, hint 3
export const SOLUTION_COST = 25;

// XP tracks the exact same actions as credits, and earns the exact same
// amounts (see applyXp below) - but where credits are a spendable balance
// that can dip negative, XP only ever goes up, so spending on a hint can put
// you in the red without ever un-leveling you. Milestone levels pay out a
// one-time credit bonus, guarded via milestonesAwarded the same way every
// other payout in this file is guarded against firing twice.
export const LEVEL_MILESTONES = { 5: 50, 10: 100, 20: 200 };
const LEVEL_XP_SCALE = 2.5; // tuned so Level 20 lands near the XP total of finishing everything currently on the site

function defaultProgress() {
  return {
    viewedLessons: [],       // lesson ids the learner has opened
    completedChallenges: [], // challenge ids the learner has solved
    lastLessonId: null,      // so we can reopen where they left off
    quizzes: {},             // quizId -> { attempts, solved, lastResult: "success"|"failure", topic }
    projects: {},            // projectId -> { stagesDone: [stageId, ...] }
    streak: 0,               // consecutive calendar days visited
    lastVisitDate: null,     // "YYYY-MM-DD", used to update the streak
    credits: STARTING_CREDITS,
    xp: 0,
    milestonesAwarded: [],   // levels (from LEVEL_MILESTONES) whose bonus has already been paid out
    flaggedLessons: [],      // lesson ids the learner marked "I struggled with this" - a personal bookmark, not an achievement
  };
}

// Cumulative XP needed to REACH a level follows LEVEL_XP_SCALE * (level-1)^2 -
// a curve, not a flat per-level amount, so early levels come fast and later
// ones take real accumulated effort. Inverting that formula (rather than
// looping/searching) gives the level for any XP total directly.
export function getLevelInfo(xp) {
  const level = 1 + Math.floor(Math.sqrt(xp / LEVEL_XP_SCALE));
  const currentLevelXp = Math.round(LEVEL_XP_SCALE * (level - 1) ** 2);
  const nextLevelXp = Math.round(LEVEL_XP_SCALE * level ** 2);
  const xpIntoLevel = xp - currentLevelXp;
  const xpForLevel = nextLevelXp - currentLevelXp;
  return { level, xpIntoLevel, xpForLevel, pct: Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100)) };
}

// Shared by every earn function below instead of each doing its own
// `progress.credits += ...` - keeps the XP/credit amounts perfectly in sync
// and means the milestone-bonus check only has to live in one place.
function applyXp(progress, amount) {
  progress.credits += amount;
  progress.xp += amount;
  const level = getLevelInfo(progress.xp).level;
  const bonus = LEVEL_MILESTONES[level];
  if (bonus && !progress.milestonesAwarded.includes(level)) {
    progress.milestonesAwarded.push(level);
    progress.credits += bonus;
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// Call once per app load. A streak counts CONSECUTIVE calendar days: visiting
// again today doesn't change it, visiting the day right after your last
// visit extends it by one, and any bigger gap resets it back to 1.
export function touchStreak(progress) {
  const today = todayString();
  if (progress.lastVisitDate === today) return progress;

  if (progress.lastVisitDate) {
    const last = new Date(progress.lastVisitDate);
    const diffDays = Math.round((new Date(today) - last) / 86400000);
    progress.streak = diffDays === 1 ? progress.streak + 1 : 1;
  } else {
    progress.streak = 1;
  }
  progress.lastVisitDate = today;
  saveProgress(progress);
  return progress;
}

export function loadProgress() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultProgress();
  try {
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    // If the saved data is somehow corrupted, don't crash the app -
    // just start fresh instead.
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Spending is unguarded on purpose - it's allowed to go negative. A hint
// must never become literally unreachable just because of a low balance.
export function spendCredits(progress, amount) {
  progress.credits -= amount;
  saveProgress(progress);
  return progress;
}

export function markLessonViewed(progress, lessonId) {
  // Guarded so calling this again for an already-completed lesson (the
  // button becomes non-interactive once done, but this stays defensive
  // rather than trusting the UI alone) can't pay out credits twice.
  const isFirstTime = !progress.viewedLessons.includes(lessonId);
  if (isFirstTime) {
    progress.viewedLessons.push(lessonId);
    applyXp(progress, CREDIT_REWARDS.lesson);
  }
  progress.lastLessonId = lessonId;
  saveProgress(progress);
  return progress;
}

// A real toggle, unlike everything else in this file - flagging is a
// personal "remind me" bookmark, not a recorded achievement, so unlike
// completing a lesson there's no reason it shouldn't be reversible once
// you've gone back and it's finally clicked.
export function toggleLessonFlag(progress, lessonId) {
  const index = progress.flaggedLessons.indexOf(lessonId);
  if (index === -1) progress.flaggedLessons.push(lessonId);
  else progress.flaggedLessons.splice(index, 1);
  saveProgress(progress);
  return progress;
}

export function markChallengeCompleted(progress, challengeId) {
  const isFirstTime = !progress.completedChallenges.includes(challengeId);
  if (isFirstTime) {
    progress.completedChallenges.push(challengeId);
    applyXp(progress, CREDIT_REWARDS.challenge);
  }
  saveProgress(progress);
  return progress;
}

// Records the outcome of one quiz attempt. We keep attempts/lastResult (not
// just a pass/fail flag) so the dashboard can surface topics the learner
// keeps getting wrong, not just topics they haven't tried yet. Credits only
// pay out the first time a quiz flips from unsolved to solved - retrying an
// already-solved quiz (or failing again) never pays out again.
export function recordQuizResult(progress, quizId, success, topic) {
  const existing = progress.quizzes[quizId] || { attempts: 0, solved: false, topic };
  const wasAlreadySolved = existing.solved;
  existing.attempts += 1;
  existing.lastResult = success ? "success" : "failure";
  existing.topic = topic;
  if (success) existing.solved = true;
  progress.quizzes[quizId] = existing;
  if (success && !wasAlreadySolved) applyXp(progress, CREDIT_REWARDS.quiz);
  saveProgress(progress);
  return progress;
}

export function markProjectStageDone(progress, projectId, stageId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  const isFirstTime = !entry.stagesDone.includes(stageId);
  if (isFirstTime) {
    entry.stagesDone.push(stageId);
    applyXp(progress, CREDIT_REWARDS.projectStage);
  }
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

export function getProjectProgress(progress, projectId) {
  return progress.projects[projectId] || { stagesDone: [] };
}
