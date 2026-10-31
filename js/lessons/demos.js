// Small interactive demonstrations for the "visual explanation" step of a
// lesson ({ type: "demo", demo: "<name>" }). Each shows ONE idea, with real
// numbers - the maths is the real maths (Ohm's law with an LED's ~2V drop,
// PWM's average voltage, the ATmega328P's digital input thresholds), so a
// demo never teaches something a real board wouldn't do.

const SVG = "http://www.w3.org/2000/svg";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// A labelled range slider.
function slider({ label, min, max, step = 1, value, onInput }) {
  const wrap = el("label", "demo-slider");
  const text = el("span", "demo-slider-label", label);
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => onInput(Number(input.value)));
  wrap.append(text, input);
  return { wrap, input };
}

// A glowing LED: brightness 0..1.
function ledSvg() {
  const svg = svgEl("svg", { viewBox: "0 0 40 52", width: 40, height: 52, "aria-hidden": "true", class: "demo-led" });
  const glow = svgEl("circle", { cx: 20, cy: 18, r: 18, fill: "#ff5a4e", opacity: 0 });
  const body = svgEl("path", { d: "M8 30 V18 a12 12 0 0 1 24 0 V30 Z", fill: "#5a1d18", stroke: "#2a0d0a", "stroke-width": 1.5 });
  svg.append(glow, body,
    svgEl("rect", { x: 6, y: 30, width: 28, height: 4, fill: "#7a2a22" }),
    svgEl("line", { x1: 14, y1: 34, x2: 14, y2: 52, stroke: "#bbb", "stroke-width": 2 }),
    svgEl("line", { x1: 26, y1: 34, x2: 26, y2: 46, stroke: "#bbb", "stroke-width": 2 }));
  return {
    svg,
    set(level) {
      const l = Math.max(0, Math.min(1, level));
      glow.setAttribute("opacity", String(l * 0.55));
      body.setAttribute("fill", l > 0.02 ? `rgb(${Math.round(90 + 165 * l)}, ${Math.round(29 + 61 * l)}, ${Math.round(24 + 54 * l)})` : "#5a1d18");
    },
  };
}

function frame(title, caption) {
  const box = el("div", "demo");
  box.appendChild(el("div", "demo-title", title));
  if (caption) box.appendChild(el("p", "demo-caption", caption));
  return box;
}

// ---- Ohm's law: a resistor setting an LED's current ----
const RESISTORS = [47, 100, 150, 220, 330, 470, 680, 1000, 2200, 4700, 10000];
const ohms = (r) => (r >= 1000 ? `${r / 1000}kΩ` : `${r}Ω`);

function ohmsLaw() {
  const box = frame("Try it: a resistor sets the current", "An LED on a 5V pin. Slide to change the resistor and watch the current.");
  const row = el("div", "demo-row");
  const led = ledSvg();
  const readout = el("div", "demo-readout");
  const formula = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  readout.append(formula, verdict);
  row.append(led.svg, readout);
  const update = (i) => {
    const r = RESISTORS[i];
    const mA = (3 / r) * 1000; // 5V minus the LED's ~2V leaves ~3V across the resistor
    formula.textContent = `current = (5V − 2V for the LED) ÷ ${ohms(r)} = ${mA >= 10 ? mA.toFixed(0) : mA.toFixed(1)} mA`;
    let text, cls;
    if (mA > 40) { text = "Far over the pin's 40 mA maximum - a real LED (and pin) would be damaged."; cls = "is-bad"; }
    else if (mA > 20) { text = "Over 20 mA - too much for an Arduino pin. Use a bigger resistor."; cls = "is-warn"; }
    else if (mA >= 5) { text = "Safe and bright - a good value for an LED."; cls = "is-good"; }
    else if (mA >= 1) { text = "Safe, but noticeably dim."; cls = "is-warn"; }
    else { text = "So little current the LED is barely visible."; cls = "is-warn"; }
    verdict.textContent = text;
    verdict.className = `demo-verdict ${cls}`;
    led.set(Math.min(1, mA / 20));
    s.input.setAttribute("aria-valuetext", `${ohms(r)}, ${mA.toFixed(1)} milliamps`);
  };
  const s = slider({ label: "Resistor", min: 0, max: RESISTORS.length - 1, value: 3, onInput: update });
  box.append(s.wrap, row);
  update(3);
  return box;
}

