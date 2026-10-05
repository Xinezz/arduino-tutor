// Runs a sketch "headless" against a virtual clock and records everything it
// does to the hardware - every pinMode/digitalWrite/analogWrite/tone/print,
// each stamped with the (virtual) millisecond it happened at. This is what
// automatic challenge checking runs on (see js/lessons/checks.js).
//
// Why a separate runner instead of watching the live board: startProgram()
// paces delay() in real time (and caps each one at 1.5s), so verifying even a
// short traffic-light cycle would mean sitting and waiting for it - and the
// result would depend on the learner's wiring rather than their code. Here
// delay(3000) just moves the virtual clock forward 3000ms instantly, so a
// 15-second run finishes in a few milliseconds of real time, and inputs
// (buttons, potentiometers) are scripted by the check instead of wired up.

import { parse, Interpreter, SimError } from "./interpreter.js";

// Rough cost of one statement on a real 16 MHz Uno. Only matters for code
// with no delay() at all (e.g. a button-polling loop): time still has to
// move forward or a millis()-based loop would never see time pass.
const MS_PER_STATEMENT = 0.01;
const MAX_STATEMENTS = 3_000_000; // safety net, well above any realistic check
const MAX_REAL_MS = 4000;         // never freeze the tab for longer than this

// inputs: {
//   digital: (pin, t) => 0 | 1 | undefined   - what digitalRead(pin) sees at time t
//   analog:  (pin, t) => 0-1023 | undefined  - what analogRead(pin) sees at time t (A0 = 14)
// }
// Returns { error, events, durationMs } - error is a learner-facing message or null.
export function traceProgram(source, { durationMs = 5000, inputs = {} } = {}) {
  const events = [];
  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    return { error: e instanceof SimError ? e.message : String(e), events, durationMs };
  }
  if (!ast.functions.setup || !ast.functions.loop) {
    return { error: "Every sketch needs both a setup() and a loop() function.", events, durationMs };
  }

  let now = 0;
  const outputs = {}; // pin -> last written 0-255, so digitalRead of an OUTPUT pin reads back
  const record = (kind, pin, value) => events.push({ t: now, kind, pin, value });

  const api = {
    pinMode: (pin, mode) => record("pinMode", pin, mode),
    digitalWrite: (pin, value) => { outputs[pin] = value ? 255 : 0; record("digitalWrite", pin, value ? 1 : 0); },
    analogWrite: (pin, value) => {
      const v = Math.max(0, Math.min(255, Math.round(value)));
      outputs[pin] = v;
      record("analogWrite", pin, v);
    },
    digitalRead: (pin) => {
      const scripted = inputs.digital?.(pin, now);
      if (scripted !== undefined) return scripted ? 1 : 0;
      return (outputs[pin] ?? 0) > 0 ? 1 : 0;
    },
    analogRead: (pin) => inputs.analog?.(pin, now) ?? 0,
    pulseIn: () => 0,
    tone: (pin, frequency) => record("tone", pin, frequency),
    noTone: (pin) => record("noTone", pin, 0),
    servoWrite: (pin, angle) => record("servo", pin, angle),
    millisNow: () => Math.floor(now),
    print: (text) => record("print", null, text),
  };

  const gen = new Interpreter(ast, api).run();
  const realStart = Date.now();
  let statements = 0;

  try {
    while (now < durationMs) {
      const { value, done } = gen.next();
      if (done) break;
      if (value.type === "delay") {
        now += Math.max(0, Number(value.ms) || 0);
      } else {
        now += MS_PER_STATEMENT;
        statements++;
        if (statements > MAX_STATEMENTS || (statements % 10000 === 0 && Date.now() - realStart > MAX_REAL_MS)) {
          return { error: "The check gave up - your sketch ran too long without finishing. Is there a loop that never ends?", events, durationMs };
        }
      }
    }
  } catch (e) {
    return { error: e instanceof SimError ? e.message : String(e), events, durationMs };
  }

  return { error: null, events, durationMs };
}
