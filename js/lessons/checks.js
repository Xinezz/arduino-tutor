// "Check My Solution": every challenge's goal written down as behaviour the
// simulator can measure. The learner's code is run off-screen on a fake
// clock (js/simulator/headless.js) with scripted inputs - a button pressed
// between 1 and 2 seconds, a knob turned, an obstacle at 5 cm - and what it
// does is compared with what the challenge asks for.
//
// Feedback describes BEHAVIOUR ("the LED turns on but never turns off"), not
// the answer, so it points the learner at the problem without solving it for
// them. Where a challenge says "wire ...", the circuit on the lesson's board
// is checked too, using the board's own circuit check (only what's really
// wired, never a guess).
//
// runChallengeCheck(id, code, findings) -> {
//   status: "pass" | "fail" | "error",
//   items: [{ ok, text, goal, independent }], the checklist, in order
//   error: explainError(...) | null, when the code didn't compile or crashed
//   circuitChecked: boolean
// }

import { simulate } from "../simulator/headless.js";
import { explainError } from "../simulator/feedback.js";

// ---------- small helpers ----------

// One goal of a challenge. `goal` is how it reads as a goal ("The LED turns
// on"); `text` is what to show now - the goal when met, otherwise what went
// wrong. Independent goals (the circuit) are always explained; the code's
// goals build on each other, so only the first unmet one is (see the UI).
const item = (ok, okText, failText, independent = false) => ({ ok: !!ok, text: ok ? okText : failText, goal: okText, independent });
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const average = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const gaps = (ts) => ts.slice(1).map((t, i) => t - ts[i]);
const numbers = (sim) => sim.printed.filter((p) => p.text.trim() !== "").map((p) => ({ t: p.t, v: Number(p.text.trim()) })).filter((p) => Number.isFinite(p.v));
const arduinoMap = (x, inMin, inMax, outMin, outMax) => Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin;
const writesTo = (sim, pin) => sim.calls.filter((c) => (c.name === "digitalWrite" || c.name === "analogWrite") && c.args[0] === pin);
const analogWritesTo = (sim, pin) => sim.calls.filter((c) => c.name === "analogWrite" && c.args[0] === pin).map((c) => ({ t: c.t, v: c.args[1] }));
const rangeWarning = (sim) => sim.warnings.find((w) => /has to be between 0 and 255/.test(w));

// Is this pin driven as an output? The most common beginner slip is
// switching a pin that was never set up with pinMode(pin, OUTPUT).
function outputItem(sim, pin, what) {
  const writes = writesTo(sim, pin);
  if (!writes.length) return item(false, `Pin ${pin} (${what}) is an OUTPUT`, `Your sketch never switches pin ${pin} (${what}) - use digitalWrite(${pin}, ...) to turn it on and off.`);
  return item(sim.hardware.modes[pin] === "OUTPUT", `Pin ${pin} (${what}) is an OUTPUT`,
    `You switch pin ${pin}, but it's never set up as an OUTPUT, so the ${what} can't light - add pinMode(${pin}, OUTPUT); to setup().`);
}

// The stretches of time an output pin spent on and off: [{ from, to, on }].
// Only stretches that both start and end with a change are "complete".
function stretches(sim, pin) {
  const changes = sim.hardware.events.filter((e) => e.pin === pin);
  const out = [];
  for (let i = 1; i < changes.length; i++) {
    out.push({ from: changes[i - 1].t, to: changes[i].t, on: changes[i - 1].level > 0 });
  }
  return out.filter((s) => s.to > s.from);
}

// ---------- the circuit on the lesson's board ----------

function goodPart(findings, kind, test = () => true) {
  const problemIds = new Set(findings.filter((f) => f.level === "problem").map((f) => f.id));
  return findings.find((f) => f.level === "ok" && f.id?.startsWith(`${kind}-`) && !problemIds.has(f.id) && test(f.data || {}));
}

