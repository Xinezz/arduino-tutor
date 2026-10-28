// The real circuit board (js/simulator/board.js) driven by the interpreter:
// LED blink, buttons with INPUT / INPUT_PULLUP, pull resistors, floating
// pins, PWM, analog input. Runs the actual board code against a tiny fake DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBoard } from "../js/simulator/board.js";
import { createFakeSvg } from "./helpers/fakeDom.js";
import { runSketch, createFakeTiming } from "./helpers/sim.js";

function boardWith(random = () => 0.25) {
  const board = createBoard(createFakeSvg(), { random });
  board.setRunning(true);
  return board;
}

// The same object panel.js hands to the interpreter, plus a call log.
function wire(board, clock) {
  const calls = [];
  const api = { calls };
  for (const key of ["pinMode", "digitalWrite", "digitalRead", "analogRead", "analogWrite", "pulseIn", "tone", "noTone", "servoWrite", "lcdBegin", "lcdPrint", "lcdSetCursor", "lcdClear", "pinStatus"]) {
    api[key] = (...args) => {
      calls.push({ t: clock.now(), name: key, args });
      return board[key](...args);
    };
  }
  return api;
}

function addButton(board, pin, otherSide) {
  const id = board.addComponent("button");
  board.connect(`${id}-1`, `pin-${pin}`);
  if (otherSide) board.connect(`${id}-2`, otherSide);
  return id;
}

test("blink: pin 13 really turns on and off every 500 ms", () => {
  const board = boardWith();
  const clock = createFakeTiming();
  runSketch(`void setup() { pinMode(13, OUTPUT); }
    void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }`, { ms: 250, clock, hardware: wire(board, clock) });
  assert.equal(board.pinStatus(13).level, 255);
  clock.advance(500);
  assert.equal(board.pinStatus(13).level, 0);
  clock.advance(500);
  assert.equal(board.pinStatus(13).level, 255);
});

test("INPUT_PULLUP + button to GND: HIGH when released, LOW when pressed", () => {
  const board = boardWith();
  const btn = addButton(board, 7, "gnd");
  board.pinMode(7, "INPUT_PULLUP");
  assert.equal(board.digitalRead(7), 1);
  board.setButtonPressed(btn, true);
  assert.equal(board.digitalRead(7), 0);
  board.setButtonPressed(btn, false);
  assert.equal(board.digitalRead(7), 1);
  assert.equal(board.pinStatus(7).floating, false);
});

test("INPUT_PULLUP with nothing connected reads HIGH (it used to read LOW)", () => {
  const board = boardWith();
  board.pinMode(7, "INPUT_PULLUP");
  assert.equal(board.digitalRead(7), 1);
});

test("INPUT_PULLUP + button to 5V reads HIGH either way (pressing can't pull it LOW)", () => {
  const board = boardWith();
  const btn = addButton(board, 7, "5v");
  board.pinMode(7, "INPUT_PULLUP");
  assert.equal(board.digitalRead(7), 1);
  board.setButtonPressed(btn, true);
  assert.equal(board.digitalRead(7), 1);
});

test("INPUT + button to 5V with no pull-down resistor: HIGH when pressed, floating when released", () => {
  let n = 0;
  const board = boardWith(() => [0.1, 0.9, 0.2, 0.8][n++ % 4]);
  const btn = addButton(board, 7, "5v");
  board.pinMode(7, "INPUT");
  assert.equal(board.pinStatus(7).floating, true);
  const readings = [board.digitalRead(7), board.digitalRead(7), board.digitalRead(7), board.digitalRead(7)];
  assert.deepEqual(readings, [0, 1, 0, 1], "a floating pin reads noise");
  board.setButtonPressed(btn, true);
  assert.equal(board.digitalRead(7), 1);
  assert.equal(board.pinStatus(7).floating, false);
});

test("INPUT + button to 5V + 10k pull-down to GND: LOW when released, HIGH when pressed", () => {
  const board = boardWith();
  const btn = addButton(board, 7, "5v");
  const r = board.addComponent("resistor");
  board.connect(`${r}-1`, "pin-7");
  board.connect(`${r}-2`, "gnd-railbot-3");
  board.pinMode(7, "INPUT");
  assert.equal(board.digitalRead(7), 0);
  assert.equal(board.pinStatus(7).floating, false);
  board.setButtonPressed(btn, true);
  assert.equal(board.digitalRead(7), 1);
});

test("a wire straight from a pin to GND or 5V drives it", () => {
  const board = boardWith();
  board.connect("pin-4", "gnd");
  board.connect("pin-5", "5v");
  board.pinMode(4, "INPUT_PULLUP");
  board.pinMode(5, "INPUT");
  assert.equal(board.digitalRead(4), 0);
  assert.equal(board.digitalRead(5), 1);
});

