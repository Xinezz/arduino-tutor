// The Electronics Engineering pathway's interactive visualisations. Each one
// is a CALCULATED MODEL: the numbers come from the standard formulas in
// formulas.js as you move the sliders - they aren't read from the circuit
// simulator (which models wiring and pin logic, not voltages and currents).
// Every demo says so, and says what its model leaves out.
//
// Registered with the lesson demos, so a lesson block { type: "demo",
// demo: "voltage-divider" } shows one.

import { el, svgEl, slider, frame, ledSvg, registerDemos } from "../lessons/demos.js";
import {
  ohms, mA, resistorPower, series, parallel, ledLoop, branchCurrents, divider, buttonInput,
  timeConstant, rcVoltage, transistorSwitch, E12,
} from "./formulas.js";

const RS = [100, 220, 330, 470, 1000, 2200, 4700, 10000, 22000, 47000, 100000];
const fmtV = (v) => `${v.toFixed(2)} V`;
const fmtmA = (a) => { const m = mA(a); return m >= 10 ? `${m.toFixed(1)} mA` : `${m.toFixed(2)} mA`; };

function modelNote(box, text) {
  const n = el("p", "demo-model-note");
  n.textContent = `Calculated model: ${text}`;
  box.appendChild(n);
}
function readout(...lines) {
  const r = el("div", "demo-readout demo-readout-wide");
  for (const l of lines) r.appendChild(l);
  return r;
}
function select(label, options, value, onChange) {
  const wrap = el("label", "demo-slider");
  wrap.appendChild(el("span", "demo-slider-label", label));
  const s = document.createElement("select");
  s.className = "demo-select";
  for (const [v, text] of options) s.appendChild(Object.assign(document.createElement("option"), { value: String(v), textContent: text }));
  s.value = String(value);
  s.addEventListener("change", () => onChange(s.value));
  wrap.appendChild(s);
  return { wrap, select: s };
}
// A horizontal bar 0..max, for showing a value against a limit.
function bar(max, limit) {
  const svg = svgEl("svg", { viewBox: "0 0 300 18", class: "demo-bar", "aria-hidden": "true" });
  const fill = svgEl("rect", { x: 0, y: 3, width: 0, height: 12, class: "demo-bar-fill" });
  svg.append(svgEl("rect", { x: 0, y: 3, width: 300, height: 12, class: "demo-bar-track" }), fill);
  if (limit) svg.appendChild(svgEl("line", { x1: (limit / max) * 300, x2: (limit / max) * 300, y1: 0, y2: 18, class: "demo-bar-limit" }));
  return { svg, set(v, cls = "") { fill.setAttribute("width", String(Math.max(0, Math.min(1, v / max)) * 300)); fill.setAttribute("class", `demo-bar-fill ${cls}`); } };
}

// ---- Ohm's law and power ----
function powerDemo() {
  const box = frame("Try it: current and power in a resistor", "Pick a supply voltage and a resistor. Ohm's law gives the current; P = V × I gives the heat the resistor has to get rid of.");
  const supplies = [3.3, 5, 9, 12];
  let v = 5;
  let ri = 1;
  const formula = el("div", "demo-formula");
  const power = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const b = bar(0.5, 0.25);
  const update = () => {
    const r = RS[ri];
    const res = resistorPower(v, r);
    formula.textContent = `I = V ÷ R = ${v} V ÷ ${ohms(r)} = ${fmtmA(res.current)}`;
    power.textContent = `P = V × I = ${v} V × ${fmtmA(res.current)} = ${(res.power * 1000).toFixed(1)} mW (${res.power.toFixed(3)} W)`;
    verdict.textContent = `A common ¼ W (250 mW) resistor: ${res.rating}.`;
    verdict.className = `demo-verdict ${res.ok ? "is-good" : res.power <= 0.25 ? "is-warn" : "is-bad"}`;
    b.set(res.power, res.ok ? "is-good" : res.power <= 0.25 ? "is-warn" : "is-bad");
    s.input.setAttribute("aria-valuetext", `${ohms(r)}, ${(res.power * 1000).toFixed(1)} milliwatts`);
  };
  const sv = select("Supply", supplies.map((x) => [x, `${x} V`]), v, (x) => { v = Number(x); update(); });
  const s = slider({ label: "Resistor", min: 0, max: RS.length - 1, value: ri, onInput: (i) => { ri = i; update(); } });
  box.append(sv.wrap, s.wrap, readout(formula, power, b.svg, verdict));
  modelNote(box, "an ideal resistor with the whole supply across it. The line on the bar is ¼ W.");
  update();
  return box;
}