const circuit = {
  led: (pin) => (findings) => {
    const led = goodPart(findings, "led", (d) => d.pin === pin);
    const goal = `Circuit: LED on pin ${pin}, with its resistor`;
    if (led && led.data.resistor) return item(true, goal, "", true);
    if (led) return item(false, goal, `Circuit: your LED on pin ${pin} has no resistor. Put a 220Ω resistor in series - a real LED would burn out without one.`, true);
    return item(false, goal, `Circuit: wire an LED to pin ${pin} - pin ${pin} → resistor → LED + (long leg), LED − → GND. Check Circuit shows what's connected now.`, true);
  },
  button: (pin) => (findings) => item(goodPart(findings, "button", (d) => d.pin === pin && d.to === "gnd"),
    `Circuit: button between pin ${pin} and GND`,
    `Circuit: wire a button with one leg on pin ${pin} and the other leg on GND.`, true),
  pot: (findings) => item(goodPart(findings, "potentiometer", (d) => d.pin === 14),
    "Circuit: potentiometer's middle leg on A0",
    "Circuit: wire a potentiometer's middle leg (W) to A0.", true),
  ldr: (findings) => item(goodPart(findings, "ldr", (d) => d.pin === 14),
    "Circuit: light sensor on A0",
    "Circuit: wire a light sensor's S leg to A0 and its − leg to GND.", true),
  buzzer: (pin) => (findings) => item(goodPart(findings, "buzzer", (d) => d.pin === pin),
    `Circuit: buzzer on pin ${pin}, − leg to GND`,
    `Circuit: wire a buzzer's + leg to pin ${pin} and its − leg to GND.`, true),
  servo: (pin) => (findings) => item(goodPart(findings, "servo", (d) => d.pin === pin),
    `Circuit: servo signal on pin ${pin}`,
    `Circuit: wire the servo's S (signal) leg to pin ${pin}.`, true),
  ir: (pin) => (findings) => item(goodPart(findings, "irsensor", (d) => d.pin === pin),
    `Circuit: IR sensor on pin ${pin}`,
    `Circuit: wire an IR sensor's S leg to pin ${pin} and its − leg to GND.`, true),
  ultrasonic: (trig, echo) => (findings) => item(goodPart(findings, "ultrasonic", (d) => d.trig === trig && d.echo === echo),
    `Circuit: ultrasonic sensor, trig on ${trig} and echo on ${echo}`,
    `Circuit: wire the ultrasonic sensor's T (trig) leg to pin ${trig} and E (echo) leg to pin ${echo}.`, true),
  rgb: (r, g, b) => (findings) => item(goodPart(findings, "rgbled", (d) => d.r === r && d.g === g && d.b === b),
    `Circuit: RGB LED - R on ${r}, G on ${g}, B on ${b}, − to GND`,
    `Circuit: wire the RGB LED's R leg to pin ${r}, G to ${g}, B to ${b} and its − leg to GND.`, true),
};

// ---------- the challenges ----------

// pressed(windows): a digitalRead input that reads LOW (pressed, with
// INPUT_PULLUP) on `pin` during each [from, to) window, HIGH otherwise.
const lowDuring = (pin, windows) => (p, t) => (p === pin && windows.some(([a, b]) => t >= a && t < b) ? 0 : 1);
// phases([[from, to, value], ...], otherwise): an analogRead input that
// returns `value` during each window (whatever the pin).
const phases = (list, fallback) => (pin, t) => (list.find(([a, b]) => t >= a && t < b)?.[2] ?? fallback);
const usToCm = (us) => us / 58;

