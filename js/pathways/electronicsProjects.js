// The Electronics Engineering pathway's practical projects. Same format as
// the beginner project library (projects/beginner.js), so the same project
// page and builder run them, and every step is checked by running the
// learner's own code and reading their own circuit (lessons/checks.js).
// Each one only uses parts the simulator really runs.
//
// The Level 3 design project (the alarm) is deliberately open: any trigger
// (button or IR sensor), any pins, continuous or beeping sound - the checks
// test the REQUIREMENTS, never one particular answer.

import { item, outputItem, circuit } from "../lessons/checks.js";

const lv = (sim, pin, t) => sim.hardware.levelAt(pin, t);
// An analogRead() input that returns `value` during each [from, to) window.
const phases = (list, fallback) => (pin, t) => (list.find(([a, b]) => t >= a && t < b)?.[2] ?? fallback);
const numbers = (sim) => sim.printed.filter((p) => p.text.trim() !== "").map((p) => ({ t: p.t, v: Number(p.text.trim()) })).filter((p) => Number.isFinite(p.v));
const printedIn = (sim, a, b) => numbers(sim).filter((p) => p.t >= a && p.t < b);
// A part that the circuit check found complete and fault-free, whatever pin it's on.
const goodAny = (findings, kind, test = () => true) => {
  const problems = new Set(findings.filter((f) => f.level === "problem").map((f) => f.id));
  return findings.find((f) => f.level === "ok" && f.id?.startsWith(`${kind}-`) && !problems.has(f.id) && test(f.data || {}));
};

// ================================================================ LED control
const PWM_TARGETS = { 9: [40, 90], 10: [110, 150] };

