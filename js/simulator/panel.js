// Wires one code editor + one circuit board together with their run/stop/
// reset controls, wire palette, and console, into a single self-contained
// unit. Extracted here once the app needed TWO of these side by side (the
// lesson view's built-in editor/board, and the standalone Free Practice
// view) - each call gets its own independent state (its own board,
// activeRun, etc, all private to this closure) rather than sharing one, so
// nothing built in one leaks into or gets clobbered by the other.

import { createEditor } from "../editor/editor.js";
import { createBoard } from "./board.js";
import { startProgram } from "./interpreter.js";

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
  onStatus, // optional: (message) => void, for reporting into the shared status bar
}) {
  const editor = createEditor(codeEditorEl);
  let activeRun = null;
  let board = null;

  function consoleWrite(text, cls) {
    const span = document.createElement("span");
    if (cls) span.className = cls;
    span.textContent = text;
    consoleEl.appendChild(span);
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
    autoBtn.addEventListener("click", () => selectWireColor("auto", autoBtn));
    wirePaletteEl.appendChild(autoBtn);

    for (const { name, value } of board.getWirePalette()) {
      const btn = document.createElement("button");
      btn.className = "wire-swatch";
      btn.style.background = value;
      btn.title = name;
      btn.addEventListener("click", () => selectWireColor(value, btn));
      wirePaletteEl.appendChild(btn);
    }
  }

  // The circuit board is built separately from the editor above, and
  // wrapped in try/catch, so that if IT fails for some reason, the rest of
  // the panel (at least the code editor) still works instead of going dead.
  try {
    board = createBoard(boardSvgEl);
    buildWirePalette();
  } catch (err) {
    console.error("Failed to start the circuit simulator:", err);
    for (const btn of [runBtn, stopBtn, addComponentBtn, clearWiringBtn]) {
      btn.disabled = true;
      btn.title = "The simulator failed to load - check the browser console for details.";
    }
  }

  function stopRun() {
    if (activeRun) activeRun.stop();
    activeRun = null;
    runBtn.disabled = false;
    stopBtn.disabled = true;
    board?.setRunning(false);
  }

  function runCode() {
    stopRun();
    board.reset();
    board.setRunning(true);
    consoleWrite(`--- Run started ---\n`, "sim-status");
    runBtn.disabled = true;
    stopBtn.disabled = false;

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
    }, {
      onOutput: (text) => consoleWrite(text),
      onError: (message) => {
        consoleWrite(`Error: ${message}\n`, "sim-error");
        runBtn.disabled = false;
        stopBtn.disabled = true;
        activeRun = null;
        board.setRunning(false);
      },
      onStopped: (message) => {
        if (message) consoleWrite(`${message}\n`, "sim-status");
        else consoleWrite(`--- loop() finished ---\n`, "sim-status");
        runBtn.disabled = false;
        stopBtn.disabled = true;
        activeRun = null;
        board.setRunning(false);
      },
    });
  }

  runBtn.addEventListener("click", runCode);
  stopBtn.addEventListener("click", () => {
    stopRun();
    consoleWrite(`--- Stopped ---\n`, "sim-status");
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

  addComponentBtn.addEventListener("click", guarded(() => board.addComponent(componentPickerEl.value)));
  clearWiringBtn.addEventListener("click", guarded(() => board.clearWiring()));
  clearConsoleBtn.addEventListener("click", guarded(() => { consoleEl.innerHTML = ""; }));

  resetBtn.addEventListener("click", () => {
    stopRun();
    editor.reset();
    onStatus?.("Editor reset to template.");
  });

  return { editor, board, stopRun };
}
