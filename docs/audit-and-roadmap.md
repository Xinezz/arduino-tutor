# Arduino Tutor - audit and development roadmap

This is an honest review of the site as it stood on 2026-10-28 (commit
`9091270`). It was checked by reading the code, running the automated tests,
and using the site in a browser as a brand-new learner. It is followed by a
prioritised roadmap. The **Status** column shows what has since been done.

## Phase 1 - Audit

### What already works well

- **The architecture is sound.** It's plain HTML, CSS and ES modules with no
  build step, so it deploys to GitHub Pages as-is. `app.js` is the only module
  that coordinates the others, and every other module just renders and
  reports, which makes features easy to add without tangling them.
- **The simulator core is now trustworthy.** The interpreter follows real Uno
  rules: 16-bit `int`, integer division, Arduino-style float printing, real
  `delay()` timing, and `const`, `return` and functions handled properly.
  156 automated tests cover it.
- **The board models the things beginners get wrong:** floating inputs,
  `INPUT_PULLUP`, which pins support PWM, breadboard columns, and the trench.
- **There's more learning machinery than a typical tutorial site:**
  - a four-tier hint ladder that costs credits
  - five quiz types, including "find the bug" and "put the lines in order"
  - staged projects
  - flag-for-review, plus a "topics to review" panel built from quiz mistakes
  - save codes for moving between devices
- **The arcade identity is consistent and motivating** without getting in the
  way of the text, which stays in a readable font.

### What's confusing or hard for a beginner

1. **The first hands-on moment comes too late.** A newcomer reads 18 text
   lessons, including ones about installing the IDE and uploading (which don't
   matter in a browser), before wiring anything. Then the first wiring
   challenge said "assume the LED and resistor are already wired", while the
   board was empty.
2. **Lesson code can't be run.** Every code example is display-only. The
   editor and board only appear on lessons that have a challenge, so
   "observe" and "experiment" aren't possible for most of the course.
3. **Wiring is hard to discover.** Components don't plug into the breadboard
   by sitting on it, the leads are small dots with no + or − marks, and wiring
   mistakes produced no explanation at all.
4. **Errors were one red line.** A missing `}` was reported as "To give 'loop'
   a starting value write =", which sends a beginner in the wrong direction.
5. **"Reset" doesn't mean what a beginner thinks.** On an Arduino it restarts
   the program; here it wiped the editor without asking. "Clear Wiring" did
   the same to the circuit.

### What's incomplete or missing

1. **Challenges grade themselves.** "Mark as Solved" pays out without the code
   ever being run. Nothing checks whether a solution works, so the learner
   never gets the most important feedback of all, and rewards can be farmed.
   *This is the biggest flaw in the learning loop.*
2. **Level 5 (Programming Fundamentals) doesn't exist**, but three lessons say
   "Level 5 covers this properly". `if/else`, comparisons, `for` and `while`
   loops, functions and `millis()` timing are never taught directly, yet the
   Level 2 challenges already need them.
3. **There's no lesson on breadboards or circuits** (how rows and columns
   connect, what a complete circuit is), which is the foundation everything
   else relies on.
4. **Only 11 of 43 lessons have a knowledge check**, and none state learning
   objectives.
5. **There are only two projects**, and no debugging practice outside the
   quizzes.

### Technical limitations that affect learning

- **Silent simplifications used to teach wrong ideas** (since fixed - see
  below). An LED with no resistor lit, sensors and the buzzer worked without
  their power and GND legs, breadboard rails were live without jumper wires,
  `tone()` made sound with no buzzer at all, and LEDs stayed lit after Stop.
- **No current or voltage is modelled**, so resistor values don't change
  brightness, and nothing can burn out.
- **Language gaps:** arrays, `switch`, `do-while` and Serial input aren't
  supported (they're rejected clearly - see
  `docs/arduino-language-support.md`).
- **Wiring on a phone is fiddly.** The click targets are small inside a
  780×600 drawing that gets scaled down.

### Progress tracking and achievements

Progress counts **clicks, not understanding**:

- A lesson is "done" when you click "Mark as Done".
- A challenge is "solved" when you click "Mark as Solved".
- Most trophies reward activity (runs, visits, a cheat code) rather than
  mastery.

The XP and credits layer works well, but it's attached to the wrong signals.

## Phase 2 - Prioritised roadmap

### Critical - affects whether the site works or teaches correctly

