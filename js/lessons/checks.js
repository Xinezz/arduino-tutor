// Automatic challenge checking. A challenge can opt in by giving itself a
// `check` (built with the helpers below) - challenge.js then shows a
// "Check My Code" button instead of the self-marked "Mark as Solved".
//
// A check is { durationMs, inputs, verify(run) }:
//   - the learner's sketch is run headless for durationMs of virtual time
//     (see js/simulator/trace.js), with `inputs` scripting buttons/sensors
//   - verify(run) looks at what happened and returns null on a pass, or a
//     short learner-facing sentence saying what didn't match on a fail.
// Checks look at BEHAVIOUR (which pins did what, when; what got printed),
// not at how the code is written, so any correct solution passes.

import { traceProgram } from "../simulator/trace.js";

export const A0 = 14; // the interpreter's pin number for A0, as on a real Uno

// ---------- input scripts ----------

// A schedule like [[0, 1], [1000, 0], [2000, 1]] means "value 1 from 0ms,
// value 0 from 1000ms, ..." - used for scripted button presses and knob turns.
export function schedule(pin, steps) {
  return (askedPin, t) => {
    if (askedPin !== pin) return undefined;
    let value = steps[0][1];
    for (const [from, v] of steps) if (t >= from) value = v;
    return value;
  };
}

// ---------- reading a recorded run ----------

// Wraps a trace's raw event list in the questions checks actually ask.
function makeRun(trace, source) {
  const { events } = trace;
  const writesTo = (pin) => events.filter((e) => e.pin === pin && (e.kind === "digitalWrite" || e.kind === "analogWrite"));

  return {
    source,
    events,
    durationMs: trace.durationMs,

    modeOf(pin) {
      const set = events.filter((e) => e.kind === "pinMode" && e.pin === pin);
      return set.length ? set[set.length - 1].value : null;
    },

    // 0-255 output level of a pin at time t (digitalWrite HIGH counts as 255).
    levelAt(pin, t) {
      let level = 0;
      for (const e of writesTo(pin)) {
        if (e.t > t) break;
        level = e.kind === "digitalWrite" ? (e.value ? 255 : 0) : e.value;
      }
      return level;
    },

    analogWrites(pin) {
      return events.filter((e) => e.kind === "analogWrite" && e.pin === pin).map((e) => ({ t: e.t, value: e.value }));
    },

    // Times a pin actually changed between on and off: [{ t, on }].
    transitions(pin) {
      const out = [];
      let on = false;
      for (const e of writesTo(pin)) {
        const nowOn = e.value > 0;
        if (nowOn !== on) { out.push({ t: e.t, on: nowOn }); on = nowOn; }
      }
      return out;
    },

    // Serial output split into lines, each stamped with when it started printing.
    lines() {
      const out = [];
      let current = null;
      for (const e of events) {
        if (e.kind !== "print") continue;
        for (const chunk of String(e.value).split(/(\n)/)) {
          if (chunk === "\n") { out.push(current ?? { t: e.t, text: "" }); current = null; }
          else if (chunk) current = current ? { ...current, text: current.text + chunk } : { t: e.t, text: chunk };
        }
      }
      if (current) out.push(current);
      return out.map((l) => ({ ...l, text: l.text.trim() }));
    },
  };
}

// ---------- shared expectations ----------

const near = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;
const timingTolerance = (ms) => Math.max(50, ms * 0.1);

export function expectOutputPin(run, pin) {
  if (run.modeOf(pin) !== "OUTPUT") return `Pin ${pin} was never set up with pinMode(${pin}, OUTPUT).`;
  return null;
}

// Pin toggles on for onMs, off for offMs, repeatedly.
export function expectBlink(run, pin, onMs, offMs) {
  const t = run.transitions(pin);
  if (t.length === 0) return `Pin ${pin} never turned on.`;
  if (t.length < 4) return `Pin ${pin} didn't keep blinking - it should switch on and off over and over.`;
  for (let i = 0; i + 1 < t.length; i++) {
    const length = t[i + 1].t - t[i].t;
    const expected = t[i].on ? onMs : offMs;
    if (!near(length, expected, timingTolerance(expected))) {
      return `Pin ${pin} stayed ${t[i].on ? "on" : "off"} for about ${Math.round(length)}ms, but it should be ${expected}ms.`;
    }
  }
  return null;
}

// An output that should react to an input: samples are [t, shouldBeOn, situation],
// e.g. [1900, true, "the button was held down"].
export function expectFollows(run, pin, samples) {
  for (const [t, shouldBeOn, situation] of samples) {
    const isOn = run.levelAt(pin, t) > 0;
    if (isOn !== shouldBeOn) {
      return `When ${situation}, the LED on pin ${pin} was ${isOn ? "on" : "off"} - it should be ${shouldBeOn ? "on" : "off"}.`;
    }
  }
  return null;
}

// A line matching `match` gets printed every periodMs.
export function expectRepeatingLine(run, match, periodMs, describe) {
  const lines = run.lines().filter((l) => match(l.text));
  if (lines.length === 0) return `${describe} was never printed to the Serial Monitor.`;
  if (lines.length < 3) return `${describe} was printed, but it should keep printing over and over.`;
  for (let i = 0; i + 1 < lines.length; i++) {
    const gap = lines[i + 1].t - lines[i].t;
    if (!near(gap, periodMs, timingTolerance(periodMs))) {
      return `${describe} printed about every ${Math.round(gap)}ms - it should be every ${periodMs}ms.`;
    }
  }
  return null;
}

// Last number printed before time t (for "print what the sensor reads" checks).
export function lastNumberBefore(run, t) {
  let found = null;
  for (const l of run.lines()) {
    if (l.t > t) break;
    const n = parseFloat(l.text);
    if (!Number.isNaN(n)) found = n;
  }
  return found;
}

// ---------- running a check ----------

export function runCheck(check, source) {
  const trace = traceProgram(source, { durationMs: check.durationMs, inputs: check.inputs });
  if (trace.error) return { pass: false, message: `Your code couldn't run: ${trace.error}` };
  const problem = check.verify(makeRun(trace, source));
  return problem
    ? { pass: false, message: problem }
    : { pass: true, message: check.passMessage || "Your code does exactly what the challenge asked." };
}
