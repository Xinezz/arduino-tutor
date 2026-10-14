// The Options screen (sound, music, CRT, effects, save-file tools) and the
// keyboard-shortcut cheat sheet. Pure UI: anything that touches the save is
// handed in as a callback by app.js, so this file never imports progress.js.

import { openModal, confirmDialog } from "./modal.js";
import { getSettings, setSetting } from "./settings.js";
import { playSfx } from "./audio.js";
import { showToast } from "./toast.js";
import { icon } from "./sprites.js";

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// A labelled row: title + one-line explanation on the left, control on the right.
function row(label, desc, control) {
  const r = el("div", "set-row");
  const text = el("div", "set-text");
  text.appendChild(el("div", "set-label", label));
  if (desc) text.appendChild(el("div", "set-desc", desc));
  r.append(text, control);
  return r;
}

// ON/OFF pixel switch bound to one boolean setting. invert=true is for
// "muted", which reads better in the UI as "Sound: ON".
function switchFor(key, { invert = false, onChange } = {}) {
  const b = el("button", "switch");
  b.type = "button";
  b.setAttribute("role", "switch");
  b.dataset.sfx = "none";
  const isOn = () => (invert ? !getSettings()[key] : !!getSettings()[key]);
  const paint = () => {
    const on = isOn();
    b.setAttribute("aria-checked", String(on));
    b.dataset.on = String(on);
    b.textContent = on ? "ON" : "OFF";
  };
  b.addEventListener("click", () => {
    setSetting(key, !getSettings()[key]);
    paint();
    playSfx(isOn() ? "toggleOn" : "toggleOff");
    onChange?.();
  });
  paint();
  return b;
}

function sliderFor(key, { sample } = {}) {
  const wrap = el("div", "set-slider");
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "5";
  input.value = String(Math.round(getSettings()[key] * 100));
  const readout = el("span", "set-slider-val", `${input.value}%`);
  input.addEventListener("input", () => {
    setSetting(key, Number(input.value) / 100);
    readout.textContent = `${input.value}%`;
  });
  input.addEventListener("change", () => sample?.());
  wrap.append(input, readout);
  return wrap;
}

