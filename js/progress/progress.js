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
    playerName: null,        // set on the main menu - null means "never signed in," not just "empty string"
    firstCircuitDone: false, // finished the guided "Start your first circuit" walkthrough
    onboarded: false,        // has seen the welcome tour (js/learn/welcomeTour.js)
    checks: {},              // challengeId -> { attempts, passed, independent } from "Check My Solution"
    predictions: {},         // "<lessonId>#p<n>" -> { right } - whether the FIRST prediction was right

    // ---- the learner profile (see js/progress/skills.js) ----
    answers: {},             // question key (see questionBank.js) -> { n, first, last, at, box, due, hist } - see recordAnswer
    mistakes: {},            // mistake id -> { label, lessonId, times: [ISO, ...] } - errors, warnings and circuit faults met
    activity: [],            // [{ at, kind, label, lessonId? }] newest last - the learning history (capped)
    goals: [],               // [{ id, setAt, baseline?, doneAt? }] - learning goals you chose (see goals.js)
    revisionLog: [],         // [{ at, area, right, total }] - finished revision sessions
    pathways: {},            // pathwayId -> { startedAt, lessonsDone: [lessonId], certificateAt? } - see pathways/progress.js

    // ---- the game layer ----
    achievements: {},        // achievement id -> ISO timestamp it was unlocked (presence = unlocked, so it can never pay out twice)
    stats: defaultStats(),   // lifetime counters the achievements read from
    hintUses: {},            // challengeId -> how many hints/solutions were revealed (0/absent = solved "clean")
    daily: emptyDaily(null), // today's mission counters + what's been claimed; rolls over when the date changes
    inventory: [...STARTER_ITEMS], // owned cosmetic ids, e.g. "theme:gameboy", "avatar:wizard"
    equipped: { theme: "default", avatar: "rookie" },
  };
}

// Cosmetics everyone starts with (see js/game/shop.js for the rest).
const STARTER_ITEMS = ["theme:default", "avatar:rookie", "avatar:bot", "avatar:cat"];

function defaultStats() {
  return {
    runs: 0,            // programs run in the simulator (lessons + Free Practice)
    hintsUsed: 0,
    solutionsViewed: 0,
    purchases: 0,
    bossesDefeated: 0,
    noHintSolves: 0,    // challenges solved without revealing a single hint or solution
    samClicks: 0,       // easter egg
    mapVisits: 0,       // first-visit trophies for the World Map...
    shopVisits: 0,      // ...and the Parts Shop
    konami: false,      // easter egg
    maxCredits: STARTING_CREDITS,
    wentNegative: false,
  };
}

const COUNTER_KEYS = ["lessons", "challenges", "quizzes", "stages", "runs", "xp", "flagged"];

function emptyDaily(date) {
  return {
    date,
    counters: Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])),
    claimed: [],         // mission ids whose reward was collected today
    chestClaimed: false, // the bonus chest for clearing all of today's missions
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
  bumpDaily(progress, "xp", amount);
  const level = getLevelInfo(progress.xp).level;
  const bonus = LEVEL_MILESTONES[level];
  if (bonus && !progress.milestonesAwarded.includes(level)) {
    progress.milestonesAwarded.push(level);
    progress.credits += bonus;
  }
  touchCreditStats(progress);
}

// The player's LOCAL calendar date. (This used to be the UTC date, which
// would have rolled the daily missions - and could have broken a streak - in
// the middle of someone's evening if they're far from UTC.)
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Lifetime high-water mark and "has ever been in the red" - read by
// achievements. Called from every place that moves the balance.
function touchCreditStats(progress) {
  const s = progress.stats;
  if (progress.credits > s.maxCredits) s.maxCredits = progress.credits;
  if (progress.credits < 0) s.wentNegative = true;
}

// Today's missions live in progress.daily. It rolls over to a fresh, zeroed
// day the first time anything touches it after the date changes - checked
// lazily here instead of on a timer, so it also works if the tab was left
// open past midnight.
export function ensureDaily(progress) {
  const today = todayString();
  if (!progress.daily || progress.daily.date !== today) {
    progress.daily = emptyDaily(today);
  }
  return progress.daily;
}

