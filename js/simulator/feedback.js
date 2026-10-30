// Turns simulator problems into feedback a beginner can act on:
//  - WHAT KIND of mistake it is (so "I mistyped something" never looks like
//    "the simulator can't do that"),
//  - hints revealed one at a time (the first nudges, later ones get more
//    specific), so the learner can stop as soon as they see it themselves,
//  - which LESSON explains the idea behind it,
//  - and how to get going again.
// Pure functions - no DOM - so they're tested directly (tests/feedback.test.js).
//
// Wiring problems are never diagnosed here: they come from the circuit check
// (board.inspectCircuit), which reads the actual board, so the code side never
// guesses about the circuit. This file only says which lesson explains a
// finding (conceptForFinding).

import { lessons } from "../lessons/data.js";

export const ERROR_KINDS = {
  syntax: {
    title: "Syntax error",
    what: "The code doesn't follow C++'s grammar rules, so none of it can run yet.",
  },
  code: {
    title: "Code problem",
    what: "The grammar is fine, but part of the code doesn't make sense - usually a name, a type, or a rule like const.",
  },
  unsupported: {
    title: "Not supported in this simulator",
    what: "This may well be valid Arduino code - this simulator just can't run that feature.",
  },
  runtime: {
    title: "Runtime error",
    what: "The sketch started, then hit something it couldn't do while it was running.",
  },
  internal: {
    title: "Simulator problem",
    what: "Something went wrong inside the simulator itself - not necessarily in your code.",
  },
};

// Errors. First match wins, so the specific patterns come before the general
// ones. Each entry: [pattern, hints (gentlest first), the lesson to review].
const HINTS = [
  [/Missing ';'/, [
    "Every instruction in C++ ends with a semicolon, the way a sentence ends with a full stop. Look at the very end of the highlighted line.",
    "Compare the highlighted line with the one above it: that one probably ends with ; and this one doesn't.",
  ], "l1-15"],
  [/Expected ';' before/, ["Two instructions have run together. Check that each one ends with ; before the next begins."], "l1-15"],
  [/Missing '\}'/, [
    "Every { needs a matching }. Count them: each function, if, for and while opens one and must close it.",
    "The message names the function that's still open. Find where it should end and add a } there.",
  ], "l1-4"],
  [/never closed/, ["Text in \"double quotes\" and /* comments */ both need a closing mark."], "l1-7"],
  [/Expected '\{' to start the body/, ["A function's code goes inside { } straight after its ( ), like void setup() { ... }."], "l1-4"],
  [/has no matching 'if'/, ["An else has to come straight after the } that closes an if. Look for a stray ; between them."], "l5-1"],
  [/Adding a number to text in quotes/, ["Print the pieces one after another instead: Serial.print(\"Value: \"); then Serial.println(x);"], "l1-10"],
  [/was not declared/, [
    "C++ only knows names you've declared first (like int ledPin = 13;) - and it's case-sensitive, so ledPin, LedPin and LEDPIN are three different names. Check spelling and capitals.",
    "Spelled right? Then check WHERE it's declared: above the line that uses it, and somewhere this code can see. A variable declared inside setup() can't be used in loop() - declare it at the top of the sketch instead.",
  ], "l1-8"],
  [/is a const/, [
    "const means \"this value never changes\" - so changing it is an error on purpose.",
    "If the value really needs to change while the sketch runs, remove the word const where it's declared (the message gives the line).",
  ], "l1-11"],
  [/built-in Arduino constant/, ["Names like HIGH, OUTPUT and LED_BUILTIN are already taken by Arduino. Pick your own name instead."], "l1-11"],
  [/already declared|defined twice/, [
    "Each name can only be declared once in a block.",
    "To change a variable that already exists, leave the type off: ledPin = 12; not int ledPin = 12;",
  ], "l1-8"],
  [/needs \S+ arguments?|but was given/, ["The values inside the ( ) don't match what the function expects. Compare your call with the usage shown in the message."], "l5-5"],
  [/Every sketch needs both/, ["Arduino runs setup() once, then loop() over and over - both must be there, even if one is empty: void loop() { }"], "l1-4"],
  [/must be written exactly as void/, ["setup() and loop() always look exactly like this: void setup() { ... } and void loop() { ... }."], "l1-4"],
  [/can only be used inside a loop/, ["break and continue only make sense inside a for or while loop."], "l5-3"],
  [/return/, ["A function declared with a type (like int) must hand back a value with return; a void function must not."], "l5-5"],
  [/can't be stored in|expected an? .+ but got|Can't compare|can't be turned into|only works with whole numbers|needs a number|expects a number/, [
    "Every value has a type: int for whole numbers, float for decimals, String or \"text\" for words. The two sides here don't fit together.",
  ], "l1-9"],
  [/Division by zero/, [
    "Something is being divided by 0, which has no answer.",
    "Find the value you're dividing by and print it with Serial.println() just before this line to see why it's 0.",
  ], "l1-9"],
  [/Too many functions calling each other/, ["A function that calls itself needs a condition that eventually stops it calling itself again."], "l5-5"],
  [/Expected|Unexpected/, ["The code stops making grammatical sense around here. Check the highlighted line - and the line above it - for a missing ( ), { } or ;."], "l1-15"],
];

