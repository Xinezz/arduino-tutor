// Labelled drawings for the "visual explanation" part of a lesson
// ({ type: "diagram", diagram: "<name>" }). Unlike the demos (demos.js),
// these don't move - each one shows a single idea clearly: how the parts of
// a circuit connect, what an Uno's pins are for, the order a sketch runs in.
// Colours come from CSS classes (dg-*), so they follow the site's theme; each
// drawing has a text description for screen readers.

const NS = "http://www.w3.org/2000/svg";

function svg(width, height, description, left = 0) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `${-left} 0 ${width + left} ${height}`);
  s.setAttribute("class", "diagram");
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", description);
  return s;
}
function add(parent, tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}
const line = (s, x1, y1, x2, y2, cls = "dg-line") => add(s, "line", { x1, y1, x2, y2, class: cls });
const box = (s, x, y, w, h, cls = "dg-box") => add(s, "rect", { x, y, width: w, height: h, class: cls });
const label = (s, x, y, text, cls = "dg-text", anchor = "start") => add(s, "text", { x, y, class: cls, "text-anchor": anchor }, text);
// A small arrowhead pointing right/left/up/down, centred on (x, y).
function arrow(s, x, y, dir = "right", cls = "dg-current") {
  const pts = {
    right: [[x - 5, y - 5], [x + 5, y], [x - 5, y + 5]],
    left: [[x + 5, y - 5], [x - 5, y], [x + 5, y + 5]],
    down: [[x - 5, y - 5], [x, y + 5], [x + 5, y - 5]],
    up: [[x - 5, y + 5], [x, y - 5], [x + 5, y + 5]],
  }[dir];
  return add(s, "polygon", { points: pts.map((p) => p.join(",")).join(" "), class: cls });
}
// A resistor: a zigzag between (x1, y) and (x2, y).
function resistor(s, x1, x2, y) {
  const step = (x2 - x1) / 8;
  let d = `M ${x1} ${y}`;
  for (let i = 1; i < 8; i++) d += ` L ${x1 + step * i} ${y + (i % 2 ? -7 : 7)}`;
  d += ` L ${x2} ${y}`;
  return add(s, "path", { d, class: "dg-part" });
}
// An LED symbol on a horizontal or vertical wire: a triangle (pointing the
// way current is allowed to flow) and a bar.
function ledSymbol(s, x, y, dir = "right") {
  const g = add(s, "g", { transform: `translate(${x} ${y}) rotate(${{ right: 0, down: 90, left: 180 }[dir]})` });
  add(g, "polygon", { points: "-9,-9 9,0 -9,9", class: "dg-led" });
  add(g, "line", { x1: 9, y1: -9, x2: 9, y2: 9, class: "dg-part" });
  add(g, "line", { x1: 2, y1: -12, x2: 8, y2: -18, class: "dg-glow" });
  add(g, "line", { x1: -4, y1: -13, x2: 2, y2: -19, class: "dg-glow" });
  return g;
}

