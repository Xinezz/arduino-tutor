// The beginner project library: three complete projects, each following the
// same engineering process (see projectView.js). Every step is CHECKED by
// running the learner's own code and reading their own circuit - the same
// behaviour checks as "Check My Solution" (lessons/checks.js) - so any code
// that behaves correctly passes, however it's written.
//
// A project: intro, objectives, needs (lessons), components, plan (the
// engineering steps answered), steps (guided mode, each with hints and a
// check), challenge (objective, constraints, hints), independent (problem,
// requirements, limits), final (the whole-project check), troubleshooting,
// improvements (each with its own check where it can be measured), knowledge
// (a checkpoint), and `reference`: a working solution - used to draw the
// expected-behaviour preview and, in the tests, to prove every check passes.

import { item, outputItem, circuit, lowDuring } from "../lessons/checks.js";

const lv = (sim, pin, t) => sim.hardware.levelAt(pin, t);
const litAt = (sim, pins, t) => pins.filter((p) => lv(sim, p, t) > 0);
const onlyLit = (sim, pins, pin, ts) => ts.every((t) => { const l = litAt(sim, pins, t); return l.length === 1 && l[0] === pin; });
const modesAre = (sim, pins, mode) => pins.every((p) => sim.hardware.modes[p] === mode);

// ---------------------------------------------------------------- Running Lights
const RL = [2, 3, 4, 5];
const rlSlot = (k) => k * 200 + 100; // the middle of the k-th 200 ms slot