export function openSettings({ getSaveCode, previewImport, applyImport, resetAll, onHelp }) {
  const body = el("div", "settings-body");

  // ---- sound ----
  body.appendChild(el("div", "set-heading", "SOUND"));
  body.appendChild(row("Sound effects", "Beeps, jingles and fanfares", switchFor("muted", { invert: true })));
  body.appendChild(row("Effects volume", "", sliderFor("sfxVolume", { sample: () => playSfx("coin") })));
  body.appendChild(row("Music", "A chiptune loop while you study", switchFor("musicOn")));
  body.appendChild(row("Music volume", "", sliderFor("musicVolume")));

  // ---- display ----
  body.appendChild(el("div", "set-heading", "DISPLAY"));
  body.appendChild(row("CRT scanlines", "A faint old-monitor glow over everything", switchFor("crt")));
  body.appendChild(row("Visual effects", "Particles, screen shake and transitions", switchFor("fx")));

  // ---- save file ----
  body.appendChild(el("div", "set-heading", "SAVE FILE"));
  const saveNote = el(
    "p",
    "set-note",
    "Your progress lives in this browser. Copy your save code to back it up or move to another device, and paste it back in here to load it."
  );
  body.appendChild(saveNote);

  const codeBox = document.createElement("textarea");
  codeBox.className = "save-box";
  codeBox.rows = 3;
  codeBox.spellcheck = false;
  codeBox.placeholder = "Your save code appears here - or paste one to load it";
  body.appendChild(codeBox);

  const saveActions = el("div", "set-actions");
  const exportBtn = el("button", "btn btn-secondary", "Show My Code");
  const copyBtn = el("button", "btn btn-secondary", "Copy");
  const loadBtn = el("button", "btn btn-hint", "Load Code");
  for (const b of [exportBtn, copyBtn, loadBtn]) b.type = "button";
  saveActions.append(exportBtn, copyBtn, loadBtn);
  body.appendChild(saveActions);

  exportBtn.addEventListener("click", () => {
    codeBox.value = getSaveCode();
    codeBox.select();
  });
  copyBtn.addEventListener("click", async () => {
    if (!codeBox.value) codeBox.value = getSaveCode();
    try {
      await navigator.clipboard.writeText(codeBox.value);
      showToast({ iconHtml: icon("check", 3), title: "COPIED", text: "Save code copied to your clipboard.", kind: "info", duration: 2600 });
    } catch {
      codeBox.select();
      showToast({ iconHtml: icon("note", 3), title: "COPY IT YOURSELF", text: "Your browser blocked auto-copy - press Ctrl+C.", kind: "warn", duration: 3600 });
    }
  });
  loadBtn.addEventListener("click", async () => {
    const text = codeBox.value.trim();
    if (!text) {
      showToast({ iconHtml: icon("cross", 3), title: "NOTHING TO LOAD", text: "Paste a save code into the box first.", kind: "warn", duration: 3000 });
      playSfx("error");
      return;
    }
    const preview = previewImport(text);
    if (!preview.ok) {
      showToast({ iconHtml: icon("cross", 3), title: "INVALID CODE", text: "That doesn't look like a save code from this game.", kind: "warn", duration: 3600 });
      playSfx("error");
      return;
    }
    const yes = await confirmDialog({
      title: "LOAD THIS SAVE?",
      body: `This will replace your current progress with: ${preview.summary}. The page will reload.`,
      confirmLabel: "Load It",
    });
    if (yes) applyImport(text);
  });

  // ---- danger zone ----
  body.appendChild(el("div", "set-heading set-heading-danger", "DANGER ZONE"));
  const resetBtn = el("button", "btn btn-danger", "Erase All Progress");
  resetBtn.type = "button";
  body.appendChild(row("Start over", "Deletes your lessons, credits, trophies and purchases for good", resetBtn));
  resetBtn.addEventListener("click", async () => {
    const yes = await confirmDialog({
      title: "ERASE EVERYTHING?",
      body: "This permanently deletes ALL of your progress on this device - lessons, credits, XP, trophies and everything you bought. It can't be undone (unless you saved a code).",
      confirmLabel: "Erase It All",
      danger: true,
    });
    if (yes) resetAll();
  });

  const handle = openModal({
    title: "OPTIONS",
    content: body,
    className: "modal-wide modal-settings",
    actions: [
      // Closes this window itself, then opens the cheat sheet once it's gone
      // (the modal system shows one window at a time).
      { label: "Keyboard Shortcuts", kind: "secondary", closes: false, onClick: () => { handle.close(); setTimeout(onHelp, 80); } },
      { label: "Done", kind: "primary" },
    ],
  });
  return handle;
}

const SHORTCUTS = [
  ["1 - 6", "Switch between Lessons, Map, Projects, Practice, Shop and Profile"],
  ["[  ]", "Previous / next lesson"],
  ["M", "Mute or unmute sound"],
  ["S", "Open Options"],
  ["?", "Show this cheat sheet"],
  ["Esc", "Close a window"],
];

export function openHelp() {
  const body = el("div", "help-body");
  const list = el("div", "help-list");
  for (const [keys, desc] of SHORTCUTS) {
    const r = el("div", "help-row");
    const k = el("div", "help-keys");
    for (const part of keys.split(" ").filter(Boolean)) {
      k.appendChild(part === "-" ? el("span", "help-dash", "to") : el("kbd", null, part));
    }
    r.append(k, el("div", "help-desc", desc));
    list.appendChild(r);
  }
  body.appendChild(list);
  body.appendChild(el("p", "set-note", "Psst - there's a famous old cheat code hidden somewhere in here. Arrow keys might help."));
  return openModal({
    title: "KEYBOARD SHORTCUTS",
    content: body,
    actions: [{ label: "Got It", kind: "primary" }],
  });
}
