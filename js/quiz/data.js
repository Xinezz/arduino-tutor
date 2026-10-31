// Quiz "mini-games" attached to specific lessons, keyed by lesson id - the
// same pattern data.js uses for challenges. Six types (the sixth,
// "questions" - a short set of understanding questions, each wrong option
// explained - is described in quiz.js):
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
//   "debug"   - a full listing with one real bug in it; the learner clicks
//               the buggy line instead of describing what's wrong. Trains
//               recognizing what specific mistakes actually LOOK like -
//               needs `lines`, `buggyLineIndex`, `explanation`, `fixedLine`.
//
//   "fill"    - a known-correct snippet with one word blanked out, filled
//               in from a multiple-choice word bank (not free typing - the
//               point is recognizing the right piece, not typos). Needs
//               `codeBefore`, `codeAfter`, `choices`, `correctChoice`.
//
//   "match"   - click a term on the left, then its meaning on the right;
//               wrong guesses just flash and reset instead of ending the
//               attempt. Needs `pairs`: [{ left, right }, ...].
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

  "l1-15": {
    id: "quiz-missing-semicolon",
    type: "debug",
    topic: "Syntax Errors",
    title: "Find the Bug",
    prompt: "This sketch won't compile. Click the line the compiler would actually complain about.",
    lines: [
      "int ledPin = 13;",
      "",
      "void setup() {",
      "  pinMode(ledPin, OUTPUT)",
      "}",
      "",
      "void loop() {",
      "  digitalWrite(ledPin, HIGH);",
      "  delay(500);",
      "  digitalWrite(ledPin, LOW);",
      "  delay(500);",
      "}",
    ],
    buggyLineIndex: 3,
    explanation:
      "Every statement needs a semicolon at the end - pinMode(ledPin, OUTPUT) is missing one. Compilers " +
      "usually report this kind of error on the NEXT line (wherever they finally hit something that doesn't " +
      "make sense), which is exactly the trap this lesson warns about: the reported line number is a " +
      "starting point for your search, not necessarily the exact spot.",
    fixedLine: "  pinMode(ledPin, OUTPUT);",
  },

  "l2-8": {
    id: "quiz-pullup-inverted",
    type: "debug",
    topic: "INPUT_PULLUP Logic",
    title: "Find the Bug",
    prompt:
      "This button+LED code compiles fine, but the LED lights up while the button is NOT pressed, and " +
      "turns off while it IS pressed - backwards from what was intended. Click the buggy line.",
    lines: [
      "int buttonPin = 7;",
      "int ledPin = 13;",
      "",
      "void setup() {",
      "  pinMode(ledPin, OUTPUT);",
      "  pinMode(buttonPin, INPUT_PULLUP);",
      "}",
      "",
      "void loop() {",
      "  if (digitalRead(buttonPin) == HIGH) {",
      "    digitalWrite(ledPin, HIGH);",
      "  } else {",
      "    digitalWrite(ledPin, LOW);",
      "  }",
      "}",
    ],
    buggyLineIndex: 9,
    explanation:
      "INPUT_PULLUP means the pin reads HIGH by default and LOW while the button is actually pressed - the " +
      "opposite of what most people assume. Checking == HIGH lights the LED exactly when the button ISN'T " +
      "being touched. Checking == LOW instead would match the pressed state correctly.",
    fixedLine: "  if (digitalRead(buttonPin) == LOW) {",
  },

  "l3-1": {
    id: "quiz-match-analog-digital",
    type: "match",
    topic: "Analog vs Digital",
    title: "Match the Pairs",
    prompt: "Match each term to what it actually means.",
    pairs: [
      { left: "Digital signal", right: "Only two possible states - HIGH or LOW" },
      { left: "Analog signal", right: "Any value across a continuous range" },
      { left: "ADC", right: "Converts a continuously-variable voltage into a number" },
      { left: "Dimmer knob", right: "The lesson's real-world example of an analog signal" },
    ],
  },
};