export const runningLights = {
  id: "running-lights",
  level: "beginner",
  sprite: "led",
  title: "Running Lights",
  summary: "Four LEDs light up one after another, over and over - the classic \"chaser\" effect.",
  problem:
    "A shop sign wants a row of lights that \"runs\" from left to right to catch people's eye. You'll build " +
    "the controller: four LEDs, each lit in turn for a fifth of a second, forever.",
  why: "Sequences like this are everywhere: indicator lights, loading bars, runway lights, the lights on a fairground ride.",
  concepts: ["pinmode", "digitalwrite", "delay", "loops"],
  objectives: ["Wire several LEDs, each with its own resistor and pin", "Switch outputs in a precise order and timing", "Repeat a sequence with loop() (and, if you like, a for loop)"],
  needs: ["l2-4", "m1-8", "l5-3"],
  components: [
    { kind: "LED", count: 4, purpose: "The four lights of the sign.", how: "Lights when current flows from its + leg to its − leg.", why: "One per position in the row.", connects: "Pins 2, 3, 4 and 5 → resistor → LED + leg; LED − leg → GND." },
    { kind: "Resistor (220Ω)", count: 4, purpose: "Limits each LED's current to a safe level.", how: "Ohm's law: 3V ÷ 220Ω ≈ 14 mA.", why: "Without one, a real LED and pin would be damaged.", connects: "In series with each LED - its own resistor each (parallel branches)." },
  ],
  plan: {
    problem: "Light four LEDs one at a time, left to right, 200 ms each, forever.",
    inputs: "None - it runs by itself.",
    outputs: "Four LEDs, on pins 2, 3, 4 and 5.",
    circuit: ["Pin 2 → 220Ω → LED 1 → GND", "Pin 3 → 220Ω → LED 2 → GND", "Pin 4 → 220Ω → LED 3 → GND", "Pin 5 → 220Ω → LED 4 → GND"],
    logic: "setup:\n  make pins 2, 3, 4 and 5 outputs\nloop:\n  for each pin from 2 to 5:\n    switch it on\n    wait 200 ms\n    switch it off",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Build the circuit",
      task: "Add four LEDs and four resistors. Wire each LED to its own pin - 2, 3, 4 and 5 - through its own resistor, with every LED's − leg to GND.",
      hints: ["Build one LED circuit first and check it, then repeat it three times.", "Each LED: pin → resistor → LED + (long leg); LED − (short leg) → GND.", "The GND pins and the breadboard's − rail are all GND - use whichever is closest."],
      check: { circuit: RL.map((p) => circuit.led(p)) } },
    { id: "setup", kind: "code", title: "Set the pins up",
      task: "In setup(), make all four pins outputs.",
      explain: "Every pin starts as an INPUT, so each LED pin needs pinMode(pin, OUTPUT) once, in setup().",
      hints: ["You need four pinMode() lines - or one inside a for loop.", "pinMode(2, OUTPUT); ... up to pin 5."],
      check: { ms: 300, check: (sim) => [item(modesAre(sim, RL, "OUTPUT"), "Pins 2-5 are all OUTPUTs", `Not every LED pin is an OUTPUT yet: ${RL.filter((p) => sim.hardware.modes[p] !== "OUTPUT").map((p) => `pin ${p}`).join(", ")} still needs pinMode(..., OUTPUT).`)] } },
    { id: "sequence", kind: "code", title: "Light them one after another",
      task: "In loop(), light each LED in turn - pin 2 first - for 200 ms, switching each one off before the next comes on.",
      explain: "On, wait, off - for each pin in order. Only one LED should be lit at any moment.",
      hints: ["Think of one LED's blink: HIGH, delay(200), LOW. Do that for pin 2, then 3, then 4, then 5.", "A for loop can count the pin: for (int pin = 2; pin <= 5; pin++) { ... }", "Inside the for loop: digitalWrite(pin, HIGH); delay(200); digitalWrite(pin, LOW);"],
      check: { ms: 900, check: (sim) => [
        item(onlyLit(sim, RL, 2, [rlSlot(0)]), "LED 1 (pin 2) lights first, on its own", `At the start, the LEDs lit are: ${litAt(sim, RL, rlSlot(0)).map((p) => `pin ${p}`).join(", ") || "none"} - it should be just pin 2.`),
        item([0, 1, 2, 3].every((k) => onlyLit(sim, RL, RL[k], [rlSlot(k)])), "Then pins 3, 4 and 5, one at a time, 200 ms each",
          "The order or timing is off - every 200 ms the next pin should be the only one lit: 2, then 3, then 4, then 5."),
      ] } },
    { id: "repeat", kind: "code", title: "Keep it running",
      task: "Make sure the sequence starts again after pin 5 - forever.",
      explain: "loop() repeats by itself; if your sequence is inside loop(), it already runs again and again.",
      hints: ["Is your sequence inside loop(), not setup()?"],
      check: { ms: 1900, check: (sim) => [item([4, 5, 6, 7, 8].every((k) => onlyLit(sim, RL, RL[k % 4], [rlSlot(k)])), "After pin 5 it starts again at pin 2", "After pin 5, the sequence doesn't start again - put it inside loop().")] } },
  ],
  challenge: {
    objective: "Make four LEDs on pins 2-5 light one at a time, in order, 200 ms each, repeating forever.",
    constraints: ["Exactly one LED lit at any moment.", "Each LED needs its own resistor.", "Any code that behaves this way is right - a for loop, or four blocks of code."],
    hints: ["Start with one LED blinking, then add the others.", "for (int pin = 2; pin <= 5; pin++) visits every pin in order."],
  },
  independent: {
    problem: "A shop wants an eye-catching sign: a row of four lights that runs from left to right, endlessly.",
    requirements: ["Four lights, lit one at a time, left (pin 2) to right (pin 5).", "200 ms per light.", "Runs forever, by itself."],
    limits: ["Use the simulator's LEDs and 220Ω resistors.", "Each LED must be safe on a real board."],
  },
  final: { ms: 1900, circuit: RL.map((p) => circuit.led(p)), check: (sim) => [
    item(modesAre(sim, RL, "OUTPUT"), "Pins 2-5 are OUTPUTs", "Set all four LED pins up with pinMode(pin, OUTPUT)."),
    item([0, 1, 2, 3, 4, 5, 6, 7, 8].every((k) => onlyLit(sim, RL, RL[k % 4], [rlSlot(k)])), "One LED at a time, 2 → 5, 200 ms each, repeating",
      "The running light isn't right yet - every 200 ms the next pin (2, 3, 4, 5, then 2 again) should be the only one lit."),
  ] },
  reference: "void setup() {\n  for (int pin = 2; pin <= 5; pin++) {\n    pinMode(pin, OUTPUT);\n  }\n}\n\nvoid loop() {\n  for (int pin = 2; pin <= 5; pin++) {\n    digitalWrite(pin, HIGH);\n    delay(200);\n    digitalWrite(pin, LOW);\n  }\n}",
  wiring: { parts: [
    { key: "r1", kind: "resistor" }, { key: "l1", kind: "led" }, { key: "r2", kind: "resistor" }, { key: "l2", kind: "led" },
    { key: "r3", kind: "resistor" }, { key: "l3", kind: "led" }, { key: "r4", kind: "resistor" }, { key: "l4", kind: "led" },
  ], wires: [
    ["pin-2", "r1.1"], ["r1.2", "l1.a"], ["l1.k", "gnd"], ["pin-3", "r2.1"], ["r2.2", "l2.a"], ["l2.k", "gnd"],
    ["pin-4", "r3.1"], ["r3.2", "l3.a"], ["l3.k", "gnd"], ["pin-5", "r4.1"], ["r4.2", "l4.a"], ["l4.k", "gnd"],
  ] },
  previewPins: RL,
  previewMs: 1700,
  troubleshooting: [
    { problem: "One LED never lights.", fix: "Check Circuit: is it wired to the right pin, the right way round, with its − leg to GND? Then check that pin is in your pinMode() lines." },
    { problem: "Two LEDs are on at once.", fix: "Each LED must be switched LOW before the next goes HIGH." },
    { problem: "It runs once and stops.", fix: "The sequence must be in loop(), not setup()." },
    { problem: "The order is wrong.", fix: "Compare your wiring with your code: which pin is each LED really on?" },
  ],
  improvements: [
    { title: "Bounce back", task: "Make the light run 2 → 5 and then back 4 → 3, like a scanner, 200 ms each.",
      check: { ms: 2500, check: (sim) => { const order = [2, 3, 4, 5, 4, 3]; return [item([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((k) => onlyLit(sim, RL, order[k % 6], [rlSlot(k)])), "It runs 2 → 5 and back again, 200 ms each", "Every 200 ms the next lit pin should be 2, 3, 4, 5, 4, 3, then 2 again.")]; } } },
    { title: "Change the speed", task: "Make it twice as fast - 100 ms per LED. What's the smallest change that does it?" },
  ],
  knowledge: { id: "quiz-project-running-lights", type: "questions", title: "Project Check", topic: "Running Lights", questions: [
    { q: "Why does each LED get its own resistor, instead of one shared resistor?", options: ["To make it cheaper", "Each LED is its own parallel branch, and each branch needs its current limited", "Resistors only work with one LED", "So the LEDs are dimmer"], answer: 1,
      why: ["It's actually more parts - but it's the safe design.", "Each pin-resistor-LED path is a separate branch, so each needs its own resistor to keep its current safe.", "A resistor works in any loop - the point is one per branch.", "The goal is a safe current per LED, not dimness."] },
    { q: "The sketch uses for (int pin = 2; pin <= 5; pin++). How many times does the code inside run on each pass of loop()?", options: ["2", "3", "4", "5"], answer: 2,
      why: ["It runs for 2, 3, 4 and 5 - more than twice.", "<= 5 includes 5, so it's one more than 3.", "pin takes the values 2, 3, 4 and 5 - four times.", "It starts at 2, not 1 - so it's four, not five."] },
    { q: "You change delay(200) to delay(400). What happens?", options: ["It runs twice as fast", "It runs half as fast", "The order reverses", "Nothing changes"], answer: 1,
      why: ["A longer delay means each LED stays on LONGER - slower, not faster.", "Each LED now stays on twice as long, so the light runs at half the speed.", "The order comes from the pin numbers, not the delay.", "The delay is exactly what sets the speed."] },
  ] },
};

