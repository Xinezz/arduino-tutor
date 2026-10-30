// Wires one code editor + one circuit board together with their run/stop/
// reset controls, wire palette, and console, into a single self-contained
// unit. Extracted here once the app needed TWO of these side by side (the
// lesson view's built-in editor/board, and the standalone Free Practice
// view) - each call gets its own independent state (its own board,
// activeRun, etc, all private to this closure) rather than sharing one, so
// nothing built in one leaks into or gets clobbered by the other.
//
// Feedback comes from two separate places and is labelled that way, so a
// learner can always tell which kind of problem they have:
//   - the CODE: errors from the interpreter, explained by feedback.js
//     (syntax error / code problem / not supported / runtime error), with
//     the offending line highlighted in the editor
//   - the CIRCUIT: the board's own circuit check (board.inspectCircuit),
//     which only ever reports what's actually wired

import { createEditor } from "../editor/editor.js";
import { createBoard } from "./board.js";
import { startProgram } from "./interpreter.js";
import { explainError, explainWarning, conceptForFinding } from "./feedback.js";
import { openSimulatorLimits } from "./limits.js";
import { confirmDialog } from "../game/modal.js";

const REPORT_TAGS = { problem: "WIRING PROBLEM", real: "REAL BOARD", info: "NOTE", ok: "OK" };