export const ledControl = {
  id: "pe-led-control",
  pathway: "electronics", pathwayLevel: 2,
  level: "pathway",
  sprite: "led",
  title: "LED Control Circuit",
  summary: "Three LEDs on PWM pins: two at fixed brightness, one breathing - within a safe current budget.",
  problem: "A control panel needs three indicator LEDs: one dim, one at half brightness, and one that slowly \"breathes\" (fades up and down) to show the system is alive.",
  why: "Every device with status lights does this. Controlling brightness with PWM - instead of changing resistors - is how real products dim LEDs and screens.",
  concepts: ["pwm", "led", "resistance"],
  objectives: ["Give each LED its own resistor (parallel branches)", "Set brightness with analogWrite() on PWM pins", "Check the current budget with Kirchhoff's current law"],
  needs: ["l4-1", "l4-2", "m1-8"],
  components: [
    { kind: "LED", count: 3, purpose: "The three indicators.", how: "Light when current flows from + to −.", why: "The outputs.", connects: "Each: its pin → 220Ω → LED + leg; LED − leg → GND." },
    { kind: "Resistor (220Ω)", count: 3, purpose: "One per LED.", how: "Limits each LED to about 14 mA at full brightness.", why: "Separate resistors let each branch be controlled - and fail - on its own.", connects: "In series with its LED." },
  ],
  plan: {
    problem: "Pin 9's LED breathes; pin 10's is at half brightness; pin 11's is fully on.",
    inputs: "None.",
    outputs: "Three LEDs on PWM pins 9, 10 and 11.",
    circuit: ["Pin 9 → 220Ω → LED → GND", "Pin 10 → 220Ω → LED → GND", "Pin 11 → 220Ω → LED → GND"],
    logic: "setup: pin 10 at 128 (half), pin 11 at 255 (full)\nloop: write the breathing level to pin 9\n      change it by a small step; reverse the step at 0 and 255\n      wait about 20 ms",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Three LED branches",
      task: "Wire three LEDs, each with its own 220Ω resistor, to pins 9, 10 and 11.",
      hints: ["Pins 9, 10 and 11 are all PWM pins (marked ~).", "Each branch: pin → resistor → LED long leg; LED short leg → GND."],
      check: { circuit: [circuit.led(9), circuit.led(10), circuit.led(11)] } },
    { id: "levels", kind: "code", title: "Three fixed brightness levels",
      task: "Set pin 9's LED to about a quarter brightness, pin 10's to half, and pin 11's to full.",
      explain: "analogWrite(pin, 0-255) sets the fraction of time the pin is on: 64 is about a quarter, 128 about half, 255 always on. The LED's AVERAGE current - and so its brightness - follows that fraction.",
      hints: ["analogWrite() needs no pinMode(), but adding pinMode(pin, OUTPUT) does no harm.", "analogWrite(9, 64); analogWrite(10, 128); analogWrite(11, 255);"],
      reference: "void setup() {\n  analogWrite(9, 64);\n  analogWrite(10, 128);\n  analogWrite(11, 255);\n}\n\nvoid loop() {\n}",
      check: { ms: 1000, check: (sim) => [
        item(lv(sim, 9, 500) >= 40 && lv(sim, 9, 500) <= 90, "Pin 9 is at about a quarter brightness (about 64)", `Pin 9 is at ${lv(sim, 9, 500)} - aim for about 64 out of 255.`),
        item(lv(sim, 10, 500) >= 110 && lv(sim, 10, 500) <= 150, "Pin 10 is at about half brightness (about 128)", `Pin 10 is at ${lv(sim, 10, 500)} - aim for about 128 out of 255.`),
        item(lv(sim, 11, 500) >= 240, "Pin 11 is fully on", "Pin 11 should be fully on: analogWrite(11, 255) (or digitalWrite HIGH with pinMode OUTPUT)."),
      ] } },
    { id: "breathe", kind: "code", title: "Make pin 9 breathe",
      task: "Now make pin 9's LED fade smoothly up to full and back down, over and over - about a second each way. Keep pins 10 and 11 as they were.",
      explain: "Keep the current level in a variable, change it by a small step each time round loop(), and flip the step's sign at the ends.",
      hints: ["int level = 0; int step = 5; at the top of the sketch.", "In loop(): analogWrite(9, level); level = level + step; then if (level <= 0 || level >= 255) step = -step; then delay(20);"],
      check: { ms: 3000, check: (sim) => breatheItems(sim) } },
  ],
  challenge: {
    objective: "Pin 10's LED at half brightness, pin 11's fully on, and pin 9's fading smoothly up and down, about a second each way.",
    constraints: ["Each LED on its own PWM pin with its own resistor.", "Any code that behaves this way is right - a for loop, a variable that steps, or millis() timing."],
    hints: ["Brightness is analogWrite(pin, 0-255).", "Fading is many small analogWrite() steps with a short delay between."],
  },
  independent: {
    problem: "A status panel needs three LEDs: half brightness, full brightness, and one that breathes.",
    requirements: ["Pin 10: half brightness. Pin 11: full.", "Pin 9: fades between off and full and back, smoothly, continuously.", "Every LED has its own resistor."],
    limits: ["Pins 9, 10 and 11 (PWM).", "The simulator shows brightness but doesn't measure the LEDs' current - use Kirchhoff's current law to check the budget yourself."],
  },
  final: { ms: 3000, circuit: [circuit.led(9), circuit.led(10), circuit.led(11)], check: (sim) => [
    item(lv(sim, 10, 1500) >= 110 && lv(sim, 10, 1500) <= 150, "Pin 10 stays at about half brightness", `Pin 10 is at ${lv(sim, 10, 1500)} - it should stay at about 128.`),
    item(lv(sim, 11, 1500) >= 240, "Pin 11 is fully on", "Pin 11 should be fully on."),
    ...breatheItems(sim),
  ] },
  reference: "int level = 0;\nint step = 5;\n\nvoid setup() {\n  pinMode(9, OUTPUT);\n  pinMode(10, OUTPUT);\n  pinMode(11, OUTPUT);\n  analogWrite(10, 128);\n  analogWrite(11, 255);\n}\n\nvoid loop() {\n  analogWrite(9, level);\n  level = level + step;\n  if (level <= 0 || level >= 255) {\n    step = -step;\n  }\n  delay(20);\n}",
  previewPins: [9, 10, 11],
  previewMs: 3000,
  previewNote: "Shaded = on. Pin 9 (breathing) is only fully off for an instant at the bottom of each fade; brightness itself isn't drawn.",
  wiring: { parts: [
    { key: "r1", kind: "resistor" }, { key: "l1", kind: "led" }, { key: "r2", kind: "resistor" }, { key: "l2", kind: "led" }, { key: "r3", kind: "resistor" }, { key: "l3", kind: "led" },
  ], wires: [
    ["pin-9", "r1.1"], ["r1.2", "l1.a"], ["l1.k", "gnd"], ["pin-10", "r2.1"], ["r2.2", "l2.a"], ["l2.k", "gnd"], ["pin-11", "r3.1"], ["r3.2", "l3.a"], ["l3.k", "gnd"],
  ] },
  troubleshooting: [
    { problem: "One LED only switches fully on or off, never dims.", fix: "It's on a pin without PWM. Only 3, 5, 6, 9, 10 and 11 can dim." },
    { problem: "The fade jumps instead of being smooth.", fix: "Use smaller steps (5 or less) and a short delay (10-30 ms)." },
    { problem: "The breathing LED stays at full after one fade.", fix: "The step has to reverse at the top: if (level >= 255) step = -step;" },
  ],
  improvements: [
    { title: "Current budget", task: "With 220Ω resistors and ~2 V LEDs, each LED draws up to about 14 mA. Write down the worst-case total from the Arduino (Kirchhoff's current law) and compare it with the chip's ~200 mA limit." },
    { title: "Breathe with millis()", task: "Rewrite the breathing with millis() instead of delay(), so the sketch could also read a button at the same time." },
  ],
  knowledge: { id: "quiz-project-pe-led-control", type: "questions", title: "Project Check", topic: "LED Control Circuit", questions: [
    { q: "Why does each LED have its own resistor, rather than one resistor for all three?", options: ["To save resistors", "So each branch's current is set on its own - with one shared resistor, the LEDs would fight over the current", "Because the simulator needs it", "So they're in series"], answer: 1,
      why: ["It uses more resistors, not fewer.", "Each branch is its own loop; a shared resistor would make every LED's current depend on the others.", "This is about real electronics, not the simulator.", "Separate resistors put the branches in parallel."] },
    { q: "Pin 10 is at analogWrite 128. Compared with full brightness, its average current is about:", options: ["The same", "Half", "A quarter", "Zero"], answer: 1,
      why: ["It's only on part of the time.", "PWM switches fully on about half the time, so the average current is about half.", "That would be about 64.", "It's on half the time."] },
    { q: "All three LEDs at full brightness draw about 14 mA each. What's the total from the Arduino?", options: ["14 mA", "28 mA", "42 mA", "200 mA"], answer: 2,
      why: ["That's one branch.", "That's two branches.", "Kirchhoff's current law: 3 × 14 = 42 mA - fine for the chip.", "That's roughly the chip's total LIMIT, not this circuit's current."] },
  ] },
};

