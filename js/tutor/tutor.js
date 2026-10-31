// The tutor's brain - rule-based, and honest about it. There is no AI model
// behind it: a question is matched by keywords to one of the course's own
// explanations (knowledge.js), or to a command or term the course defines
// (the editor glossary and lesson terms). If nothing fits, it says so and
// suggests questions it can answer, instead of guessing.
//
// Two answers look at the learner's actual work, passed in as context:
//   "Why isn't my LED on?"  - reads the circuit check and runs the sketch
//                             off-screen to see what the LED's pin really does;
//   "What does this error mean?" - explains the last error from the simulator
//                             (or an error message pasted into the question).
// Both answer as a ladder of hints - a question to think about first, then
// what's wrong, then the fix - never the fix first.
// Pure functions (no DOM), so they're tested directly.

import { TOPICS, STARTER_QUESTIONS } from "./knowledge.js";
import { GLOSSARY } from "../editor/glossary.js";
import { TERMS } from "../lessons/terms.js";
import { lessons } from "../lessons/data.js";
import { lessonPosition } from "../progress/learning.js";
import { explainError, stripLinePrefix } from "../simulator/feedback.js";
import { simulate } from "../simulator/headless.js";

const lessonById = new Map(lessons.map((l) => [l.id, l]));
const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export { STARTER_QUESTIONS };

// The lesson that teaches a glossary command, where there is one.
const COMMAND_LESSONS = {
  analogWrite: "l4-1", tone: "l4-3", noTone: "l4-3", pulseIn: "l6-1", constrain: "l3-4", map: "l3-4",
  analogRead: "l3-2", millis: "l5-6", delay: "m2-8", digitalRead: "l2-5", digitalWrite: "l2-3", pinMode: "l2-2",
  Serial: "l1-10", "Serial.begin": "l1-10", "Serial.print": "l1-10", "Serial.println": "l1-10",
  if: "l5-1", else: "l5-1", for: "l5-3", while: "l5-4", int: "l1-8", float: "l1-9", const: "l1-11",
  HIGH: "l2-1", LOW: "l2-1", OUTPUT: "l2-2", INPUT: "l2-5", INPUT_PULLUP: "l2-7", setup: "l1-4", loop: "l1-4",
};

const TROUBLE = /\b(not|isn't|isnt|doesn't|doesnt|won't|wont|can't|cant|never|broken|stuck|wrong|nothing|fix|help)\b/;
const lessonRef = (id) => {
  const l = lessonById.get(id);
  return l ? { id, label: `${lessonPosition(l).label} ${l.title}` } : null;
};

