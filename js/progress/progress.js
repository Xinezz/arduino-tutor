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
  };
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
