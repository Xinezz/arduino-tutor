# Phase 6 – Engineering pathways: audit and plan

## 1. Audit: what the platform can honestly support

### The simulator (`js/simulator/board.js`, `interpreter.js`, `headless.js`) is a *logic and wiring* simulator, not a circuit solver

What it **does** model:
- Which parts are connected (nets).
- Pin modes and HIGH/LOW, including PWM levels (only on pins 3, 5, 6, 9, 10 and 11).
- Timing, Serial, `tone()`, servo angle, ultrasonic timing (58 µs/cm).
- Floating inputs and pull-ups.
- Circuit faults: polarity, shorts, missing GND, a missing resistor.

What it **does not** model:
- Voltages and currents in a circuit. A resistor's value only changes the circuit check's advice; the LED looks the same with 220 Ω or 10 kΩ.
- Analog sensors produce a *reading* set by an on-board slider, not a computed voltage.
- There are no capacitor, diode, transistor, motor-driver or stepper parts.

Consequences:
- Voltage and current behaviour (dividers, Kirchhoff, RC charging, transistor switching) is taught with **calculated models**: interactive demos that compute standard textbook formulas, labelled "calculated from the formula – not a circuit simulation".
- Practical projects use only parts the simulator really runs, and are checked by running the learner's code.
- Activities that need parts the simulator lacks (a transistor) are labelled **real hardware**, and never count as checked evidence.

### Reusable pieces

| Piece | Reused for |
|---|---|
| Lesson blocks and renderer (`lessons/render.js`): text, tables, lists, notes, demos, questions, exercises, mistakes | Pathway lessons, rendered with the same block renderer |
| Demos (`lessons/demos.js`) | New calculated visualisations registered alongside the existing ones |
| Checkpoints (`quiz/quiz.js`, "questions" type) + per-question tracking (Phase 5) | Pathway checkpoints, and missed questions coming back in spaced revision |
| Project library (Phase 4): page, Guided/Challenge/Independent builder, behaviour checks (`lessons/checks.js` `runCheck`) | Pathway projects, unchanged |
| Learner profile, recommendations, achievements (Phase 5) | Pathway recommendation rule, pathway progress, certificate trophy |

## 2. Plan

### Structure
- **Pathways** tab: an overview of the five pathways, with:
  - what each teaches and what you can build after it;
  - labels: available / not built yet, runs in the simulator / needs real hardware;
  - search and filter over pathway lessons and projects.
- **Three levels** in every pathway:
  - **Foundation:** ideas, terms, visual demos, checkpoints.
  - **Application:** checked projects, modifying designs, troubleshooting.
  - **Engineering design:** an open-ended problem, judged on behaviour plus your written design decisions.
- **Prerequisites:**
  - Core lessons before a pathway.
  - Each level before the next.
  - Skipping is allowed, but only after a dialog that names what's missing and what that will make harder.
- **Completion:**
  - A level counts as complete when its lessons are done **and** their checkpoints are answered right **and** its projects passed their checks.
  - A **certificate of completion** needs all three levels. It's stated on the certificate that it's a record of learning on this website, not an accredited qualification.

### Stage 3 – Electronics Engineering (built in this phase)
**Level 1 – Foundation:**
1. Electronic components.
2. Ohm's law and power.
3. Series and parallel resistors.
4. Kirchhoff's laws.

**Level 2 – Application:**
5. Voltage dividers.
6. Pull-up and pull-down resistors.
7. Capacitors and diodes.
8. Transistors as switches.

Projects:
- LED control circuit.
- Voltage divider meter.
- Light-sensitive circuit.
- Transistor-controlled LED: a **real-hardware** design worksheet.

**Level 3 – Engineering design:**
9. Circuit analysis and design.

Design project: a simple electronic alarm. Any trigger, any pins, any sound pattern is accepted as long as it meets the requirements.

### Later stages (not in this phase)
Robotics and Automation, Sensors and Instrumentation, IoT and Smart Systems, Engineering Programming, the open-ended design challenge set, and the searchable theory library. They are listed on the Pathways page as "not built yet", with what each will cover and which parts would need real hardware (for example IoT/ESP32 networking). Nothing for them can be opened or claimed.

Simulator extensions needed for them, with their technical limits:
- **DC motor via PWM:** speed ∝ duty cycle as a labelled simplification; no inertia or load.
- **Steppers:** step sequencing.
- **A sensor-data plotter:** of real `analogRead` values over time.

## 3. Status after this phase

Built: the Pathways tab and Pathway A (Electronics Engineering).
- 9 lessons over 3 levels.
- 7 new calculated visualisations, plus one reused.
- 4 checked projects, including an open-ended design.
- A real-hardware transistor worksheet.
- Completion rules and a certificate.
- Pathway questions in spaced revision.
- A recommendation rule, a goal and a trophy.

Pathways B–E are listed as "not built yet" and can't be opened.

**Automated tests:** `tests/pathways.test.js` (24 tests); the full suite is 328 of 328 passing. They cover:
- every formula;
- the lessons' own quiz answers checked against those formulas;
- each project's reference solution, alternative valid designs, and typical mistakes;
- completion and certificate rules;
- prerequisites;
- recommendations;
- revision;
- old and broken saves.

**Tested in the browser:**
- Overview, search and filters.
- Pathway page.
- The prerequisite warning.
- All 9 lessons, with every visualisation's controls moved.
- A checkpoint, with one miss saved per question.
- Marking a lesson done.
- A pathway project page (printed-output preview) and going back to the pathway.
- The certificate, claimed from a save holding all of the evidence.
- Phone width.

**Not done:** building the four pathway projects by hand in the browser. They run in the same project builder that was tested in Phase 4, and their checks are proven by the automated tests.