| # | Problem | Fix | Status |
| --- | --- | --- | --- |
| C1 | First hands-on work comes after 18 reading lessons; the Blink challenge assumed a pre-wired board | Guided **"Start your first circuit"**: parts → wiring → code → predict → run → explain → change → break and fix. It's the default start for new players, with call-outs in lessons 1 and 19 | Done |
| C2 | Simulator simplifications were silent | Honest LED model (current has to flow from a HIGH source to a LOW sink); a buzzer needs GND; Stop powers the board down; **Check Circuit** reports every simplification as a "REAL BOARD" note; a **Simulator Limits** window | Done |
| C3 | Errors didn't say what kind of mistake they were | Errors are labelled *syntax error / code problem / not supported / runtime error*, the line is highlighted in the editor, and each comes with a hint and recovery steps; a missing `}` is now reported as a missing `}` | Done |
| C4 | Challenges grade themselves | **Check My Solution**: the learner's code runs in a fast, off-screen simulation, its behaviour is compared with the goal, and the feedback is specific ("the LED turns on but never off"). Rewards only follow a passing check | Done - all 24 challenges |
| C5 | Level 5 is missing but promised in the text | A **Program Flow** world (if/else, comparisons and logic, loops, functions, `millis()`), placed straight after Arduino Basics so the Level 2 challenges no longer need concepts that haven't been taught | Done - 6 lessons, 6 checked challenges, 6 checkpoints |

### High priority - makes a big difference for beginners

| # | Improvement | Status |
| --- | --- | --- |
| H1 | Code feedback that teaches: what went wrong, why, which line, **which lesson to review** (a link), and hints revealed one at a time - for errors *and* warnings such as a missing `pinMode()` | Done - every error kind, every simulator warning and every wiring finding |
| H2 | **Try it** buttons on lesson code examples, loading them into the editor so learners can observe and experiment | Done - every complete sketch in every lesson |
| H3 | A breadboard and circuits lesson in the foundations | Done - "Breadboards and Complete Circuits", with a checkpoint |
| H4 | Learning objectives and a short checkpoint on each lesson, starting with the foundations and the new Program Flow world | Started - Program Flow has objectives, predict-then-explain, common mistakes and a checkpoint; the other worlds still need them |
| H5 | Wiring feedback on the board: + and − marks on leads, labels like "LED (check wiring)", and a wiring check every time Run is pressed | Done |
| H6 | Destructive actions look different and ask first ("Reset Code", "Clear Wiring"); tooltips on every control | Done |

### Medium priority - quality of life

| # | Improvement |
| --- | --- |
| M1 | Touch-friendly wiring: bigger targets and tap-to-wire on phones |
| M2 | Achievements for mastery (first passing check, fixing errors without hints, a clean circuit check) |
| M3 | A dashboard that shows *concepts* understood (from passed checks and quizzes), not just counts |
| M4 | Let Run restart a running sketch, instead of having to press Stop first |
| M5 | Remember each challenge's code and circuit between visits |
| M6 | More projects that follow your suggested pathway: traffic light, night light, distance warning, servo mechanism |

### Future development

- Arrays (the design is already written in the language-support doc), then
  `switch`, `do-while` and Serial input.
- Simple current modelling: resistor values affecting brightness, and an LED
  that "burns out" without a resistor, with an explanation.
- Parts that really plug into breadboard holes.
- Sharing circuits and sketches by link; class or teacher views.

### Proposed curriculum order (and why)

Your suggested pathway is right in spirit. The current order has two problems:
hardware-workflow lessons (IDE, compiling, uploading) come too early for
browser learners, and program flow is never taught at all. The proposal:

1. **Start here** - the guided first circuit. You succeed *before* the
   theory, so the theory has something to attach to.
2. **Foundations** - what Arduino and microcontrollers are, voltage, current
   and GND, breadboards and complete circuits, LEDs and resistors, the
   pinout.
3. **First sketches** - `setup()` and `loop()`, `pinMode()`,
   `digitalWrite()`, `delay()`, comments, the Serial Monitor, variables, types
   and constants.
4. **Program flow** *(new)* - if/else, comparisons and logic, `for` and
   `while`, functions, `millis()` timing. All of it can be learned with the
   Serial Monitor alone, which suits learners with no hardware.
5. **Digital input** - `digitalRead()`, buttons, floating pins, `INPUT_PULLUP`,
   then the traffic light and button counter challenges (which now only use
   concepts already taught).
6. **Analog input**, then **PWM and outputs**, then **sensors**, then the
   **projects**.
7. **Moving to real hardware** - the IDE, compiling and uploading, reading real
   compiler errors.

To protect saved progress and trophies, lesson ids and level numbers stay as
they are. New content gets new ids, and the order lessons are shown in is set
separately from their numbers.