// ---- HIGH and LOW ----
function highLow() {
  const box = frame("Try it: HIGH and LOW", "Switch pin 13 and see what it really does.");
  const row = el("div", "demo-row");
  const led = ledSvg();
  const readout = el("div", "demo-readout");
  const code = el("code", "demo-code");
  const volts = el("div", "demo-formula");
  readout.append(code, volts);
  const btn = el("button", "btn btn-secondary demo-toggle");
  btn.type = "button";
  let high = true;
  const update = () => {
    code.textContent = `digitalWrite(13, ${high ? "HIGH" : "LOW"});`;
    volts.textContent = high
      ? "Pin 13 pushes out about 5 volts (HIGH = 1 = on), so current flows through the LED."
      : "Pin 13 is at about 0 volts (LOW = 0 = off): no push, no current, no light.";
    btn.textContent = high ? "Switch to LOW" : "Switch to HIGH";
    btn.setAttribute("aria-pressed", String(high));
    led.set(high ? 0.8 : 0);
  };
  btn.addEventListener("click", () => { high = !high; update(); });
  row.append(led.svg, readout);
  box.append(btn, row);
  update();
  return box;
}

// ---- PWM ----
function pwm() {
  const box = frame("Try it: PWM", "analogWrite() switches the pin on and off very fast. Change the value and watch the on-time.");
  const wave = svgEl("svg", { viewBox: "0 0 300 70", class: "demo-wave", role: "img" });
  const path = svgEl("path", { fill: "none", stroke: "#57d38c", "stroke-width": 2.5 });
  wave.append(
    svgEl("line", { x1: 0, y1: 60, x2: 300, y2: 60, stroke: "#3a4256" }),
    svgEl("line", { x1: 0, y1: 12, x2: 300, y2: 12, stroke: "#3a4256", "stroke-dasharray": "3 4" }),
    path);
  const row = el("div", "demo-row");
  const led = ledSvg();
  const readout = el("div", "demo-readout");
  const code = el("code", "demo-code");
  const avg = el("div", "demo-formula");
  readout.append(code, avg);
  row.append(led.svg, readout);
  const update = (v) => {
    const duty = v / 255;
    const period = 60;
    let d = "M 0 60";
    for (let x = 0; x < 300; x += period) {
      const onW = duty * period;
      if (duty === 0) d += ` L ${x + period} 60`;
      else if (duty === 1) d += ` L ${x} 12 L ${x + period} 12`;
      else d += ` L ${x} 12 L ${x + onW} 12 L ${x + onW} 60 L ${x + period} 60`;
    }
    path.setAttribute("d", d);
    wave.setAttribute("aria-label", `A square wave that is on ${Math.round(duty * 100)} percent of the time`);
    code.textContent = `analogWrite(9, ${v});`;
    avg.textContent = `On ${Math.round(duty * 100)}% of the time → it acts like about ${(duty * 5).toFixed(1)}V on average.`;
    led.set(duty);
    s.input.setAttribute("aria-valuetext", `${v}, on ${Math.round(duty * 100)} percent of the time`);
  };
  const s = slider({ label: "Value (0-255)", min: 0, max: 255, value: 64, onInput: update });
  box.append(s.wrap, wave, row);
  update(64);
  return box;
}

// ---- Analog vs digital ----
function analogDigital() {
  const box = frame("Try it: one voltage, two ways to read it", "Slide the voltage on a pin and compare what analogRead() and digitalRead() report.");
  const readout = el("div", "demo-readout demo-readout-wide");
  const v = el("div", "demo-formula");
  const a = el("div", "demo-formula");
  const d = el("div", "demo-formula");
  readout.append(v, a, d);
  const update = (tenths) => {
    const volts = tenths / 10;
    v.textContent = `Voltage on the pin: ${volts.toFixed(1)}V`;
    a.textContent = `analogRead() → ${Math.round((volts / 5) * 1023)}   (0 to 1023, in small steps)`;
    // ATmega328P at 5V: guaranteed HIGH above 0.6 × Vcc (3V), LOW below 0.3 × Vcc (1.5V).
    d.textContent = volts >= 3
      ? "digitalRead() → HIGH   (above 3V counts as HIGH)"
      : volts <= 1.5
        ? "digitalRead() → LOW   (below 1.5V counts as LOW)"
        : "digitalRead() → uncertain - between 1.5V and 3V a real Uno could read either";
    d.className = `demo-formula ${volts > 1.5 && volts < 3 ? "is-warn" : ""}`;
    s.input.setAttribute("aria-valuetext", `${volts.toFixed(1)} volts`);
  };
  const s = slider({ label: "Voltage", min: 0, max: 50, value: 22, onInput: update });
  box.append(s.wrap, readout);
  update(22);
  return box;
}

