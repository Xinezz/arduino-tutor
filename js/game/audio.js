// The game's whole soundtrack and sound-effect set, synthesized live with the
// Web Audio API - there isn't a single audio file in this project. Square/
// triangle/noise voices are exactly what 8-bit hardware had, which is why
// they're also trivial to generate with a few oscillators.
//
// Browsers refuse to make sound until the person has interacted with the page
// at least once, so nothing here touches the AudioContext until unlockAudio()
// is called from a real click/keypress (app.js installs that listener). Every
// public function is a safe no-op before that, or while muted.

import { getSettings, onSettingsChange } from "./settings.js";

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let unlocked = false;
let noiseBuffer = null;
let pulse25 = null;
let pulse125 = null;

// ---------------------------------------------------------------- setup

export function unlockAudio() {
  if (unlocked) {
    if (ctx && ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    return;
  }

  // A compressor on the way out keeps stacked effects (a fanfare landing on
  // top of music, say) from clipping into harsh distortion.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 24;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;

  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);

  pulse25 = pulseWave(0.25);
  pulse125 = pulseWave(0.125);

  // iOS only truly unlocks audio once something has actually been played.
  const silent = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = silent;
  src.connect(ctx.destination);
  src.start(0);
  if (ctx.state === "suspended") ctx.resume();

  unlocked = true;
  applySettings();
  if (getSettings().musicOn && wantedTrack) startMusic(wantedTrack);
}

function applySettings() {
  if (!ctx) return;
  const s = getSettings();
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.02);
  sfxBus.gain.setTargetAtTime(s.sfxVolume * 0.9, t, 0.02);
  musicBus.gain.setTargetAtTime(s.musicVolume * 0.32, t, 0.05);
  if (!s.musicOn && music.timer) stopMusic();
  if (s.musicOn && !music.timer && wantedTrack) startMusic(wantedTrack);
}

onSettingsChange(applySettings);

// Courtesy: don't keep a synth running for a tab nobody can see.
document.addEventListener("visibilitychange", () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

export function audioState() {
  return { unlocked, state: ctx?.state ?? "none", music: music.name };
}

// A 25% / 12.5% pulse wave is THE classic chiptune lead timbre - thinner and
// more "nasal" than a plain square. Built from its Fourier series.
function pulseWave(duty) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag);
}

// ------------------------------------------------------------ notes / voices

const SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

export function noteHz(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const n = SEMI[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (n - 69) / 12);
}

function getNoise() {
  if (!noiseBuffer) {
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

// One oscillator note with a click-free envelope. `t` is an absolute context
// time (music scheduling needs that); sfx pass `delay` relative to now.
function voice({ f, d = 0.1, type = "square", wave = null, v = 0.2, t = null, delay = 0, slide = 0, a = 0.004, bus = sfxBus }) {
  if (!ctx || !bus || !f) return;
  const t0 = t ?? ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  if (wave) osc.setPeriodicWave(wave);
  else osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(d, a + 0.01));
  osc.connect(g);
  g.connect(bus);
  osc.start(t0);
  osc.stop(t0 + d + 0.03);
}

function noise({ d = 0.1, v = 0.2, t = null, delay = 0, type = "lowpass", freq = 3000, sweepTo = 0, q = 0.8, bus = sfxBus }) {
  if (!ctx || !bus) return;
  const t0 = t ?? ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = getNoise();
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(freq, t0);
  if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + d);
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(filt);
  filt.connect(g);
  g.connect(bus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + d + 0.02);
}

// ------------------------------------------------------------------ sfx

