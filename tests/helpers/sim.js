// Test helpers: run a sketch on a FAKE clock, so seconds of Arduino time take
// milliseconds of test time, and record everything it does.

import { startProgram } from "../../js/simulator/interpreter.js";

// A clock plus timers that only move when the test says so.
export function createFakeTiming() {
  let now = 0;
  let seq = 0;
  const timers = new Map();
  const timing = {
    now: () => now,
    setTimer(fn, ms) {
      const id = ++seq;
      // A 0 ms timer (the runner's "give the browser a turn") still costs
      // 1 ms here - in a real browser it costs at least that, and it stops a
      // sketch with no delay() from spinning forever at a single instant.
      timers.set(id, { id, at: now + (ms > 0 ? ms : 1), fn });
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

// A stand-in for the board: records every hardware call (with the simulated
// time it happened) and answers reads from the `inputs` object.
export function recordingHardware(clock, inputs = {}) {
  const calls = [];
  const rec = (name) => (...args) => {
    calls.push({ t: clock.now(), name, args });
  };
  const hw = {
    calls,
    pinMode: rec("pinMode"),
    digitalWrite: rec("digitalWrite"),
    analogWrite: rec("analogWrite"),
    tone: rec("tone"),
    noTone: rec("noTone"),
    servoWrite: rec("servoWrite"),
    lcdBegin: rec("lcdBegin"),
    lcdPrint: rec("lcdPrint"),
    lcdSetCursor: rec("lcdSetCursor"),
    lcdClear: rec("lcdClear"),
    digitalRead: (pin) => (inputs.digitalRead ? inputs.digitalRead(pin, clock.now()) : 0),
    analogRead: (pin) => (inputs.analogRead ? inputs.analogRead(pin, clock.now()) : 512),
    pulseIn: () => inputs.pulseIn ?? 1160, // 1160 us = 20 cm on an HC-SR04
  };
  if (inputs.pinStatus) hw.pinStatus = inputs.pinStatus;
  return hw;
}

// Runs `source` for `ms` of simulated time and returns everything it did.
export function runSketch(source, { ms = 1000, inputs, timeScale, clock = createFakeTiming(), hardware } = {}) {
  const result = { output: "", errors: [], errorDetails: [], warnings: [], stopped: [] };
  const hw = hardware || recordingHardware(clock, inputs);
  result.controller = startProgram(
    source,
    hw,
    {
      onOutput: (t) => { result.output += t; },
      onError: (e, details) => { result.errors.push(e); result.errorDetails.push(details); },
      onWarning: (w) => result.warnings.push(w),
      onStopped: (m) => result.stopped.push(m),
    },
    { timing: clock.timing, timeScale }
  );
  clock.advance(ms);
  result.clock = clock;
  result.calls = hw.calls;
  result.lines = result.output.split("\n").filter((l) => l !== "");
  return result;
}

// The common shape: put some statements into setup() and run once.
export function runInSetup(body, globals = "", opts = {}) {
  return runSketch(`${globals}\nvoid setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() { delay(1000); }`, { ms: 10, ...opts });
}
