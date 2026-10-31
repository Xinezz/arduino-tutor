// The virtual Arduino board: owns all hardware state (pin modes, pin output
// levels, analog input levels, which components are wired to which pins,
// which buttons/sensors are currently active) and draws it as an SVG. The
// interpreter never touches the DOM directly - it only calls the small API
// this module exposes, which keeps the "language" and the "hardware"
// cleanly separated, the same way real firmware is separated from the chip.
//
// Two interaction modes, matching how you'd actually build a circuit:
//  - While NOT running: components can be dragged around the breadboard area
//    to arrange your circuit.
//  - While running: dragging is disabled, and you interact with LIVE
//    components instead - hold a button, drag a potentiometer's knob, slide
//    a sensor's simulated reading.
//
// Component leads are data-driven (COMPONENT_LEADS / LEAD_OFFSETS below) so
// adding a new component type doesn't require touching the wiring logic.

import { analogWriteLevel } from "./uno.js";

const DIGITAL_PINS = Array.from({ length: 14 }, (_, i) => i); // 0-13
const ANALOG_PINS = [14, 15, 16, 17, 18, 19]; // A0-A5, numbered the same way real Uno headers do

// ---------- layout: an Arduino board (top) sitting above a breadboard (below),
// exactly like a real desk setup - jumper wires run from the Arduino's edge
// headers down to wherever a component's legs are plugged into the breadboard. ----------

const PIN_X_START = 130;
const PIN_X_STEP = 42;
const BOARD_X = 40, BOARD_Y = 26, BOARD_W = 700, BOARD_H = 150;
const DIGITAL_PIN_Y = BOARD_Y + 18;          // header strip along the Uno's top edge
const BOTTOM_HEADER_Y = BOARD_Y + BOARD_H - 18; // power + analog headers along the bottom edge

// A real Uno R3 has the POWER header and the ANALOG IN header as two
// physically separate blocks (with a visible gap), not one continuous strip -
// reproduced here so the board reads as a real, recognizable Uno rather than
// an abstract row of dots. Order matches the real silkscreen: IOREF, RESET,
// 3V3, 5V, GND, GND, VIN | gap | A0-A5.
const POWER_X_START = 90;
const POWER_X_STEP = 34;
const POWER_PIN_X = {
  IOREF: POWER_X_START,
  RESET: POWER_X_START + POWER_X_STEP,
  "3V3": POWER_X_START + 2 * POWER_X_STEP,
  "5V": POWER_X_START + 3 * POWER_X_STEP,
  GND1: POWER_X_START + 4 * POWER_X_STEP,
  GND2: POWER_X_START + 5 * POWER_X_STEP,
  VIN: POWER_X_START + 6 * POWER_X_STEP,
};
const ANALOG_X_START = 380;

const BREADBOARD_X = 40, BREADBOARD_Y = BOARD_Y + BOARD_H + 55, BREADBOARD_W = 700, BREADBOARD_H = 330;
const RAIL_TOP_Y = BREADBOARD_Y + 20;
const RAIL_BOTTOM_Y = BREADBOARD_Y + BREADBOARD_H - 20;
const TRAY_TOP = BREADBOARD_Y + 58;
const TRAY_BOTTOM = BREADBOARD_Y + BREADBOARD_H - 130; // leaves room below for sliders that extend ~110px under a component

const CANVAS_W = 780;

// This simulator only models what a beginner circuit actually needs: digital
// I/O, a single GND net, a single 5V net, and analog input. IOREF, RESET,
// 3V3, and VIN are real Uno pins - drawn so the board is recognizable - but
// aren't wired to anything here.
//
// Both real-world grounding points AND the breadboard's power rails are
// exposed as clickable holes here - EVERY hole drawn along a rail is a real,
// independently-clickable connector (matching a real breadboard, where every
// hole in a rail is electrically identical), not just a handful of fixed
// "tap" points. Each hole gets its own id so a wire drawn to it renders at
// THAT hole, not at some other point sharing the same net - but electrically
// (for digitalRead/analogRead purposes) they're all just "GND" or "5V".
// Simplification: unlike a real breadboard, a rail hole here is "live" the
// moment you use it - you don't have to separately jumper the Arduino's
// GND/5V pin to the rail first. That's a deliberate beginner-friendly
// shortcut, not an oversight.
const RAIL_HOLE_DX = [];
for (let dx = 44; dx < BREADBOARD_W - 20; dx += 18) RAIL_HOLE_DX.push(dx);

const GND_HOLES = {
  gnd: { x: POWER_PIN_X.GND1, y: BOTTOM_HEADER_Y, label: "GND" },
  "gnd-pwr2": { x: POWER_PIN_X.GND2, y: BOTTOM_HEADER_Y, label: "GND" },
  ...Object.fromEntries(RAIL_HOLE_DX.map((dx, i) => [`gnd-railtop-${i}`, { x: BREADBOARD_X + dx, y: RAIL_TOP_Y + 6 }])),
  ...Object.fromEntries(RAIL_HOLE_DX.map((dx, i) => [`gnd-railbot-${i}`, { x: BREADBOARD_X + dx, y: RAIL_BOTTOM_Y + 6 }])),
};
const FIVEV_HOLES = {
  "5v": { x: POWER_PIN_X["5V"], y: BOTTOM_HEADER_Y, label: "5V" },
  ...Object.fromEntries(RAIL_HOLE_DX.map((dx, i) => [`5v-railtop-${i}`, { x: BREADBOARD_X + dx, y: RAIL_TOP_Y - 6 }])),
  ...Object.fromEntries(RAIL_HOLE_DX.map((dx, i) => [`5v-railbot-${i}`, { x: BREADBOARD_X + dx, y: RAIL_BOTTOM_Y - 6 }])),
};

// ---------- the main grid: this is what makes it a REAL breadboard ----------
// A real breadboard's main area is two separate halves (split by the center
// trench), each wired internally in short vertical COLUMNS of 5 holes - every
// hole in a column is the same electrical node, and columns are otherwise
// completely independent of each other (and of the other half across the
// trench) unless a wire or a component leg bridges them. That's the entire
// mechanism that lets you build a circuit without wiring every single
// connection by hand: plug two legs into the same column, and they're
// connected - no wire needed between them.
const GRID_COL_START = BREADBOARD_X + 32;
const GRID_COL_STEP = 18;
const GRID_COLS = Math.floor((BREADBOARD_W - 64) / GRID_COL_STEP);
const GRID_ROW_STEP = 14;
const GRID_TOP_ROWS_Y = [0, 1, 2, 3, 4].map((row) => RAIL_TOP_Y + 30 + row * GRID_ROW_STEP);
const GRID_BOTTOM_ROWS_Y = [0, 1, 2, 3, 4].map((row) => RAIL_BOTTOM_Y - 30 - (4 - row) * GRID_ROW_STEP);

function gridHoleId(col, half, row) { return `grid-c${col}-${half}${row}`; }
function gridColX(col) { return GRID_COL_START + col * GRID_COL_STEP; }

// Every hole in the main grid, keyed by id, the same shape as GND_HOLES/
// FIVEV_HOLES so it can be drawn with the same helper.
const GRID_HOLES = {};
for (let col = 0; col < GRID_COLS; col++) {
  const x = gridColX(col);
  GRID_TOP_ROWS_Y.forEach((y, row) => { GRID_HOLES[gridHoleId(col, "t", row)] = { x, y }; });
  GRID_BOTTOM_ROWS_Y.forEach((y, row) => { GRID_HOLES[gridHoleId(col, "b", row)] = { x, y }; });
}

const WIRE_PALETTE = [
  { name: "Red (power)", value: "#e2453c" },
  { name: "Black (ground)", value: "#6b7280" },
  { name: "Yellow", value: "#f5c542" },
  { name: "Blue", value: "#4fc3f7" },
  { name: "Green", value: "#57d38c" },
  { name: "Orange", value: "#ff9f4a" },
  { name: "Purple", value: "#b48ce8" },
  { name: "White", value: "#e4e6ec" },
];
const SIGNAL_ROTATION = ["#f5c542", "#4fc3f7", "#57d38c", "#ff9f4a", "#b48ce8", "#e4e6ec"];
// The site's pixel fonts (loaded by index.html), for text drawn on the board.
const PIXEL_FONT = "'Press Start 2P', monospace";
const TERMINAL_FONT = "VT323, monospace";
const LED_COLORS = ["#ff5a4e", "#ffe066", "#57d38c", "#4fc3f7", "#ffffff"];

// The resistor values a beginner actually reaches for, each with its REAL
// 4-band color code (double-checked against the standard: digit, digit,
// multiplier, gold tolerance) - so cycling through them doubles as practice
// reading resistor bands, not just picking a number from a menu.
// 220/330 ohm: what the "LEDs and Resistors" lesson recommends for a standard
// LED at 5V. 1k ohm: a common general-purpose value. 10k ohm: the standard
// pull-up/pull-down value mentioned in the "Floating Pin Problem" lesson.
const RESISTOR_BAND_COLORS = {
  black: "#2b2b2b", brown: "#6b4a2a", red: "#c0392b", orange: "#d9822b",
};
const RESISTOR_VALUES = [
  { ohms: 220, label: "220Ω", bands: ["red", "red", "brown"] },
  { ohms: 330, label: "330Ω", bands: ["orange", "orange", "brown"] },
  { ohms: 1000, label: "1kΩ", bands: ["brown", "black", "red"] },
  { ohms: 10000, label: "10kΩ", bands: ["brown", "black", "orange"] },
];

// Where each component type's leads sit, relative to the component's (x, y)
// anchor point - this is the ONLY place that needs updating to change a
// component's wiring geometry.
const LEAD_OFFSETS = {
  led: { "-a": [-14, 38], "-k": [14, 38] },
  resistor: { "-1": [-14, 36], "-2": [14, 36] },
  button: { "-1": [-14, 28], "-2": [14, 28] },
  rgbled: { "-r": [-24, 38], "-g": [-8, 38], "-b": [8, 38], "-c": [24, 38] },
  buzzer: { "-s": [-10, 42], "-g": [10, 42] },
  potentiometer: { "-v": [-20, 52], "-w": [0, 52], "-g": [20, 52] },
  ldr: { "-s": [-10, 40], "-g": [10, 40] },
  tempsensor: { "-s": [-10, 42], "-g": [10, 42] },
  ultrasonic: { "-t": [-14, 46], "-e": [14, 46] },
  irsensor: { "-s": [-10, 40], "-g": [10, 40] },
  servo: { "-s": [0, 48] },
  lcd: {},
};

function leadSuffixes(kind) {
  return Object.keys(LEAD_OFFSETS[kind] || {});
}

// Friendly names for the circuit report ("LED 1", "Resistor 2").
const KIND_NAMES = {
  led: "LED", resistor: "Resistor", rgbled: "RGB LED", button: "Button", buzzer: "Buzzer",
  potentiometer: "Potentiometer", ldr: "Light sensor", tempsensor: "Temperature sensor",
  ultrasonic: "Ultrasonic sensor", irsensor: "IR sensor", servo: "Servo", lcd: "LCD",
};

// Small marks drawn under a component's leads so you can tell them apart:
// + and − for polarized parts (an LED's long leg is +), S for a sensor's
// signal, W for a potentiometer's wiper, T/E for trig/echo.
const LEAD_LABELS = {
  led: { "-a": "+", "-k": "−" },
  rgbled: { "-r": "R", "-g": "G", "-b": "B", "-c": "−" },
  buzzer: { "-s": "+", "-g": "−" },
  potentiometer: { "-v": "+", "-w": "W", "-g": "−" },
  ldr: { "-s": "S", "-g": "−" },
  tempsensor: { "-s": "S", "-g": "−" },
  ultrasonic: { "-t": "T", "-e": "E" },
  irsensor: { "-s": "S", "-g": "−" },
  servo: { "-s": "S" },
};

// options.random: the noise source for a floating input pin (tests pass a
// predictable one).
// options.onCircuitChange: called whenever the circuit itself changes (a part
// added or removed, a wire drawn or deleted, a resistor value changed) - not
// on every pin change while a sketch runs.
// Pressing a part - to drag it, hold a button or move a sensor's slider -
// works with a mouse, a pen or a finger: pointer events (mouse events only
// arrive after a finger lifts, so a touch could never hold a button), and no
// page scrolling while you do it. Everywhere else on the board still scrolls.
function onPress(el, handler) {
  el.style.touchAction = "none";
  el.addEventListener("pointerdown", handler);
}

