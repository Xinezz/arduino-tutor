// Level 2: Digital Input and Output.

export const level2Lessons = [
  {
    id: "l2-1",
    level: 2,
    title: "Digital Signals: HIGH and LOW",
    body: [
      { type: "p", text:
        "A digital pin only ever has two possible states: HIGH (roughly 5V) or LOW (roughly 0V). " +
        "There is no \"halfway\" - this is what makes it \"digital\" rather than \"analog\" (which we " +
        "cover in Level 3)." },
      { type: "code", text:
        "HIGH   // on, about 5V\nLOW    // off, about 0V" },
      { type: "p", text:
        "HIGH and LOW are just built-in names for the numbers 1 and 0 - Arduino defines them for " +
        "readability, but digitalWrite(pin, 1) and digitalWrite(pin, HIGH) do the exact same thing." },
      { type: "note", text:
        "Everything in Level 2 is about controlling and reading these two states through pins - it's the " +
        "simplest possible interaction between code and the physical world, and almost every project " +
        "builds on it." },
    ],
  },

  {
    id: "l2-2",
    level: 2,
    title: "pinMode(): Configuring a Pin's Job",
    body: [
      { type: "p", text:
        "Before you can use a pin, you have to tell Arduino what job it's doing: sending power out " +
        "(OUTPUT) or reading a signal in (INPUT). This happens once, in setup()." },
      { type: "code", text:
        "void setup() {\n  pinMode(13, OUTPUT);   // pin 13 will send signals OUT (e.g. to an LED)\n  pinMode(7, INPUT);     // pin 7 will read signals IN (e.g. from a button)\n}" },
      { type: "p", text:
        "Skipping pinMode(), or setting the wrong mode, is one of the most common beginner bugs: if a " +
        "pin is set to INPUT but you call digitalWrite() on it expecting an LED to light up, nothing " +
        "will happen - the pin isn't configured to send power." },
      { type: "note", text:
        "Engineering analogy: pinMode() is like setting a valve to either \"supply\" or \"sensor\" mode " +
        "before a system runs - you have to decide its role before it can do anything useful." },
    ],
  },

  {
    id: "l2-3",
    level: 2,
    title: "digitalWrite(): Driving an Output",
    body: [
      { type: "p", text:
        "Once a pin is set to OUTPUT, digitalWrite() sets it to HIGH or LOW, which sends (or stops " +
        "sending) roughly 5V out of that pin." },
      { type: "code", text:
        "digitalWrite(13, HIGH);   // pin 13 now outputs ~5V\ndigitalWrite(13, LOW);    // pin 13 now outputs ~0V" },
      { type: "p", text:
        "The pin must already be OUTPUT (via pinMode) for this to do anything meaningful - calling " +
        "digitalWrite() on an INPUT pin is a common source of confusing bugs." },
    ],
  },

  {
    id: "l2-4",
    level: 2,
    title: "LEDs and Resistors: Safe Wiring Basics",
    body: [
      { type: "p", text:
        "An LED only works one direction (it has a longer leg - the anode/positive side - and a " +
        "shorter leg - the cathode/negative side) and it has almost no internal resistance. Connected " +
        "directly to 5V with nothing else in the circuit, it will pull far too much current and burn out " +
        "almost instantly." },
      { type: "p", text:
        "A resistor (typically 220Ω-330Ω for a standard LED at 5V) placed in series with the LED limits " +
        "the current to a safe level. The basic circuit is: Arduino pin -> resistor -> LED (long leg " +
        "first) -> LED short leg -> GND." },
      { type: "note", text:
        "Ohm's law preview: current = voltage / resistance. A bigger resistor means less current means a " +
        "dimmer (but safer) LED. You'll use this relationship more deliberately once we reach PWM in " +
        "Level 4." },
    ],
    challenge: {
      id: "c3",
      title: "Blink an LED",
      difficulty: "medium",
      prompt:
        "Write a sketch that blinks an LED on pin 13 - on for half a second, off for half a second, " +
        "repeating forever. Assume the LED and resistor are already wired correctly.\n\n" +
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
    level: 2,
    title: "digitalRead(): Sensing an Input",
    body: [
      { type: "p", text:
        "digitalRead() checks the current voltage on a pin configured as INPUT and returns either HIGH " +
        "or LOW - this is how you read a button, switch, or any other simple on/off sensor." },
      { type: "code", text:
        "int buttonState = digitalRead(7);\n\nif (buttonState == HIGH) {\n  // pin 7 is currently reading ~5V\n}" },
      { type: "p", text:
        "Notice digitalRead() returns a value rather than taking an action - you almost always store " +
        "that value in a variable, then decide what to do with it (often using if, which we'll cover " +
        "properly in Level 5)." },
    ],
  },

  {
    id: "l2-6",
    level: 2,
    title: "Push Buttons: Wiring and Reading",
    body: [
      { type: "p", text:
        "A push button is just a mechanical switch: pressed, it connects the two sides of the circuit; " +
        "released, it doesn't. Wired simply between a pin and 5V, digitalRead() will read HIGH while " +
        "pressed." },
      { type: "code", text:
        "int buttonPin = 7;\n\nvoid setup() {\n  pinMode(buttonPin, INPUT);\n}\n\nvoid loop() {\n  int state = digitalRead(buttonPin);\n  Serial.println(state);   // watch this change as you press/release\n}" },
      { type: "note", text:
        "Try wiring exactly this and watching the Serial Monitor as you press the button - you should see " +
        "the printed value flip between 1 and 0. If it doesn't, the next two lessons explain the most " +
        "likely reason: a floating pin." },
    ],
  },

  {
    id: "l2-7",
    level: 2,
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
    level: 2,
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
        "Function hint: digitalRead() gives you the button's state as a variable; an if statement (a " +
          "preview of Level 5) then compares that variable to a value and runs code only when it matches.",
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
    level: 2,
    title: "Challenge Lab: Traffic Light",
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
    level: 2,
    title: "Challenge Lab: Button Counter",
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
