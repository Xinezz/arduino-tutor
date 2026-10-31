# Phase 3 - interactive learning: audit and plan

## Stage 1 - what exists today

**Simulator.** `interpreter.js` compiles a sketch (tokenize → parse → analyze) and runs it as a
*generator*: it pauses (`yield`) before every statement (a "tick") and at every `delay()`.
`startProgram()` is the scheduler that resumes it. The board (`board.js`) models pins, wiring, LEDs
(on/off/PWM level), buttons, pull-ups, potentiometer, LDR, temperature, ultrasonic, IR, buzzer,
servo and LCD. `headless.js` runs the same interpreter on a simulated clock (used by Check My
Solution, the tests, and now "Run it and compare").

**Accurately simulated:** digital I/O, PWM levels on the right pins, analogRead from the sensor
sliders, timing (`delay`, `millis`), Serial output, `if`/loops/functions, Uno number rules.
**Not simulated:** current/voltage values (no brightness from resistor values), LEDs in series,
buttons carrying power, reading from the Serial Monitor, arrays, interrupts.

**Lessons already interactive:** demos (Ohm's law, HIGH/LOW, PWM, analog vs digital, breadboard,
open/closed, series/parallel), 27 predictions, quick checks, guided activities with starter
circuits, exercises with hints/expected results, 28 challenges checked by "Check My Solution"
(which already accepts different correct solutions - it checks behaviour, not text) with a
3-step hint ladder, multi-question checkpoints, the guided first circuit (one step at a time,
with "Show me where" highlighting), and the editor's command explanations.

## Stage 2 - where interactivity helps most

1. Predicting before running (all modules) - **done this round**, see below.
2. Watching code execute (Modules 2-3: setup/loop, variables, if, loops, functions) - needs the
   interpreter work below.
3. Debugging practice (all modules) - debug exercises and checkpoints exist but are scattered.
4. Component experiments (Modules 4-6) - the board already simulates the parts; a lab page would
   make them explorable without a lesson.
5. A variables demo (Module 3) - "change a value, see the output change".

## Stage 3 - done this round: predict, explain, run, compare

Every "predict first" question now:
- asks the learner to write their reasoning first (optional, kept on the page, not graded);
- after the answer, explains it and shows their reasoning beside the explanation;
- for the 11 predictions whose output is known (verified by the tests), offers **Run it and
  compare**: the real sketch runs (same interpreter, simulated clock) and its output is shown with
  timings next to the learner's first prediction - then Try it, to run it on the board;
- records whether the FIRST prediction was right (later tries can't lower it). The Progress page
  shows "predictions right first time".

Tested: reasoning echo, wrong-then-right, run-and-compare output (0 ms Start, 0 ms Again,
2000 ms Again), the stored prediction, the Progress tile; `npm test` 271/271.

## The interpreter plan (for review before building)

**Step, pause, current-line highlight and variable inspector** can be built on the existing
generator - no rewrite:

1. The per-statement tick carries the statement's line number and its scope:
   `yield { type: "tick", line, scope }` (today it's one shared `TICK` object).
2. `startProgram()` gets a controller: `pause()`, `resume()`, `step()` (run until the next tick,
   then stop). The scheduler already resumes the generator one tick at a time, so stepping is
   "resume once, then don't reschedule".
3. **Timing stays honest:** while paused, simulated time must not run on, or `millis()` would jump.
   The `lag` mechanism added for late timers already does exactly this - paused time is added to it.
   A `delay()` met while stepping completes on the next Step (with `millis()` advancing by its length).
4. The editor highlights `line` (CodeMirror line class, as error lines are now).
5. The variable inspector reads globals and the current scope chain at each pause and lists
   name / type / value (Uno types, e.g. `int` wraps at 32767, shown as the sketch sees it).
6. The board keeps showing pin levels at each pause - it's already driven by the same calls.

Limits to state honestly: stepping is per statement (a `for` header is one step); expressions
inside a line aren't stepped; values are shown while paused, not continuously at full speed.

Effort: interpreter + scheduler ~150 lines, editor/inspector UI ~150 lines, plus tests (stepping
order, `millis()` across a pause, inspector values).

## Stages still to do

- **Stage 4** - interpreter work above; a **Debugging Academy** page: beginner (missing `;`,
  wrong pin, missing `pinMode`, spelling), intermediate (wrong condition/value, loop count),
  advanced (multi-part, sensor programs) - each: broken code or circuit, expected outcome,
  learner finds the issue, progressive hints, attempt, explanation; struggles tracked by error
  type. Reuses Check My Solution (behaviour-based checks) and the hint ladder.
- **Stage 5** - an **Electronics Lab** page: one card per simulated part (LED/PWM, button,
  potentiometer, LDR, ultrasonic, servo) - what it does, how it works, how it connects, what its
  values mean, real uses - with a pre-wired circuit and a sketch to experiment with on the real board.
- **Stage 6** - recommend revision from prediction accuracy, debugging error types and hint use.
- **Stage 7** - full retest, including mobile.
- Extend "Run it and compare" to LED predictions by showing the pin's timeline (the probe hardware
  already records it).
