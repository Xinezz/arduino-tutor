// Runs a sketch OFF-SCREEN on a fake clock: seconds of Arduino time take a
// fraction of a second, nothing is drawn, and everything the sketch does is
// recorded with the simulated time it happened. Used by "Check My Solution"
// (js/lessons/checks.js) and by the automated tests.
//
// The probe hardware follows the same pin rules as the on-screen board
// (board.js): only an OUTPUT pin is driven, digitalWrite on an input just
// sets its pull-up, analogWrite makes a pin an OUTPUT and keeps the Uno's PWM
// behaviour (uno.js) - so a sketch that forgets pinMode() fails here exactly
// the way its LED would stay dark on the board.

import { startProgram } from "./interpreter.js";
import { analogWriteLevel } from "./uno.js";

// A clock plus timers that only move when told to.
// yieldCost: how much simulated time a 0 ms timer (the runner's "let the
// browser have a turn") costs - at least 1 ms, as in a real browser.
export function createFakeTiming({ yieldCost = 1 } = {}) {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const timing = {
    now: () => now,
    setTimer(fn, ms) {
      const id = ++seq;
      timers.set(id, { id, at: now + (ms > 0 ? ms : yieldCost), fn });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  };
  return {
    timing,
    now: () => now,
    pendingTimers: () => timers.size,
    // Moves time forward by `ms`, running every timer that comes due, in order.
    advance(ms) {
      const end = now + ms;
      for (let fired = 0; ; fired++) {
        if (fired > 2_000_000) throw new Error("timer storm - a sketch never paused");
        let next = null;
        for (const t of timers.values()) {
          if (t.at <= end && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
        }
        if (!next) break;
        timers.delete(next.id);
        now = Math.max(now, next.at);
        next.fn();
      }
      now = end;
    },
  };
}

// A stand-in for the board that records every call and keeps the pins'
// state the way the board would. `inputs` answers reads:
//   digitalRead(pin, t), analogRead(pin, t) - functions of the pin and time
//   pulseIn(pin, t) - a function, or a fixed number of microseconds
//   pinStatus - optional, passed through for the floating-pin warning
export function createProbeHardware(clock, inputs = {}) {
  const calls = [];
  const modes = {};
  const portHigh = {};
  const events = []; // { t, pin, level } every time an output pin's level changes
  const sounds = []; // { t, pin, freq } - freq null when the sound stops
  const levels = {};

  function setLevel(pin, level) {
    if (levels[pin] === level) return;
    levels[pin] = level;
    events.push({ t: clock.now(), pin, level });
  }
  const rec = (name, fn) => (...args) => {
    calls.push({ t: clock.now(), name, args });
    return fn?.(...args);
  };

  const hw = {
    calls,
    modes,
    events,
    sounds,
    pinMode: rec("pinMode", (pin, mode) => {
      modes[pin] = mode;
      if (mode === "INPUT_PULLUP") portHigh[pin] = true;
      if (mode === "INPUT") portHigh[pin] = false;
      setLevel(pin, mode === "OUTPUT" && portHigh[pin] ? 255 : 0);
    }),
    digitalWrite: rec("digitalWrite", (pin, value) => {
      portHigh[pin] = !!value;
      if (modes[pin] === "OUTPUT") setLevel(pin, value ? 255 : 0);
    }),
    analogWrite: rec("analogWrite", (pin, value) => {
      modes[pin] = "OUTPUT";
      setLevel(pin, analogWriteLevel(pin, value));
    }),
    tone: rec("tone", (pin, freq, duration) => {
      modes[pin] = "OUTPUT";
      sounds.push({ t: clock.now(), pin, freq });
      if (duration > 0) sounds.push({ t: clock.now() + duration, pin, freq: null });
    }),
    noTone: rec("noTone", (pin) => sounds.push({ t: clock.now(), pin, freq: null })),
    servoWrite: rec("servoWrite"),
    lcdBegin: rec("lcdBegin"),
    lcdPrint: rec("lcdPrint"),
    lcdSetCursor: rec("lcdSetCursor"),
    lcdClear: rec("lcdClear"),
    digitalRead: (pin) => {
      const v = inputs.digitalRead ? inputs.digitalRead(pin, clock.now()) : 0;
      calls.push({ t: clock.now(), name: "digitalRead", args: [pin], value: v });
      return v;
    },
    analogRead: (pin) => {
      const v = inputs.analogRead ? inputs.analogRead(pin, clock.now()) : 512;
      calls.push({ t: clock.now(), name: "analogRead", args: [pin], value: v });
      return v;
    },
    pulseIn: (pin) => {
      const v = typeof inputs.pulseIn === "function" ? inputs.pulseIn(pin, clock.now()) : inputs.pulseIn ?? 1160; // 1160 us = 20 cm on an HC-SR04
      calls.push({ t: clock.now(), name: "pulseIn", args: [pin], value: v });
      return v;
    },
  };
  if (inputs.pinStatus) hw.pinStatus = inputs.pinStatus;

  // The 0-255 level an output pin had at time t (0 if it was never driven).
  hw.levelAt = (pin, t) => {
    let level = 0;
    for (const e of events) {
      if (e.t > t) break;
      if (e.pin === pin) level = e.level;
    }
    return level;
  };
  // The tone playing on a pin at time t (its frequency), or null.
  hw.soundAt = (pin, t) => {
    let freq = null;
    for (const s of [...sounds].sort((a, b) => a.t - b.t)) {
      if (s.t > t) break;
      if (s.pin === pin) freq = s.freq;
    }
    return freq;
  };
  return hw;
}

// Runs `source` for `ms` of simulated time and returns everything it did:
// { output, lines, printed: [{t, text}], errors, errorDetails, warnings,
//   hardware (the probe, with levelAt/soundAt), clock, controller }.
// stopAtEnd: false leaves the sketch running, so a caller can keep moving the
// clock forward (the timing tests do).
export function simulate(source, { ms = 1000, inputs, timeScale, clock, hardware, yieldCost, stopAtEnd = true } = {}) {
  clock = clock || createFakeTiming({ yieldCost });
  const hw = hardware || createProbeHardware(clock, inputs);
  const result = { output: "", printed: [], errors: [], errorDetails: [], warnings: [], stopped: [] };
  let pending = "";
  result.controller = startProgram(
    source,
    hw,
    {
      onOutput: (text) => {
        result.output += text;
        // Each finished line, stamped with when its last piece was printed.
        pending += text;
        const parts = pending.split("\n");
        pending = parts.pop();
        for (const line of parts) result.printed.push({ t: clock.now(), text: line });
      },
      onError: (message, details) => { result.errors.push(message); result.errorDetails.push(details); },
      onWarning: (w) => result.warnings.push(w),
      onStopped: (m) => result.stopped.push(m),
    },
    { timing: clock.timing, timeScale }
  );
  clock.advance(ms);
  if (stopAtEnd) result.controller.stop();
  if (pending) result.printed.push({ t: clock.now(), text: pending });
  result.clock = clock;
  result.hardware = hw;
  result.calls = hw.calls;
  result.lines = result.output.split("\n").filter((l) => l !== "");
  return result;
}