// ---- series and parallel resistors ----
function resistorCombo() {
  const box = frame("Try it: combining resistors", "Two resistors, joined one after the other (series) or side by side (parallel), across 5 V.");
  let mode = "series";
  let a = 4;
  let b2 = 4;
  const result = el("div", "demo-formula");
  const currents = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const update = () => {
    const r1 = RS[a];
    const r2 = RS[b2];
    if (mode === "series") {
      const total = series([r1, r2]);
      const i = 5 / total;
      result.textContent = `R total = R1 + R2 = ${ohms(r1)} + ${ohms(r2)} = ${ohms(total)}`;
      currents.textContent = `The same current flows through both: I = 5 V ÷ ${ohms(total)} = ${fmtmA(i)}. R1 drops ${fmtV(i * r1)}, R2 drops ${fmtV(i * r2)} - together 5 V.`;
      verdict.textContent = "Series: the total is always MORE than the biggest resistor.";
    } else {
      const total = parallel([r1, r2]);
      currents.textContent = `Each has the full 5 V across it: I1 = ${fmtmA(5 / r1)}, I2 = ${fmtmA(5 / r2)} - together ${fmtmA(5 / r1 + 5 / r2)}.`;
      result.textContent = `R total = 1 ÷ (1/R1 + 1/R2) = ${ohms(total)}`;
      verdict.textContent = "Parallel: the total is always LESS than the smallest resistor - each path adds another way for current to flow.";
    }
    verdict.className = "demo-verdict";
  };
  const m = select("Joined", [["series", "In series"], ["parallel", "In parallel"]], mode, (x) => { mode = x; update(); });
  const s1 = slider({ label: "R1", min: 0, max: RS.length - 1, value: a, onInput: (i) => { a = i; update(); } });
  const s2 = slider({ label: "R2", min: 0, max: RS.length - 1, value: b2, onInput: (i) => { b2 = i; update(); } });
  box.append(m.wrap, s1.wrap, s2.wrap, readout(result, currents, verdict));
  modelNote(box, "ideal resistors and an ideal 5 V supply.");
  update();
  return box;
}

// ---- Kirchhoff's laws ----
function kirchhoff() {
  const box = frame("Try it: Kirchhoff's laws in an LED circuit", "One loop: 5 V → resistor → LED → GND. Then a second LED branch beside it.");
  const colours = [["1.8", "Red LED (about 1.8 V)"], ["2.1", "Yellow/green LED (about 2.1 V)"], ["3.0", "Blue/white LED (about 3.0 V)"]];
  let vf = 1.8;
  let ri = 1;
  let ri2 = 2;
  const led = ledSvg();
  const kvl = el("div", "demo-formula");
  const kcl = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const update = () => {
    const loop = ledLoop(5, vf, RS[ri]);
    kvl.textContent = `Voltage law: 5 V = ${fmtV(loop.vResistor)} (resistor) + ${fmtV(loop.vLed)} (LED). Current ${fmtmA(loop.current)}.`;
    const b = branchCurrents(5, vf, [RS[ri], RS[ri2]]);
    kcl.textContent = `Current law: with a second branch (${ohms(RS[ri2])}), the supply gives ${fmtmA(b.branches[0])} + ${fmtmA(b.branches[1])} = ${fmtmA(b.total)} - what flows in equals what flows out.`;
    const m = mA(loop.current);
    verdict.textContent = m > 20 ? "Over 20 mA through the first LED - too much for an Arduino pin." : "Both branches are within a pin's 20 mA.";
    verdict.className = `demo-verdict ${m > 20 ? "is-bad" : "is-good"}`;
    led.set(Math.min(1, m / 20));
  };
  const c = select("LED", colours, vf, (x) => { vf = Number(x); update(); });
  const s = slider({ label: "Resistor 1", min: 0, max: RS.length - 1, value: ri, onInput: (i) => { ri = i; update(); } });
  const s2 = slider({ label: "Resistor 2", min: 0, max: RS.length - 1, value: ri2, onInput: (i) => { ri2 = i; update(); } });
  const row = el("div", "demo-row");
  row.append(led.svg, readout(kvl, kcl, verdict));
  box.append(c.wrap, s.wrap, s2.wrap, row);
  modelNote(box, "an LED is treated as a fixed voltage drop once it conducts. A real LED's voltage rises a little with current, and varies between parts - which is why these are \"about\" values.");
  update();
  return box;
}