// ---- Breadboard connections ----
function breadboard() {
  const box = frame("Try it: which holes are connected?", "Click (or tab to and press Enter on) any hole to light up every hole connected to it.");
  const COLS = 10;
  const svg = svgEl("svg", { viewBox: "0 0 260 196", class: "demo-breadboard" });
  svg.appendChild(svgEl("rect", { x: 0, y: 0, width: 260, height: 196, rx: 6, fill: "#efe7d0" }));
  svg.appendChild(svgEl("rect", { x: 10, y: 92, width: 240, height: 10, fill: "#cabf9e" }));
  const status = el("p", "demo-caption", "Nothing selected yet.");
  status.setAttribute("aria-live", "polite");
  const holes = [];
  const add = (x, y, group, describe) => {
    const c = svgEl("circle", { cx: x, cy: y, r: 5, fill: "#8a8064", tabindex: 0, role: "button", "aria-label": describe });
    c.dataset.group = group;
    const pick = () => {
      for (const h of holes) h.setAttribute("fill", h.dataset.group === group ? "#57d38c" : "#8a8064");
      status.textContent = describe;
    };
    c.addEventListener("click", pick);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    holes.push(c);
    svg.appendChild(c);
  };
  const railText = (y, sign, color) => {
    const t = svgEl("text", { x: 4, y: y + 4, fill: color, "font-size": 11, "font-family": "monospace" });
    t.textContent = sign;
    svg.appendChild(t);
  };
  railText(12, "+", "#d9453c");
  railText(28, "−", "#3f6fd9");
  for (let i = 0; i < COLS; i++) {
    const x = 26 + i * 23;
    add(x, 12, "rail-plus", "The whole + rail: every hole along it is connected (on a real board, wire it to 5V).");
    add(x, 28, "rail-minus", "The whole − rail: every hole along it is connected (usually GND).");
    for (let r = 0; r < 5; r++) {
      add(x, 46 + r * 10, `top-${i}`, `A column of 5 holes on the top half - these 5 are connected to each other, and to nothing else.`);
      add(x, 112 + r * 10, `bottom-${i}`, `A column of 5 holes on the bottom half - connected to each other, but NOT to the column above the trench.`);
    }
  }
  box.append(svg, status);
  return box;
}

// ---- Open and closed circuits ----
function openClosed() {
  const box = frame("Try it: open and closed circuits", "A switch is a gap you can close. Flip it and watch what flows.");
  const pic = svgEl("svg", { viewBox: "0 0 220 110", class: "demo-wave", role: "img" });
  const wire = { fill: "none", stroke: "#9aa0b4", "stroke-width": 3 };
  pic.append(
    svgEl("path", { d: "M 70 20 L 20 20 L 20 90 L 200 90 L 200 20 L 130 20", ...wire }),
    svgEl("circle", { cx: 70, cy: 20, r: 4, fill: "#e8c547" }),
    svgEl("circle", { cx: 130, cy: 20, r: 4, fill: "#e8c547" }));
  const lever = svgEl("line", { x1: 70, y1: 20, x2: 130, y2: 20, stroke: "#e8c547", "stroke-width": 4, "stroke-linecap": "round" });
  const label = (x, y, t) => { const e = svgEl("text", { x, y, fill: "#9aa0b4", "font-size": 11, "font-family": "monospace", "text-anchor": "middle" }); e.textContent = t; return e; };
  pic.append(lever, label(100, 12, "switch"), label(20, 105, "5V"), label(200, 105, "GND"), label(110, 82, "resistor + LED"));
  const row = el("div", "demo-row");
  const led = ledSvg();
  const readout = el("div", "demo-readout");
  const state = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  readout.append(state, verdict);
  row.append(led.svg, readout);
  const btn = el("button", "btn btn-secondary demo-toggle");
  btn.type = "button";
  let closed = false;
  const update = () => {
    lever.setAttribute("transform", closed ? "" : "rotate(-35 70 20)");
    pic.setAttribute("aria-label", closed ? "The switch is closed: the loop is complete." : "The switch is open: there is a gap in the loop.");
    state.textContent = closed
      ? "CLOSED circuit: 5V → switch → resistor → LED → GND is one complete loop."
      : "OPEN circuit: the switch leaves a gap in the loop.";
    verdict.textContent = closed
      ? "Current flows (about 14 mA through a 220Ω resistor) and the LED lights."
      : "No complete path, so no current flows anywhere in the loop - the LED is dark, even though the 5V is still there.";
    verdict.className = `demo-verdict ${closed ? "is-good" : "is-warn"}`;
    btn.textContent = closed ? "Open the switch" : "Close the switch";
    btn.setAttribute("aria-pressed", String(closed));
    led.set(closed ? 0.8 : 0);
  };
  btn.addEventListener("click", () => { closed = !closed; update(); });
  box.append(btn, pic, row);
  update();
  return box;
}

