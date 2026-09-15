// The CircuitWorks Robotics rank ladder - originally lived inside
// dashboard.js, extracted here once the main menu needed the current rank
// too (for the "CURRENT LEVEL" pill in its header), so both stay in sync off
// one source instead of drifting.

import { lessons } from "../lessons/data.js";

// The full ladder from the course design. Only the first three ranks are
// reachable with the content built so far (Levels 1, 2, 3, 4, 6) - the rest
// are shown as genuinely locked rather than faked, since the levels they'd
// represent (5, 7, 8, the full Level 9 project list) don't exist yet.
export const RANKS = [
  { name: "Arduino Beginner", desc: "Getting comfortable with the fundamentals: setup(), loop(), variables, the Serial Monitor." },
  { name: "Digital I/O Apprentice", desc: "Can wire and control LEDs and buttons, and reason about pin states." },
  { name: "Sensor Explorer", desc: "Reads analog sensors, drives PWM outputs, and combines both into real automation." },
  { name: "Arduino Programmer", desc: "Fluent in the programming fundamentals behind every sketch.", future: true },
  { name: "Embedded Systems Builder", desc: "Writes non-blocking, interrupt-aware, multi-part programs.", future: true },
  { name: "Mechatronics Engineer", desc: "Builds full multi-sensor, multi-actuator mechatronics projects.", future: true },
];

function isLevelDone(progress, levelNum) {
  const ids = lessons.filter((l) => l.level === levelNum).map((l) => l.id);
  return ids.length > 0 && ids.every((id) => progress.viewedLessons.includes(id));
}

export function computeCurrentRankIndex(progress) {
  const level1Done = isLevelDone(progress, 1);
  const level2346Done = [1, 2, 3, 4, 6].every((lvl) => isLevelDone(progress, lvl));
  if (level2346Done) return 2;
  if (level1Done) return 1;
  return 0;
}

export function getCurrentRank(progress) {
  return RANKS[computeCurrentRankIndex(progress)];
}