// ---------------------------------------------------------------- Toggle Desk Lamp
const TG_INPUTS = { digitalRead: lowDuring(2, [[500, 700], [1500, 1700], [2500, 3500]]) };

export const toggleLamp = {
  id: "toggle-lamp",
  level: "beginner",
  sprite: "bulb",
  title: "Toggle Desk Lamp",
  summary: "One button switches a lamp on - and the next press switches it off.",
  problem:
    "A desk lamp has one push button. Press it once and the lamp comes on, and STAYS on after you let go; " +
    "press again and it goes off. Holding the button down mustn't make it flicker.",
  why: "Push-to-toggle is how most modern devices work: a phone's power button, a smart light, a microwave's start button.",
  concepts: ["buttons", "pullups", "variables", "if"],
  objectives: ["Read a button wired with INPUT_PULLUP", "Remember a state (on or off) in a variable", "React to a PRESS - the moment it changes - not to holding"],
  needs: ["l2-8", "l2-10", "l1-8"],
  components: [
    { kind: "Push button", count: 1, purpose: "The lamp's switch.", how: "Pressed, it joins its two legs; released, it doesn't.", why: "The input the lamp reacts to.", connects: "One leg to pin 2, the other to GND; pinMode(2, INPUT_PULLUP) - it reads LOW while pressed." },
    { kind: "LED", count: 1, purpose: "The lamp.", how: "Lights when its pin is HIGH.", why: "The output.", connects: "Pin 13 → 220Ω → LED + leg; LED − leg → GND." },
    { kind: "Resistor (220Ω)", count: 1, purpose: "Keeps the LED's current safe.", how: "Limits the current to about 14 mA.", why: "A real LED would burn out without one.", connects: "In series with the LED." },
  ],
  plan: {
    problem: "Each press of the button flips the lamp between on and off.",
    inputs: "A push button on pin 2 (LOW while pressed).",
    outputs: "An LED on pin 13.",
    circuit: ["Pin 2 → button → GND (INPUT_PULLUP, no resistor needed)", "Pin 13 → 220Ω → LED → GND"],
    logic: "remember: lampOn = false, wasPressed = false\nloop:\n  pressed = (button reads LOW)\n  if pressed now AND not pressed last time:\n    lampOn = not lampOn\n  switch the LED to lampOn\n  wasPressed = pressed",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Build the circuit",
      task: "Wire a button between pin 2 and GND, and an LED (with its resistor) on pin 13.",
      hints: ["The button needs no resistor: INPUT_PULLUP has one built in.", "Button: one leg → pin 2, other leg → GND. LED: pin 13 → resistor → LED + → LED − → GND."],
      check: { circuit: [circuit.button(2), circuit.led(13)] } },
    { id: "follow", kind: "code", title: "Make the LED follow the button",
      task: "First, a simpler version: the LED is on while the button is held, and off when it's released.",
      explain: "With INPUT_PULLUP, the pin reads HIGH when released and LOW when pressed - so \"pressed\" means LOW.",
      hints: ["pinMode(2, INPUT_PULLUP); and pinMode(13, OUTPUT); in setup().", "if (digitalRead(2) == LOW) { LED on } else { LED off }"],
      reference: "void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n}",
      check: { ms: 1200, inputs: TG_INPUTS, check: (sim) => [
        item(sim.hardware.modes[2] === "INPUT_PULLUP", "The button pin uses INPUT_PULLUP", "Set the button pin up with pinMode(2, INPUT_PULLUP);"),
        outputItem(sim, 13, "LED"),
        item(lv(sim, 13, 600) > 0 && lv(sim, 13, 400) === 0 && lv(sim, 13, 1000) === 0, "The LED is on while the button is held, off otherwise",
          "The LED should be on only while the button is held. Remember: pressed reads LOW."),
      ] } },
    { id: "toggle", kind: "code", title: "Flip on each press",
      task: "Now make each press flip the lamp - and keep it that way after you let go. You'll need a variable that remembers whether the lamp is on.",
      explain: "A variable (bool lampOn) remembers the lamp's state between passes of loop(). A press flips it: lampOn = !lampOn.",
      hints: ["Keep the state in a global variable: bool lampOn = false;", "Only flip when the button has JUST been pressed: it's LOW now, but was HIGH last time round. Keep the last reading in a second variable.", "if (now == LOW && last == HIGH) { lampOn = !lampOn; } then digitalWrite(13, lampOn); and last = now;"],
      check: { ms: 2400, inputs: TG_INPUTS, check: (sim) => [
        item(lv(sim, 13, 400) === 0, "The lamp starts off", "The lamp should be off until the first press."),
        item(lv(sim, 13, 1000) > 0 && lv(sim, 13, 1400) > 0, "The first press turns it on - and it stays on", lv(sim, 13, 600) > 0 ? "It comes on, but goes off again when the button is released - it needs to REMEMBER the state in a variable." : "The first press doesn't turn the lamp on."),
        item(lv(sim, 13, 2000) === 0 && lv(sim, 13, 2300) === 0, "The second press turns it off", "The second press should turn the lamp off again."),
      ] } },
    { id: "hold", kind: "code", title: "One flip per press, however long it's held",
      task: "Hold the button down for a whole second: the lamp should flip once, not flicker. If yours flickers, react only to the moment the button goes from released to pressed.",
      explain: "loop() runs thousands of times a second. If it flips the state whenever the button is LOW, a held button flips it again and again. Comparing with the previous reading catches only the change.",
      hints: ["Is the flip inside an if that checks the button was released last time?", "Store the reading at the end of loop(): lastReading = reading;"],
      check: { ms: 4000, inputs: TG_INPUTS, check: (sim) => [
        item([2700, 3000, 3300, 3800].every((t) => lv(sim, 13, t) > 0), "Holding the button flips it once, with no flicker",
          "While the button is held, the lamp keeps changing - flip it only when the reading changes from HIGH to LOW."),
      ] } },
  ],
  challenge: {
    objective: "Each press of the button on pin 2 switches the LED on pin 13 on or off - and holding the button flips it only once.",
    constraints: ["Button between pin 2 and GND, with INPUT_PULLUP.", "The LED stays in its new state after the button is released.", "Any code that behaves this way is right."],
    hints: ["You'll need a variable that remembers the lamp's state.", "React to the button CHANGING to pressed, not to it being pressed."],
  },
  independent: {
    problem: "A lamp should be controlled by a single push button: one press on, the next press off.",
    requirements: ["Starts off.", "Each press flips the lamp, and it stays that way when released.", "A long press flips it only once."],
    limits: ["One push button (pin 2) and one LED (pin 13) with its resistor.", "The simulator's button gives clean presses - see the note on real buttons below."],
  },
  final: { ms: 4000, inputs: TG_INPUTS, circuit: [circuit.button(2), circuit.led(13)], check: (sim) => [
    item(sim.hardware.modes[2] === "INPUT_PULLUP", "The button pin uses INPUT_PULLUP", "Set the button pin up with pinMode(2, INPUT_PULLUP);"),
    outputItem(sim, 13, "LED"),
    item(lv(sim, 13, 400) === 0 && lv(sim, 13, 1000) > 0 && lv(sim, 13, 1400) > 0, "A press turns it on, and it stays on", "The first press should turn the lamp on and leave it on."),
    item(lv(sim, 13, 2000) === 0 && lv(sim, 13, 2300) === 0, "The next press turns it off", "The second press should turn it off."),
    item([2700, 3000, 3300, 3800].every((t) => lv(sim, 13, t) > 0), "A long press flips it only once", "Holding the button makes it flicker - flip only when the reading changes from HIGH to LOW."),
  ] },
  reference: "bool lampOn = false;\nint lastReading = HIGH;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  int reading = digitalRead(2);\n  if (reading == LOW && lastReading == HIGH) {\n    lampOn = !lampOn;\n  }\n  digitalWrite(13, lampOn);\n  lastReading = reading;\n}",
  previewInputs: TG_INPUTS,
  previewPins: [13],
  previewMs: 4000,
  previewNote: "The button is pressed at 0.5 s, at 1.5 s, and held from 2.5 s to 3.5 s.",
  wiring: { parts: [{ key: "b", kind: "button" }, { key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
    wires: [["pin-2", "b.1"], ["b.2", "gnd"], ["pin-13", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
  troubleshooting: [
    { problem: "The LED is on when the button ISN'T pressed.", fix: "With INPUT_PULLUP, pressed reads LOW. Check your if compares with LOW." },
    { problem: "It flickers while the button is held.", fix: "You're flipping on every pass of loop() while it's held. Flip only when the reading changes from HIGH to LOW." },
    { problem: "It comes on, then goes off when released.", fix: "The LED is following the button. Keep the lamp's state in a variable, and write that variable to the LED." },
    { problem: "On a real board, one press sometimes flips it twice.", fix: "Real button contacts \"bounce\" for a few milliseconds. The simulator's button doesn't, so this works here; on a real board, add delay(50); after a press is detected." },
  ],
  improvements: [
    { title: "A second lamp", task: "Add a second button on pin 3 that toggles a second LED on pin 12, without affecting the first lamp." },
    { title: "Count the presses", task: "Print the number of times the lamp has been switched on to the Serial Monitor, each time it comes on." },
  ],
  knowledge: { id: "quiz-project-toggle-lamp", type: "questions", title: "Project Check", topic: "Toggle Desk Lamp", questions: [
    { q: "Why does the sketch compare the reading with the LAST reading?", options: ["To make it faster", "So a press is counted once, at the moment it starts - not on every pass of loop() while held", "Because digitalRead() needs it", "To save memory"], answer: 1,
      why: ["It doesn't make anything faster - it decides WHEN to react.", "loop() runs thousands of times while you hold the button; comparing catches only the change from released to pressed.", "digitalRead() works fine on its own - the comparison is for the logic.", "It actually uses one more variable."] },
    { q: "With INPUT_PULLUP, what does digitalRead(2) return while the button is pressed?", options: ["HIGH", "LOW", "It depends on the LED", "A random value"], answer: 1,
      why: ["Released reads HIGH - the built-in resistor pulls it up.", "Pressing connects the pin to GND, so it reads LOW.", "The LED is on a different pin and doesn't affect the reading.", "The pull-up resistor makes it a definite HIGH or LOW - never random."] },
    { q: "What does lampOn = !lampOn; do?", options: ["Sets lampOn to false", "Flips lampOn: true becomes false, false becomes true", "Compares lampOn with itself", "Switches the LED on"], answer: 1,
      why: ["It doesn't always set false - it depends on what lampOn was.", "! means NOT, so this stores the opposite of the current value.", "A single = stores; it isn't a comparison.", "It only changes the variable; digitalWrite() switches the LED."] },
  ] },
};

// ---------------------------------------------------------------- Pedestrian Crossing
const PX = [8, 9, 10]; // green, yellow, red
const PX_PRESS = { digitalRead: lowDuring(2, [[1000, 1200]]) };
const PX_NO_PRESS = { digitalRead: () => 1 };

export const pedestrianCrossing = {
  id: "pedestrian-crossing",
  level: "beginner",
  sprite: "flag",
  title: "Pedestrian Crossing",
  summary: "Traffic lights that stay green for cars until someone presses the crossing button.",
  problem:
    "Cars shouldn't stop at a crossing when nobody wants to cross. Build a traffic light that stays green until " +
    "the pedestrian button is pressed - then yellow for 1 second, red for 3 seconds, and back to green.",
  why: "This is how real crossings work: a sequence that only runs when an input asks for it. The same idea runs lifts, vending machines and car-park barriers.",
  concepts: ["buttons", "pullups", "digitalwrite", "delay", "if"],
  objectives: ["Combine an input with a timed output sequence", "Wait for an event before starting a sequence", "Make sure exactly one light is on at a time"],
  needs: ["l2-4", "l2-8", "l5-1"],
  components: [
    { kind: "LED", count: 3, purpose: "The green, yellow and red lights for the cars.", how: "Each lights when its pin is HIGH.", why: "Three separate outputs - one per colour.", connects: "Green: pin 8, yellow: pin 9, red: pin 10 - each through a 220Ω resistor, − leg to GND. (Double-click an LED to change its colour.)" },
    { kind: "Resistor (220Ω)", count: 3, purpose: "One per LED, to keep each current safe.", how: "About 14 mA each.", why: "Each LED is its own branch.", connects: "In series with each LED." },
    { kind: "Push button", count: 1, purpose: "The pedestrians' \"press to cross\" button.", how: "Joins its legs while pressed.", why: "The input that starts the sequence.", connects: "Pin 2 → button → GND, with pinMode(2, INPUT_PULLUP)." },
  ],
  plan: {
    problem: "Green until the button is pressed; then yellow 1 s, red 3 s, back to green.",
    inputs: "The crossing button on pin 2 (LOW while pressed).",
    outputs: "Green (pin 8), yellow (pin 9) and red (pin 10) LEDs.",
    circuit: ["Pin 8 → 220Ω → green LED → GND", "Pin 9 → 220Ω → yellow LED → GND", "Pin 10 → 220Ω → red LED → GND", "Pin 2 → button → GND"],
    logic: "loop:\n  green on, others off\n  if the button is pressed:\n    yellow on (green off), wait 1 s\n    red on (yellow off), wait 3 s\n    (back to the top: green again)",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Build the circuit",
      task: "Wire three LEDs - green on pin 8, yellow on 9, red on 10 - each with its own resistor, and a button between pin 2 and GND.",
      hints: ["Wire one LED circuit and check it before adding the next.", "Double-click an LED to change its colour, so the board looks like a real traffic light.", "Button: one leg to pin 2, the other to GND - no resistor needed with INPUT_PULLUP."],
      check: { circuit: [circuit.led(8), circuit.led(9), circuit.led(10), circuit.button(2)] } },
    { id: "green", kind: "code", title: "Green for the cars",
      task: "Set up all the pins, and keep the green light (pin 8) on - with yellow and red off.",
      explain: "Three LED pins are OUTPUTs; the button pin is INPUT_PULLUP. Green on, the others LOW.",
      hints: ["setup(): pinMode for pins 8, 9 and 10 (OUTPUT) and pin 2 (INPUT_PULLUP).", "digitalWrite(8, HIGH); digitalWrite(9, LOW); digitalWrite(10, LOW);"],
      check: { ms: 1000, inputs: PX_NO_PRESS, check: (sim) => [
        item(modesAre(sim, PX, "OUTPUT"), "Pins 8, 9 and 10 are OUTPUTs", "Set pins 8, 9 and 10 up with pinMode(pin, OUTPUT)."),
        item(sim.hardware.modes[2] === "INPUT_PULLUP", "The button pin uses INPUT_PULLUP", "Set the button pin up with pinMode(2, INPUT_PULLUP);"),
        item(onlyLit(sim, PX, 8, [300, 900]), "Only green is on", `Lit now: ${litAt(sim, PX, 900).map((p) => `pin ${p}`).join(", ") || "nothing"} - only green (pin 8) should be.`),
      ] } },
    { id: "wait", kind: "code", title: "Nothing changes until someone presses",
      task: "With nobody pressing the button, the light must stay green - forever.",
      explain: "The sequence only runs inside an if that checks the button. Without a press, loop() just keeps green on.",
      hints: ["Check the button with digitalRead(2) == LOW (pressed).", "Put the yellow-and-red part inside if (digitalRead(2) == LOW) { ... }"],
      check: { ms: 6000, inputs: PX_NO_PRESS, check: (sim) => [item(onlyLit(sim, PX, 8, [500, 2500, 5500]), "With no press, it stays green", "Without a press, the light changes anyway - the sequence should only run when the button reads LOW.")] } },
    { id: "sequence", kind: "code", title: "Yellow, red, and back to green",
      task: "When the button is pressed: yellow for 1 second, then red for 3 seconds, then green again.",
      explain: "Inside the if: switch green off and yellow on, delay(1000); yellow off and red on, delay(3000); red off - and loop() puts green back.",
      hints: ["Each change of colour is two digitalWrite()s: the old light LOW, the new one HIGH.", "Yellow lasts delay(1000); red lasts delay(3000).", "After the red delay, switch red off - the next pass of loop() turns green on."],
      check: { ms: 7000, inputs: PX_PRESS, check: (sim) => [
        item(onlyLit(sim, PX, 8, [500, 900]), "Green before the press", "Before the button is pressed, only green should be on."),
        item(onlyLit(sim, PX, 9, [1500]), "Yellow straight after the press", `Half a second after the press, lit: ${litAt(sim, PX, 1500).map((p) => `pin ${p}`).join(", ") || "nothing"} - it should be yellow (pin 9) only.`),
        item(onlyLit(sim, PX, 10, [2500, 4500]), "Red for 3 seconds after the yellow", "After 1 second of yellow, only red (pin 10) should be on, for 3 seconds."),
        item(onlyLit(sim, PX, 8, [5500, 6800]), "Then back to green, and it stays green", "After the red, the light should go back to green and stay there."),
      ] } },
  ],
  challenge: {
    objective: "A traffic light (green 8, yellow 9, red 10) stays green until the button on pin 2 is pressed - then yellow for 1 s, red for 3 s, and green again.",
    constraints: ["Exactly one light on at any time.", "Nothing changes until the button is pressed.", "Any code that behaves this way is right."],
    hints: ["Keep green on in loop(), and run the sequence inside an if that checks the button.", "Pressed reads LOW with INPUT_PULLUP."],
  },
  independent: {
    problem: "Cars are being stopped at a crossing even when nobody is waiting. Design a traffic light that only stops the cars when a pedestrian asks.",
    requirements: ["Green for cars by default.", "After the button is pressed: yellow for 1 second, then red for 3 seconds, then green.", "Only one light on at a time."],
    limits: ["Green on pin 8, yellow 9, red 10; the button on pin 2.", "Use the simulator's LEDs, resistors and push button."],
  },
  final: { ms: 7000, inputs: PX_PRESS, circuit: [circuit.led(8), circuit.led(9), circuit.led(10), circuit.button(2)], check: (sim) => [
    item(modesAre(sim, PX, "OUTPUT") && sim.hardware.modes[2] === "INPUT_PULLUP", "Pins set up: 8-10 OUTPUT, 2 INPUT_PULLUP", "Set 8, 9 and 10 as OUTPUTs and pin 2 as INPUT_PULLUP."),
    item(onlyLit(sim, PX, 8, [500, 900]), "Green until the button is pressed", "Before the press, only green should be on."),
    item(onlyLit(sim, PX, 9, [1500]) && onlyLit(sim, PX, 10, [2500, 4500]), "Yellow 1 s, then red 3 s", "After the press: yellow alone for 1 second, then red alone for 3 seconds."),
    item(onlyLit(sim, PX, 8, [5500, 6800]), "Back to green afterwards", "After the red, it should go back to green and stay there."),
  ] },
  reference: "void setup() {\n  pinMode(8, OUTPUT);   // green\n  pinMode(9, OUTPUT);   // yellow\n  pinMode(10, OUTPUT);  // red\n  pinMode(2, INPUT_PULLUP);\n}\n\nvoid loop() {\n  digitalWrite(8, HIGH);\n  digitalWrite(9, LOW);\n  digitalWrite(10, LOW);\n  if (digitalRead(2) == LOW) {\n    digitalWrite(8, LOW);\n    digitalWrite(9, HIGH);\n    delay(1000);\n    digitalWrite(9, LOW);\n    digitalWrite(10, HIGH);\n    delay(3000);\n    digitalWrite(10, LOW);\n  }\n}",
  previewInputs: PX_PRESS,
  previewPins: [8, 9, 10],
  previewLabels: { 8: "green", 9: "yellow", 10: "red" },
  previewMs: 7000,
  previewNote: "The button is pressed at 1 s.",
  wiring: { parts: [
    { key: "rg", kind: "resistor" }, { key: "g", kind: "led" }, { key: "ry", kind: "resistor" }, { key: "y", kind: "led" },
    { key: "rr", kind: "resistor" }, { key: "r", kind: "led" }, { key: "b", kind: "button" },
  ], wires: [
    ["pin-8", "rg.1"], ["rg.2", "g.a"], ["g.k", "gnd"], ["pin-9", "ry.1"], ["ry.2", "y.a"], ["y.k", "gnd"],
    ["pin-10", "rr.1"], ["rr.2", "r.a"], ["r.k", "gnd"], ["pin-2", "b.1"], ["b.2", "gnd"],
  ] },
  troubleshooting: [
    { problem: "Two lights are on at once.", fix: "Every change needs the old light switched LOW as well as the new one HIGH." },
    { problem: "It cycles without anyone pressing.", fix: "The yellow-red part must be inside the if that checks the button." },
    { problem: "Pressing does nothing.", fix: "Check the button is on pin 2 and GND, the pin is INPUT_PULLUP, and your if checks for LOW." },
    { problem: "The red lasts the wrong time.", fix: "delay() counts milliseconds: 3 seconds is delay(3000)." },
  ],
  improvements: [
    { title: "A walk light", task: "Add a white \"walk\" LED on pin 7 that's on only while the cars have red.",
      check: { ms: 7000, inputs: PX_PRESS, check: (sim) => [item(lv(sim, 7, 2500) > 0 && lv(sim, 7, 4500) > 0 && lv(sim, 7, 900) === 0 && lv(sim, 7, 1500) === 0 && lv(sim, 7, 5500) === 0, "The walk light (pin 7) is on only during red", "Pin 7 should be on exactly while the red light is on - off during green and yellow.")] } },
    { title: "A fair wait", task: "Real crossings keep cars moving for a while after the last crossing. Make sure the green lasts at least 5 seconds before another press can stop the cars." },
  ],
  knowledge: { id: "quiz-project-crossing", type: "questions", title: "Project Check", topic: "Pedestrian Crossing", questions: [
    { q: "Why is the yellow-and-red sequence inside an if?", options: ["To make it run faster", "So it only runs when the button is pressed - otherwise loop() just keeps green on", "Because delay() only works inside an if", "To save memory"], answer: 1,
      why: ["The if decides WHETHER it runs, not how fast.", "Without the if, it would cycle all the time, whether anyone wants to cross or not.", "delay() works anywhere.", "It doesn't change memory use."] },
    { q: "Someone presses the button DURING the red light. What happens in this design?", options: ["The red restarts", "Nothing - during delay() the sketch isn't reading the button", "The light turns green at once", "The board resets"], answer: 1,
      why: ["The sketch can't notice the press while it's waiting in delay().", "delay() pauses everything: the press is missed (millis() can fix that - Module 4).", "Nothing reads the button during the delay.", "A press can't reset the board."] },
    { q: "Why does the button need no resistor here?", options: ["Buttons never need resistors", "INPUT_PULLUP switches on a resistor inside the chip that holds the pin HIGH", "The LEDs' resistors protect it", "Pin 2 is special"], answer: 1,
      why: ["With plain INPUT, a button does need a pull-up or pull-down resistor.", "The built-in pull-up keeps the pin HIGH until the button connects it to GND.", "Those are in different circuits.", "Any digital pin can use INPUT_PULLUP."] },
  ] },
};

export const BEGINNER_PROJECTS = [runningLights, toggleLamp, pedestrianCrossing];

// Engineering problem-solving, as engineers do it - used by every project.
export const ENGINEERING_STEPS = [
  ["Identify the problem", "What exactly should it do, and for whom?"],
  ["Understand the requirements", "What must be true for it to count as working?"],
  ["Identify inputs and outputs", "What does it sense? What does it control?"],
  ["Select components", "Which parts can sense and act - safely?"],
  ["Plan the circuit", "Which pin does each part use, and how is it wired?"],
  ["Design the program logic", "In plain words or pseudocode, before any code."],
  ["Build the prototype", "Wire it and write it - one piece at a time."],
  ["Test the system", "Does it meet every requirement?"],
  ["Identify problems", "What's wrong, and why? Check the circuit, then the code."],
  ["Improve the design", "Make it better, safer, or more useful."],
];