// ---- voltage divider ----
function voltageDivider() {
  const box = frame("Try it: a voltage divider", "5 V across R1 and R2 in series. The middle point gives a smaller voltage - what an analog pin would read.");
  let a = 4;
  let b2 = 4;
  let loadIdx = 0;
  const loads = [[0, "Nothing (analog pin only)"], [100000, "100kΩ load"], [10000, "10kΩ load"], [1000, "1kΩ load"]];
  const formula = el("div", "demo-formula");
  const reading = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const b = bar(5);
  const update = () => {
    const load = loads[loadIdx][0] || null;
    const ideal = divider(5, RS[a], RS[b2]);
    const d = divider(5, RS[a], RS[b2], load);
    formula.textContent = `Vout = 5 V × R2 ÷ (R1 + R2) = 5 × ${ohms(RS[b2])} ÷ (${ohms(RS[a])} + ${ohms(RS[b2])}) = ${fmtV(ideal.vout)}`;
    reading.textContent = `analogRead() ≈ ${d.reading}   (reading × 5 ÷ 1023 = ${fmtV(d.vout)})`;
    if (load) {
      verdict.textContent = `With a ${ohms(load)} load across R2, Vout drops to ${fmtV(d.vout)} (${((1 - d.vout / ideal.vout) * 100).toFixed(0)}% lower). A divider can only drive something with a much higher resistance than R2.`;
      verdict.className = `demo-verdict ${d.vout / ideal.vout < 0.95 ? "is-warn" : "is-good"}`;
    } else {
      verdict.textContent = "An analog pin draws almost no current, so it doesn't disturb the divider.";
      verdict.className = "demo-verdict is-good";
    }
    b.set(d.vout);
  };
  const s1 = slider({ label: "R1 (top)", min: 0, max: RS.length - 1, value: a, onInput: (i) => { a = i; update(); } });
  const s2 = slider({ label: "R2 (bottom)", min: 0, max: RS.length - 1, value: b2, onInput: (i) => { b2 = i; update(); } });
  const l = select("Connected to Vout", loads.map(([v, t], i) => [i, t]), 0, (x) => { loadIdx = Number(x); update(); });
  box.append(s1.wrap, s2.wrap, l.wrap, readout(formula, b.svg, reading, verdict));
  modelNote(box, "ideal resistors and a perfect 5 V supply. On a real board the readings jitter by a step or two (noise), and 5 V is rarely exactly 5.00 V.");
  update();
  return box;
}

