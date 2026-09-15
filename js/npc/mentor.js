// Sam, your mentor at CircuitWorks Robotics - the NPC who guides you through
// the site. This module only owns Sam's identity, portrait, and dialogue
// lines, plus a renderer for the dialogue box itself; it doesn't know about
// progress/localStorage. Callers (app.js, dashboard.js) decide WHEN to show
// Sam and pass in already-picked text, matching how challenge.js/quiz.js
// render UI and report back rather than reaching into state themselves.

import { typewriterText } from "../utils/typewriter.js";
import { lessons } from "../lessons/data.js";

export const MENTOR_NAME = "Sam";
export const MENTOR_ROLE = "Senior Technician";

// A simple circuit-badge portrait built from the same stroke-line language
// as the brand icon in the topbar (currentColor strokes, so it picks up
// whatever color the .mentor-portrait wrapper sets) - no external image to
// fetch, and it stays crisp at any size since it's just an inline SVG.
const MENTOR_AVATAR_SVG = `
<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="32" cy="32" r="27" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="2"/>
  <path d="M32 5 V13 M18 9 L22 16 M46 9 L42 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="5" r="1.8" fill="currentColor"/>
  <circle cx="18" cy="9" r="1.8" fill="currentColor"/>
  <circle cx="46" cy="9" r="1.8" fill="currentColor"/>
  <circle cx="23" cy="30" r="3" fill="currentColor"/>
  <circle cx="41" cy="30" r="3" fill="currentColor"/>
  <path d="M21 41 Q32 49 43 41" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

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

export function getDashboardGreeting(progress) {
  if (progress.viewedLessons.length === 0) return FIRST_VISIT_LINE;
  if (progress.credits < 0) return pick(DEBT_LINES);
  if (progress.viewedLessons.length >= lessons.length) return ALL_DONE_LINE;
  if ((progress.streak || 0) >= 3) return pick(STREAK_LINES);
  return pick(GENERAL_GREETING_LINES);
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

// Renders Sam's dialogue box: portrait, nameplate (+ optional small tag like
// "Quest Briefing"), and the line itself typed out character-by-character -
// reusing the same reveal effect as the rest of the site's terminal/code
// moments, just without the code-block styling that would drag VT323 in.
export function renderMentorBox(container, { text, tag } = {}) {
  container.innerHTML = "";
  if (!text) return;

  const portrait = document.createElement("div");
  portrait.className = "mentor-portrait";
  portrait.innerHTML = MENTOR_AVATAR_SVG;
  container.appendChild(portrait);

  const bubble = document.createElement("div");
  bubble.className = "mentor-bubble";

  const nameRow = document.createElement("div");
  nameRow.className = "mentor-name-row";

  const name = document.createElement("span");
  name.className = "mentor-name";
  name.textContent = `${MENTOR_NAME} · ${MENTOR_ROLE}`;
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
  typewriterText(textEl, text, { maxDurationMs: 700, minCharMs: 8 });

  container.appendChild(bubble);
}