function breatheItems(sim) {
  const levels = [];
  for (let t = 0; t <= 3000; t += 20) levels.push(lv(sim, 9, t));
  const distinct = new Set(levels).size;
  const maxAt = levels.indexOf(Math.max(...levels));
  const fallsAfterPeak = levels.slice(maxAt).some((v) => v < Math.max(...levels) - 100);
  const writesTo9 = sim.calls.filter((c) => c.name === "analogWrite" && c.args[0] === 9).length;
  return [
    item(writesTo9 > 0, "Pin 9 is driven with analogWrite()", "Use analogWrite(9, level) to set pin 9's brightness - digitalWrite can only switch fully on or off."),
    item(distinct >= 10, "Pin 9's brightness changes smoothly (many levels)", `Pin 9 only used ${distinct} different brightness levels - change it in small steps.`),
    item(Math.max(...levels) >= 240 && Math.min(...levels) <= 15, "It fades all the way up and all the way down", "The fade should reach (almost) full and (almost) off."),
    item(fallsAfterPeak, "It fades back down after reaching the top - and keeps going", "After reaching the top, it should fade back down again."),
  ];
}

// ================================================================ divider meter
const DV_INPUTS = { analogRead: phases([[0, 1000, 0], [1000, 2000, 512]], 1023) };
const near = (v, target, tol = 0.03) => Math.abs(v - target) <= tol;
const potPowered = (findings) => {
  const pot = goodAny(findings, "potentiometer", (d) => d.pin === 14);
  const unpowered = pot && findings.some((f) => f.level === "real" && f.id === pot.id && /outer legs/.test(f.text));
  return item(pot && !unpowered, "Circuit: potentiometer as a divider - outer legs on 5V and GND, middle leg on A0",
    pot ? "Circuit: connect the potentiometer's outer legs to 5V and GND - without both ends, it isn't a divider (the simulator reads the knob anyway, a real one wouldn't)." : "Circuit: wire the potentiometer's middle leg (W) to A0, and its outer legs to 5V and GND.", true);
};
function voltItems(sim) {
  const low = printedIn(sim, 0, 1000), mid = printedIn(sim, 1000, 2000), high = printedIn(sim, 2000, 3000);
  const allInts = numbers(sim).length > 0 && numbers(sim).every((p) => Number.isInteger(p.v));
  return [
    item(low.some((p) => near(p.v, 0)), "A reading of 0 prints 0.00 V", "With the knob at 0, it should print 0.00."),
    item(mid.some((p) => near(p.v, 2.5)), "A reading of 512 prints about 2.50 V",
      allInts ? "It only prints whole numbers - reading * 5 / 1023 with ints throws away the decimals. Use 5.0 so the maths is done in decimals, and store it in a float." : `With the knob in the middle (512) it should print about 2.50 (volts = reading × 5.0 ÷ 1023).`),
    item(high.some((p) => near(p.v, 5)), "A reading of 1023 prints 5.00 V", "With the knob at the top (1023) it should print 5.00."),
  ];
}

