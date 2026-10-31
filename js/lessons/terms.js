// Words a beginner may not know yet, explained where they appear: the first
// time a lesson's text uses one, it becomes a small button that opens a
// one-line definition and a link to the lesson that teaches it properly.
// (Code commands are explained in the editor instead - see editor/glossary.js.)

import { lessons } from "./data.js";

// term -> [definition, the lesson that teaches it]
export const TERMS = {
  microcontroller: ["The small computer chip on an Arduino board. It stores your program and runs it.", "l1-2"],
  sketch: ["An Arduino program.", "l1-4"],
  pin: ["A metal connection point on the board. Your code can switch it on and off, or read what's connected to it.", "l1-12"],
  voltage: ["The electrical \"push\" that makes current flow, measured in volts (V). An Arduino's pins use 5V.", "l1-13"],
  milliamps: ["A thousandth of an amp - the unit for the small currents Arduino circuits use. Written mA.", "m1-2"],
  resistance: ["How much something holds back the flow of current, measured in ohms (Ω).", "m1-3"],
  resistor: ["A part made to limit the current by a set amount - 220Ω is the usual one for an LED.", "m1-3"],
  GND: ["Ground: the 0-volt point that every circuit's current flows back to.", "m1-4"],
  ground: ["GND: the 0-volt point that every circuit's current flows back to.", "m1-4"],
  "short circuit": ["Power wired straight to GND with nothing in between - far too much current flows. Never do it.", "m1-4"],
  breadboard: ["A board full of holes for building circuits without soldering. Holes in the same short column are connected.", "l1-16"],
  LED: ["Light-emitting diode: a small light that only lets current through one way - long leg (+) toward power, short leg (−) toward GND.", "m1-6"],
  "in series": ["One after another in the same loop, so the same current flows through each part.", "m1-6"],
  anode: ["An LED's + leg (the longer one). It goes toward the power side.", "m1-6"],
  cathode: ["An LED's − leg (the shorter one). It goes toward GND.", "m1-6"],
  polarized: ["Only works one way round. LEDs and buzzers are polarized; resistors and buttons aren't.", "m1-7"],
  "Serial Monitor": ["The text window under the board where your sketch can print messages and numbers.", "l1-10"],
  compiler: ["The program that checks your code and turns it into instructions the board can run.", "l1-15"],
  variable: ["A named box in memory that holds a value your code can read and change.", "l1-8"],
  "pull-up resistor": ["A resistor that holds an input pin at HIGH until something (like a button) connects it to GND.", "l2-7"],
  analog: ["Any value across a range (like 0 to 1023), not just on or off.", "l3-1"],
  potentiometer: ["A knob: turning it changes a voltage smoothly between 0V and 5V.", "l3-3"],
  PWM: ["Pulse-width modulation: switching a pin on and off very fast, so it acts like a voltage in between.", "l4-1"],
  sensor: ["A part that measures something - light, distance, temperature - and turns it into a signal the Arduino can read.", "l3-5"],
};

// Longest first, so "short circuit" wins over a shorter term inside it.
const NAMES = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const PATTERN = new RegExp(`\\b(${NAMES.map((n) => n.replace(/[-]/g, "\\-")).join("|")})s?\\b`, "gi");
const keyFor = (word) => NAMES.find((n) => n.toLowerCase() === word.toLowerCase());

// Text -> a fragment where the first use (in this lesson) of each term is a
// button that explains it. `seen` is shared across the lesson's blocks.
// A term isn't marked in the lesson that teaches it.
export function withTerms(text, { seen, lessonId }) {
  const frag = document.createDocumentFragment();
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    const key = keyFor(match[1]);
    const [definition, teachingLesson] = TERMS[key] ?? [];
    // case matters for the all-caps ones: "led" in a sentence isn't the part
    const caseOk = key !== key.toUpperCase() || match[1] === key;
    if (!definition || !caseOk || seen.has(key) || teachingLesson === lessonId) continue;
    seen.add(key);
    frag.append(text.slice(last, match.index), termButton(match[0], key, definition, teachingLesson));
    last = match.index + match[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function termButton(shown, key, definition, teachingLesson) {
  const wrap = document.createElement("span");
  wrap.className = "term-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "term";
  btn.textContent = shown;
  btn.setAttribute("aria-expanded", "false");
  btn.title = "What does this mean?";
  const def = document.createElement("div");
  def.className = "term-def";
  def.setAttribute("role", "note");
  def.hidden = true;
  const strong = document.createElement("strong");
  strong.textContent = `${key}: `;
  def.append(strong, definition);
  const lesson = lessons.find((l) => l.id === teachingLesson);
  if (lesson) {
    const inModule = lessons.filter((l) => l.module === lesson.module);
    const link = document.createElement("button");
    link.type = "button";
    link.className = "term-link";
    link.dataset.action = "open-lesson";
    link.dataset.lessonId = lesson.id;
    link.textContent = `Explained in ${lesson.module}.${inModule.indexOf(lesson) + 1} ${lesson.title}`;
    def.append(" ", link);
  }
  // The explanation opens below the paragraph (or at the end of the list
  // item), not in the middle of the sentence.
  btn.addEventListener("click", () => {
    if (!def.isConnected) {
      const item = btn.closest("li");
      if (item) item.appendChild(def);
      else (btn.closest("p, .note-box") ?? wrap).after(def);
    }
    def.hidden = !def.hidden;
    btn.setAttribute("aria-expanded", String(!def.hidden));
  });
  wrap.appendChild(btn);
  return wrap;
}
