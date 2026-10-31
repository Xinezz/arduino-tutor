// Every question the learner profile tracks, each with a stable key, the
// lesson it belongs to, and what's needed to show it again in revision:
//   "<quizId>#<i>"      - question i of a checkpoint set ("questions" type)
//   "<quizId>#0"        - a one-piece checkpoint (order, predict, debug, fill, match)
//   "<lessonId>#q<n>"   - the n-th "question" block in a lesson's text
// Keys depend on content order, so a question added in the middle of a set
// can shift later keys - an answer whose key no longer exists is simply
// ignored (see itemByKey), never shown against the wrong question.

import { lessons } from "../lessons/data.js";
import { quizzes } from "../quiz/data.js";

function build() {
  const items = [];
  for (const lesson of lessons) {
    const quiz = quizzes[lesson.id];
    if (quiz?.type === "questions") {
      quiz.questions.forEach((question, i) => items.push({
        key: `${quiz.id}#${i}`, lessonId: lesson.id, quizId: quiz.id, topic: quiz.topic, question,
      }));
    } else if (quiz) {
      items.push({ key: `${quiz.id}#0`, lessonId: lesson.id, quizId: quiz.id, topic: quiz.topic, quiz });
    }
    let n = 0;
    for (const block of lesson.body) {
      if (block.type !== "question") continue;
      n += 1;
      items.push({
        key: `${lesson.id}#q${n}`, lessonId: lesson.id, topic: lesson.title,
        question: {
          q: block.question, code: block.code, options: block.options, answer: block.answer,
          why: block.options.map((_, i) => block.why?.[i] || (i === block.answer ? block.explain : "Not this one.")),
        },
      });
    }
  }
  return items;
}

export const QUESTION_BANK = build();
const byKey = new Map(QUESTION_BANK.map((item) => [item.key, item]));
export const itemByKey = (key) => byKey.get(key) ?? null;
export const itemsForLesson = (lessonId) => QUESTION_BANK.filter((item) => item.lessonId === lessonId);

// A quiz that shows just this one item again: a single question as a
// one-question set (answers reported under its own key), or the whole
// one-piece checkpoint.
export function revisionQuiz(item) {
  if (item.quiz) return item.quiz;
  return { id: item.quizId ?? item.key, type: "questions", title: "Revision question", topic: item.topic, questions: [item.question], keys: [item.key] };
}