// ---- Checkpoints added with the structured lessons (Program Flow) ----
Object.assign(quizzes, {
  "l5-1": {
    id: "quiz-if-assign",
    type: "debug",
    topic: "if / else",
    title: "Find the Bug",
    prompt: "This prints \"Exactly 20 degrees\" even though the temperature is 35. Click the line that causes it.",
    lines: [
      "int temperature = 35;",
      "",
      "void setup() {",
      "  Serial.begin(9600);",
      "  if (temperature = 20) {",
      "    Serial.println(\"Exactly 20 degrees\");",
      "  }",
      "}",
      "",
      "void loop() {",
      "}",
    ],
    buggyLineIndex: 4,
    explanation:
      "A single = STORES 20 in temperature instead of comparing it. The stored value, 20, isn't zero, so the " +
      "condition counts as true every time. Comparing needs two: ==.",
    fixedLine: "  if (temperature == 20) {",
  },

  "l5-2": {
    id: "quiz-match-logic",
    type: "match",
    topic: "Logic Operators",
    title: "Match the Pairs",
    prompt: "Match each operator to what it means.",
    pairs: [
      { left: "&&", right: "Both conditions must be true" },
      { left: "||", right: "At least one condition must be true" },
      { left: "!", right: "Flips true and false" },
      { left: "!=", right: "Not equal to" },
    ],
  },

  "l5-3": {
    id: "quiz-fill-for",
    type: "fill",
    topic: "for Loops",
    title: "Fill in the Blank",
    prompt: "Complete the loop so it runs exactly 5 times, with i going 0, 1, 2, 3, 4.",
    codeBefore: "for (int i = 0; i ",
    codeAfter: " 5; i++) {\n  Serial.println(i);\n}",
    choices: ["<", "<=", ">", "=="],
    correctChoice: "<",
    explanation:
      "i < 5 stays true for 0, 1, 2, 3 and 4 - five passes. i <= 5 would also run for 5 (six passes), > would " +
      "be false straight away, and == 5 is false when i starts at 0, so that loop wouldn't run at all.",
  },

  "l5-4": {
    id: "quiz-predict-while",
    type: "predict",
    topic: "while Loops",
    title: "Predict the Output",
    prompt: "What will this print?",
    code: "int n = 1;\nwhile (n < 20) {\n  n = n * 3;\n}\nSerial.println(n);",
    options: ["9", "20", "27", "81"],
    correctIndex: 2,
    explanation:
      "n goes 1 → 3 → 9 → 27. Each time, the condition is checked first: 9 < 20 is true, so it triples once " +
      "more to 27. Then 27 < 20 is false and the loop stops - so it prints 27, not 20.",
  },

  "l5-5": {
    id: "quiz-match-functions",
    type: "match",
    topic: "Functions",
    title: "Match the Pairs",
    prompt: "Match each part of a function to what it does.",
    pairs: [
      { left: "A parameter", right: "A variable that gets its value from the call" },
      { left: "return", right: "Hands a value back and ends the function" },
      { left: "void", right: "Says the function doesn't hand anything back" },
      { left: "blinkTimes(3);", right: "Runs the function with times set to 3" },
    ],
  },

  "l5-6": {
    id: "quiz-predict-millis",
    type: "predict",
    topic: "millis() Timing",
    title: "Predict the Output",
    prompt: "What will this print?",
    code: "unsigned long start = millis();\ndelay(250);\nSerial.println(millis() - start);",
    options: ["0", "250", "1000", "-250"],
    correctIndex: 1,
    explanation:
      "start remembers the time before the delay. After delay(250), millis() has moved on by 250, so the " +
      "difference is 250. That subtraction - now minus then - is the whole trick behind timing with millis().",
  },
});

// ---- Checkpoints for the lessons added in the 2.0 curriculum (foundations.js) ----
Object.assign(quizzes, {
  "m3-4": {
    id: "quiz-predict-remainder",
    type: "predict",
    topic: "Operators",
    title: "Predict the Output",
    prompt: "What will this print?",
    code: "int x = 17;\nSerial.println(x % 5);",
    options: ["3", "2", "3.4", "17"],
    correctIndex: 1,
    explanation:
      "% gives the remainder: 5 goes into 17 three times (15), with 2 left over. 17 / 5 would print 3, the " +
      "number of whole times it fits - and with two ints there are never any decimals.",
  },
});

// ---- Checkpoint for the rebuilt digitalRead() lesson (Module 4) ----
Object.assign(quizzes, {
  "l2-5": {
    id: "quiz-debug-read-compare",
    type: "debug",
    topic: "digitalRead()",
    title: "Find the Bug",
    prompt: "This should print \"Pressed!\" only while the button on pin 7 is pressed - but it prints it all the time. Click the line with the bug.",
    lines: [
      "void setup() {",
      "  Serial.begin(9600);",
      "  pinMode(7, INPUT);",
      "}",
      "",
      "void loop() {",
      "  int state = digitalRead(7);",
      "  if (state = HIGH) {",
      "    Serial.println(\"Pressed!\");",
      "  }",
      "}",
    ],
    buggyLineIndex: 7,
    explanation:
      "One = stores a value: state = HIGH sets state to HIGH, and the if sees HIGH (1) - true, every time. " +
      "Comparing needs two: state == HIGH. (The simulator warns about exactly this line.)",
    fixedLine: "  if (state == HIGH) {",
  },
});

