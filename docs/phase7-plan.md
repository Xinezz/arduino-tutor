# Phase 7 – Engineering portfolio and assessment: audit and plan

## 1. Audit

| System | What it records today | What the portfolio needs |
|---|---|---|
| Saved progress (`progress.js`, key `arduinoTutorProgress`) | Lessons, checkpoints per question, checks, projects `{ stagesDone, completed: { mode: { hints } }, checks, log }`, pathways, goals, history | Stays as it is – it's the *evidence* the portfolio links to |
| Project library (Phase 4 beginner projects, Phase 6 pathway projects) | Title, summary, problem, components with purposes, concepts, requirements, checks | Pre-fills documentation – nothing typed twice |
| Project builder | Runs the learner's code and reads their circuit, but **when a project is completed, the code and circuit are NOT saved** – only the mode and hint count | Capture the actual code, circuit and check results at completion |
| Board (`board.js`) | `loadCircuit(spec)`, but **no way to export a circuit** | `exportCircuit()`, so a circuit can be saved and redrawn |
| Project log | `plan`, `problems`, `improvements`, `decisions` text per project | Feeds the documentation sections it already answers |
| Older staged projects (`projects/data.js`) | Self-ticked stages only – no checks | Not auto-added: there is no verified evidence. A learner can still make their own record |
| Save export (`exportSaveCode`) | Progress only, as text | Portfolio needs its own export/import file |
| Hosting | GitHub Pages: static, no backend, no accounts | Everything stays private in this browser; nothing can be published |

## 2. Plan

**Storage.** The portfolio goes in its own `localStorage` key (`arduinoTutorPortfolio`), separate from progress, so a large portfolio can never corrupt progress. Every field is validated on load. Its size is shown, with a warning near the browser's limit.

Not stored, by design:
- **Images.** Uploads would quickly fill `localStorage`. Instead, the *circuit itself* is saved as a small parts-and-wires description and redrawn on a read-only board.

**Export and import:** a JSON file.
- Import never overwrites. A clash is kept as a separate, renamed copy.

**Stage 2 – Portfolio.**
- A **Portfolio** tab: the learner's project records by category, with "ready to document" completed projects.
- A project page shows:
  - the evidence: completion date, mode, hints, and the check results from the run that passed;
  - the circuit, redrawn;
  - the code, components and concepts;
  - the documentation.

**Stage 3 – Documentation.**
- Sections A–I with guiding prompts, saved as you type (drafts).
- **How much is required depends on difficulty:**
  - Beginner: overview, components, testing, reflection.
  - Intermediate: also requirements, circuit, programming, problems.
  - Advanced / design: all nine.
- Pre-filled where the library and the project log already know the answer.
- **Templates** set the category and the prompts:
  - Basic Arduino Project, Electronics Circuit Design, Robotics Project;
  - Sensor Monitoring System, Automation Project, IoT Prototype;
  - Engineering Design Challenge.
- A **printable report**.

**Stage 4 – Versions.**
- Every completion, and every improvement that passes its check, is saved as a new version.
- The learner can also save a version from their Free Practice work.
- Versions are snapshots that are never overwritten. Any two can be compared: a line-by-line code diff plus the documentation sections that changed. Any version can be loaded back into Free Practice.

**Later stages, after this foundation:**
- Assessment rubrics and practical assessments.
- The Showcase: kept private and local, because there is no backend to publish safely.
- Certificates, the journal, and analytics.

## 3. Status: Stages 1-4 built

**Built:**
- Circuit export (`board.exportCircuit`).
- The portfolio store, under its own key: validated, size-aware, with backup and restore.
- Capture on completion (code, circuit, check results), and passing improvements saved as versions.
- The Portfolio tab: home, records, the documentation editor with drafts and templates, required sections by difficulty, versions, comparison, and a printable report.

**Automated tests:** `tests/portfolio.test.js` (13 tests); the full suite is 341 of 341 passing.

**Tested in the browser:**
- An existing save with a project completed before the portfolio → "Ready to document" → the record was added.
- A draft typed, saved, and still there after a reload.
- A circuit loaded into Free Practice from a saved version, then the project completed in Independent mode → the record was upgraded to checked evidence with the real code, circuit and 7 check results.
- "Document it" from the completion screen.
- A second version saved and compared.
- The redrawn circuit.
- Phone width: six tabs fit, no overflow.

**Not tested in the browser:**
- The backup download and file restore (a browser file picker can't be driven by the test tools). Export and import are covered by the automated tests.
- Printing.

**Next stages:**
- Assessment rubrics and practical assessments.
- The private Showcase.
- Certificates with local references.
- The journal.
- Portfolio analytics on the dashboard.