export const dividerMeter = {
  id: "pe-divider-meter",
  pathway: "electronics", pathwayLevel: 2,
  level: "pathway",
  sprite: "chart",
  title: "Voltage Divider Meter",
  summary: "Turn a potentiometer - a voltage divider - and print the voltage it makes, in volts.",
  problem: "Build a simple voltmeter: it measures the voltage from a potentiometer (a voltage divider) twice a second and prints it in volts, from 0.00 to 5.00.",
  why: "Measuring a voltage and converting it to real units is the core of every sensor reading - from a battery-level indicator to a digital thermometer.",
  concepts: ["analogread", "potentiometer", "resistance"],
  objectives: ["Wire a potentiometer as a voltage divider", "Read it with analogRead()", "Convert the 0-1023 reading into volts with decimal maths"],
  needs: ["l3-2", "l3-3", "l1-9"],
  components: [
    { kind: "Potentiometer (10kΩ)", count: 1, purpose: "An adjustable voltage divider.", how: "Its middle leg slides between the two outer legs.", why: "Gives every voltage from 0 V to 5 V as you turn it.", connects: "Outer legs to 5V and GND; middle leg (W) to A0." },
  ],
  plan: {
    problem: "Print the voltage on A0, in volts, twice a second.",
    inputs: "The potentiometer's middle leg on A0.",
    outputs: "The Serial Monitor.",
    circuit: ["Potentiometer + leg → 5V", "Potentiometer − leg → GND", "Potentiometer W (middle) → A0"],
    logic: "setup: start Serial\nloop: reading = analogRead(A0)\n      volts = reading × 5.0 ÷ 1023\n      print volts\n      wait 500 ms",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Wire the divider",
      task: "Wire the potentiometer as a voltage divider: outer legs to 5V and GND, middle leg to A0.",
      hints: ["The legs are marked + (5V), W (middle, to A0) and − (GND).", "A divider needs BOTH ends: 5V at one end and GND at the other."],
      check: { circuit: [potPowered] } },
    { id: "raw", kind: "code", title: "Print the raw reading",
      task: "Print what analogRead(A0) gives, twice a second.",
      explain: "analogRead() turns 0-5 V into 0-1023. Seeing the raw number first makes the conversion in the next step easy to check.",
      hints: ["Serial.begin(9600); in setup().", "Serial.println(analogRead(A0)); delay(500);"],
      reference: "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0));\n  delay(500);\n}",
      check: { ms: 3000, inputs: DV_INPUTS, check: (sim) => [
        item([0, 512, 1023].every((v) => numbers(sim).some((p) => p.v === v)), "It prints the raw readings (0, 512, 1023)", "Print the reading itself: Serial.println(analogRead(A0));"),
      ] } },
    { id: "volts", kind: "code", title: "Convert to volts",
      task: "Print volts instead of the raw reading: 0.00 at the bottom, 2.50 in the middle, 5.00 at the top.",
      explain: "volts = reading × 5.0 ÷ 1023. The 5.0 matters: with only whole numbers, C++ does whole-number division and throws the decimals away.",
      hints: ["float volts = analogRead(A0) * 5.0 / 1023;", "Serial.println(volts); prints it with two decimal places."],
      check: { ms: 3000, inputs: DV_INPUTS, check: (sim) => voltItems(sim) } },
    { id: "rate", kind: "code", title: "Twice a second",
      task: "Make sure it prints about twice a second - often enough to follow the knob, not so often the numbers blur.",
      hints: ["delay(500); at the end of loop()."],
      check: { ms: 3000, inputs: DV_INPUTS, check: (sim) => [rateItem(sim)] } },
  ],
  challenge: {
    objective: "Print the potentiometer's voltage in volts (0.00-5.00), about twice a second.",
    constraints: ["Potentiometer wired as a divider: outer legs to 5V and GND, middle leg to A0.", "Either 1023 or 1024 in the conversion is accepted - say which you chose, and why, in your log."],
    hints: ["Do the maths with decimals: 5.0, not 5.", "A float holds a decimal number."],
  },
  independent: {
    problem: "Make a voltmeter that shows the voltage from a potentiometer in volts.",
    requirements: ["Shows 0.00 V at one end, 5.00 V at the other, 2.50 V in the middle.", "Updates about twice a second."],
    limits: ["A potentiometer on A0, and the Serial Monitor.", "The simulator's knob sets the reading directly; a real board's readings jitter by a step or two."],
  },
  final: { ms: 3000, inputs: DV_INPUTS, circuit: [potPowered], check: (sim) => [...voltItems(sim), rateItem(sim)] },
  reference: "void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int reading = analogRead(A0);\n  float volts = reading * 5.0 / 1023;\n  Serial.println(volts);\n  delay(500);\n}",
  previewInputs: DV_INPUTS,
  previewPins: [],
  previewPrinted: true,
  previewMs: 3000,
  previewNote: "The knob is at 0 for the first second, the middle for the next, then the top.",
  wiring: { parts: [{ key: "p", kind: "potentiometer" }], wires: [["p.v", "5v"], ["p.g", "gnd"], ["p.w", "pin-14"]] },
  troubleshooting: [
    { problem: "It prints 0, 2, 5 - no decimals.", fix: "Whole-number division. Write 5.0 instead of 5, and store the result in a float." },
    { problem: "It prints 2.5 in the middle but 4.99 at the top.", fix: "You divided by 1024. Both conventions are used; 1023 makes the top read exactly 5.00." },
    { problem: "On a real board, the reading never changes.", fix: "The outer legs aren't on 5V and GND, so the middle leg has no voltage to divide." },
  ],
  improvements: [
    { title: "Over-voltage warning", task: "Add an LED on pin 13 that lights whenever the voltage is above 4.0 V.",
      check: { ms: 3000, inputs: DV_INPUTS, check: (sim) => [
        item(lv(sim, 13, 500) === 0 && lv(sim, 13, 1500) === 0, "The LED is off at 0 V and 2.5 V", "The warning LED should be off below 4.0 V."),
        item(lv(sim, 13, 2500) > 0, "The LED is on at 5 V", "The warning LED (pin 13) should light above 4.0 V."),
      ] } },
    { title: "Percentage", task: "Also print the knob position as a percentage (0-100%), using map()." },
  ],
  knowledge: { id: "quiz-project-pe-divider-meter", type: "questions", title: "Project Check", topic: "Voltage Divider Meter", questions: [
    { q: "Why write 5.0 rather than 5 in the conversion?", options: ["It's faster", "So C++ does the division with decimals instead of whole numbers", "Because analogRead needs it", "It makes no difference"], answer: 1,
      why: ["Speed isn't the reason.", "512 * 5 / 1023 in whole numbers is 2; with 5.0 it's 2.502.", "analogRead() returns a whole number either way.", "It's the difference between 2 and 2.50."] },
    { q: "The knob is a quarter of the way up. Roughly what should it print?", options: ["0.25", "1.25", "2.50", "256"], answer: 1,
      why: ["That's the fraction, not the voltage.", "A quarter of 5 V is 1.25 V.", "That's halfway.", "That's the raw reading - the step before converting."] },
    { q: "On a real potentiometer, what happens if the GND end isn't connected?", options: ["Nothing changes", "The middle leg reads 5 V (or floats) - it's no longer a divider", "It reads backwards", "It reads 2.5 V"], answer: 1,
      why: ["A divider needs both ends connected.", "With only one end connected, there's nothing to divide between.", "It doesn't reverse - it stops dividing.", "There's no fixed midpoint without both ends."] },
  ] },
};

function rateItem(sim) {
  const perSecond = numbers(sim).length / 3;
  return item(perSecond >= 1.5 && perSecond <= 3, "About two readings a second", `It prints about ${perSecond.toFixed(1)} readings a second - aim for 2: delay(500).`);
}

// ================================================================ light circuit
const LC_INPUTS = { analogRead: phases([[0, 1000, 800], [1000, 2000, 150]], 800) };
const LC_HYST = { analogRead: phases([[0, 1000, 800], [1000, 2000, 350], [2000, 3000, 150], [3000, 4000, 350]], 800) };

