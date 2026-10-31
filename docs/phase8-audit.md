# Phase 8 – Platform audit, fixes so far, and plan

All statements here come from checks actually run in this phase. The test types are:
- **(auto)**: the Node test suite.
- **(browser)**: scripted clicks and key presses in the built-in Chromium browser pane, at desktop size and a 375 × 812 phone size.
- **(review)**: reading the code or content.

There has been **no testing with real learners**; section 6 is the protocol for that.

## 1. Feature status (verified, not assumed)

### Working correctly
| Feature | Evidence |
|---|---|
| Course: 9 modules, 63 lessons, 39 checkpoints | (auto) curriculum tests; (browser) first lesson, checkpoint, "Mark as done" |
| Lesson code examples | (auto, new sweep) all 64 complete sketches run; the only 2 that fail are deliberately broken "find the bug" exercises |
| Simulator and interpreter | (auto) 124 simulator and interpreter tests in 9 files; (new probes) an infinite `loop()` doesn't freeze the page, runaway recursion is caught, int overflow warns, integer division is correct, a missing pin is explained |
| Challenge checks (28) and project checks (7) | (auto) reference solutions pass, alternative solutions pass, mistakes fail with the right message |
| Learner profile, recommendations, spaced revision, goals | (auto) 23 tests; (browser, Phase 5) checkpoint → revision next day → session |
| Ask Sam (rule-based tutor) | (auto) answers the brief's questions; reads the real board and error |
| Electronics pathway (9 lessons, 4 projects, certificate) | (auto) 24 tests, including formulas checked against the lessons' own answers |
| Portfolio: capture, drafts, versions, compare, backup | (auto) 13 tests; (browser, Phase 7) completion captured with real code and circuit |
| Saving and restoring progress | (browser) returning learner: progress kept; Continue opens the right lesson; recommendations match |
| Onboarding tour | (browser) 5 short pages, can go back, ends with "first LED" or "start the course" |
| Screen labels | (browser) automated scan of all 6 tabs, menu and title screen: no unnamed buttons, unlabelled fields, unlabelled images or duplicate IDs (after the fix below) |
| Phone layout | (browser) 375 px: no sideways scroll on any tab; no button smaller than 24 px |
| GitHub Pages | (auto, new) import case matches the files exactly, relative paths only, known hosts only, no secrets |

### Working but needs improvement
| Issue | Severity | Proposal |
|---|---|---|
| **Circuit board: keyboard and screen-reader access.** Wiring needs a pointer, and the board has no ARIA. | High (accessibility) | A "wiring list" panel: choose a part's leg and a pin or hole from lists, then Connect. It uses the board's existing `connect()`, and also gives screen-reader users a text view of the circuit. Needs your OK – it's a new control. |
| **Breadboard holes on phones:** 8 px touch targets, about 15 px apart (WCAG 2.2 asks 24 px). Pins are 24 px. | Medium | The same wiring list, plus a "zoom the board" control on small screens. |
| **Load time:** 2.6 s to DOMContentLoaded on the live site, from 86 modules discovered one import at a time. | Medium | **Done in this phase:** modulepreload list (below). Not measured live yet – it needs a deploy. |
| Learners can't type or paste their own tutor questions about a lesson | Low | – (works; just noting the tutor only matches course vocabulary) |
| Older self-ticked staged projects (Reaction Timer, Security Alarm) | Medium | Convert to checked steps like the library projects (Phase 4 follow-up) |
| Modules 3–8: fewer checkpoint questions than Modules 0–2 (sensors: none; analog: one) | Medium (education) | Content batches 2–4: questions per lesson, as Modules 0–2 have |

### Partially implemented
- **Engineering Pathways:** A (Electronics) is complete. B–E are listed as "not built yet" and can't be opened.
- **Phase 7:**
  - Portfolio, documentation and versions are built.
  - Not built: assessment rubrics, the Showcase, certificates beyond the pathway one, the journal, and portfolio analytics.