export function createBoard(svgEl, options = {}) {
  const random = options.random || Math.random;
  let pinModes = {};        // pin -> "OUTPUT" | "INPUT" | "INPUT_PULLUP"
  let pinOutputs = {};      // pin -> 0-255 level an OUTPUT pin drives (digitalWrite HIGH=255/LOW=0, or analogWrite's level)
  // pin -> the pin's "PORT bit", exactly like the ATmega328P: on an OUTPUT
  // pin it's the level being driven, and on an INPUT pin it switches the
  // internal pull-up resistor on. That's why digitalWrite(pin, HIGH) on a pin
  // that isn't an OUTPUT turns the pull-up on instead of lighting an LED.
  let portHigh = {};
  let pinAnalogInputs = {}; // pin (14-19 = A0-A5) -> 0-1023, driven by potentiometer/LDR/temp sensor
  let servoAngles = {};     // pin -> 0-180
  let components = [];      // { id, kind, x, y, ...kind-specific fields }
  let wires = [];           // { from: connectorId, to: connectorId, color }
  let pressed = new Set();  // component ids of currently-held buttons
  let irBlocked = new Set(); // component ids of IR sensors currently "seeing" an obstacle
  let pending = null;       // connectorId waiting for its second endpoint
  let nextComponentNum = {};
  let selectedWireColor = "auto";
  let running = false;
  let signalColorCursor = 0;
  let draggingSliderId = null;

  let lcd = { begun: false, cols: 16, rows: 2, lines: [], cursorCol: 0, cursorRow: 0 };

  let audioCtx = null;
  const activeTones = {}; // pin -> { osc, gain } - sound actually coming out of the speakers
  const soundingPins = {}; // pin -> frequency of a tone the sketch is playing (whether or not a buzzer can be heard)
  const toneTimers = {};  // pin -> timer that ends a tone(pin, freq, duration)

  // What the most recent run did with each pin (pin -> its last mode), kept
  // after the run ends so the circuit check can still say "your sketch used
  // pin 9 as an OUTPUT but nothing is wired to it".
  let lastRunModes = null;

  function reset() {
    pinModes = {};
    pinOutputs = {};
    portHigh = {};
    pinAnalogInputs = {};
    servoAngles = {};
    pressed = new Set();
    stopAllTones();
    lcd = { begun: false, cols: 16, rows: 2, lines: [], cursorCol: 0, cursorRow: 0 };
    render();
  }

  // Stopping the sketch is like unplugging the board: every pin goes back to
  // an unpowered input, so nothing stays lit or keeps beeping and looks as if
  // the sketch were still running. (A servo stays at its last angle - it's a
  // motor, it doesn't spring back when the power goes.)
  function setRunning(value) {
    running = value;
    if (running) {
      lastRunModes = {};
    } else {
      pressed = new Set();
      stopAllTones();
      pinModes = {};
      pinOutputs = {};
      portHigh = {};
      lcd = { begun: false, cols: lcd.cols, rows: lcd.rows, lines: [], cursorCol: 0, cursorRow: 0 };
    }
    render();
  }

  function circuitChanged() {
    render();
    try { options.onCircuitChange?.(); } catch (e) { console.error(e); }
  }

  function setWireColor(color) { selectedWireColor = color; }

  // ---------- audio (buzzer) ----------

  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
    return audioCtx;
  }

  // A tone only makes a sound if a buzzer is really there to make it: wired
  // to that pin AND to GND. Without one, the sketch still "plays" it (the pin
  // toggles), but a real board would be silent - so is this one.
  function buzzerWiredTo(pin) {
    return components.some((c) => c.kind === "buzzer" && wiredPinOf(c.id + "-s") === pin && isWiredToGnd(c.id + "-g"));
  }

  function playToneOnPin(pin, frequency) {
    stopToneOnPin(pin);
    soundingPins[pin] = frequency;
    if (!buzzerWiredTo(pin)) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = Math.max(20, Math.min(frequency || 440, 8000));
      gain.gain.value = 0.06; // quiet - this plays through real speakers
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      activeTones[pin] = { osc, gain };
    } catch {
      // audio can fail to start without a user gesture yet - fail silently,
      // the visual buzzer animation still works either way
    }
  }

  function stopToneOnPin(pin) {
    clearTimeout(toneTimers[pin]);
    delete toneTimers[pin];
    delete soundingPins[pin];
    const entry = activeTones[pin];
    if (!entry) return;
    try { entry.osc.stop(); entry.osc.disconnect(); entry.gain.disconnect(); } catch { /* already stopped */ }
    delete activeTones[pin];
  }

  function stopAllTones() {
    for (const pin of new Set([...Object.keys(activeTones), ...Object.keys(soundingPins), ...Object.keys(toneTimers)])) stopToneOnPin(pin);
  }

  // ---------- hardware API used by the interpreter ----------

  function noteMode(pin, mode) {
    pinModes[pin] = mode;
    if (lastRunModes) lastRunModes[pin] = mode;
  }

  function pinMode(pin, mode) {
    noteMode(pin, mode);
    if (mode === "INPUT_PULLUP") portHigh[pin] = true;
    if (mode === "INPUT") portHigh[pin] = false;
    // OUTPUT keeps the PORT bit, so a pin whose pull-up was on starts out HIGH.
    pinOutputs[pin] = mode === "OUTPUT" && portHigh[pin] ? 255 : 0;
    render();
  }

  // Only an OUTPUT pin is actually driven. On an input pin, digitalWrite just
  // flips the PORT bit - i.e. turns the weak internal pull-up on or off - so
  // an LED on it stays dark (on a real Uno it would glow very faintly at most).
  function digitalWrite(pin, value) {
    portHigh[pin] = !!value;
    if (pinModes[pin] === "OUTPUT") {
      pinOutputs[pin] = value ? 255 : 0;
      // An active buzzer beeps whenever its pin is HIGH.
      if (components.some((c) => c.kind === "buzzer" && wiredPinOf(c.id + "-s") === pin)) {
        if (value) playToneOnPin(pin, 1000);
        else stopToneOnPin(pin);
      }
    }
    render();
  }

  // Exactly what the Arduino core's analogWrite() does: it makes the pin an
  // OUTPUT, PWM pins (3, 5, 6, 9, 10, 11) get the low 8 bits of the value as
  // their duty cycle, and any other pin can only switch fully on (128+) or
  // off. See analogWriteLevel() in uno.js.
  function analogWrite(pin, value) {
    noteMode(pin, "OUTPUT");
    pinOutputs[pin] = analogWriteLevel(pin, value);
    portHigh[pin] = pinOutputs[pin] === 255;
    render();
  }

  // Connectivity that does NOT pass through a resistor - a resistor is only a
  // weak connection electrically (a pull-up/pull-down), so it mustn't count
  // the same as a plain wire when deciding what an input pin reads.
  function strongNet(startId) {
    return connectedSet(startId, false);
  }
  const touchesGnd = (set) => { for (const id of set) if (id in GND_HOLES) return true; return false; };
  const touches5v = (set) => { for (const id of set) if (id in FIVEV_HOLES) return true; return false; };

  // What an INPUT pin is electrically connected to right now. Returns
  // { level: 0 or 1 } when something defines it, or { level: null } when
  // nothing does - a "floating" pin, which on real hardware reads noise.
  // Strongest connection wins, like real electronics:
  //   1. a wire straight to GND or 5V, a pressed button, or an IR sensor's
  //      output - these DRIVE the pin
  //   2. otherwise a pull-up/pull-down: the chip's internal pull-up
  //      (INPUT_PULLUP), or a resistor from the pin to 5V or GND
  //   3. otherwise nothing: floating.
  function inputLevel(pin) {
    const pinId = `pin-${pin}`;
    const strong = strongNet(pinId);
    const all = connectedSet(pinId);
    if (touchesGnd(strong)) return { level: 0 };
    if (touches5v(strong)) return { level: 1 };

    for (const btn of components) {
      if (btn.kind !== "button" || !pressed.has(btn.id)) continue;
      for (const [near, far] of [["-1", "-2"], ["-2", "-1"]]) {
        if (!all.has(btn.id + near)) continue;
        const other = connectedSet(btn.id + far);
        if (touchesGnd(other)) return { level: 0 };
        if (touches5v(other)) return { level: 1 };
      }
    }
    for (const ir of components) {
      // Most IR obstacle sensors are active-LOW: they pull the signal down
      // when they detect something in front of them.
      if (ir.kind === "irsensor" && isTwoLeadWiredToPin(ir, pin, "-s", "-g")) return { level: irBlocked.has(ir.id) ? 0 : 1 };
    }

    if (portHigh[pin]) return { level: 1 }; // internal pull-up resistor
    for (const r of components) {
      if (r.kind !== "resistor") continue;
      for (const [near, far] of [["-1", "-2"], ["-2", "-1"]]) {
        if (!strong.has(r.id + near)) continue;
        const other = strongNet(r.id + far);
        if (touchesGnd(other)) return { level: 0 }; // pull-down resistor
        if (touches5v(other)) return { level: 1 };  // pull-up resistor
      }
    }
    return { level: null };
  }

  function digitalRead(pin) {
    if (pinModes[pin] === "OUTPUT") return (pinOutputs[pin] ?? 0) > 0 ? 1 : 0; // reading back an OUTPUT pin
    const { level } = inputLevel(pin);
    if (level === null) return random() < 0.5 ? 0 : 1; // floating: electrical noise
    return level;
  }

  // Used by the interpreter to explain what's going on (e.g. "this pin is
  // floating") - doesn't change anything.
  // level is the 0-255 output level for an OUTPUT pin (0 for an input).
  function pinStatus(pin) {
    const mode = pinModes[pin] ?? "INPUT";
    if (mode === "OUTPUT") return { mode, floating: false, pullup: false, level: pinOutputs[pin] ?? 0 };
    return { mode, floating: inputLevel(pin).level === null, pullup: !!portHigh[pin], level: 0 };
  }

  function analogRead(pin) {
    return pinAnalogInputs[pin] ?? 0;
  }

  function pulseIn(pin) {
    const sensor = components.find((c) => c.kind === "ultrasonic" && wiredPinOf(c.id + "-e") === pin);
    if (!sensor) return 0;
    return Math.round(sensor.distanceCm * 58); // matches the real HC-SR04 timing formula
  }

  // tone(pin, frequency, duration) stops by itself after `duration` ms, like
  // the real one; without a duration it plays until noTone().
  function tone(pin, frequency, duration) {
    noteMode(pin, "OUTPUT");
    playToneOnPin(pin, frequency);
    if (duration > 0) toneTimers[pin] = setTimeout(() => { stopToneOnPin(pin); render(); }, duration);
    render();
  }
  function noTone(pin) { stopToneOnPin(pin); render(); }

  function servoWrite(pin, angle) {
    if (pin === null || pin === undefined) return;
    servoAngles[pin] = angle;
    render();
  }

  function lcdBegin(cols, rows) {
    lcd = { begun: true, cols: cols || 16, rows: rows || 2, lines: Array(rows || 2).fill(""), cursorCol: 0, cursorRow: 0 };
    render();
  }

  function lcdPrint(text) {
    if (!lcd.begun) return;
    let line = lcd.lines[lcd.cursorRow] || "";
    // overwrite characters starting at the cursor, like a real character LCD
    const chars = line.padEnd(lcd.cols, " ").split("");
    for (const ch of String(text)) {
      if (lcd.cursorCol >= lcd.cols) break;
      chars[lcd.cursorCol] = ch;
      lcd.cursorCol++;
    }
    lcd.lines[lcd.cursorRow] = chars.join("").slice(0, lcd.cols);
    render();
  }

  function lcdSetCursor(col, row) {
    lcd.cursorCol = col;
    lcd.cursorRow = row;
    render();
  }

  function lcdClear() {
    if (!lcd.begun) return;
    lcd.lines = Array(lcd.rows).fill("");
    lcd.cursorCol = 0;
    lcd.cursorRow = 0;
    render();
  }

  // ---------- wiring helpers ----------

  function pinPosition(pin) {
    if (pin >= 14) return { x: ANALOG_X_START + (pin - 14) * PIN_X_STEP, y: BOTTOM_HEADER_Y };
    return { x: PIN_X_START + pin * PIN_X_STEP, y: DIGITAL_PIN_Y };
  }

  function connectorPoint(id) {
    if (id in GND_HOLES) return GND_HOLES[id];
    if (id in FIVEV_HOLES) return FIVEV_HOLES[id];
    if (id in GRID_HOLES) return GRID_HOLES[id];
    if (id.startsWith("pin-")) return pinPosition(Number(id.slice(4)));
    const comp = components.find((c) => id.startsWith(c.id + "-"));
    if (!comp) return { x: 0, y: 0 };
    const suffix = id.slice(comp.id.length);
    const [dx, dy] = (LEAD_OFFSETS[comp.kind] || {})[suffix] || [0, 30];
    return { x: comp.x + dx, y: comp.y + dy };
  }

  // A hole's IMPLICIT net - what it's electrically tied to just by existing,
  // with no wire needed. GND/5V holes are each one big net (the whole rail +
  // header). A main-grid hole's net is its own 5-hole column, on its own side
  // of the trench - real breadboard behavior, and the whole reason plugging
  // two components into the same column connects them with no jumper wire.
  // A resistor's two leads are also their own tiny net: unlike an LED or a
  // button, a resistor isn't polarized or switched - anything touching one
  // leg is electrically the same as touching the other (this simulator
  // doesn't model actual resistance/current limiting, so "passes current
  // straight through" is the whole of what a resistor needs to do here).
  // Pins and every other component's leads return null: they have no
  // automatic membership, only explicit wires connect them to anything.
  function implicitNetKey(id) {
    if (id in GND_HOLES) return "net:gnd";
    if (id in FIVEV_HOLES) return "net:5v";
    const m = id.match(/^grid-c(\d+)-([tb])/);
    if (m) return `net:col-${m[1]}-${m[2]}`;
    const resistor = components.find((c) => c.kind === "resistor" && id.startsWith(c.id + "-"));
    if (resistor) return `net:comp-${resistor.id}`;
    return null;
  }

  function implicitGroupMembers(netKey) {
    if (netKey === "net:gnd") return Object.keys(GND_HOLES);
    if (netKey === "net:5v") return Object.keys(FIVEV_HOLES);
    const m = netKey.match(/^net:col-(\d+)-([tb])$/);
    if (m) {
      const col = Number(m[1]), half = m[2];
      return [0, 1, 2, 3, 4].map((row) => gridHoleId(col, half, row));
    }
    const compM = netKey.match(/^net:comp-(.+)$/);
    if (compM) return leadSuffixes("resistor").map((suffix) => compM[1] + suffix);
    return [];
  }

  // Every connector electrically joined to startId - by explicit wires AND
  // by implicit net membership (same column, same rail) - found the same way
  // you'd trace a real circuit with a multimeter: keep following connections
  // until nothing new turns up. throughResistors = false stops at resistors
  // (used to tell a pull-up/pull-down resistor apart from a plain wire).
  function connectedSet(startId, throughResistors = true) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
      const id = queue.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const w of wires) {
        if (w.from === id) queue.push(w.to);
        else if (w.to === id) queue.push(w.from);
      }
      const netKey = implicitNetKey(id);
      if (netKey && (throughResistors || !netKey.startsWith("net:comp-"))) {
        for (const member of implicitGroupMembers(netKey)) queue.push(member);
      }
    }
    return visited;
  }

  function wiredPinOf(connectorId) {
    for (const id of connectedSet(connectorId)) {
      if (id !== connectorId && id.startsWith("pin-")) return Number(id.slice(4));
    }
    return null;
  }

  function isWiredToGnd(connectorId) {
    for (const id of connectedSet(connectorId)) if (id in GND_HOLES) return true;
    return false;
  }
  function isWiredTo5v(connectorId) {
    for (const id of connectedSet(connectorId)) if (id in FIVEV_HOLES) return true;
    return false;
  }

  // The Arduino pins (numbers) found in a set of connectors.
  function pinsIn(set) {
    const pins = [];
    for (const id of set) if (id.startsWith("pin-")) pins.push(Number(id.slice(4)));
    return pins;
  }

  // How brightly an LED glows (0-255), worked out the way current really
  // flows through one: from something HIGH on its long leg (+, the anode) -
  // an OUTPUT pin, or 5V while the board is powered - to something LOW on
  // its short leg (−, the cathode) - GND, or an OUTPUT pin that's LOW.
  // Backwards, half-connected, or with both legs on the same connection, it
  // stays dark - exactly like a real LED. (What it does NOT model is current:
  // a missing resistor or a 10kΩ one doesn't change the glow here - the
  // circuit check points that out instead of letting it pass silently.)
  function ledLevel(anodeId, cathodeId) {
    const anode = connectedSet(anodeId);
    if (anode.has(cathodeId)) return 0;
    const cathode = connectedSet(cathodeId);
    const outputLevel = (p) => (pinModes[p] === "OUTPUT" ? pinOutputs[p] ?? 0 : null);
    const sinks = touchesGnd(cathode) || pinsIn(cathode).some((p) => outputLevel(p) === 0);
    if (!sinks) return 0;
    let level = running && touches5v(anode) ? 255 : 0;
    for (const p of pinsIn(anode)) level = Math.max(level, outputLevel(p) ?? 0);
    return level;
  }

  // The pin an LED's + leg is wired to (directly or through a resistor), if any.
  function ledConnectedPin(led) {
    return wiredPinOf(led.id + "-a");
  }

  function isTwoLeadWiredToPin(comp, pin, sigSuffix, gndSuffix) {
    const sigPin = wiredPinOf(comp.id + sigSuffix);
    if (sigPin !== pin) return false;
    const set = connectedSet(comp.id + gndSuffix);
    for (const id of set) if (id in GND_HOLES || id in FIVEV_HOLES) return true;
    return false;
  }

  function autoColor(fromId, toId) {
    if (fromId in GND_HOLES || toId in GND_HOLES) return WIRE_PALETTE[1].value;
    if (fromId in FIVEV_HOLES || toId in FIVEV_HOLES) return WIRE_PALETTE[0].value;
    const color = SIGNAL_ROTATION[signalColorCursor % SIGNAL_ROTATION.length];
    signalColorCursor++;
    return color;
  }

  // ---------- analog input components: sync their slider value onto the pin they're wired to ----------

  function syncAnalogInputs() {
    pinAnalogInputs = {};
    for (const comp of components) {
      let pin = null, value = null;
      if (comp.kind === "potentiometer") { pin = wiredPinOf(comp.id + "-w"); value = comp.rawValue; }
      else if (comp.kind === "ldr") { pin = wiredPinOf(comp.id + "-s"); value = Math.round((comp.lightPct / 100) * 1023); }
      else if (comp.kind === "tempsensor") {
        pin = wiredPinOf(comp.id + "-s");
        // Reproduces the real TMP36 formula in reverse, so student code using
        // the standard `(voltage - 0.5) * 100` formula gets back the exact
        // temperature the slider is set to.
        const voltage = comp.tempC / 100 + 0.5;
        value = Math.round((voltage / 5.0) * 1023);
      }
      if (pin !== null && value !== null) pinAnalogInputs[pin] = Math.max(0, Math.min(1023, value));
    }
  }

  // ---------- component management ----------

  function addComponent(kind) {
    nextComponentNum[kind] = (nextComponentNum[kind] || 0) + 1;
    const id = `${kind}-${nextComponentNum[kind]}`;
    const index = components.length;
    const x = 90 + (index % 6) * 110;
    const y = TRAY_TOP + Math.floor(index / 6) * 130;
    const comp = { id, kind, x, y };

    if (kind === "led") comp.color = LED_COLORS[(nextComponentNum[kind] - 1) % LED_COLORS.length];
    if (kind === "resistor") comp.ohms = RESISTOR_VALUES[0].ohms;
    if (kind === "potentiometer") comp.rawValue = 512;
    if (kind === "ldr") comp.lightPct = 50;
    if (kind === "tempsensor") comp.tempC = 22;
    if (kind === "ultrasonic") comp.distanceCm = 50;
    if (kind === "servo") comp.currentAngle = 90;

    components.push(comp);
    circuitChanged();
    return id;
  }

  // ---------- programmatic circuit building ----------
  // The same actions the mouse performs (drawing a wire, holding a button,
  // moving a slider), callable from code - used by the automated tests.

  function connect(fromId, toId, color) {
    wires.push({ from: fromId, to: toId, color: color || autoColor(fromId, toId) });
    syncAnalogInputs();
    circuitChanged();
  }

  function setButtonPressed(id, isPressed) {
    if (isPressed) pressed.add(id);
    else pressed.delete(id);
    render();
  }

  function updateComponent(id, props) {
    const comp = components.find((c) => c.id === id);
    if (comp) Object.assign(comp, props);
    syncAnalogInputs();
    render();
  }

  function removeComponent(id) {
    components = components.filter((c) => c.id !== id);
    const belongsToRemoved = (connectorId) => connectorId === id || connectorId.startsWith(id + "-");
    wires = wires.filter((w) => !belongsToRemoved(w.from) && !belongsToRemoved(w.to));
    pressed.delete(id);
    irBlocked.delete(id);
    circuitChanged();
  }

  function cycleLedColor(led) {
    const i = LED_COLORS.indexOf(led.color);
    led.color = LED_COLORS[(i + 1) % LED_COLORS.length];
    render();
  }

  function cycleResistorValue(resistor) {
    const i = RESISTOR_VALUES.findIndex((v) => v.ohms === resistor.ohms);
    resistor.ohms = RESISTOR_VALUES[(i + 1) % RESISTOR_VALUES.length].ohms;
    circuitChanged();
  }

  function toggleIr(comp) {
    if (irBlocked.has(comp.id)) irBlocked.delete(comp.id);
    else irBlocked.add(comp.id);
    render();
  }

  function clearWiring() {
    wires = [];
    pending = null;
    signalColorCursor = 0;
    circuitChanged();
  }

  function removeWire(wire) {
    wires = wires.filter((w) => w !== wire);
    circuitChanged();
  }

  // ---------- dragging (components + sliders) ----------

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function svgPoint(evt) {
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function startDrag(comp, evt) {
    if (running) return;
    evt.preventDefault();
    evt.stopPropagation();
    const start = svgPoint(evt);
    const origX = comp.x, origY = comp.y;

    function onMove(e) {
      const p = svgPoint(e);
      comp.x = clamp(origX + (p.x - start.x), 40, CANVAS_W - 40);
      comp.y = clamp(origY + (p.y - start.y), TRAY_TOP - 10, TRAY_BOTTOM);
      render();
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // A horizontal slider used by potentiometer/LDR/temp-sensor/ultrasonic to
  // let the learner set a simulated real-world value by dragging, exactly
  // like turning a knob or waving a hand in front of a sensor.
  function startSliderDrag(trackX, trackWidth, onChange, evt) {
    evt.preventDefault();
    evt.stopPropagation();
    draggingSliderId = true;

    function apply(e) {
      const p = svgPoint(e);
      const frac = clamp((p.x - trackX) / trackWidth, 0, 1);
      onChange(frac);
      render();
    }
    apply(evt);
    function onMove(e) { apply(e); }
    function onUp() {
      draggingSliderId = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // ---------- rendering ----------

  function svgEl_(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function handleConnectorClick(id) {
    if (pending === id) { pending = null; render(); return; }
    if (pending === null) { pending = id; render(); return; }
    const color = selectedWireColor === "auto" ? autoColor(pending, id) : selectedWireColor;
    wires.push({ from: pending, to: id, color });
    pending = null;
    circuitChanged();
  }

  // A simplified but recognizable Arduino Uno silhouette: PCB body, USB
  // connector notch, the main chip, a power indicator LED, and dark header
  // strips backing the two pin rows (digital along the top edge, power +
  // analog along the bottom edge - matching where a real Uno actually puts them).
  function drawArduino() {
    svgEl.appendChild(svgEl_("rect", {
      x: BOARD_X, y: BOARD_Y, width: BOARD_W, height: BOARD_H,
      rx: 8, fill: "#0e6350", stroke: "#083c30", "stroke-width": 2,
    }));
    svgEl.appendChild(svgEl_("rect", {
      x: BOARD_X - 16, y: BOARD_Y + 30, width: 20, height: 34, rx: 3,
      fill: "#c7c7cf", stroke: "#8a8a93", "stroke-width": 1.5,
    })); // USB connector

    const chipW = 110, chipH = 40;
    const chipX = BOARD_X + BOARD_W / 2 - chipW / 2, chipY = BOARD_Y + BOARD_H / 2 - chipH / 2 + 4;
    svgEl.appendChild(svgEl_("rect", { x: chipX, y: chipY, width: chipW, height: chipH, fill: "#161616", stroke: "#000", "stroke-width": 1 }));
    const chipLabel = svgEl_("text", {
      x: chipX + chipW / 2, y: chipY + chipH / 2 + 4, fill: "#8a8a8a", "font-size": 9.5,
      "text-anchor": "middle", "font-family": "monospace",
    });
    chipLabel.textContent = "ATmega328P";
    svgEl.appendChild(chipLabel);

    svgEl.appendChild(svgEl_("circle", { cx: BOARD_X + 22, cy: BOARD_Y + BOARD_H - 12, r: 3.5, fill: running ? "#57d38c" : "#1f4a3c" }));
    const onLabel = svgEl_("text", { x: BOARD_X + 22, y: BOARD_Y + BOARD_H - 20, fill: "#7fd9b8", "font-size": 7, "text-anchor": "middle", "font-family": "monospace" });
    onLabel.textContent = "ON";
    svgEl.appendChild(onLabel);

    const boardLabel = svgEl_("text", { x: BOARD_X + BOARD_W - 14, y: BOARD_Y + BOARD_H - 12, fill: "#7fe0c4", "font-size": 11, "text-anchor": "end", "font-family": "monospace" });
    boardLabel.textContent = running ? "UNO (running)" : "UNO (simulated)";
    svgEl.appendChild(boardLabel);

    // header strips - dark backing bars behind the pin rows. The bottom edge
    // is drawn as TWO separate strips with a gap between them, matching how
    // a real Uno R3 physically separates its POWER header from its ANALOG IN
    // header (they are not one continuous row).
    svgEl.appendChild(svgEl_("rect", {
      x: PIN_X_START - 16, y: DIGITAL_PIN_Y - 8, width: 13 * PIN_X_STEP + 32, height: 16,
      rx: 2, fill: "#111318",
    }));
    svgEl.appendChild(svgEl_("rect", {
      x: POWER_X_START - 16, y: BOTTOM_HEADER_Y - 8, width: (POWER_PIN_X.VIN - POWER_X_START) + 32, height: 16,
      rx: 2, fill: "#111318",
    }));
    svgEl.appendChild(svgEl_("rect", {
      x: ANALOG_X_START - 16, y: BOTTOM_HEADER_Y - 8, width: 5 * PIN_X_STEP + 32, height: 16,
      rx: 2, fill: "#111318",
    }));
    const powerBlockLabel = svgEl_("text", {
      x: POWER_X_START + (POWER_PIN_X.VIN - POWER_X_START) / 2, y: BOTTOM_HEADER_Y + 24,
      fill: "#5a6470", "font-size": 8, "text-anchor": "middle", "font-family": "monospace",
    });
    powerBlockLabel.textContent = "POWER";
    svgEl.appendChild(powerBlockLabel);
    const analogBlockLabel = svgEl_("text", {
      x: ANALOG_X_START + 2 * PIN_X_STEP, y: BOTTOM_HEADER_Y + 24,
      fill: "#5a6470", "font-size": 8, "text-anchor": "middle", "font-family": "monospace",
    });
    analogBlockLabel.textContent = "ANALOG IN";
    svgEl.appendChild(analogBlockLabel);
  }

  // A pin that's REALLY on a Uno R3 but isn't wired to anything in this
  // simulator (IOREF, RESET, 3V3, VIN) - drawn dim and with no click handler,
  // so it reads as "this exists on a real board" without pretending to work.
  function drawDecorativePin(x, y, label) {
    svgEl.appendChild(svgEl_("circle", { cx: x, cy: y, r: 6, fill: "#3a3f4a", stroke: "#20242c", "stroke-width": 1 }));
    const t = svgEl_("text", { x, y: y - 13, fill: "#565c68", "font-size": 9, "text-anchor": "middle", "font-family": "monospace" });
    t.textContent = label;
    svgEl.appendChild(t);
  }

  function drawRail(y) {
    // Note: no decorative hole dots drawn here - every hole position on a
    // rail is now a REAL functional connector (see GND_HOLES/FIVEV_HOLES),
    // drawn by render() right after this runs, so drawing plain dots here
    // first would just be immediately covered up.
    // Pixel theme: the rail stripes are blocky dashes (rects, not lines) and
    // the +/- marks use the pixel font, to match the pixel-art LEDs.
    for (let x = BREADBOARD_X + 22; x < BREADBOARD_X + BREADBOARD_W - 22; x += 12) {
      const w = Math.min(8, BREADBOARD_X + BREADBOARD_W - 22 - x);
      svgEl.appendChild(svgEl_("rect", { x, y: y - 8, width: w, height: 3, fill: "#d9453c", "shape-rendering": "crispEdges" }));
      svgEl.appendChild(svgEl_("rect", { x, y: y + 5, width: w, height: 3, fill: "#3f6fd9", "shape-rendering": "crispEdges" }));
    }
    const plusLabel = svgEl_("text", { x: BREADBOARD_X + 7, y: y - 2, fill: "#d9453c", "font-size": 10, "font-family": PIXEL_FONT });
    plusLabel.textContent = "+";
    svgEl.appendChild(plusLabel);
    const minusLabel = svgEl_("text", { x: BREADBOARD_X + 7, y: y + 12, fill: "#3f6fd9", "font-size": 10, "font-family": PIXEL_FONT });
    minusLabel.textContent = "−";
    svgEl.appendChild(minusLabel);
  }

  // A pixel-art panel: flat fill, a 4px light bevel on the top/left, a 4px
  // shadow on the bottom/right, and a dark outline with stepped (notched)
  // corners instead of rounded ones.
  function drawPixelPanel(x, y, w, h) {
    const u = 4;
    const px = (rx, ry, rw, rh, fill) => svgEl.appendChild(svgEl_("rect", {
      x: rx, y: ry, width: rw, height: rh, fill, "shape-rendering": "crispEdges",
    }));
    px(x + u, y + u, w - 2 * u, h - 2 * u, "#efe7d0"); // body
    px(x + u, y + u, w - 2 * u, u, "#fbf6e6"); // top bevel
    px(x + u, y + u, u, h - 2 * u, "#fbf6e6"); // left bevel
    px(x + u, y + h - 2 * u, w - 2 * u, u, "#d4c8a4"); // bottom shadow
    px(x + w - 2 * u, y + u, u, h - 2 * u, "#d4c8a4"); // right shadow
    const edge = "#8a7f60";
    px(x + u, y, w - 2 * u, u, edge);
    px(x + u, y + h - u, w - 2 * u, u, edge);
    px(x, y + u, u, h - 2 * u, edge);
    px(x + w - u, y + u, u, h - 2 * u, edge);
    // the stepped corners: one outline pixel just inside each corner
    for (const [cx, cy] of [[x + u, y + u], [x + w - 2 * u, y + u], [x + u, y + h - 2 * u], [x + w - 2 * u, y + h - 2 * u]]) px(cx, cy, u, u, edge);
  }

  function drawBreadboard() {
    drawPixelPanel(BREADBOARD_X, BREADBOARD_Y, BREADBOARD_W, BREADBOARD_H);

    drawRail(RAIL_TOP_Y);
    // Note: no decorative hole-grid pattern drawn here - every position in
    // the main grid is now a REAL functional connector (GRID_HOLES), drawn
    // by render() right after this runs, exactly like the rails above.
    const midY = (GRID_TOP_ROWS_Y[GRID_TOP_ROWS_Y.length - 1] + GRID_BOTTOM_ROWS_Y[0]) / 2;
    svgEl.appendChild(svgEl_("rect", {
      x: BREADBOARD_X + 12, y: midY - 5, width: BREADBOARD_W - 24, height: 10,
      fill: "#cabf9e", "shape-rendering": "crispEdges",
    }));
    svgEl.appendChild(svgEl_("rect", {
      x: BREADBOARD_X + 12, y: midY + 3, width: BREADBOARD_W - 24, height: 2,
      fill: "#b3a785", "shape-rendering": "crispEdges",
    }));
    const trenchLabel = svgEl_("text", { x: BREADBOARD_X + BREADBOARD_W / 2, y: midY + 3, fill: "#857a5e", "font-size": 11, "text-anchor": "middle", "font-family": TERMINAL_FONT });
    trenchLabel.textContent = "center trench - each column only connects on ONE side of this line";
    svgEl.appendChild(trenchLabel);
    drawRail(RAIL_BOTTOM_Y);
  }

  // render() rebuilds the ENTIRE board from scratch (every hole, wire, and
  // component - a couple thousand SVG elements), so calling it directly
  // from every pinMode()/digitalWrite()/etc. gets very expensive for a
  // sketch whose loop() has no delay() in it: the interpreter runs up to
  // TICKS_BEFORE_YIELD statements before ever handing control back to the
  // browser, so a tight polling loop (e.g. a button->LED check with no
  // delay()) can call digitalWrite() - and so render() - dozens of times
  // before the browser gets a single chance to actually paint any of them.
  // Only the LAST one before that paint is ever seen; the rest is pure
  // wasted work, and it's exactly what made things "very laggy".
  //
  // Collapsing a burst of render() calls into one is done with setTimeout,
  // not requestAnimationFrame: rAF is tied to the browser's actual paint
  // cycle, which gets starved (confirmed by measurement - gaps over half a
  // second between callbacks) once the window isn't the focused one, even
  // while it's still fully visible. A student very plausibly has another
  // window focused (reading a hint, switching to their notes) while their
  // sketch keeps running - the board should keep updating at a steady rate
  // either way, not silently stall until the tab regains focus.
  let renderScheduled = false;
  function render() {
    if (renderScheduled) return;
    renderScheduled = true;
    setTimeout(() => {
      renderScheduled = false;
      renderNow();
    }, 16); // ~60fps cap - fast enough to look instant, slow enough to skip wasted rebuilds
  }

  function renderNow() {
    syncAnalogInputs();
    svgEl.innerHTML = "";

    drawArduino();
    drawBreadboard();

    drawDecorativePin(POWER_PIN_X.IOREF, BOTTOM_HEADER_Y, "IOREF");
    drawDecorativePin(POWER_PIN_X.RESET, BOTTOM_HEADER_Y, "RST");
    drawDecorativePin(POWER_PIN_X["3V3"], BOTTOM_HEADER_Y, "3V3");
    drawDecorativePin(POWER_PIN_X.VIN, BOTTOM_HEADER_Y, "VIN");
    drawPowerHoles(FIVEV_HOLES, "#e8c547");
    drawPowerHoles(GND_HOLES, "#9aa0b4");
    drawGridHoles();
    for (const pin of DIGITAL_PINS) drawConnector(`pin-${pin}`, PIN_X_START + pin * PIN_X_STEP, DIGITAL_PIN_Y, String(pin), "#4fc3f7");
    for (const pin of ANALOG_PINS) { const p = pinPosition(pin); drawConnector(`pin-${pin}`, p.x, p.y, `A${pin - 14}`, "#b48ce8"); }

    for (const wire of wires) {
      const p1 = connectorPoint(wire.from);
      const p2 = connectorPoint(wire.to);
      const bend = Math.max(35, Math.min(110, Math.abs(p2.y - p1.y) * 0.4));
      const path = svgEl_("path", {
        d: `M ${p1.x} ${p1.y} C ${p1.x} ${p1.y + bend}, ${p2.x} ${p2.y + bend}, ${p2.x} ${p2.y}`,
        fill: "none", stroke: wire.color || "#57d38c", "stroke-width": 3, "stroke-linecap": "round",
        class: "sim-wire",
      });
      path.addEventListener("click", () => removeWire(wire));
      svgEl.appendChild(path);
    }

    // redraw connectors on top so they stay clickable over wires - but
    // BEFORE components, not after: a component's body sits on a lot of
    // main-grid holes (the tray overlaps the grid), and if holes were
    // redrawn after components too, their hit-circles would sit on top of
    // the component and swallow every click/drag meant for it (exactly
    // like a real breadboard, where the component itself physically blocks
    // the holes underneath it once it's plugged in).
    drawPowerHoles(FIVEV_HOLES, "#e8c547", true);
    drawPowerHoles(GND_HOLES, "#9aa0b4", true);
    drawGridHoles(true);
    for (const pin of DIGITAL_PINS) drawConnector(`pin-${pin}`, PIN_X_START + pin * PIN_X_STEP, DIGITAL_PIN_Y, "", "#4fc3f7", true);
    for (const pin of ANALOG_PINS) { const p = pinPosition(pin); drawConnector(`pin-${pin}`, p.x, p.y, "", "#b48ce8", true); }

    drawPinStates();
    for (const comp of components) drawComponent(comp);

    // ...but a component's OWN leads still need to redraw on top of its own
    // body (and the holes drawn above), since those are the actual plug
    // points and must stay clickable no matter what.
    for (const comp of components) {
      for (const suffix of leadSuffixes(comp.kind)) {
        const id = comp.id + suffix;
        const p = connectorPoint(id);
        drawConnector(id, p.x, p.y, "", "#e4e6ec", true, 4);
        const mark = LEAD_LABELS[comp.kind]?.[suffix];
        if (mark) {
          // a small light badge, so the mark stays readable over the holes and wires
          svgEl.appendChild(svgEl_("rect", {
            x: p.x - 6, y: p.y + 6, width: 12, height: 12, rx: 2,
            fill: "#fbf6e6", stroke: "#0d2338", "stroke-width": 1, style: "pointer-events:none",
          }));
          const t = svgEl_("text", {
            x: p.x, y: p.y + 15.5, fill: "#0d2338", "font-size": 10, "font-weight": "700",
            "text-anchor": "middle", "font-family": "monospace", style: "pointer-events:none",
          });
          t.textContent = mark;
          svgEl.appendChild(t);
        }
      }
    }
  }

  // While a sketch runs, every pin it has set up shows what it's doing, right
  // under the pin: an output reads HIGH, LOW or its PWM level (%); an input
  // reads what it currently sees (IN H / IN L, or IN ? when it's floating);
  // an analog pin shows its reading. Makes HIGH and LOW - and inputs versus
  // outputs - visible instead of something to imagine.
  function drawPinStates() {
    if (!running) return;
    const badge = (x, y, text, fill) => {
      const w = text.length * 5.2 + 6;
      svgEl.appendChild(svgEl_("rect", { x: x - w / 2, y: y - 7, width: w, height: 11, rx: 2, fill: "#0b1d17", stroke: fill, "stroke-width": 1, style: "pointer-events:none" }));
      const t = svgEl_("text", { x, y: y + 1.5, fill, "font-size": 8.5, "font-weight": "700", "text-anchor": "middle", "font-family": "monospace", style: "pointer-events:none" });
      t.textContent = text;
      svgEl.appendChild(t);
    };
    for (const pin of DIGITAL_PINS) {
      const mode = pinModes[pin];
      if (!mode) continue;
      const x = PIN_X_START + pin * PIN_X_STEP, y = DIGITAL_PIN_Y + 15;
      if (mode === "OUTPUT") {
        const level = pinOutputs[pin] ?? 0;
        if (level === 255) badge(x, y, "HIGH", "#57d38c");
        else if (level === 0) badge(x, y, "LOW", "#9aa0b4");
        else badge(x, y, `${Math.round((level / 255) * 100)}%`, "#f5c542");
      } else {
        const { level } = inputLevel(pin);
        badge(x, y, level === null ? "IN ?" : level ? "IN H" : "IN L", level === null ? "#ef6461" : "#4fc3f7");
      }
    }
    for (const pin of ANALOG_PINS) {
      if (pinAnalogInputs[pin] === undefined) continue;
      const p = pinPosition(pin);
      badge(p.x, p.y + 14, String(pinAnalogInputs[pin]), "#b48ce8");
    }
  }

  // GND_HOLES/FIVEV_HOLES mix a couple of "main" connectors (the Arduino's
  // own pins - spaced far apart, fine at normal size) with dozens of rail
  // holes (packed every 18px - normal-sized click targets would overlap
  // their neighbors), so each hole picks its own size instead of one fixed
  // size for the whole map.
  function drawPowerHoles(holes, color, topLayer) {
    for (const [id, p] of Object.entries(holes)) {
      const isRailHole = id.includes("rail");
      const r = isRailHole ? 2.4 : 7;
      const pad = isRailHole ? 3 : 8;
      drawConnector(id, p.x, p.y, topLayer ? "" : p.label || "", color, topLayer, r, pad, isRailHole);
    }
  }

  // The main grid has no fixed electrical identity (unlike the yellow/gray
  // power rails) - every hole is just "part of a column", so they all get
  // one neutral hole color. Sized small like rail holes since columns pack
  // holes only 18px apart horizontally and 14px apart vertically.
  function drawGridHoles(topLayer) {
    for (const [id, p] of Object.entries(GRID_HOLES)) {
      drawConnector(id, p.x, p.y, "", "#8a8064", topLayer, 2.2, 2.5, true);
    }
  }

  // square: draw the hole as a crisp pixel square (breadboard holes) rather
  // than a round connector (the Arduino's own header pins).
  function drawConnector(id, x, y, text, color, topLayer, radius, hitPad, square) {
    const r = radius || 7;
    const pad = hitPad ?? 8; // smaller for densely-packed holes (breadboard rails) so neighboring hit zones don't overlap
    const isPending = pending === id;
    const hitArea = svgEl_("circle", { cx: x, cy: y, r: r + pad, fill: "transparent", class: "sim-connector-hit" });
    hitArea.addEventListener("click", () => handleConnectorClick(id));
    svgEl.appendChild(hitArea);
    const look = {
      fill: isPending ? "#fff" : color,
      stroke: isPending ? "#fff" : "#0d2338", "stroke-width": isPending ? 2 : 1,
      class: "sim-connector", style: "pointer-events:none",
    };
    const side = Math.round(r * 2);
    const circle = square
      ? svgEl_("rect", { x: Math.round(x - side / 2), y: Math.round(y - side / 2), width: side, height: side, "shape-rendering": "crispEdges", ...look })
      : svgEl_("circle", { cx: x, cy: y, r, ...look });
    svgEl.appendChild(circle);
    if (text && !topLayer) {
      const t = svgEl_("text", { x, y: y - 14, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
      t.textContent = text;
      svgEl.appendChild(t);
    }
  }

  function drawComponent(comp) {
    const drawFn = {
      led: drawLed, resistor: drawResistor, button: drawButton, rgbled: drawRgbLed, buzzer: drawBuzzer,
      potentiometer: drawPotentiometer, ldr: drawLdr, tempsensor: drawTempSensor,
      ultrasonic: drawUltrasonic, irsensor: drawIrSensor, servo: drawServo, lcd: drawLcd,
    }[comp.kind];
    if (drawFn) drawFn(comp);
  }

  // Every component sits on the cream breadboard body, so its label needs to
  // read against THAT background, not the simulator's dark page chrome - a
  // light gray-on-cream (the original color here) all but disappears. Dark
  // navy at a slightly bigger, semi-bold weight is what actually stays
  // legible at the small sizes labels get drawn at.
  function componentLabel(x, y, text) {
    const label = svgEl_("text", {
      x, y, fill: "#0d2338", "font-size": 11, "font-weight": "600",
      "text-anchor": "middle", "font-family": "monospace",
    });
    label.textContent = text;
    return label;
  }

  function removeGlyph(x, y, onClick) {
    const t = svgEl_("text", {
      x, y, fill: "#ef6461", "font-size": 13, "text-anchor": "middle",
      "font-family": "monospace", style: "cursor:pointer;font-weight:bold",
    });
    t.textContent = "×";
    t.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return t;
  }

  function wireGroup(comp) {
    return svgEl_("g", { class: running ? "" : "sim-draggable" });
  }

  function drawLeads(g, comp) {
    const offsets = LEAD_OFFSETS[comp.kind] || {};
    for (const [suffix, [dx, dy]] of Object.entries(offsets)) {
      // a bare metal lead wire plugging down into a breadboard hole
      g.appendChild(svgEl_("line", {
        x1: comp.x + dx, y1: comp.y + 6, x2: comp.x + dx, y2: comp.y + dy,
        stroke: "#c4c4c4", "stroke-width": 2, "stroke-linecap": "round",
      }));
    }
  }

  // Pixel-art LED, drawn from the same 10x12 grid as the reference sprite
  // (a dome with a highlight, a flange, then the leads). Each letter is one
  // PIXEL_LED_SIZE square, shaded from the LED's own color so every color
  // gets the same look:
  //   o rim, r body, c core (darker center), h/H highlight,
  //   f/F flange, "." empty.
  const PIXEL_LED_MAP = [
    "...orro...",
    "..orrrro..",
    ".orrrrhro.",
    ".orrccrHo.",
    ".orccccHo.",
    ".orccccro.",
    ".orrccrro.",
    ".oorrrroo.",
    ".oorrrroo.",
    "ffffffffff",
    "fFFFFFFFFf",
    "..ffffff..",
  ];
  const PIXEL_LED_SIZE = 4;
  // The sprite's top edge, relative to the component's y, chosen so the base
  // ends 12px above the lead holes (LEAD_OFFSETS y = 38), leaving room for
  // the pixel leads to step out to their holes.
  const PIXEL_LED_TOP = -22;
  // How much each shade mixes toward white (+) or black (-).
  const PIXEL_LED_SHADES = { o: 0.22, r: 0, c: -0.18, h: 0.6, H: 0.85, f: -0.12, F: 0.15 };

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function shadeRgb([r, g, b], amount) {
    const target = amount >= 0 ? 255 : 0;
    const t = Math.abs(amount);
    return [r, g, b].map((v) => Math.round(v + (target - v) * t));
  }

  // rgb is the LED's color at full brightness; level (0..1) is how lit it
  // is. An unlit LED still shows its colored plastic, just dark.
  function drawPixelLedBody(g, comp, rgb, level, legXs) {
    const lit = shadeRgb(rgb, 0);
    const off = shadeRgb(rgb, -0.68);
    const shown = lit.map((v, i) => Math.round(off[i] + (v - off[i]) * level));
    const u = PIXEL_LED_SIZE;
    const left = comp.x - (PIXEL_LED_MAP[0].length * u) / 2;
    const top = comp.y + PIXEL_LED_TOP;

    const sprite = svgEl_("g", {
      "shape-rendering": "crispEdges",
      style: level > 0 ? `filter:drop-shadow(0 0 ${3 + level * 9}px rgb(${lit.join(",")}))` : "",
    });
    PIXEL_LED_MAP.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (ch === ".") return;
        // the highlight stays bright-ish even when unlit, like light catching plastic
        const base = ch === "h" || ch === "H" ? shadeRgb(shown, 0.15) : shown;
        sprite.appendChild(svgEl_("rect", {
          x: left + rx * u, y: top + ry * u, width: u, height: u,
          fill: `rgb(${shadeRgb(base, PIXEL_LED_SHADES[ch]).join(",")})`,
        }));
      });
    });
    // one transparent box over the whole sprite, so drag and double-click
    // work anywhere on it rather than only on whichever pixel was hit
    const hit = svgEl_("rect", {
      x: left, y: top, width: PIXEL_LED_MAP[0].length * u, height: PIXEL_LED_MAP.length * u,
      fill: "transparent",
    });
    sprite.appendChild(hit);
    g.appendChild(sprite);
    drawPixelLeads(g, comp, legXs, top + PIXEL_LED_MAP.length * u);
    return hit;
  }

  // Each lead leaves the base at legXs[i] (relative to comp.x), steps out
  // sideways to its LEAD_OFFSETS hole, then drops into it - striped light
  // and dark gray like the sprite's metal legs.
  function drawPixelLeads(g, comp, legXs, baseY) {
    const u = PIXEL_LED_SIZE;
    const offsets = Object.values(LEAD_OFFSETS[comp.kind] || {});
    const leads = svgEl_("g", { "shape-rendering": "crispEdges", style: "pointer-events:none" });
    const px = (cx, y, i) => leads.appendChild(svgEl_("rect", {
      x: cx - u / 2, y, width: u, height: u, fill: i % 2 ? "#9a9a9a" : "#d6d6d6",
    }));
    offsets.forEach(([dx, dy], li) => {
      const from = comp.x + legXs[li], to = comp.x + dx;
      let i = 0;
      px(from, baseY, i++);
      const step = Math.sign(to - from);
      for (let x = from; step !== 0 && Math.abs(to - x) > 0; x += step * Math.min(u, Math.abs(to - x))) {
        px(x, baseY + u, i++);
      }
      for (let y = baseY + u; y < comp.y + dy; y += u) px(to, y, i++);
    });
    g.appendChild(leads);
  }

  function drawLed(led) {
    const pin = ledConnectedPin(led);
    // Only a pin set to OUTPUT can power an LED (see digitalWrite above).
    const level = ledLevel(led.id + "-a", led.id + "-k");
    const g = wireGroup(led);

    const hit = drawPixelLedBody(g, led, hexToRgb(led.color || "#ffe066"), level > 0 ? 0.35 + (level / 255) * 0.65 : 0, [-6, 6]);
    onPress(hit, (e) => startDrag(led, e));
    hit.addEventListener("dblclick", (e) => { e.stopPropagation(); cycleLedColor(led); });
    const wired = connectedSet(led.id + "-a").size > 1 || connectedSet(led.id + "-k").size > 1;
    g.appendChild(componentLabel(led.x, led.y + 74, pin !== null ? `LED (pin ${pin})` : wired ? "LED (check wiring)" : "LED (unwired)"));
    g.appendChild(removeGlyph(led.x + 28, led.y - 14, () => removeComponent(led.id)));
    svgEl.appendChild(g);
  }

  // A resistor doesn't switch or light up - it's just a body sitting between
  // its two leads - so unlike every other component here its only "state" is
  // which value it's set to. Double-click cycles through RESISTOR_VALUES,
  // same interaction as double-clicking an LED to cycle its color, and the
  // bands drawn always match the REAL color code for the current value.
  function drawResistor(comp) {
    const value = RESISTOR_VALUES.find((v) => v.ohms === comp.ohms) || RESISTOR_VALUES[0];
    const g = wireGroup(comp);
    const bodyW = 30, bodyH = 13;
    const bodyX = comp.x - bodyW / 2, bodyY = comp.y;

    const body = svgEl_("rect", {
      x: bodyX, y: bodyY, width: bodyW, height: bodyH, rx: 5,
      fill: "#d9c398", stroke: "#8a7550", "stroke-width": 1.5,
    });
    onPress(body, (e) => startDrag(comp, e));
    body.addEventListener("dblclick", (e) => { e.stopPropagation(); cycleResistorValue(comp); });
    g.appendChild(body);
    value.bands.forEach((bandName, i) => {
      g.appendChild(svgEl_("rect", {
        x: bodyX + 6 + i * 7, y: bodyY, width: 3, height: bodyH,
        fill: RESISTOR_BAND_COLORS[bandName], style: "pointer-events:none",
      }));
    });
    drawLeads(g, comp);
    g.appendChild(componentLabel(comp.x, comp.y + 50, `Resistor · ${value.label}`));
    g.appendChild(removeGlyph(comp.x + 22, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawButton(btn) {
    const isPressed = pressed.has(btn.id);
    const g = wireGroup(btn);

    const body = svgEl_("rect", {
      x: btn.x - 20, y: btn.y + (isPressed ? 8 : 0), width: 40, height: 30, rx: 4,
      fill: isPressed ? "#4a4f63" : "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2,
      style: `cursor:${running ? "pointer" : "grab"}`,
    });
    onPress(body, (e) => {
      if (running) { pressed.add(btn.id); render(); }
      else { startDrag(btn, e); }
    });
    const release = () => { if (running && pressed.has(btn.id)) { pressed.delete(btn.id); render(); } };
    for (const type of ["pointerup", "pointerleave", "pointercancel"]) body.addEventListener(type, release);
    g.appendChild(body);
    drawLeads(g, btn);

    const pin = wiredPinOf(btn.id + "-1") ?? wiredPinOf(btn.id + "-2");
    const label = pin !== null
      ? (running ? `Button (pin ${pin}) - hold to press` : `Button (pin ${pin})`)
      : "Button (unwired)";
    g.appendChild(componentLabel(btn.x, btn.y + 58, label));
    g.appendChild(removeGlyph(btn.x + 24, btn.y - 6, () => removeComponent(btn.id)));
    svgEl.appendChild(g);
  }

  function drawRgbLed(comp) {
    const rPin = wiredPinOf(comp.id + "-r"), gPin = wiredPinOf(comp.id + "-g"), bPin = wiredPinOf(comp.id + "-b");
    const commonOk = isWiredToGnd(comp.id + "-c");
    const drive = (p) => (commonOk && p !== null && pinModes[p] === "OUTPUT" ? (pinOutputs[p] ?? 0) : 0);
    const rVal = drive(rPin);
    const gVal = drive(gPin);
    const bVal = drive(bPin);
    const isLit = rVal > 0 || gVal > 0 || bVal > 0;

    const g = wireGroup(comp);
    // Lit: the mixed color scaled up to full strength, with how bright the
    // strongest channel is as the level. Unlit: frosted white plastic.
    const peak = Math.max(rVal, gVal, bVal);
    const rgb = isLit ? [rVal, gVal, bVal].map((v) => Math.round((v / peak) * 255)) : [230, 232, 240];
    const hit = drawPixelLedBody(g, comp, rgb, isLit ? 0.35 + (peak / 255) * 0.65 : 0, [-10, -2, 2, 10]);
    onPress(hit, (e) => startDrag(comp, e));
    const wiredCount = [rPin, gPin, bPin].filter((p) => p !== null).length;
    g.appendChild(componentLabel(comp.x, comp.y + 74, wiredCount === 3 ? "RGB LED (R,G,B wired)" : `RGB LED (${wiredCount}/3 wired)`));
    g.appendChild(removeGlyph(comp.x + 32, comp.y - 14, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawBuzzer(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const isActive = pin !== null && soundingPins[pin] !== undefined && isWiredToGnd(comp.id + "-g");
    const g = wireGroup(comp);

    const body = svgEl_("circle", {
      cx: comp.x, cy: comp.y + 20, r: 16,
      fill: isActive ? "#3a2f52" : "#2a2f3f", stroke: isActive ? "#b48ce8" : "#9aa0b4", "stroke-width": 2,
    });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    if (isActive) {
      for (const r of [24, 30]) {
        g.appendChild(svgEl_("circle", {
          cx: comp.x, cy: comp.y + 20, r, fill: "none", stroke: "#b48ce8", "stroke-width": 1.5, opacity: 0.6,
        }));
      }
    }
    drawLeads(g, comp);
    g.appendChild(componentLabel(comp.x, comp.y + 74, pin !== null ? `Buzzer (pin ${pin})` : "Buzzer (unwired)"));
    g.appendChild(removeGlyph(comp.x + 24, comp.y - 2, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawSliderControl(g, x, y, width, frac, onDrag) {
    const track = svgEl_("rect", { x, y: y - 3, width, height: 6, rx: 3, fill: "#0d2338", stroke: "#2a2f3f" });
    g.appendChild(track);
    const hit = svgEl_("rect", { x, y: y - 10, width, height: 20, fill: "transparent", style: "cursor:pointer" });
    onPress(hit, (e) => startSliderDrag(x, width, onDrag, e));
    g.appendChild(hit);
    const handleX = x + frac * width;
    const handle = svgEl_("circle", { cx: handleX, cy: y, r: 7, fill: "#4fc3f7", stroke: "#06202b", "stroke-width": 1.5, style: "cursor:pointer" });
    onPress(handle, (e) => startSliderDrag(x, width, onDrag, e));
    g.appendChild(handle);
  }

  function drawPotentiometer(comp) {
    const pin = wiredPinOf(comp.id + "-w");
    const g = wireGroup(comp);
    const body = svgEl_("rect", { x: comp.x - 24, y: comp.y, width: 48, height: 30, rx: 5, fill: "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2 });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    const knobAngle = (comp.rawValue / 1023) * 270 - 135;
    const knob = svgEl_("circle", { cx: comp.x, cy: comp.y + 15, r: 10, fill: "#1c3d5a", stroke: "#4fc3f7", "stroke-width": 2 });
    g.appendChild(knob);
    const rad = (knobAngle * Math.PI) / 180;
    g.appendChild(svgEl_("line", {
      x1: comp.x, y1: comp.y + 15, x2: comp.x + Math.sin(rad) * 8, y2: comp.y + 15 - Math.cos(rad) * 8,
      stroke: "#fff", "stroke-width": 2,
    }));
    drawLeads(g, comp);
    if (!running) {
      g.appendChild(componentLabel(comp.x, comp.y + 76, pin !== null ? `Potentiometer (pin A${pin - 14})` : "Potentiometer (unwired)"));
    } else {
      drawSliderControl(g, comp.x - 24, comp.y + 76, 48, comp.rawValue / 1023, (frac) => { comp.rawValue = Math.round(frac * 1023); });
      g.appendChild(componentLabel(comp.x, comp.y + 92, `value: ${comp.rawValue}`));
    }
    g.appendChild(removeGlyph(comp.x + 32, comp.y - 6, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawLdr(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const g = wireGroup(comp);
    const glow = comp.lightPct / 100;
    const body = svgEl_("circle", {
      cx: comp.x, cy: comp.y + 18, r: 14,
      fill: `rgba(245, 197, 66, ${0.15 + glow * 0.5})`, stroke: "#f5c542", "stroke-width": 2,
    });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    g.appendChild(componentLabel(comp.x, comp.y + 22, "LDR"));
    drawLeads(g, comp);
    g.appendChild(componentLabel(comp.x, comp.y + 78, pin !== null ? `Light Sensor (pin A${pin - 14})` : "Light Sensor (unwired)"));
    if (running) {
      drawSliderControl(g, comp.x - 24, comp.y + 92, 48, comp.lightPct / 100, (frac) => { comp.lightPct = Math.round(frac * 100); });
      g.appendChild(componentLabel(comp.x, comp.y + 108, `light: ${comp.lightPct}%`));
    }
    g.appendChild(removeGlyph(comp.x + 30, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawTempSensor(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const g = wireGroup(comp);
    const body = svgEl_("rect", { x: comp.x - 12, y: comp.y, width: 24, height: 30, rx: 4, fill: "#2a2f3f", stroke: "#ff9f4a", "stroke-width": 2 });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    drawLeads(g, comp);
    g.appendChild(componentLabel(comp.x, comp.y + 78, pin !== null ? `Temp Sensor (pin A${pin - 14})` : "Temp Sensor (unwired)"));
    if (running) {
      drawSliderControl(g, comp.x - 24, comp.y + 92, 48, (comp.tempC + 10) / 60, (frac) => { comp.tempC = Math.round(frac * 60 - 10); });
      g.appendChild(componentLabel(comp.x, comp.y + 108, `${comp.tempC}°C`));
    }
    g.appendChild(removeGlyph(comp.x + 24, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawUltrasonic(comp) {
    const g = wireGroup(comp);
    const body = svgEl_("rect", { x: comp.x - 30, y: comp.y, width: 60, height: 28, rx: 4, fill: "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2 });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    g.appendChild(svgEl_("circle", { cx: comp.x - 14, cy: comp.y + 14, r: 9, fill: "#1c3d5a", stroke: "#7fb8e0" }));
    g.appendChild(svgEl_("circle", { cx: comp.x + 14, cy: comp.y + 14, r: 9, fill: "#1c3d5a", stroke: "#7fb8e0" }));
    drawLeads(g, comp);
    const trigPin = wiredPinOf(comp.id + "-t"), echoPin = wiredPinOf(comp.id + "-e");
    const wiredOk = trigPin !== null && echoPin !== null;
    g.appendChild(componentLabel(comp.x, comp.y + 80, wiredOk ? `Ultrasonic (trig ${trigPin}, echo ${echoPin})` : "Ultrasonic (unwired)"));
    if (running) {
      drawSliderControl(g, comp.x - 30, comp.y + 94, 60, comp.distanceCm / 400, (frac) => { comp.distanceCm = Math.round(frac * 400); });
      g.appendChild(componentLabel(comp.x, comp.y + 110, `${comp.distanceCm} cm away`));
    }
    g.appendChild(removeGlyph(comp.x + 38, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawIrSensor(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const isBlocked = irBlocked.has(comp.id);
    const g = wireGroup(comp);
    const body = svgEl_("rect", {
      x: comp.x - 16, y: comp.y, width: 32, height: 24, rx: 4,
      fill: isBlocked ? "#4a2f2f" : "#2a2f3f", stroke: isBlocked ? "#ef6461" : "#9aa0b4", "stroke-width": 2,
      style: `cursor:${running ? "pointer" : "grab"}`,
    });
    onPress(body, (e) => { if (running) toggleIr(comp); else startDrag(comp, e); });
    g.appendChild(body);
    drawLeads(g, comp);
    const status = pin === null ? "IR Sensor (unwired)" : running ? `IR (pin ${pin}) - click to ${isBlocked ? "clear" : "block"}` : `IR Sensor (pin ${pin})`;
    g.appendChild(componentLabel(comp.x, comp.y + 72, status));
    g.appendChild(removeGlyph(comp.x + 22, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawServo(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const angle = pin !== null ? (servoAngles[pin] ?? 90) : 90;
    const g = wireGroup(comp);
    const body = svgEl_("rect", { x: comp.x - 20, y: comp.y, width: 40, height: 34, rx: 4, fill: "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2 });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);
    const pivotX = comp.x, pivotY = comp.y + 17;
    g.appendChild(svgEl_("circle", { cx: pivotX, cy: pivotY, r: 5, fill: "#0d2338", stroke: "#7fb8e0" }));
    const rad = ((angle - 90) * Math.PI) / 180;
    g.appendChild(svgEl_("line", {
      x1: pivotX, y1: pivotY, x2: pivotX + Math.sin(rad) * 22, y2: pivotY - Math.cos(rad) * 22,
      stroke: "#4fc3f7", "stroke-width": 3, "stroke-linecap": "round",
    }));
    drawLeads(g, comp);
    g.appendChild(componentLabel(comp.x, comp.y + 76, pin !== null ? `Servo (pin ${pin}) - ${Math.round(angle)}°` : "Servo (unwired)"));
    g.appendChild(removeGlyph(comp.x + 26, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawLcd(comp) {
    const g = wireGroup(comp);
    const w = 200, h = 56;
    const body = svgEl_("rect", { x: comp.x - w / 2, y: comp.y, width: w, height: h, rx: 4, fill: "#274d1e", stroke: "#9aa0b4", "stroke-width": 2 });
    onPress(body, (e) => startDrag(comp, e));
    g.appendChild(body);

    if (lcd.begun) {
      for (let row = 0; row < lcd.rows; row++) {
        const text = (lcd.lines[row] || "").padEnd(lcd.cols, " ");
        const t = svgEl_("text", {
          x: comp.x - w / 2 + 8, y: comp.y + 20 + row * 18, fill: "#c8f0b0",
          "font-size": 11, "font-family": "monospace", style: "white-space:pre",
        });
        t.textContent = text;
        g.appendChild(t);
      }
    } else {
      g.appendChild(componentLabel(comp.x, comp.y + h / 2 + 4, "waiting for lcd.begin()..."));
    }
    g.appendChild(componentLabel(comp.x, comp.y + h + 16, "LCD Display (no wiring needed - just declare it in code)"));
    g.appendChild(removeGlyph(comp.x + w / 2 - 8, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  // ---------- the circuit check ----------
  // Reads the circuit the way you would with a multimeter and reports what it
  // finds. Every finding comes from the connections actually on the board -
  // never a guess about what you meant. Levels:
  //   problem - this part can't work as wired (here OR on a real board)
  //   real    - works in the simulator, but a real board would behave
  //             differently or be damaged: the simulator's simplifications,
  //             said out loud instead of passed over silently
  //   info    - worth knowing (not wired yet, always on, ...)
  //   ok      - wired correctly
  const LEVEL_ORDER = { problem: 0, real: 1, info: 2, ok: 3 };
  const pinLabel = (p) => (p >= 14 ? `A${p - 14}` : String(p));
  const pinList = (pins) => pins.map((p) => `pin ${pinLabel(p)}`).join(" and ");

  function componentName(comp) {
    return `${KIND_NAMES[comp.kind] || comp.kind} ${comp.id.slice(comp.kind.length + 1)}`;
  }

  // "down" if a resistor joins the pin to GND, "up" if to 5V, otherwise null.
  function pullResistor(pin) {
    const strong = strongNet(`pin-${pin}`);
    for (const r of components) {
      if (r.kind !== "resistor") continue;
      for (const [near, far] of [["-1", "-2"], ["-2", "-1"]]) {
        if (!strong.has(r.id + near)) continue;
        const other = strongNet(r.id + far);
        if (touchesGnd(other)) return "down";
        if (touches5v(other)) return "up";
      }
    }
    return null;
  }

  function inspectCircuit() {
    const findings = [];
    const add = (level, comp, text, data) =>
      findings.push({ level, subject: comp ? componentName(comp) : "Circuit", id: comp?.id ?? null, text, ...(data ? { data } : {}) });
    // undefined = there hasn't been a run yet; null = the last run never set this pin up
    const modeInLastRun = (p) => (lastRunModes ? lastRunModes[p] ?? null : undefined);
    const ofKind = (kind) => components.filter((c) => c.kind === kind);
    const isWired = (id) => connectedSet(id).size > 1;

    if (!components.length && !wires.length) {
      add("info", null, "The board is empty. Choose a part from the list, press + Add, then wire its legs to the Arduino.");
    }

    // ---- short circuits ----
    if (touchesGnd(strongNet("5v"))) {
      add("problem", null, "5V is wired straight to GND - a short circuit. On a real board this can damage the board or your computer's USB port. Remove the wire that joins them.");
    }
    for (let p = 0; p <= 19; p++) {
      const net = strongNet(`pin-${p}`);
      if (net.size <= 1 || modeInLastRun(p) !== "OUTPUT") continue;
      const rail = touchesGnd(net) ? "GND" : touches5v(net) ? "5V" : null;
      if (rail) {
        add("problem", null, `Pin ${pinLabel(p)} is an OUTPUT in your sketch but is wired straight to ${rail} with nothing in between - a short circuit whenever the pin drives the opposite way, which can damage a real pin. Put the part (and its resistor) between the pin and ${rail}.`);
      }
    }

    // ---- LEDs ----
    for (const led of ofKind("led")) {
      const aId = led.id + "-a", kId = led.id + "-k";
      const a = connectedSet(aId), k = connectedSet(kId);
      if (a.size <= 1 && k.size <= 1) {
        add("info", led, "Not wired yet. Its long leg (+) goes toward a pin, its short leg (−) to GND.");
        continue;
      }
      if (a.has(kId)) {
        add("problem", led, "Both legs are connected to the same point, so no current can flow through the LED. Each leg needs its own connection: + toward a pin, − to GND.");
        continue;
      }
      const aPins = pinsIn(a), kPins = pinsIn(k);
      const source = aPins.length > 0 || touches5v(a);
      const sink = touchesGnd(k) || kPins.length > 0;
      if (touchesGnd(a) && (kPins.length || touches5v(k))) {
        add("problem", led, `It's in backwards: the long leg (+) goes to GND and the short leg (−) to ${kPins.length ? pinList(kPins) : "5V"}. An LED only lets current through from + to −, so it will never light. Swap its two connections.`);
        continue;
      }
      if (source && !sink) {
        add("problem", led, k.size > 1
          ? "The short leg (−) doesn't reach GND, so the circuit isn't complete and no current can flow. Connect it to a GND pin or the − rail."
          : "The short leg (−) isn't connected to anything, so the circuit isn't complete. Connect it to GND.");
        continue;
      }
      if (!source && touchesGnd(a)) {
        add("problem", led, "The long leg (+) is connected to GND - that's the wrong way round. The + leg goes toward the pin (through a resistor), the − leg to GND.");
        continue;
      }
      if (!source) {
        add("problem", led, a.size > 1
          ? "The long leg (+) doesn't reach a pin or 5V, so nothing can power the LED. Connect it, through a resistor, to the pin your sketch controls."
          : "The long leg (+) isn't connected to anything. Connect it, through a resistor, to the pin your sketch controls.");
        continue;
      }

      // A complete circuit from here on.
      const where = aPins.length ? pinList(aPins) : "5V";
      const strongA = strongNet(aId), strongK = strongNet(kId);
      const noResistor = (pinsIn(strongA).length > 0 || touches5v(strongA)) && (touchesGnd(strongK) || pinsIn(strongK).length > 0);
      add("ok", led, `Complete circuit: ${where} → ${noResistor ? "" : "resistor → "}LED → GND.`, { pin: aPins[0] ?? null, resistor: !noResistor });
      if (noResistor) {
        add("real", led, `No resistor in series. The simulator still lights it, but a real LED wired straight to ${where} draws too much current and burns out (it can damage the pin too). Put a 220Ω resistor between ${where} and the LED.`);
      } else {
        const series = components.filter((r) => r.kind === "resistor" && [strongA, strongK].some((s) => s.has(r.id + "-1") || s.has(r.id + "-2")));
        if (series.some((r) => r.ohms >= 10000)) {
          add("real", led, "It goes through a 10kΩ resistor. A real LED would be very dim with that much resistance - the simulator doesn't change brightness with resistor values. 220Ω-330Ω is the usual choice for an LED.");
        }
      }
      if (!aPins.length) {
        add("info", led, "Its + leg goes to 5V rather than a pin, so it's simply on whenever the board is powered - your sketch can't switch it.");
      } else if (kPins.length && !touchesGnd(k)) {
        add("info", led, `Its − leg goes to ${pinList(kPins)} instead of GND, so it only lights while that pin is an OUTPUT set LOW.`);
      } else if (modeInLastRun(aPins[0]) === null || (modeInLastRun(aPins[0]) && modeInLastRun(aPins[0]) !== "OUTPUT")) {
        add("info", led, `Your last run never made pin ${pinLabel(aPins[0])} an OUTPUT - add pinMode(${pinLabel(aPins[0])}, OUTPUT); to setup() so the pin can power the LED.`);
      }
    }

    // ---- RGB LEDs ----
    for (const rgb of ofKind("rgbled")) {
      const legs = { R: rgb.id + "-r", G: rgb.id + "-g", B: rgb.id + "-b" };
      const wiredLegs = Object.entries(legs).filter(([, id]) => isWired(id));
      if (!wiredLegs.length && !isWired(rgb.id + "-c")) {
        add("info", rgb, "Not wired yet. Its R, G and B legs go to (PWM) pins through resistors, and the − leg to GND.");
        continue;
      }
      if (!isWiredToGnd(rgb.id + "-c")) {
        add("problem", rgb, "The common − leg doesn't reach GND, so none of the colors can light. Connect it to GND.");
        continue;
      }
      const pinned = wiredLegs.filter(([, id]) => wiredPinOf(id) !== null);
      add(pinned.length === 3 ? "ok" : "info", rgb, pinned.length === 3
        ? `All three colors are wired: ${pinned.map(([c, id]) => `${c} → pin ${pinLabel(wiredPinOf(id))}`).join(", ")}.`
        : `${pinned.length} of 3 color legs reach a pin.`,
      pinned.length === 3 ? { r: wiredPinOf(legs.R), g: wiredPinOf(legs.G), b: wiredPinOf(legs.B) } : undefined);
      if (pinned.some(([, id]) => pinsIn(strongNet(id)).length > 0)) {
        add("real", rgb, "At least one color leg is wired straight to a pin. The simulator doesn't mind, but on a real board each color needs its own 220Ω resistor.");
      }
    }

    // ---- buttons ----
    for (const btn of ofKind("button")) {
      const s1 = connectedSet(btn.id + "-1"), s2 = connectedSet(btn.id + "-2");
      if (s1.size <= 1 && s2.size <= 1) {
        add("info", btn, "Not wired yet. One leg goes to an input pin, the other to GND (then use INPUT_PULLUP in your sketch).");
        continue;
      }
      if (s1.has(btn.id + "-2")) {
        add("problem", btn, "Both legs are connected together, so pressing it changes nothing.");
        continue;
      }
      const p1 = pinsIn(s1), p2 = pinsIn(s2);
      if (!p1.length && !p2.length) {
        add("problem", btn, "Neither leg reaches a pin, so your sketch can't read it. Connect one leg to an input pin.");
        continue;
      }
      if (p1.length && p2.length) {
        add("info", btn, `Its legs go to two pins (${pinList([...p1, ...p2])}). Usually one leg goes to a pin and the other to GND.`);
        continue;
      }
      const [pinSide, far] = p1.length ? [p1, s2] : [p2, s1];
      const p = pinSide[0], P = pinLabel(p);
      const toGnd = touchesGnd(far), to5v = touches5v(far);
      if (!toGnd && !to5v) {
        add("problem", btn, `One leg is on pin ${P}, but the other leg doesn't reach GND or 5V, so pressing it can't change what the pin reads. Connect the other leg to GND (and use INPUT_PULLUP in your sketch).`);
        continue;
      }
      add("ok", btn, toGnd
        ? `Pin ${P} to GND. With pinMode(${P}, INPUT_PULLUP) it reads HIGH when released and LOW while pressed.`
        : `Pin ${P} to 5V. It reads HIGH while pressed.`, { pin: p, to: toGnd ? "gnd" : "5v" });
      const m = modeInLastRun(p);
      const pull = pullResistor(p);
      if (toGnd && m === "INPUT" && pull !== "up") {
        add("problem", btn, `Your last run used pinMode(${P}, INPUT) with no pull-up, so while the button is released nothing holds pin ${P} HIGH - it floats and reads random values. Use INPUT_PULLUP.`);
      }
      if (to5v && m === "INPUT_PULLUP") {
        add("problem", btn, `With INPUT_PULLUP, pin ${P} is already held HIGH, so connecting it to 5V changes nothing when you press. Wire the other leg to GND instead.`);
      } else if (to5v && pull !== "down") {
        add(m === undefined ? "info" : "problem", btn, `Nothing pulls pin ${P} LOW while the button is released, so it floats and reads random values. Add a 10kΩ resistor from pin ${P} to GND (a pull-down) - or wire the button to GND and use INPUT_PULLUP.`);
      }
    }

    // ---- sound, sensors and motors: the parts the simulator simplifies ----
    for (const bz of ofKind("buzzer")) {
      const pin = wiredPinOf(bz.id + "-s");
      if (pin === null && !isWired(bz.id + "-g")) { add("info", bz, "Not wired yet. Its + leg goes to a pin, its − leg to GND."); continue; }
      if (pin === null) { add("problem", bz, "The + leg doesn't reach a pin, so your sketch can't drive it."); continue; }
      if (!isWiredToGnd(bz.id + "-g")) { add("problem", bz, "The − leg doesn't reach GND, so no current flows and it stays silent. Connect it to GND."); continue; }
      add("ok", bz, `Pin ${pinLabel(pin)} → buzzer → GND.`, { pin });
    }
    for (const pot of ofKind("potentiometer")) {
      const pin = wiredPinOf(pot.id + "-w");
      if (pin === null && !isWired(pot.id + "-v") && !isWired(pot.id + "-g")) { add("info", pot, "Not wired yet. Middle leg (W) to an analog pin (A0-A5), outer legs to 5V and GND."); continue; }
      if (pin === null) { add("problem", pot, "The middle leg (W, the wiper) doesn't reach a pin, so there's nothing for analogRead() to read."); continue; }
      if (pin < 14) { add("problem", pot, `The middle leg goes to digital pin ${pin}. analogRead() only works on the analog pins A0-A5.`); continue; }
      add("ok", pot, `Middle leg (wiper) on ${pinLabel(pin)}.`, { pin });
      const powered = (isWiredTo5v(pot.id + "-v") && isWiredToGnd(pot.id + "-g")) || (isWiredToGnd(pot.id + "-v") && isWiredTo5v(pot.id + "-g"));
      if (!powered) add("real", pot, "Its outer legs aren't connected to 5V and GND. The simulator reads the knob anyway, but a real potentiometer needs one outer leg on 5V and the other on GND - otherwise the middle leg has no voltage to measure.");
    }
    for (const s of [...ofKind("ldr"), ...ofKind("tempsensor")]) {
      const pin = wiredPinOf(s.id + "-s");
      if (pin === null && !isWired(s.id + "-g")) { add("info", s, "Not wired yet. Its S leg goes to an analog pin (A0-A5), its − leg to GND."); continue; }
      if (pin === null) { add("problem", s, "The S (signal) leg doesn't reach a pin, so there's nothing for analogRead() to read."); continue; }
      if (pin < 14) { add("problem", s, `The S leg goes to digital pin ${pin}. analogRead() only works on the analog pins A0-A5.`); continue; }
      add("ok", s, `Signal on ${pinLabel(pin)}.`, { pin });
      add("real", s, s.kind === "ldr"
        ? "The simulator turns the light slider straight into a reading. A real LDR needs a partner resistor to make a voltage divider: LDR from 5V to the analog pin, and a 10kΩ resistor from that pin to GND."
        : "The simulator only needs the signal leg. A real TMP36 has three legs: 5V, signal (to the analog pin) and GND - all three must be connected.");
    }
    for (const ir of ofKind("irsensor")) {
      const pin = wiredPinOf(ir.id + "-s");
      if (pin === null && !isWired(ir.id + "-g")) { add("info", ir, "Not wired yet. Its S leg goes to a digital pin, its − leg to GND."); continue; }
      if (pin === null) { add("problem", ir, "The S (signal) leg doesn't reach a pin, so your sketch can't read it."); continue; }
      if (!isWiredToGnd(ir.id + "-g") && !isWiredTo5v(ir.id + "-g")) { add("problem", ir, "The − leg isn't connected to GND, so the sensor can't change the pin. Connect it to GND."); continue; }
      add("ok", ir, `Signal on pin ${pinLabel(pin)}. It reads LOW while it sees an obstacle.`, { pin });
      add("real", ir, "A real IR obstacle module also needs 5V on its VCC pin. The simulated one runs without it.");
    }
    for (const us of ofKind("ultrasonic")) {
      const trig = wiredPinOf(us.id + "-t"), echo = wiredPinOf(us.id + "-e");
      if (trig === null && echo === null) { add("info", us, "Not wired yet. T (trig) and E (echo) each go to a digital pin."); continue; }
      if (trig === null || echo === null) { add("problem", us, `The ${trig === null ? "T (trig)" : "E (echo)"} leg doesn't reach a pin. Both need their own pin.`); continue; }
      add("ok", us, `Trig on pin ${trig}, echo on pin ${echo}.`, { trig, echo });
      add("real", us, "A real HC-SR04 also needs VCC (5V) and GND wires. This simulated one only has its trig and echo legs.");
    }
    for (const sv of ofKind("servo")) {
      const pin = wiredPinOf(sv.id + "-s");
      if (pin === null) { add("info", sv, "Not wired yet. Its S (signal) leg goes to the pin you attach() in your sketch."); continue; }
      add("ok", sv, `Signal on pin ${pinLabel(pin)}.`, { pin });
      add("real", sv, "A real servo has three wires: signal, 5V (red) and GND (brown or black). The simulator only uses the signal wire.");
    }
    for (const l of ofKind("lcd")) {
      add("real", l, "The simulated LCD needs no wires - your sketch's LiquidCrystal lcd(...) line is enough. A real 16x2 LCD needs six signal wires, 5V, GND and a contrast knob.");
    }

    // ---- the breadboard's power rails ----
    const touchesWire = (test) => wires.some((w) => test(w.from) || test(w.to));
    const jumpered = (pins, prefix) => wires.some((w) => (pins.includes(w.from) && w.to.startsWith(prefix)) || (pins.includes(w.to) && w.from.startsWith(prefix)));
    for (const [prefix, pins, name, sign] of [["gnd-rail", ["gnd", "gnd-pwr2"], "GND", "−"], ["5v-rail", ["5v"], "5V", "+"]]) {
      if (touchesWire((id) => id.startsWith(prefix)) && !jumpered(pins, prefix)) {
        add("real", null, `You used the breadboard's ${sign} rail. The simulator treats it as ${name} automatically, but on a real breadboard it's connected to nothing until you run a wire from the Arduino's ${name} pin to the rail.`);
      }
    }

    // ---- what the last run did with pins that have nothing on them ----
    if (lastRunModes) {
      for (const [p, m] of Object.entries(lastRunModes)) {
        if (m === "OUTPUT" && connectedSet(`pin-${p}`).size <= 1) {
          add("info", null, `Your last run used pin ${pinLabel(Number(p))} as an OUTPUT, but nothing is wired to pin ${pinLabel(Number(p))}.`);
        }
      }
    }

    findings.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
    const count = (level) => findings.filter((f) => f.level === level).length;
    return { findings, problems: count("problem"), real: count("real") };
  }

  // Replaces the whole circuit with a lesson's starter circuit:
  //   { parts: [{ key: "r", kind: "resistor" }, ...],
  //     wires: [["5v", "r.1"], ["r.2", "led.a"], ...] }
  // "r.1" means lead -1 of the part with key r; anything else ("5v", "gnd",
  // "pin-13") is a board connector. Returns { key: componentId }.
  function loadCircuit({ parts = [], wires: wireSpec = [] } = {}) {
    components = [];
    wires = [];
    pressed = new Set();
    irBlocked = new Set();
    pending = null;
    nextComponentNum = {};
    signalColorCursor = 0;
    const ids = {};
    for (const part of parts) {
      ids[part.key] = addComponent(part.kind);
      // a resistor can come with its value (one of the values the board offers)
      const comp = components[components.length - 1];
      if (part.ohms && RESISTOR_VALUES.some((v) => v.ohms === part.ohms)) comp.ohms = part.ohms;
      // a saved circuit (exportCircuit) also keeps where each part was, and an LED's colour
      if (Number.isFinite(part.x) && Number.isFinite(part.y)) { comp.x = part.x; comp.y = part.y; }
      if (part.color && comp.kind === "led") comp.color = part.color;
    }
    const resolve = (ref) => {
      const m = /^(\w+)\.(\w+)$/.exec(ref);
      return m && ids[m[1]] ? `${ids[m[1]]}-${m[2]}` : ref;
    };
    for (const [a, b] of wireSpec) {
      const from = resolve(a), to = resolve(b);
      wires.push({ from, to, color: autoColor(from, to) });
    }
    circuitChanged();
    return ids;
  }

  // A read-only peek at the circuit, for the guided tour and the tests.
  function areConnected(a, b, throughResistors = true) {
    return connectedSet(a, throughResistors).has(b);
  }
  function listComponents() {
    return components.map((c) => ({ id: c.id, kind: c.kind, ohms: c.ohms }));
  }
  function ledLevels() {
    return Object.fromEntries(components.filter((c) => c.kind === "led").map((c) => [c.id, ledLevel(c.id + "-a", c.id + "-k")]));
  }
  function wireCount() {
    return wires.length;
  }
  // The circuit as a loadCircuit() spec - parts (with their positions) and
  // wires - so it can be saved (the portfolio) and drawn again exactly.
  function exportCircuit() {
    const keyOf = new Map(components.map((c) => [c.id, c.id.replace(/-/g, "")]));
    const ref = (connector) => {
      const m = /^(.+)-([a-z0-9]+)$/.exec(connector);
      return m && keyOf.has(m[1]) ? `${keyOf.get(m[1])}.${m[2]}` : connector;
    };
    return {
      parts: components.map((c) => ({ key: keyOf.get(c.id), kind: c.kind, x: c.x, y: c.y, ...(c.ohms ? { ohms: c.ohms } : {}), ...(c.color ? { color: c.color } : {}) })),
      wires: wires.map((w) => [ref(w.from), ref(w.to)]),
    };
  }
  function isRunning() {
    return running;
  }

  render();

  return {
    pinMode, digitalWrite, digitalRead, analogRead, analogWrite, pulseIn, tone, noTone, servoWrite,
    lcdBegin, lcdPrint, lcdSetCursor, lcdClear, pinStatus,
    addComponent, removeComponent, clearWiring, reset, setRunning, setWireColor,
    connect, setButtonPressed, updateComponent,
    inspectCircuit, areConnected, listComponents, ledLevels, wireCount, isRunning, loadCircuit, exportCircuit,
    getWirePalette: () => WIRE_PALETTE,
  };
}