export function createSimulatorPanel({
  codeEditorEl,
  boardSvgEl,
  runBtn,
  stopBtn,
  resetBtn,
  componentPickerEl,
  addComponentBtn,
  clearWiringBtn,
  clearConsoleBtn,
  consoleEl,
  wirePaletteEl,
  checkCircuitBtn,
  limitsBtn,
  circuitReportEl,
  onStatus, // optional: (message) => void, for reporting into the shared status bar
  onRun, // optional: () => void, called each time a program is started (feeds daily missions / trophies)
  onRunError, // optional: (message) => void, called when a running program hits an error
  onReview, // optional: (lessonId) => void, opens the lesson a hint points to
}) {
  const editor = createEditor(codeEditorEl);
  let activeRun = null;
  let board = null;

  // Other modules (the guided first circuit) can follow along:
  // "run", "stop", "error", "circuit".
  const listeners = new Set();
  const emit = (type, data) => listeners.forEach((fn) => { try { fn(type, data); } catch (e) { console.error(e); } });

  function consoleWrite(text, cls) {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    consoleEl.appendChild(span);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  // A small button inside the Serial Monitor, e.g. "More help" or
  // "Review: Variables".
  function consoleButton(label, onClick, cls = "sim-link") {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  // Hints are revealed one at a time: `shown` of them right away, then a
  // button reveals the next until there are none left. "Review" opens the
  // lesson that teaches the idea.
  function writeHelp({ hints = [], review = null }, { shown = 1, firstLabel = "More help" } = {}) {
    const actions = document.createElement("span");
    actions.className = "sim-actions";
    consoleEl.appendChild(actions);
    let next = 0;
    const more = consoleButton(firstLabel, () => reveal());
    function reveal() {
      if (next >= hints.length) return;
      const span = document.createElement("span");
      span.className = "sim-hint";
      span.textContent = `Hint ${next + 1}${hints.length > 1 ? ` of ${hints.length}` : ""}: ${hints[next]}\n`;
      consoleEl.insertBefore(span, actions);
      next++;
      if (next >= hints.length) more.remove();
      else more.textContent = "Another hint";
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }
    for (let i = 0; i < shown; i++) reveal();
    if (next < hints.length) actions.appendChild(more);
    if (review && onReview) actions.appendChild(consoleButton(`Review: ${review.title}`, () => onReview(review.lessonId)));
    if (!actions.children.length) actions.remove();
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function selectWireColor(color, btnEl) {
    board.setWireColor(color);
    wirePaletteEl.querySelectorAll(".wire-swatch").forEach((el) => el.classList.remove("active"));
    btnEl.classList.add("active");
  }

  function buildWirePalette() {
    wirePaletteEl.innerHTML = "";

    const autoBtn = document.createElement("button");
    autoBtn.className = "wire-swatch auto active";
    autoBtn.title = "Auto (red=5V, black=GND, rotates colors for signal wires)";
    autoBtn.setAttribute("aria-label", autoBtn.title);
    autoBtn.addEventListener("click", () => selectWireColor("auto", autoBtn));
    wirePaletteEl.appendChild(autoBtn);

    for (const { name, value } of board.getWirePalette()) {
      const btn = document.createElement("button");
      btn.className = "wire-swatch";
      btn.style.background = value;
      btn.title = `${name} wire - only the color changes, not how it works`;
      btn.setAttribute("aria-label", `${name} wire`);
      btn.addEventListener("click", () => selectWireColor(value, btn));
      wirePaletteEl.appendChild(btn);
    }
  }

  // The circuit board is built separately from the editor above, and
  // wrapped in try/catch, so that if IT fails for some reason, the rest of
  // the panel (at least the code editor) still works instead of going dead.
  try {
    board = createBoard(boardSvgEl, {
      onCircuitChange: () => {
        if (circuitReportEl && !circuitReportEl.hidden) renderReport();
        emit("circuit");
      },
    });
    buildWirePalette();
  } catch (err) {
    console.error("Failed to start the circuit simulator:", err);
    for (const btn of [runBtn, stopBtn, addComponentBtn, clearWiringBtn, checkCircuitBtn]) {
      if (!btn) continue;
      btn.disabled = true;
      btn.title = "The simulator failed to load - check the browser console for details.";
    }
  }

  // ---------- the circuit check ----------

  function renderReport() {
    if (!circuitReportEl || !board) return;
    const report = board.inspectCircuit();
    circuitReportEl.innerHTML = "";

    const head = document.createElement("div");
    head.className = "circuit-report-head";
    const title = document.createElement("strong");
    title.textContent = "Circuit check";
    const summary = document.createElement("span");
    summary.className = "circuit-report-summary";
    const bits = [];
    bits.push(report.problems ? `${report.problems} wiring problem${report.problems === 1 ? "" : "s"}` : "no wiring problems");
    if (report.real) bits.push(`${report.real} real-board note${report.real === 1 ? "" : "s"}`);
    summary.textContent = bits.join(" · ");
    const close = document.createElement("button");
    close.className = "circuit-report-close";
    close.type = "button";
    close.textContent = "×";
    close.title = "Hide the circuit check";
    close.setAttribute("aria-label", "Hide the circuit check");
    close.addEventListener("click", () => { circuitReportEl.hidden = true; });
    head.append(title, summary, close);
    circuitReportEl.appendChild(head);

    const list = document.createElement("ul");
    list.className = "circuit-report-list";
    for (const f of report.findings) {
      const li = document.createElement("li");
      li.className = `cr-item cr-${f.level}`;
      const tag = document.createElement("span");
      tag.className = "cr-tag";
      tag.textContent = REPORT_TAGS[f.level];
      const subject = document.createElement("span");
      subject.className = "cr-subject";
      subject.textContent = f.subject;
      const text = document.createElement("p");
      text.textContent = f.text;
      li.append(tag, subject, text);
      const concept = conceptForFinding(f);
      if (concept && onReview) li.appendChild(consoleButton(`Review: ${concept.title}`, () => onReview(concept.lessonId), "sim-link cr-review"));
      list.appendChild(li);
    }
    circuitReportEl.appendChild(list);

    const foot = document.createElement("p");
    foot.className = "circuit-report-foot";
    foot.textContent = "Updates as you change the wiring. WIRING PROBLEM = can't work as wired. REAL BOARD = works in the simulator, but a real board needs more. Only what's actually on the board is checked - not what you meant to build.";
    circuitReportEl.appendChild(foot);
  }

  function showReport() {
    if (!circuitReportEl) return;
    circuitReportEl.hidden = false;
    renderReport();
  }

  checkCircuitBtn?.addEventListener("click", () => {
    showReport();
    circuitReportEl.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  });
  limitsBtn?.addEventListener("click", () => openSimulatorLimits());

  // ---------- running ----------

  function stopRun() {
    if (activeRun) activeRun.stop();
    activeRun = null;
    runBtn.disabled = false;
    stopBtn.disabled = true;
    board?.setRunning(false);
  }

  function showError(message, details) {
    const info = explainError(details || { kind: "code", line: null, message });
    consoleWrite(`✖ ${info.title.toUpperCase()}${info.line ? ` · LINE ${info.line}` : ""}\n`, "sim-error sim-error-title");
    consoleWrite(`${info.detail}\n`, "sim-error");
    consoleWrite(`${info.what}\n`, "sim-status");
    consoleWrite(`${info.recovery}\n`, "sim-recovery");
    writeHelp(info);
    editor.markErrorLine(info.line);
  }

  // Before a run starts: anything on the board that can't work as wired is
  // said up front, so "my LED doesn't light" never looks like a code bug.
  function reportWiringProblems() {
    const report = board.inspectCircuit();
    const problems = report.findings.filter((f) => f.level === "problem");
    for (const f of problems.slice(0, 3)) consoleWrite(`⚠ WIRING PROBLEM · ${f.subject}: ${f.text}\n`, "sim-wiring");
    if (problems.length) consoleWrite(`(Check Circuit lists everything on the board.)\n`, "sim-status");
  }

  function runCode() {
    stopRun();
    editor.clearMark();
    board.reset();
    board.setRunning(true);
    consoleWrite(`--- Run started ---\n`, "sim-status");
    reportWiringProblems();
    runBtn.disabled = true;
    stopBtn.disabled = false;
    onRun?.();
    emit("run");

    activeRun = startProgram(editor.getValue(), {
      pinMode: board.pinMode,
      digitalWrite: board.digitalWrite,
      digitalRead: board.digitalRead,
      analogRead: board.analogRead,
      analogWrite: board.analogWrite,
      pulseIn: board.pulseIn,
      tone: board.tone,
      noTone: board.noTone,
      servoWrite: board.servoWrite,
      lcdBegin: board.lcdBegin,
      lcdPrint: board.lcdPrint,
      lcdSetCursor: board.lcdSetCursor,
      lcdClear: board.lcdClear,
      pinStatus: board.pinStatus,
    }, {
      onOutput: (text) => consoleWrite(text),
      // Warnings are for code that runs but probably isn't doing what was
      // meant (a pin used without pinMode, analogWrite on a non-PWM pin...) -
      // shown in their own color so they never look like a crash.
      onWarning: (message) => {
        consoleWrite(`Warning: ${message}\n`, "sim-warn");
        // the hints stay folded away until asked for - a warning isn't a crash
        writeHelp(explainWarning(message), { shown: 0, firstLabel: "Why? Show a hint" });
      },
      onError: (message, details) => {
        showError(message, details);
        onRunError?.(message);
        runBtn.disabled = false;
        stopBtn.disabled = true;
        activeRun = null;
        board.setRunning(false);
        if (circuitReportEl && !circuitReportEl.hidden) renderReport();
        emit("error", details);
      },
      onStopped: (message) => {
        if (message) consoleWrite(`${message}\n`, "sim-status");
        else consoleWrite(`--- loop() finished ---\n`, "sim-status");
        runBtn.disabled = false;
        stopBtn.disabled = true;
        activeRun = null;
        board.setRunning(false);
        emit("stop");
      },
    });
    if (circuitReportEl && !circuitReportEl.hidden) renderReport();
  }

  runBtn.addEventListener("click", runCode);
  stopBtn.addEventListener("click", () => {
    stopRun();
    consoleWrite(`--- Stopped. Your code and wiring are unchanged - press Run to start again from setup(). ---\n`, "sim-status");
    if (circuitReportEl && !circuitReportEl.hidden) renderReport();
    emit("stop");
  });

  function guarded(fn) {
    return (...args) => {
      try {
        fn(...args);
      } catch (err) {
        console.error(err);
        onStatus?.(`Something went wrong: ${err.message}`);
      }
    };
  }

  addComponentBtn.addEventListener("click", guarded(() => {
    board.addComponent(componentPickerEl.value);
    const name = componentPickerEl.selectedOptions?.[0]?.textContent || "Part";
    onStatus?.(`${name} added to the breadboard. Click one of its legs, then a pin, to wire it.`);
  }));
  clearWiringBtn.addEventListener("click", async () => {
    const n = board.wireCount();
    if (n === 0) {
      onStatus?.("There are no wires to remove.");
      return;
    }
    const yes = await confirmDialog({
      title: "REMOVE ALL WIRES?",
      body: `This deletes all ${n} wire${n === 1 ? "" : "s"}. The parts stay where they are. (To remove just one wire, click on it instead.)`,
      confirmLabel: "Remove Wires",
      danger: true,
    });
    if (!yes) return;
    guarded(() => board.clearWiring())();
    onStatus?.("All wires removed.");
  });
  clearConsoleBtn.addEventListener("click", guarded(() => { consoleEl.innerHTML = ""; }));

  resetBtn.addEventListener("click", async () => {
    if (!editor.isTemplate()) {
      const yes = await confirmDialog({
        title: "RESET THE CODE?",
        body: "This replaces everything in the editor with the empty starting template - your code will be gone. Your circuit stays exactly as it is.",
        confirmLabel: "Reset Code",
        danger: true,
      });
      if (!yes) return;
    }
    const wasRunning = activeRun !== null;
    stopRun();
    editor.reset();
    if (wasRunning) consoleWrite(`--- Stopped ---\n`, "sim-status");
    consoleWrite(`--- Code reset to the starting template ---\n`, "sim-status");
    onStatus?.("Editor reset to the starting template. Your circuit wasn't changed.");
    emit("stop");
  });

  return {
    editor,
    board,
    stopRun,
    runCode,
    showReport,
    isRunning: () => activeRun !== null,
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
