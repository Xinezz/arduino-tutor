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
  };
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
    progress.credits += CREDIT_REWARDS.lesson;
  }
  progress.lastLessonId = lessonId;
  saveProgress(progress);
  return progress;
}

export function markChallengeCompleted(progress, challengeId) {
  const isFirstTime = !progress.completedChallenges.includes(challengeId);
  if (isFirstTime) {
    progress.completedChallenges.push(challengeId);
    progress.credits += CREDIT_REWARDS.challenge;
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
  if (success && !wasAlreadySolved) progress.credits += CREDIT_REWARDS.quiz;
  saveProgress(progress);
  return progress;
}

export function markProjectStageDone(progress, projectId, stageId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  const isFirstTime = !entry.stagesDone.includes(stageId);
  if (isFirstTime) {
    entry.stagesDone.push(stageId);
    progress.credits += CREDIT_REWARDS.projectStage;
  }
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

export function getProjectProgress(progress, projectId) {
  return progress.projects[projectId] || { stagesDone: [] };
}
