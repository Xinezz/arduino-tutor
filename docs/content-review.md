# Educational content - review and Phase 2 batches

## 1. Curriculum review (before writing anything)

Every lesson was read for Modules 0-2. Modules 3-8 were reviewed for structure and order here, and get the
same line-by-line review in their own batch.

**Missing explanations**
- No lesson said what electricity *is*; voltage was the first idea taught.
- Open/closed circuits were one paragraph inside the breadboard lesson; series and parallel weren't taught at all.
- Short circuits were only mentioned in a Check Circuit message (fixed in the previous sprint).
- "Compiling" was used but never explained; `void` was never mentioned.

**Too early, or in the wrong order**
- "What is a Microcontroller?" was really a spec sheet: board models, 16 MHz, PWM and `analogWrite` in lesson 0.2.
- "Understanding the Arduino Board" brought in Serial RX/TX before Serial existed.
- The Serial Monitor was taught at the *end* of Module 2, but `setup()` and `loop()` already used `Serial.println()`.
- `delay()` appears in examples before its own lesson - kept, but now always explained in a line where it appears.

**Wrong audience**
- Lesson 0.1 addressed "a Mechatronics student"; lessons 2.1 and 2.5 assumed C or Python ("nothing new here if you've used C").

**Repetition**
- The "complete loop" idea was explained in the breadboard lesson and again in the GND lesson. It now has its own lesson, and the
  other two refer to it. The GND lesson's guided activity was the same as the circuit lesson's; it now covers GND pins and short
  circuits instead.
- Compiling is explained in 2.1 and again in Module 8's "Compiling and Uploading" - to tidy in that batch.

**Difficulty steps**
- Module 1 jumped from Ohm's law straight to GND, without circuits; now: electricity → voltage → current → resistance →
  open/closed circuits → GND → series/parallel → breadboards → LEDs → polarity.
- Modules 3-8 (for later batches): Module 6 has 10 lessons, the heaviest; "Basic DC Motor Concepts" covers hardware the simulator
  can't run and must say so clearly; Module 3's `#define` is more than a beginner needs at that point; 26 of the 37
  lessons in Modules 3-8 still have no worked example, guided activity or prediction (Module 6: 10), and 24 have no checkpoint.

**Kept on purpose:** programming (Module 3) before digital inputs (Module 4), because reading a button is only useful with `if`
and variables; analog signals in Module 5, where `analogRead()` uses them.

## 2. Batch 1 - Modules 0, 1 and 2 (26 lessons)

Every lesson now has the full structure: objectives, prerequisites, introduction, "How it works", "In real projects", a visual
where one helps, a worked example or annotated code, a guided activity, predictions and quick checks (each wrong option
explained, with a retry), an independent exercise with its expected result, a multi-question knowledge checkpoint, a summary
and "What's next".

- **New lessons:** 1.1 What is Electricity?, 1.5 Open and Closed Circuits, 1.7 Series and Parallel Circuits.
- **Rewritten:** 0.1, 0.2, 0.4, 2.1, 2.2 (Serial Monitor, moved up from 2.10), 2.5, 2.6, 2.11; 1.8 refocused as "Breadboards".
- **Extended:** the other lessons gained real-world sections, exercises (modify / debug / your turn) and summaries.
- **New lesson parts:** labelled diagrams (7), interactive demos for open/closed and series/parallel circuits, comparison
  tables, annotated code, exercises with hint / expected result / solution, and guided activities that carry their own sketch.
- **Checkpoints:** 21 new question sets replace match/fill-in quizzes (recall) with scenario questions (understanding), every
  option explained; 5 good existing checkpoints kept. All 26 lessons have one.

### Simulator issues found while writing (both handled)
- A misspelled Serial function (`Serial.printn`) was reported as "not supported in this simulator" - now it's a code problem
  with a suggestion ("Did you mean 'Serial.print'?").
- LEDs in series aren't simulated (Check Circuit calls them unconnected). Added to Simulator Limits and the language-support
  doc; the series lesson says so and uses its demo for real series behaviour. A pressed button doesn't carry power to an LED
  (already listed) - the open/closed lesson opens the circuit by removing a wire instead.

### How it was checked
- `npm test`: 271 tests pass. New tests run every exercise solution and annotated sketch, check that every stated output in a
  prediction, quick check or checkpoint is what the simulator prints, that every wrong option has an explanation, that broken
  sketches really fail and their fixes work, that Modules 0-2 have every part of the structure, and that the Module 1 guided
  circuits behave the way their steps say.
- In the browser: all 63 lessons open without errors; Modules 0-2 render in order with their sections, checkpoints and
  summaries; a quick check, an exercise and a checkpoint were answered wrong-then-right; both new demos were clicked through
  every state and match the lesson text; all 7 diagrams have no overlapping or clipped labels; at 375px no lesson scrolls
  sideways (tables, code and diagrams scroll inside their own boxes).

## 3. Next batches
- **Batch 2:** Module 3 (Programming Fundamentals) - variables tied to sensor readings, data types, operators, conditions,
  loops, functions; `#define` moved out of the beginner path.
- **Batch 3:** Modules 4 and 5 (digital inputs, analog inputs, PWM).
- **Batch 4:** Modules 6-8 (sensors and actuators, projects, real hardware), with Module 6 split or trimmed.