const DIAGRAMS = {
  // Voltage, current and resistance as water in a pipe.
  "water-analogy": () => {
    const s = svg(480, 200, "A water tank feeding a pipe that narrows in the middle. The height of the water is the voltage, the water flowing through the pipe is the current, and the narrow section is a resistance that limits the flow.");
    box(s, 20, 30, 90, 130);
    box(s, 22, 62, 86, 96, "dg-water");
    label(s, 65, 22, "VOLTAGE", "dg-key", "middle");
    label(s, 65, 186, "higher = more push", "dg-small", "middle");
    box(s, 110, 128, 130, 24, "dg-pipe");
    box(s, 240, 134, 80, 12, "dg-pipe");
    box(s, 320, 128, 140, 24, "dg-pipe");
    for (const x of [140, 190, 275, 350, 410]) arrow(s, x, 140);
    label(s, 175, 116, "CURRENT", "dg-key", "middle");
    label(s, 175, 176, "how much flows", "dg-small", "middle");
    label(s, 280, 116, "RESISTANCE", "dg-key", "middle");
    label(s, 280, 176, "a narrow part", "dg-small", "middle");
    label(s, 280, 190, "limits the flow", "dg-small", "middle");
    label(s, 390, 116, "same flow all along", "dg-small", "middle");
    return s;
  },

  // A complete loop: 5V -> resistor -> LED -> GND.
  "circuit-loop": () => {
    const s = svg(480, 210, "A complete circuit. Current leaves the Arduino's 5V pin, goes through a resistor, then through an LED, and returns to the Arduino's GND pin, making one closed loop.");
    box(s, 16, 40, 92, 130, "dg-board");
    label(s, 62, 30, "ARDUINO", "dg-key", "middle");
    label(s, 62, 70, "5V pin", "dg-text", "middle");
    label(s, 62, 150, "GND pin", "dg-text", "middle");
    line(s, 108, 66, 200, 66, "dg-wire");
    resistor(s, 200, 280, 66);
    line(s, 280, 66, 420, 66, "dg-wire");
    line(s, 420, 66, 420, 96, "dg-wire");
    ledSymbol(s, 420, 110, "down");
    line(s, 420, 124, 420, 146, "dg-wire");
    line(s, 420, 146, 108, 146, "dg-wire");
    label(s, 240, 52, "resistor", "dg-small", "middle");
    label(s, 434, 114, "LED", "dg-text");
    for (const [x, y, d] of [[150, 66, "right"], [350, 66, "right"], [420, 136, "down"], [300, 146, "left"], [160, 146, "left"]]) arrow(s, x, y, d);
    label(s, 240, 186, "Current flows round ONE complete loop:", "dg-small", "middle");
    label(s, 240, 201, "5V → resistor → LED → GND. Break it anywhere and it all stops.", "dg-small", "middle");
    return s;
  },

  // Series vs parallel, side by side.
  "series-parallel": () => {
    const s = svg(520, 230, "Left: a series circuit, where two LEDs sit one after the other in a single loop. Right: a parallel circuit, where each LED has its own branch from 5V to GND.");
    // series
    label(s, 125, 18, "SERIES - one path", "dg-key", "middle");
    line(s, 30, 50, 60, 50, "dg-wire");
    resistor(s, 60, 110, 50);
    line(s, 110, 50, 128, 50, "dg-wire");
    ledSymbol(s, 140, 50);
    line(s, 152, 50, 178, 50, "dg-wire");
    ledSymbol(s, 190, 50);
    line(s, 202, 50, 225, 50, "dg-wire");
    line(s, 225, 50, 225, 120, "dg-wire");
    line(s, 225, 120, 30, 120, "dg-wire");
    label(s, 30, 42, "5V", "dg-small");
    label(s, 30, 136, "GND", "dg-small");
    arrow(s, 90, 120, "left");
    label(s, 125, 165, "The same current goes", "dg-small", "middle");
    label(s, 125, 180, "through both LEDs.", "dg-small", "middle");
    label(s, 125, 200, "One breaks → the loop is", "dg-small", "middle");
    label(s, 125, 215, "open → BOTH go out.", "dg-small", "middle");
    line(s, 260, 10, 260, 220, "dg-divider");
    // parallel
    label(s, 395, 18, "PARALLEL - separate paths", "dg-key", "middle");
    line(s, 300, 40, 300, 130, "dg-wire");
    line(s, 490, 40, 490, 130, "dg-wire");
    for (const y of [50, 110]) {
      line(s, 300, y, 330, y, "dg-wire");
      resistor(s, 330, 380, y);
      line(s, 380, y, 418, y, "dg-wire");
      ledSymbol(s, 430, y);
      line(s, 442, y, 490, y, "dg-wire");
    }
    label(s, 282, 46, "5V", "dg-small");
    label(s, 494, 146, "GND", "dg-small");
    label(s, 395, 165, "Each branch gets the full", "dg-small", "middle");
    label(s, 395, 180, "voltage, and its own current.", "dg-small", "middle");
    label(s, 395, 200, "One breaks → the other", "dg-small", "middle");
    label(s, 395, 215, "branch keeps working.", "dg-small", "middle");
    return s;
  },

  // The Uno, labelled.
  "uno-board": () => {
    const s = svg(520, 290, "An Arduino Uno seen from above. Along the top edge: digital pins 0 to 13, with a tilde on the PWM pins 3, 5, 6, 9, 10 and 11. Bottom left: the power pins, including 5V, 3.3V and GND. Bottom right: analog input pins A0 to A5. On the left: the USB socket and the power jack. In the middle: the ATmega328P microcontroller chip.", 110);
    box(s, 60, 40, 420, 200, "dg-board");
    // digital header
    box(s, 210, 52, 254, 18, "dg-header");
    for (let pin = 0; pin < 14; pin++) {
      const x = 455 - pin * 17.5;
      box(s, x - 5, 56, 10, 10, "dg-pin");
      label(s, x, 84, String(pin), "dg-pinlabel", "middle");
      if ([3, 5, 6, 9, 10, 11].includes(pin)) label(s, x, 98, "~", "dg-pinlabel", "middle");
    }
    label(s, 337, 30, "DIGITAL PINS 0-13 - HIGH or LOW (~ = can also do PWM)", "dg-key", "middle");
    // power + analog headers
    box(s, 200, 210, 130, 18, "dg-header");
    ["", "RST", "3.3V", "5V", "GND", "GND", "Vin"].forEach((name, i) => {
      const x = 212 + i * 18;
      box(s, x - 5, 214, 10, 10, "dg-pin");
      if (name) label(s, x, 204, name, "dg-pinlabel", "middle");
    });
    label(s, 265, 262, "POWER - 5V, 3.3V and GND", "dg-key", "middle");
    box(s, 350, 210, 116, 18, "dg-header");
    for (let i = 0; i < 6; i++) {
      const x = 362 + i * 19;
      box(s, x - 5, 214, 10, 10, "dg-pin");
      label(s, x, 204, `A${i}`, "dg-pinlabel", "middle");
    }
    label(s, 408, 262, "ANALOG IN - A0-A5", "dg-key", "middle");
    // USB, jack, chip, LED
    box(s, 36, 64, 56, 44, "dg-metal");
    label(s, 28, 82, "USB: power,", "dg-small", "end");
    label(s, 28, 96, "upload, Serial", "dg-small", "end");
    label(s, 28, 110, "Monitor", "dg-small", "end");
    box(s, 36, 176, 50, 40, "dg-jack");
    label(s, 28, 194, "Power jack", "dg-small", "end");
    label(s, 28, 208, "(7-12V)", "dg-small", "end");
    box(s, 230, 128, 170, 40, "dg-chip");
    label(s, 315, 146, "ATmega328P", "dg-chiplabel", "middle");
    label(s, 315, 161, "the microcontroller", "dg-chiplabel", "middle");
    box(s, 222, 104, 12, 8, "dg-ledon");
    label(s, 240, 112, "built-in LED (pin 13)", "dg-small");
    return s;
  },

  // What runs when.
  "program-flow": () => {
    const s = svg(500, 160, "Program flow: the board powers on or resets, then setup() runs once, then loop() runs again and again forever.");
    box(s, 10, 50, 120, 50, "dg-box");
    label(s, 70, 72, "Power on", "dg-text", "middle");
    label(s, 70, 88, "or reset", "dg-text", "middle");
    line(s, 130, 75, 175, 75, "dg-wire");
    arrow(s, 172, 75);
    box(s, 180, 50, 120, 50, "dg-box-accent");
    label(s, 240, 72, "setup()", "dg-code", "middle");
    label(s, 240, 88, "runs ONCE", "dg-small", "middle");
    line(s, 300, 75, 345, 75, "dg-wire");
    arrow(s, 342, 75);
    box(s, 350, 50, 120, 50, "dg-box-accent");
    label(s, 410, 72, "loop()", "dg-code", "middle");
    label(s, 410, 88, "runs, then...", "dg-small", "middle");
    add(s, "path", { d: "M 470 62 C 505 40, 505 15, 410 15 C 330 15, 330 40, 360 50", class: "dg-wire dg-curve" });
    arrow(s, 360, 48, "down");
    label(s, 420, 10, "...again and again, forever", "dg-small", "middle");
    label(s, 250, 140, "There's no end: loop() repeats for as long as the board has power.", "dg-small", "middle");
    return s;
  },

  // A blink, drawn as a signal over time.
  "blink-timing": () => {
    const s = svg(500, 194, "A timing diagram for a blink: pin 13 is HIGH for one second, LOW for one second, then HIGH and LOW again, repeating.");
    label(s, 10, 52, "HIGH (5V)", "dg-small");
    label(s, 10, 122, "LOW (0V)", "dg-small");
    add(s, "path", { d: "M 80 120 L 80 50 L 180 50 L 180 120 L 280 120 L 280 50 L 380 50 L 380 120 L 480 120", class: "dg-signal" });
    for (let i = 0; i <= 4; i++) {
      const x = 80 + i * 100;
      line(s, x, 125, x, 132, "dg-line");
      label(s, x, 148, `${i} s`, "dg-small", "middle");
    }
    label(s, 130, 40, "LED ON", "dg-key", "middle");
    label(s, 230, 110, "LED OFF", "dg-key", "middle");
    label(s, 130, 166, "HIGH; delay(1000);", "dg-code", "middle");
    label(s, 230, 186, "LOW; delay(1000);", "dg-code", "middle");
    label(s, 430, 40, "...and loop() repeats it", "dg-small", "middle");
    return s;
  },

  // An LED: which leg is which.
  "led-parts": () => {
    const s = svg(500, 200, "An LED. The longer leg is the anode, marked plus, and goes toward the power. The shorter leg, on the side with the flat edge, is the cathode, marked minus, and goes toward GND. In a circuit diagram an LED is drawn as a triangle pointing the way current can flow, with a bar at the cathode end.");
    add(s, "path", { d: "M 70 110 L 70 60 A 30 30 0 0 1 130 60 L 130 110 Z", class: "dg-led-body" });
    line(s, 62, 110, 136, 110, "dg-part");
    line(s, 130, 60, 130, 110, "dg-flat");
    line(s, 85, 112, 85, 190, "dg-leg");
    line(s, 115, 112, 115, 165, "dg-leg");
    label(s, 20, 180, "+ anode", "dg-plus");
    label(s, 10, 195, "longer leg → power", "dg-small");
    label(s, 125, 160, "− cathode: shorter leg,", "dg-minus");
    label(s, 125, 174, "flat edge → GND", "dg-small");
    line(s, 240, 20, 240, 190, "dg-divider");
    label(s, 370, 40, "THE SYMBOL", "dg-key", "middle");
    line(s, 270, 100, 350, 100, "dg-wire");
    ledSymbol(s, 362, 100);
    line(s, 374, 100, 460, 100, "dg-wire");
    label(s, 290, 90, "+", "dg-plus");
    label(s, 440, 90, "−", "dg-minus");
    arrow(s, 315, 100);
    label(s, 370, 140, "Current can only flow the way", "dg-small", "middle");
    label(s, 370, 155, "the triangle points: + to −.", "dg-small", "middle");
    label(s, 370, 175, "Backwards, the LED blocks it.", "dg-small", "middle");
    return s;
  },
};

export const DIAGRAM_NAMES = Object.keys(DIAGRAMS);

export function renderDiagram(name) {
  return DIAGRAMS[name]?.() ?? null;
}
