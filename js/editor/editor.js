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

  return {
    getValue: () => cm.getValue(),
    setValue: (text) => cm.setValue(text),
    reset: () => cm.setValue(DEFAULT_TEMPLATE),
    refresh: () => cm.refresh(), // needed if the editor was hidden when created
  };
}
