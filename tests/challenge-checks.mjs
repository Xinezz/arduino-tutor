// Sanity test for automatic challenge checking: every challenge with a
// `check` must pass its own reference solution and fail an empty sketch.
// Run with: node tests/challenge-checks.mjs

import { lessons } from "../js/lessons/data.js";
import { runCheck } from "../js/lessons/checks.js";

const EMPTY = "void setup() {\n}\n\nvoid loop() {\n}\n";
let failures = 0;

for (const { challenge } of lessons) {
  if (!challenge?.check) continue;
  const solution = runCheck(challenge.check, challenge.solution);
  const empty = runCheck(challenge.check, EMPTY);
  const ok = solution.pass && !empty.pass;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${challenge.id} ${challenge.title}` +
    (solution.pass ? "" : `\n     solution failed: ${solution.message}`) +
    (empty.pass ? "\n     empty sketch passed" : ""));
}

if (failures) {
  console.error(`\n${failures} challenge check(s) failed`);
  process.exit(1);
}
