// The title screen: a starfield, the logo, a few lines of fake boot text, then
// a blinking PRESS START. Pressing it is also the "first user gesture" the
// browser needs before it will let us play sound, so everything audio begins
// here. (?nosplash in the URL skips the whole thing, for development.)

import { composedSvg, icon } from "./sprites.js";
import { SAM_MOODS } from "./bigSprites.js";
import { unlockAudio, playSfx, setMusicTrack } from "./audio.js";
import { getSettings, setSetting, onSettingsChange } from "./settings.js";
import { pixelWipe } from "./fx.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function buildStars(host) {
  host.innerHTML = "";
  const count = 70;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    const size = Math.random() < 0.15 ? 4 : Math.random() < 0.5 ? 3 : 2;
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.width = s.style.height = `${size}px`;
    s.style.animationDelay = `${(Math.random() * 3).toFixed(2)}s`;
    s.style.animationDuration = `${(1.6 + Math.random() * 2.4).toFixed(2)}s`;
    host.appendChild(s);
  }
}

// progress is only read for the boot text ("SAVE FOUND" vs "NEW GAME").
export function runSplash({ progress, onStart }) {
  const root = document.getElementById("splash-screen");
  if (!root) {
    onStart();
    return;
  }
  if (document.documentElement.classList.contains("no-splash")) {
    root.hidden = true;
    onStart();
    return;
  }

  buildStars(document.getElementById("splash-stars"));
  document.getElementById("splash-chip").innerHTML = composedSvg("sam", SAM_MOODS.happy, { scale: 8 });

  const bootEl = document.getElementById("splash-boot");
  const startBtn = document.getElementById("splash-start");
  const footer = document.getElementById("splash-footer");
  const musicBtn = document.getElementById("splash-music");

  const hasSave = !!progress.playerName;
  const lines = [
    "BOOTING CIRCUITWORKS OS v1.0 ....... OK",
    "LOADING SPRITE TILESET ............. OK",
    "CALIBRATING PIXELS ................. OK",
    hasSave ? `SAVE DATA FOUND: ${progress.playerName.toUpperCase()}` : "NO SAVE DATA - NEW GAME",
  ];

  // The music toggle lives on the title screen so it's an obvious, opt-in
  // choice (music is off by default - nobody should be surprised by it).
  const paintMusic = () => {
    const on = getSettings().musicOn;
    musicBtn.innerHTML = `${icon("note", 2)}<span>MUSIC: ${on ? "ON" : "OFF"}</span>`;
    musicBtn.setAttribute("aria-pressed", String(on));
  };
  paintMusic();
  const stopListening = onSettingsChange((_s, key) => { if (key === "musicOn") paintMusic(); });
  musicBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSetting("musicOn", !getSettings().musicOn);
    playSfx(getSettings().musicOn ? "toggleOn" : "toggleOff");
  });

  setMusicTrack("title");

  let ready = false;
  let started = false;
  let skipBoot = false;

  function reveal() {
    if (ready) return;
    ready = true;
    bootEl.innerHTML = lines.map((l) => `<div>&gt; ${l}</div>`).join("");
    startBtn.hidden = false;
    footer.hidden = false;
    startBtn.focus({ preventScroll: true });
  }

  async function boot() {
    const fast = !getSettings().fx;
    for (const line of lines) {
      if (skipBoot || fast) break;
      const row = document.createElement("div");
      row.textContent = `> ${line}`;
      bootEl.appendChild(row);
      await wait(240);
    }
    reveal();
  }

  function start() {
    if (started) return;
    started = true;
    unlockAudio();
    playSfx("start");
    stopListening();
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("pointerdown", onPointer);
    pixelWipe(() => {
      root.hidden = true;
      onStart();
    });
  }

  function onKey(e) {
    if (e.key === "Tab" || e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
    if (e.target === musicBtn) return; // Space/Enter on the music button toggles it instead
    e.preventDefault();
    if (!ready) {
      skipBoot = true;
      reveal();
      return;
    }
    start();
  }
  function onPointer(e) {
    if (e.target.closest("#splash-music")) return;
    if (!ready) {
      skipBoot = true;
      reveal();
      return;
    }
    start();
  }

  document.addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", onPointer);
  boot();
}
