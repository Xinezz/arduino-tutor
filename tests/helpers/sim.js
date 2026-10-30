// Test helpers: run a sketch on a FAKE clock, so seconds of Arduino time take
// milliseconds of test time, and record everything it does. The machinery
// itself lives in js/simulator/headless.js (the site's "Check My Solution"
// uses the same thing); these are the shapes the tests like to call it in.

import { createFakeTiming, createProbeHardware, simulate } from "../../js/simulator/headless.js";

export { createFakeTiming };

// A stand-in for the board: records every hardware call (with the simulated
// time it happened) and answers reads from the `inputs` object.
export const recordingHardware = createProbeHardware;

// Runs `source` for `ms` of simulated time and returns everything it did.
// The sketch is left running, so a test can keep advancing r.clock.
export function runSketch(source, { ms = 1000, inputs, timeScale, clock, hardware } = {}) {
  return simulate(source, { ms, inputs, timeScale, clock, hardware, stopAtEnd: false });
}

// The common shape: put some statements into setup() and run once.
export function runInSetup(body, globals = "", opts = {}) {
  return runSketch(`${globals}\nvoid setup() {\n  Serial.begin(9600);\n${body}\n}\nvoid loop() { delay(1000); }`, { ms: 10, ...opts });
}
