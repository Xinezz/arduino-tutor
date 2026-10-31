// Names the mistakes the simulator reports, so the same KIND of mistake can
// be spotted when it keeps coming back - "a missing semicolon" three times
// in a week, not three unrelated error messages. Each kind says which lesson
// explains it (the same lessons the simulator's own hints point to).
//
// Only the learner's mistakes are named: "not supported in this simulator"
// and the simulator's own internal errors are never counted against anyone.
// Pure functions - progress.recordMistake does the saving.

import { explainError, explainWarning, conceptForFinding } from "../simulator/feedback.js";

// [pattern, id, label] - first match wins. Labels finish the sentence
// "The same mistake came up N times: ..."
const ERRORS = [
  [/Missing ';'|Expected ';' before/, "semicolon", "a missing semicolon ( ; ) at the end of a line"],
  [/Missing '\}'|Expected '\{'/, "braces", "a missing or extra curly bracket { }"],
  [/never closed/, "unclosed", "text in quotes or a comment that was never closed"],
  [/was not declared/, "undeclared", "a name the code doesn't know - spelling, capitals, or where it's declared"],
  [/is a const/, "const", "changing a value declared const"],
  [/already declared|defined twice/, "redeclared", "declaring the same name twice"],
  [/needs \S+ arguments?|but was given/, "arguments", "the wrong number of values in a function call"],
  [/Every sketch needs both|must be written exactly as void/, "structure", "a sketch missing setup() or loop(), or written differently"],
  [/has no matching 'if'/, "else", "an else with no if straight before it"],
  [/can't be stored in|expected an? .+ but got|Can't compare|can't be turned into|only works with whole numbers|needs a number|expects a number|Adding a number to text/, "types", "mixing up types (numbers, decimals and text)"],
  [/Division by zero/, "divzero", "dividing by zero"],
  [/return/, "return", "a function's return not matching its type"],
  [/Expected|Unexpected/, "syntax", "code that stops making grammatical sense (a missing ( ), { } or ;)"],
];

const WARNINGS = [
  [/never set up with pinMode|is set to INPUT/, "no-pinmode", "writing to a pin that was never set up with pinMode(pin, OUTPUT)"],
  [/can't do PWM/, "pwm-pin", "analogWrite() on a pin that can't do PWM"],
  [/has to be between 0 and 255/, "pwm-range", "an analogWrite() value outside 0-255"],
  [/"floating"/, "floating", "reading an input pin that's floating (no pull-up)"],
  [/only A0-A5 can read analog/, "analog-pin", "analogRead() on a pin that isn't A0-A5"],
  [/before Serial\.begin/, "serial-begin", "printing before Serial.begin()"],
  [/uses '=', which STORES a value/, "assign-compare", "using = (store) where == (compare) was meant"],
  [/There's a ';' right after if/, "if-semicolon", "a ; straight after if ( ... )"],
  [/doesn't fit in/, "overflow", "a number too big for its type"],
];

const CIRCUIT = [
  [/short circuit/i, "short", "a short circuit - power wired straight to GND"],
  [/in backwards|wrong way round/, "backwards", "a part wired in backwards (polarity)"],
  [/Both legs are connected/, "same-point", "both legs of a part connected to the same point"],
  [/doesn't reach GND|isn't connected to GND/, "no-gnd", "a part that doesn't connect back to GND"],
  [/doesn't reach a pin|Neither leg reaches a pin/, "no-pin", "a part that isn't connected to a pin"],
  [/floats|no pull-up/, "floating", "a button input with nothing holding it HIGH or LOW"],
  [/already held HIGH/, "pullup-5v", "a pull-up button wired to 5V instead of GND"],
  [/analogRead\(\) only works on the analog pins/, "analog-pin", "an analog part wired to a digital pin"],
];

const match = (table, text) => table.find(([re]) => re.test(text));

// { id, label, lessonId } for a problem the simulator panel reported
// ({ type, message, details?, finding? }), or null if it isn't the learner's
// mistake (or isn't recognised).
export function mistakeFromProblem(problem) {
  if (!problem?.message) return null;
  if (problem.type === "error") {
    const kind = problem.details?.kind ?? "code";
    if (kind === "unsupported" || kind === "internal") return null;
    const m = match(ERRORS, problem.message);
    if (!m) return null;
    return { id: `error:${m[1]}`, label: m[2], lessonId: explainError(problem.details ?? { message: problem.message }).review?.lessonId ?? null };
  }
  if (problem.type === "warning") {
    const m = match(WARNINGS, problem.message);
    if (!m) return null;
    return { id: `warning:${m[1]}`, label: m[2], lessonId: explainWarning(problem.message).review?.lessonId ?? null };
  }
  if (problem.type === "circuit" && problem.finding) {
    const m = match(CIRCUIT, problem.message);
    if (!m) return null;
    return { id: `circuit:${m[1]}`, label: m[2], lessonId: conceptForFinding(problem.finding)?.lessonId ?? null };
  }
  return null;
}