// ---- pull-up and pull-down resistors ----
function pullResistors() {
  const box = frame("Try it: pull-up and pull-down", "A button on an input pin. Choose how the pin is held when the button is released, then press it.");
  let mode = "pullup";
  let pressed = false;
  let ri = 7;
  const pin = el("div", "demo-formula");
  const current = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const btn = el("button", "btn btn-secondary demo-toggle");
  btn.type = "button";
  const update = () => {
    const r = RS[ri];
    const res = buttonInput(mode, pressed, r);
    pin.textContent = res.volts === null ? "Pin voltage: undefined - nothing holds it (floating)" : `Pin voltage: ${res.volts} V → digitalRead() gives ${res.reading}`;
    current.textContent = res.current === null ? "Current: none through a resistor (there isn't one)" : res.current ? `Current through the ${ohms(r)} resistor while pressed: 5 V ÷ ${ohms(r)} = ${fmtmA(res.current)}` : "Current: none (no path through the resistor while released)";
    if (mode === "none") verdict.textContent = pressed ? "Pressed it reads LOW - but released, it reads random values. Every input needs something holding it." : "Floating: the pin picks up stray electrical noise and reads random HIGHs and LOWs.";
    else if (mode === "pullup") verdict.textContent = `Pressed reads LOW, released reads HIGH. ${pressed && r < 1000 ? "A resistor this small wastes current while pressed - 10kΩ is typical." : "This is what INPUT_PULLUP does with a resistor built into the chip (20-50kΩ)."}`;
    else verdict.textContent = `Pressed reads HIGH, released reads LOW - the opposite of a pull-up. ${pressed && r < 1000 ? "A resistor this small wastes current - 10kΩ is typical." : "The Uno has no built-in pull-down, so this needs a real resistor."}`;
    verdict.className = `demo-verdict ${mode === "none" && !pressed ? "is-bad" : "is-good"}`;
    btn.textContent = pressed ? "Release the button" : "Press the button";
    btn.setAttribute("aria-pressed", String(pressed));
  };
  btn.addEventListener("click", () => { pressed = !pressed; update(); });
  const m = select("Resistor", [["pullup", "Pull-up (resistor to 5V, button to GND)"], ["pulldown", "Pull-down (resistor to GND, button to 5V)"], ["none", "None"]], mode, (x) => { mode = x; update(); });
  const s = slider({ label: "Resistor value", min: 0, max: RS.length - 1, value: ri, onInput: (i) => { ri = i; update(); } });
  box.append(m.wrap, s.wrap, btn, readout(pin, current, verdict));
  modelNote(box, "the input pin itself draws no current; \"random\" stands for the unpredictable readings of a floating pin.");
  update();
  return box;
}

// ---- RC charging ----
function rcCharge() {
  const box = frame("Try it: a capacitor charging", "5 V charges a capacitor through a resistor. The curve is V = 5 × (1 − e^(−t ÷ RC)).");
  const caps = [[1e-6, "1 µF"], [10e-6, "10 µF"], [100e-6, "100 µF"], [470e-6, "470 µF"]];
  let ri = 6;
  let ci = 2;
  const svg = svgEl("svg", { viewBox: "0 0 320 140", class: "demo-wave", role: "img" });
  const formula = el("div", "demo-formula");
  const verdict = el("div", "demo-verdict");
  const update = () => {
    const r = RS[ri];
    const c = caps[ci][0];
    const tau = timeConstant(r, c);
    const span = 5 * tau;
    svg.replaceChildren(
      svgEl("rect", { x: 30, y: 10, width: 280, height: 110, class: "dg-box" }),
      svgEl("line", { x1: 30, x2: 310, y1: 10 + 110 * (1 - 0.632), y2: 10 + 110 * (1 - 0.632), class: "demo-bar-limit" }),
    );
    let d = "";
    for (let i = 0; i <= 56; i++) {
      const t = (span * i) / 56;
      const v = rcVoltage(5, r, c, t);
      d += `${i ? "L" : "M"}${(30 + (280 * i) / 56).toFixed(1)},${(10 + 110 * (1 - v / 5)).toFixed(1)}`;
    }
    svg.appendChild(svgEl("path", { d, class: "demo-curve" }));
    const lab = (x, y, text, anchor = "start") => { const t = svgEl("text", { x, y, class: "dg-small", "text-anchor": anchor }); t.textContent = text; svg.appendChild(t); };
    lab(26, 16, "5V", "end");
    lab(26, 10 + 110 * (1 - 0.632) + 4, "63%", "end");
    lab(30 + 56, 136, "1τ", "middle");
    lab(310, 136, "5τ", "end");
    svg.setAttribute("aria-label", `Charging curve: 63% after ${fmtTime(tau)}, nearly full after ${fmtTime(5 * tau)}.`);
    formula.textContent = `τ = R × C = ${ohms(r)} × ${caps[ci][1]} = ${fmtTime(tau)}. After 1τ it's at 63% (3.16 V); after 5τ (${fmtTime(5 * tau)}) it's over 99% - effectively full.`;
    verdict.textContent = tau < 0.01 ? "Very fast - this is the kind of small RC used to smooth out electrical noise." : tau > 1 ? "Slow enough to watch - big RC values are used for simple timers and delays." : "In between: e.g. smoothing a supply, or debouncing a button in hardware.";
  };
  const fmtTime = (s) => (s >= 1 ? `${s.toFixed(2)} s` : s >= 0.001 ? `${(s * 1000).toFixed(1)} ms` : `${(s * 1e6).toFixed(0)} µs`);
  const s1 = slider({ label: "Resistor", min: 0, max: RS.length - 1, value: ri, onInput: (i) => { ri = i; update(); } });
  const s2 = select("Capacitor", caps.map(([, t], i) => [i, t]), ci, (x) => { ci = Number(x); update(); });
  box.append(s1.wrap, s2.wrap, svg, readout(formula, verdict));
  modelNote(box, "an ideal capacitor with no leakage, starting empty. The circuit simulator has no capacitor part, so this can't be built on the board - only calculated.");
  update();
  return box;
}

