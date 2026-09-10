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
// exposed as MULTIPLE clickable holes here, all belonging to the same GND (or
// 5V) net - exactly like a real breadboard, where any hole along a rail is
// electrically identical. Each hole gets its own id so a wire drawn to it
// renders at THAT hole, not at some other point sharing the same net - but
// electrically (for digitalRead/analogRead purposes) they're all just "GND"
// or "5V". Simplification: unlike a real breadboard, a rail hole here is
// "live" the moment you use it - you don't have to separately jumper the
// Arduino's GND/5V pin to the rail first. That's a deliberate beginner-
// friendly shortcut, not an oversight.
const RAIL_TAP_DX = [110, 340, 570]; // x-offsets from BREADBOARD_X for the rail's functional holes

const GND_HOLES = {
  gnd: { x: POWER_PIN_X.GND1, y: BOTTOM_HEADER_Y, label: "GND" },
  "gnd-pwr2": { x: POWER_PIN_X.GND2, y: BOTTOM_HEADER_Y, label: "GND" },
  ...Object.fromEntries(RAIL_TAP_DX.map((dx, i) => [`gnd-railtop-${i}`, { x: BREADBOARD_X + dx, y: RAIL_TOP_Y + 6 }])),
  ...Object.fromEntries(RAIL_TAP_DX.map((dx, i) => [`gnd-railbot-${i}`, { x: BREADBOARD_X + dx, y: RAIL_BOTTOM_Y + 6 }])),
};
const FIVEV_HOLES = {
  "5v": { x: POWER_PIN_X["5V"], y: BOTTOM_HEADER_Y, label: "5V" },
  ...Object.fromEntries(RAIL_TAP_DX.map((dx, i) => [`5v-railtop-${i}`, { x: BREADBOARD_X + dx, y: RAIL_TOP_Y - 6 }])),
  ...Object.fromEntries(RAIL_TAP_DX.map((dx, i) => [`5v-railbot-${i}`, { x: BREADBOARD_X + dx, y: RAIL_BOTTOM_Y - 6 }])),
};

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
const LED_COLORS = ["#ff5a4e", "#ffe066", "#57d38c", "#4fc3f7", "#ffffff"];