export function bumpDaily(progress, key, amount = 1) {
  const daily = ensureDaily(progress);
  daily.counters[key] = (daily.counters[key] ?? 0) + amount;
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

// A shallow spread isn't enough anymore: a save from before the game layer
// existed has no `stats`/`daily`/`equipped` at all, and one from partway
// through its life might have a `stats` object that's missing a counter
// added later. Merging each nested object over its own defaults means old
// saves keep working and quietly pick up new fields.
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const ACTIVITY_CAP = 80;

function normalize(saved) {
  if (!isObject(saved)) saved = {};
  const base = defaultProgress();
  const merged = { ...base, ...saved };
  // A hand-edited or half-written save can hold the wrong shape anywhere -
  // every collection falls back to empty rather than crashing the page.
  for (const key of ["viewedLessons", "completedChallenges", "flaggedLessons", "milestonesAwarded"]) {
    merged[key] = Array.isArray(saved[key]) ? saved[key].filter((x) => typeof x === "string" || typeof x === "number") : [];
  }
  for (const key of ["quizzes", "projects"]) merged[key] = isObject(saved[key]) ? saved[key] : {};
  for (const [id, entry] of Object.entries(merged.projects)) {
    if (!isObject(entry) || !Array.isArray(entry.stagesDone)) delete merged.projects[id];
  }
  for (const key of ["credits", "xp", "streak"]) if (!Number.isFinite(merged[key])) merged[key] = base[key];
  // the learner profile: anything malformed is dropped, the rest kept
  merged.answers = Object.fromEntries(Object.entries(isObject(saved.answers) ? saved.answers : {})
    .filter(([, a]) => isObject(a) && Number.isFinite(a.n) && typeof a.last === "boolean"));
  merged.mistakes = Object.fromEntries(Object.entries(isObject(saved.mistakes) ? saved.mistakes : {})
    .filter(([, m]) => isObject(m) && Array.isArray(m.times))
    .map(([id, m]) => [id, { ...m, times: m.times.filter((t) => typeof t === "string") }]));
  merged.activity = (Array.isArray(saved.activity) ? saved.activity : [])
    .filter((a) => isObject(a) && typeof a.at === "string" && typeof a.label === "string").slice(-ACTIVITY_CAP);
  merged.goals = (Array.isArray(saved.goals) ? saved.goals : []).filter((g) => isObject(g) && typeof g.id === "string");
  merged.revisionLog = (Array.isArray(saved.revisionLog) ? saved.revisionLog : []).filter((r) => isObject(r) && Number.isFinite(r.total));
  merged.pathways = Object.fromEntries(Object.entries(isObject(saved.pathways) ? saved.pathways : {})
    .filter(([, e]) => isObject(e))
    .map(([id, e]) => [id, { ...e, lessonsDone: Array.isArray(e.lessonsDone) ? e.lessonsDone.filter((x) => typeof x === "string") : [] }]));
  merged.stats = { ...base.stats, ...(saved.stats || {}) };
  merged.equipped = { ...base.equipped, ...(saved.equipped || {}) };
  merged.daily = { ...base.daily, ...(saved.daily || {}) };
  merged.daily.counters = { ...base.daily.counters, ...(saved.daily?.counters || {}) };
  merged.achievements = saved.achievements && typeof saved.achievements === "object" ? saved.achievements : {};
  merged.hintUses = saved.hintUses && typeof saved.hintUses === "object" ? saved.hintUses : {};
  merged.checks = saved.checks && typeof saved.checks === "object" ? saved.checks : {};
  merged.predictions = saved.predictions && typeof saved.predictions === "object" ? saved.predictions : {};
  // A save from before the welcome tour existed belongs to someone who has
  // already found their way around - don't send them on it.
  if (saved.onboarded === undefined) merged.onboarded = (saved.viewedLessons?.length ?? 0) > 0 || !!saved.firstCircuitDone;
  // Starter cosmetics are always owned, even if an old/imported save lacks them.
  merged.inventory = [...new Set([...STARTER_ITEMS, ...(Array.isArray(saved.inventory) ? saved.inventory : [])])];
  return merged;
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return normalize(JSON.parse(raw));
  } catch {
    // If the saved data is corrupted - or the browser won't let us read
    // storage at all (some private windows) - don't crash the app, just
    // start fresh instead.
    return defaultProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or blocked: the session still works, it just won't be
    // remembered next time.
  }
}