// ---- Series and parallel ----
// Two red LEDs (about 2V each) and 220Ω resistors on 5V. In series they
// share one resistor and one path; in parallel each has its own.
function seriesParallel() {
  const box = frame("Try it: series vs parallel", "Two LEDs, wired two different ways. Switch between them - then unplug LED 2 and see what happens to LED 1.");
  const controls = el("div", "demo-row demo-controls");
  const wiring = el("button", "btn btn-secondary");
  wiring.type = "button";
  const unplug = el("button", "btn btn-secondary");
  unplug.type = "button";
  controls.append(wiring, unplug);
  const leds = el("div", "demo-row");
  const led1 = ledSvg();
  const led2 = ledSvg();
  const tag = (t) => el("span", "demo-slider-label", t);
  leds.append(tag("LED 1"), led1.svg, tag("LED 2"), led2.svg);
  const readout = el("div", "demo-readout demo-readout-wide");
  const numbers = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  readout.append(numbers, verdict);
  let parallel = false;
  let unplugged = false;
  const update = () => {
    wiring.textContent = parallel ? "Wiring: PARALLEL (switch to series)" : "Wiring: SERIES (switch to parallel)";
    unplug.textContent = unplugged ? "Plug LED 2 back in" : "Unplug LED 2";
    unplug.setAttribute("aria-pressed", String(unplugged));
    if (!parallel) {
      const mA = unplugged ? 0 : (5 - 2 - 2) / 220 * 1000;
      numbers.textContent = unplugged
        ? "Series, LED 2 unplugged: the only path is broken. Current: 0 mA."
        : `Series: one path. The 5V is shared - about 2V for each LED, 1V left for the resistor - so only ${mA.toFixed(1)} mA flows, through both.`;
      verdict.textContent = unplugged
        ? "LED 1 goes out too: in series, one gap stops everything."
        : "Both light, but dimly - they share the push.";
      verdict.className = `demo-verdict ${unplugged ? "is-bad" : "is-warn"}`;
      led1.set(mA / 20);
      led2.set(mA / 20);
    } else {
      const each = (5 - 2) / 220 * 1000;
      numbers.textContent = unplugged
        ? `Parallel, LED 2 unplugged: LED 1's branch is untouched - still ${each.toFixed(1)} mA.`
        : `Parallel: each LED has its own branch and resistor, and gets the full 5V: ${each.toFixed(1)} mA each, ${(each * 2).toFixed(1)} mA in total from the 5V pin.`;
      verdict.textContent = unplugged
        ? "LED 1 stays lit: each branch is its own complete loop."
        : "Both light brightly - each has its own path.";
      verdict.className = "demo-verdict is-good";
      led1.set(each / 20);
      led2.set(unplugged ? 0 : each / 20);
    }
  };
  wiring.addEventListener("click", () => { parallel = !parallel; update(); });
  unplug.addEventListener("click", () => { unplugged = !unplugged; update(); });
  box.append(controls, leds, readout);
  update();
  return box;
}

const DEMOS = {
  "open-closed": openClosed,
  "series-parallel": seriesParallel,
  "ohms-law": ohmsLaw,
  "high-low": highLow,
  pwm,
  "analog-digital": analogDigital,
  breadboard,
};

// Other modules add their own demos here (the engineering pathways'
// calculated visualisations - pathways/visuals.js), so a lesson block names
// any of them the same way. The building blocks are shared for that too.
export function registerDemos(more) { Object.assign(DEMOS, more); }
export { el, svgEl, slider, frame, ledSvg };
export const demoNames = () => Object.keys(DEMOS);
export const DEMO_NAMES = Object.keys(DEMOS);

export function renderDemo(name) {
  const make = DEMOS[name];
  return make ? make() : null;
}
