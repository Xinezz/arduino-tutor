// Digital Input and Output (level ID 2, taught third - see LEVEL_ORDER in levels.js).

export const level2Lessons = [
  {
    id: "l2-1",
    title: "Digital Signals: HIGH and LOW",
    body: [
      { type: "p", text:
        "A digital signal has only two possible values: on or off. In Arduino code they're called HIGH and LOW." },
      { type: "p", section: "theory", text:
        "On the Uno, HIGH means about 5V and LOW means about 0V - nothing in between. That's what makes a pin " +
        "digital rather than analog (Module 5). HIGH and LOW are just built-in names for the numbers 1 and 0: " +
        "digitalWrite(13, 1) and digitalWrite(13, HIGH) do exactly the same thing. The names make code easier " +
        "to read." },
      { type: "table", head: ["Name", "Number", "Voltage", "For an LED on the pin"], rows: [
        ["HIGH", "1", "about 5V", "On: current flows out through the LED"],
        ["LOW", "0", "about 0V", "Off: no push, so no current"],
      ] },
      { type: "demo", demo: "high-low" },
      { type: "p", text:
        "A pin used as an input (Module 4) works the other way round: the Arduino looks at the voltage arriving " +
        "and decides whether it's HIGH or LOW." },
      { type: "question",
        question: "Which of these could NOT come out of a digital pin?",
        options: ["5V", "0V", "2.5V", "HIGH"],
        answer: 2,
        why: [
          "5V is HIGH - exactly what a digital pin gives when it's on.",
          "0V is LOW - what a digital pin gives when it's off.",
          "",
          "HIGH is one of the two things a digital pin can be.",
        ],
        explain: "A digital pin is either about 5V (HIGH) or about 0V (LOW). In-between levels need a trick called PWM, in Module 5." },
      { type: "predict",
        question: "What does this print?",
        code: "void setup() {\n  Serial.begin(9600);\n  Serial.println(HIGH);\n  Serial.println(LOW);\n}\n\nvoid loop() {\n}",
        options: ["HIGH, then LOW", "1, then 0", "5, then 0", "ON, then OFF"],
        answer: 1,
        output: "1\n0",
        why: [
          "HIGH and LOW are names for numbers - the Serial Monitor prints the numbers.",
          "",
          "They're 1 and 0, not volts - 5V is what HIGH means on the pin, not its value in code.",
          "ON and OFF aren't Arduino words at all.",
        ],
        explain: "HIGH is the number 1 and LOW is the number 0, so that's what gets printed." },
      { type: "p", section: "application", text:
        "Digital signals are everywhere: a light switch is on or off, a door is open or closed, a button is " +
        "pressed or not. Computers store everything - text, photos, music - as long runs of these 1s and 0s, " +
        "called bits." },
      { type: "exercise", kind: "independent",
        task:
          "Sort these into digital (two states) and analog (any value across a range): a light switch, a " +
          "dimmer knob, a door sensor that knows open or closed, a thermometer, a push button.",
        expected:
          "Digital: the light switch, the door sensor and the push button - each has exactly two states. " +
          "Analog: the dimmer knob and the thermometer - they can be anywhere across a range." },
      { type: "note", text:
        "Almost everything you do with pins is controlling and reading these two states - it's the simplest " +
        "possible interaction between code and the physical world, and almost every project builds on it." },
    ],
    summary: [
      "A digital pin has two states: HIGH (about 5V) and LOW (about 0V) - nothing in between.",
      "HIGH and LOW are the numbers 1 and 0 with readable names.",
      "Anything with two states - a switch, a button, a door - is a digital signal.",
    ],
  },

  {
    id: "l2-2",
    title: "pinMode(): Configuring a Pin's Job",
    body: [
      { type: "p", text:
        "Before you can use a pin, you have to tell Arduino what job it's doing: sending power out (OUTPUT) or " +
        "reading a signal in (INPUT). This happens once, in setup()." },
      { type: "code", text:
        "void setup() {\n  pinMode(13, OUTPUT);   // pin 13 will send signals OUT (e.g. to an LED)\n  pinMode(7, INPUT);     // pin 7 will read signals IN (e.g. from a button)\n}" },
      { type: "p", text:
        "Every pin starts as an INPUT when the board powers up. So an LED needs pinMode(pin, OUTPUT) before " +
        "the pin can power it - forget it, and the code still compiles, but the LED won't light properly." },
      { type: "p", section: "theory", text:
        "Why must you choose? Inside the chip, each pin can be connected in two very different ways. As an " +
        "OUTPUT, it's connected to the 5V or 0V supply, so it can push current out to an LED. As an INPUT, it's " +
        "connected to neither: it only measures the voltage arriving, taking almost no current, so it doesn't " +
        "disturb whatever it's measuring. A pin can't be both at once, and the chip can't guess which you mean " +
        "- so you tell it, once, in setup()." },
      { type: "example", code:
        "void setup() {\n  pinMode(13, OUTPUT);       // pin 13's job: power the LED\n  digitalWrite(13, HIGH);    // switch it on (the next lesson explains this line)\n}\n\nvoid loop() {\n}" },
      { type: "guided", title: "See what pinMode() does", steps: [
        "Press \"Load this circuit\" below - an LED with its resistor, wired to pin 13.",
        "Press \"Try it in the editor\" under the example above, then Run. The LED lights.",
        "Press Stop. Delete the pinMode line, and Run again: the LED stays dark, and the Serial Monitor explains why.",
        "Put the pinMode line back.",
      ] },
      { type: "circuit", label: "Load this circuit", parts: [{ key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
        wires: [["pin-13", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
      { type: "predict",
        question: "On a real Uno, an LED is wired to pin 9 and setup() calls digitalWrite(9, HIGH) - but never pinMode(9, OUTPUT). What happens?",
        options: [
          "The LED lights normally",
          "It barely glows, if at all - the pin is still an INPUT",
          "The board resets",
          "A compile error",
        ],
        answer: 1,
        explain:
          "Without pinMode(9, OUTPUT), pin 9 is still an input. Writing HIGH to an input only switches on its " +
          "weak built-in pull-up resistor - far too little current to light an LED properly. It compiles fine, " +
          "which is what makes this bug confusing. (The simulator shows the LED off and warns you.)" },
      { type: "note", text:
        "Engineering analogy: pinMode() is like setting a valve to either \"supply\" or \"sensor\" mode before " +
        "a system runs - you have to decide its role before it can do anything useful." },
      { type: "p", section: "application", text:
        "Every project starts its setup() with a pinMode() line for each part: OUTPUT for LEDs, buzzers and " +
        "motor drivers, INPUT for buttons and sensors. Reading the pinMode() lines is the quickest way to see " +
        "what a sketch is wired to." },
      { type: "exercise", kind: "independent",
        task: "Write the setup() for a project with LEDs on pins 9 and 10, and a button on pin 2.",
        expected: "Three pinMode() lines: pinMode(9, OUTPUT); pinMode(10, OUTPUT); pinMode(2, INPUT); - in any order, inside setup().",
        solution: "void setup() {\n  pinMode(9, OUTPUT);\n  pinMode(10, OUTPUT);\n  pinMode(2, INPUT);\n}\n\nvoid loop() {\n}" },
      { type: "mistakes", items: [
        "Forgetting pinMode(pin, OUTPUT): it compiles, but the LED won't light properly.",
        "A different pin number in pinMode() and digitalWrite() - pinMode(12, OUTPUT) doesn't set up pin 13.",
        "Writing output or Output instead of OUTPUT: Arduino names are case-sensitive.",
      ] },
    ],
    summary: [
      "pinMode(pin, mode) gives a pin its job: OUTPUT to power something, INPUT to read something.",
      "Do it once, in setup(), for every pin you use.",
      "Every pin starts as an INPUT - which is why a forgotten pinMode() leaves an LED dark.",
    ],
  },

  {
    id: "l2-3",
    title: "digitalWrite(): Driving an Output",
    body: [
      { type: "p", text:
        "Once a pin is set to OUTPUT, digitalWrite() sets it to HIGH or LOW, which sends (or stops sending) " +
        "roughly 5V out of that pin." },
      { type: "code", text:
        "digitalWrite(13, HIGH);   // pin 13 now outputs ~5V\ndigitalWrite(13, LOW);    // pin 13 now outputs ~0V" },
      { type: "p", text:
        "A pin keeps its level until your code changes it. Set it HIGH in setup() and it stays HIGH forever - " +
        "even if loop() is empty." },
      { type: "example", code:
        "void setup() {\n  pinMode(12, OUTPUT);\n  pinMode(13, OUTPUT);\n  digitalWrite(12, HIGH);   // the LED on pin 12: on\n  digitalWrite(13, LOW);    // the LED on pin 13: off\n}\n\nvoid loop() {\n}" },
      { type: "circuit", label: "Load the two-LED circuit", parts: [
        { key: "r1", kind: "resistor" }, { key: "led1", kind: "led" },
        { key: "r2", kind: "resistor" }, { key: "led2", kind: "led" },
      ], wires: [
        ["pin-12", "r1.1"], ["r1.2", "led1.a"], ["led1.k", "gnd"],
        ["pin-13", "r2.1"], ["r2.2", "led2.a"], ["led2.k", "gnd"],
      ] },
      { type: "predict",
        question: "With that circuit and sketch, which LED lights?",
        options: ["Only the LED on pin 12", "Only the LED on pin 13", "Both", "Neither - loop() is empty"],
        answer: 0,
        explain:
          "digitalWrite(12, HIGH) puts 5V on pin 12, so its LED lights. Pin 13 is LOW - 0V, no current - so its " +
          "LED stays dark. An empty loop() doesn't matter: each pin keeps the level setup() gave it." },
      { type: "guided", title: "Switch two LEDs", steps: [
        "Press \"Load the two-LED circuit\", then \"Try it in the editor\" under the example.",
        "Run it and check your prediction.",
        "Stop, swap HIGH and LOW in the two digitalWrite lines, and run it again.",
      ] },
      { type: "experiment", text:
        "Make both LEDs light at once. Then try digitalWrite(12, LOW) straight after digitalWrite(12, HIGH) in " +
        "setup() - the LED is on for a few millionths of a second, far too short to see. The next lessons fix " +
        "that with delay()." },
      { type: "p", section: "application", text:
        "Every on/off output in a project is a digitalWrite(): a warning light, an alarm buzzer, the relay that " +
        "switches a pump. The traffic light you'll build in Module 7 is three LEDs and a few digitalWrite()s." },
      { type: "exercise", kind: "independent",
        task:
          "Three LEDs are wired to pins 11, 12 and 13, each with its own resistor. Write a sketch that lights " +
          "only the middle one.",
        expected: "Only the LED on pin 12 lights; 11 and 13 stay dark. All three pins are set as OUTPUT, and only pin 12 is HIGH.",
        solution: "void setup() {\n  pinMode(11, OUTPUT);\n  pinMode(12, OUTPUT);\n  pinMode(13, OUTPUT);\n  digitalWrite(11, LOW);\n  digitalWrite(12, HIGH);\n  digitalWrite(13, LOW);\n}\n\nvoid loop() {\n}" },
      { type: "mistakes", items: [
        "Calling digitalWrite() on a pin that was never set as OUTPUT.",
        "Using one pin number in pinMode() and a different one in digitalWrite().",
        "Expecting LOW to mean \"dimmer\": digitalWrite is all or nothing - fully on or fully off. Dimming needs analogWrite() (Module 5).",
      ] },
    ],
    summary: [
      "digitalWrite(pin, HIGH) puts about 5V on an OUTPUT pin; LOW puts 0V.",
      "A pin stays at that level until your code changes it.",
      "It's all or nothing - for anything in between you'll use analogWrite() in Module 5.",
    ],
  },

  {
    id: "l2-4",
    title: "Making an LED Blink",
    body: [
      { type: "p", text:
        "You now know every piece: how to wire an LED safely (Module 1), how to set a pin up with pinMode(), " +
        "switch it with digitalWrite(), and wait with delay(). Put them together and you get the most famous " +
        "sketch in electronics: Blink." },
      { type: "diagram", diagram: "blink-timing", caption: "A blink is just a pin switching HIGH and LOW, with a wait after each." },
      { type: "guided", title: "Wire the LED", steps: [
        "Add an LED and a resistor from the parts list under the code editor.",
        "Wire pin 13 (top edge of the Arduino) to one leg of the resistor.",
        "Wire the resistor's other leg to the LED's + leg (the long one).",
        "Wire the LED's − leg to GND.",
        "Press Check Circuit - it should report a complete circuit: pin 13 → resistor → LED → GND.",
      ] },
      { type: "example", code:
        "void setup() {\n  pinMode(13, OUTPUT);     // pin 13 will power the LED\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);  // on\n  delay(1000);             // stay on for 1 second\n  digitalWrite(13, LOW);   // off\n  delay(1000);             // stay off for 1 second\n}" },
      { type: "p", text:
        "setup() makes pin 13 an output, once. Then loop() switches it on, waits a second, switches it off, " +
        "waits another second - and starts again from the top, forever." },
      { type: "predict",
        question: "How long does one complete blink - on and then off - take?",
        options: ["1 second", "2 seconds", "Half a second", "It depends on the board"],
        answer: 1,
        explain:
          "1000 ms on plus 1000 ms off is 2000 ms - two seconds - before loop() starts the next blink." },
      { type: "experiment", text:
        "Change both delays to 100, then try 1000 on and 100 off. Can you make it look like a heartbeat - two " +
        "quick flashes, then a pause?" },
      { type: "p", section: "application", text:
        "Blinking lights are everywhere: a smoke alarm's status LED, a car's indicators, a router's activity " +
        "light, the beacon on top of a crane. Each one is this same pattern - on, wait, off, wait - with its " +
        "own timings." },
      { type: "exercise", kind: "debug",
        task:
          "This should blink once a second, but the LED looks like it's on all the time. Try it, find the bug, " +
          "and fix it.",
        code: "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n}",
        hint: "How long does the LED stay off, before loop() switches it back on?",
        expected:
          "After digitalWrite(13, LOW), loop() starts again at once and switches the LED straight back on - it's " +
          "off for only a few millionths of a second. Adding delay(1000) after the LOW line makes it blink: one " +
          "second on, one second off.",
        solution: "void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}" },
      { type: "mistakes", items: [
        "Only one delay: the LED switches off and straight back on again, so it looks permanently lit.",
        "Forgetting pinMode(13, OUTPUT): the pin can't power the LED, so it stays dark (the simulator warns you).",
      ] },
      { type: "action", action: "first-circuit", label: "Open the guided first circuit", text:
        "Prefer to be walked through it? The guided first circuit builds exactly this, one wire at a time, " +
        "in Free Practice." },
    ],
    summary: [
      "A blink is pinMode() once, then HIGH, wait, LOW, wait - repeated by loop().",
      "Both waits matter: without the second one, the LED is off too briefly to see.",
      "Changing the two delay() values changes how fast it blinks, and how long it's on and off.",
    ],
    challenge: {
      id: "c3",
      title: "Blink an LED",
      difficulty: "medium",
      prompt:
        "Write a sketch that blinks an LED on pin 13 - on for half a second, off for half a second, " +
        "repeating forever. Wire it on the board below first: pin 13 -> resistor -> LED long leg (+), " +
        "LED short leg (-) -> GND. (Check Circuit tells you if anything's wrong.)\n\n" +
        "Before you write any code, answer this for yourself: what information does the Arduino need to " +
        "know before it can turn something on or off, and which function configures that?",
      hints: [
        "Concept hint: \"blinking\" is just alternating between two states over and over, with a pause " +
          "between each change - which built-in loop structure already does something \"over and over\" " +
          "for you without extra code?",
        "Function hint: you need pinMode() once in setup() to declare the pin as OUTPUT, then " +
          "digitalWrite() and delay() in loop(), called twice each (once for on, once for off).",
        "Example hint: digitalWrite(13, HIGH); delay(500); turns the LED on and holds that state for " +
          "500ms before the next line runs. What would the mirror-image two lines look like for turning " +
          "it off?",
      ],
      solution:
        "int ledPin = 13;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(ledPin, HIGH);\n  delay(500);\n  digitalWrite(ledPin, LOW);\n  delay(500);\n}",
      explain: [
        "pinMode(ledPin, OUTPUT) runs once in setup(), configuring pin 13 to send power out - without " +
          "this, digitalWrite() on that pin would have no effect.",
        "digitalWrite(ledPin, HIGH) followed by delay(500) turns the LED on and holds that state for " +
          "half a second before the next line executes.",
        "digitalWrite(ledPin, LOW) followed by delay(500) turns it off for another half second, and " +
          "then loop() runs again from the top - repeating forever.",
      ],
    },
  },

  {
    id: "l2-5",
    title: "digitalRead(): Sensing an Input",
    body: [
      { type: "p", text:
        "digitalRead() checks the current voltage on a pin configured as INPUT and returns either HIGH " +
        "or LOW - this is how you read a button, switch, or any other simple on/off sensor." },
      { type: "code", text:
        "int buttonState = digitalRead(7);\n\nif (buttonState == HIGH) {\n  // pin 7 is currently reading ~5V\n}" },
      { type: "p", text:
        "Notice digitalRead() returns a value rather than taking an action - you almost always store " +
        "that value in a variable, then decide what to do with it - usually with an if, exactly as in " +
        "Module 3 (Programming Fundamentals)." },
      { type: "p", text:
        "A button needs a little help to give a clean reading: while it isn't pressed, something has to hold " +
        "the pin at LOW. In the circuit below that's the 10kΩ resistor from pin 7 to GND - a pull-down " +
        "resistor. Lesson 4.3 explains why it's needed; for now, just use it." },
      { type: "example", code:
        "void setup() {\n  Serial.begin(9600);\n  pinMode(7, INPUT);\n}\n\nvoid loop() {\n  int state = digitalRead(7);\n  Serial.println(state);   // 1 = HIGH (pressed), 0 = LOW (not pressed)\n  delay(200);\n}" },
      { type: "circuit", label: "Load the button circuit", parts: [
        { key: "b", kind: "button" }, { key: "r", kind: "resistor", ohms: 10000 },
      ], wires: [["5v", "b.1"], ["b.2", "pin-7"], ["pin-7", "r.1"], ["r.2", "gnd"]] },
      { type: "predict",
        question: "While nobody presses the button, what does digitalRead(7) return in this circuit?",
        options: ["HIGH (1)", "LOW (0)", "It changes at random", "Nothing until it's pressed"],
        answer: 1,
        explain:
          "The 10kΩ resistor connects pin 7 to GND, so with the button open the pin sits at 0V: LOW. Pressing " +
          "connects pin 7 straight to 5V, which wins over the resistor: HIGH." },
      { type: "guided", title: "Read a button", steps: [
        "Press \"Load the button circuit\", then \"Try it in the editor\" under the example.",
        "Press Run. The Serial Monitor prints 0 five times a second - the button isn't pressed.",
        "Press and hold the button's body on the board: the numbers change to 1. Let go: back to 0.",
        "Press Stop.",
      ] },
      { type: "experiment", text:
        "Make the button control something: add an LED with its resistor on pin 13 (and pinMode(13, OUTPUT) " +
        "in setup()), then in loop() switch it on while state is HIGH and off otherwise, with an if and an " +
        "else. That's an input controlling an output - the pattern behind almost every Arduino project." },
      { type: "mistakes", items: [
        "Reading a pin that's connected to nothing: it \"floats\" and can read HIGH or LOW at random (lesson 4.3).",
        "Expecting digitalRead() to do something by itself - it only reports; your if decides what happens.",
        "Writing if (state = HIGH) - one = stores HIGH in state, so the if is always true. Compare with ==.",
      ] },
    ],
    summary: [
      "digitalRead(pin) returns HIGH (1) or LOW (0): the voltage on an input pin, right now.",
      "Store the result in a variable, then decide what to do with an if.",
      "An input needs something holding it at a definite level when nothing is pressed - here, a pull-down resistor.",
    ],
  },

  {
    id: "l2-6",
    title: "Push Buttons: Wiring and Reading",
    body: [
      { type: "p", text:
        "A push button is just a mechanical switch: pressed, it connects the two sides of the circuit; " +
        "released, it doesn't. Wired simply between a pin and 5V, digitalRead() will read HIGH while " +
        "pressed." },
      { type: "code", text:
        "int buttonPin = 7;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(buttonPin, INPUT);\n}\n\nvoid loop() {\n  int state = digitalRead(buttonPin);\n  Serial.println(state);   // watch this change as you press/release\n}" },
      { type: "note", text:
        "Try wiring exactly this and watching the Serial Monitor as you press the button - you should see " +
        "the printed value flip between 1 and 0. If it doesn't, the next two lessons explain the most " +
        "likely reason: a floating pin." },
    ],
  },

  {
    id: "l2-7",
    title: "Pull-up and Pull-down Resistors: The Floating Pin Problem",
    body: [
      { type: "p", text:
        "Here's a subtle problem: when a button is NOT pressed, an input pin wired only to the button " +
        "isn't connected to anything definite - it's \"floating\", and can read randomly as HIGH or LOW " +
        "due to tiny amounts of electrical noise." },
      { type: "p", text:
        "The fix is to always give the pin a definite state when the button isn't pressed. A pull-up " +
        "resistor connects the pin to 5V (through a large resistor) so it reads HIGH by default, and " +
        "pressing the button pulls it LOW. A pull-down resistor does the opposite: connects the pin to " +
        "GND by default (reads LOW), and pressing the button pulls it HIGH." },
      { type: "note", text:
        "Either approach works - what matters is that the pin always has SOME defined connection, never " +
        "just \"hanging\" unconnected. Pull-up is the more common choice because Arduino has one built in, " +
        "as you'll see in the next lesson." },
    ],
  },

  {
    id: "l2-8",
    title: "INPUT_PULLUP: Using Arduino's Built-in Pull-up Resistor",
    body: [
      { type: "p", text:
        "Rather than wiring an external pull-up resistor yourself, the ATmega328P has one built into " +
        "every pin, which you can enable with pinMode(pin, INPUT_PULLUP)." },
      { type: "code", text:
        "int buttonPin = 7;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT_PULLUP);\n}\n\nvoid loop() {\n  int state = digitalRead(buttonPin);\n  // state is HIGH when NOT pressed, LOW when pressed - inverted from what you might expect!\n}" },
      { type: "p", text:
        "With this wiring, the button connects the pin straight to GND (no resistor needed on the " +
        "breadboard). The logic is inverted compared to the simple wiring from two lessons ago: HIGH " +
        "means released, LOW means pressed." },
      { type: "note", text:
        "This inversion trips up almost every beginner at least once. When your button logic seems " +
        "\"backwards\", check whether you're using INPUT_PULLUP - if so, that's expected, not a bug." },
    ],
    challenge: {
      id: "c4",
      title: "Control an LED with a Button",
      difficulty: "medium",
      prompt:
        "Make an LED on pin 13 turn on while a button on pin 7 is held down, and turn off when it's " +
        "released. Use INPUT_PULLUP for the button (remember what that does to the HIGH/LOW logic).\n\n" +
        "Before coding: what information does the Arduino need to know before it can decide whether the " +
        "LED should be on, and which function gives it that information?",
      hints: [
        "Concept hint: the Arduino can't \"see\" the button - it can only read a voltage on a pin. You " +
          "need to read that pin's state, store it, and then decide what to do based on the value you " +
          "stored.",
        "Function hint: digitalRead() gives you the button's state as a variable; an if statement (see " +
          "Module 3) then compares that variable to a value and runs code only when it matches.",
        "Example hint: if (digitalRead(buttonPin) == LOW) { /* pressed, since INPUT_PULLUP is inverted */ }. " +
          "What would you put inside that block, and what should happen in the else case?",
      ],
      solution:
        "int ledPin = 13;\nint buttonPin = 7;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n  pinMode(buttonPin, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(buttonPin) == LOW) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n}",
      explain: [
        "pinMode(buttonPin, INPUT_PULLUP) enables the internal pull-up, so the pin reads HIGH by default " +
          "and LOW while the button is physically pressed.",
        "digitalRead(buttonPin) == LOW checks specifically for the pressed state, since INPUT_PULLUP " +
          "inverts the usual HIGH-means-active assumption.",
        "The if/else runs every single time through loop() (many times per second), which is why the LED " +
          "responds immediately as you press and release - there's no need to remember previous state.",
      ],
    },
  },

  {
    id: "l2-9",
    title: "Project: Traffic Light System",
    body: [
      { type: "p", text:
        "This challenge combines everything from this level so far: multiple OUTPUT pins, digitalWrite, " +
        "and delay, sequenced into a realistic pattern - no new functions, just applying what you already " +
        "know to three LEDs instead of one." },
      { type: "p", text:
        "A simplified real traffic light cycle: green for a while, then yellow briefly, then red for a " +
        "while, then back to green. Exactly one light should be on at any moment." },
    ],
    challenge: {
      id: "c5",
      title: "Build a Traffic Light",
      difficulty: "hard",
      prompt:
        "Wire three LEDs to pins 8 (red), 9 (yellow), and 10 (green). Write a sketch that cycles: green " +
        "for 3 seconds -> yellow for 1 second -> red for 3 seconds -> repeat. Only one LED should be lit " +
        "at a time.\n\n" +
        "Think about it before coding: with three separate LEDs, how many pinMode() calls do you need, " +
        "and in what order do the digitalWrite() calls need to happen so only one light is ever on?",
      hints: [
        "Concept hint: you have three independent outputs. Before turning the next light on, you need to " +
          "make sure the previous one is explicitly turned off - nothing does that automatically for you.",
        "Function hint: you'll call pinMode() three times in setup() (once per LED), and in loop() you'll " +
          "use digitalWrite() + delay() in pairs, turning one LED off right before or after turning the " +
          "next one on.",
        "Example hint: digitalWrite(greenPin, HIGH); delay(3000); digitalWrite(greenPin, LOW); - that's " +
          "the full \"green phase\". The yellow and red phases follow the exact same pattern with " +
          "different pins and durations.",
      ],
      solution:
        "int redPin = 8;\nint yellowPin = 9;\nint greenPin = 10;\n\nvoid setup() {\n  pinMode(redPin, OUTPUT);\n  pinMode(yellowPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(greenPin, HIGH);\n  delay(3000);\n  digitalWrite(greenPin, LOW);\n\n  digitalWrite(yellowPin, HIGH);\n  delay(1000);\n  digitalWrite(yellowPin, LOW);\n\n  digitalWrite(redPin, HIGH);\n  delay(3000);\n  digitalWrite(redPin, LOW);\n}",
      explain: [
        "All three pins are configured as OUTPUT once in setup() - each LED is independent, so each needs " +
          "its own pinMode() call.",
        "Each phase follows the same three-line pattern: turn a light on, wait, turn it off - turning it " +
          "off before the next phase starts is what guarantees only one light is ever lit.",
        "Because this is all inside loop(), the whole green -> yellow -> red sequence repeats forever " +
          "automatically once it reaches the end.",
      ],
    },
  },

  {
    id: "l2-10",
    title: "Counting Button Presses",
    body: [
      { type: "p", text:
        "This challenge introduces a new idea by combination rather than a new function: counting " +
        "events over time requires a variable that persists between loop() calls, instead of one that " +
        "gets reset every cycle." },
      { type: "p", text:
        "It also surfaces a real problem you'll hit with physical buttons: a single \"press\" can register " +
        "as several digitalRead() calls in a row all seeing LOW (or HIGH), because loop() runs far faster " +
        "than your finger moves. Without care, one press can be counted many times." },
    ],
    challenge: {
      id: "c6",
      title: "Count Button Presses",
      difficulty: "hard",
      prompt:
        "Wire a button to pin 7 using INPUT_PULLUP. Each time it's pressed, increase a counter by 1 and " +
        "print the new count to the Serial Monitor - but make sure each physical press only counts once, " +
        "even though loop() runs many times per second.\n\n" +
        "Think first: if loop() checks the button hundreds of times per second, what's different between " +
        "the moment a press BEGINS and every other moment the button happens to still be held down?",
      hints: [
        "Concept hint: you don't want to count every loop() cycle where the button reads \"pressed\" - " +
          "you want to count only the CHANGE from not-pressed to pressed. That means you need to remember " +
          "what the state was last time through loop().",
        "Function hint: keep a variable declared outside loop() (so it survives between calls) holding " +
          "the previous button state. Compare the new digitalRead() result against it each cycle, and only " +
          "act when they differ in the pressed direction.",
        "Example hint: if (currentState == LOW && previousState == HIGH) { /* this exact loop is the " +
          "moment the press started */ }. Don't forget to update previousState = currentState; at the end " +
          "of loop(), or the comparison will never work correctly.",
      ],
      solution:
        "int buttonPin = 7;\nint pressCount = 0;\nint previousState = HIGH;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int currentState = digitalRead(buttonPin);\n\n  if (currentState == LOW && previousState == HIGH) {\n    pressCount = pressCount + 1;\n    Serial.println(pressCount);\n  }\n\n  previousState = currentState;\n}",
      explain: [
        "pressCount and previousState are declared outside loop(), at global scope, specifically so they " +
          "keep their values between one call to loop() and the next - a variable declared inside loop() " +
          "would reset to its starting value every single cycle.",
        "The if only triggers when currentState is LOW (pressed, remember INPUT_PULLUP is inverted) AND " +
          "previousState was HIGH - meaning this is the exact loop where the press began, not a loop where " +
          "it was already being held.",
        "previousState = currentState; at the end of every loop() keeps the \"memory\" up to date, so the " +
          "next cycle can correctly tell whether a new press just started.",
      ],
    },
  },
];
