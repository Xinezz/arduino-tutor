// Sam, your mentor at CircuitWorks Robotics - the NPC who guides you through
// the site - and Volt, who runs the parts shop. This module owns their
// identities, portraits and dialogue lines, plus a renderer for the dialogue
// box itself; it doesn't know about progress/localStorage. Callers (app.js,
// dashboard.js) decide WHEN to show an NPC and pass in already-picked text,
// matching how challenge.js/quiz.js render UI and report back rather than
// reaching into state themselves.
//
// The portraits are live pixel sprites: they blink at random, their mouth
// moves while the line types out (with a little voice blip per syllable),
// and clicking one makes it react.

import { typewriterText } from "../utils/typewriter.js";
import { lessons } from "../lessons/data.js";
import { composedSvg } from "../game/sprites.js";
import { SAM_MOODS, VOLT_PALETTE } from "../game/bigSprites.js";
import { playSfx } from "../game/audio.js";

export const MENTOR_NAME = "Sam";
export const MENTOR_ROLE = "Senior Technician";

const SAM = { id: "sam", name: MENTOR_NAME, role: MENTOR_ROLE, pal: null };
const VOLT = { id: "volt", name: "Volt", role: "Parts Clerk", pal: VOLT_PALETTE };

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

const FIRST_VISIT_LINE =
  "First day on the floor - I'm Sam, I'll be showing you around. Nothing fancy: read, wire it up, try it. Start whenever you're ready.";

const DEBT_LINES = [
  "Payroll flagged your account - you're running a deficit. Happens to everyone. Close out a lesson or a challenge and you're square again.",
  "You're in the red at the moment. Not a big deal - finished work pays it right back down.",
];

const ALL_DONE_LINE =
  "Look at that - you've been through everything we've got on the floor right now. Seriously good work. I'll let you know the second new material lands.";

const STREAK_LINES = [
  "Multiple shifts in a row now. That's the kind of consistency that gets you noticed around here.",
  "You keep showing up. That matters more than people think.",
];

const GENERAL_GREETING_LINES = [
  "Morning. Bench is all yours whenever you're ready.",
  "Back for another shift? Let's keep building.",
  "Good to see you on the floor. What are we tackling today?",
  "Systems nominal. You know where the parts bin is.",
];

export function getDebtLine() {
  return pick(DEBT_LINES);
}

export function getDashboardGreeting(progress) {
  if (progress.viewedLessons.length === 0) return FIRST_VISIT_LINE;
  if (progress.credits < 0) return pick(DEBT_LINES);
  if (progress.viewedLessons.length >= lessons.length) return ALL_DONE_LINE;
  if ((progress.streak || 0) >= 3) return pick(STREAK_LINES);
  return pick(GENERAL_GREETING_LINES);
}

const MENU_RETURNING_LINES = [
  (name) => `Welcome back, ${name}. Bench is right where you left it.`,
  (name) => `Good to see you again, ${name}.`,
  (name) => `${name}! Right on time. Let's pick up where we left off.`,
];

// Reuses FIRST_VISIT_LINE for a brand-new name (same "day one" moment the
// Dashboard would otherwise show first) - name is null until setPlayerName
// has been called at least once.
export function getMenuGreeting(name) {
  if (!name) return FIRST_VISIT_LINE;
  return pick(MENU_RETURNING_LINES)(name);
}

// Only levels that actually have content get a curated pool - a level
// without one just falls back to a plain, always-correct templated line
// below rather than an empty/wrong dialogue box.
const LEVEL_INTRO_LINES = {
  1: [
    "Fundamentals first - everyone on this floor started exactly here.",
    "This part's mostly reading. Take it slow, it pays off later.",
  ],
  2: [
    "Now we're wiring things up for real. Careful with those pins.",
    "Digital I/O is half of this job. Get comfortable with it.",
  ],
  3: [
    "Sensors start talking back in this section - it gets more interesting from here.",
    "Analog's messier than digital. That's normal, don't fight it.",
  ],
  4: [
    "PWM trips people up the first time through. You've got this.",
    "This is where things start to feel like real automation.",
  ],
  6: [
    "Combining sensors and outputs - this is basically the job now.",
    "You're doing the kind of work we actually get paid for. Nice.",
  ],
};