export function normalise(text) {
  return String(text ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();
}

function has(text, words, key) {
  if (/^[a-z0-9_]+$/.test(key)) return words.has(key) || words.has(`${key}s`) || (key.endsWith("s") && words.has(key.slice(0, -1)));
  return text.includes(key);
}

// Each topic's score for a question: the weights of its keywords present, a
// bonus when ALL its `all` words are there, and troubleshooting topics only
// count fully when the question is about something going wrong.
export function scoreTopics(question) {
  const text = normalise(question);
  const words = new Set(text.split(/[^a-z0-9_&|=~+'-]+/).filter(Boolean).map((w) => w.replace(/^'+|'+$/g, "")));
  const trouble = TROUBLE.test(text);
  return TOPICS.map((t) => {
    let score = 0;
    for (const [key, weight] of Object.entries(t.keys)) if (has(text, words, key)) score += weight;
    if (t.all) score += t.all.every((k) => has(text, words, k)) ? 6 : -2;
    if (t.trouble) score = trouble ? score + 3 : score / 2;
    return { topic: t, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

// A command or term named in the question, if the course defines it.
function lookupWord(question) {
  const raw = String(question ?? "");
  const words = raw.replace(/\(\s*\)/g, "").split(/[^A-Za-z0-9_.]+/).filter(Boolean);
  for (const w of words) {
    const key = Object.keys(GLOSSARY).find((k) => k.toLowerCase() === w.toLowerCase());
    if (key) return { kind: "command", key, entry: GLOSSARY[key] };
  }
  const text = normalise(raw);
  const term = Object.keys(TERMS).sort((a, b) => b.length - a.length).find((t) => new RegExp(`\\b${t.toLowerCase().replace(/[-]/g, "\\-")}s?\\b`).test(text));
  if (term) return { kind: "term", key: term, entry: TERMS[term] };
  return null;
}

function topicAnswer(t) {
  return {
    kind: "topic", id: t.id, title: t.title, steps: t.steps, example: t.example ?? null, realWorld: t.realWorld ?? null,
    think: t.think ?? null, lessons: t.lessons.map(lessonRef).filter(Boolean),
    related: (t.related ?? []).map((id) => TOPIC_BY_ID[id]).filter(Boolean).map((r) => ({ id: r.id, title: r.title })),
  };
}

// The answer to a question. context (all optional): { code, findings, lastError, where }
export function answer(question, context = {}) {
  const text = normalise(question);
  if (!text) return { kind: "empty", title: "Ask me something", steps: ["Type a question about electronics, Arduino code, or something on your board that isn't working."], suggestions: STARTER_QUESTIONS };
  // a pasted error message is explained directly
  if (/^line \d+:|missing '|was not declared|expected '|is a const/i.test(question.trim()) && !/^(what|why|how)\b/i.test(text)) {
    return { ...topicAnswer(TOPIC_BY_ID.errorMessage), diagnosis: diagnoseError({ ...context, pasted: question }) };
  }
  const scored = scoreTopics(question);
  const best = scored[0];
  const word = lookupWord(question);
  if (best && (best.score >= 3 || (!word && best.score >= 2))) {
    const result = topicAnswer(best.topic);
    if (best.topic.diagnose === "led") result.diagnosis = diagnoseLed(context);
    if (best.topic.diagnose === "error") result.diagnosis = diagnoseError(context);
    return result;
  }
  if (word?.kind === "command") {
    const lessonId = COMMAND_LESSONS[word.key];
    return { kind: "command", title: word.key, usage: word.entry.usage, steps: [word.entry.text],
      lessons: lessonId ? [lessonRef(lessonId)].filter(Boolean) : [], related: [] };
  }
  if (word?.kind === "term") {
    const [definition, lessonId] = word.entry;
    return { kind: "term", title: `What is ${/^([aeiou]|LED|LDR|RGB)/i.test(word.key) ? "an" : "a"} ${word.key}?`.replace(/What is an? (GND|PWM)\?/, "What is $1?"),
      steps: [definition], lessons: [lessonRef(lessonId)].filter(Boolean), related: [] };
  }
  return {
    kind: "unknown", title: "I don't have an answer for that one",
    steps: [
      "I'm a rule-based tutor: I can only explain the ideas this course teaches - electronics basics, Arduino commands, and the parts in the simulator - and help with LEDs that won't light or error messages.",
      "Try asking about one idea at a time, using its name (for example \"what is current?\" or \"what does delay() do?\").",
    ],
    suggestions: scored.slice(0, 3).map((x) => x.topic.title).concat(scored.length ? [] : STARTER_QUESTIONS.slice(0, 4)),
    lessons: [], related: [],
  };
}

// ---- reading the learner's own work ----

const ledFindings = (findings) => (findings ?? []).filter((f) => /^LED\b/.test(f.subject));

// { summary, hints: [...], lessonId } - the hints go from a question to
// think about, to what's wrong, to exactly what to change.
export function diagnoseLed(context = {}) {
  const result = ledDiagnosis(context);
  return result && { heading: "I LOOKED AT YOUR BOARD AND CODE", ...result };
}

function ledDiagnosis({ code, findings } = {}) {
  if (!findings) return null;
  const leds = ledFindings(findings);
  if (!leds.length) {
    return { summary: "There's no LED on the board in this workspace yet.",
      hints: ["Add an LED (and a 220Ω resistor) from the parts list under the board, then wire pin → resistor → LED long leg, and LED short leg → GND."], lessonId: "m1-6" };
  }
  const short = findings.find((f) => f.level === "problem" && /short circuit/i.test(f.text));
  const problem = short ?? leds.find((f) => f.level === "problem");
  if (problem) {
    return {
      summary: `I checked your circuit: there's a problem with ${problem.subject === "Circuit" ? "the wiring" : `the ${problem.subject}`}.`,
      hints: [
        "Look at the board before reading on: follow the loop from the pin, through the resistor and the LED, back to GND. Where does it break - or go the wrong way?",
        `${problem.subject}: ${problem.text}`,
      ],
      lessonId: /backwards|wrong way/.test(problem.text) ? "m1-7" : /short/i.test(problem.text) ? "m1-4" : "m1-6",
    };
  }
  const ok = leds.find((f) => f.level === "ok");
  const pin = ok?.data?.pin;
  if (typeof pin !== "number") {
    return { summary: "Your LED's circuit is complete and powered straight from 5V, so it lights whenever the board has power.",
      hints: ["To switch it from your sketch, move the wire from 5V to a digital pin (2-13) and use pinMode() and digitalWrite() on that pin."], lessonId: "l2-3" };
  }
  if (!code || !code.trim()) {
    return { summary: `Your LED is wired correctly to pin ${pin}. The sketch is empty, so nothing switches the pin on.`,
      hints: [`What does the sketch need to do to pin ${pin}? (Two things: set it up, then switch it.)`, `In setup(): pinMode(${pin}, OUTPUT); - in loop(): digitalWrite(${pin}, HIGH);`], lessonId: "l2-3" };
  }
  let run;
  try {
    run = simulate(code, { ms: 3000, inputs: { digitalRead: () => 1 } });
  } catch {
    return { summary: `Your LED is wired correctly to pin ${pin}. I couldn't run your sketch to check the code side.`, hints: ["Press Run and look at the Serial Monitor for an error."], lessonId: "l1-15" };
  }
  if (run.errors.length) {
    const info = explainError(run.errorDetails[0] ?? { message: run.errors[0] });
    return { summary: `Your LED is wired correctly to pin ${pin}, but the sketch has an error, so it never gets to switch it on.`,
      hints: [`Find the ${info.title.toLowerCase()}${info.line ? ` on line ${info.line}` : ""} first - can you spot it?`, `The error says: ${stripLinePrefix(run.errors[0])}`, ...info.hints.slice(0, 1)],
      lessonId: info.review?.lessonId ?? "l1-15" };
  }
  const writes = run.calls.filter((c) => (c.name === "digitalWrite" || c.name === "analogWrite") && typeof c.args[0] === "number");
  const pinsWritten = [...new Set(writes.map((c) => c.args[0]))];
  if (!pinsWritten.includes(pin)) {
    return {
      summary: pinsWritten.length
        ? `Your LED is wired to pin ${pin}, but the sketch switches pin${pinsWritten.length > 1 ? "s" : ""} ${pinsWritten.join(", ")}.`
        : `Your LED is wired correctly to pin ${pin}, but the sketch never switches any pin.`,
      hints: [
        `Which pin number does your digitalWrite() use - and which pin is the LED's wire in?`,
        pinsWritten.length
          ? `They need to match. Either change the pin number in pinMode() and digitalWrite() to ${pin}, or move the wire to pin ${pinsWritten[0]}.`
          : `Add pinMode(${pin}, OUTPUT); to setup() and digitalWrite(${pin}, HIGH); to loop().`,
      ],
      lessonId: "l2-3",
    };
  }
  if (run.hardware.modes[pin] !== "OUTPUT") {
    return { summary: `Your sketch writes to pin ${pin}, but never sets it up as an OUTPUT - so it can't power the LED.`,
      hints: ["Every pin starts as an INPUT. What tells a pin it should push power out?", `Add pinMode(${pin}, OUTPUT); inside setup().`], lessonId: "l2-2" };
  }
  // how long the pin spent HIGH in those 3 seconds, from its recorded changes
  // (a pin switched on and straight off again is HIGH for 0 ms - sampling
  // would miss it, the change list doesn't)
  const changes = run.hardware.events.filter((e) => e.pin === pin);
  let onMs = 0;
  let firstOn = null;
  changes.forEach((e, i) => {
    if (e.level <= 0) return;
    if (firstOn === null) firstOn = e.t;
    onMs += (changes[i + 1]?.t ?? 3000) - e.t;
  });
  if (firstOn === null) {
    return { summary: `Your sketch sets pin ${pin} as an OUTPUT but never switches it HIGH in the first 3 seconds.`,
      hints: [`Find the digitalWrite(${pin}, ...) lines. Is one of them HIGH - and does the code actually reach it (check any if conditions)?`, `digitalWrite(${pin}, HIGH); switches it on.`], lessonId: "l2-3" };
  }
  if (onMs / 3000 < 0.03) {
    return { summary: `Pin ${pin} does go HIGH, but only for a moment each time - too short to see.`,
      hints: ["After switching it on, does the sketch wait before switching it off again?", "Add a delay() straight after the digitalWrite(..., HIGH) line - delay(500); for half a second."], lessonId: "m2-8" };
  }
  return {
    summary: `I checked both: your LED is wired correctly to pin ${pin}, and when I ran your sketch, pin ${pin} went HIGH ${firstOn === 0 ? "straight away" : `after ${firstOn} ms`}. So in the simulator it should light.`,
    hints: ["Is the sketch running? Press Run - the LED only lights while it runs.",
      ...findings.filter((f) => f.level === "real" && /^LED\b/.test(f.subject)).map((f) => `On a real board: ${f.text}`)],
    lessonId: null, fine: true,
  };
}

export function diagnoseError({ lastError, pasted } = {}) {
  const source = lastError ?? (pasted ? { kind: "code", line: Number(/line (\d+)/i.exec(pasted)?.[1]) || null, message: pasted.trim() } : null);
  if (!source) return { heading: "YOUR LAST RUN", summary: "There's no error from your last run to look at - so I'll explain how to read one.", hints: [], lessonId: "l1-15", none: true };
  const info = explainError(source);
  return {
    heading: lastError ? "YOUR LAST RUN" : "THAT MESSAGE",
    summary: `${lastError ? "Your last run stopped with" : "That's"} a ${info.title.toLowerCase()}${info.line ? ` on line ${info.line}` : ""}: "${info.detail}". ${info.what}`,
    hints: info.hints.length ? info.hints : ["Look at the highlighted line, and the line just above it, for a missing ( ), { } or ;."],
    lessonId: info.review?.lessonId ?? "l1-15",
  };
}

export { lessonRef };