test("digitalWrite(HIGH) on an INPUT pin only turns on the pull-up - it doesn't drive the pin", () => {
  const board = boardWith();
  board.pinMode(8, "INPUT");
  board.digitalWrite(8, 1);
  assert.equal(board.pinStatus(8).level, 0, "not driven, so an LED stays off");
  assert.equal(board.pinStatus(8).pullup, true);
  assert.equal(board.digitalRead(8), 1, "the pull-up makes it read HIGH");
  board.pinMode(8, "OUTPUT");
  assert.equal(board.pinStatus(8).level, 255, "switching to OUTPUT with the bit set drives HIGH, like real hardware");
});

test("analogWrite follows the Uno: PWM pins keep the low 8 bits, other pins switch at 128", () => {
  const board = boardWith();
  board.analogWrite(9, 100);
  assert.equal(board.pinStatus(9).level, 100);
  assert.equal(board.pinStatus(9).mode, "OUTPUT", "analogWrite makes the pin an output");
  board.analogWrite(9, 300);
  assert.equal(board.pinStatus(9).level, 44);
  board.analogWrite(13, 100);
  assert.equal(board.pinStatus(13).level, 0);
  board.analogWrite(13, 200);
  assert.equal(board.pinStatus(13).level, 255);
});

test("button sketch (lesson challenge c4 style): holding the button lights the LED", () => {
  const board = boardWith();
  const clock = createFakeTiming();
  const btn = addButton(board, 7, "gnd");
  const r = runSketch(`
    int ledPin = 13;
    int buttonPin = 7;
    void setup() { pinMode(ledPin, OUTPUT); pinMode(buttonPin, INPUT_PULLUP); }
    void loop() {
      if (digitalRead(buttonPin) == LOW) { digitalWrite(ledPin, HIGH); } else { digitalWrite(ledPin, LOW); }
    }`, { ms: 50, clock, hardware: wire(board, clock) });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(board.pinStatus(13).level, 0);
  board.setButtonPressed(btn, true);
  clock.advance(50);
  assert.equal(board.pinStatus(13).level, 255);
  board.setButtonPressed(btn, false);
  clock.advance(50);
  assert.equal(board.pinStatus(13).level, 0);
});

test("an unwired INPUT pin in a sketch reads noise and gets the floating-pin warning", () => {
  const board = boardWith();
  const clock = createFakeTiming();
  addButton(board, 7, "5v");
  const r = runSketch(`
    void setup() { Serial.begin(9600); pinMode(7, INPUT); }
    void loop() { Serial.println(digitalRead(7)); delay(100); }`, { ms: 500, clock, hardware: wire(board, clock) });
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /floating/);
});

test("analogRead + analogWrite with a potentiometer driving an LED's brightness (challenge c10)", () => {
  const board = boardWith();
  const clock = createFakeTiming();
  const pot = board.addComponent("potentiometer");
  board.connect(`${pot}-w`, "pin-14");
  board.updateComponent(pot, { rawValue: 600 });
  runSketch(`
    int potPin = A0;
    int ledPin = 9;
    void setup() { pinMode(ledPin, OUTPUT); }
    void loop() {
      int raw = analogRead(potPin);
      int brightness = map(raw, 0, 1023, 0, 255);
      analogWrite(ledPin, brightness);
    }`, { ms: 20, clock, hardware: wire(board, clock) });
  assert.equal(board.analogRead(14), 600);
  assert.equal(board.pinStatus(9).level, 149);
});

test("Serial output, millis() and analogRead together (temperature sensor lesson)", () => {
  const board = boardWith();
  const clock = createFakeTiming();
  const t = board.addComponent("tempsensor");
  board.connect(`${t}-s`, "pin-14");
  board.updateComponent(t, { tempC: 22 });
  const r = runSketch(`
    int tempPin = A0;
    void setup() { Serial.begin(9600); }
    void loop() {
      int raw = analogRead(tempPin);
      float voltage = raw / 1023.0 * 5.0;
      float tempC = (voltage - 0.5) * 100.0;
      Serial.print(millis());
      Serial.print(" ms: ");
      Serial.println(tempC);
      delay(300);
    }`, { ms: 700, clock, hardware: wire(board, clock) });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines, ["0 ms: 21.85", "300 ms: 21.85", "600 ms: 21.85"]);
});

test("reset() clears modes, outputs and pull-ups between runs", () => {
  const board = boardWith();
  board.pinMode(7, "INPUT_PULLUP");
  board.analogWrite(9, 120);
  board.reset();
  assert.deepEqual(board.pinStatus(9), { mode: "INPUT", floating: true, pullup: false, level: 0 });
  assert.equal(board.pinStatus(7).pullup, false);
});