export function getLessonIntroLine(lesson) {
  const pool = LEVEL_INTRO_LINES[lesson.level];
  if (pool && pool.length) return pick(pool);
  return `Up next: ${lesson.title}.`;
}

const LESSON_COMPLETE_LINES = [
  "Logged. Nice work.",
  "That's another one off the board.",
  "Clean work. On to the next.",
  "Noted in your file - good stuff.",
];

export function getLessonCompleteLine() {
  return pick(LESSON_COMPLETE_LINES);
}

const CHALLENGE_COMPLETE_LINES = [
  "Whoa - that actually works. Nice build.",
  "That's a real fix. I'd sign off on that.",
  "Solid. That's exactly how we'd wire it on a real job.",
  "Now THAT'S the kind of work that gets you promoted.",
];

export function getChallengeCompleteLine() {
  return pick(CHALLENGE_COMPLETE_LINES);
}

// A plain level-up gets a small nod; a milestone level (5/10/20 - see
// LEVEL_MILESTONES in progress.js) gets a bigger reaction that names the
// bonus, since that's the one that actually paid out extra credits.
const LEVEL_UP_LINES = [
  (level) => `Level ${level} now. Nice climb.`,
  (level) => `Level ${level}. You're getting good at this.`,
  (level) => `That's level ${level}. Keep it up.`,
];

const MILESTONE_LINES = [
  (level, bonus) => `Level ${level}! That's a real milestone - I put in for a bonus, +${bonus} credits just landed.`,
  (level, bonus) => `Level ${level} already. That one comes with a +${bonus} credit bonus - nice work.`,
  (level, bonus) => `Whoa, level ${level}. Payroll noticed - +${bonus} credits on top of the usual.`,
];

export function getLevelUpLine(level, isMilestone, bonus) {
  const pool = isMilestone ? MILESTONE_LINES : LEVEL_UP_LINES;
  return pick(pool)(level, bonus);
}

// ---- the game-layer lines ----

export function getPromotionLine(rankName) {
  return `${rankName}. That's official now - I filed it myself. Proud of you.`;
}

export function getBossIntroLine() {
  return pick([
    "Heads up - that's a boss challenge. It ties a bunch of things together. Take your time, and don't be too proud for a hint.",
    "This one's a boss fight. No shame in poking around a few times before it clicks.",
  ]);
}

export function getBossDefeatLine() {
  return pick([
    "You beat it! A boss challenge, and you just walked through it. That's going in your file in permanent marker.",
    "Boss down! I honestly wasn't sure that one was going to fall so fast.",
  ]);
}

export function getMapLine(progress) {
  if (progress.viewedLessons.length === 0) return "This is the overworld. Every node is a lesson - pick one and I'll meet you there.";
  return pick([
    "Here's the lay of the land. Gold stars mean you've cleared it. The skull ones bite.",
    "Plenty of road behind you. Pick a node, any node.",
  ]);
}

export function getShopGreeting() {
  return pick([
    "Welcome to the Parts Shop! Fresh stock, fair prices, zero refunds.",
    "Oh good, a customer. Look around - touch everything.",
    "Credits burning a hole in your pocket? Let's fix that.",
  ]);
}

export function getPurchaseLine(itemName) {
  return pick([
    `The ${itemName}! Excellent taste. It's yours.`,
    `Sold - the ${itemName}. Don't tell my boss I gave you the good one.`,
    `${itemName}, wrapped and ready. Pleasure doing business!`,
  ]);
}

export function getBrokeLine(price) {
  return `That one's ${price} credits - come back when you're a little richer. Finish a lesson, I'll be here.`;
}

const POKE_LINES = [
  "Hey! Mind the antenna.",
  "Yes? ...Oh, you just wanted to poke me.",
  "I'm a senior technician, you know.",
  "Careful, I'm calibrated.",
  "That tickles. Stop it. ...Okay, don't stop.",
  "Do you need something, or are you testing my response time?",
];

export function getPokeLine(count) {
  if (count >= 10) return "Okay, okay! You're persistent. I respect that.";
  return POKE_LINES[(count - 1) % POKE_LINES.length];
}

// ---- rendering ----

// app.js registers one handler here (to count pokes for the secret trophy) so
// every dialogue box counts them, whichever screen rendered it.
let globalPokeHandler = null;
export function setPokeHandler(fn) {
  globalPokeHandler = fn;
}