const SFX = {
  click() { voice({ f: 880, d: 0.04, v: 0.1 }); },
  select() { voice({ f: 659, d: 0.05, v: 0.11 }); voice({ f: 988, d: 0.06, v: 0.1, delay: 0.045 }); },
  confirm() { voice({ f: 523, d: 0.07, v: 0.14 }); voice({ f: 784, d: 0.12, v: 0.14, delay: 0.06 }); },
  back() { voice({ f: 659, d: 0.06, v: 0.12 }); voice({ f: 440, d: 0.1, v: 0.12, delay: 0.05 }); },
  error() {
    voice({ f: 160, d: 0.2, type: "sawtooth", v: 0.14, slide: 80 });
    voice({ f: 120, d: 0.22, v: 0.1, delay: 0.09 });
  },
  correct() {
    ["C5", "E5", "G5"].forEach((n, i) => voice({ f: noteHz(n), d: 0.09, v: 0.14, delay: i * 0.07 }));
    voice({ f: noteHz("C6"), d: 0.2, v: 0.14, delay: 0.21 });
  },
  wrong() {
    voice({ f: 220, d: 0.16, v: 0.15, slide: 110 });
    voice({ f: 165, d: 0.24, v: 0.14, slide: 70, delay: 0.13 });
  },
  coin() { voice({ f: 988, d: 0.07, v: 0.15 }); voice({ f: 1319, d: 0.32, v: 0.15, delay: 0.07 }); },
  spend() {
    voice({ f: 440, d: 0.06, v: 0.13 });
    voice({ f: 330, d: 0.09, v: 0.13, delay: 0.06 });
    voice({ f: 220, d: 0.14, v: 0.12, delay: 0.12 });
  },
  hint() { ["C6", "E6", "G6", "C7"].forEach((n, i) => voice({ f: noteHz(n), d: 0.09, type: "triangle", v: 0.17, delay: i * 0.05 })); },
  blip() { voice({ f: 470 + Math.random() * 170, d: 0.028, v: 0.06 }); },
  toggleOn() { voice({ f: 523, d: 0.05, v: 0.12 }); voice({ f: 784, d: 0.08, v: 0.12, delay: 0.05 }); },
  toggleOff() { voice({ f: 784, d: 0.05, v: 0.12 }); voice({ f: 523, d: 0.08, v: 0.12, delay: 0.05 }); },
  equip() { voice({ f: noteHz("E5"), d: 0.05, v: 0.13 }); voice({ f: noteHz("B5"), d: 0.12, v: 0.13, delay: 0.05 }); },
  step() { voice({ f: 200, d: 0.03, type: "triangle", v: 0.1 }); },
  mission() { ["E5", "G5", "C6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.1, v: 0.14, delay: i * 0.08 })); },
  whoosh() { noise({ d: 0.35, v: 0.14, type: "bandpass", freq: 300, sweepTo: 4200, q: 1.2 }); },
  start() {
    ["C4", "E4", "G4", "C5", "E5", "G5", "C6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.09, v: 0.13, delay: i * 0.055 }));
    voice({ f: noteHz("C6"), d: 0.45, v: 0.12, delay: 0.4 });
    voice({ f: noteHz("E6"), d: 0.45, type: "triangle", v: 0.12, delay: 0.4 });
    noise({ d: 0.5, v: 0.06, type: "highpass", freq: 6000, delay: 0.38 });
  },
  lessonComplete() {
    ["C5", "E5", "G5", "C6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.1, v: 0.14, delay: i * 0.075 }));
    voice({ f: 1319, d: 0.3, v: 0.12, delay: 0.32 });
  },
  challengeComplete() {
    ["G4", "C5", "E5", "G5", "C6", "E6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.11, v: 0.14, delay: i * 0.07 }));
    voice({ f: noteHz("G6"), d: 0.55, v: 0.12, delay: 0.46 });
    voice({ f: noteHz("E6"), d: 0.55, type: "triangle", v: 0.12, delay: 0.46 });
    voice({ f: noteHz("C4"), d: 0.6, type: "triangle", v: 0.18, delay: 0.46 });
  },
  levelUp() {
    ["C5", "E5", "G5", "C6", "E6", "G6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.12, v: 0.14, delay: i * 0.07 }));
    ["C6", "E6", "G6"].forEach((n) => voice({ f: noteHz(n), d: 0.6, type: n === "E6" ? "triangle" : "square", v: 0.11, delay: 0.46 }));
    voice({ f: noteHz("C4"), d: 0.7, type: "triangle", v: 0.2, delay: 0.46 });
    noise({ d: 0.6, v: 0.05, type: "highpass", freq: 7000, delay: 0.44 });
  },
  achievement() {
    ["G5", "C6", "E6", "G6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.1, v: 0.14, delay: i * 0.08 }));
    voice({ f: noteHz("C7"), d: 0.5, type: "triangle", v: 0.14, delay: 0.34 });
    noise({ d: 0.45, v: 0.05, type: "highpass", freq: 8000, delay: 0.32 });
  },
  chestOpen() {
    voice({ f: 180, d: 0.55, type: "sawtooth", v: 0.1, slide: 900 });
    ["E6", "G6", "C7", "E7"].forEach((n, i) => voice({ f: noteHz(n), d: 0.14, type: "triangle", v: 0.15, delay: 0.5 + i * 0.07 }));
    noise({ d: 0.6, v: 0.06, type: "highpass", freq: 7000, delay: 0.5 });
  },
  bossHit() {
    noise({ d: 0.18, v: 0.3, type: "lowpass", freq: 900, sweepTo: 120 });
    voice({ f: 140, d: 0.18, type: "sawtooth", v: 0.18, slide: 50 });
  },
  boom() {
    noise({ d: 0.7, v: 0.4, type: "lowpass", freq: 1200, sweepTo: 60 });
    voice({ f: 90, d: 0.6, type: "sine", v: 0.45, slide: 35 });
  },
  bossDefeat() {
    SFX.boom();
    ["D4", "F4", "A4", "D5", "F5", "A5", "D6"].forEach((n, i) => voice({ f: noteHz(n), d: 0.12, v: 0.14, delay: 0.55 + i * 0.075 }));
    voice({ f: noteHz("D6"), d: 0.7, v: 0.12, delay: 1.1 });
    voice({ f: noteHz("A5"), d: 0.7, type: "triangle", v: 0.12, delay: 1.1 });
    voice({ f: noteHz("D3"), d: 0.8, type: "triangle", v: 0.2, delay: 1.1 });
  },
  purchase() {
    noise({ d: 0.05, v: 0.18, type: "highpass", freq: 5000 });
    voice({ f: 1568, d: 0.07, v: 0.14, delay: 0.04 });
    voice({ f: 2093, d: 0.38, v: 0.14, delay: 0.11 });
  },
  konami() {
    ["C5", "C5", "G5", "G5", "A5", "A5", "G5", "F5", "F5", "E5", "E5", "D5", "D5", "C5"].forEach((n, i) =>
      voice({ f: noteHz(n), d: 0.08, v: 0.12, delay: i * 0.065 })
    );
  },
};

export function playSfx(name) {
  if (!ctx || getSettings().muted) return;
  if (ctx.state === "suspended") ctx.resume();
  try {
    SFX[name]?.();
  } catch {
    // a failed beep should never take the page down with it
  }
}

// ---------------------------------------------------------------- music
//
// Every bar is 16 sixteenth-note steps. In a bar string, a note name starts a
// note, "-" holds the previous one, "." is a rest. Drum bars use k=kick,
// s=snare, h=hat. Kept as plain strings so a tune can be read (and tweaked)
// right in the source.

const TRACKS = {
  // Heroic title/menu theme: C - Am - F - G, twice, second pass an octave up.
  title: {
    bpm: 138,
    bars: [
      { lead: "E5 - G5 - E5 - C5 - D5 - E5 - G5 - - -", bass: "C3 - C3 - G3 - C3 - C3 - C3 - G3 - E3 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "A4 - C5 - E5 - A5 - G5 - E5 - C5 - - -", bass: "A2 - A2 - E3 - A2 - A2 - A2 - E3 - C3 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "F5 - A5 - C6 - A5 - G5 - F5 - A5 - - -", bass: "F2 - F2 - C3 - F2 - F2 - F2 - C3 - A2 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "G5 - B5 - D6 - B5 - G5 - D5 - G5 - B5 -", bass: "G2 - G2 - D3 - G2 - G2 - G2 - D3 - B2 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "C6 - - - G5 - E5 - G5 - C6 - E6 - - -", bass: "C3 - C3 - G3 - C3 - C3 - C3 - G3 - E3 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "E6 - C6 - A5 - C6 - E6 - A5 - C6 - - -", bass: "A2 - A2 - E3 - A2 - A2 - A2 - E3 - C3 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "A5 - C6 - F6 - C6 - A5 - F5 - A5 - C6 -", bass: "F2 - F2 - C3 - F2 - F2 - F2 - C3 - A2 -", drums: "k . h . s . h . k . h . s . h h" },
      { lead: "D6 - B5 - G5 - B5 - D6 - - - G5 - . .", bass: "G2 - G2 - D3 - G2 - G2 - G2 - D3 - B2 -", drums: "k . h . s . h . k . h . s k s s" },
    ],
  },
  // Calm study loop: soft arpeggios over Am - F - C - G.
  study: {
    bpm: 86,
    bars: [
      { arp: "A3 C4 E4 C4 A3 C4 E4 C4 A3 C4 E4 A4 E4 C4 E4 C4", lead: "E5 - - - . . . . D5 - - - C5 - - -", bass: "A2 - - - - - - - E3 - - - - - - -", drums: "k . . . s . . . . . k . s . . h" },
      { arp: "F3 A3 C4 A3 F3 A3 C4 A3 F3 A3 C4 F4 C4 A3 C4 A3", lead: "A4 - - - . . C5 - - - A4 - - - . .", bass: "F2 - - - - - - - C3 - - - - - - -", drums: "k . . . s . . . . . k . s . . h" },
      { arp: "C4 E4 G4 E4 C4 E4 G4 E4 C4 E4 G4 C5 G4 E4 G4 E4", lead: "G4 - - - E5 - - - D5 - - - C5 - - -", bass: "C3 - - - - - - - G2 - - - - - - -", drums: "k . . . s . . . . . k . s . . h" },
      { arp: "G3 B3 D4 B3 G3 B3 D4 B3 G3 B3 D4 G4 D4 B3 D4 B3", lead: "B4 - - - D5 - - - G5 - - - . . . .", bass: "G2 - - - - - - - D3 - - - - - - -", drums: "k . . . s . . . . . k . s . h h" },
    ],
  },
  // Boss theme: driving D minor, fast drums.
  boss: {
    bpm: 150,
    bars: [
      { lead: "D5 - - - F5 - - - A5 - G5 - F5 - E5 -", bass: "D2 - D2 - D2 - D2 - D2 - D2 - F2 - E2 -", drums: "k . h . s . h . k . k . s . h h" },
      { lead: "D5 - - - A5 - - - D6 - C6 - A5 - F5 -", bass: "D2 - D2 - D2 - D2 - D2 - D2 - A2 - C3 -", drums: "k . h . s . h . k . k . s . h h" },
      { lead: "Bb4 - - - D5 - - - F5 - A5 - D6 - - -", bass: "Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - Bb1 - F2 - D2 -", drums: "k . h . s . h . k . k . s . h h" },
      { lead: "C#5 - E5 - A5 - C#6 - E6 - - - . . . .", bass: "A1 - A1 - A1 - A1 - A1 - A1 - C#2 - E2 -", drums: "k . h . s . h . k . k . s s s s" },
    ],
  },
};

// Turn each track's bar strings into a flat step -> [events] table once.
for (const track of Object.values(TRACKS)) {
  const steps = track.bars.length * 16;
  track.steps = steps;
  track.events = Array.from({ length: steps }, () => []);
  for (const ch of ["lead", "bass", "arp", "drums"]) {
    let last = null;
    let step = 0;
    for (const bar of track.bars) {
      const tokens = (bar[ch] ?? "").trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < 16; i++) {
        const tk = tokens[i] ?? ".";
        if (tk === "-") {
          if (last) last.len++;
        } else if (tk === ".") {
          last = null;
        } else {
          last = { ch, note: tk, len: 1 };
          track.events[step].push(last);
        }
        step++;
      }
    }
  }
}

const music = { name: null, timer: null, step: 0, next: 0, track: null, gain: null };
let wantedTrack = null;

// Which tune a screen WANTS to hear. Remembered even when music is off or the
// audio context isn't unlocked yet, so flipping music on later picks it up.
export function setMusicTrack(name) {
  wantedTrack = name;
  if (!ctx || !getSettings().musicOn) return;
  if (music.name === name && music.timer) return;
  startMusic(name);
}

function startMusic(name) {
  const track = TRACKS[name];
  if (!ctx || !track) return;
  stopMusic();
  music.name = name;
  music.track = track;
  music.step = 0;
  music.next = ctx.currentTime + 0.06;
  music.gain = ctx.createGain();
  music.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  music.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
  music.gain.connect(musicBus);
  const tick = () => {
    if (!music.track) return;
    // If the tab was throttled for a while, don't try to "catch up" on a pile
    // of missed steps at once - just resume from now.
    if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
    const stepDur = 60 / music.track.bpm / 4;
    while (music.next < ctx.currentTime + 0.18) {
      playMusicStep(music.track, music.step, music.next, stepDur);
      music.next += stepDur;
      music.step = (music.step + 1) % music.track.steps;
    }
    music.timer = setTimeout(tick, 30);
  };
  tick();
}

export function stopMusic() {
  if (music.timer) clearTimeout(music.timer);
  music.timer = null;
  music.track = null;
  music.name = null;
  if (music.gain && ctx) {
    const g = music.gain;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    setTimeout(() => { try { g.disconnect(); } catch { /* already gone */ } }, 300);
  }
  music.gain = null;
}

// Briefly lower the music so a fanfare sits on top of it instead of fighting.
export function duckMusic(ms = 1800, amount = 0.25) {
  if (!ctx || !musicBus) return;
  const base = getSettings().musicVolume * 0.32;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(base * amount, t, 0.04);
  musicBus.gain.setTargetAtTime(base, t + ms / 1000, 0.25);
}

function playMusicStep(track, i, t, stepDur) {
  const out = music.gain;
  for (const e of track.events[i]) {
    const dur = e.len * stepDur;
    if (e.ch === "lead") {
      voice({ f: noteHz(e.note), t, d: dur * 0.92, wave: pulse25, v: 0.2, bus: out });
    } else if (e.ch === "bass") {
      voice({ f: noteHz(e.note), t, d: dur * 0.95, type: "triangle", v: 0.34, bus: out });
    } else if (e.ch === "arp") {
      voice({ f: noteHz(e.note), t, d: dur * 1.4, wave: pulse125, v: 0.1, bus: out });
    } else if (e.ch === "drums") {
      if (e.note === "k") voice({ f: 150, t, d: 0.13, type: "sine", v: 0.5, slide: 45, bus: out });
      else if (e.note === "s") {
        noise({ t, d: 0.11, v: 0.2, type: "bandpass", freq: 1900, q: 0.6, bus: out });
        voice({ f: 210, t, d: 0.06, type: "triangle", v: 0.12, bus: out });
      } else if (e.note === "h") noise({ t, d: 0.03, v: 0.08, type: "highpass", freq: 8000, bus: out });
    }
  }
}
