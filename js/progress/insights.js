// Feedback in words - built only from what's been tracked, never invented.
// Two uses:
//   overview()     - the dashboard's three questions: what have I learned,
//                    what am I finding hard, what next.
//   feedbackFor()  - the short "what this shows" note after a checkpoint, a
//                    challenge check or a project.
// Every sentence names the evidence it comes from (numbers, the question,
// the mistake); when there isn't enough evidence yet, it says so.

import { lessons } from "../lessons/data.js";
import { itemByKey } from "./questionBank.js";
import { areasOfLesson, LEVELS, levelIndex } from "./skills.js";

const lessonById = new Map(lessons.map((l) => [l.id, l]));
const levelLabel = (id) => LEVELS.find((l) => l.id === id)?.label ?? id;

function areaLine(a) {
  const e = a.evidence;
  const bits = [`${e.lessonsDone} of ${e.lessonsTotal} lessons`];
  if (e.answered) bits.push(`${e.understood} of ${e.answered} answered question${e.answered === 1 ? "" : "s"} understood`);
  if (e.practicalsPassed) bits.push(`${e.practicalsPassed} practical${e.practicalsPassed === 1 ? "" : "s"} passed${e.independent ? ` (${e.independent} with no hints)` : ""}`);
  if (e.selfFixed) bits.push(`${e.selfFixed} challenge${e.selfFixed === 1 ? "" : "s"} fixed yourself after a failed check`);
  return bits.join(", ");
}

// { learned: [{ area, text }], struggling: [{ area, text, lessonId }], started }
export function overview(report) {
  const learned = report
    .filter((a) => a.levelIndex >= levelIndex("developing"))
    .sort((x, y) => y.levelIndex - x.levelIndex)
    .map((a) => ({ area: a, text: `${levelLabel(a.level)}: ${areaLine(a)}.` }));
  const struggling = report
    .filter((a) => a.weak.some((w) => w.severity >= 2))
    .map((a) => ({ area: a, text: a.weak[0].text + ".", lessonId: a.weak[0].lessonId, count: a.weak.filter((w) => w.severity >= 2).length }))
    .sort((x, y) => y.count - x.count);
  const started = report.some((a) => a.level !== "not-started");
  return { learned, struggling, started };
}

// lines: [{ kind: "good"|"work"|"improved"|"area"|"next", text }]
//   context: { lessonId, answers?: [[key, right]], challenge?: { passed, title, independent, attempts } }
export function feedbackFor(progress, report, context, recs = []) {
  const lines = [];
  const lesson = lessonById.get(context.lessonId);
  if (context.answers?.length) {
    const right = context.answers.filter(([, r]) => r).length;
    lines.push({ kind: right === context.answers.length ? "good" : "work",
      text: `${right} of ${context.answers.length} right first time.` });
    // a question missed before and right now, after a gap: it has stuck
    for (const [key, r] of context.answers) {
      const a = progress.answers?.[key];
      if (r && a && !a.first && a.box >= 2) {
        lines.push({ kind: "improved", text: `"${(itemByKey(key)?.question?.q ?? "A question").slice(0, 70)}…" - you missed this one before and got it right after a gap. That's it sticking.` });
        break;
      }
    }
    const missed = context.answers.filter(([, r]) => !r).map(([k]) => itemByKey(k)).filter(Boolean);
    if (missed.length) lines.push({ kind: "work", text: `${missed.length === 1 ? "The one you missed goes" : "The ones you missed go"} on your revision list - you'll get ${missed.length === 1 ? "it" : "them"} again tomorrow with a recap, and a new question to check.` });
  }
  if (context.challenge) {
    const c = context.challenge;
    if (c.passed) {
      lines.push({ kind: "good", text: c.independent
        ? `"${c.title}" passed with no hints${c.attempts > 1 ? `, after ${c.attempts - 1} failed check${c.attempts > 2 ? "s" : ""} you fixed yourself` : ""} - real evidence you can do this on your own.`
        : `"${c.title}" passed. It needed some hints, so it counts as practised - solve the next one without them to show it's yours.` });
    } else if (c.attempts >= 2) {
      lines.push({ kind: "work", text: `This is check ${c.attempts} on "${c.title}". Read the first ✖ line above carefully - it's the one to fix first.` });
    }
  }
  // where this lesson's skill areas stand now
  for (const ref of lesson ? areasOfLesson(lesson) : []) {
    const a = report.find((x) => x.id === ref.id);
    if (!a) continue;
    lines.push({ kind: "area", text: `${a.name}: ${levelLabel(a.level)} - ${areaLine(a)}.${a.toNext[0] ? ` Next level needs: ${a.toNext[0].text.charAt(0).toLowerCase() + a.toNext[0].text.slice(1)}.` : ""}` });
    const otherWeak = a.weak.find((w) => w.severity >= 2 && w.lessonId !== context.lessonId);
    if (otherWeak) lines.push({ kind: "work", text: `Still to work on in this area: ${otherWeak.text.charAt(0).toLowerCase() + otherWeak.text.slice(1)}.` });
  }
  if (recs[0]) lines.push({ kind: "next", text: `Suggested next: ${recs[0].title} - ${recs[0].why}` });
  return lines;
}