export const lightCircuit = {
  id: "pe-light-circuit",
  pathway: "electronics", pathwayLevel: 2,
  level: "pathway",
  sprite: "bulb",
  title: "Light-Sensitive Circuit",
  summary: "A night light: a light sensor switches an LED on when it gets dark.",
  problem: "Make a night light: it watches the light level and switches its LED on when it gets dark, and off again when it's bright.",
  why: "Street lights, phone screens and garden lights all switch or dim themselves from a light sensor - the sensor is a voltage divider underneath.",
  concepts: ["light", "analogread", "if"],
  objectives: ["Read a light sensor (an LDR in a divider)", "Choose a threshold from measured readings", "Switch an output from an analog input"],
  needs: ["l3-5", "l3-6"],
  components: [
    { kind: "Light sensor", count: 1, purpose: "Measures the light level.", how: "Inside: an LDR and a fixed resistor forming a divider - more light, higher reading.", why: "The input.", connects: "S leg to A0, − leg to GND." },
    { kind: "LED", count: 1, purpose: "The night light.", how: "Lights when pin 13 is HIGH.", why: "The output.", connects: "Pin 13 → 220Ω → LED + leg; LED − leg → GND." },
    { kind: "Resistor (220Ω)", count: 1, purpose: "Limits the LED's current.", how: "About 14 mA.", why: "Protects the LED and pin.", connects: "In series with the LED." },
  ],
  plan: {
    problem: "LED on when the reading is low (dark), off when it's high (bright).",
    inputs: "Light sensor on A0: about 0 in darkness, up to 1023 in bright light.",
    outputs: "LED on pin 13.",
    circuit: ["Light sensor S → A0, − → GND", "Pin 13 → 220Ω → LED → GND"],
    logic: "loop: light = analogRead(A0)\n      print light\n      if light < threshold: LED on\n      else: LED off",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Wire the sensor and the LED",
      task: "Light sensor on A0; LED with its resistor on pin 13.",
      hints: ["The light sensor's S leg goes to A0, its − leg to GND.", "LED: pin 13 → resistor → LED + → LED − → GND."],
      check: { circuit: [circuit.ldr, circuit.led(13)] } },
    { id: "measure", kind: "code", title: "Measure the light",
      task: "Print the light reading about ten times a second, and watch it as you move the sensor's slider. Note the readings in bright and dark conditions.",
      explain: "Choosing a threshold starts with measuring: you can't pick a sensible \"dark\" value until you've seen real readings.",
      hints: ["Serial.begin(9600); in setup().", "Serial.println(analogRead(A0)); delay(100);"],
      check: { ms: 2000, inputs: LC_INPUTS, check: (sim) => [
        item([800, 150].every((v) => numbers(sim).some((p) => p.v === v)), "It prints the light readings", "Print the reading: Serial.println(analogRead(A0));"),
      ] } },
    { id: "switch", kind: "code", title: "Switch on in the dark",
      task: "Light the LED when the reading is below your threshold (darker), and switch it off above it.",
      explain: "Pick a threshold between your bright and dark readings - for example 300. A named constant (const int DARK = 300;) makes it easy to tune later.",
      hints: ["pinMode(13, OUTPUT); in setup().", "if (analogRead(A0) < 300) { LED on } else { LED off }"],
      check: { ms: 3000, inputs: LC_INPUTS, check: (sim) => lightItems(sim) } },
  ],
  challenge: {
    objective: "The LED on pin 13 is on when it's dark and off when it's bright.",
    constraints: ["Light sensor on A0, LED on pin 13 with its resistor.", "Any threshold between the bright and dark readings is fine - note yours in the log."],
    hints: ["Measure first: print the readings.", "Low reading = dark."],
  },
  independent: {
    problem: "Make an automatic night light.",
    requirements: ["Off in bright light (a reading around 800).", "On in the dark (a reading around 150).", "Back off when it's bright again."],
    limits: ["A light sensor on A0 and an LED on pin 13.", "The simulated sensor is a module set by a slider; a real LDR needs a fixed resistor to form the divider."],
  },
  final: { ms: 3000, inputs: LC_INPUTS, circuit: [circuit.ldr, circuit.led(13)], check: (sim) => lightItems(sim) },
  reference: "const int DARK = 300;\n\nvoid setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int light = analogRead(A0);\n  Serial.println(light);\n  if (light < DARK) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n  delay(100);\n}",
  previewInputs: LC_INPUTS,
  previewPins: [13],
  previewLabels: { 13: "LED" },
  previewMs: 3000,
  previewNote: "Bright (800) for the first second, dark (150) for the next, then bright again.",
  wiring: { parts: [{ key: "s", kind: "ldr" }, { key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
    wires: [["s.s", "pin-14"], ["s.g", "gnd"], ["pin-13", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
  troubleshooting: [
    { problem: "The LED is on in the light and off in the dark.", fix: "The comparison is the wrong way round: a LOW reading means dark." },
    { problem: "Near the threshold, the LED flickers.", fix: "The reading wobbles around the threshold. Use two thresholds (hysteresis) - see the improvement." },
    { problem: "It never switches.", fix: "Print the readings and check your threshold is between the bright and dark values." },
  ],
  improvements: [
    { title: "Hysteresis (no flicker)", task: "Switch ON below 300 but only OFF above 400. Between the two, keep doing whatever it was doing - so a reading wobbling around one value can't make it flicker.",
      check: { ms: 5000, inputs: LC_HYST, check: (sim) => [
        item(lv(sim, 13, 500) === 0 && lv(sim, 13, 1500) === 0, "Bright, then in-between (350): stays off", "At 350 - between the two thresholds - it should keep its previous state (off)."),
        item(lv(sim, 13, 2500) > 0, "Dark (150): on", "Below 300 it should switch on."),
        item(lv(sim, 13, 3500) > 0, "In-between (350) after dark: stays on", "At 350 after being on, it should STAY on - only above 400 does it switch off."),
        item(lv(sim, 13, 4500) === 0, "Bright (800): off", "Above 400 it should switch off."),
      ] } },
    { title: "Dimmer, not a switch", task: "Move the LED to pin 9 and make it brighter the darker it gets, using map() and analogWrite()." },
  ],
  knowledge: { id: "quiz-project-pe-light-circuit", type: "questions", title: "Project Check", topic: "Light-Sensitive Circuit", questions: [
    { q: "Inside a light sensor module, the LDR and a fixed resistor form what?", options: ["A short circuit", "A voltage divider", "A transistor switch", "A pull-down"], answer: 1,
      why: ["There's resistance in both parts - no short.", "The LDR's resistance changes with light, so the divider's output voltage changes - that's what A0 reads.", "No transistor is needed to read it.", "A pull-down holds a digital input LOW - this is an analog divider."] },
    { q: "Why measure the readings before choosing a threshold?", options: ["The simulator requires it", "Because the right threshold depends on the actual readings in your conditions", "To make the LED brighter", "It isn't necessary"], answer: 1,
      why: ["It's good engineering, not a simulator rule.", "Different sensors and rooms give different numbers - measure, then decide.", "Measuring doesn't change the LED.", "Guessing a threshold is how night lights end up never switching."] },
    { q: "What does hysteresis prevent?", options: ["The LED burning out", "Rapid flickering when the reading hovers around one threshold", "The sensor reading backwards", "Floating inputs"], answer: 1,
      why: ["The resistor protects the LED.", "Two thresholds with a gap mean small wobbles can't flip the output back and forth.", "Direction comes from the wiring and the comparison.", "Floating is a digital-input problem, solved with pull resistors."] },
  ] },
};

function lightItems(sim) {
  return [
    outputItem(sim, 13, "LED"),
    item(lv(sim, 13, 500) === 0, "Bright (800): the LED is off", "In bright light (800) the LED should be off - remember, a high reading means bright."),
    item(lv(sim, 13, 1500) > 0, "Dark (150): the LED is on", "In the dark (150) the LED should be on."),
    item(lv(sim, 13, 2500) === 0, "Bright again: it switches off", "When it's bright again, the LED should switch off."),
  ];
}

// ================================================================ alarm (design)
// Every input pin reads LOW from 1.5 s to 1.7 s - a button pressed (with
// INPUT_PULLUP) or an IR sensor seeing an object, whichever the design uses.
const TRIGGER = [1500, 1700];
const AL_INPUTS = { digitalRead: (pin, t) => (t >= TRIGGER[0] && t < TRIGGER[1] ? 0 : 1) };

function soundingAt(sim, t) {
  const pins = [...new Set(sim.hardware.sounds.map((s) => s.pin))];
  return pins.some((p) => sim.hardware.soundAt(p, t) !== null);
}
const soundingIn = (sim, a, b) => { for (let t = a; t < b; t += 5) if (soundingAt(sim, t)) return true; return false; };

function alarmItems(sim, { latch = true, led = true } = {}) {
  const soundPins = new Set(sim.hardware.sounds.map((s) => s.pin));
  const items = [
    item(soundPins.size > 0 && !soundingIn(sim, 0, TRIGGER[0]), "Silent while nothing is detected",
      soundPins.size ? "It makes a sound before anything is detected - it should stay silent until the trigger." : "It never makes a sound - use tone(pin, frequency) on the buzzer's pin when the trigger is detected."),
    item(soundingIn(sim, TRIGGER[0], TRIGGER[0] + 500), "Sounds within 0.5 s of a detection", "It should start sounding within half a second of the trigger (which reads LOW)."),
  ];
  if (latch) {
    const windows = [];
    for (let a = TRIGGER[1] + 500; a < TRIGGER[1] + 3000; a += 500) windows.push(soundingIn(sim, a, a + 500));
    items.push(item(windows.every(Boolean), "Keeps sounding for at least 3 s after the trigger has gone",
      "It stops when the trigger goes away - remember that it was triggered (a variable, or a time from millis()) and keep sounding for at least 3 seconds."));
  }
  if (led) {
    const ledPins = Object.entries(sim.hardware.modes).filter(([p, m]) => m === "OUTPUT" && !soundPins.has(Number(p))).map(([p]) => Number(p));
    const flashing = ledPins.find((p) => {
      const changes = sim.hardware.events.filter((e) => e.pin === p && e.t >= TRIGGER[0] && e.t < TRIGGER[1] + 3000);
      const quietBefore = sim.hardware.events.filter((e) => e.pin === p && e.t > 50 && e.t < TRIGGER[0]).every((e) => e.level === 0);
      return changes.length >= 4 && quietBefore && lv(sim, p, TRIGGER[0] - 10) === 0;
    });
    items.push(item(flashing !== undefined, "A warning LED flashes while the alarm sounds (and is off before)",
      ledPins.length ? "Make the warning LED flash on and off while the alarm is sounding, and stay off before it's triggered." : "Add a warning LED on an OUTPUT pin that flashes while the alarm sounds."));
  }
  return items;
}

const triggerWired = (findings) => item(
  goodAny(findings, "button", (d) => d.to === "gnd") || goodAny(findings, "irsensor"),
  "Circuit: a trigger - a button to GND, or an IR sensor",
  "Circuit: wire a trigger: a button between a pin and GND (with INPUT_PULLUP), or an IR sensor's S leg to a pin and − to GND.", true);
const buzzerWired = (findings) => item(goodAny(findings, "buzzer"), "Circuit: a buzzer on a pin, − leg to GND", "Circuit: wire a buzzer's + leg to a pin and its − leg to GND.", true);
const ledWired = (findings) => {
  const led = goodAny(findings, "led", (d) => typeof d.pin === "number");
  return item(led && led.data.resistor, "Circuit: a warning LED on a pin, with its resistor",
    led ? "Circuit: your LED needs a resistor in series." : "Circuit: wire a warning LED: pin → resistor → LED + leg; LED − leg → GND.", true);
};

export const alarmDesign = {
  id: "pe-alarm",
  pathway: "electronics", pathwayLevel: 3,
  level: "pathway",
  sprite: "shield",
  title: "Simple Electronic Alarm",
  summary: "Design challenge: an alarm that detects, sounds, latches and warns - your choice of parts and pins.",
  problem: "Design an alarm for a storeroom door. When something is detected it must sound quickly, keep sounding even if the intruder steps away, and flash a warning light. You choose the trigger, the pins and the sound - and justify your choices.",
  why: "This is how engineering briefs look: requirements, not instructions. There are many correct designs; yours is judged on whether it meets each requirement and on the reasons you give.",
  concepts: ["buttons", "buzzer", "millis", "if"],
  objectives: ["Turn requirements into a circuit and a program", "Choose components and justify the choice", "Test against each requirement - including what happens after the trigger stops"],
  needs: ["l4-3", "l2-8", "l5-6"],
  components: [
    { kind: "Trigger: push button OR IR sensor", count: 1, purpose: "Detects the intruder.", how: "Both read LOW when triggered (button pressed with INPUT_PULLUP; IR sensor sees an object).", why: "Your choice - write down why in the log.", connects: "Button: pin → button → GND. IR sensor: S → pin, − → GND." },
    { kind: "Buzzer", count: 1, purpose: "The alarm sound.", how: "tone(pin, frequency) makes a note.", why: "An audible warning.", connects: "+ leg → a pin, − leg → GND." },
    { kind: "LED + 220Ω resistor", count: 1, purpose: "The warning light.", how: "Flashes while the alarm is active.", why: "A visible warning (and useful when testing quietly).", connects: "Pin → 220Ω → LED + leg; LED − leg → GND." },
  ],
  plan: {
    problem: "Detect → sound within 0.5 s → keep sounding ≥ 3 s after the trigger stops → flash the warning LED.",
    inputs: "Your trigger (reads LOW when triggered).",
    outputs: "A buzzer and a warning LED.",
    circuit: ["Trigger on a digital pin (INPUT_PULLUP for a button)", "Buzzer + leg on a pin, − to GND", "LED with resistor on a pin"],
    logic: "if the trigger reads LOW: remember the alarm (alarmUntil = millis() + 5000)\nif millis() < alarmUntil:\n   sound the buzzer, flash the LED (on/off every 250 ms)\nelse: silence, LED off",
  },
  steps: [
    { id: "circuit", kind: "circuit", title: "Choose and wire your parts",
      task: "Wire your trigger (a button to GND, or an IR sensor), a buzzer, and a warning LED with its resistor - on pins of your choice. Note your choices and reasons in the project log.",
      hints: ["A button needs no resistor if you use INPUT_PULLUP.", "Any free digital pins will do - avoid 0 and 1 (Serial)."],
      check: { circuit: [triggerWired, buzzerWired, ledWired] } },
    { id: "detect", kind: "code", title: "Requirements 1 and 2: silent, then respond",
      task: "Stay silent while nothing is detected; sound within half a second of a detection. (The check triggers it at 1.5 s for 0.2 s.)",
      explain: "Your trigger reads LOW when it detects something. Start with the simplest version: sound while it's LOW.",
      hints: ["if (digitalRead(TRIGGER) == LOW) { tone(BUZZER, 1000); } else { noTone(BUZZER); }"],
      reference: "void setup() {\n  pinMode(2, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    tone(8, 1000);\n  } else {\n    noTone(8);\n  }\n}",
      check: { ms: 2500, inputs: AL_INPUTS, check: (sim) => alarmItems(sim, { latch: false, led: false }) } },
    { id: "latch", kind: "code", title: "Requirement 3: keep sounding",
      task: "An intruder who steps away mustn't silence it: keep sounding for at least 3 seconds after the trigger stops.",
      explain: "The alarm has to REMEMBER it was triggered. A good way: on detection, store the time it should stop - millis() + 5000 - and sound while millis() is less than that.",
      hints: ["unsigned long alarmUntil = 0; at the top.", "On detection: alarmUntil = millis() + 5000; then: if (millis() < alarmUntil) sound, else silence."],
      check: { ms: 5000, inputs: AL_INPUTS, check: (sim) => alarmItems(sim, { latch: true, led: false }) } },
    { id: "warn", kind: "code", title: "Requirement 4: the warning light",
      task: "Flash the warning LED while the alarm is active, and keep it off otherwise.",
      hints: ["(millis() / 250) % 2 flips between 0 and 1 every 250 ms.", "if ((millis() / 250) % 2 == 0) LED on, else off - only while the alarm is active."],
      check: { ms: 5000, inputs: AL_INPUTS, check: (sim) => alarmItems(sim) } },
  ],
  challenge: {
    objective: "Meet all four requirements: silent when nothing is detected; sounds within 0.5 s; keeps sounding ≥ 3 s after the trigger stops; a warning LED flashes while it sounds.",
    constraints: ["Your choice of trigger (button or IR sensor - both read LOW when triggered), pins, tone and pattern.", "The check triggers EVERY input at 1.5 s for 0.2 s - so leave out a reset button for this test.", "Write your design decisions in the project log: they're part of the evaluation."],
    hints: ["Remember the alarm with a time from millis(), not with delay().", "Beeping counts as sounding, as long as there's no silence longer than half a second."],
  },
  independent: {
    problem: "Design a storeroom alarm.",
    requirements: ["R1: silent while nothing is detected.", "R2: sounds within 0.5 s of a detection.", "R3: keeps sounding for at least 3 s after the trigger stops.", "R4: a warning LED flashes while it sounds."],
    limits: ["Any of: button, IR sensor, buzzer, LED, resistors - on any pins.", "The check presses every input at 1.5 s for 0.2 s.", "On a real board, a button bounces: check that a bounce can't confuse your design."],
  },
  final: { ms: 5000, inputs: AL_INPUTS, circuit: [triggerWired, buzzerWired, ledWired], check: (sim) => alarmItems(sim) },
  reference: "const int TRIGGER = 2;\nconst int BUZZER = 8;\nconst int WARNING_LED = 13;\nunsigned long alarmUntil = 0;\nbool sounding = false;\n\nvoid setup() {\n  pinMode(TRIGGER, INPUT_PULLUP);\n  pinMode(WARNING_LED, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(TRIGGER) == LOW) {\n    alarmUntil = millis() + 5000;\n  }\n  bool active = millis() < alarmUntil;\n  if (active && !sounding) {\n    tone(BUZZER, 1000);\n    sounding = true;\n  }\n  if (!active && sounding) {\n    noTone(BUZZER);\n    sounding = false;\n  }\n  if (active && (millis() / 250) % 2 == 0) {\n    digitalWrite(WARNING_LED, HIGH);\n  } else {\n    digitalWrite(WARNING_LED, LOW);\n  }\n  delay(10);\n}",
  previewInputs: AL_INPUTS,
  previewPins: [8, 13],
  previewSoundPins: [8],
  previewLabels: { 8: "buzzer", 13: "LED" },
  previewMs: 5000,
  previewNote: "One possible design. The trigger reads LOW from 1.5 s to 1.7 s; the alarm keeps going after it.",
  wiring: { parts: [{ key: "b", kind: "button" }, { key: "z", kind: "buzzer" }, { key: "r", kind: "resistor" }, { key: "led", kind: "led" }],
    wires: [["pin-2", "b.1"], ["b.2", "gnd"], ["pin-8", "z.s"], ["z.g", "gnd"], ["pin-13", "r.1"], ["r.2", "led.a"], ["led.k", "gnd"]] },
  troubleshooting: [
    { problem: "It stops as soon as the trigger stops.", fix: "It's following the trigger. Store WHEN it was triggered (or until when it should sound) in a variable." },
    { problem: "It sounds all the time.", fix: "Check the trigger's logic: with INPUT_PULLUP, triggered reads LOW and idle reads HIGH." },
    { problem: "The LED doesn't flash, it's just on.", fix: "Something has to switch it off and on again: use (millis() / 250) % 2 to alternate." },
    { problem: "It ignores a quick trigger.", fix: "A long delay() means it isn't reading the trigger most of the time - keep loop() fast and time things with millis()." },
  ],
  improvements: [
    { title: "Reset button", task: "Add a second button that silences the alarm early - and think about what happens if it's held down while the trigger fires (write your decision in the log)." },
    { title: "Arming delay", task: "Ignore the trigger for 10 seconds after power-up, so the owner can leave the room." },
    { title: "Power budget", task: "Estimate the current while idle and while sounding, and how long a 2000 mAh battery would last in each state." },
  ],
  knowledge: { id: "quiz-project-pe-alarm", type: "questions", title: "Project Check", topic: "Simple Electronic Alarm", questions: [
    { q: "Why use millis() to keep the alarm going, rather than delay(5000)?", options: ["millis() is more accurate", "With delay(), the sketch can't do anything else - like flash the LED or read inputs - while it waits", "delay() doesn't work with tone()", "There's no difference"], answer: 1,
      why: ["Both are accurate enough here.", "delay() freezes the whole sketch; a time stored from millis() lets loop() keep running.", "tone() keeps playing during a delay - that isn't the problem.", "The difference is whether the sketch can do several things at once."] },
    { q: "Why test what the alarm does AFTER the trigger stops?", options: ["To save power", "Because requirement 3 is about exactly that - and it's where many designs fail", "To check the LED's resistor", "It isn't important"], answer: 1,
      why: ["Power isn't the point of this test.", "A requirement isn't met until it's been tested; \"keeps sounding\" can only be tested after the trigger stops.", "That's a circuit check.", "An alarm that stops when the intruder steps away isn't doing its job."] },
    { q: "Two students build different alarms - one with a button and continuous tone, one with an IR sensor and beeps. Both pass every requirement. Which is correct?", options: ["Only the button one", "Only the IR one", "Both - each meets the requirements; the better design is the one whose choices are best justified for the situation", "Neither"], answer: 2,
      why: ["Requirements don't say which trigger to use.", "Both triggers meet the requirements.", "Engineering problems usually have many valid solutions; reasons decide between them (an IR sensor needs no contact, a button is cheaper and simpler...).", "Both meet every requirement."] },
  ] },
};

export const ELECTRONICS_PROJECTS = [ledControl, dividerMeter, lightCircuit, alarmDesign];
