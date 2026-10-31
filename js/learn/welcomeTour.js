// The welcome tour: five short screens for someone who has never seen an
// Arduino - what Arduino Tutor is, what an Arduino is, how the simulator
// works, how the course is organised - ending with the first guided LED
// build. It opens once for a new player, and from the Learn page's "How this
// course works" any time after.
//
// Like the other view modules it only renders and reports back: the last
// screen's buttons call onFirstCircuit / onStartCourse.

import { openModal } from "../game/modal.js";
import { icon } from "../game/sprites.js";
import { MODULES } from "../lessons/curriculum.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const list = (items) => {
  const ul = el("ul", "tour-list");
  for (const text of items) ul.appendChild(el("li", null, text));
  return ul;
};

const STEPS = [
  {
    sprite: "chip",
    title: "Welcome to Arduino Tutor",
    build: () => [
      el("p", null, "A course for complete beginners. Step by step, you'll learn how electronic circuits work, how to write Arduino code, and how to put the two together - until you can build projects of your own."),
      el("p", null, "No hardware needed: there's a virtual Arduino on the page. Here's how it all works - it takes a minute."),
    ],
  },
  {
    sprite: "bulb",
    title: "What is an Arduino?",
    build: () => [
      el("p", null, "A small circuit board with a tiny computer on it, called a microcontroller. You write a short program, send it to the board, and the board runs it - on its own, over and over."),
      list([
        "It can sense things - a button press, how bright it is, how far away a wall is.",
        "Your code decides what to do about it.",
        "Then it acts - lights an LED, sounds a buzzer, turns a motor.",
      ]),
      el("p", null, "Night lights, parking sensors, robots and weather stations are all built this way."),
    ],
  },
  {
    sprite: "monitor",
    title: "How the simulator works",
    build: () => [
      list([
        "Write your program in the code editor.",
        "Build the circuit: add parts, then click a leg and a pin to wire them together.",
        "Press Run. The virtual board runs your code for real - LEDs light, and messages appear in the Serial Monitor.",
        "Made a mistake? The simulator says what went wrong, why, and which lesson explains it. Check Circuit explains the wiring.",
      ]),
      el("p", "tour-note", "It's honest about its limits: anything it can't simulate is labelled as such, never faked."),
    ],
  },
  {
    sprite: "book",
    title: "How the course is organised",
    build: () => {
      const modules = el("ol", "tour-modules");
      modules.start = 0;
      for (const m of MODULES) modules.appendChild(el("li", null, m.title));
      return [
        el("p", null, `${MODULES.length} modules, in order - each lesson builds on the ones before it:`),
        modules,
        el("p", null, "Every lesson follows the same order: an explanation first, then - where the lesson has them - something to see, an example, something to try, a challenge you check and a short quiz, and a summary to finish."),
        list([
          "Learn - the course. Your next lesson is always marked ▶.",
          "Progress - what you've learned, and what's worth revising.",
          "Projects and Practice - bigger builds, and free play once you know the basics.",
        ]),
      ];
    },
  },
  {
    sprite: "led",
    title: "Your first LED",
    last: true,
    build: () => [
      el("p", null, "Ready for a first win? The guided first circuit takes about ten minutes: you'll wire an LED to the board and make it blink, with every step explained as you go."),
      el("p", "tour-note", "Don't worry if it doesn't all make sense yet - the course explains every piece properly afterwards."),
    ],
  },
];

export function openWelcomeTour({ firstCircuitDone = false, onFirstCircuit, onStartCourse, onClose } = {}) {
  let step = 0;
  const body = el("div", "tour");
  let choice = null;

  const show = () => {
    const s = STEPS[step];
    body.innerHTML = "";
    const head = el("div", "tour-head");
    const ico = el("span", "tour-icon");
    ico.innerHTML = icon(s.sprite, 3);
    head.append(ico, el("h2", "tour-title", s.title));
    body.appendChild(head);
    for (const node of s.build()) body.appendChild(node);

    const nav = el("div", "tour-nav");
    nav.appendChild(el("span", "tour-count", `${step + 1} of ${STEPS.length}`));
    const buttons = el("div", "tour-buttons");
    if (step > 0) {
      const back = el("button", "btn btn-secondary", "Back");
      back.type = "button";
      back.addEventListener("click", () => { step--; show(); });
      buttons.appendChild(back);
    }
    if (!s.last) {
      const next = el("button", "btn btn-primary", "Next");
      next.type = "button";
      next.addEventListener("click", () => { step++; show(); });
      buttons.appendChild(next);
    } else {
      const course = el("button", firstCircuitDone ? "btn btn-complete" : "btn btn-secondary", "Start the course");
      course.type = "button";
      course.addEventListener("click", () => { choice = "course"; handle.close(); });
      if (!firstCircuitDone) {
        const build = el("button", "btn btn-complete", "Build my first LED circuit");
        build.type = "button";
        build.addEventListener("click", () => { choice = "first-circuit"; handle.close(); });
        buttons.append(course, build);
      } else {
        buttons.appendChild(course);
      }
    }
    nav.appendChild(buttons);
    body.appendChild(nav);
    buttons.lastElementChild?.focus({ preventScroll: true });
  };

  const handle = openModal({
    title: "WELCOME",
    content: body,
    className: "modal-wide",
    onOpen: () => show(),
    onClose: () => {
      onClose?.();
      if (choice === "first-circuit") onFirstCircuit?.();
      else if (choice === "course") onStartCourse?.();
    },
  });
  return handle;
}
