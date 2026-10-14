// Daily missions: three small goals that reset every day, plus a bonus chest
// for clearing all three. They exist to give each session a little shape -
// "today I'll do two lessons and run a few programs" - without ever blocking
// anything. Rewards are credits only (XP stays tied to real lesson content so
// the level curve keeps meaning what it says).
//
// Which three missions you get is a pure function of the date, so reloading
// the page (or opening it on another device with the same save) shows the same
// board all day. Progress is counted in progress.daily.counters by the earn
// functions in progress.js; this module only describes the missions and reads
// those counters.

import { ensureDaily } from "../progress/progress.js";

export const CHEST_REWARD = 30;

// `counter` is the key in progress.daily.counters. At most one mission per
// counter makes it onto a day's board, so you never get "do 1 lesson" AND
// "do 2 lessons" side by side.
const POOL = [
  { id: "lesson-1", counter: "lessons", target: 1, reward: 10, name: "Study Session", desc: "Finish 1 lesson", icon: "book" },
  { id: "lesson-2", counter: "lessons", target: 2, reward: 18, name: "Double Shift", desc: "Finish 2 lessons", icon: "scroll" },
  { id: "challenge-1", counter: "challenges", target: 1, reward: 15, name: "Fix-It Friday", desc: "Solve 1 challenge", icon: "bolt" },
  { id: "challenge-2", counter: "challenges", target: 2, reward: 28, name: "Repair Crew", desc: "Solve 2 challenges", icon: "target" },
  { id: "quiz-2", counter: "quizzes", target: 2, reward: 12, name: "Pop Quiz", desc: "Solve 2 quiz games", icon: "question" },
  { id: "quiz-1", counter: "quizzes", target: 1, reward: 8, name: "Brain Teaser", desc: "Solve 1 quiz game", icon: "puzzle" },
  { id: "runs-5", counter: "runs", target: 5, reward: 10, name: "Spark Test", desc: "Run 5 programs", icon: "play" },
  { id: "runs-12", counter: "runs", target: 12, reward: 20, name: "Burn-In", desc: "Run 12 programs", icon: "led" },
  { id: "xp-30", counter: "xp", target: 30, reward: 12, name: "Grind Mode", desc: "Earn 30 XP today", icon: "star" },
  { id: "xp-60", counter: "xp", target: 60, reward: 22, name: "Overtime", desc: "Earn 60 XP today", icon: "flame" },
  { id: "flag-1", counter: "flagged", target: 1, reward: 6, name: "Note to Self", desc: "Flag a lesson for review", icon: "flag" },
];
// (No "finish a project stage" mission on purpose: projects unlock partway
// through the course, so on day one it would be a mission nobody can complete.)

// mulberry32: a tiny seeded PRNG, so a given date always shuffles the same way.
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function missionsForDate(dateString) {
  const rand = seededRandom(hashString(dateString));
  const shuffled = [...POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = [];
  const usedCounters = new Set();
  for (const m of shuffled) {
    if (usedCounters.has(m.counter)) continue;
    usedCounters.add(m.counter);
    picked.push(m);
    if (picked.length === 3) break;
  }
  return picked;
}

// Everything the UI needs about today's board in one call.
export function getDailyBoard(progress) {
  const daily = ensureDaily(progress);
  const missions = missionsForDate(daily.date).map((m) => {
    const have = Math.min(daily.counters[m.counter] ?? 0, m.target);
    return {
      ...m,
      have,
      done: have >= m.target,
      claimed: daily.claimed.includes(m.id),
    };
  });
  const allClaimed = missions.every((m) => m.claimed);
  return {
    date: daily.date,
    missions,
    claimable: missions.filter((m) => m.done && !m.claimed),
    allClaimed,
    chestReady: allClaimed && !daily.chestClaimed,
    chestClaimed: daily.chestClaimed,
    chestReward: CHEST_REWARD,
  };
}

// How many things on the board are waiting to be collected (drives the little
// "!" badge on the Profile tab).
export function pendingRewardCount(progress) {
  const board = getDailyBoard(progress);
  return board.claimable.length + (board.chestReady ? 1 : 0);
}

// "mission-1" style lookup, used by the reward flow to detect a mission that
// just became complete.
export function completedMissionIds(progress) {
  return getDailyBoard(progress).missions.filter((m) => m.done).map((m) => m.id);
}