### Not implemented
- Assessment system (rubrics per difficulty, practical assessments)
- Engineering Showcase
- Subject certificates (Arduino Fundamentals and so on)
- Engineering journal
- The Phase 3 step-by-step debugger (it was waiting for your approval)

### Broken or unreliable (found and fixed in this phase)
| # | Problem | Impact | Fix | Verified |
|---|---|---|---|---|
| 1 | **A malformed save (for example, a non-text player name) crashed the title screen.** No start button appeared, so the learner was locked out of the whole site. | Critical | Every saved value is now type-checked on load (name, counters, daily missions, trophies, checks, quizzes, inventory...) | (browser) the same tampered save now starts; (auto) |
| 2 | **HTML injection through the player name.** The title screen built text with `innerHTML`, and a shared save code can set the name. | High (security) | Built as text; names capped at 40 characters | (browser) the payload is shown as text and doesn't run anywhere in the app; (review) all `innerHTML` uses checked |
| 3 | **An unreadable save was silently replaced** by a fresh one on the next save, destroying it. | High (data) | It's copied to a backup key first, and the learner is told what happened and where the copy is | (browser + auto) |
| 4 | **A failed save** (full or blocked storage) was silently ignored. | High (data) | A warning toast (announced to screen readers) plus a status message, once per problem; it clears when saving works again | (auto) |
| 5 | **The code editor was a keyboard trap** (Tab always indents), and its input had no label. | High (accessibility) | Escape then Tab / Shift+Tab leaves the editor; the input is labelled; listed in the shortcuts sheet | (browser, real key presses) |
| 6 | `#include <Wire.h>` gave "'Wire' was not declared – did you spell it correctly?" | Medium (misleading) | Unknown libraries are named as "not supported in this simulator" (Servo, LiquidCrystal and the standard headers still work) | (browser + auto) |
| 7 | Pocket Mono theme: 3 text colours below WCAG AA (3.8–4.4:1) | Medium | Adjusted to 5.2–5.3:1 while keeping its look | (auto: every theme is checked) |
| 8 | "A pin can safely supply about 20–40 mA" (DC motors lesson) contradicted the rest of the course | Medium (accuracy) | "About 20 mA (40 mA is the absolute maximum, where damage starts)" | (review) |
| 9 | "An LED has almost no resistance" – an over-simplification | Low (accuracy) | Explains that below about 2 V almost nothing flows, and above it current rises steeply | (review) |
| 10 | The welcome tour had no visible Skip and didn't mention Pathways, Progress revision, the Portfolio or Ask Sam | Medium (onboarding) | Skip button; one updated list | (browser) |
| 11 | The checkpoint message pointed to a "revision round" that no longer exists | Low | Points to revision on the Progress page | (review) |

## 2. Educational review

**What was reviewed:**
- Module 1 (electronics) in full: what electricity is, voltage, current, resistance and Ohm's law, open and closed circuits, ground, series and parallel, breadboards, LEDs, polarity.
- Every statement across the course about pin current limits, PWM pins, LED forward voltages, the ADC range and the direction of current.

**Verdict:** Module 1 is accurate, well sequenced, and honest about the simulator's limits.
- Voltage → current → resistance → complete circuits → ground → series and parallel → breadboards → LEDs, with each lesson building on the previous one.
- It explains conventional current against electron flow.
- Limits are consistent: 20 mA per pin, 40 mA maximum, about 200 mA in total.
- PWM pins are stated correctly as 3, 5, 6, 9, 10 and 11.
- "HIGH ≈ 5 V and LOW ≈ 0 V" is correct for an Uno.

Two wording problems were fixed (items 8 and 9 above).

**Not yet reviewed line by line:** Modules 2–8, about 48 lessons. The automated checks cover their code examples and checkpoint answers, but not the wording. This is the next educational task.

## 3. Technical