// Spending is unguarded on purpose - it's allowed to go negative. A hint
// must never become literally unreachable just because of a low balance.
export function spendCredits(progress, amount) {
  progress.credits -= amount;
  touchCreditStats(progress);
  saveProgress(progress);
  return progress;
}

// ---- save file portability ----
// There's no server, so the "save slot" is a block of text the player can
// copy somewhere safe (or paste on another device). It's just the progress
// JSON, base64-wrapped so it survives being pasted into chat apps/notes.
function toBase64(str) {
  let bin = "";
  new TextEncoder().encode(str).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function exportSaveCode(progress) {
  return toBase64(JSON.stringify(progress));
}

// Returns a normalized progress object, or null if the text isn't a save.
export function parseSaveCode(text) {
  try {
    const json = fromBase64(String(text).replace(/\s+/g, ""));
    const data = JSON.parse(json);
    if (!data || typeof data !== "object" || !Array.isArray(data.viewedLessons)) return null;
    return normalize(data);
  } catch {
    return null;
  }
}

export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  return defaultProgress();
}

// Set from the main menu. There's no real authentication behind this - it's
// a local-only nickname (this whole app has no backend/server, see the
// header comment), used purely to personalize greetings. Trimmed so a
// name typed with trailing spaces doesn't render oddly in "Welcome back, X".
export function setPlayerName(progress, name) {
  progress.playerName = name.trim();
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
    bumpDaily(progress, "lessons");
    applyXp(progress, CREDIT_REWARDS.lesson);
    logActivity(progress, "lesson", "Lesson done", lessonId);
  }
  progress.lastLessonId = lessonId;
  saveProgress(progress);
  return progress;
}

// The guided first circuit (js/guide/firstCircuit.js) pays out like a
// challenge, once - replaying it later is welcome but earns nothing new.
export function markOnboarded(progress) {
  progress.onboarded = true;
  saveProgress(progress);
  return progress;
}

export function markFirstCircuitDone(progress) {
  if (!progress.firstCircuitDone) {
    progress.firstCircuitDone = true;
    applyXp(progress, CREDIT_REWARDS.challenge);
  }
  saveProgress(progress);
  return progress;
}

// A "Check My Solution" attempt. What matters for learning isn't just that a
// challenge was solved but how: `independent` records that it passed before
// any hint or the solution was revealed. (Rewards are paid separately, by
// markChallengeCompleted.)
// Only a prediction's first answer counts: it measures how the learner
// reasoned before seeing anything, and trying again later can't lower it.
export function recordPrediction(progress, key, right) {
  if (progress.predictions[key]) return progress;
  progress.predictions[key] = { right };
  saveProgress(progress);
  return progress;
}

// ---- the learner profile ----

// "YYYY-MM-DD" in local time, and that date moved on by n days.
export function dayString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return dayString(new Date(y, m - 1, d + n));
}

// Spaced revision, Leitner-style, per question. box 0: right first time -
// never needs revising. A wrong answer puts it in box 1, due the next day.
// Answering it right ON or AFTER its due day moves it up a box (due again 3
// days later, then 7); from box 4 it counts as secure. Getting it right again
// the same day it was missed doesn't move it on - recalling something a
// minute after seeing the answer isn't the same as remembering it.
export const REVIEW_GAPS = { 1: 1, 2: 3, 3: 7 };
export const SECURE_BOX = 4;