// Where each component type's leads sit, relative to the component's (x, y)
// anchor point - this is the ONLY place that needs updating to change a
// component's wiring geometry.
const LEAD_OFFSETS = {
  led: { "-a": [-14, 38], "-k": [14, 38] },
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

export function createBoard(svgEl) {
  let pinModes = {};        // pin -> "OUTPUT" | "INPUT" | "INPUT_PULLUP"
  let pinOutputs = {};      // pin -> 0-255 (digitalWrite HIGH=255/LOW=0, or a raw analogWrite value)
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
  const activeTones = {}; // pin -> { osc, gain }

  function reset() {
    pinModes = {};
    pinOutputs = {};
    pinAnalogInputs = {};
    servoAngles = {};
    pressed = new Set();
    stopAllTones();
    lcd = { begun: false, cols: 16, rows: 2, lines: [], cursorCol: 0, cursorRow: 0 };
    render();
  }

  function setRunning(value) {
    running = value;
    if (!running) { pressed = new Set(); stopAllTones(); }
    render();
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

  function playToneOnPin(pin, frequency) {
    const ctx = ensureAudioCtx();
    stopToneOnPin(pin);
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
    const entry = activeTones[pin];
    if (!entry) return;
    try { entry.osc.stop(); entry.osc.disconnect(); entry.gain.disconnect(); } catch { /* already stopped */ }
    delete activeTones[pin];
  }

  function stopAllTones() {
    for (const pin of Object.keys(activeTones)) stopToneOnPin(pin);
  }

  // ---------- hardware API used by the interpreter ----------

  function pinMode(pin, mode) {
    pinModes[pin] = mode;
    render();
  }

  function digitalWrite(pin, value) {
    pinOutputs[pin] = value ? 255 : 0;
    const buzzer = components.find((c) => c.kind === "buzzer" && wiredPinOf(c.id + "-s") === pin);
    if (buzzer) {
      if (value) playToneOnPin(pin, 1000);
      else stopToneOnPin(pin);
    }
    render();
  }

  function analogWrite(pin, value) {
    pinOutputs[pin] = Math.max(0, Math.min(255, value));
    render();
  }

  function digitalRead(pin) {
    const mode = pinModes[pin];
    const button = components.find((c) => c.kind === "button" && isTwoLeadWiredToPin(c, pin, "-1", "-2"));
    const isPressed = button && pressed.has(button.id);
    const ir = components.find((c) => c.kind === "irsensor" && isTwoLeadWiredToPin(c, pin, "-s", "-g"));
    const isBlocked = ir && irBlocked.has(ir.id);

    if (button) {
      if (mode === "INPUT_PULLUP") return isPressed ? 0 : 1;
      if (mode === "INPUT") return isPressed ? 1 : 0;
    }
    if (ir) {
      // Most IR obstacle sensors are active-LOW: they pull the signal down
      // when they detect something in front of them.
      return isBlocked ? 0 : 1;
    }
    return (pinOutputs[pin] ?? 0) > 0 ? 1 : 0; // reading back an OUTPUT pin
  }

  function analogRead(pin) {
    return pinAnalogInputs[pin] ?? 0;
  }

  function pulseIn(pin) {
    const sensor = components.find((c) => c.kind === "ultrasonic" && wiredPinOf(c.id + "-e") === pin);
    if (!sensor) return 0;
    return Math.round(sensor.distanceCm * 58); // matches the real HC-SR04 timing formula
  }

  function tone(pin, frequency) { playToneOnPin(pin, frequency); render(); }
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
    if (id.startsWith("pin-")) return pinPosition(Number(id.slice(4)));
    const comp = components.find((c) => id.startsWith(c.id + "-"));
    if (!comp) return { x: 0, y: 0 };
    const suffix = id.slice(comp.id.length);
    const [dx, dy] = (LEAD_OFFSETS[comp.kind] || {})[suffix] || [0, 30];
    return { x: comp.x + dx, y: comp.y + dy };
  }

  function otherEndsOf(connectorId) {
    return wires
      .filter((w) => w.from === connectorId || w.to === connectorId)
      .map((w) => (w.from === connectorId ? w.to : w.from));
  }

  function wiredPinOf(connectorId) {
    for (const other of otherEndsOf(connectorId)) {
      if (other.startsWith("pin-")) return Number(other.slice(4));
    }
    return null;
  }

  function isWiredToGnd(connectorId) {
    return otherEndsOf(connectorId).some((id) => id in GND_HOLES);
  }
  function isWiredTo5v(connectorId) {
    return otherEndsOf(connectorId).some((id) => id in FIVEV_HOLES);
  }

  function ledConnectedPin(led) {
    return isWiredToGnd(led.id + "-k") ? wiredPinOf(led.id + "-a") : null;
  }

  function isTwoLeadWiredToPin(comp, pin, sigSuffix, gndSuffix) {
    const sigPin = wiredPinOf(comp.id + sigSuffix);
    if (sigPin !== pin) return false;
    return isWiredToGnd(comp.id + gndSuffix) || isWiredTo5v(comp.id + gndSuffix);
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
    if (kind === "potentiometer") comp.rawValue = 512;
    if (kind === "ldr") comp.lightPct = 50;
    if (kind === "tempsensor") comp.tempC = 22;
    if (kind === "ultrasonic") comp.distanceCm = 50;
    if (kind === "servo") comp.currentAngle = 90;

    components.push(comp);
    render();
  }

  function removeComponent(id) {
    components = components.filter((c) => c.id !== id);
    const belongsToRemoved = (connectorId) => connectorId === id || connectorId.startsWith(id + "-");
    wires = wires.filter((w) => !belongsToRemoved(w.from) && !belongsToRemoved(w.to));
    pressed.delete(id);
    irBlocked.delete(id);
    render();
  }

  function cycleLedColor(led) {
    const i = LED_COLORS.indexOf(led.color);
    led.color = LED_COLORS[(i + 1) % LED_COLORS.length];
    render();
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
    render();
  }

  function removeWire(wire) {
    wires = wires.filter((w) => w !== wire);
    render();
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
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    render();
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

  // The breadboard: a hole-grid pattern (one SVG <pattern>, not hundreds of
  // individual circles - cheap to redraw on every render()) plus red/blue
  // power rails top and bottom, exactly like a real one.
  function ensureHolePattern() {
    const defs = svgEl_("defs", {});
    const pattern = svgEl_("pattern", { id: "bb-holes", width: 16, height: 16, patternUnits: "userSpaceOnUse" });
    pattern.appendChild(svgEl_("rect", { x: 0, y: 0, width: 16, height: 16, fill: "#e8e0c8" }));
    pattern.appendChild(svgEl_("circle", { cx: 8, cy: 8, r: 1.7, fill: "#8f8570" }));
    defs.appendChild(pattern);
    svgEl.appendChild(defs);
  }

  function drawRail(y) {
    svgEl.appendChild(svgEl_("line", { x1: BREADBOARD_X + 22, y1: y - 6, x2: BREADBOARD_X + BREADBOARD_W - 22, y2: y - 6, stroke: "#d9453c", "stroke-width": 2 }));
    svgEl.appendChild(svgEl_("line", { x1: BREADBOARD_X + 22, y1: y + 6, x2: BREADBOARD_X + BREADBOARD_W - 22, y2: y + 6, stroke: "#3f6fd9", "stroke-width": 2 }));
    for (let x = BREADBOARD_X + 44; x < BREADBOARD_X + BREADBOARD_W - 20; x += 18) {
      svgEl.appendChild(svgEl_("circle", { cx: x, cy: y - 6, r: 1.8, fill: "#8f8570" }));
      svgEl.appendChild(svgEl_("circle", { cx: x, cy: y + 6, r: 1.8, fill: "#8f8570" }));
    }
    const plusLabel = svgEl_("text", { x: BREADBOARD_X + 10, y: y - 2, fill: "#d9453c", "font-size": 13, "font-weight": "bold" });
    plusLabel.textContent = "+";
    svgEl.appendChild(plusLabel);
    const minusLabel = svgEl_("text", { x: BREADBOARD_X + 10, y: y + 12, fill: "#3f6fd9", "font-size": 13, "font-weight": "bold" });
    minusLabel.textContent = "−";
    svgEl.appendChild(minusLabel);
  }

  function drawBreadboard() {
    ensureHolePattern();
    svgEl.appendChild(svgEl_("rect", {
      x: BREADBOARD_X, y: BREADBOARD_Y, width: BREADBOARD_W, height: BREADBOARD_H,
      rx: 6, fill: "#efe7d0", stroke: "#b0a688", "stroke-width": 2,
    }));

    drawRail(RAIL_TOP_Y);
    const gridTop = RAIL_TOP_Y + 24, gridBottom = RAIL_BOTTOM_Y - 24;
    svgEl.appendChild(svgEl_("rect", {
      x: BREADBOARD_X + 14, y: gridTop, width: BREADBOARD_W - 28, height: gridBottom - gridTop,
      fill: "url(#bb-holes)",
    }));
    const midY = (gridTop + gridBottom) / 2;
    svgEl.appendChild(svgEl_("line", {
      x1: BREADBOARD_X + 14, y1: midY, x2: BREADBOARD_X + BREADBOARD_W - 14, y2: midY,
      stroke: "#cabf9e", "stroke-width": 8,
    }));
    drawRail(RAIL_BOTTOM_Y);
  }

  function render() {
    syncAnalogInputs();
    svgEl.innerHTML = "";

    drawArduino();
    drawBreadboard();

    drawDecorativePin(POWER_PIN_X.IOREF, BOTTOM_HEADER_Y, "IOREF");
    drawDecorativePin(POWER_PIN_X.RESET, BOTTOM_HEADER_Y, "RST");
    drawDecorativePin(POWER_PIN_X["3V3"], BOTTOM_HEADER_Y, "3V3");
    drawDecorativePin(POWER_PIN_X.VIN, BOTTOM_HEADER_Y, "VIN");
    for (const [id, p] of Object.entries(FIVEV_HOLES)) drawConnector(id, p.x, p.y, p.label || "", "#e8c547");
    for (const [id, p] of Object.entries(GND_HOLES)) drawConnector(id, p.x, p.y, p.label || "", "#9aa0b4");
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

    for (const comp of components) drawComponent(comp);

    // redraw connectors on top so they stay clickable over wires/components
    for (const [id, p] of Object.entries(FIVEV_HOLES)) drawConnector(id, p.x, p.y, "", "#e8c547", true);
    for (const [id, p] of Object.entries(GND_HOLES)) drawConnector(id, p.x, p.y, "", "#9aa0b4", true);
    for (const pin of DIGITAL_PINS) drawConnector(`pin-${pin}`, PIN_X_START + pin * PIN_X_STEP, DIGITAL_PIN_Y, "", "#4fc3f7", true);
    for (const pin of ANALOG_PINS) { const p = pinPosition(pin); drawConnector(`pin-${pin}`, p.x, p.y, "", "#b48ce8", true); }
    for (const comp of components) {
      for (const suffix of leadSuffixes(comp.kind)) {
        const id = comp.id + suffix;
        const p = connectorPoint(id);
        drawConnector(id, p.x, p.y, "", "#e4e6ec", true, 4);
      }
    }
  }

  function drawConnector(id, x, y, text, color, topLayer, radius) {
    const r = radius || 7;
    const isPending = pending === id;
    const hitArea = svgEl_("circle", { cx: x, cy: y, r: r + 8, fill: "transparent", class: "sim-connector-hit" });
    hitArea.addEventListener("click", () => handleConnectorClick(id));
    svgEl.appendChild(hitArea);
    const circle = svgEl_("circle", {
      cx: x, cy: y, r, fill: isPending ? "#fff" : color,
      stroke: isPending ? "#fff" : "#0d2338", "stroke-width": isPending ? 2 : 1,
      class: "sim-connector", style: "pointer-events:none",
    });
    svgEl.appendChild(circle);
    if (text && !topLayer) {
      const t = svgEl_("text", { x, y: y - 14, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
      t.textContent = text;
      svgEl.appendChild(t);
    }
  }

  function drawComponent(comp) {
    const drawFn = {
      led: drawLed, button: drawButton, rgbled: drawRgbLed, buzzer: drawBuzzer,
      potentiometer: drawPotentiometer, ldr: drawLdr, tempsensor: drawTempSensor,
      ultrasonic: drawUltrasonic, irsensor: drawIrSensor, servo: drawServo, lcd: drawLcd,
    }[comp.kind];
    if (drawFn) drawFn(comp);
  }

  function componentLabel(x, y, text) {
    const label = svgEl_("text", { x, y, fill: "#9aa0b4", "font-size": 10, "text-anchor": "middle", "font-family": "monospace" });
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

  function drawLed(led) {
    const pin = ledConnectedPin(led);
    const isLit = pin !== null && pinModes[pin] !== undefined && pinOutputs[pin] > 0;
    const brightness = pin !== null ? (pinOutputs[pin] ?? 0) / 255 : 0;
    const onColor = led.color || "#ffe066";
    const g = wireGroup(led);

    const bulb = svgEl_("circle", {
      cx: led.x, cy: led.y + 18, r: 18,
      fill: isLit ? onColor : "#241f16",
      stroke: isLit ? onColor : "#5a4a2a", "stroke-width": 2,
      style: isLit ? `filter:drop-shadow(0 0 ${4 + brightness * 10}px ${onColor});opacity:${0.35 + brightness * 0.65}` : "",
    });
    bulb.addEventListener("mousedown", (e) => startDrag(led, e));
    bulb.addEventListener("dblclick", (e) => { e.stopPropagation(); cycleLedColor(led); });
    g.appendChild(bulb);
    drawLeads(g, led);
    g.appendChild(componentLabel(led.x, led.y + 74, pin !== null ? `LED (pin ${pin})` : "LED (unwired)"));
    g.appendChild(removeGlyph(led.x + 24, led.y - 4, () => removeComponent(led.id)));
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
    body.addEventListener("mousedown", (e) => {
      if (running) { pressed.add(btn.id); render(); }
      else { startDrag(btn, e); }
    });
    body.addEventListener("mouseup", () => { if (running && pressed.has(btn.id)) { pressed.delete(btn.id); render(); } });
    body.addEventListener("mouseleave", () => { if (running && pressed.has(btn.id)) { pressed.delete(btn.id); render(); } });
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
    const rVal = commonOk && rPin !== null ? (pinOutputs[rPin] ?? 0) : 0;
    const gVal = commonOk && gPin !== null ? (pinOutputs[gPin] ?? 0) : 0;
    const bVal = commonOk && bPin !== null ? (pinOutputs[bPin] ?? 0) : 0;
    const isLit = rVal > 0 || gVal > 0 || bVal > 0;
    const mixedColor = `rgb(${rVal},${gVal},${bVal})`;

    const g = wireGroup(comp);
    const bulb = svgEl_("circle", {
      cx: comp.x, cy: comp.y + 18, r: 18,
      fill: isLit ? mixedColor : "#2a2a2e",
      stroke: isLit ? mixedColor : "#555", "stroke-width": 2,
      style: isLit ? `filter:drop-shadow(0 0 10px ${mixedColor})` : "",
    });
    bulb.addEventListener("mousedown", (e) => startDrag(comp, e));
    g.appendChild(bulb);
    drawLeads(g, comp);
    const wiredCount = [rPin, gPin, bPin].filter((p) => p !== null).length;
    g.appendChild(componentLabel(comp.x, comp.y + 74, wiredCount === 3 ? "RGB LED (R,G,B wired)" : `RGB LED (${wiredCount}/3 wired)`));
    g.appendChild(removeGlyph(comp.x + 32, comp.y - 4, () => removeComponent(comp.id)));
    svgEl.appendChild(g);
  }

  function drawBuzzer(comp) {
    const pin = wiredPinOf(comp.id + "-s");
    const isActive = pin !== null && !!activeTones[pin];
    const g = wireGroup(comp);

    const body = svgEl_("circle", {
      cx: comp.x, cy: comp.y + 20, r: 16,
      fill: isActive ? "#3a2f52" : "#2a2f3f", stroke: isActive ? "#b48ce8" : "#9aa0b4", "stroke-width": 2,
    });
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    hit.addEventListener("mousedown", (e) => startSliderDrag(x, width, onDrag, e));
    g.appendChild(hit);
    const handleX = x + frac * width;
    const handle = svgEl_("circle", { cx: handleX, cy: y, r: 7, fill: "#4fc3f7", stroke: "#06202b", "stroke-width": 1.5, style: "cursor:pointer" });
    handle.addEventListener("mousedown", (e) => startSliderDrag(x, width, onDrag, e));
    g.appendChild(handle);
  }

  function drawPotentiometer(comp) {
    const pin = wiredPinOf(comp.id + "-w");
    const g = wireGroup(comp);
    const body = svgEl_("rect", { x: comp.x - 24, y: comp.y, width: 48, height: 30, rx: 5, fill: "#2a2f3f", stroke: "#9aa0b4", "stroke-width": 2 });
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    body.addEventListener("mousedown", (e) => { if (running) toggleIr(comp); else startDrag(comp, e); });
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
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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
    body.addEventListener("mousedown", (e) => startDrag(comp, e));
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

  render();

  return {
    pinMode, digitalWrite, digitalRead, analogRead, analogWrite, pulseIn, tone, noTone, servoWrite,
    lcdBegin, lcdPrint, lcdSetCursor, lcdClear,
    addComponent, removeComponent, clearWiring, reset, setRunning, setWireColor,
    getWirePalette: () => WIRE_PALETTE,
  };
}