- **Performance:**
  - Live site, measured: 2.6 s to DOMContentLoaded, 89 requests, 723 KB transferred.
  - Added a generated `modulepreload` list (85 modules) so the browser fetches them in parallel. Locally it loads with no duplicate downloads and no errors; the live improvement can only be measured after a deploy.
  - CodeMirror and fonts come from cdnjs and Google Fonts.
- **Security:**
  - No backend, no API keys (automated test).
  - User text and imported saves are rendered as text (`textContent`). The one HTML injection point is fixed.
  - Portfolio imports are validated field by field.
  - Limitation: everything is local, so a learner can edit their own save. Certificates and portfolio evidence are trustworthy only within this browser, not as proof to others.
- **Browsers:** tested only in the built-in Chromium-based browser, which is Chrome/Edge-equivalent. **Firefox and Safari were not tested.** The code uses standard APIs: ES modules, `<details>`, `:has()` (in one CSS rule, with a harmless fallback), Blob downloads and `localStorage`.
- **Deployment:** static GitHub Pages, deployed by GitHub Actions after `npm test`. No server needed. Paths are relative and imports case-exact (both tested).

## 4. Prioritised plan for the remaining stages
1. **Accessibility:** the wiring-list panel for keyboard, screen-reader and phone users (needs your approval).
2. **Education:** line-by-line review of Modules 2–8; more checkpoint questions for Modules 3–8; convert the two self-checked projects.
3. **Cross-browser:** run the end-to-end scenarios in Firefox and Safari (needs those browsers – manual).
4. **Performance:** measure modulepreload on the live site after deploy.
5. **Phase 7 remainder:** assessment, certificates, journal (features – after the quality items).

## 5. End-to-end scenarios run in this phase
- **A – first-time beginner** (browser, fresh profile): title screen → name and avatar → welcome tour (5 pages) → course → lesson 0.1 → checkpoint (misses recorded per question) → Mark done (+10 credits) → Free Practice: blink sketch runs and prints, Stop resets the buttons → Progress shows tricky questions and the next step. **Passed.**
- **B – returning learner** (browser, reload): name kept, "Up next 0.2", Continue opens 0.2, lesson 0.1 still done, answers kept, recommendation "Next lesson 0.2". **Passed.**
- **C, D, E** – independent project, pathway, portfolio: run in Phases 5–7 on this codebase. Not re-run click-by-click in this phase; covered by the automated suites (351 tests).

## 6. Beginner usability test protocol (for real learners – not yet run)

**Participants:** 5 people with no electronics or programming experience. Five usually reveal most of the major problems.

**Setup:** a fresh browser profile, desktop or laptop, and a moderator who **does not help** unless the participant is stuck for 3 minutes. The participant thinks aloud; the moderator notes times and quotes.

| # | Task (said to the participant) | Success means | Watch for |
|---|---|---|---|
| 1 | "Find and start the first Arduino lesson." | Lesson 0.1 open, within 2 minutes | Splash/menu confusion; whether the tour helps or gets skipped |
| 2 | "Using the course, explain the difference between voltage and current." | A correct explanation in their own words | Where they look; whether the water analogy lands |
| 3 | "Build a circuit that lights an LED." | An LED lit in the simulator | Finding parts, wiring clicks, polarity, the missing resistor |
| 4 | "Change the blink so it's twice as fast." | Both delays halved, run | Finding the editor; understanding delay() |
| 5 | "This sketch has a mistake – fix it." (a missing `;`) | Runs without errors | Whether the error message and hints are understood |
| 6 | "Complete the Running Lights project." | All checks pass | Use of Guided mode and hints; time per step |
| 7 | "Find how much of the course you've done." | Progress tab, correct number | Whether "Progress" vs "Portfolio" is clear |
| 8 | "Write down what you built and what was hard." | A portfolio record with 2+ sections | Finding the portfolio; whether the prompts help |

**Record:** task success (yes / with help / no), time, errors, quotes, and a 1–5 confidence rating after each task. Finish with the System Usability Scale questionnaire.

**Afterwards:** list problems by frequency × severity, fix the top ones, and re-test with new participants.