export const CHALLENGE_CHECKS = {
  c1: {
    ms: 3600,
    check(sim) {
      const lines = sim.printed.map((p) => p.text.trim()).filter(Boolean);
      const hello = sim.printed.filter((p) => p.text.trim() === "Hello Arduino");
      const wrong = lines.find((l) => l !== "Hello Arduino");
      const g = gaps(hello.map((p) => p.t));
      return [
        item(!sim.warnings.some((w) => /before Serial\.begin/.test(w)), "Serial is started with Serial.begin()",
          "Start the Serial Monitor with Serial.begin(9600); in setup() - without it a real Uno shows nothing."),
        item(lines.length && !wrong, "It prints exactly \"Hello Arduino\"",
          lines.length ? `It printed "${wrong}" - the message should be exactly Hello Arduino (same spelling and capitals).` : "Nothing was printed - use Serial.println(\"Hello Arduino\"); inside loop()."),
        item(hello.length >= 3 && g.every((x) => Math.abs(x - 1000) <= 60), "It repeats once a second",
          hello.length < 2 ? "It only printed once - code in setup() runs once; put the println in loop() so it repeats." : `It repeats every ${Math.round(average(g))} ms - it should be once a second (1000 ms).`),
      ];
    },
  },

  c2: {
    ms: 2200,
    check(sim, code) {
      const clean = stripComments(code);
      const thirteens = (clean.match(/\b13\b/g) || []).length;
      const blinks = stretches(sim, 13).length >= 3;
      return [
        item(/\b(?:const\s+)?(?:int|byte|short|long|uint8_t)\s+ledPin\s*=\s*13\s*;/.test(clean), "The pin number is stored in a variable called ledPin",
          "Declare the variable at the top: int ledPin = 13;"),
        item(thirteens === 1, "13 appears only once - everywhere else uses ledPin",
          thirteens === 0 ? "13 doesn't appear at all - ledPin still needs to be given the value 13." : `13 still appears ${thirteens} times - every place that means "the LED pin" should say ledPin instead.`),
        outputItem(sim, 13, "LED"),
        item(blinks, "It still blinks the LED on pin 13", "The LED on pin 13 doesn't blink any more - it should still turn on and off, using ledPin."),
      ];
    },
  },

  c3: {
    ms: 3200,
    circuit: [circuit.led(13)],
    check(sim) {
      const s = stretches(sim, 13);
      const on = s.filter((x) => x.on).map((x) => x.to - x.from);
      const off = s.filter((x) => !x.on).map((x) => x.to - x.from);
      const everOn = sim.hardware.events.some((e) => e.pin === 13 && e.level > 0);
      const close = (xs) => xs.length >= 2 && xs.every((d) => Math.abs(d - 500) <= 40);
      return [
        outputItem(sim, 13, "LED"),
        item(everOn, "The LED turns on", "The LED never turns on - switch pin 13 HIGH with digitalWrite(13, HIGH)."),
        item(everOn && off.length > 0, "The LED turns off again", "The LED turns on but never turns off - it needs a digitalWrite(13, LOW) and a second delay()."),
        item(close(on) && close(off), "On for half a second, off for half a second, repeating",
          on.length ? `It stays on for about ${Math.round(average(on))} ms and off for about ${Math.round(average(off))} ms - both should be 500 ms (half a second).` : "It doesn't repeat the on/off pattern - it should keep going forever."),
      ];
    },
  },

  c4: {
    ms: 3500,
    inputs: { digitalRead: lowDuring(7, [[1000, 2000], [3000, 3500]]) },
    circuit: [circuit.led(13), circuit.button(7)],
    check(sim) {
      const mode = sim.hardware.modes[7];
      const lv = (t) => sim.hardware.levelAt(13, t);
      return [
        item(mode === "INPUT_PULLUP", "The button pin uses INPUT_PULLUP",
          mode === "INPUT" ? "The button pin is INPUT - with nothing pulling it up it floats when released. Use pinMode(7, INPUT_PULLUP)." : "Set the button pin up with pinMode(7, INPUT_PULLUP); in setup()."),
        outputItem(sim, 13, "LED"),
        item(lv(1500) > 0 && lv(3300) > 0, "The LED is on while the button is held",
          "The LED doesn't turn on while the button is held. Remember: with INPUT_PULLUP, a pressed button reads LOW."),
        item(lv(500) === 0 && lv(2500) === 0, "The LED is off when the button is released",
          "The LED is on even when the button is released - check which reading (HIGH or LOW) means \"pressed\"."),
      ];
    },
  },

  c5: {
    ms: 14200,
    circuit: [circuit.led(10), circuit.led(9), circuit.led(8)],
    check(sim) {
      const lit = (t) => [8, 9, 10].filter((p) => sim.hardware.levelAt(p, t) > 0);
      const only = (pin, ts) => ts.every((t) => { const l = lit(t); return l.length === 1 && l[0] === pin; });
      let clash = null;
      for (let t = 100; t < 14000 && clash === null; t += 100) if (lit(t).length > 1) clash = t;
      return [
        item([8, 9, 10].every((p) => sim.hardware.modes[p] === "OUTPUT"), "Pins 8, 9 and 10 are all OUTPUTs",
          `Set all three LED pins up as outputs - pinMode(..., OUTPUT) for pins 8, 9 and 10 (missing: ${[8, 9, 10].filter((p) => sim.hardware.modes[p] !== "OUTPUT").join(", ")}).`),
        item(only(10, [200, 1500, 2850]), "Green (pin 10) comes first, for 3 seconds",
          "The cycle should start with only the green LED (pin 10) on, for 3 seconds."),
        item(only(9, [3150, 3500, 3850]), "Then yellow (pin 9), for 1 second",
          "After green, only the yellow LED (pin 9) should be on, for 1 second."),
        item(only(8, [4150, 5500, 6850]), "Then red (pin 8), for 3 seconds",
          "After yellow, only the red LED (pin 8) should be on, for 3 seconds."),
        item(only(10, [7200, 8500]) && only(9, [10500]) && only(8, [12500]), "Then it starts again",
          "After red, the cycle should go back to green and repeat forever."),
        item(clash === null, "Only one LED is lit at a time",
          `At ${((clash ?? 0) / 1000).toFixed(1)} s more than one LED is lit - switch each one off before the next comes on.`),
      ];
    },
  },

  c6: {
    ms: 2600,
    inputs: { digitalRead: lowDuring(7, [[500, 800], [1200, 1500], [2000, 2300]]) },
    circuit: [circuit.button(7)],
    check(sim) {
      const lines = sim.printed.map((p) => p.text.trim()).filter(Boolean);
      const counts = lines.map(Number);
      const mode = sim.hardware.modes[7];
      return [
        item(mode === "INPUT_PULLUP", "The button pin uses INPUT_PULLUP", "Set the button pin up with pinMode(7, INPUT_PULLUP); in setup()."),
        item(!sim.warnings.some((w) => /before Serial\.begin/.test(w)) && lines.length > 0, "It prints to the Serial Monitor",
          lines.length ? "Start Serial with Serial.begin(9600); in setup()." : "Nothing was printed - print the count with Serial.println() each time a press is counted."),
        item(lines.length === 3 && counts.join() === "1,2,3", "Three presses print 1, 2, 3 - each press counted once",
          lines.length > 3
            ? `Three presses printed ${lines.length} numbers - loop() runs many times while the button is held, so each press is counted over and over. Only count the moment the reading CHANGES from HIGH to LOW (remember the previous reading).`
            : lines.length ? `Three presses printed ${lines.join(", ")} - it should print 1, then 2, then 3.` : "Three presses didn't print anything."),
      ];
    },
  },

  c7: {
    ms: 2000,
    inputs: { analogRead: (pin, t) => Math.round(100 + (t / 2000) * 800) },
    circuit: [circuit.pot],
    check(sim) {
      const reads = sim.calls.filter((c) => c.name === "analogRead" && c.args[0] === 14).map((c) => c.value);
      const printed = numbers(sim);
      const perSecond = printed.length / 2;
      return [
        item(reads.length > 0, "It reads A0 with analogRead()", "Read the potentiometer with analogRead(A0)."),
        item(printed.length > 0 && printed.every((p) => reads.includes(p.v)), "It prints the readings",
          printed.length ? "The numbers printed aren't the readings - print the value analogRead() returned." : "Nothing was printed - print each reading with Serial.println()."),
        item(perSecond >= 7 && perSecond <= 14, "About 10 readings a second",
          `It prints about ${Math.round(perSecond)} readings a second - aim for about 10: delay(100) between readings.`),
      ];
    },
  },

  c9: {
    ms: 2000,
    inputs: { analogRead: phases([[0, 500, 0], [500, 1000, 1023], [1000, 1500, 512]], 256) },
    circuit: [circuit.pot],
    check(sim) {
      const reads = sim.calls.filter((c) => c.name === "analogRead" && c.args[0] === 14);
      const printed = numbers(sim);
      const readBefore = (t) => [...reads].reverse().find((r) => r.t <= t)?.value;
      const right = printed.filter((p) => { const raw = readBefore(p.t); return raw !== undefined && Math.abs(p.v - arduinoMap(raw, 0, 1023, 0, 100)) <= 1; });
      const raw = printed.some((p) => p.v > 100);
      const perSecond = printed.length / 2;
      return [
        item(reads.length > 0, "It reads A0 with analogRead()", "Read the potentiometer with analogRead(A0)."),
        item(printed.length > 0 && right.length === printed.length, "It prints 0-100: a percentage",
          raw ? "It prints the raw reading (0-1023). Convert it to 0-100 first - which function rescales a number from one range to another?" : printed.length ? "The numbers printed don't match the knob's position as a percentage (0 at one end, 100 at the other)." : "Nothing was printed."),
        item(printed.some((p) => p.v === 0) && printed.some((p) => p.v === 100), "0% and 100% at the two ends of the knob",
          "Turning the knob fully one way should print 0, and fully the other way 100."),
        item(perSecond >= 7 && perSecond <= 14, "About 10 updates a second", `It prints about ${Math.round(perSecond)} times a second - aim for about 10: delay(100).`),
      ];
    },
  },

  c8: {
    ms: 3000,
    inputs: { analogRead: phases([[0, 1000, 50], [1000, 2000, 500]], 1000) },
    circuit: [circuit.ldr],
    check(sim) {
      const said = (word, a, b) => sim.printed.some((p) => p.t >= a && p.t < b && p.text.trim() === word);
      const rawLines = numbers(sim);
      const perSecond = rawLines.length / 3;
      return [
        item([50, 500, 1000].every((v) => rawLines.some((p) => p.v === v)), "It prints the raw reading", "Print the raw reading too: Serial.println(value)."),
        item(said("Dark", 0, 1000) && !said("Bright", 0, 1000), "A very low reading (50) prints \"Dark\"", "With a reading of 50 (almost no light) it should print Dark."),
        item(said("Dim", 1000, 2000), "A middle reading (500) prints \"Dim\"", "With a middle reading of 500 it should print Dim."),
        item(said("Bright", 2000, 3000) && !said("Dark", 2000, 3000), "A high reading (1000) prints \"Bright\"", "With a reading of 1000 (lots of light) it should print Bright."),
        item(perSecond >= 3 && perSecond <= 8, "About 5 readings a second", `It logs about ${Math.round(perSecond)} readings a second - aim for about 5: delay(200).`),
      ];
    },
  },

  c10: {
    ms: 1500,
    inputs: { analogRead: phases([[0, 500, 0], [500, 1000, 1023]], 512) },
    circuit: [circuit.pot, circuit.led(9)],
    check(sim) {
      const usesAnalog = analogWritesTo(sim, 9).length > 0;
      const lv = (t) => sim.hardware.levelAt(9, t);
      return [
        item(usesAnalog, "It sets the LED's brightness with analogWrite() on pin 9",
          writesTo(sim, 9).length ? "digitalWrite() can only switch fully on or off - use analogWrite(9, value) to set a brightness." : "Set the LED's brightness with analogWrite(9, value)."),
        item(!rangeWarning(sim), "The brightness stays within 0-255",
          "analogWrite() only takes 0-255, but the reading goes up to 1023 - rescale it first (which function changes one range into another?)."),
        item(usesAnalog && lv(450) <= 5 && lv(950) >= 250, "Knob at one end = off, other end = full brightness",
          "Turning the knob fully down should switch the LED off, and fully up should make it fully bright."),
        item(usesAnalog && lv(1450) >= 110 && lv(1450) <= 145, "Knob in the middle = about half brightness",
          `With the knob in the middle the LED should be about half bright (around 127); it was ${lv(1450)}.`),
      ];
    },
  },

  c11: {
    ms: 6000,
    circuit: [circuit.led(9)],
    check(sim) {
      const values = analogWritesTo(sim, 9).map((w) => w.v);
      const distinct = new Set(values).size;
      let longestFall = 0, run = 0, bigDrop = false;
      for (let i = 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];
        if (d < 0 && d >= -30) { run++; longestFall = Math.max(longestFall, run); } else run = 0;
        if (d < -100) bigDrop = true;
      }
      return [
        item(values.length > 0, "It uses analogWrite() on pin 9", "Fade the LED with analogWrite(9, brightness)."),
        item(distinct >= 20, "Small steps, so it's smooth", "The brightness changes in too few steps to look smooth - change it a little at a time, with a short delay()."),
        item(Math.max(...values, 0) >= 240 && Math.min(...values) <= 15, "It goes all the way from dark to full brightness", "It should rise all the way to full brightness (255) and back down to off (0)."),
        item(longestFall >= 10 && !bigDrop, "It fades back down smoothly - not a snap-back",
          bigDrop ? "It snaps from bright straight back to dark - that's the sawtooth. Make the brightness count back DOWN, step by step." : "It never fades back down - when it reaches the top, make it start counting down."),
        item(!rangeWarning(sim), "The brightness stays within 0-255", "Some values went outside 0-255 - stop (or turn around) at the ends so analogWrite() never gets 256 or -5."),
      ];
    },
  },

  c12: {
    ms: 2000,
    circuit: [circuit.buzzer(8)],
    check(sim) {
      const starts = sim.hardware.sounds.filter((s) => s.pin === 8 && s.freq !== null).sort((a, b) => a.t - b.t);
      const freqs = starts.map((s) => s.freq);
      const alternates = freqs.length >= 4 && freqs.every((f, i) => i === 0 || f !== freqs[i - 1]);
      const g = gaps(starts.map((s) => s.t));
      return [
        item(starts.length > 0, "It plays tones on pin 8", "Play the sound on pin 8 with tone(8, frequency, duration)."),
        item(freqs.includes(800) && freqs.includes(1200), "Both pitches: 800 Hz and 1200 Hz", `It plays ${[...new Set(freqs)].join(" and ") || "no"} Hz - it should use 800 Hz and 1200 Hz.`),
        item(alternates, "The two pitches alternate", "The pitches should take turns: 800, 1200, 800, 1200..."),
        item(g.length >= 3 && g.every((x) => Math.abs(x - 200) <= 30), "Each tone lasts 200 ms",
          g.length ? `A new tone starts every ${Math.round(average(g))} ms - each should last 200 ms.` : "It doesn't keep alternating - it should repeat forever."),
      ];
    },
  },

  c14: {
    ms: 8000,
    circuit: [circuit.rgb(9, 10, 11)],
    check(sim) {
      const ch = [9, 10, 11].map((p) => analogWritesTo(sim, p).map((w) => w.v));
      const smooth = (vs) => vs.every((v, i) => i === 0 || Math.abs(v - vs[i - 1]) <= 60);
      const late = [9, 10, 11].map((p) => new Set(analogWritesTo(sim, p).filter((w) => w.t > 6000).map((w) => w.v)).size);
      const samples = [1000, 2500, 4000, 5500, 7000].map((t) => [9, 10, 11].map((p) => sim.hardware.levelAt(p, t)));
      return [
        item(ch.every((vs) => vs.length > 0), "All three colors are set with analogWrite() (pins 9, 10, 11)",
          `Drive each color with analogWrite() - pins ${[9, 10, 11].filter((_, i) => !ch[i].length).join(", ")} never got one.`),
        item(ch.every((vs) => new Set(vs).size >= 15), "Every color changes through many shades", "Each color should drift through many brightness levels, not just a few."),
        item(ch.every(smooth), "The colors drift smoothly - no sudden jumps", "A color jumps suddenly at some point - change each one a little at a time."),
        item(late.every((n) => n >= 3), "It keeps drifting forever", "The colors stop changing after a while - make each one turn around at 0 and 255 and keep going."),
        item(samples.some(([r, g, b]) => !(r === g && g === b)), "The colors mix into different shades", "All three channels are always equal, so it only ever shows white-ish light - give them different speeds or starting points."),
        item(!rangeWarning(sim), "Every value stays within 0-255", "Some values went outside 0-255 - a real Uno would flicker. Keep each color in range (constrain() helps)."),
      ];
    },
  },

  c13: {
    ms: 12000,
    circuit: [circuit.servo(9)],
    check(sim) {
      const writes = sim.calls.filter((c) => c.name === "servoWrite");
      const on9 = writes.filter((c) => c.args[0] === 9).map((c) => c.args[1]);
      const steps = on9.slice(1).map((a, i) => a - on9[i]);
      return [
        item(on9.length > 0, "The servo is attached to pin 9 and moving",
          writes.length ? "The servo moves, but it isn't on pin 9 - use myServo.attach(9)." : "The servo never moves - attach it with myServo.attach(9) and move it with myServo.write(angle)."),
        item(on9.length && Math.min(...on9) <= 5 && Math.max(...on9) >= 175, "It sweeps the full range, 0° to 180°", "It should reach both ends: 0° and 180°."),
        item(steps.length && steps.every((d) => Math.abs(d) <= 10), "Small steps, so the sweep is smooth",
          steps.some((d) => d < -100) ? "It jumps from 180° straight back to 0° - sweep back down step by step instead." : "It moves in big jumps - step the angle a little at a time, with a short delay()."),
        item(steps.some((d) => d > 0) && steps.some((d) => d < 0), "It sweeps there and back", "It only sweeps one way - after reaching 180°, sweep back down to 0°."),
      ];
    },
  },

  c15: {
    ms: 3000,
    inputs: { pulseIn: (pin, t) => (t < 1000 ? 1160 : t < 2000 ? 5800 : 406) },
    circuit: [circuit.ultrasonic(6, 5)],
    check(sim) {
      const trig = sim.calls.filter((c) => c.name === "digitalWrite" && c.args[0] === 6);
      const echoReads = sim.calls.filter((c) => c.name === "pulseIn" && c.args[0] === 5);
      const printed = numbers(sim);
      const expected = (t) => usToCm(t < 1000 ? 1160 : t < 2000 ? 5800 : 406);
      const right = printed.filter((p) => Math.abs(p.v - expected(p.t)) <= 1.5);
      const perSecond = printed.length / 3;
      return [
        item(sim.hardware.modes[6] === "OUTPUT" && trig.some((c) => c.args[1])  && trig.some((c) => !c.args[1]), "It triggers a measurement on pin 6",
          "Trigger a measurement by pulsing the trig pin: pinMode(6, OUTPUT), then digitalWrite(6, HIGH) for 10 microseconds, then LOW."),
        item(echoReads.length > 0, "It times the echo with pulseIn() on pin 5", "Time the echo with pulseIn(5, HIGH)."),
        item(printed.length > 0 && right.length === printed.length, "It prints the distance in centimetres",
          printed.some((p) => p.v > 1000) ? "It prints the raw echo time in microseconds - convert it to centimetres (divide by 58)." : printed.length ? "The numbers printed don't match the distance in cm (20 cm, then 100 cm, then 7 cm in this test)." : "Nothing was printed."),
        item(perSecond >= 3 && perSecond <= 8, "About 5 readings a second", `It prints about ${Math.round(perSecond)} readings a second - aim for about 5: delay(200).`),
      ];
    },
  },

  c17: {
    ms: 3000,
    inputs: { analogRead: phases([[0, 1000, 50], [1000, 2000, 1000]], 50) },
    circuit: [circuit.ldr, circuit.led(13)],
    check(sim) {
      const lv = (t) => sim.hardware.levelAt(13, t);
      return [
        item(sim.calls.some((c) => c.name === "analogRead" && c.args[0] === 14), "It reads the light sensor on A0", "Read the light level with analogRead(A0)."),
        outputItem(sim, 13, "LED"),
        item(lv(900) > 0 && lv(2900) > 0, "Dark (a reading of 50) → the LED turns on", "When it's dark (a reading of 50) the LED should be on."),
        item(lv(1900) === 0, "Bright (a reading of 1000) → the LED turns off", "When it's bright (a reading of 1000) the LED should be off."),
      ];
    },
  },

  c16: {
    ms: 3000,
    inputs: { digitalRead: lowDuring(4, [[1000, 2000]]) },
    circuit: [circuit.ir(4), circuit.led(13)],
    check(sim) {
      const lv = (t) => sim.hardware.levelAt(13, t);
      return [
        item(sim.calls.some((c) => c.name === "digitalRead" && c.args[0] === 4), "It reads the IR sensor on pin 4", "Read the sensor with digitalRead(4)."),
        outputItem(sim, 13, "LED"),
        item(lv(1500) > 0, "Obstacle → the LED turns on", "When the sensor sees an obstacle the LED should turn on. (These sensors read LOW when they detect something.)"),
        item(lv(500) === 0 && lv(2500) === 0, "No obstacle → the LED stays off", "With no obstacle the LED should be off - check which reading (HIGH or LOW) means \"obstacle\"."),
      ];
    },
  },

  c18: {
    ms: 3000,
    inputs: { pulseIn: (pin, t) => (t < 1000 ? 2900 : t < 2000 ? 1160 : 290) },
    circuit: [circuit.ultrasonic(6, 5), circuit.led(13), circuit.buzzer(8)],
    check(sim) {
      const lv = (t) => sim.hardware.levelAt(13, t);
      const beep = (t) => sim.hardware.soundAt(8, t) !== null;
      return [
        item(sim.calls.some((c) => c.name === "pulseIn" && c.args[0] === 5), "It measures distance with the ultrasonic sensor", "Measure the distance: pulse trig (pin 6), then time the echo with pulseIn(5, HIGH)."),
        outputItem(sim, 13, "LED"),
        item(lv(900) === 0 && !beep(900), "Far away (50 cm): LED off, silent", "Farther than 30 cm the LED should be off and the buzzer silent."),
        item(lv(1900) > 0 && !beep(1900), "Getting close (20 cm): LED on, still silent", "Between 10 and 30 cm the LED should be on, with no sound yet."),
        item(lv(2900) > 0 && beep(2900), "Very close (5 cm): LED on and buzzer sounding", "Closer than 10 cm the LED should be on AND the buzzer should sound (tone on pin 8)."),
      ];
    },
  },
};

export function hasCheck(challengeId) {
  return Object.prototype.hasOwnProperty.call(CHALLENGE_CHECKS, challengeId);
}

// findings: board.inspectCircuit().findings for the lesson's board, or null
// to skip the circuit part (the tests check behaviour on its own).
export function runChallengeCheck(challengeId, code, findings = null) {
  const spec = CHALLENGE_CHECKS[challengeId];
  if (!spec) return null;
  const sim = simulate(code, { ms: spec.ms, inputs: { digitalRead: () => 1, ...spec.inputs }, yieldCost: 2 });
  if (sim.errors.length) {
    return { status: "error", items: [], error: explainError(sim.errorDetails[0]), circuitChecked: false };
  }
  const items = spec.check(sim, code);
  const circuitChecked = !!findings && !!spec.circuit;
  if (circuitChecked) for (const rule of spec.circuit) items.push(rule(findings));
  return { status: items.every((i) => i.ok) ? "pass" : "fail", items, error: null, circuitChecked };
}
