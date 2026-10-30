// Turns a simulator error into feedback a beginner can act on: WHAT KIND of
// mistake it is (so "I mistyped something" never looks like "the simulator
// can't do that"), a hint for finding it yourself rather than the answer,
// and how to get going again. Pure functions - no DOM - so they're tested
// directly (tests/feedback.test.js).
//
// Wiring problems are deliberately NOT handled here: they come from the
// circuit check (board.inspectCircuit), which reads the actual board, so the
// code side never guesses about the circuit.

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

// First match wins, so the specific patterns come before the general ones.
const HINTS = [
  [/Missing ';'/, "Every instruction in C++ ends with a semicolon, the way a sentence ends with a full stop. Look at the very end of the highlighted line."],
  [/Expected ';' before/, "Two instructions have run together. Check that each one ends with ; before the next begins."],
  [/Missing '\}'/, "Every { needs a matching }. Count them: each function, if, for and while opens one and must close it."],
  [/never closed/, "Text in \"double quotes\" and /* comments */ both need a closing mark on the same piece of code."],
  [/Expected '\{' to start the body/, "A function's code goes inside { } straight after its ( ), like void setup() { ... }."],
  [/has no matching 'if'/, "An else has to come straight after the } that closes an if. Look for a stray ; between them."],
  [/Adding a number to text in quotes/, "Print the pieces one after another instead: Serial.print(\"Value: \"); then Serial.println(x);"],
  [/was not declared/, "C++ only knows names you've declared first (like int ledPin = 13;) - and it's case-sensitive, so ledPin, LedPin and LEDPIN are three different names. Check spelling and capitals."],
  [/is a const/, "const means \"this value never changes\". If it really needs to change while the sketch runs, remove the word const from its declaration."],
  [/built-in Arduino constant/, "Names like HIGH, OUTPUT and LED_BUILTIN are already taken by Arduino. Pick your own name instead."],
  [/already declared|defined twice/, "Each name can only be declared once in a block. To change a variable that already exists, leave the type off: ledPin = 12; not int ledPin = 12;"],
  [/needs \S+ arguments?|but was given/, "The values inside the ( ) don't match what the function expects. Compare your call with the usage shown in the message."],
  [/Every sketch needs both/, "Arduino runs setup() once, then loop() over and over - both must be there, even if one is empty: void loop() { }"],
  [/must be written exactly as void/, "setup() and loop() always look exactly like this: void setup() { ... } and void loop() { ... }."],
  [/can only be used inside a loop/, "break and continue only make sense inside a for or while loop."],
  [/return/, "A function declared with a type (like int) must hand back a value with return; a void function must not."],
  [/can't be stored in|expected an? .+ but got|Can't compare|can't be turned into|only works with whole numbers|needs a number|expects a number/, "Every value has a type: int for whole numbers, float for decimals, String or \"text\" for words. The two sides here don't fit together."],
  [/Division by zero/, "Find the value you're dividing by and print it with Serial.println() just before this line to see why it's 0."],
  [/Too many functions calling each other/, "A function that calls itself needs a condition that eventually stops it calling itself again."],
  [/Expected|Unexpected/, "The code stops making grammatical sense around here. Check the highlighted line - and the line above it - for a missing ( ), { } or ;."],
];

// The part after "Line N: ", for showing under a heading that already says the line.
export function stripLinePrefix(message) {
  return String(message).replace(/^Line \d+: /, "");
}

export function explainError({ kind = "code", line = null, message = "" } = {}) {
  const info = ERROR_KINDS[kind] || ERROR_KINDS.code;
  const where = line ? `line ${line}` : "the code";

  let hint;
  if (kind === "unsupported") {
    hint = "Open \"Simulator limits\" (beside Check Circuit) to see what's supported and the usual way to rewrite this part.";
  } else if (kind === "internal") {
    hint = "Try simplifying the code around the highlighted line. If it keeps happening, it's a bug in the simulator, not you.";
  } else {
    hint = HINTS.find(([pattern]) => pattern.test(message))?.[1] ?? null;
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
    hint,
    recovery,
  };
}