// ---- Checkpoints for Modules 0-2: questions about understanding, not recall ----
// Each wrong option says exactly why it's wrong (see "questions" in quiz.js).
// A question with `output` has its code run by the tests, so the stated
// output is always what the simulator really prints.
const q = (title, topic, questions) => ({ type: "questions", title, topic, questions });

Object.assign(quizzes, {
  "l1-1": { id: "quiz-q-what-is-arduino", ...q("Check Your Understanding", "What an Arduino is", [
    { q: "You send a sketch to an Arduino, then unplug it from your computer and power it from a battery. What happens to the sketch?",
      options: ["It's lost - it lives on the computer", "It keeps running - it's stored on the board", "It runs once, then stops", "It waits until the computer is plugged back in"],
      answer: 1,
      why: [
        "The computer is only used to write and send the sketch. Once sent, it's stored on the board itself.",
        "The sketch is stored on the board, so the board runs it whenever it has power - no computer needed.",
        "An Arduino runs its sketch over and over, for as long as it has power.",
        "It doesn't need the computer at all once the sketch is on it.",
      ] },
    { q: "Which job is an Arduino a good fit for?",
      options: ["Editing videos", "Switching a fan on when a room gets too hot", "Browsing the web", "Running a 3D video game"],
      answer: 1,
      why: [
        "Video editing needs a powerful computer with lots of memory and a screen.",
        "Sense something (temperature), decide, act (run a motor) - exactly what an Arduino is for.",
        "An Arduino has no screen, no web browser and no internet connection of its own.",
        "Games need a fast computer and a screen; an Arduino has neither.",
      ] },
  ]) },

  "l1-2": { id: "quiz-q-microcontroller", ...q("Check Your Understanding", "Microcontrollers", [
    { q: "A sketch keeps count of how many times a button has been pressed. The board is unplugged and plugged back in. What happens?",
      options: [
        "The sketch and the count are both gone",
        "The sketch runs again, but the count starts from the beginning",
        "Both the sketch and the count carry on where they were",
        "The board needs a new sketch",
      ],
      answer: 1,
      why: [
        "The sketch is in flash memory, which keeps it with the power off.",
        "The sketch is safe in flash memory, but the count was in RAM - and RAM is cleared when the power goes.",
        "Values the sketch is using live in RAM, which is cleared when the power goes off.",
        "The sketch is still in flash memory; it starts again by itself.",
      ] },
    { q: "Why does a microcontroller start working almost instantly, when a laptop takes a minute?",
      options: [
        "It has no operating system to load - it just starts its one program",
        "It's faster than a laptop",
        "It keeps running even when it's switched off",
        "It skips reading its memory",
      ],
      answer: 0,
      why: [
        "A laptop loads a whole operating system first; a microcontroller has only your sketch to start.",
        "It's actually far slower: 16 MHz against a laptop's thousands of MHz.",
        "With no power it stops completely - it just starts again quickly.",
        "It reads your sketch from its memory every time; there's just very little to load.",
      ] },
  ]) },

  "m0-3": { id: "quiz-q-input-output", ...q("Check Your Understanding", "Inputs and Outputs", [
    { q: "A doorbell lights up when someone stands within a metre of it. What is the DECISION part?",
      options: ["The distance sensor", "The light", "The code checking \"is someone closer than 1 metre?\"", "The person"],
      answer: 2,
      why: [
        "The sensor measures the distance - it's the input.",
        "The light acts on the world - it's the output.",
        "The decision is the code that uses the input to choose what the output does.",
        "The person is what's being sensed, not part of the system.",
      ] },
    { q: "Which of these is an OUTPUT?",
      options: ["A temperature sensor", "A push button", "A buzzer", "A light sensor"],
      answer: 2,
      why: [
        "It measures something - an input.",
        "The Arduino reads whether it's pressed - an input.",
        "A buzzer makes a sound: it acts on the world, so it's an output.",
        "It measures brightness - an input.",
      ] },
    { q: "A plant-watering system works. You want it to warn you when its water tank is empty. What do you need to add?",
      options: [
        "Only an output, like a buzzer",
        "An input to sense the water level, a decision in the code, and an output to warn you",
        "Only more code",
        "A second Arduino",
      ],
      answer: 1,
      why: [
        "A buzzer alone can't know when the tank is empty - something has to sense the water level.",
        "A new behaviour needs all three parts: sense the tank, decide it's empty, then warn.",
        "Code can only decide using information from an input - and nothing measures the tank yet.",
        "One Arduino can handle many inputs and outputs at once.",
      ] },
  ]) },

  "l1-12": { id: "quiz-q-board-pins", ...q("Check Your Understanding", "The Arduino board", [
    { q: "A light sensor gives a voltage anywhere between 0V and 5V. Which pin should read it?",
      options: ["Pin 7", "A0", "5V", "GND"],
      answer: 1,
      why: [
        "A digital pin only reports HIGH or LOW - it would throw away everything in between.",
        "Analog pins measure any voltage from 0 to 5V as a number - exactly right for a sensor like this.",
        "5V is a power supply, not something your code can read from.",
        "GND is the 0V return path, not an input.",
      ] },
    { q: "You're using the Serial Monitor. Which pins should you leave free?",
      options: ["Pins 0 and 1", "Pins 12 and 13", "A0 and A1", "5V and GND"],
      answer: 0,
      why: [
        "Pins 0 and 1 carry the USB connection's data - parts on them interfere with the Serial Monitor.",
        "Pins 12 and 13 are free to use (13 also has the built-in LED).",
        "The analog pins aren't used by the USB connection.",
        "5V and GND are power pins - parts use them all the time.",
      ] },
  ]) },

  "m0-5": { id: "quiz-q-simulator", ...q("Check Your Understanding", "The Simulator", [
    { q: "You press Run, and the Serial Monitor says \"SYNTAX ERROR · LINE 4\". What has happened?",
      options: [
        "The circuit is wired wrong",
        "There's a typing mistake around line 4, so nothing has run yet",
        "The sketch ran, then crashed at line 4",
        "The simulator is broken",
      ],
      answer: 1,
      why: [
        "Wiring problems never show up as syntax errors - Check Circuit reports those.",
        "A syntax error means the code breaks the language's rules, so it can't run at all until it's fixed.",
        "A syntax error is found BEFORE anything runs. (A problem while running is a runtime error.)",
        "It's reporting a mistake in the code - fix line 4 and it runs.",
      ] },
    { q: "The simulator lights an LED that has no resistor. What would a real LED do?",
      options: ["Light the same", "Probably burn out - the simulator doesn't calculate current", "Not light at all", "Light more dimly"],
      answer: 1,
      why: [
        "The simulator only looks the same because it doesn't calculate current.",
        "Without a resistor nothing limits the current, so a real LED burns out - which is why Check Circuit warns you.",
        "A real one would light - very brightly, and only briefly.",
        "It would be far brighter, then dead.",
      ] },
  ]) },

  "m1-1": { id: "quiz-q-electricity", ...q("Check Your Understanding", "Electricity", [
    { q: "What is the electricity in a circuit, actually?",
      options: ["Heat travelling along the wire", "Electric charge moving through a conductor", "Light inside the wire", "Air flowing through the wire"],
      answer: 1,
      why: [
        "Wires can get warm, but the heat is a side-effect, not the electricity.",
        "Electricity in a circuit is charge (carried by electrons) moving through a conductor like copper.",
        "Nothing glows inside a wire - LEDs make light from the current.",
        "There's no air flowing in a wire - it's solid metal.",
      ] },
    { q: "Which of these would let current flow between two wires?",
      options: ["A plastic ruler", "A rubber band", "A metal paper clip", "A sheet of paper"],
      answer: 2,
      why: [
        "Plastic is an insulator.",
        "Rubber is an insulator.",
        "Metal is a conductor - a paper clip would join the two wires.",
        "Dry paper is an insulator.",
      ] },
  ]) },

  "l1-13": { id: "quiz-q-voltage", ...q("Check Your Understanding", "Voltage", [
    { q: "A sensor says \"3.3V only\". Which Uno pin should power it?",
      options: ["5V", "3.3V", "Pin 13 set HIGH", "Vin"],
      answer: 1,
      why: [
        "5V pushes harder than the sensor was made for, and can damage it.",
        "The Uno has a 3.3V pin for exactly these parts.",
        "A HIGH pin gives about 5V - too much, and a pin isn't meant to power parts.",
        "Vin is the board's raw input supply, usually 7V or more - far too much.",
      ] },
    { q: "\"Pin 9 is at 5V\". 5V compared to what?",
      options: ["Compared to GND", "Compared to the USB cable", "Compared to pin 10", "Compared to nothing - it's just 5V"],
      answer: 0,
      why: [
        "Every voltage on the board is measured from GND, the 0V point.",
        "The USB cable supplies the power, but voltages are measured from GND.",
        "Pin 10 could be at any voltage - GND is the fixed reference.",
        "A voltage is always between two points; on an Arduino the second point is GND.",
      ] },
  ]) },

  "m1-2": { id: "quiz-q-current", ...q("Check Your Understanding", "Current", [
    { q: "Which of these can an Arduino pin power safely, on its own?",
      options: ["One LED drawing 15 mA", "A motor drawing 250 mA", "A phone charging at 1000 mA", "Ten LEDs in parallel from one pin"],
      answer: 0,
      why: [
        "15 mA is under a pin's 20 mA safe limit.",
        "250 mA is more than twelve times the limit - motors need a driver and their own supply.",
        "Fifty times the limit - and a phone needs far more than a pin can give.",
        "Ten LEDs from one pin would ask for around 150 mA - far over the limit.",
      ] },
    { q: "10 mA leaves the 5V pin and goes through an LED. How much flows back into GND?",
      options: ["0 mA - the LED used it up", "5 mA", "10 mA", "20 mA"],
      answer: 2,
      why: [
        "Current isn't used up - the LED uses energy, but the same flow of charge comes out the other side.",
        "None of it disappears along the way.",
        "In a single loop the current is the same everywhere: 10 mA out, 10 mA back.",
        "Current can't increase on its own - the same 10 mA flows all the way round.",
      ] },
  ]) },

  "m1-3": { id: "quiz-q-ohms-law", ...q("Check Your Understanding", "Ohm's Law", [
    { q: "A red LED (about 2V) is on a 5V pin with a 330Ω resistor. About how much current flows?",
      options: ["About 15 mA", "About 9 mA", "About 6 mA", "About 30 mA"],
      answer: 1,
      why: [
        "That would be 5V ÷ 330Ω - but the LED uses 2V, leaving only 3V for the resistor.",
        "3V ÷ 330Ω = 0.0091 A - about 9 mA.",
        "That's 2V ÷ 330Ω - but it's the 3V left over that's across the resistor.",
        "More resistance gives LESS current, not more.",
      ] },
    { q: "You need about 10 mA through a red LED from 5V. Which resistor?",
      options: ["33Ω", "300Ω (330Ω is the nearest standard value)", "3000Ω", "30Ω"],
      answer: 1,
      why: [
        "3V ÷ 33Ω would be about 90 mA - far too much.",
        "resistance = 3V ÷ 0.010 A = 300Ω; the nearest standard value, 330Ω, gives about 9 mA.",
        "3V ÷ 3000Ω is 1 mA - safe, but very dim.",
        "3V ÷ 30Ω is 100 mA - it would destroy the LED and the pin.",
      ] },
  ]) },

  "m1-5": { id: "quiz-q-open-closed", ...q("Check Your Understanding", "Open and Closed Circuits", [
    { q: "Which of these is a closed circuit?",
      options: [
        "5V → resistor → LED, with the LED's − leg not connected",
        "5V → resistor → LED → GND",
        "5V → resistor, and nothing else",
        "GND → LED, with nothing connected to its + leg",
      ],
      answer: 1,
      why: [
        "The loop never gets back to GND - it's open.",
        "It's a complete loop from 5V back to GND, so current can flow.",
        "There's no path back to GND at all.",
        "Nothing is pushing current into the LED - there's no path from 5V.",
      ] },
    { q: "A circuit stops working. The fault turns out to be a loose wire at the very end, next to GND - after every part. Why did EVERYTHING stop?",
      options: [
        "Because current is used up by the parts",
        "Because a gap anywhere in a loop stops the current everywhere in it",
        "Because GND has to be the first connection",
        "It shouldn't have - only the last part should stop",
      ],
      answer: 1,
      why: [
        "Current isn't used up - it's the same all the way round the loop.",
        "One gap opens the whole loop, so no current flows anywhere in it.",
        "The order of connections doesn't matter - the loop just has to be complete.",
        "Every part in a single loop depends on the whole loop being complete.",
      ] },
  ]) },

  "m1-4": { id: "quiz-q-ground", ...q("Check Your Understanding", "Ground", [
    { q: "You accidentally connect 5V straight to GND with a bare wire. What is that, and why is it a problem?",
      options: [
        "An open circuit - nothing flows",
        "A short circuit - nothing limits the current, which can damage the board or the USB port",
        "A normal circuit - it's fine",
        "A parallel circuit - it just shares the current",
      ],
      answer: 1,
      why: [
        "The loop IS complete - that's the problem.",
        "With no part in the loop, nothing limits the current, so far too much flows.",
        "A loop with nothing in it is never fine - it's a short circuit.",
        "It's not about sharing: a bare wire lets as much current flow as the supply can push.",
      ] },
    { q: "A sensor has its own battery. Its signal goes to an Arduino pin, but the readings are nonsense. What's the likely fix?",
      options: ["Use a bigger battery", "Connect the battery's − to the Arduino's GND", "Use a different pin", "Add a resistor to the signal wire"],
      answer: 1,
      why: [
        "The battery is fine - the two sides just don't share a 0V point.",
        "Two power sources must share a GND, so they agree on what 0V (and so HIGH and LOW) means.",
        "Any pin would have the same problem without a shared GND.",
        "A resistor doesn't give the two sides a common 0V point.",
      ] },
  ]) },

  "m1-8": { id: "quiz-q-series-parallel", ...q("Check Your Understanding", "Series and Parallel", [
    { q: "Fairy lights wired in series: one bulb breaks. What happens?",
      options: ["Only that bulb goes out", "They all go out", "The others get brighter", "Nothing - bulbs don't affect each other"],
      answer: 1,
      why: [
        "That's what happens in PARALLEL, where each bulb has its own path.",
        "In series there's only one path, so one broken bulb opens the whole loop.",
        "With the loop open, no current flows at all.",
        "In series they all share one path - they depend on each other completely.",
      ] },
    { q: "Why does each LED in a parallel circuit get its own resistor?",
      options: [
        "So each LED's current is limited separately, and they share it evenly",
        "Because resistors only work in series",
        "To make the circuit cheaper",
        "So the LEDs are dimmer",
      ],
      answer: 0,
      why: [
        "With one shared resistor, the LEDs won't share the current evenly; a resistor each controls each LED's current.",
        "Each resistor IS in series - with its own LED, in its own branch.",
        "It actually costs more parts - but it works properly.",
        "The point is the right current for each, not dimness.",
      ] },
  ]) },

  "l1-16": { id: "quiz-q-breadboard", ...q("Check Your Understanding", "Breadboards", [
    { q: "Two wires are in the same 5-hole column, on the same side of the trench. Are they connected?",
      options: ["Yes - the column's holes are joined inside", "No - every hole is separate", "Only if a part is between them", "Only on the power rails"],
      answer: 0,
      why: [
        "Each 5-hole column is one metal strip, so anything in it is connected.",
        "Holes in the same column are joined - that's the point of a breadboard.",
        "No part is needed: the strip joins them.",
        "The rails are connected too, but so are the 5-hole columns.",
      ] },
    { q: "A resistor's leg is in a column on the top half. The LED's leg is in the column directly below it, across the trench. Are they connected?",
      options: ["Yes - it's the same column", "No - the trench separates the top half from the bottom half", "Yes - all holes in a straight line are joined", "Only if the rails are connected"],
      answer: 1,
      why: [
        "It looks like the same column, but the trench splits every column in two.",
        "The trench breaks the strips: top and bottom are separate. A wire has to cross it.",
        "Only the 5 holes of one half-column are joined.",
        "The rails have nothing to do with the middle columns.",
      ] },
  ]) },

  "m1-6": { id: "quiz-q-led-resistor", ...q("Check Your Understanding", "LEDs and Resistors", [
    { q: "An LED's short leg goes to 5V and its long leg (through a resistor) goes to GND. What happens?",
      options: ["It lights normally", "It stays dark - it's backwards", "It burns out", "It lights dimly"],
      answer: 1,
      why: [
        "An LED only conducts from its long leg (+) to its short leg (−).",
        "Backwards, it blocks the current completely, so it stays dark - turn it round.",
        "Backwards, no current flows, so there's nothing to burn it out.",
        "There's no in-between: backwards, it blocks the current.",
      ] },
    { q: "Why does an LED need a resistor at all?",
      options: [
        "To make it light up",
        "An LED barely limits current by itself - the resistor keeps it to a safe level",
        "So the LED knows which way round it is",
        "Resistors make LEDs brighter",
      ],
      answer: 1,
      why: [
        "It lights without one - very briefly, before it burns out.",
        "With almost no resistance of its own, an LED would take far too much current. The resistor sets a safe current.",
        "Polarity depends on the legs, not the resistor.",
        "A resistor reduces current, so it never makes an LED brighter.",
      ] },
  ]) },

  "m1-7": { id: "quiz-q-polarity", ...q("Check Your Understanding", "Polarity", [
    { q: "Which of these parts works either way round?",
      options: ["An LED", "A buzzer", "A resistor", "An RGB LED"],
      answer: 2,
      why: [
        "LEDs are polarized: long leg +, short leg −.",
        "Buzzers are polarized: + is marked.",
        "A resistor isn't polarized - it works the same either way.",
        "An RGB LED is polarized too.",
      ] },
    { q: "Your LED circuit doesn't light, and the Serial Monitor shows no error. What do you check first?",
      options: ["Rewrite the code", "The wiring: polarity, the path to GND, and every connection", "Restart the computer", "Add more delay()"],
      answer: 1,
      why: [
        "Wiring mistakes never cause an error message - the code may be fine.",
        "No error means the code ran. A dark LED with working code is almost always a wiring fault.",
        "Nothing is wrong with the computer.",
        "A delay changes timing, not whether the LED can light at all.",
      ] },
  ]) },

  "l1-10": { id: "quiz-q-serial", ...q("Check Your Understanding", "The Serial Monitor", [
    { q: "What does this sketch print?",
      code: "void setup() {\n  Serial.begin(9600);\n  Serial.print(\"Hi \");\n  Serial.println(\"there\");\n  Serial.print(\"!\");\n}\n\nvoid loop() {\n}",
      output: "Hi there\n!",
      options: ["Hi there!", "Hi there, then ! on the next line", "Hi, there and ! on three lines", "Nothing - loop() is empty"],
      answer: 1,
      why: [
        "println(\"there\") ends the line, so the ! starts a new one.",
        "print continues the line, println ends it - so \"Hi there\" is one line and \"!\" the next.",
        "Only println starts a new line; print(\"Hi \") doesn't.",
        "It all happens in setup(), which runs once - loop() being empty doesn't matter.",
      ] },
    { q: "A sketch prints in setup(), but nothing ever appears in the Serial Monitor. What's the most likely mistake?",
      options: ["Serial.begin(9600) is missing", "loop() is empty", "The text has no quotes", "It uses println instead of print"],
      answer: 0,
      why: [
        "Without Serial.begin(), the connection is never started, so nothing is sent.",
        "An empty loop() doesn't stop setup() printing.",
        "Without quotes it wouldn't compile - you'd see an error, not silence.",
        "println works just like print, plus a new line.",
      ] },
  ]) },

  "l1-5": { id: "quiz-q-setup", ...q("Check Your Understanding", "setup() and loop()", [
    { q: "A sketch has Serial.println(\"Hi\") in setup() and nothing in loop(). It runs for a minute. How many times does \"Hi\" appear?",
      options: ["Once", "Once a second", "Thousands of times", "Never"],
      answer: 0,
      why: [
        "setup() runs exactly once each time the board starts.",
        "Nothing repeats it - only loop() repeats.",
        "Only code in loop() repeats.",
        "setup() always runs once at the start.",
      ] },
    { q: "Which of these belongs in setup()?",
      options: ["Checking a sensor reading", "Serial.begin(9600)", "Blinking an LED over and over", "Counting button presses"],
      answer: 1,
      why: [
        "Checking a sensor has to keep happening - that's loop().",
        "Starting the Serial Monitor only needs doing once, so it goes in setup().",
        "Anything over and over belongs in loop().",
        "Counting has to keep happening as presses come in - loop().",
      ] },
  ]) },

  "l1-6": { id: "quiz-q-loop", ...q("Check Your Understanding", "setup() and loop()", [
    { q: "What does this print in its first 5 seconds?",
      code: "void setup() {\n  Serial.begin(9600);\n  Serial.println(\"Go\");\n}\n\nvoid loop() {\n  Serial.println(\"Tick\");\n  delay(2000);\n}",
      output: "Go\nTick\nTick\nTick", ms: 5000,
      options: ["Go, then Tick three times", "Go, then Tick twice", "Tick, Go, Tick", "Go, Tick, Go, Tick"],
      answer: 0,
      why: [
        "Go once; then Tick at 0 s, 2 s and 4 s - three Ticks within 5 seconds.",
        "Count again: loop() prints straight away, then at 2 s and at 4 s.",
        "setup() always finishes before loop() starts, so Go comes first.",
        "Go is in setup(), so it only appears once.",
      ] },
    { q: "You delete the delay() from loop(). What changes?",
      options: ["Nothing", "Tick pours out as fast as the board can print it", "Tick stops appearing", "The sketch won't compile"],
      answer: 1,
      why: [
        "The delay was the only thing slowing loop() down.",
        "Without a pause, loop() repeats thousands of times a second.",
        "loop() still runs - just much faster.",
        "delay() is optional; removing it is perfectly valid.",
      ] },
  ]) },

  "l2-3": { id: "quiz-q-digitalwrite", ...q("Check Your Understanding", "digitalWrite()", [
    { q: "An LED is on pin 9 with a resistor, and setup() has pinMode(9, OUTPUT). What lights it?",
      options: ["digitalWrite(9, HIGH);", "digitalWrite(9, LOW);", "digitalRead(9);", "pinMode(9, HIGH);"],
      answer: 0,
      why: [
        "HIGH puts about 5V on pin 9, so current flows through the LED.",
        "LOW is 0V - no push, so no current.",
        "digitalRead() reads an input; it doesn't switch anything.",
        "pinMode() takes OUTPUT or INPUT, not HIGH.",
      ] },
    { q: "setup() runs digitalWrite(13, HIGH), and loop() is empty. What does the LED on pin 13 do?",
      options: ["Flashes once", "Stays on", "Turns on, then off", "Nothing - loop() is empty"],
      answer: 1,
      why: [
        "Nothing ever switches it off again.",
        "A pin keeps its level until your code changes it - so it stays on.",
        "There's no LOW anywhere.",
        "An empty loop() doesn't undo what setup() did.",
      ] },
  ]) },

  "m2-8": { id: "quiz-q-delay", ...q("Check Your Understanding", "delay()", [
    { q: "An LED should stay ON for 2 seconds and OFF for 1 second, over and over. Which timing values?",
      code: "digitalWrite(13, HIGH);\ndelay(?);\ndigitalWrite(13, LOW);\ndelay(?);",
      options: ["delay(2) and delay(1)", "delay(2000) and delay(1000)", "delay(1000) and delay(2000)", "delay(200) and delay(100)"],
      answer: 1,
      why: [
        "delay() counts in milliseconds - 2 is just 2 thousandths of a second.",
        "2 seconds is 2000 ms (after HIGH), and 1 second is 1000 ms (after LOW).",
        "That's backwards: the first delay comes after HIGH, so it's the ON time.",
        "200 ms and 100 ms are a fifth and a tenth of a second.",
      ] },
    { q: "A sketch does delay(5000). What can the Arduino do during those 5 seconds?",
      options: ["Keep checking a button", "Nothing - the sketch just waits", "Run loop() again", "Read sensors in the background"],
      answer: 1,
      why: [
        "During delay(), no other code of yours runs - so it can't check the button.",
        "delay() pauses the whole sketch. (Module 4 shows millis(), which avoids this.)",
        "loop() can't restart until the delay has finished.",
        "Nothing runs in the background - only after the delay ends.",
      ] },
  ]) },

  "l2-4": { id: "quiz-q-blink", ...q("Check Your Understanding", "Blink", [
    { q: "How do you make an LED blink twice as fast?",
      options: ["Halve both delay() values", "Double both delay() values", "Add a second digitalWrite(HIGH)", "Put pinMode() in loop()"],
      answer: 0,
      why: [
        "Shorter waits mean each on and off is shorter - so it blinks faster.",
        "Longer delays make it blink SLOWER.",
        "Writing HIGH twice doesn't change the timing.",
        "pinMode() only needs doing once - it has nothing to do with speed.",
      ] },
    { q: "A blink sketch has delay(1000) after HIGH but no delay after LOW. What do you see?",
      options: ["A normal blink", "The LED looks on all the time", "The LED stays off", "A very fast blink"],
      answer: 1,
      why: [
        "The OFF part needs a wait too.",
        "It's off for only millionths of a second before loop() switches it back on - too short to see.",
        "It's on for a whole second each time round.",
        "The ON time is still a full second - it's the OFF time that has vanished.",
      ] },
  ]) },
});

export function getQuizForLesson(lessonId) {
  return quizzes[lessonId] || null;
}
