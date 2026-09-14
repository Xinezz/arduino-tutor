// Thin wrapper around CodeMirror so the rest of the app doesn't need to know
// anything about CodeMirror's own API - it just calls createEditor() and gets
// back simple getValue()/setValue() helpers. If we ever swap editors later,
// only this file needs to change.

const DEFAULT_TEMPLATE = "void setup() {\n  \n}\n\nvoid loop() {\n  \n}\n";

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

  return {
    getValue: () => cm.getValue(),
    setValue: (text) => cm.setValue(text),
    reset: () => cm.setValue(DEFAULT_TEMPLATE),
    refresh: () => cm.refresh(), // needed if the editor was hidden when created
  };
}
