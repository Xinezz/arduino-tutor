# Arduino Tutor - full website test report

Tested: the live site, https://xinezz.github.io/arduino-tutor/ (commit `14b36c8`), 31 October 2026,
in the Claude desktop app's built-in Chromium browser, starting from an empty save. Layouts were
checked at 1024×768 (desktop), 768×1024 (tablet) and 375×812 (phone). Clicks were real mouse clicks
unless the row says "DOM click" (a `button.click()` from the console - same handler, no mouse).
Things not tested are listed as such - nothing here is marked as passing unless it was tried.

Stage 5 (retesting after the fixes) is at the end.

## Stage 1 - test results

### Navigation

| # | Feature | Expected | Actual | Result |
|---|---|---|---|---|
| N1 | First screen | Says what the site is and where to start | Boot splash ("A CircuitWorks Robotics Adventure"), waits for a key. Never says it's an Arduino course | Fail (clarity) |
| N2 | New-player form | Name, then start | Both start buttons disabled until a name is typed; the note says so | Pass |
| N3 | Where to begin | One obvious starting point | Two: "Start your first circuit" (recommended) and "Start with Lesson 1". The recommended one is wiring before the learner knows what an Arduino or a resistor is | Fail (sequence) |
| N4 | Tabs Learn / Projects / Practice / Progress | All reachable, all labelled | All reachable (DOM click and keys 1-4). Below 1280px wide only the current tab has a label - the others are bare icons (chip, LED, person) at 1024px, 768px and 375px | Pass (reach) / **Fail (labels)** |
| N5 | Back to the home screen | A way back | None: the logo is a plain `<div>`, Options has no "main menu". Only reloading the page gets you there | **Fail** |
| N6 | Returning player | Shows the next lesson | Start menu shows "Up next: 0.2 What is a Microcontroller?", Continue opens it | Pass |
| N7 | Project lesson links, Map view, coins → Shop | Open their targets | All open the right screen; a lesson with unfinished prerequisites warns first | Pass |
| N8 | Options window | Opens, closes with Esc | Yes | Pass |
| N9 | Duplicate sections | One place per job | The course appears three ways (Learn page, the lesson sidebar "Quest Log", the World Map). Acceptable as views of one list, but "Quest Log" and "Learn" name the same thing differently | Minor |

### Learning system

| # | Feature | Expected | Actual | Result |
|---|---|---|---|---|
| L1 | Lesson order | Logical sequence | 9 modules, 60 lessons, prerequisites only point backwards (automated test) | Pass |
| L2 | Objectives and prerequisites | Shown on every lesson | "Before you start" and "You'll be able to" on every lesson | Pass |
| L3 | Consistent 10-part lesson | Every lesson has the parts | About half the lessons (mainly Modules 2, 4, 5, 6, 8) are still text and code only - one "Introduction" section, no worked example, guided activity, prediction or experiment. **No lesson has a summary** | **Fail** |
| L4 | Knowledge checkpoints | One per lesson | 27 of 60 lessons. Modules 5-8 have one between them | Fail |
| L5 | Mark as done, Next, Previous | Work and save | Lesson 1 marked done → saved (`viewedLessons: ["l1-1"]`), Next opened 0.2, both survived a reload | Pass |
| L6 | Checkpoint retry | A wrong answer can be tried again | After one attempt every answer button is disabled, with no "Try again". The "What's next" card then says "Answer the knowledge checkpoint above" - which can't be done. Same for all five quiz types (one code path) | **Fail (bug)** |
| L7 | Checkpoint marking | A match quiz finished with one wrong guess | Shows "All matched", saved as failed and added to the revision list. Defensible (it was a struggle), but confusing without a retry | Linked to L6 |
| L8 | Revision list + Review button | Lists struggled topics, opens the lesson | Listed "Inputs and Outputs", "Review 0.3" opened the lesson (after the prerequisite warning) | Pass |
| L9 | Revision round | Asks finished lessons' checkpoints, records results | Asked the question, saved it as solved, "1 of 1 right first time" | Pass |
| L10 | After a revision round | Progress page updates | The just-solved topic stays in "Worth another look" until you leave and come back | **Fail (bug)** |
| L11 | Revision round button | Disabled until answered, "Finish" on the last | Correct from a clean start. If the round opens while another window is open or queued, the button is never disabled and keeps saying "Next question" | Fail (edge case) |
| L12 | Revision round content | Includes checkpoints you struggled with | Only lessons marked done; a failed checkpoint in an unfinished lesson isn't offered | Minor |
| L13 | Unfamiliar words | Explained where they appear | Not in lesson text (only the code editor explains commands) | Fail |
| L14 | Onboarding | Intro → what Arduino is → simulator → how lessons work → first LED | Name form, then straight into lesson 1 or the wiring guide. Nothing explains how the course is organised | **Fail** |

