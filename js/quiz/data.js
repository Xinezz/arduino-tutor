// Quiz "mini-games" attached to specific lessons, keyed by lesson id - the
// same pattern data.js uses for challenges. Two types:
//
//   "order"   - a Parsons problem: lines of a correct program are shown
//               scrambled, and the learner drags/reorders them back into a
//               working sequence. Tests whether they understand WHY the
//               lines go in that order, not just whether they can type them.
//
//   "predict" - multiple choice "what does this code do / why is it wrong"
//               question. Tests reading comprehension of code, which is a
//               different (and just as important) skill from writing it.
//
// Every quiz has a `topic` string - the dashboard uses this to tell the
// learner which topics they keep getting wrong, not just which lessons
// they haven't opened yet.

export const quizzes = {
  "l1-4": {
    id: "quiz-structure",
    type: "order",
    topic: "Program Structure",
    title: "Arrange a Working Sketch",
    prompt:
      "These lines belong to a valid Arduino sketch, but they're scrambled. Drag them (or use the " +
      "▲▼ buttons) into an order that would actually compile and blink an LED.",
    lines: [
      "void setup() {",
      "  pinMode(13, OUTPUT);",
      "}",
      "void loop() {",
      "  digitalWrite(13, HIGH);",
      "  delay(500);",
      "  digitalWrite(13, LOW);",
      "  delay(500);",
      "}",
    ],
  },

  "l1-7": {
    id: "quiz-comments",
    type: "predict",
    topic: "Comments",
    title: "Predict the Output",
    prompt: "What will this code print to the Serial Monitor?",
    code: "int x = 5;\n// x = 10;\nSerial.println(x);",
    options: ["5", "10", "Nothing prints", "A compile error"],
    correctIndex: 0,
    explanation:
      "The line // x = 10; is a comment, so the compiler ignores it completely - x is never reassigned, " +
      "so it's still 5 when it's printed.",
  },

  "l1-9": {
    id: "quiz-int-division",
    type: "predict",
    topic: "Data Types",
    title: "Predict the Output",
    prompt: "int a = 5; int b = 2; Serial.println(a / b); — what gets printed?",
    code: "int a = 5;\nint b = 2;\nSerial.println(a / b);",
    options: ["2.5", "2", "3", "A compile error"],
    correctIndex: 1,
    explanation:
      "Both a and b are int, so C++ performs integer division and throws away the remainder: 5 / 2 " +
      "becomes 2, not 2.5. To get a decimal result, at least one operand needs to be a float - e.g. " +
      "float(a) / b.",
  },

  "l2-1": {
    id: "quiz-final-state",
    type: "predict",
    topic: "Digital Output State",
    title: "Predict the Output",
    prompt: "After this code finishes running once, what is the final state of pin 8?",
    code: "pinMode(8, OUTPUT);\ndigitalWrite(8, HIGH);\ndigitalWrite(8, LOW);\ndigitalWrite(8, HIGH);",
    options: ["LOW", "HIGH", "It alternates forever", "Undefined - depends on hardware"],
    correctIndex: 1,
    explanation:
      "digitalWrite() doesn't toggle - it sets the pin to exactly whatever value you pass. Each call " +
      "overwrites the previous one, so only the LAST call (HIGH) matters for the final state.",
  },

  "l2-2": {
    id: "quiz-missing-pinmode",
    type: "predict",
    topic: "pinMode()",
    title: "Find the Bug",
    prompt: "This code doesn't reliably turn the LED on. What's wrong with it?",
    code: "void setup() {\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n}",
    options: [
      "Nothing - this works fine",
      "Pin 13 was never configured with pinMode()",
      "digitalWrite() needs a delay() right after it",
      "HIGH should be written in lowercase",
    ],
    correctIndex: 1,
    explanation:
      "pinMode(13, OUTPUT) is missing from setup(). Without it, the pin's mode is left in its default " +
      "state, so digitalWrite() may not behave as expected - always configure a pin's mode before using it.",
  },

  "l2-6": {
    id: "quiz-button-read",
    type: "order",
    topic: "Reading Buttons",
    title: "Arrange a Button Reader",
    prompt:
      "Put these lines into an order that configures pin 7 as a pull-up input, then repeatedly reads and " +
      "prints its state.",
    lines: [
      "void setup() {",
      "  pinMode(7, INPUT_PULLUP);",
      "  Serial.begin(9600);",
      "}",
      "void loop() {",
      "  int state = digitalRead(7);",
      "  Serial.println(state);",
      "  delay(200);",
      "}",
    ],
  },

  "l2-7": {
    id: "quiz-floating-pin",
    type: "predict",
    topic: "Floating Pins",
    title: "Predict the Behaviour",
    prompt:
      "A digital INPUT pin is wired to a button on one side, but nothing else - no pull-up, no pull-down " +
      "resistor. What happens when digitalRead() is called while the button is NOT pressed?",
    code: "pinMode(7, INPUT);\n// button wired to pin 7, nothing else\nint state = digitalRead(7);",
    options: [
      "It always reads LOW",
      "It always reads HIGH",
      "It can read HIGH or LOW unpredictably (a floating pin)",
      "digitalRead() throws an error",
    ],
    correctIndex: 2,
    explanation:
      "With nothing pulling the pin to a definite voltage when the button is open, the pin is \"floating\" " +
      "and picks up tiny amounts of electrical noise - it can read HIGH or LOW seemingly at random. This is " +
      "exactly why pull-up/pull-down resistors exist.",
  },
};

export function getQuizForLesson(lessonId) {
  return quizzes[lessonId] || null;
}
