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
function normalize(saved) {
  const base = defaultProgress();
  const merged = { ...base, ...saved };
  merged.stats = { ...base.stats, ...(saved.stats || {}) };
  merged.equipped = { ...base.equipped, ...(saved.equipped || {}) };
  merged.daily = { ...base.daily, ...(saved.daily || {}) };
  merged.daily.counters = { ...base.daily.counters, ...(saved.daily?.counters || {}) };
  merged.achievements = saved.achievements && typeof saved.achievements === "object" ? saved.achievements : {};
  merged.hintUses = saved.hintUses && typeof saved.hintUses === "object" ? saved.hintUses : {};
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
export function recordQuizResult(progress, quizId, success, topic) {
  const existing = progress.quizzes[quizId] || { attempts: 0, solved: false, topic };
  const wasAlreadySolved = existing.solved;
  existing.attempts += 1;
  existing.lastResult = success ? "success" : "failure";
  existing.topic = topic;
  if (success) existing.solved = true;
  progress.quizzes[quizId] = existing;
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