### Simulator (Free Practice)

| # | Feature | Expected | Actual | Result |
|---|---|---|---|---|
| S1 | Add a part | Appears on the breadboard | LED added, labelled "LED (unwired)", status bar explains the next step | Pass |
| S2 | Wire it | Click leg, click pin | LED + → pin 13 and LED − → GND, label became "LED (pin 13)" | Pass |
| S3 | Wire feedback | Confirms the wire | Status bar still said "Click one of its legs" after both wires were made | Minor |
| S4 | Check Circuit | Accurate | Flagged the missing resistor as a real-board problem ("burns out… put a 220Ω resistor"), confirmed "pin 13 → LED → GND" | Pass |
| S5 | Check Circuit's review link | Points at the concept | Missing resistor → "Making an LED Blink" instead of "LEDs and Resistors". Short circuit → "Voltage", but no lesson teaches short circuits. Negative delay → "loop() in Depth" instead of "delay()" | **Fail** |
| S6 | Run | Blink at the right speed, print | LED HIGH/LOW every 500 ms (sampled every 250 ms), pin badge shown, Serial printed | Pass |
| S7 | Timing accuracy | `millis()` after `delay(500)` twice = +1000, as on a Uno | Printed 0, 1018, 2043 - each late timer adds permanent drift. (The pane was in the background, which makes timers later; the code confirms any lateness accumulates) | **Fail (bug)** |
| S8 | Stop | Powers down, nothing more runs | Badges gone, no more output, Run re-enabled | Pass |
| S9 | Reset Code | Asks, then empties the editor, keeps the circuit | Exactly that | Pass |
| S10 | Remove a wire | Click it | Removed | Pass |
| S11 | Move a part | Drag it | LED moved, its wire followed | Pass |
| S12 | Delete a part | × removes it and its wires | Removed, wires removed. No confirmation or undo | Pass (no undo) |
| S13 | Keyboard / screen reader | Parts and pins reachable | Pins are unnamed `<circle>`s with click handlers only - wiring needs a mouse or touch | Fail (accessibility, known limit) |
| S14 | Inputs (button, sensors) | Respond | Not hand-tested this round; covered by the automated suite (button, pull-ups, LDR, ultrasonic, IR) | Not tested by hand |

### Code editor and errors

| # | Input | Expected | Actual | Result |
|---|---|---|---|---|
| E1 | Missing `;` | Line, cause, hint | "SYNTAX ERROR · LINE 2 · Missing ';'", line highlighted, hint ladder | Pass |
| E2 | `digitalWrit` | Spelling help | "not declared… Did you mean 'digitalWrite'?" | Pass |
| E3 | `pinmode` | Case help | "Did you mean 'pinMode'?" | Pass |
| E4 | Missing `}` | Points at it | "setup() (started on line 1) is never closed before loop() begins" | Pass |
| E5 | `attachInterrupt` | Labelled unsupported, not "your mistake" | "NOT SUPPORTED IN THIS SIMULATOR… may well be valid Arduino code" | Pass |
| E6 | Divide by zero | Runtime error, explained | Stopped at line 4 with an explanation and what a real Uno would do | Pass |
| E7 | No `loop()` | Explained | "Every sketch needs both a setup() and a loop()" with an example | Pass |
| E8 | Syntax colours, command help | Work | Highlighting works; the help line explains the command under the cursor | Pass |