// Draws an NPC's dialogue box: living portrait, nameplate (+ optional small
// tag like "Quest Briefing"), and the line itself typed out
// character-by-character with a voice blip and a moving mouth. Returns
// nothing; calling it again on the same container cleanly replaces the
// previous box (and silences any line that was still typing).
//
// opts: { text, tag, mood = "idle", npc = SAM, onPoke(count), instant }
// instant: show the line already typed (used when a screen is only being
// refreshed in place, so Sam doesn't start the same sentence over).
function renderNpcBox(container, { text, tag, mood = "idle", npc = SAM, onPoke, instant = false } = {}) {
  container._npcCleanup?.();
  container._npcCleanup = null;
  container.innerHTML = "";
  if (!text) return;

  const baseOverlay = SAM_MOODS[mood] ?? SAM_MOODS.idle;
  const frame = (overlay) => composedSvg("sam", overlay, { scale: 4, pal: npc.pal });
  const frames = {
    idle: frame(baseOverlay),
    blink: frame({ ...baseOverlay, ...SAM_MOODS.blink }),
    talk: frame({ ...baseOverlay, ...SAM_MOODS.talk }),
    surprised: frame(SAM_MOODS.surprised),
  };

  const portrait = document.createElement("div");
  portrait.className = `mentor-portrait npc-${npc.id}`;
  portrait.innerHTML = frames.idle;
  portrait.title = `${npc.name} — click to say hi`;
  container.appendChild(portrait);

  const bubble = document.createElement("div");
  bubble.className = "mentor-bubble";

  const nameRow = document.createElement("div");
  nameRow.className = "mentor-name-row";
  const name = document.createElement("span");
  name.className = "mentor-name";
  name.textContent = `${npc.name} · ${npc.role}`;
  nameRow.appendChild(name);
  if (tag) {
    const tagEl = document.createElement("span");
    tagEl.className = "mentor-tag";
    tagEl.textContent = tag;
    nameRow.appendChild(tagEl);
  }
  bubble.appendChild(nameRow);

  const textEl = document.createElement("p");
  textEl.className = "mentor-text";
  bubble.appendChild(textEl);
  container.appendChild(bubble);

  let talking = false;
  let busy = false; // a poke reaction is showing - don't let blink/talk frames stomp on it
  let typing = null;
  let blinkTimer = null;
  let reactTimer = null;
  let pokes = 0;
  let mouthOpen = false;

  function show(name) {
    portrait.innerHTML = frames[name];
  }

  function say(line) {
    typing?.cancel();
    talking = true;
    typing = typewriterText(textEl, line, {
      maxDurationMs: 1300,
      minCharMs: 10,
      onChar: (n, ch) => {
        if (n % 4 !== 0 || ch === " " || busy) return;
        playSfx("blip");
        mouthOpen = !mouthOpen;
        show(mouthOpen ? "talk" : "idle");
      },
      onDone: () => {
        talking = false;
        mouthOpen = false;
        if (!busy) show("idle");
      },
    });
  }

  function scheduleBlink() {
    blinkTimer = setTimeout(() => {
      if (!container.isConnected) return;
      if (!talking && !busy) {
        show("blink");
        setTimeout(() => { if (!talking && !busy) show("idle"); }, 140);
      }
      scheduleBlink();
    }, 2400 + Math.random() * 3200);
  }

  portrait.addEventListener("click", () => {
    pokes += 1;
    busy = true;
    show("surprised");
    playSfx("blip");
    clearTimeout(reactTimer);
    reactTimer = setTimeout(() => { busy = false; if (!talking) show("idle"); }, 650);
    say(getPokeLine(pokes));
    (onPoke ?? globalPokeHandler)?.(pokes);
  });

  container._npcCleanup = () => {
    typing?.cancel();
    clearTimeout(blinkTimer);
    clearTimeout(reactTimer);
  };

  if (instant) textEl.textContent = text;
  else say(text);
  scheduleBlink();
}

export function renderMentorBox(container, opts = {}) {
  renderNpcBox(container, { ...opts, npc: SAM });
}

export function renderShopkeeperBox(container, opts = {}) {
  renderNpcBox(container, { ...opts, npc: VOLT });
}