export function recordAnswer(progress, key, right, now = new Date()) {
  progress.answers ??= {};
  const today = dayString(now);
  const a = progress.answers[key] || { n: 0, first: right, box: 0, due: null, hist: [] };
  a.n += 1;
  if (a.n === 1) a.first = right;
  if (!right) {
    a.box = 1;
    a.due = addDays(today, REVIEW_GAPS[1]);
  } else if (a.box > 0 && a.box < SECURE_BOX && a.due && today >= a.due) {
    a.box += 1;
    a.due = a.box >= SECURE_BOX ? null : addDays(today, REVIEW_GAPS[a.box]);
  }
  a.last = right;
  a.at = now.toISOString();
  a.hist = [...(a.hist || []), right ? 1 : 0].slice(-8);
  progress.answers[key] = a;
  saveProgress(progress);
  return progress;
}

// A mistake met while working: a run error, a warning or a circuit fault,
// identified by kind (see insights.js mistakeFrom*). The same mistake met
// again within a minute is the same moment - pressing Run twice on unchanged
// code isn't a second mistake.
export function recordMistake(progress, id, label, lessonId, now = new Date()) {
  progress.mistakes ??= {};
  const m = progress.mistakes[id] || { label, lessonId, times: [] };
  const last = m.times[m.times.length - 1];
  if (last && Math.abs(now - new Date(last)) < 60000) return progress;
  m.label = label;
  m.lessonId = lessonId;
  m.times = [...m.times, now.toISOString()].slice(-10);
  progress.mistakes[id] = m;
  saveProgress(progress);
  return progress;
}

// The learning history: one line per meaningful event, newest last.
function logActivity(progress, kind, label, lessonId = null) {
  progress.activity ??= [];
  progress.activity.push({ at: new Date().toISOString(), kind, label, ...(lessonId ? { lessonId } : {}) });
  if (progress.activity.length > ACTIVITY_CAP) progress.activity.splice(0, progress.activity.length - ACTIVITY_CAP);
}

export function recordRevisionSession(progress, area, right, total) {
  progress.revisionLog = [...progress.revisionLog, { at: new Date().toISOString(), area, right, total }].slice(-40);
  logActivity(progress, "revision", `Revision session: ${right} of ${total} right`);
  saveProgress(progress);
  return progress;
}

// Engineering pathways (pathways/). Starting one is just a note of when;
// a pathway lesson marked done pays like a core lesson, once; the
// certificate is recorded once, by date - app.js only awards it when
// pathways/progress.js says every level's evidence is there.
export function startPathway(progress, pathwayId, title = pathwayId) {
  progress.pathways ??= {};
  if (progress.pathways[pathwayId]) return progress;
  progress.pathways[pathwayId] = { startedAt: new Date().toISOString(), lessonsDone: [] };
  logActivity(progress, "pathway", `Pathway started: ${title}`);
  saveProgress(progress);
  return progress;
}

export function markPathwayLessonDone(progress, pathwayId, lessonId, title = lessonId) {
  startPathway(progress, pathwayId);
  const entry = progress.pathways[pathwayId];
  if (!entry.lessonsDone.includes(lessonId)) {
    entry.lessonsDone.push(lessonId);
    bumpDaily(progress, "lessons");
    applyXp(progress, CREDIT_REWARDS.lesson);
    logActivity(progress, "lesson", `Pathway lesson done: ${title}`);
  }
  saveProgress(progress);
  return progress;
}

export function awardPathwayCertificate(progress, pathwayId, title = pathwayId) {
  const entry = progress.pathways?.[pathwayId];
  if (!entry || entry.certificateAt) return progress;
  entry.certificateAt = new Date().toISOString();
  logActivity(progress, "goal", `Pathway certificate: ${title}`);
  saveProgress(progress);
  return progress;
}