### Responsive design

| # | Check | Result |
|---|---|---|
| R1 | Horizontal page scroll (Learn, Projects, Practice, Progress at 375, 768, 1024px) | None - Pass |
| R2 | Clipped text | Progress page's "0.2 What is a Microcontroller?" heading runs out of its card at 375px - Fail |
| R3 | Phone Learn page | Readable, but the "Up next" card is below the first screen - Fail (priority) |
| R4 | Simulator on a phone | Board drawn at 33%: pin targets 10px, breadboard holes 3px (comfortable touch is about 24px+) - **Fail** |
| R5 | Tablet (768px) | Fine apart from icon-only tabs (N4) |
| R6 | Lesson sidebar from the keyboard | Lesson links are `<div>`s with no tabindex - Fail |

## Stage 2 - curriculum, lesson structure and navigation

The curriculum already follows the brief's shape. Two deliberate differences, kept:

- **Programming Fundamentals (Module 3) comes before Digital Inputs (Module 4).** Reading a button is
  only useful with `if`, and counting presses needs variables - so the programming comes first, and
  every input lesson can use it.
- **The Serial Monitor is taught in Module 2, not with sensors.** Printing values is how beginners
  see what their code is doing; they need it from the first program.

Module 6 teaches the light sensor, temperature sensor, ultrasonic, IR, buzzer and servo - all simulated.
The projects module has the traffic light, distance warning and a "plan your own" project; the
automatic night light is Module 6's "Automation with a Light Sensor", and the Projects tab has the
reaction timer and security alarm.

Lesson structure (every lesson, in this order; a part only appears when the lesson really has it):
what you'll learn → what you should already know → explanation → visual demo → worked example →
guided activity → prediction → experiment → common mistakes → independent challenge →
knowledge checkpoint → **summary** (new) → what's next.

Navigation: Learn (the start point) · Projects · Practice · Progress, with the logo returning to
the home screen (new).

## Stage 3 - priorities

**Critical bugs** - L6 checkpoint retry · S7 timing drift · L10 stale revision list · S5 wrong
review links · N5 no way home · L11 revision button edge case.

**High-priority educational** - L14 onboarding tour · L3 summary section, and the text-only lessons
in Module 2 and 4 (the first program and first input) rebuilt to the template · L4 checkpoints for
those lessons · L13 explanations of unfamiliar words in lesson text · short circuits taught in the
GND lesson · Free Practice pointing beginners back to the course.

**Usability** - N4 tab labels · R4 simulator on phones · R3 "Up next" first on phones · R2 clipping ·
R6 keyboard access to the lesson list · L12 revision round includes struggled checkpoints.

**Later** - rebuilding the remaining text-only lessons in Modules 5, 6 and 8 to the template ·
checkpoints for every lesson · undo for deleting parts · keyboard wiring (S13) · guided and
independent project modes · projects grouped by difficulty once there are enough of them.

## Stage 5 - retest after the fixes

Retested on the local copy of the fixed site (same browser, empty save) on 31 October 2026, plus the
automated suite: **255 tests, 255 passed, 0 failed** (`npm test`; 16 new tests).

