# Phase 5 – Personalised learning: audit and plan

## 1. What already exists (audit)

| System | Where | What it records / does | Useful for personalisation? |
|---|---|---|---|
| Curriculum | `js/lessons/curriculum.js` | 9 modules, 63 lessons, each tagged with fine-grained `skills` (51 of them), `needs` (prerequisites) and `objectives` | Yes – the map from every activity to a skill |
| Saved progress | `js/progress/progress.js` | One JSON object in `localStorage["arduinoTutorProgress"]`; `normalize()` upgrades old saves field by field; corrupt JSON falls back to a fresh save | Yes – extend it, don't replace it |
| Quizzes / checkpoints | `js/quiz/data.js`, `quiz.js` | 39 checkpoints (6 types, 61 questions). Only the **set** is recorded: `quizzes[id] = {attempts, solved, lastResult, topic}`. Which *question* was missed is lost | Partly – needs per-question results |
| In-lesson questions | `js/lessons/render.js` | `predict` blocks record the first answer (`predictions`); the 8 `question` blocks record **nothing** | Partly |
| Challenges | `js/lessons/checks.js`, `challenge.js` | 28 checked challenges: `checks[id] = {attempts, passed, independent}`; `hintUses[id]`; difficulty easy/medium/hard/boss | Yes – real evidence of practical skill |
| Projects | `js/projects/*` | 3 checked beginner projects: completion per mode (guided/challenge/independent) with hints | Yes |
| Simulator errors | `js/simulator/feedback.js` | Every error/warning is explained and mapped to the lesson that teaches it – but **never saved** | Yes – the source for "repeated mistakes" |
| Circuit check | `board.inspectCircuit()` + `conceptForFinding()` | Findings mapped to lessons – never saved | Yes |
| Skill report | `js/progress/learning.js` | Per fine skill: not started → learning → learned → practised → mastered. "Learned" comes from lesson completion alone | Replace with evidence-based mastery |
| Revision | `progressView.js` | "Worth another look" list + a 3-question revision round (wrong checkpoint sets first) | Extend: per question, spaced |
| Achievements | `js/game/achievements.js` | 50 trophies, mostly counters (lessons, runs, coins) | Add a few for real learning |
| Mentor | `js/npc/mentor.js` | Sam: canned greeting / reaction lines only | Can host the tutor |
| Explanations | `editor/glossary.js` (commands), `lessons/terms.js` (terms), lesson text | Beginner-worded definitions linked to lessons | Yes – the tutor's knowledge |
| AI integration | – | **None.** No API, no backend; the site is static on GitHub Pages | The tutor will be rule-based |

## 2. Missing tracking information

1. Per-question answers (first try right? corrected later? when?).
2. Answers to in-lesson "question" blocks.
3. Repeated mistakes: run errors, warnings and circuit faults, by kind.
4. Project check failures.
5. A learning history (what was done, when).
6. Goals.
7. A revision schedule.

## 3. Plan

All of it is static JavaScript and `localStorage`: no accounts, no server, no API keys.

**Stage 2 – Learner profile** (`js/progress/skills.js`)
- 10 skill areas from the brief, each a group of the existing fine skills.
- Each area has the five levels (Not started, Learning, Developing, Proficient, Mastered). A level is reached only when its listed criteria are all met. The criteria combine lessons, first-try question accuracy, checked practical work, independence (no hints) and repeated mistakes. Lesson completion alone never gets past Learning.
- New saved fields:
  - `answers`: per question.
  - `mistakes`: kind, lesson, timestamps.
  - `activity`: the last 80 events.
  - `goals`
  - `revisionLog`
- All new fields are validated on load.

**Stage 3 – Dashboard:** the Progress page answers the three questions (learned / struggling / next), then shows:
- the skill areas, each with its criteria checklist;
- revision, goals and challenges;
- recent activity and achievements.

The rewards section stays below it.

**Stage 4 – Recommendations and revision**
- **Recommendations** (`js/progress/recommend.js`): ordered rules, each with its evidence sentence ("why").
- **Spaced revision** (`js/progress/revision.js`): per question, Leitner-style. A miss is due the next day, then again after 3 days, then 7 days, then it counts as secure.
- **Revision sessions:**
  1. A recap of the idea.
  2. The missed question.
  3. A *different* question on the same idea, to check it was understood rather than remembered.

**Stage 5 – Tutor** (`js/tutor/`)
- A rule-based "Ask Sam" built from curated explanations plus the glossary and terms.
- Answers come in steps: a guiding question first, then hints, then the answer.
- Troubleshooting reads the learner's real circuit and code (circuit check, simulator warnings, the last error).
- It says plainly that it is not an AI model.

**Stage 6 – Adaptive challenges:** activities are sorted into Levels 1–4. Each skill area's level picks the next one, with the reason. Struggling at a level steps back down rather than up.

**Stage 7 – Goals and milestones:**
- Goal templates that can really be completed with today's content, with tracked progress.
- A few achievements for actual learning: first skill area proficient, a corrected question that stuck, a goal reached, and a project in independent mode.

**Stage 8 – Testing:**
- Unit tests for mastery, recommendations, scheduling, goals, the tutor and save normalisation.
- In the browser: a brand-new profile and an existing profile, on desktop and mobile.

## 4. Status (all stages built)

**Automated tests:** `tests/learner.test.js` (23 tests); the full suite is 304 of 304 passing. The tests cover:
- level rules;
- the spaced-review schedule, day by day;
- session building;
- every recommendation rule;
- challenge step-down;
- goals;
- old and corrupted saves;
- mistake naming;
- feedback;
- the tutor's answers;
- LED troubleshooting on real simulated boards (right pin, wrong pin, no pinMode, too-short flash, backwards LED, no LED, code error).

**Tested in the browser:**
- A brand-new profile:
  - empty states;
  - a checkpoint with one miss, saved per question;
  - the feedback note;
  - a day fast-forwarded by editing the saved date, then a revision session run through;
  - a goal set;
  - the history and trophies.
- An old-format save: nothing lost.
- The tutor: concept answers step by step, and the last real error read from Free Practice.
- The challenge-check feedback, the project builder, and the T shortcut.
- Phone width: no sideways scroll after two fixes.

**Known limitations:**
- Sensors (no checkpoint questions) and analog (one) rest mostly on practical work until content batches 2–4 add questions.
- Electronics has no checked practical work, so its levels rest on questions.
- The guided circuit activities in Module 1 aren't recorded.
- Old saves only knew whole checkpoint sets, so a set that was solved only after retries comes back once for review.
- The tutor only understands questions that use the course's own words.
- The LED troubleshooter looks at the first 3 simulated seconds, with buttons released.