// ---- a transistor as a switch ----
function transistorDemo() {
  const box = frame("Try it: choosing a base resistor", "An NPN transistor (like a 2N2222) lets a 5 V pin switch a load that needs more current than the pin can give.");
  const loads = [[15, "One LED (15 mA)"], [60, "A small buzzer or 3 LEDs (60 mA)"], [100, "A relay coil (about 100 mA)"], [250, "A small hobby motor (about 250 mA)"]];
  let li = 2;
  let hfe = 100;
  const lines = [el("div", "demo-formula"), el("div", "demo-formula"), el("div", "demo-formula")];
  const verdict = el("div", "demo-verdict");
  const update = () => {
    const [load] = loads[li];
    const t = transistorSwitch(load, hfe);
    lines[0].textContent = `Directly from a pin: ${load} mA ${t.directOk ? "is within" : "is MORE than"} the pin's 20 mA.`;
    lines[1].textContent = `Base current: at least ${load} mA ÷ hFE ${hfe} = ${(t.ibMin * 1000).toFixed(2)} mA. Design for ${load} ÷ 10 = ${(t.ibDesign * 1000).toFixed(1)} mA, to be sure it's fully on.`;
    lines[2].textContent = `Base resistor = (5 V − 0.7 V) ÷ ${(t.ibDesign * 1000).toFixed(1)} mA = ${ohms(t.rbExact)} → nearest standard value below: ${ohms(t.rb)} (${(t.ibActual * 1000).toFixed(1)} mA from the pin).`;
    const notes = [];
    if (!t.pinOk) notes.push(`Problem: that's ${(t.ibActual * 1000).toFixed(1)} mA from the pin - over its 20 mA. For a load this big, use a logic-level MOSFET (almost no gate current) or a Darlington transistor (much higher gain), and check the part's datasheet.`);
    if (load >= 100) notes.push("A motor or relay coil also needs a flyback diode across it - when it switches off, the coil produces a voltage spike that can destroy the transistor - and a motor should have its own supply, not the Uno's 5V pin.");
    if (!notes.length) notes.push(t.directOk ? "This load could run straight from the pin - a transistor is only needed for bigger loads." : "The pin only supplies the small base current; the load's current flows through the transistor instead.");
    verdict.textContent = notes.join(" ");
    verdict.className = `demo-verdict ${!t.pinOk ? "is-bad" : load >= 100 ? "is-warn" : "is-good"}`;
  };
  const l = select("Load", loads.map(([, t], i) => [i, t]), li, (x) => { li = Number(x); update(); });
  const h = select("Minimum gain (hFE)", [[50, "50"], [100, "100"], [200, "200"]], hfe, (x) => { hfe = Number(x); update(); });
  box.append(l.wrap, h.wrap, readout(...lines, verdict));
  modelNote(box, "a fixed 0.7 V base-emitter drop and the \"base current = load current ÷ 10\" rule of thumb for switching. Check the transistor's datasheet for its maximum current (about 600 mA for a 2N2222; only 100 mA for a BC547). The circuit simulator has no transistor part.");
  update();
  return box;
}

registerDemos({
  "power": powerDemo,
  "resistor-combo": resistorCombo,
  kirchhoff,
  "voltage-divider": voltageDivider,
  "pull-resistors": pullResistors,
  "rc-charge": rcCharge,
  "transistor-switch": transistorDemo,
});
export const PATHWAY_DEMOS = ["power", "resistor-combo", "kirchhoff", "voltage-divider", "pull-resistors", "rc-charge", "transistor-switch"];
export { E12 };