| # | Was | Retest | Result |
|---|---|---|---|
| L6 | No retry after a wrong checkpoint | Wrong line clicked → "Try again" → a fresh question (heading kept) → right answer saved as solved; "What's next" stopped asking for the checkpoint | Fixed |
| S7 | `millis()` drifted 0, 1018, 2043 | Same sketch, same background pane: 0, 1001, 2001, 3002, 4003. New test with every timer 18 ms late prints exactly 0, 1000, 2000, 3000 (it failed without the fix). The remaining ~1 ms a second is the time the simulator takes to run the statements themselves - about 0.1%, closer than a real Uno's own clock (±0.5%) | Fixed |
| L10 | Stale revision list after a round | After the round, "Worth another look" refreshed to "Nothing flagged right now" | Fixed |
| L11 | Round button never disabled when queued | Button opens disabled, enables after the answer, reads "Finish" then "Done" - and is now set up only once the window is really on screen | Fixed |
| L12 | Missed checkpoints in unfinished lessons left out of rounds | A checkpoint missed in unfinished lesson 2.2 came first in the round | Fixed |
| S5 | Wrong review links | Missing resistor → "LEDs and Resistors"; backwards LED → "Polarity"; short circuit → "Ground (GND)", which now teaches short circuits; negative delay → "delay()" | Fixed (tests updated) |
| N5 | No way home | The logo is a button: stops any sketch, shows the home screen; Continue goes back in | Fixed |
| N4 | Icon-only tabs below 1280px | Labelled at 1024px (own row) and 375px (icon above label, 84×43 each, nothing clipped) | Fixed |
| R2 | Clipped heading | No clipped headings or buttons at 375px | Fixed |
| R3 | "Up next" below the fold on phones | First card on the Learn page at 375px | Fixed |
| R4 | Board unusable on phones | Board keeps 640px in a sideways-scrolling box with a hint; pins 24px (were 10px), holes 7.6px (were 3px); the page itself doesn't scroll sideways | Improved |
| R6 | Sidebar not keyboard-reachable | `tabindex=0`, `role=button`, Enter opens the lesson, the current lesson has `aria-current` | Fixed |
| New | Touch: parts couldn't be dragged, sliders moved or buttons held with a finger (mouse events only - found while retesting) | All 14 press handlers use pointer events with `touch-action: none` on those parts only. A real mouse drag still moves a part; a synthetic touch-type pointer hold on a button read 1, release read 0. **Not tried on a physical touchscreen** | Fixed (synthetic test) |
| New | Warning text "This this if uses '='" | Now "The condition of this if uses '='" | Fixed |
| L14 | No onboarding | New player → one Start button → five-screen tour (Arduino Tutor, what an Arduino is, the simulator, the course, first LED) over the Learn page; "Build my first LED circuit" opened the guided build; the tour is saved as seen and reopens from Learn → "How this course works" | Added |
| L3 | No summaries; text-only lessons | All 60 lessons now end with a numbered Summary (key points where written, plus a "you should now be able to" self-check). setup(), loop(), pinMode(), digitalWrite() and digitalRead() rebuilt with a worked example, guided activity, prediction, experiment, common mistakes and key points; the two-LED and button circuits load and behave as the lessons predict (pin 12 HIGH / 13 LOW; button 0 → 1 → 0) | Added |
| L4 | Checkpoints | 30 of 60 lessons (3 new: setup(), loop(), digitalRead()) | Improved |
| L13 | Unfamiliar words | 24 terms explained on first use, with a link to the lesson that teaches each; 142 marked across the course; opening one shows the definition below the paragraph | Added |
| - | Free Practice for beginners | Until Module 0 is done, a note points to the course (hidden while the guided build is running) | Added |
| - | Every lesson opens cleanly | All 60 lessons opened in turn: right title, a summary each, no console errors | Pass |

### Still open

- 33 of 60 lessons still have no demo, worked example, guided activity, prediction or experiment
  (Module 6: 10, Module 5: 5, Modules 2 and 4: 4 each, Modules 0 and 3: 3 each, Modules 7 and 8: 2 each).
  Many of them do have a checked challenge; they follow the template's order and end with a summary.
- 30 lessons have no knowledge checkpoint.
- Wiring needs a mouse or a touchscreen; there's no keyboard way to wire (S13).
- No undo after deleting a part (S12); the status bar can show the previous screen's message (S3).
- Touch interaction was tested with synthetic pointer events, not on a physical phone or tablet.
- The boot splash still plays on every visit (skippable with any key).
