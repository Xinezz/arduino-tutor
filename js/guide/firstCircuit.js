// "Start your first circuit": a guided walkthrough for someone who has never
// touched an Arduino. It runs inside Free Practice, on the real editor and
// board, and follows what the learner actually does rather than just
// showing slides:
//
//   meet the parts -> add them -> wire them -> read the code -> predict, run,
//   explain -> change the timing -> break the circuit on purpose -> done
//
// Each concept is explained BEFORE the step that uses it, every check comes
// from the board itself (board.inspectCircuit / areConnected / ledLevels) -
// so the guide never claims something about the circuit the simulator can't
// actually see - and predictions are asked before running, with the "why"
// explained after watching what really happened.
//
// Like every other view module, this only renders and reports: app.js owns
// progress and decides what finishing it is worth (onFinish).

const BLINK_CODE = `void setup() {
  pinMode(13, OUTPUT);     // pin 13 will SEND power out
}

void loop() {
  digitalWrite(13, HIGH);  // switch pin 13 on (5 volts)
  delay(1000);             // wait 1000 ms = 1 second
  digitalWrite(13, LOW);   // switch pin 13 off (0 volts)
  delay(1000);             // wait another second
}
`;

const squash = (code) => code.replace(/\/\/.*$/gm, "").replace(/\s+/g, "");

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label, kind, onClick) {
  const b = el("button", `btn btn-${kind}`, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

export function createFirstCircuitGuide({ container, panel, targets = {}, onFinish, onExit, onStatus }) {
  const board = panel.board;
  const editor = panel.editor;
  let active = false;
  let stepIndex = 0;
  let unsubscribers = [];
  let poll = null;
  // what the current step has seen happen (reset on every step)
  let seen = {};

  // ---------- reading the board ----------

  const firstOf = (kind) => board.listComponents().find((c) => c.kind === kind)?.id ?? null;
  const resistors = () => board.listComponents().filter((c) => c.kind === "resistor").map((c) => c.id);
  const leds = () => board.listComponents().filter((c) => c.kind === "led").map((c) => c.id);

  // Which resistor leg (1 or 2) is wired straight to pin 13, for a resistor.
  function legOnPin13(r) {
    if (board.areConnected("pin-13", `${r}-1`, false)) return 1;
    if (board.areConnected("pin-13", `${r}-2`, false)) return 2;
    return null;
  }

  function wiringChecklist() {
    const pinToResistor = resistors().some((r) => legOnPin13(r) !== null);
    const resistorToLed = resistors().some((r) => {
      const leg = legOnPin13(r);
      return leg !== null && leds().some((l) => board.areConnected(`${r}-${leg === 1 ? 2 : 1}`, `${l}-a`, false));
    });
    const ledToGnd = leds().some((l) => board.areConnected(`${l}-k`, "gnd"));
    return { pinToResistor, resistorToLed, ledToGnd };
  }

  // The LED that's correctly wired to pin 13 (any valid layout counts - the
  // resistor may sit on either side of the LED), plus anything wrong with LEDs.
  function ledStatus() {
    const report = board.inspectCircuit();
    const ledFindings = report.findings.filter((f) => f.id && f.id.startsWith("led-"));
    const good = ledFindings.find((f) => f.level === "ok" && f.data?.pin === 13 && !ledFindings.some((p) => p.id === f.id && p.level === "problem"));
    const problem = ledFindings.find((f) => f.level === "problem");
    const otherPin = ledFindings.find((f) => f.level === "ok" && f.data?.pin !== 13 && f.data?.pin != null);
    const noResistor = ledFindings.find((f) => f.level === "ok" && f.data?.pin === 13 && f.data?.resistor === false);
    return { good, problem, otherPin, noResistor };
  }

  function codeIsBlink() {
    const c = squash(editor.getValue());
    return ["pinMode(13,OUTPUT)", "digitalWrite(13,HIGH)", "digitalWrite(13,LOW)"].every((part) => c.includes(part)) && /delay\(\d+\)/.test(c);
  }
  function delays() {
    return [...squash(editor.getValue()).matchAll(/delay\((\d+)\)/g)].map((m) => Number(m[1]));
  }

  // ---------- watching the LED blink ----------
  // Polls the board a few times a second while a step is watching, and
  // records each on/off change of the LED on pin 13 with when it happened.

  function startWatching() {
    stopWatching();
    let last = null;
    poll = setInterval(() => {
      const id = ledStatus().good?.id;
      if (!id) { last = null; return; }
      const lit = (board.ledLevels()[id] ?? 0) > 0;
      if (last !== null && lit !== last) {
        seen.toggles = (seen.toggles || []).concat(performance.now());
        refresh();
      }
      last = lit;
      if (lit && !seen.lit) { seen.lit = true; refresh(); }
    }, 100);
  }
  function stopWatching() {
    if (poll) clearInterval(poll);
    poll = null;
  }
  // Average time between on/off changes, in ms (null until there are enough).
  function blinkHalfPeriod() {
    const t = seen.toggles || [];
    if (t.length < 3) return null;
    const gaps = t.slice(1).map((x, i) => x - t[i]).slice(-4);
    return gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  // ---------- small UI pieces ----------

  function highlight(target) {
    if (!target) return;
    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.classList.remove("guide-highlight");
    void target.offsetWidth;
    target.classList.add("guide-highlight");
    setTimeout(() => target.classList.remove("guide-highlight"), 2600);
  }

  function checklist(items) {
    const ul = el("ul", "guide-checklist");
    for (const [done, text] of items) {
      const li = el("li", done ? "is-done" : "");
      li.appendChild(el("span", "guide-check", done ? "✔" : "○"));
      li.appendChild(el("span", null, text));
      ul.appendChild(li);
    }
    return ul;
  }

  function para(text, cls) {
    return el("p", cls || null, text);
  }

  function bullets(lines) {
    const ul = el("ul", "guide-points");
    for (const line of lines) {
      const li = el("li");
      if (Array.isArray(line)) {
        li.appendChild(el("strong", null, line[0]));
        li.appendChild(document.createTextNode(` ${line[1]}`));
      } else {
        li.textContent = line;
      }
      ul.appendChild(li);
    }
    return ul;
  }

  // A prediction question: pick an answer BEFORE running. It isn't graded -
  // the point is committing to a guess, then comparing it with what happens.
  function prediction(key, question, options, label = "Predict") {
    const box = el("div", "guide-predict");
    box.dataset.key = key;
    box.appendChild(el("div", "guide-predict-q", `${label}: ${question}`));
    const list = el("div", "guide-predict-options");
    const chosen = seen[key];
    options.forEach((opt, i) => {
      const b = el("button", "guide-option", opt.text);
      b.type = "button";
      if (opt.correct) b.dataset.correct = "1";
      if (chosen !== undefined) {
        b.disabled = true;
        if (i === chosen) b.classList.add("is-chosen");
      }
      b.addEventListener("click", () => { seen[key] = i; refresh(); });
      list.appendChild(b);
    });
    box.appendChild(list);
    if (chosen !== undefined && label === "Predict") {
      box.appendChild(el("p", "guide-predict-note", "Locked in. Now try it and see if you were right."));
    }
    return box;
  }

  function predictionVerdict(key, options) {
    const opt = options[seen[key]];
    if (!opt) return null;
    seen[`${key}Revealed`] = true;
    return el("p", opt.correct ? "guide-verdict is-right" : "guide-verdict is-wrong",
      opt.correct ? "Your prediction was right." : `You predicted "${opt.text}" - not quite. Here's why it went the way it did:`);
  }

  function explain(title, lines) {
    const box = el("div", "guide-explain");
    box.appendChild(el("div", "guide-explain-title", title));
    for (const line of lines) box.appendChild(para(line));
    return box;
  }

  // ---------- the steps ----------

  const LED_PREDICT = [
    { text: "Turn on and stay on" },
    { text: "Blink: on for 1 second, off for 1 second, forever", correct: true },
    { text: "Blink once, then stop" },
    { text: "Nothing - it needs a real Arduino" },
  ];
  const FAST_PREDICT = [
    { text: "Blink faster", correct: true },
    { text: "Blink slower" },
    { text: "Stay on, but dimmer" },
    { text: "No change" },
  ];
  const BREAK_PREDICT = [
    { text: "It keeps blinking" },
    { text: "It goes dark, even though the code keeps running", correct: true },
    { text: "It stays fully on" },
    { text: "The sketch crashes with an error" },
  ];

  const steps = [
    {
      title: "Your first circuit",
      render(body, nav) {
        body.appendChild(para("You'll build the \"hello world\" of electronics: an LED that blinks. You don't need any hardware - you'll use the virtual Arduino on this page, which behaves like a real one."));
        body.appendChild(bullets([
          "What a circuit is, and why the loop has to be complete",
          "What an LED and a resistor do, and which way round they go",
          "How to wire them to an Arduino pin",
          "Your first sketch: setup(), loop(), pinMode(), digitalWrite() and delay()",
        ]));
        body.appendChild(para("About 10 minutes, 9 short steps. You can leave at any time and keep what you've built.", "guide-dim"));
        nav.next.textContent = "Let's go";
        nav.next.disabled = false;
      },
    },
    {
      title: "Meet the parts",
      render(body, nav) {
        body.appendChild(bullets([
          ["The Arduino Uno", "(top of the board) is a tiny computer. Your code can switch each numbered pin along its top edge ON - 5 volts, called HIGH - or OFF - 0 volts, called LOW."],
          ["GND", "(\"ground\", on the bottom edge) is 0 volts: the return path electricity flows back to."],
          ["An LED", "is a light that only works one way round. Its long leg is + (the anode), its short leg is − (the cathode). The simulator marks them + and −."],
          ["A resistor", "limits how much current flows, so the LED doesn't burn out. It works either way round."],
          ["A circuit", "is a complete loop: out of a pin, through the parts, and back to GND. Break the loop anywhere and nothing flows."],
        ]));
        const q = [
          { text: "Long leg (+) toward the pin, short leg (−) to GND", correct: true },
          { text: "Either way round works" },
          { text: "Short leg (−) toward the pin" },
        ];
        body.appendChild(prediction("quiz", "which way round does the LED go?", q, "Quick check"));
        if (seen.quiz !== undefined) {
          body.appendChild(el("p", q[seen.quiz].correct ? "guide-verdict is-right" : "guide-verdict is-wrong",
            q[seen.quiz].correct
              ? "Right: current goes in at the + leg and out at the − leg. Backwards, an LED blocks it and stays dark."
              : "Not quite: an LED only lets current through from its + leg to its − leg, so + goes toward the pin and − to GND."));
        }
        nav.next.disabled = seen.quiz === undefined;
      },
    },
    {
      title: "Put the parts on the board",
      render(body, nav) {
        const hasLed = !!firstOf("led");
        const hasResistor = !!firstOf("resistor");
        body.appendChild(para("Use the Circuit Board toolbar below the code editor:"));
        body.appendChild(checklist([
          [hasLed, "Choose LED in the list, then press + Add"],
          [hasResistor, "Choose Resistor in the list, then press + Add"],
        ]));
        const row = el("div", "guide-actions");
        row.appendChild(button("Show me where", "hint", () => highlight(targets.picker)));
        row.appendChild(button("Do it for me", "secondary", () => {
          if (!firstOf("led")) board.addComponent("led");
          if (!firstOf("resistor")) board.addComponent("resistor");
        }));
        body.appendChild(row);
        if (hasLed && hasResistor) body.appendChild(para("Both parts are on the breadboard. On a real one you'd push their legs into the holes; here, every leg is connected with a wire - that's next.", "guide-good"));
        nav.next.disabled = !(hasLed && hasResistor);
      },
    },
    {
      title: "Wire the circuit",
      render(body, nav) {
        body.appendChild(para("To draw a wire, click one end, then the other. The little dots at the bottom of each leg are where wires attach. Clicked the wrong thing? Click it again to cancel - or click a finished wire to delete it."));
        const c = wiringChecklist();
        const led = ledStatus();
        body.appendChild(checklist([
          [c.pinToResistor, "Pin 13 (top edge of the Arduino) → one leg of the resistor"],
          [c.resistorToLed, "The resistor's other leg → the LED's + leg (the long one)"],
          [c.ledToGnd, "The LED's − leg (short) → GND (bottom edge of the Arduino)"],
        ]));
        if (led.good) {
          body.appendChild(para(led.good.data?.resistor === false
            ? "The loop is complete - but there's no resistor in it. Wire it through the resistor (a real LED without one would burn out)."
            : "The loop is complete: pin 13 → resistor → LED → GND. Current will be able to flow all the way round.", led.good.data?.resistor === false ? "guide-warn" : "guide-good"));
        } else if (led.otherPin) {
          body.appendChild(para(`Your LED is wired to ${led.otherPin.text.match(/pin \d+/)?.[0] ?? "another pin"}. This guide's code uses pin 13 - move that wire to pin 13.`, "guide-warn"));
        } else if (led.problem && board.wireCount() >= 2) {
          body.appendChild(para(`Not quite yet. ${led.problem.text}`, "guide-warn"));
        }
        const row = el("div", "guide-actions");
        row.appendChild(button("Show me the board", "hint", () => highlight(targets.board)));
        row.appendChild(button("Do it for me", "secondary", autoWire));
        body.appendChild(row);
        body.appendChild(para("Stuck? \"Check Circuit\" (in the toolbar) explains exactly what's connected to what.", "guide-dim"));
        nav.next.disabled = !(led.good && led.good.data?.resistor !== false);
      },
    },
    {
      title: "Tell the Arduino what to do",
      render(body, nav) {
        body.appendChild(para("An Arduino program is called a sketch. Every sketch has two parts:"));
        body.appendChild(bullets([
          ["setup()", "runs once, when the board starts. pinMode(13, OUTPUT) makes pin 13 an output, so it can send power out."],
          ["loop()", "runs over and over, forever, after setup()."],
          ["digitalWrite(13, HIGH)", "switches pin 13 on (5 volts); LOW switches it off (0 volts)."],
          ["delay(1000)", "waits 1000 milliseconds - one second - before the next line."],
          ["//", "starts a comment: a note for humans that the Arduino ignores."],
        ]));
        const pre = el("pre", "code-block guide-code", BLINK_CODE);
        body.appendChild(pre);
        const done = codeIsBlink();
        const row = el("div", "guide-actions");
        row.appendChild(button(done ? "The code is in the editor ✔" : "Put this code in the editor", done ? "secondary" : "complete", () => {
          panel.stopRun();
          editor.setValue(BLINK_CODE);
          highlight(targets.editor);
        }));
        body.appendChild(row);
        body.appendChild(para("Typing it yourself helps it stick - every ( ) and ; matters. The button is there if you'd rather not.", "guide-dim"));
        nav.next.disabled = !done;
      },
    },
    {
      title: "Predict, then run",
      watch: true,
      render(body, nav) {
        body.appendChild(prediction("blink", "when you press Run, what will the LED do?", LED_PREDICT));
        if (seen.blink === undefined) { nav.next.disabled = true; return; }
        const blinking = (seen.toggles || []).length >= 2;
        if (!blinking) {
          nav.todo = panel.isRunning() ? "Watch the LED on the board" : "Press Run (above the code) and watch the LED";
          body.appendChild(para(panel.isRunning()
            ? "Running... watch the LED on the board."
            : "Now press Run (the green button above the code) and watch the LED."));
          const row = el("div", "guide-actions");
          row.appendChild(button("Show me Run", "hint", () => highlight(targets.run)));
          body.appendChild(row);
          if (seen.error) body.appendChild(para("The Serial Monitor (under the board) says what went wrong, and the line is highlighted in red. Fix it, then press Run again.", "guide-warn"));
          if (seen.stuck) {
            const led = ledStatus();
            body.appendChild(para(led.problem ? `The LED isn't blinking because ${led.problem.text}` : "The LED isn't blinking yet - press Check Circuit to see what's connected.", "guide-warn"));
          }
          nav.next.disabled = true;
          return;
        }
        body.appendChild(predictionVerdict("blink", LED_PREDICT));
        body.appendChild(explain("Why it blinks", [
          "setup() ran once and made pin 13 an output. Then loop() switched pin 13 HIGH: 5 volts pushed current out of the pin, through the resistor and the LED, and back to GND - so the LED lit.",
          "delay(1000) held it there for a second. LOW switched the pin to 0 volts - no push, no current, no light - for another second.",
          "Then loop() started again from the top, and it will keep going for as long as the board has power. That's why it never stops.",
        ]));
        nav.next.disabled = false;
      },
    },
    {
      title: "Experiment: change the timing",
      watch: true,
      render(body, nav) {
        body.appendChild(para("Change both delay(1000) lines to delay(200). Then press Stop and Run again: a sketch only picks up new code when it starts - just like uploading new code to a real board."));
        const d = delays();
        const edited = d.length >= 2 && d.every((ms) => ms < 1000);
        body.appendChild(checklist([[edited, "Both delays changed to a smaller number"]]));
        body.appendChild(prediction("fast", "with delay(200), what will the LED do?", FAST_PREDICT));
        if (seen.fast === undefined || !edited) { nav.next.disabled = true; return; }
        const half = seen.runAfterEdit ? blinkHalfPeriod() : null;
        if (half === null || half > 700) {
          nav.todo = seen.runAfterEdit ? "Watch the LED" : panel.isRunning() ? "Press Stop, then Run, to try the new timing" : "Press Run to try the new timing";
          body.appendChild(para(seen.runAfterEdit ? "Running... watch the LED." : panel.isRunning() ? "Now press Stop, then Run." : "Now press Run.", null));
          nav.next.disabled = true;
          return;
        }
        body.appendChild(predictionVerdict("fast", FAST_PREDICT));
        body.appendChild(explain("Why it's faster", [
          `delay() counts in milliseconds. 200 ms on + 200 ms off makes one blink every 0.4 seconds - about ${Math.round(1000 / (2 * half) * 10) / 10} blinks a second here, instead of one every 2 seconds.`,
          "The simulator uses real time, so this is exactly how fast a real Uno would blink it. Try delay(50) some time: it blinks so fast your eye starts to blur it.",
        ]));
        nav.next.disabled = false;
      },
    },
    {
      title: "Break it on purpose",
      watch: true,
      render(body, nav) {
        const led = ledStatus();
        const ledId = seen.ledId || (seen.ledId = led.good?.id);
        const grounded = ledId ? board.areConnected(`${ledId}-k`, "gnd") : false;
        if (!grounded) seen.broke = true;
        body.appendChild(para("Engineers learn a lot from broken circuits. Keep the sketch running, and get ready to delete the wire between the LED's − leg and GND (click the wire itself)."));
        body.appendChild(prediction("break", "with that wire gone, what will the LED do?", BREAK_PREDICT));
        if (seen.break === undefined) { nav.next.disabled = true; return; }
        if (!seen.broke) {
          nav.todo = panel.isRunning() ? "Click the GND wire to delete it, and watch the LED" : "Press Run, then click the GND wire to delete it";
          body.appendChild(para(panel.isRunning() ? "Now click the GND wire to delete it, and watch the LED." : "Press Run first, then click the GND wire to delete it."));
          const row = el("div", "guide-actions");
          row.appendChild(button("Show me the board", "hint", () => highlight(targets.board)));
          body.appendChild(row);
          nav.next.disabled = true;
          return;
        }
        body.appendChild(predictionVerdict("break", BREAK_PREDICT));
        body.appendChild(explain("Why it went dark", [
          "Current needs a complete loop: out of pin 13, through the resistor and the LED, and back into GND. With the GND wire gone, the loop is open, so no current can flow at all.",
          "Your code didn't change and didn't stop - it's still switching pin 13 on and off. A broken circuit doesn't cause an error message, which is why \"my LED won't light\" is usually a wiring problem, not a code problem. Press Check Circuit to see how it describes this.",
        ]));
        body.appendChild(checklist([[grounded, "Fix it: wire the LED's − leg back to GND"]]));
        if (grounded) body.appendChild(para("Fixed - and it's blinking again.", "guide-good"));
        nav.next.disabled = !grounded;
      },
    },
    {
      title: "You built your first circuit!",
      render(body, nav) {
        body.appendChild(para("You wired a real LED circuit, wrote and ran a sketch, changed its behaviour, and fixed a broken circuit. That's the whole cycle every Arduino project uses."));
        body.appendChild(bullets([
          "A circuit is a complete loop from a pin, through the parts, back to GND",
          "An LED goes + toward the pin, − to GND, with a resistor to protect it",
          "setup() runs once; loop() repeats forever",
          "pinMode() sets a pin up, digitalWrite() switches it, delay() waits",
        ]));
        body.appendChild(para("Where next?"));
        const row = el("div", "guide-actions guide-finish");
        row.appendChild(button("Start Lesson 1", "complete", () => finish("lessons")));
        row.appendChild(button("Try the Blink challenge", "primary", () => finish("blink")));
        row.appendChild(button("Keep experimenting here", "secondary", () => finish(null)));
        body.appendChild(row);
        nav.next.hidden = true;
      },
    },
  ];

  // ---------- doing it for the learner ----------

  function autoWire() {
    const led = firstOf("led") || board.addComponent("led");
    const r = firstOf("resistor") || board.addComponent("resistor");
    if (board.wireCount() > 0) board.clearWiring();
    board.connect("pin-13", `${r}-1`);
    board.connect(`${r}-2`, `${led}-a`);
    board.connect(`${led}-k`, "gnd");
    onStatus?.("Wired for you: pin 13 → resistor → LED + leg, LED − leg → GND.");
  }

  // ---------- the guide bar ----------
  // On a narrow screen the guide sits above the editor and board, so it
  // scrolls out of sight while you wire or code. A small bar then sticks to
  // the bottom of the screen with the step and the very next thing to do.
  const bar = el("div", "guide-minibar");
  bar.hidden = true;
  const barText = el("div", "guide-minibar-text");
  const barBtn = button("Show guide", "primary", () => container.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  bar.append(barText, barBtn);
  container.parentElement?.appendChild(bar);
  let guideInView = true;
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      guideInView = entries.some((e) => e.isIntersecting);
      bar.hidden = !active || guideInView;
    }).observe(container);
  }

  function updateBar(body, nav) {
    const todo = body.querySelector(".guide-checklist li:not(.is-done) span:last-child")?.textContent
      || (body.querySelector(".guide-option:not(:disabled)") ? "Answer the question in the guide" : null)
      || nav.todo
      || (nav.next.disabled ? "Follow the guide's instructions" : "Done! Open the guide for the next step");
    barText.innerHTML = "";
    barText.appendChild(el("span", "guide-minibar-step", `STEP ${stepIndex + 1}/${steps.length} · ${steps[stepIndex].title}`));
    barText.appendChild(el("span", "guide-minibar-todo", todo));
    bar.hidden = !active || guideInView;
  }

  // ---------- rendering + lifecycle ----------

  function refresh() {
    if (!active) return;
    const step = steps[stepIndex];
    container.innerHTML = "";

    const head = el("div", "guide-head");
    head.appendChild(el("div", "guide-eyebrow", `FIRST CIRCUIT · STEP ${stepIndex + 1} OF ${steps.length}`));
    const exit = button("Exit guide", "secondary", () => stop(true));
    exit.classList.add("guide-exit");
    exit.title = "Leave the guide. Your circuit and code stay as they are.";
    head.appendChild(exit);
    container.appendChild(head);

    const dots = el("div", "guide-dots");
    steps.forEach((_, i) => dots.appendChild(el("span", i < stepIndex ? "is-done" : i === stepIndex ? "is-current" : "")));
    container.appendChild(dots);

    container.appendChild(el("h2", "guide-title", step.title));
    const body = el("div", "guide-body");
    const nav = {
      back: button("Back", "secondary", () => go(stepIndex - 1)),
      next: button("Next", "primary", () => go(stepIndex + 1)),
    };
    nav.back.disabled = stepIndex === 0;
    step.render(body, nav);
    // Once a prediction has been checked against what really happened, mark
    // the right answer and drop the "now try it" note.
    for (const box of body.querySelectorAll(".guide-predict")) {
      if (!seen[`${box.dataset.key}Revealed`]) continue;
      box.querySelector(".guide-predict-note")?.remove();
      box.querySelector("[data-correct]")?.classList.add("is-correct");
    }
    container.appendChild(body);

    const navRow = el("div", "guide-nav");
    navRow.append(nav.back, nav.next);
    container.appendChild(navRow);
    updateBar(body, nav);
  }

  function go(index) {
    if (index < 0 || index >= steps.length) return;
    stepIndex = index;
    seen = { ledId: null };
    if (steps[index].watch) startWatching();
    else stopWatching();
    if (index === 6) seen.runAfterEdit = false;
    refresh();
    container.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function finish(next) {
    stop(false);
    onFinish?.(next);
  }

  function start() {
    if (active) { go(0); return; }
    active = true;
    container.hidden = false;
    let runStartedAt = 0;
    unsubscribers = [
      panel.on((type) => {
        if (!active) return;
        if (type === "run") {
          seen.error = false;
          seen.toggles = [];
          runStartedAt = performance.now();
          if (stepIndex === 6 && delays().every((ms) => ms < 1000)) seen.runAfterEdit = true;
        }
        if (type === "error") seen.error = true;
        refresh();
      }),
      // Typing only re-renders the guide when it changes what the guide
      // shows (the code becoming complete, the delays being edited) - not on
      // every keystroke, which would make the editor below it jump around.
      editor.onChange(() => {
        if (!active || (stepIndex !== 4 && stepIndex !== 6)) return;
        const d = delays();
        const signature = `${codeIsBlink()}|${d.length >= 2 && d.every((ms) => ms < 1000)}`;
        if (signature !== seen.codeSignature) { seen.codeSignature = signature; refresh(); }
      }),
    ];
    // a slow tick so "still not blinking after 3 seconds" can show up
    // (re-rendering only when that actually changes)
    const slow = setInterval(() => {
      if (!active || !steps[stepIndex].watch) return;
      const stuck = panel.isRunning() && performance.now() - runStartedAt > 3000 && (seen.toggles || []).length < 2;
      if (stuck !== !!seen.stuck) { seen.stuck = stuck; refresh(); }
    }, 1000);
    unsubscribers.push(() => clearInterval(slow));
    go(0);
  }

  function stop(byUser) {
    if (!active) return;
    active = false;
    stopWatching();
    unsubscribers.forEach((u) => u());
    unsubscribers = [];
    container.hidden = true;
    container.innerHTML = "";
    bar.hidden = true;
    onExit?.(byUser);
  }

  // The circuit changing (a wire added, a part removed) can complete a step.
  panel.on((type) => { if (active && type === "circuit") refresh(); });

  return { start, stop, isActive: () => active };
}