// Goals (the choices live in goals.js): at most a few at once, each set
// once; reaching one is recorded with its date and never undone.
export function setGoal(progress, id, baseline = null) {
  if (progress.goals.some((g) => g.id === id && !g.doneAt)) return progress;
  progress.goals = progress.goals.filter((g) => g.id !== id);
  progress.goals.push({ id, setAt: new Date().toISOString(), ...(baseline !== null ? { baseline } : {}) });
  saveProgress(progress);
  return progress;
}

export function removeGoal(progress, id) {
  progress.goals = progress.goals.filter((g) => !(g.id === id && !g.doneAt));
  saveProgress(progress);
  return progress;
}

export function markGoalsDone(progress, ids, labels = {}) {
  for (const g of progress.goals) {
    if (!g.doneAt && ids.includes(g.id)) {
      g.doneAt = new Date().toISOString();
      logActivity(progress, "goal", `Goal reached: ${labels[g.id] ?? g.id}`);
    }
  }
  saveProgress(progress);
  return progress;
}

export function recordCheck(progress, challengeId, passed, label = null, lessonId = null) {
  const entry = progress.checks[challengeId] || { attempts: 0, passed: false, independent: false };
  entry.attempts += 1;
  if (passed && !entry.passed) {
    entry.passed = true;
    entry.independent = !(progress.hintUses[challengeId] > 0);
    if (label) logActivity(progress, "challenge", `Challenge passed${entry.independent ? " (no hints)" : ""}: ${label}`, lessonId);
  }
  progress.checks[challengeId] = entry;
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
    bumpDaily(progress, "challenges");
    // "Clean" solve: not one hint or solution was revealed on the way.
    if (!progress.hintUses[challengeId]) progress.stats.noHintSolves++;
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
// `detail.answers` ([[questionKey, right], ...]) is each question's own
// result - a set of questions reports every one, so the profile knows WHICH
// question was missed. A single-question quiz (order, debug, ...) is one
// question: "<quizId>#0".
export function recordQuizResult(progress, quizId, success, topic, detail = {}) {
  const existing = progress.quizzes[quizId] || { attempts: 0, solved: false, topic };
  const wasAlreadySolved = existing.solved;
  const wasFailing = existing.lastResult === "failure";
  existing.attempts += 1;
  existing.lastResult = success ? "success" : "failure";
  existing.topic = topic;
  if (success) existing.solved = true;
  progress.quizzes[quizId] = existing;
  for (const [key, right] of detail.answers ?? [[`${quizId}#0`, success]]) recordAnswer(progress, key, right);
  // one line per outcome, not per press: retrying a wrong order again and again is one "needs another look"
  if (success || !wasFailing) logActivity(progress, "quiz", `${success ? "Checkpoint answered" : "Checkpoint needs another look"}: ${topic}`);
  if (success && !wasAlreadySolved) {
    bumpDaily(progress, "quizzes");
    applyXp(progress, CREDIT_REWARDS.quiz);
  }
  saveProgress(progress);
  return progress;
}

export function markProjectStageDone(progress, projectId, stageId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  const isFirstTime = !entry.stagesDone.includes(stageId);
  if (isFirstTime) {
    entry.stagesDone.push(stageId);
    bumpDaily(progress, "stages");
    applyXp(progress, CREDIT_REWARDS.projectStage);
  }
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

export function getProjectProgress(progress, projectId) {
  return progress.projects[projectId] || { stagesDone: [] };
}

// Project-library extras on the same entry: which modes you've completed it
// in (and with how many hints - recorded, never penalised), and your own
// project log (plan, problems met, improvements made). Old entries without
// them keep working.
export function recordProjectHint(progress, projectId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  entry.hints = (entry.hints || 0) + 1;
  progress.projects[projectId] = entry;
  progress.stats.hintsUsed++;
  saveProgress(progress);
  return progress;
}

export function recordProjectComplete(progress, projectId, mode, hints = 0, title = projectId) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  entry.completed = entry.completed || {};
  const first = !entry.completed[mode];
  if (first) entry.completed[mode] = { hints };
  if (first) applyXp(progress, CREDIT_REWARDS.projectStage * 2);
  if (first) logActivity(progress, "project", `Project built in ${mode} mode: ${title}`);
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

// A "Check" press while building a library project - failed checks are how
// the profile tells a project that went smoothly from one that was a struggle.
export function recordProjectCheck(progress, projectId, passed) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  const c = entry.checks || { attempts: 0, fails: 0 };
  c.attempts += 1;
  if (!passed) c.fails += 1;
  entry.checks = c;
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

export function saveProjectLog(progress, projectId, field, text) {
  const entry = progress.projects[projectId] || { stagesDone: [] };
  entry.log = { ...(entry.log || {}), [field]: text };
  progress.projects[projectId] = entry;
  saveProgress(progress);
  return progress;
}

// =========================================================================
// Game layer mutators. Same rules as everything above: all state changes
// live here, each one guarded so replaying it (a double-click, a re-render,
// an imported save) can never pay out or charge twice.
// =========================================================================

// Called whenever a hint or the full solution is revealed on a challenge.
export function recordHintUse(progress, challengeId, isSolution) {
  progress.hintUses[challengeId] = (progress.hintUses[challengeId] || 0) + 1;
  if (isSolution) progress.stats.solutionsViewed++;
  else progress.stats.hintsUsed++;
  saveProgress(progress);
  return progress;
}

// A program was run in the simulator (lesson editor or Free Practice).
export function recordRun(progress) {
  progress.stats.runs++;
  bumpDaily(progress, "runs");
  saveProgress(progress);
  return progress;
}

export function bumpDailyCounter(progress, key, amount = 1) {
  bumpDaily(progress, key, amount);
  saveProgress(progress);
  return progress;
}

export function incrementStat(progress, key, amount = 1) {
  progress.stats[key] = (progress.stats[key] || 0) + amount;
  saveProgress(progress);
  return progress;
}

export function setStat(progress, key, value) {
  progress.stats[key] = value;
  saveProgress(progress);
  return progress;
}

// defs: [{ id, reward }] - the achievements that just became earned. Only
// ids not already in progress.achievements are applied, so a re-check (or a
// race between two triggers) can't double-pay. Returns the ids that were new.
export function unlockAchievements(progress, defs) {
  const fresh = [];
  for (const def of defs) {
    if (progress.achievements[def.id]) continue;
    progress.achievements[def.id] = new Date().toISOString();
    progress.credits += def.reward || 0;
    fresh.push(def.id);
  }
  if (fresh.length) {
    touchCreditStats(progress);
    saveProgress(progress);
  }
  return fresh;
}

// Buying never goes into debt (unlike hints, a cosmetic isn't something you
// need to be unstuck) - and an item can only be bought once.
export function purchaseItem(progress, itemId, price) {
  if (progress.inventory.includes(itemId)) return false;
  if (progress.credits < price) return false;
  progress.credits -= price;
  progress.inventory.push(itemId);
  progress.stats.purchases++;
  touchCreditStats(progress);
  saveProgress(progress);
  return true;
}

// slot is "theme" or "avatar"; itemId is the bare id ("gameboy"), checked
// against the "slot:id" form stored in inventory.
export function equipItem(progress, slot, itemId) {
  if (!progress.inventory.includes(`${slot}:${itemId}`)) return false;
  progress.equipped[slot] = itemId;
  saveProgress(progress);
  return true;
}

// Collect a finished daily mission's reward. Credits only (no XP), so the
// level curve stays tuned to the actual lesson content.
export function claimMission(progress, missionId, reward) {
  const daily = ensureDaily(progress);
  if (daily.claimed.includes(missionId)) return false;
  daily.claimed.push(missionId);
  progress.credits += reward;
  touchCreditStats(progress);
  saveProgress(progress);
  return true;
}

export function claimDailyChest(progress, reward) {
  const daily = ensureDaily(progress);
  if (daily.chestClaimed) return false;
  daily.chestClaimed = true;
  progress.credits += reward;
  touchCreditStats(progress);
  saveProgress(progress);
  return true;
}