// Warnings: code that runs, but probably doesn't do what was meant. Each
// entry: [pattern, (match) => hints, lesson]. The first hint explains the
// idea; the last says exactly what to change.
const WARNING_HELP = [
  [/never set up with pinMode\((\w+), OUTPUT\)|pin (\w+) is set to INPUT/, (m) => [
    "Every pin starts out as an INPUT: it listens, it doesn't push power out - so writing HIGH to it can't light anything.",
    "pinMode(pin, OUTPUT) changes the pin's job to output. It only needs to happen once, so it belongs in setup().",
    `Add pinMode(${m[1] || m[2]}, OUTPUT); inside setup().`,
  ], "l2-2"],
  [/can't do PWM/, () => [
    "Only some pins can fake an in-between voltage with PWM - they're marked ~ on the board.",
    "On an Uno those are pins 3, 5, 6, 9, 10 and 11. Move the wire, and the pin number in your code, to one of them.",
  ], "l4-1"],
  [/has to be between 0 and 255/, () => [
    "analogWrite() takes 0 (off) to 255 (fully on) - nothing else.",
    "If the value comes from analogRead() (0-1023), rescale it first with map(value, 0, 1023, 0, 255) - or keep it in range with constrain().",
  ], "l4-1"],
  [/"floating"/, () => [
    "An input pin connected to nothing has no definite voltage, so it reads random HIGHs and LOWs.",
    "Give it a default: pinMode(pin, INPUT_PULLUP) holds it HIGH until a button pulls it LOW - or add a 10kΩ resistor from the pin to GND.",
  ], "l2-7"],
  [/only A0-A5 can read analog/, () => ["analogRead() only works on the six analog pins, A0 to A5. Wire the sensor there and read it with analogRead(A0) (or A1...)."], "l3-2"],
  [/before Serial\.begin/, () => ["The Serial Monitor only works after Serial.begin(9600); has run - put it at the start of setup()."], "l1-10"],
  [/Serial (TX|RX)/, () => ["Pins 0 and 1 carry the Serial Monitor's messages. Use another pin for your parts, so the two don't interfere."], "l1-12"],
  [/doesn't fit in/, () => [
    "Each type has a range: an int on an Uno only holds -32768 to 32767. Past either end it wraps round to the other end.",
    "For bigger numbers (or anything from millis()), use long or unsigned long.",
  ], "l1-9"],
  [/uses '=', which STORES a value/, () => ["= stores a value; == compares two values. Inside an if you almost always want ==."], "l5-1"],
  [/There's a ';' right after if/, () => ["A ; straight after if (...) ends the if, so the block below runs every time. Remove that ;."], "l5-1"],
  [/compares two values but does nothing/, () => ["A comparison on its own doesn't do anything. Did you mean to store a value (=), or to put it inside an if?"], "l5-2"],
  [/negative/, () => ["delay() can't wait a negative time - on an Uno a negative number turns into a huge wait (about 49 days)."], "l1-6"],
];

// Circuit check findings -> the lesson that explains that part.
const PART_LESSONS = {
  LED: "l2-4", "RGB LED": "l4-4", Button: "l2-6", Buzzer: "l4-3", Potentiometer: "l3-3",
  "Light sensor": "l3-5", "Temperature sensor": "l6-4", "IR sensor": "l6-2",
  "Ultrasonic sensor": "l6-1", Servo: "l4-5", Resistor: "l2-4",
};

const lessonTitle = (id) => lessons.find((l) => l.id === id)?.title ?? null;
const reviewFor = (id) => (id && lessonTitle(id) ? { lessonId: id, title: lessonTitle(id) } : null);

// The part after "Line N: ", for showing under a heading that already says the line.
export function stripLinePrefix(message) {
  return String(message).replace(/^Line \d+: /, "");
}

export function explainError({ kind = "code", line = null, message = "" } = {}) {
  const info = ERROR_KINDS[kind] || ERROR_KINDS.code;
  const where = line ? `line ${line}` : "the code";

  let hints = [];
  let review = null;
  if (kind === "unsupported") {
    hints = ["Open \"Simulator Limits\" (beside Check Circuit) to see what's supported and the usual way to rewrite this part."];
  } else if (kind === "internal") {
    hints = ["Try simplifying the code around the highlighted line. If it keeps happening, it's a bug in the simulator, not you."];
  } else {
    const entry = HINTS.find(([pattern]) => pattern.test(message));
    hints = entry?.[1] ?? [];
    review = reviewFor(entry?.[2]);
  }

  let recovery;
  if (kind === "runtime") {
    recovery = `The sketch stopped at ${where}. Fix it, then press Run - the sketch starts again from setup().`;
  } else if (kind === "internal") {
    recovery = "Press Run to try again.";
  } else {
    recovery = `Nothing ran. Fix ${where}${line ? " (highlighted in the editor)" : ""}, then press Run again - your circuit hasn't changed.`;
  }

  return {
    kind,
    line,
    title: info.title,
    what: info.what,
    detail: stripLinePrefix(message),
    hint: hints[0] ?? null,
    hints,
    review,
    recovery,
  };
}

// { hints, review } for a warning message (hints may be empty).
export function explainWarning(message) {
  const entry = WARNING_HELP.find(([pattern]) => pattern.test(message));
  if (!entry) return { hints: [], review: null };
  const [pattern, hints, lessonId] = entry;
  return { hints: hints(message.match(pattern)), review: reviewFor(lessonId) };
}

// The lesson that explains a circuit check finding, or null.
export function conceptForFinding(finding) {
  if (finding.level === "ok") return null;
  if (/short circuit/i.test(finding.text)) return reviewFor("l1-13");
  if (/floats|floating|pull-down/.test(finding.text)) return reviewFor("l2-7");
  if (/already held HIGH/.test(finding.text)) return reviewFor("l2-8");
  if (/rail/.test(finding.text)) return reviewFor("l1-16");
  if (/analogRead\(\) only works/.test(finding.text)) return reviewFor("l3-2");
  return reviewFor(PART_LESSONS[finding.subject.replace(/ \d+$/, "")]);
}
