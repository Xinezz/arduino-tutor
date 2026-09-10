// Handles saving/loading the learner's progress in the browser's localStorage.
// localStorage is a tiny key-value store the browser keeps per-website, on disk,
// so it survives page reloads and closing the tab. It only stores strings, so we
// convert our progress object to JSON text to save it, and parse it back to read it.

const STORAGE_KEY = "arduinoTutorProgress";

function defaultProgress() {
  return {
    viewedLessons: [],       // lesson ids the learner has opened
    completedChallenges: [], // challenge ids the learner has solved
    lastLessonId: null,      // so we can reopen where they left off
    quizzes: {},             // quizId -> { attempts, solved, lastResult: "success"|"failure", topic }
    projects: {},            // projectId -> { stagesDone: [stageId, ...] }
    streak: 0,               // consecutive calendar days visited
    lastVisitDate: null,     // "YYYY-MM-DD", used to update the streak
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

export function markLessonViewed(progress, lessonId) {
  if (!progress.viewedLessons.includes(lessonId)) {
    progress.viewedLessons.push(lessonId);
  }
  progress.lastLessonId = lessonId;
  saveProgress(progress);
  return progress;
}

export function markChallengeCompleted(progress, challengeId) {
  if (!progress.completedChallenges.includes(challengeId)) {
    progress.completedChallenges.push(challengeId);
  }
  saveProgress(progress);
  return progress;
}

// Records the outcome of one quiz attempt. We keep attempts/lastResult (not
// just a pass/fail flag) so the dashboard can surface topics the learner
// keeps getting wrong, not just topics they haven't tried yet.
export function recordQuizResult(progress, quizId, success, topic) {
  const existing = progress.quizzes[quizId] || { attempts: 0, solved: false, topic };
  existing.attempts += 1;
  existing.lastResult = success ? "success" : "failure";
  existing.topic = topic;
  if (success) existing.solved = true;
  progress.quizzes[quizId] = existing;
  saveProgress(progress);
  return progress;
}

export function markProjectStageDone(progress, projectId, stageId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  if (!entry.stagesDone.includes(stageId)) entry.stagesDone.push(stageId);
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

export function getProjectProgress(progress, projectId) {
  return progress.projects[projectId] || { stagesDone: [] };
}
