// Thin wrapper around CodeMirror so the rest of the app doesn't need to know
// anything about CodeMirror's own API - it just calls createEditor() and gets
// back simple getValue()/setValue() helpers. If we ever swap editors later,
// only this file needs to change.

import { glossaryAt } from "./glossary.js";

const DEFAULT_TEMPLATE = "void setup() {\n  \n}\n\nvoid loop() {\n  \n}\n";
const HELP_IDLE = "Click on a command (like digitalWrite) to see what it does here.";

export function createEditor(textareaEl) {
  const cm = CodeMirror.fromTextArea(textareaEl, {
    mode: "text/x-c++src", // closest built-in mode to Arduino's C++ syntax
    theme: "dracula",
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    matchBrackets: true,
    autoCloseBrackets: false,
  });

  cm.setValue(DEFAULT_TEMPLATE);

  // CodeMirror measures character widths (to know where the cursor and each
  // character go) as soon as it's created - but the custom web font almost
  // always finishes downloading AFTER that first measurement, not before.
  // The text re-renders in the new font once it arrives, but CodeMirror
  // doesn't know to re-measure on its own, so the cursor keeps landing at
  // the OLD (fallback-font) character positions - visibly "off" from the
  // text itself. document.fonts.ready resolves once every requested font
  // has actually loaded, which is exactly when a refresh needs to happen.
  document.fonts.ready.then(() => cm.refresh());

  // The line an error points at gets a red band (and a marker in the gutter)
  // until the code is edited or run again - so "Line 7" in the Serial Monitor
  // is never a hunt.
  let markedLine = null;
  function clearMark() {
    if (markedLine === null) return;
    cm.removeLineClass(markedLine, "background", "cm-error-line");
    cm.removeLineClass(markedLine, "gutter", "cm-error-gutter");
    markedLine = null;
  }
  function markErrorLine(line) {
    clearMark();
    if (!line || line < 1 || line > cm.lineCount()) return;
    markedLine = cm.getLineHandle(line - 1);
    cm.addLineClass(markedLine, "background", "cm-error-line");
    cm.addLineClass(markedLine, "gutter", "cm-error-gutter");
    cm.scrollIntoView({ line: line - 1, ch: 0 }, 60);
  }
  cm.on("change", clearMark);

  // "What does this do?": the command under the cursor is explained in a line
  // below the editor (works from the keyboard too), and hovering over one
  // shows the same explanation as a tooltip. Comments and text in quotes are
  // left alone.
  const commandAt = (pos) => {
    const type = cm.getTokenTypeAt({ line: pos.line, ch: pos.ch + 1 }) || cm.getTokenTypeAt(pos) || "";
    if (/comment|string/.test(type)) return null;
    return glossaryAt(cm.getLine(pos.line) ?? "", pos.ch);
  };
  const helpEl = document.createElement("div");
  helpEl.className = "editor-help";
  helpEl.setAttribute("aria-live", "polite");
  cm.getWrapperElement().after(helpEl);
  let shownHelp = null; // not undefined: that's "idle", and the first render must still happen
  const showHelp = () => {
    const entry = cm.hasFocus() ? commandAt(cm.getCursor()) : null;
    if (entry?.name === shownHelp) return;
    shownHelp = entry?.name;
    helpEl.classList.toggle("is-idle", !entry);
    helpEl.innerHTML = "";
    if (!entry) { helpEl.textContent = HELP_IDLE; return; }
    const code = document.createElement("code");
    code.textContent = entry.usage;
    helpEl.append(code, document.createTextNode(` ${entry.text}`));
  };
  cm.on("cursorActivity", showHelp);
  cm.on("focus", showHelp);
  showHelp();
  cm.getWrapperElement().addEventListener("mouseover", (e) => {
    const span = e.target.closest(".CodeMirror-line span");
    if (!span) return;
    const entry = commandAt(cm.coordsChar({ left: e.clientX, top: e.clientY }, "window"));
    if (entry) span.title = `${entry.usage} - ${entry.text}`;
    else span.removeAttribute("title");
  });

  const listeners = new Set();
  cm.on("change", () => listeners.forEach((fn) => fn()));

  return {
    getValue: () => cm.getValue(),
    setValue: (text) => cm.setValue(text),
    reset: () => cm.setValue(DEFAULT_TEMPLATE),
    refresh: () => cm.refresh(), // needed if the editor was hidden when created
    // true when there's nothing worth losing (still the starting template)
    isTemplate: () => cm.getValue().replace(/\s+/g, "") === DEFAULT_TEMPLATE.replace(/\s+/g, ""),
    markErrorLine,
    clearMark,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    focus: () => cm.focus(),
  };
}
